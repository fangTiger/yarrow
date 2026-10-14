# Change: 面向 AI agent 的按次付费（HTTP 402 付款发现）

## Why

Arc 的定位之一是 agent 之间用 USDC 小额付款。三易的接口本已是「先在 Arc 上付款，再凭交易哈希取解读」，服务端只读链、不持私钥。但 agent 无从得知价格与收款方，缺少付款时只得到 400，也没有面向机器的说明。

## What Changes

- `POST /api/readings` 在请求其余部分校验通过、仅缺付款凭证时，返回 **HTTP 402**。错误码仍为 `payment-proof-required`，响应体附 `payment`：链 ID、USDC 地址、收款方、金额。
- 新增 `web/llms.txt`：面向 agent 的接口说明，含 402 发现、付款、提交、轮询、链上验证与 Origin 要求。
- 新增 `scripts/agent-reading.ts`：可运行示例。读 402 要求，用环境变量里的钱包在 Arc 上付款，提交并轮询结果。私钥只从环境变量读取，不打印、不落盘。
- README 增加「For AI agents」一节。如实说明这是 HTTP 402 付款发现，不是完整的 x402：服务端不代为提交签名转账，因此不持有任何私钥。
- 不改同源校验：agent 请求须带站点 Origin 头。

## Impact

- Affected specs：新增 `agent-payments`。
- Affected code：`src/sanyi/api.ts`、`src/sanyi/http-errors.ts`、`src/frontend/server.ts`、`scripts/build-vercel.ts`（静态清单加 `llms.txt`）、新增 `web/llms.txt`、`scripts/agent-reading.ts`，以及 `README.md`、`README.zh-CN.md`。
