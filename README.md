# CoNET Web3 Gateway Extension

这是 Chrome、Edge、Firefox 和 Safari Web Extension 的第一阶段骨架。它将
`web3://` 解析为目标资源请求，并为后续的 CoNET L0 网关传输提供统一的
TypeScript 核心。

## 当前已实现

- `web3://<EOA>/<path>` 与 `web3://<ExactTag>.web3/<path>` 解析。
- 精确区分大小写的 BeamioTag 目标；拒绝 `results[0]` 和模糊搜索结果。
- 首次启动生成通信 EOA 钱包与 PGP 身份。
- 使用 PBKDF2 + AES-GCM 加密扩展本地身份存储。
- AddressPGP `searchKey(address)` RPC 读取，主 RPC 为 `rpc1.conet.network`，备用为
  `publicrpc.conet.network`。
- 版本化网关请求/响应 envelope、请求签名、PGP 加密、响应 Blob 转换接口。
- Entry pool 的轮换、超时与失败切换抽象。
- 不连接线上 SI 的完整 mock gateway round-trip 测试。
- 页面桥接脚本（`postMessage` → extension runtime），以及 Chrome/Edge、Firefox、Safari
  manifest 的 content script 声明。

## 尚未启用

浏览器扩展不能像操作系统协议处理器一样可靠地拦截所有浏览器导航中的
`web3://` scheme；不同浏览器需要不同的 native registration / Safari wrapper。
因此本阶段没有伪造“已接管浏览器导航”的能力，也没有默认配置真实 SI entry。
后续应分别接入：

1. Chrome/Edge 的页面或 native protocol bridge；
2. Firefox 的 WebExtension 页面代理；
3. Safari Web Extension 容器的 scheme handler；
4. 已确认的 Enterprise Gateway 请求/响应线上合同和 entry allowlist。

页面桥接当前会收到请求，但后台在 entry pool 未配置时明确拒绝发送，保持
fail-closed。

## 协议边界

业务请求应遵守 CoNET A/B/C 路由：客户端提交到健康 entry，不直连 mailbox B。
HTTP 请求体只能是 `{ "data": "<OpenPGP armor>" }`。扩展不会将私钥、PGP 明文或
完整密文写入日志。

本目录不是 `conet-l0d` Linux daemon 的替代品，也不会启动、停止或重启
geth、beacon-chain 或 validator。

## 本地检查

```bash
npm install
npm run typecheck
npm test
npm run build
```

`npm test` 会执行 PGP route mailbox 解包、目标用户解密、模拟响应加密、
客户端响应校验的端到端桩测试。
