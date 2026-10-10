# Claude × DeepSeek Cache Kit

**把「缓存怎么突然不命中」变成可定位、可验证的问题。**

[English](README.en.md) · [完整排查复盘](docs/CASE_STUDY.zh-CN.md) · [网关接入](docs/INTEGRATION.md) · [隐私与反馈](SECURITY.md)

这个项目来自一次 Claude Desktop 第三方 Code 环境 → 自建网关 → DeepSeek API 的排查。2026-10-06 的内部修复记录报告：网关归一化易变的 system 元数据后，输入 token 缓存命中率从 **4.6% 提升到 92.7%**。

**这是单次历史案例，不是本工具的新跑分或效果保证。** 原始私人流量不公开；这里提供脱敏复盘、独立实现和可复现的合成测试。不能据此断言所有 Claude Code CLI、Desktop 版本或用户配置都存在同一问题。[证据范围](docs/CASE_STUDY.zh-CN.md#证据范围)

## 解决思路

1. **先验证缓存服务本身。** 用固定合成请求分别直连供应商、经过网关，保持模型、端点、账号等变量一致。
2. **再看真实请求哪里变了。** 对 system、tools、每条历史 message 分别做指纹，比较同一会话的相邻请求。
3. **找最早变化点。** 当时历史 messages 稳定，但 system 中 billing 版本尾号、hook 上下文和 token 计数不断变化。
4. **只处理确认无业务意义的易变字段。** 优先修改注入源；无法修改时，在自己控制的网关内选择性归一化。
5. **用供应商 usage 验收。** 指纹稳定只说明本地请求更稳定；缓存是否实际命中要读 usage，还要验证模型行为、工具调用与权限提示。

DeepSeek 官方文档说明缓存基于已落盘前缀匹配，尽力提供命中；具体规则会演进。不要把某次命中平台值解释为永久的块大小或 TTL。[官方缓存说明](https://api-docs.deepseek.com/zh-cn/guides/kv_cache/)

## 三十秒离线复现

需要 Node.js 22 或更新版本，无第三方依赖、无 API key、无网络调用。

```sh
git clone https://github.com/johnrucnapier-sketch/claude-deepseek-cache-kit.git
cd claude-deepseek-cache-kit
npm test
npm run demo
```

Demo 应输出 `rawStable: false`、`normalizedStable: true`、`normalizedFirstDifferenceByte: null`。这些是合成数据的前缀稳定性结果；里面的历史 usage 数字明确标注为历史输入。

## 项目内容

| 文件 | 用途 |
| --- | --- |
| `src/index.mjs` | 无依赖归一化、HMAC 指纹、UTF-8 差异位置、DeepSeek usage 汇总 |
| `examples/demo.mjs` | 完全合成的易变前缀复现 |
| `test/cache.test.mjs` | 默认不改内容、敏感规则开关、隐私、消息保真、计量测试 |
| `docs/CASE_STUDY.zh-CN.md` | 现象 → 排除假设 → 定位 → 修复 → 验收与局限 |
| `docs/INTEGRATION.md` | 可复制的 Node 网关接入和逐步启用方法 |

这是一个方法与模块项目，**不包含托管代理、账号共享或协议转换服务**。现有网关可在转发前调用模块；不需要为使用本项目开放新的网络端口。

## 默认行为与风险边界

`normalizeRequest(body)` 默认不改内容。仅支持 Anthropic 形态的顶层 `system` 数组；字符串 system 和 OpenAI messages 原样保留。消息、工具 schema、thinking 和其他字段保持原值。实现入口：[src/index.mjs](src/index.mjs)。

| 显式开关 | 作用 | 需要先确认 |
| --- | --- | --- |
| `normalizeBillingVersion` | 仅 billing-header 行的 `cc_version` 替换为固定值 | 下游不依赖真实版本值 |
| `dropPureTokenCounters` | 删除纯 `<total_tokens>` 文本块 | 模型不需要计数预算 |
| `normalizeTokenCounters` | 混合文本内计数替换为 `N` | 丢失数值不会影响业务 |
| `dropHookContext` | 删除包含已知 hook 标识的整个文本块 | **高风险：块内可能有权限规则、审批要求和用户指令；必须逐块确认可丢弃** |

不能为了命中率删除安全规则。无法确认 hook 语义时保留它，接受较低命中率或从注入源重新设计。

诊断仅返回 HMAC 指纹、字节长度、索引和受限角色标签，不打印正文、尾部或差异片段。随机密钥仅在指纹实例内使用；不同实例的指纹不能直接比较。长度和相等关系仍属于元数据，日志应私有保存。[隐私说明](SECURITY.md)

## License

MIT。独立社区项目，与 Anthropic、DeepSeek 无隶属或背书关系。
