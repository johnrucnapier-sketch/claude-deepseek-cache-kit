import { createHmac, randomBytes } from 'node:crypto';

const tokenTag = /<total_tokens>[^<]*<\/total_tokens>/g;
const hookMarker = 'UserPromptSubmit hook additional context';

/** Anthropic-shaped body.system only. Every transformation is opt-in. */
export function normalizeRequest(body, options = {}) {
  const out = structuredClone(body);
  const changes = { billingVersions: 0, tokenCounters: 0, droppedCounters: 0, droppedHooks: 0 };
  if (!Array.isArray(out.system)) return { body: out, changes };
  out.system = out.system.flatMap(block => {
    if (!block || block.type !== 'text' || typeof block.text !== 'string') return [block];
    const text = block.text;
    // Broad historical rule: enable ONLY after reviewing the entire hook block.
    if (options.dropHookContext === true && text.includes(hookMarker)) {
      changes.droppedHooks++;
      return [];
    }
    if (options.dropPureTokenCounters === true && /<total_tokens>[^<]*<\/total_tokens>/.test(text)
        && text.replace(tokenTag, '').trim() === '') {
      changes.droppedCounters++;
      return [];
    }
    let next = text;
    if (options.normalizeBillingVersion === true) {
      // Restrict to an explicitly identified billing-header line.
      next = next.replace(/^([ \t]*x-anthropic-billing-header:[^\r\n]*)$/gm, line =>
        line.replace(/\bcc_version=[0-9A-Za-z._-]+/g, () => {
          changes.billingVersions++;
          return 'cc_version=X';
        }));
    }
    if (options.normalizeTokenCounters === true) {
      next = next.replace(tokenTag, () => {
        changes.tokenCounters++;
        return '<total_tokens>N</total_tokens>';
      });
    }
    return [{ ...block, text: next }];
  });
  return { body: out, changes };
}

const serialized = value => JSON.stringify(value ?? null);
const bytes = value => Buffer.byteLength(serialized(value), 'utf8');

/** Offsets refer to local JSON UTF-8 bytes, NOT provider tokens. No text returned. */
export function firstDifferentByte(a, b) {
  const left = Buffer.from(serialized(a));
  const right = Buffer.from(serialized(b));
  const n = Math.min(left.length, right.length);
  for (let i = 0; i < n; i++) if (left[i] !== right[i]) return i;
  return left.length === right.length ? null : n;
}

/** Reuse one instance per comparison run. Random key prevents offline plain-hash guessing. */
export function createFingerprinter(key = randomBytes(32)) {
  if (!Buffer.isBuffer(key) || key.length < 32) throw new TypeError('Use a Buffer key of at least 32 bytes');
  const secret = Buffer.from(key);
  const hash = value => createHmac('sha256', secret).update(serialized(value)).digest('hex');
  const part = value => ({ fingerprint: hash(value), bytes: bytes(value) });
  return body => ({
    system: part(body.system),
    tools: part(body.tools),
    messages: (Array.isArray(body.messages) ? body.messages : []).map((m, index) => ({
      index,
      role: ['user', 'assistant', 'system', 'tool', 'developer'].includes(m?.role) ? m.role : 'other',
      ...part(m),
    })),
  });
}

/** Explicit DeepSeek Chat Completions hit/miss fields; absent usage is unknown. */
export function summarizeDeepSeekUsage(records) {
  let hit = 0, miss = 0, reported = 0;
  for (const record of records) {
    const h = record?.prompt_cache_hit_tokens;
    const m = record?.prompt_cache_miss_tokens;
    if (!Number.isSafeInteger(h) || h < 0 || !Number.isSafeInteger(m) || m < 0) continue;
    hit += h;
    miss += m;
    reported++;
  }
  return { hit, miss, reported, unknown: records.length - reported,
    hitRate: hit + miss ? hit / (hit + miss) : null };
}
