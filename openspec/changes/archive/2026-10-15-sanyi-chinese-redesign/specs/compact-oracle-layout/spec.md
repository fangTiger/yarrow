## REMOVED Requirements

### Requirement: 状态行弱化且凭证可查
**Reason**: 六步进度与押注交易凭证随旧站移除。
**Migration**: 付款交易与起卦区块在 `reading-archive` 的复算信息中公开。

### Requirement: 答案在前且解释默认收起
**Reason**: 旧结果页结构（五卦象群优先、单行状态、责任提示）被水墨夜结果页取代。
**Migration**: "短断在前、详断折叠"由 `question-three-schools` 规定；页面布局由 `ink-night-theme` 规定。

### Requirement: 事项分类非阻塞且可就地修改
**Reason**: 事项分类改由统一入口在付款前给出，结果页修改的行为重新定义。
**Migration**: 见 `unified-question-entry`（付款前可改）与 `question-three-schools`（结果页改事项只重跑京房、不收费）。
