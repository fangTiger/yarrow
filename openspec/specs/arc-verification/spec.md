# arc-verification Specification

## Purpose
TBD - created by archiving change arc-verify-resilience. Update Purpose after archive.
## Requirements
### Requirement: 浏览器端链上验证

结果页 MUST 提供「在 Arc 上验证」：由浏览器直接向 Arc RPC 读取付款交易回执，核对其中 USDC `Transfer` 的收款方与金额（0.05 USDC），显示付款区块与时间。问事 MUST 另读取六个起卦区块，按 `keccak256(encodePacked("sanyi-throw-v1", 付款哈希, 区块哈希, 规范化问题, 掷序))` 的最低三位复算每一掷，逐掷显示与结果是否一致，并核对每个起卦区块都晚于付款区块。验证 MUST 不经过三易服务端。付款哈希为全零的示例 MUST 不显示验证按钮。

#### Scenario: 验证一卦问事

- **WHEN** 用户在问事结果页点「在 Arc 上验证」
- **THEN** 页面显示付款已核对（收款方、0.05 USDC、区块号），六掷逐一复算一致

#### Scenario: 区块哈希不符

- **WHEN** 存档中某掷的区块哈希与链上不同
- **THEN** 该掷标为不一致，整体结论为验证未通过

