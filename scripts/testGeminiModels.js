const fs = require('node:fs/promises');
const path = require('node:path');
require(require.resolve('dotenv', { paths: [path.resolve(__dirname, '../server')] })).config({
  path: path.resolve(__dirname, '../server/.env'),
  quiet: true,
});
const {
  API_BASE,
  PRICING_SOURCE,
  getApiKey,
  normalizeModelId,
  requestWithRetries,
  runModelTest,
} = require('./testGeminiModel');

const REPORT_PATH = path.resolve(__dirname, '../server/reports/gemini-model-comparison.json');
const EXCLUDED_MODEL = /(embedding|imagen|nano-banana|image|audio|tts|live|transcri|speech|lyria|music|veo|omni|video|robotics|vision|computer[-_]?use)/i;
const INTER_REQUEST_DELAY_MS = 250;

async function listAvailableModels(apiKey) {
  const models = [];
  let pageToken = '';
  do {
    const url = new URL(`${API_BASE}/models`);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await requestWithRetries(url.toString(), {
      headers: { 'x-goog-api-key': apiKey },
    });
    models.push(...(Array.isArray(page.models) ? page.models : []));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return models;
}

function getEligibleModels(models) {
  const eligible = new Map();
  for (const model of models) {
    const modelId = normalizeModelId(model.baseModelId || model.name);
    const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
    if (!/^gemini-/i.test(modelId) || !methods.includes('generateContent') || EXCLUDED_MODEL.test(modelId)) continue;
    if (!eligible.has(modelId)) {
      eligible.set(modelId, {
        model: modelId,
        resourceName: model.name || `models/${modelId}`,
        displayName: model.displayName || null,
        description: model.description || null,
        inputTokenLimit: model.inputTokenLimit || null,
        outputTokenLimit: model.outputTokenLimit || null,
      });
    }
  }
  return [...eligible.values()].sort((a, b) => a.model.localeCompare(b.model));
}

function rankResult(results, key, direction) {
  const metric = (result) => key.split('.').reduce((value, part) => value && value[part], result);
  return results
    .filter((result) => result.status === 'success' && Number.isFinite(metric(result)))
    .sort((a, b) => direction * (metric(a) - metric(b)) || a.model.localeCompare(b.model));
}

function getWinners(results) {
  const valid = results.filter((result) => result.status === 'success');
  const knownCost = valid.filter((result) => result.pricingKnown && Number.isFinite(result.estimatedCostUsd));
  const costRanks = rankResult(knownCost, 'estimatedCostUsd', 1);
  const tokenRanks = rankResult(valid, 'usage.totalTokens', 1);
  const speedRanks = rankResult(valid, 'responseTimeMs', 1);
  const tokenSorted = valid.filter((result) => Number.isFinite(result.usage.totalTokens))
    .sort((a, b) => a.usage.totalTokens - b.usage.totalTokens || a.model.localeCompare(b.model));
  const scoreRanks = new Map();
  const scoredModels = new Set(knownCost.map((result) => result.model));
  const metrics = [
    { list: rankResult(knownCost, 'estimatedCostUsd', 1), weight: 0.4 },
    { list: rankResult(knownCost, 'responseTimeMs', 1), weight: 0.35 },
    { list: rankResult(knownCost, 'usage.totalTokens', 1), weight: 0.25 },
  ];
  for (const { list, weight } of metrics) {
    list.forEach((result, index) => {
      scoreRanks.set(result.model, (scoreRanks.get(result.model) || 0) + ((index + 1) / list.length) * weight);
    });
  }
  const overall = [...scoreRanks.entries()]
    .filter(([model]) => scoredModels.has(model))
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0];

  return {
    lowestTokenConsumption: tokenSorted[0] ? tokenSorted[0].model : null,
    lowestEstimatedCost: costRanks[0] ? costRanks[0].model : null,
    fastest: speedRanks[0] ? speedRanks[0].model : null,
    bestOverall: overall ? overall[0] : null,
    bestOverallMethod:
      'Among structurally valid quiz outputs with verified standard-tier pricing: rank-based score weighted 40% estimated cost, 35% response time, and 25% total tokens. Lower is better.',
  };
}

function formatValue(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function printReport(report) {
  console.log(`\nDiscovered models: ${report.counts.discovered}; eligible/tested: ${report.counts.tested}; valid: ${report.counts.successful}; failed/invalid: ${report.counts.failed}`);
  const rows = report.results.map((result) => ({
    Model: result.model,
    Status: result.status,
    Input: result.usage ? result.usage.inputTokens ?? 'n/a' : 'n/a',
    Output: result.usage ? result.usage.outputTokens ?? 'n/a' : 'n/a',
    Total: result.usage ? result.usage.totalTokens ?? 'n/a' : 'n/a',
    Thinking: result.usage ? result.usage.thinkingTokens ?? 'n/a' : 'n/a',
    Cached: result.usage ? result.usage.cachedTokens ?? 'n/a' : 'n/a',
    'Time ms': result.responseTimeMs == null ? 'n/a' : result.responseTimeMs,
    'Est. USD': formatValue(result.estimatedCostUsd, 8),
  }));
  console.table(rows);
  console.log('Lowest token consumption:', report.winners.lowestTokenConsumption || 'No valid quiz output');
  console.log('Lowest estimated API cost:', report.winners.lowestEstimatedCost || 'No valid output with verified pricing');
  console.log('Fastest model:', report.winners.fastest || 'No valid quiz output');
  console.log('Best overall model:', report.winners.bestOverall || 'Insufficient valid results with verified pricing');
  if (report.winners.bestOverall) console.log(`GEMINI_MODEL=${report.winners.bestOverall}`);
  console.log(`Comparison saved to ${REPORT_PATH}`);
}

async function saveReport(report) {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const apiKey = getApiKey();
  const allModels = await listAvailableModels(apiKey);
  const models = getEligibleModels(allModels);
  const results = [];

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    console.log(`[${index + 1}/${models.length}] Testing ${model.model}`);
    const result = await runModelTest(model.model);
    results.push({ ...model, ...result });
    console.log(`  ${result.status}${result.quality.reason ? `: ${result.quality.reason}` : ''}${result.error ? `: ${result.error}` : ''}`);
    if (index < models.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    modelsApi: `${API_BASE}/models`,
    pricing: {
      source: PRICING_SOURCE,
      checkedOn: new Date().toISOString().slice(0, 10),
      tier: 'Standard paid tier, USD per 1M tokens',
      note: 'Costs are estimates. Rates are only applied for exact model IDs listed in the script pricing table; no price is inferred for other models. Actual charges depend on account tier, discounts, cached-token billing, and pricing changes.',
    },
    prompt: {
      courseTitle: 'Introduction to the Scientific Method',
      outputRequirements: 'Exactly 5 MCQs; exactly 4 options per question; correctIndex 0-3; non-empty explanations.',
      samePromptAndGenerationConfigForEveryTestedModel: true,
    },
    counts: {
      discovered: allModels.length,
      eligible: models.length,
      tested: results.length,
      successful: results.filter((result) => result.status === 'success').length,
      failed: results.filter((result) => result.status !== 'success').length,
    },
    winners: getWinners(results),
    recommendedConfiguration: null,
    results,
  };
  report.recommendedConfiguration = report.winners.bestOverall
    ? `GEMINI_MODEL=${report.winners.bestOverall}`
    : null;

  await saveReport(report);
  printReport(report);
  if (report.counts.successful === 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(`Gemini model test failed: ${error.message}`);
    process.exitCode = 1;
    if (error && error.status) {
      const report = {
        generatedAt: new Date().toISOString(),
        modelsApi: `${API_BASE}/models`,
        counts: { discovered: 0, eligible: 0, tested: 0, successful: 0, failed: 0 },
        winners: { lowestTokenConsumption: null, lowestEstimatedCost: null, fastest: null, bestOverall: null },
        error: { status: error.status, message: error.message },
        results: [],
      };
      try {
        await saveReport(report);
        console.error(`Failure report saved to ${REPORT_PATH}`);
      } catch (writeError) {
        console.error(`Could not save failure report: ${writeError.message}`);
      }
    }
  });
}

module.exports = { getEligibleModels, getWinners, listAvailableModels };
