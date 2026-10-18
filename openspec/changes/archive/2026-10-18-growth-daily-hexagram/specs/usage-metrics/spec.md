## ADDED Requirements

### Requirement: 付款失败分类计数

前端付款失败时 MUST 上报 `pay_failed:<类别>`，类别只能是：
- rejected：用户取消签名；
- insufficient：余额或 gas 不足；
- wrong-chain：切换网络失败；
- claim：链上已付、认领失败；
- other：其他。

MUST NOT 上报地址、交易哈希、金额或错误原文。服务端 MUST 只接受白名单内的类别。

#### Scenario: 用户取消签名

- **WHEN** 用户在钱包里拒绝付款
- **THEN** 当天 `pay_failed:rejected` 计数加一
