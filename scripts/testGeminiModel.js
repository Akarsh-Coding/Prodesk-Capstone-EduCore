const path = require('node:path');
require(require.resolve('dotenv', { paths: [path.resolve(__dirname, '../server')] })).config({
  path: path.resolve(__dirname, '../server/.env'),
  quiet: true,
});
const { buildPrompt, SYSTEM_PROMPT } = require('../server/src/services/quizService');
const { generatedQuizSchema } = require('../server/src/validation/schemas');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
const PRICING_SOURCE = 'https://ai.google.dev/gemini-api/docs/pricing';

// Standard paid-tier text-token prices, USD per 1M tokens, checked against Google's pricing page.
const STANDARD_PRICING = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cachedInput: 0.03 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4, cachedInput: 0.01 },
  'gemini-2.5-pro': { input: 1.25, output: 10, cachedInput: 0.125 },
  'gemini-3-flash-preview': { input: 0.5, output: 3, cachedInput: 0.05 },
  'gemini-3.1-pro-preview': { input: 2, output: 12, cachedInput: 0.2 },
  'gemini-3.1-pro-preview-customtools': { input: 2, output: 12, cachedInput: 0.2 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5, cachedInput: 0.025 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5, cachedInput: 0.03 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75, cachedInput: 0.075 },
  'gemini-3.8-flash': { input: 0.75, output: 3.75, cachedInput: 0.075 },
  'gemini-4-hydrogen': { input: 1.5, output: 7.5, cachedInput: 0.075 },
  'gemini-4-argon': { input: 2, output: 10, cachedInput: 0.1 },
  'gemini-4-carbon': { input: 2, output: 10, cachedInput: 0.1 },
};

class GeminiRequestError extends Error {
  constructor(message, status, retryAfterMs) {
    super(message);
    this.name = 'GeminiRequestError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function getApiKey() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing. Set it in server/.env or the process environment.');
  return apiKey;
}

function normalizeModelId(model) {
  return String(model || '').trim().replace(/^models\//, '');
}

function redact(value, apiKey = process.env.GEMINI_API_KEY) {
  let text = String(value == null ? '' : value);
  if (apiKey) text = text.split(apiKey).join('[redacted]');
  return text.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]');
}

function retryDelay(response) {
  const value = response.headers.get('retry-after');
  if (value) {
    const seconds = Number(value);
    const retryAt = Date.parse(value);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : retryAt - Date.now();
    if (Number.isFinite(delay) && delay > 0) return Math.min(delay, 30000);
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }

    if (!response.ok) {
      const error = body && body.error;
      const message = redact((error && error.message) || `Google returned HTTP ${response.status}`);
      throw new GeminiRequestError(message, response.status, retryDelay(response));
    }
    return body;
  } catch (error) {
    if (controller.signal.aborted) throw new GeminiRequestError(`Request timed out after ${timeoutMs} ms`);
    if (error instanceof GeminiRequestError) throw error;
    throw new GeminiRequestError(redact(error && error.message ? error.message : error));
  } finally {
    clearTimeout(timer);
  }
}

function getPricing(model) {
  return STANDARD_PRICING[normalizeModelId(model)] || null;
}

function estimateCost(model, usage) {
  const pricing = getPricing(model);
  if (!pricing || !usage || !Number.isFinite(usage.promptTokenCount) || !Number.isFinite(usage.totalTokenCount)) {
    return { estimatedCostUsd: null, pricingKnown: Boolean(pricing), pricingBasis: 'unavailable' };
  }

  const promptTokens = usage.promptTokenCount;
  const cachedTokens = Math.min(Number(usage.cachedContentTokenCount) || 0, promptTokens);
  const billedInputTokens = Math.max(0, promptTokens - cachedTokens);
  const outputTokens = Math.max(0, usage.totalTokenCount - promptTokens);
  const cachedRate = pricing.cachedInput == null ? pricing.input : pricing.cachedInput;
  const cost =
    (billedInputTokens * pricing.input + cachedTokens * cachedRate + outputTokens * pricing.output) / 1_000_000;

  return {
    estimatedCostUsd: Number(cost.toFixed(10)),
    pricingKnown: true,
    pricingBasis: `Google Standard paid tier; USD per 1M tokens (input ${pricing.input}, output ${pricing.output}, cached input ${cachedRate})`,
  };
}

function extractText(response) {
  const candidate = response && response.candidates && response.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  return {
    text: Array.isArray(parts) ? parts.map((part) => part.text || '').join('').trim() : '',
    finishReason: candidate && candidate.finishReason ? candidate.finishReason : null,
  };
}

function parseQuiz(text) {
  const raw = String(text || '').trim();
  const variants = [raw];
  const fenced = raw.match(/```(?:json)?[ \t]*\r?\n?([\s\S]*?)```/i);
  if (fenced) variants.push(fenced[1].trim());
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) variants.push(raw.slice(first, last + 1));

  for (const candidate of [...new Set(variants)].filter(Boolean)) {
    try {
      const parsed = JSON.parse(candidate);
      const result = generatedQuizSchema.safeParse(parsed);
      if (!result.success) return { valid: false, reason: 'Quiz did not match the required 5-question schema.' };

      const questions = result.data.questions;
      const normalizedQuestions = questions.map((question) => question.question.trim().toLowerCase());
      const uniqueQuestions = new Set(normalizedQuestions);
      const hasDuplicateOptions = questions.some(
        (question) => new Set(question.options.map((option) => option.trim().toLowerCase())).size !== 4
      );
      if (uniqueQuestions.size !== 5) return { valid: false, reason: 'Quiz contains duplicate questions.' };
      if (hasDuplicateOptions) return { valid: false, reason: 'A question contains duplicate answer options.' };
      return { valid: true, reason: null };
    } catch {
      // Try the next plausible JSON span.
    }
  }
  return { valid: false, reason: 'Response was not valid JSON.' };
}

async function requestWithRetries(url, options) {
  let attempt = 0;
  while (true) {
    try {
      return await requestJson(url, options);
    } catch (error) {
      const retryable = !error.status || error.status === 429 || error.status >= 500;
      if (!retryable || attempt >= MAX_RETRIES) throw error;
      const delay = error.retryAfterMs || Math.min(1000 * (2 ** attempt), 10000);
      await sleep(delay);
      attempt += 1;
    }
  }
}

async function runModelTest(model) {
  const apiKey = getApiKey();
  const modelId = normalizeModelId(model);
  if (!modelId) throw new Error('Specify a model ID with --model <model-id>.');

  const prompt = buildPrompt({
    title: 'Introduction to the Scientific Method',
    category: 'Science',
    description:
      'This course teaches learners to ask testable questions, form hypotheses, design controlled experiments, ' +
      'identify independent and dependent variables, collect and analyze data, and draw evidence-based conclusions.',
  });
  const url = `${API_BASE}/models/${encodeURIComponent(modelId)}:generateContent`;
  const startedAt = Date.now();
  let response;
  try {
    response = await requestWithRetries(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
    });
  } catch (error) {
    return {
      model: modelId,
      status: 'failed',
      error: redact(error.message, apiKey),
      httpStatus: error.status || null,
      responseTimeMs: Date.now() - startedAt,
      usage: null,
      quality: { valid: false, reason: 'Generation request failed.' },
      estimatedCostUsd: null,
      pricingKnown: Boolean(getPricing(modelId)),
    };
  }

  const responseTimeMs = Date.now() - startedAt;
  const { text, finishReason } = extractText(response);
  const quality = text
    ? parseQuiz(text)
    : { valid: false, reason: `No text candidate returned${finishReason ? ` (${finishReason})` : ''}.` };
  const rawUsage = response.usageMetadata || {};
  const usage = {
    inputTokens: Number.isFinite(rawUsage.promptTokenCount) ? rawUsage.promptTokenCount : null,
    outputTokens: Number.isFinite(rawUsage.candidatesTokenCount) ? rawUsage.candidatesTokenCount : null,
    totalTokens: Number.isFinite(rawUsage.totalTokenCount) ? rawUsage.totalTokenCount : null,
    thinkingTokens: Number.isFinite(rawUsage.thoughtsTokenCount) ? rawUsage.thoughtsTokenCount : null,
    cachedTokens: Number.isFinite(rawUsage.cachedContentTokenCount) ? rawUsage.cachedContentTokenCount : null,
  };
  const cost = estimateCost(modelId, rawUsage);

  return {
    model: modelId,
    status: quality.valid ? 'success' : 'invalid_output',
    error: null,
    httpStatus: null,
    responseTimeMs,
    finishReason,
    usage,
    quality,
    ...cost,
  };
}

function modelArgument(args) {
  const index = args.indexOf('--model');
  if (index >= 0) return args[index + 1];
  return args.find((arg) => !arg.startsWith('-')) || process.env.GEMINI_MODEL;
}

async function main() {
  const model = modelArgument(process.argv.slice(2));
  if (!model) throw new Error('Usage: node scripts/testGeminiModel.js --model <model-id>');
  const result = await runModelTest(model);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'success') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(redact(error.message));
    process.exitCode = 1;
  });
}

module.exports = {
  API_BASE,
  PRICING_SOURCE,
  STANDARD_PRICING,
  estimateCost,
  getApiKey,
  getPricing,
  normalizeModelId,
  requestJson,
  requestWithRetries,
  runModelTest,
};
