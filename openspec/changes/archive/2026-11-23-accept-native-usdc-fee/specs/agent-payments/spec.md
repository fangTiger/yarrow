## MODIFIED Requirements
### Requirement: 面向 agent 的说明

站点根目录 MUST 提供 `llms.txt`，说明价格发现、在 Arc 上付款、凭交易哈希提交、轮询结果、链上验证，以及写请求须带站点 Origin 头。付款说明 MUST 写明 ERC-20 `transfer` 与原生 USDC 转账两种方式均可，原生转账金额须恰为 0.05 USDC。

#### Scenario: agent 阅读说明

- **WHEN** agent 读取 `https://yarrow-six.vercel.app/llms.txt`
- **THEN** 能按说明完成一次付费解读

#### Scenario: agent 用原生转账付款

- **WHEN** agent 按说明发送一笔恰为 0.05 USDC 的原生转账并提交交易哈希
- **THEN** 解读被创建
