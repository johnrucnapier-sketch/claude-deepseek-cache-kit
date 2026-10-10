import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRequest, createFingerprinter, firstDifferentByte, summarizeDeepSeekUsage } from '../src/index.mjs';
const block = text => ({ type: 'text', text });

test('default is a deep-copy no-op, including meaningful hooks and empty text', () => {
  const input = { system: [block('UserPromptSubmit hook additional context: never deploy'), block('')], messages: [] };
  const result = normalizeRequest(input);
  assert.deepEqual(result.body, input);
  assert.notEqual(result.body, input);
});
test('billing normalization is restricted to billing-header lines', () => {
  const input = { system: [block('x-anthropic-billing-header: cc_version=2.1.286.205\nExample cc_version=keep')] };
  const result = normalizeRequest(input, { normalizeBillingVersion: true });
  assert.equal(result.body.system[0].text, 'x-anthropic-billing-header: cc_version=X\nExample cc_version=keep');
  assert.equal(result.changes.billingVersions, 1);
  assert.match(input.system[0].text, /2\.1\.286\.205/);
});
test('pure counter removal preserves empty, mixed, malformed and non-text blocks', () => {
  const input = { system: [block('<total_tokens>12</total_tokens>'), block(''), block('Budget <total_tokens>12</total_tokens>'), block('<total_tokens>12'), { type: 'image', source: { data: 'synthetic' } }, null] };
  const result = normalizeRequest(input, { dropPureTokenCounters: true });
  assert.deepEqual(result.body.system, input.system.slice(1));
  assert.equal(result.changes.droppedCounters, 1);
});
test('mixed counter replacement is separately opt-in and retains metadata', () => {
  const input = { system: [{ ...block('Budget <total_tokens>12</total_tokens>'), cache_control: { type: 'ephemeral' } }] };
  const result = normalizeRequest(input, { normalizeTokenCounters: true });
  assert.equal(result.body.system[0].text, 'Budget <total_tokens>N</total_tokens>');
  assert.deepEqual(result.body.system[0].cache_control, input.system[0].cache_control);
});
test('hook removal is explicit and independent of other rules', () => {
  const input = { system: [block('UserPromptSubmit hook additional context: permission rules')] };
  assert.deepEqual(normalizeRequest(input, { normalizeBillingVersion: true }).body, input);
  assert.equal(normalizeRequest(input, { dropHookContext: true }).body.system.length, 0);
});
test('string system and OpenAI-shaped messages are left unchanged', () => {
  for (const input of [{ system: 'cc_version=12' }, { messages: [{ role: 'system', content: '<total_tokens>1</total_tokens>' }] }]) {
    assert.deepEqual(normalizeRequest(input, { normalizeBillingVersion: true, normalizeTokenCounters: true }).body, input);
  }
});
test('synthetic churn stabilizes, genuine instructions still differ, tools/messages unchanged', () => {
  const make = n => ({ system: [block(`x-anthropic-billing-header: cc_version=2.${n}`), block(`<total_tokens>${n}</total_tokens>`)], messages: [{ role: 'user', content: 'hello' }], tools: [{ name: 'tool' }] });
  const options = { normalizeBillingVersion: true, dropPureTokenCounters: true };
  const a = make(1), b = make(2);
  const na = normalizeRequest(a, options).body, nb = normalizeRequest(b, options).body;
  assert.notEqual(firstDifferentByte(a.system, b.system), null);
  assert.equal(firstDifferentByte(na.system, nb.system), null);
  assert.deepEqual(na.messages, a.messages);
  assert.deepEqual(na.tools, a.tools);
  assert.deepEqual(normalizeRequest(na, options).body, na);
  nb.system.push(block('Do not deploy'));
  assert.notEqual(firstDifferentByte(na.system, nb.system), null);
});
test('diagnostics emit no body snippets, model names or arbitrary role strings', () => {
  const marker = 'SECRET_MARKER_测试';
  const body = { model: marker, system: [block(marker)], tools: [{ name: marker }], messages: [{ role: marker, content: marker }] };
  const fp = createFingerprinter();
  const result = fp(body);
  assert.equal(JSON.stringify(result).includes(marker), false);
  assert.equal(result.system.bytes, Buffer.byteLength(JSON.stringify(body.system)));
  assert.deepEqual(fp(body), result);
  assert.notEqual(createFingerprinter()(body).system.fingerprint, result.system.fingerprint);
  assert.throws(() => createFingerprinter(Buffer.alloc(8)));
});
test('fingerprints detect historical-message and tool-schema mutations', () => {
  const fp = createFingerprinter();
  const body = { tools: [{ name: 'a' }], messages: [{ role: 'user', content: 'a' }] };
  const before = fp(body);
  body.tools[0].name = 'b'; body.messages[0].content = 'b';
  assert.notEqual(fp(body).tools.fingerprint, before.tools.fingerprint);
  assert.notEqual(fp(body).messages[0].fingerprint, before.messages[0].fingerprint);
});
test('difference is a UTF-8 byte offset including unequal-length suffixes', () => {
  assert.equal(firstDifferentByte('中a', '中b'), 4);
  assert.equal(firstDifferentByte([1], [1]), null);
  assert.equal(firstDifferentByte([1], [1, 2]), 2);
});
test('usage is token-weighted and missing values remain unknown', () => {
  const result = summarizeDeepSeekUsage([{ prompt_cache_hit_tokens: 90, prompt_cache_miss_tokens: 10 }, { prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 900 }, {}, { prompt_cache_hit_tokens: -1, prompt_cache_miss_tokens: 2 }]);
  assert.equal(result.hitRate, 0.09);
  assert.equal(result.unknown, 2);
  assert.equal(summarizeDeepSeekUsage([]).hitRate, null);
  assert.equal(summarizeDeepSeekUsage([{ prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 0 }]).hitRate, null);
});
