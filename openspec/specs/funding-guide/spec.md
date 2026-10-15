# funding-guide Specification

## Purpose
TBD - created by archiving change funding-and-metrics. Update Purpose after archive.
## Requirements
### Requirement: Arc 主网 USDC 获取指引

主网模式下，付款区 MUST 提供「怎么付款？」指引，未连钱包也可查看；钱包 USDC 余额为零时 MUST 自动展示该指引。指引 MUST 分三步：
1. 准备 Circle 发行的原生 USDC；
2. 经 Circle USDC Bridge（https://bridge.usdc.com）或 Across（https://across.to/arc-bridge）转到 Arc 主网，并提醒源链需少量 gas、目的链选 Arc 而非测试网、先小额试转；
3. 到账后即可付款，gas 同样用 USDC。

测试网模式 MUST 仍显示水龙头。指引 MUST 中英齐全，英文无汉字。

#### Scenario: 新用户没有 Arc USDC

- **WHEN** 外国用户连上钱包，但 Arc 主网 USDC 余额为零
- **THEN** 付款区展示三步指引与两个跨链桥链接

