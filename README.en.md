# Claude × DeepSeek Cache Kit

[中文与完整说明](README.md) · [Integration](docs/INTEGRATION.md)

Diagnose unstable prompt prefixes in a Claude → gateway → DeepSeek workflow before trying to improve cache hit rates.

A private incident report dated 2026-10-06 recorded **4.6% → 92.7%** input-token cache hits after normalizing volatile system metadata. This is a historical observation, not a benchmark of this public implementation. Private traffic is not published. The affected setup was Claude Desktop's third-party Code environment; the finding does not establish a universal Claude Code CLI defect.

The method: compare controlled direct/gateway requests, fingerprint system/tools/messages, locate the first changing prefix component, normalize only reviewed metadata, then verify provider usage and application behavior separately. [Case study and evidence limits](docs/CASE_STUDY.zh-CN.md).

```sh
git clone https://github.com/johnrucnapier-sketch/claude-deepseek-cache-kit.git
cd claude-deepseek-cache-kit
npm test
npm run demo
```

Node.js 22+, no dependencies, credentials, network calls, or billable requests. The demo uses synthetic requests and proves local prefix stability only.

`src/index.mjs` exports `normalizeRequest`, `createFingerprinter`, `firstDifferentByte`, and `summarizeDeepSeekUsage`. This is an integration module and diagnostic method, not a hosted proxy. All normalization rules default to **off**. Only Anthropic-shaped top-level system arrays are transformed. Strings and OpenAI-shaped messages pass through unchanged.

The broad historical hook-removal rule is dangerous when hook context contains permissions, approvals or meaningful instructions. Enable it only after reviewing every applicable block, or leave it off. Counter removal can also change budget-dependent behavior. Never remove safety instructions to improve hit rates.

Diagnostics use per-instance keyed HMACs and byte lengths, without body snippets. Metadata still reveals size and equality relationships. Keep it private. [Security and feedback](SECURITY.md).

Provider cache rules evolve and hits are best-effort. Local JSON byte equality is a diagnostic clue, not access to the provider's tokenization/cache key. See [DeepSeek documentation](https://api-docs.deepseek.com/guides/kv_cache/).

MIT. Independent community project; not affiliated with Anthropic or DeepSeek.
