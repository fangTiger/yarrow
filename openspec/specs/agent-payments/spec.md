# agent-payments Specification

## Purpose
规定 AI agent 通过 HTTP 402 发现卦金要求、在 Arc 上自行付款、凭交易哈希认领并轮询解读的接口契约。本能力服务于三易的机器客户接入，使 agent 无需托管密钥即可购买问事、命理、运势或起名解读。
## Requirements
### Requirement: HTTP 402 付款发现

`POST /api/readings` 在请求其余字段校验通过、仅缺少 `feeProof` 时，MUST 返回 HTTP 402，响应体含 `code: "payment-proof-required"` 与 `payment`（`chainId`、`token`、`recipient`、`amountUsdc6`），与 `GET /api/payment` 一致。请求其余字段无效时 MUST 先返回对应的 400，免得调用方为无效请求付款。付款凭证只在付款被认领时消耗；认领前的任何失败都不消耗这笔付款。

#### Scenario: agent 首次请求

- **WHEN** agent 不带付款凭证提交一个有效的问事请求
- **THEN** 收到 402 与主网付款要求（链 5042、USDC、收款地址、50000）

#### Scenario: 请求本身无效

- **WHEN** agent 提交过短的问题且不带付款凭证
- **THEN** 收到 400 说明问题无效，而不是 402

### Requirement: 面向 agent 的说明

站点根目录 MUST 提供 `llms.txt`，说明价格发现、在 Arc 上付款、凭交易哈希提交、轮询结果、链上验证，以及写请求须带站点 Origin 头。

#### Scenario: agent 阅读说明

- **WHEN** agent 读取 `https://yarrow-six.vercel.app/llms.txt`
- **THEN** 能按说明完成一次付费解读

