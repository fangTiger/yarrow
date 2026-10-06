## REMOVED Requirements

### Requirement: 用户钱包承担提问者交易
**Reason**: 立誓提交、揭示与结算属于已移除的押注流程。
**Migration**: 用户钱包只签署卦金付款，见 `paid-oracle-flow`。

### Requirement: salt 与自动揭示隔离
**Reason**: commit-reveal 起卦被逐掷取区块取代。
**Migration**: 见 `six-throw-casting`。

## MODIFIED Requirements

### Requirement: 双精度资金门禁

系统 SHALL 以六位整数计算 ERC-20 卦金，以十八位整数计算原生 gas，并以 `10^12` 比率仅在展示层换算。

#### Scenario: 任一余额不足

- **WHEN** ERC-20 余额不足以覆盖 0.050000 USDC 卦金，或原生余额不足以覆盖预估 gas
- **THEN** 页面分别说明所需金额、尚缺金额，并提供 Circle 水龙头链接

### Requirement: 交易前后透明

系统 SHALL 在钱包签名前显示卦金金额、去向（三易收款地址，截断显示）与预估 gas，并在确认后显示交易哈希和 Arcscan 链接。

#### Scenario: 用户拒绝交易

- **WHEN** 钱包返回用户拒签错误
- **THEN** 页面说明付款已取消、资金未发生变动并提供重试路径
