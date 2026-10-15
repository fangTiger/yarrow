# agent-payments 技术设计

## 概览

agent 与浏览器共用同一个 `/api/readings` 创建接口。有效请求不带付款凭证时得到 HTTP 402 和结构化付款要求；agent 自行在 Arc 转账后，以付款人和交易哈希再次提交并轮询结果。

## 模块与文件

- `src/sanyi/http-errors.ts`
  - `PaymentRequirements` 定义 `recipient`、`amountUsdc6`、`token` 和 `chainId`。
  - `PaymentRequiredError` 固定 HTTP 402 与错误码 `payment-proof-required`。
- `src/sanyi/api.ts`
  - `createSanyiApi` 先校验各类型业务输入，再由 `feeProofFrom` 决定返回 402 或接受付款凭证。
  - `payment` 返回与 402 响应相同的付款配置。
- `src/frontend/server.ts`：`errorPayload` 将 402 的 `payment` 对象写入 JSON；路由同时执行 JSON、8 KiB 与同源检查。
- `web/llms.txt`：面向 agent 的公开协议说明、请求体示例、轮询和验证公式。
- `scripts/agent-reading.ts`：使用 viem 跑通问事的发现、转账、认领与轮询示例。
- `src/sanyi/fee.ts`、`src/sanyi/store.ts`：复用浏览器路径的链上核验和一次性付款认领。

## 数据流

1. agent 向 `POST /api/readings` 提交完整业务请求，但不带 `feeProof`。
2. API 先验证问题、类型、生辰或起名字段；无效请求直接返回 400。
3. 其余输入有效时抛出 `PaymentRequiredError`，HTTP 层返回 402 和付款配置。
4. agent 在指定 Arc 链调用指定 USDC 合约的 `transfer`，金额为 `amountUsdc6`。
5. 回执成功后，agent 用同一业务请求加上 `payer`、`transactionHash` 再次 POST。
6. 服务端执行与网页完全相同的回执核验与付款原子认领，返回 reading id 和当前状态。
7. agent 轮询 `GET /api/readings/:id`；需要英文时触发 `/translate` 并继续读取翻译单元。

## 关键决策

- 采用 HTTP 402 做“付款发现”，但明确不是完整 x402 协议。
- 402 只在请求其余部分可执行时返回，减少 agent 误付款风险。
- 付款由 agent 自己签名和广播；Yarrow 只读链，不接收私钥或签名授权。
- `GET /api/payment` 提供显式发现入口，但 agent 无须额外调用即可从 402 取得同样信息。
- agent 与人类用户共享验证、存储和幂等规则，避免维护第二套收费语义。

## 约束与已知限制

- 写请求必须是 `application/json`、不超过 8 KiB，并携带与站点一致的 `Origin`。
- 英文请求仍先生成中文解读；英文结果需另行触发翻译。
- 示例脚本读取私钥环境变量并真实转账，只适合作为显式执行的集成示例。
- 当前没有 facilitator、支付授权代提交或自动退款。

## 测试

- `tests/sanyi-api.test.ts`：402、付款配置、无效请求先返回 400。
- `tests/frontend-server.test.ts`：HTTP 状态、响应体、同源与请求体边界。
- `tests/sanyi-storage.test.ts`：并发付款凭证只能认领一次。
- `tests/readme.test.ts`：面向用户和 agent 的公开说明边界。
