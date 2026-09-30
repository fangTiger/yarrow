## REMOVED Requirements

### Requirement: 单屏六步工作台
**Reason**: 六步（立誓、应卦、等待应验、结算）属于押注流程，已移除。
**Migration**: 新流程见 `unified-question-entry` 与 `six-throw-casting`。

### Requirement: 一次主动作后自动编排
**Reason**: 同上。
**Migration**: 起卦后排盘与三家断语自动编排，见 `question-three-schools`。

### Requirement: 阶段耗时与可重开会话
**Reason**: commit、reveal、结算阶段不再存在。
**Migration**: 摇卦可中断续摇，见 `six-throw-casting`。

### Requirement: 三家事实唯一呈现
**Reason**: 针对押注结算事实的呈现规则。
**Migration**: 三家断语呈现见 `question-three-schools`。

### Requirement: 卦历独立路由与自然语言优先
**Reason**: 旧卦历下线。
**Migration**: 见 `reading-archive`。
