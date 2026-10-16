## MODIFIED Requirements

### Requirement: 英文问题的语言守卫

输出语言 MUST 由下单语言决定，不由问题语言决定。下单语言为中文时，即使问题原文为英文，三家、总述与起名 MUST 仍以中文作答，核对前 MUST 检查正文汉字占比，以英文为主的输出 MUST 判为不合格并重写。下单语言为英文时，按 english-generation 用英文作答。

#### Scenario: 中文下单、模型用英文作答

- **WHEN** 中文下单、问题为英文，某家正文以英文为主
- **THEN** 核对失败并带错误说明重写

#### Scenario: 英文下单

- **WHEN** 英文下单
- **THEN** 展示字段用英文，evidence 用中文
