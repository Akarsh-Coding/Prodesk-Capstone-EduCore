// Shows which Gemini models YOUR API KEY can use, so you can pick a valid GEMINI_MODEL.
// Run it from the server/ folder (it reads GEMINI_API_KEY from server/.env and never prints the key):
//
//   node scripts/listGeminiModels.js                       list the models that can generate text
//   node scripts/listGeminiModels.js --all                 list every model, with what it supports
//   node scripts/listGeminiModels.js --test gemini-xxxx    send ONE tiny request to that model to prove it works
//
// Then put the name (without the "models/" prefix) in server/.env as GEMINI_MODEL and restart the server.
require('dotenv').config({ quiet: true });

const API = 'https://generativelanguage.googleapis.com/v1beta';
const key = (process.env.GEMINI_API_KEY || '').trim();
const args = process.argv.slice(2);
const showAll = args.includes('--all');
const testIndex = args.indexOf('--test');
const testModel = testIndex !== -1 ? (args[testIndex + 1] || '').replace(/^models\//, '') : null;

const redact = (text) => {
  let out = String(text);
  if (key.length >= 8) out = out.split(key).join('[key]');
  return out.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[key]');
};
const stop = (message) => {
  throw new Error(redact(message));
};

// Turns a failed HTTP response into advice you can act on
function explain(status, body) {
  const apiMessage = redact((body && body.error && body.error.message) || '').slice(0, 300);
  const reason = (body && body.error && body.error.status) || '';
  if (status === 400 && /api key/i.test(apiMessage)) return `Google says the key is not valid (${apiMessage}). Create a new key in Google AI Studio and copy it into GEMINI_API_KEY.`;
  if (status === 400) return `Google rejected the request (HTTP 400): ${apiMessage}`;
  if (status === 401 || status === 403) return `The key was recognised but is not allowed to do this (HTTP ${status} ${reason}): ${apiMessage}\nCheck that the Generative Language API is enabled for the key's project, that the key has no restrictions blocking this, and that Gemini is available in your region.`;
  if (status === 404) return `That model was not found for this key (HTTP 404). Pick a name from the list; do not include the "models/" prefix.`;
  if (status === 429) return `The key works but its quota for this model is used up or is zero (HTTP 429 ${reason}). Try another model or wait for the quota to reset.`;
  return `Google answered HTTP ${status}${reason ? ` ${reason}` : ''}: ${apiMessage}`;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    // The key goes in a header, never in the URL, so it cannot end up in logs or the shell history
    const res = await fetch(`${API}${path}`, { ...options, headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, signal: controller.signal });
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    stop(err.name === 'AbortError' ? 'Google did not answer within 20 seconds. Check your internet connection and try again.' : `Could not reach Google: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function listModels() {
  const models = [];
  let pageToken = '';
  do {
    const res = await request(`/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    if (!res.ok) stop(explain(res.status, res.body));
    models.push(...((res.body && res.body.models) || []));
    pageToken = (res.body && res.body.nextPageToken) || '';
  } while (pageToken);
  return models;
}

// Special-purpose models (images, speech, embeddings, live audio...) can't produce a JSON quiz
const SPECIAL = /(embedding|aqa|imagen|veo|tts|image|live|audio|vision|robotics|computer-use|learnlm)/i;
const rank = (name) => (/flash/.test(name) && !/lite/.test(name) ? 0 : /flash-lite|lite/.test(name) ? 1 : /pro/.test(name) ? 2 : 3);

async function main() {
  if (!key) stop('GEMINI_API_KEY is not set. Put it in server/.env (and run this from the server/ folder).');
  console.log('Using GEMINI_API_KEY from the server environment. The key is never printed.');

  if (testModel !== null) {
    if (!testModel) stop('Give a model name after --test, for example: node scripts/listGeminiModels.js --test gemini-2.5-flash');
    console.log(`\nSending one tiny request to "${testModel}"...`);
    const res = await request(`/models/${encodeURIComponent(testModel)}:generateContent`, {
      method: 'POST',
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }], generationConfig: { maxOutputTokens: 256 } }),
    });
    if (!res.ok) stop(`FAILED. ${explain(res.status, res.body)}`);
    const parts = (((res.body.candidates || [])[0] || {}).content || {}).parts || [];
    const reply = parts.map((p) => p.text || '').join('').trim();
    console.log(`\nWORKS. "${testModel}" answered: ${reply || '(an empty reply, but the request was accepted)'}`);
    console.log(`\nUse it: set GEMINI_MODEL=${testModel} in server/.env, then restart the server.\n`);
    return;
  }

  const all = await listModels();
  const withName = all.map((m) => ({ ...m, short: String(m.name || '').replace(/^models\//, '') }));
  const canGenerate = withName.filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'));
  const shown = (showAll ? withName : canGenerate).sort((a, b) => rank(a.short) - rank(b.short) || a.short.localeCompare(b.short));

  console.log(`\nGoogle returned ${all.length} models for this key; ${canGenerate.length} can generate text (generateContent).\n`);
  const pad = Math.max(...shown.map((m) => m.short.length), 10);
  for (const m of shown) {
    const note = !canGenerate.includes(m) ? '  (cannot generate text)' : SPECIAL.test(m.short) ? '  (special purpose: not for a text quiz)' : '';
    const limits = m.inputTokenLimit ? `in ${m.inputTokenLimit} / out ${m.outputTokenLimit || '?'} tokens` : '';
    console.log(`  ${m.short.padEnd(pad)}  ${(m.displayName || '').padEnd(28)} ${limits}${note}`);
  }

  const suggested = canGenerate.filter((m) => /^gemini-/.test(m.short) && !SPECIAL.test(m.short)).sort((a, b) => rank(a.short) - rank(b.short) || a.short.localeCompare(b.short));
  if (suggested.length) {
    console.log(`\nGood candidates for the quiz (fast and inexpensive "flash" tier first): ${suggested.slice(0, 3).map((m) => m.short).join(', ')}`);
    console.log(`\nNext:\n  1. node scripts/listGeminiModels.js --test ${suggested[0].short}     (proves the model answers with YOUR key and quota)\n  2. put GEMINI_MODEL=${suggested[0].short} in server/.env and restart the server\n`);
  } else {
    console.log('\nNo general text model was returned for this key. Check the key in Google AI Studio.\n');
  }
}

main().catch((err) => {
  console.error(`\n${redact(`Unexpected error: ${err.message}`)}\n`);
  process.exitCode = 1;
});
