## ADDED Requirements

### Requirement: 賭轨保留人间问题语义

賭轨 MUST 保留用户原问题，不得转换为 USDC 总量、agent 计数或其他天层代理指标。命题 MUST 标记为人层，并经现有 `AttestedResolver` 或 `MutualResolver` 结算。

#### Scenario: 明确短周期问题

- **WHEN** 用户输入“今天之内会不会收到那条消息”并确认賭轨
- **THEN** 系统进入现有钱包立誓流程，三家对同一人层命题押钱，并允许现场 mock 推进到见证

#### Scenario: 双方不一致

- **WHEN** MutualResolver 双方声明不一致、任一方缺席或人层见证无法确认
- **THEN** 轮次进入未决之卦而不是猜测事实

### Requirement: 长周期诚实等待

系统 MUST 区分短周期演示与真实长周期问题。真实截止未到时 MUST 展示需要等待，不得立即伪造结果。

#### Scenario: 周或月问题

- **WHEN** 用户确认“这个月能不能拿到 offer”
- **THEN** UI 显示由提问者到期见证和需要等待至截止的说明

### Requirement: 天层退居证据页

天层代码与既有数据 MUST 保留，但不得出现在用户问卦主流程的命题中。

#### Scenario: 浏览卦历与数据证据

- **WHEN** 用户打开卦历
- **THEN** 可区分已结算人间事与天层 backtested 记录，并看到 BSS、Wilson 与置换检验的证据说明
