import { normalizeRequest, createFingerprinter, firstDifferentByte, summarizeDeepSeekUsage } from '../src/index.mjs';

// All content is synthetic. No provider calls, files containing secrets, or billable traffic.
const request = (version, count, time) => ({
  model: 'example-model',
  system: [
    { type: 'text', text: `x-anthropic-billing-header: cc_version=${version}\nYou are a coding assistant.` },
    { type: 'text', text: `<total_tokens>${count}</total_tokens>` },
    { type: 'text', text: `UserPromptSubmit hook additional context: ${time}` },
  ],
  tools: [{ name: 'example', input_schema: { type: 'object', properties: {} } }],
  messages: [{ role: 'user', content: 'Explain this synthetic example.' }],
});
const before = request('2.1.286.205', 100, 'SYNTHETIC_TIME_A');
const after = request('2.1.286.846', 200, 'SYNTHETIC_TIME_B');
// These exact synthetic blocks were reviewed; no useful hook instructions exist in them.
const options = { normalizeBillingVersion: true, dropPureTokenCounters: true, dropHookContext: true };
const a = normalizeRequest(before, options);
const b = normalizeRequest(after, options);
const fingerprint = createFingerprinter();
console.log(JSON.stringify({
  synthetic: true,
  rawFirstDifferenceByte: firstDifferentByte(before.system, after.system),
  normalizedFirstDifferenceByte: firstDifferentByte(a.body.system, b.body.system),
  rawStable: fingerprint(before).system.fingerprint === fingerprint(after).system.fingerprint,
  normalizedStable: fingerprint(a.body).system.fingerprint === fingerprint(b.body).system.fingerprint,
  changes: b.changes,
  historicalReportedUsage: summarizeDeepSeekUsage([{ prompt_cache_hit_tokens: 847232, prompt_cache_miss_tokens: 67386 }]),
  note: 'Prefix stability demo only. Historical usage is not a new API measurement.',
}, null, 2));
