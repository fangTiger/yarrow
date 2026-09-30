# paid-oracle-flow Specification

## Purpose
TBD - created by archiving change paid-oracle-wuxing. Update Purpose after archive.
## Requirements
### Requirement: 所有起卦先收卦金

系统 MUST 对可判定与不可判定问题均收取 0.050000 USDC，并将卦金分入提供解读的三座易者金库。不可判定问题 MUST 不要求易者押钱；可判定问题 MUST 继续由易者押钱并等待事实见证。

#### Scenario: 不可判定问题付费解读

- **WHEN** 用户求问没有唯一未来答案的问题
- **THEN** 系统先核验三库卦金付款，再返回三家解读
- **AND** 明说三家收了钱但没有人为结果负责
- **AND** 不创建易者押注

#### Scenario: 可判定问题付费押注

- **WHEN** 用户求问未来可观察的问题
- **THEN** 现有登记合约收取卦金和保证金
- **AND** 三家解读并押钱后，卦金自动分入三座金库

### Requirement: 一次点击自动进入钱包流程

系统 MUST 在用户点击求卦时自动请求连接钱包，随后自动切换网络、检查授权并继续。标准稳态路径 MUST 是输入问题、点击一次求卦、钱包确认一次、看到结果。

#### Scenario: 未连接钱包求卦

- **WHEN** 用户输入问题并点击“求卦 · 0.05 USDC”
- **THEN** 系统立即唤起钱包连接界面
- **AND** 连接完成后自动继续原问题，不要求再次点击求卦

### Requirement: mock 不成为免费产品轨

mock MUST 只在开发、测试和排练入口可用，用户界面 MUST 不提供 mock/live 选择，也 MUST 不把 mock 描述为免费起卦。

#### Scenario: 用户界面不暴露 mock 选择

- **WHEN** 用户打开正式问卦界面
- **THEN** 界面不显示 mock/live 选择
- **AND** 不把 mock 描述为免费起卦

