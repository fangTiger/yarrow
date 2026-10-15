## REMOVED Requirements

### Requirement: 验证门禁后的 LIVE 默认
**Reason**: 新站不存在演示模式切换；mock 只用于开发、测试与排练。
**Migration**: mock 边界由 `paid-oracle-flow` 的"mock 不成为免费产品轨"继续约束。

### Requirement: 费用与秘密边界
**Reason**: 本要求绑定旧演示轮的费用上限。
**Migration**: 秘密边界由 `wallet-signed-divination` 的"浏览器公开配置与秘密隔离"继续约束；模型费用上限见 `question-three-schools`。
