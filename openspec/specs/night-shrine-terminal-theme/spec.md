# night-shrine-terminal-theme Specification

## Purpose
TBD - created by archiving change action-first-live-oracle. Update Purpose after archive.
## Requirements
### Requirement: 唯一深色视觉主题
系统 MUST 以 `#0B0E14` 到 `#131A2A` 为底、`#1A2235` 为面层、`#2E4A7D` 为数据色、`#E24A2B` 为朱、`#C9A227` 为金、`#F0EDE5` 为正文，并通过 CSS 变量管理。

#### Scenario: 打开任意视口
- **WHEN** 页面完成加载
- **THEN** 页面呈现深藏青/墨主基调且不存在米色或奶油色主背景、紫色玻璃拟态和中式八卦装饰

### Requirement: 日本与 Web3 视觉信号
系统 SHALL 用纵书章节标题和低透明和柄表达日本语境，用等宽链上字段、克制数字辉光和高数据密度表达 Web3 语境。

#### Scenario: 查看结果阶段
- **WHEN** 用户查看应卦、结算、卦历或档案
- **THEN** 地址、交易哈希、块高和基点使用等宽字体，章节标签使用纵书，关键数值使用克制辉光

### Requirement: 响应式和低焦虑动效
系统 MUST 让根页面无横向滚动，宽数据自身横向滚动，并使用平滑而非红绿急闪的状态过渡。

#### Scenario: 390 像素宽移动设备
- **WHEN** 用户完成整个动作流
- **THEN** 页面本身无横向溢出，触控目标不小于 44 像素，宽哈希仍可在局部查看

