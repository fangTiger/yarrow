# compact-oracle-layout Specification

## Purpose
TBD - created by archiving change paid-oracle-wuxing. Update Purpose after archive.
## Requirements
### Requirement: 状态行弱化且凭证可查

六步进度 MUST 压缩为含费用与交易入口的单行状态摘要，详细阶段和交易哈希 MUST 收进可展开区域。五卦象群 MUST 继续位于结果首屏。

#### Scenario: 移动端查看排盘

- **WHEN** 用户在窄视口查看结果
- **THEN** 页面本身没有横向滚动
- **AND** 宽排盘表只在自身容器内横向滚动

### Requirement: 答案在前且解释默认收起

结果态默认 MUST 只突出五卦象群、本卦卦名与卦辞、三家解读及行动、单行状态与一次极短责任提示。完整排盘、五行生克与逐爻推导、术语说明、五步阅读引导、完整诚实披露、费用去向和链上凭证明细 MUST 保留，且 MUST 默认收起。

#### Scenario: 首次看到结果

- **WHEN** 用户完成问卦且没有展开任何详情
- **THEN** 用户先看到卦象、三家怎么说和留给自己的动作
- **AND** 所有解释性长文位于未设置 `open` 的展开区
- **AND** 默认可见字符数相对变更前显著下降

### Requirement: 事项分类非阻塞且可就地修改

系统 MUST 自动采用事项主题建议并继续解读，不得要求用户先确认。解读旁 MUST 以一行短文显示当前取用口径并提供修改入口；用户修改后 MUST 用同一问题、同一已付卦金凭证和同一起卦区块重新计算排盘与三家解读，不得再次收费。

#### Scenario: 修改事项主题

- **WHEN** 用户在结果旁把事项主题从工作／官职改为钱财／货品
- **THEN** 系统立即按妻财重新计算排盘与三家解读
- **AND** 本卦及起卦区块保持不变
- **AND** 不发起新的钱包交易

