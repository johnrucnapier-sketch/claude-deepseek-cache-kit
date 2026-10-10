# Integrating with an existing Node gateway

Use Node.js 22+. The module has no dependencies and opens no sockets. Copy `src/index.mjs` into your gateway, or import it by local path. The repository is not published to npm.

## Start with observation

Create one fingerprinter per diagnostic run. Compare requests only within the same authenticated client, conversation, model and provider route. Do not use one global “previous request” across all users. Keep any session map bounded and expire it; request bodies contain sensitive data.

```js
import { createFingerprinter, normalizeRequest } from './cache-kit/index.mjs';

const fingerprint = createFingerprinter();
const reviewedOptions = {}; // Every rule is OFF until reviewed.

function prepareForward(body) {
  const { body: outgoing, changes } = normalizeRequest(body, reviewedOptions);
  console.info(JSON.stringify({
    before: fingerprint(body),
    after: fingerprint(outgoing),
    changes,
  }));
  return outgoing;
}

// Within your existing authenticated, provider-scoped request handler:
// const outgoing = prepareForward(parsedBody);
// const payload = JSON.stringify(outgoing);
// Recalculate Content-Length with Buffer.byteLength(payload), if you set it.
// Forward using your existing authentication, streaming and error handling.
```

Log records do not include body text, but size/equality metadata remains private. Reusing a fingerprinter is necessary for comparable HMAC values. Restarting the instance generates a new key. Never log the key.

`firstDifferentByte(previous.system, current.system)` returns a local JSON UTF-8 offset or `null`. It returns no text. Retain previous bodies only as long as necessary in a controlled diagnostic context. These bytes are not provider token positions. Fingerprints cover system, tools and messages, not every option that might affect caching; record non-sensitive route/model configuration separately and hold other variables constant.

## Enable only reviewed rules

```js
const options = {
  normalizeBillingVersion: true,
  dropPureTokenCounters: false,
  normalizeTokenCounters: false,
  dropHookContext: false,
};
const { body: outgoing, changes } = normalizeRequest(parsedBody, options);
```

Even version metadata can be meaningful. First inspect synthetic or locally reviewed representative blocks. The hook rule deletes an entire block matching the marker, including any instructions in it. Keep it disabled unless every matching block in that route is disposable. Unknown blocks and metadata are preserved; messages/tools are cloned unchanged. String system and OpenAI-shaped message arrays are not normalized. Add format-specific support with tests instead of silently applying this rule to other shapes.

The function expects a JSON-compatible parsed request body. It is not a validator or protocol translator. Your existing gateway remains responsible for request size limits, authentication, provider selection, validation, retries, error handling, timeouts and SSE streaming. It must not log secrets or fallback to a different provider without authorization.

## Verify actual hits

For DeepSeek Chat Completions, pass each completed response's `usage` object once:

```js
import { summarizeDeepSeekUsage } from './cache-kit/index.mjs';
const summary = summarizeDeepSeekUsage(collectedUsageObjects);
```

Only explicit non-negative integer `prompt_cache_hit_tokens` and `prompt_cache_miss_tokens` are counted. Missing/invalid records increase `unknown`. The rate is token-weighted; a zero denominator returns `null`.

The historical route used an Anthropic-compatible endpoint. **Do not feed its usage to this Chat Completions helper without an explicit adapter.** Read the actual endpoint's usage schema; cache-read, uncached input and cache-creation fields can have different meanings. Similarly, streaming events may be partial or cumulative: aggregate into one final record per request first. This project does not implement an SSE usage collector.

Keep route, model, account, timing, input size and concurrency comparable. Local tests and the demo make no network calls and cannot establish real API hit rates, costs, or semantic correctness. Provider policy may change: consult [DeepSeek cache documentation](https://api-docs.deepseek.com/guides/kv_cache/).

## Rollback

Disable the selected options to restore forwarding content for future requests. Keep the prior gateway build/configuration available before rollout. No remote state needs to be deleted by this module. Already-forwarded requests cannot be recalled. If only diagnostics are needed, call the fingerprinter without the normalizer.
