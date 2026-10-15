# birth-timezone Specification

## Purpose
TBD - created by archiving change yarrow-global. Update Purpose after archive.
## Requirements
### Requirement: 出生地时区

生辰 MUST 包含出生地时区（IANA 名称），前端 MUST 默认取浏览器时区并允许修改，界面 MUST 写明是「出生地时区」。没有时区字段的旧数据 MUST 按 Asia/Shanghai 处理。时区为 Asia/Shanghai 时，排盘 MUST 与现有逻辑完全一致，包括项目自带的 1986–1991 年夏令时表。

#### Scenario: 中国时区不变

- **WHEN** 生辰时区为 Asia/Shanghai 或缺省
- **THEN** 四柱、大运与校正摘要与本变更之前完全相同

### Requirement: 海外时区排盘

其他时区 MUST 先把当地钟面时间换算为绝对时刻：年柱、月柱、胎元、大运与起运按该时刻与节气交接比较确定；日柱、时柱按当地标准时（去掉夏令时）确定。年月判断不一致时，十神、命宫、身宫 MUST 按年月重算。夏令时重复或跳跃时段 MUST 取较早时刻并标注。校正摘要 MUST 写明出生地时区与换算后的当地标准时。

#### Scenario: 纽约夏令时出生

- **WHEN** 出生于 1995-07-04 10:30，时区 America/New_York
- **THEN** 日柱、时柱按当地标准时 09:30 计算，年柱、月柱按该时刻对应的节气确定
- **AND** 校正摘要写明「America/New_York」与「09:30」

### Requirement: 英文问题的语言守卫

问题原文为英文时，三家、总述与起名 MUST 仍以中文作答。核对前 MUST 检查正文汉字占比，以英文为主的输出 MUST 判为不合格并重写。

#### Scenario: 模型用英文作答

- **WHEN** 问题为英文，某家正文以英文为主
- **THEN** 核对失败并带错误说明重写

