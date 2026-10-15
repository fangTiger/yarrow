# period-feedback Specification

## Purpose
TBD - created by archiving change reading-experience. Update Purpose after archive.
## Requirements
### Requirement: 大运准不准标注

命理结果中已经开始的大运（起始年不晚于今年）MUST 可标注「准」或「不太准」，再点同一项取消。标注 MUST 经 `POST /api/readings/:id/feedback` 存入存档，只接受命理卦、存在且已开始的大运编号；写接口沿用同源校验。公开视图 MUST 带出每步的标注（不带时间）。只读示例 MUST 不显示标注按钮。系统 MUST 不在样本不足时展示跨卦准确率。

#### Scenario: 标注过去十年

- **WHEN** 用户选中 20–29 岁那步大运并点「准」
- **THEN** 存档记下标注，刷新后仍显示为「准」，面板汇总更新

#### Scenario: 未来的大运

- **WHEN** 请求标注尚未开始的大运
- **THEN** 接口返回 400，界面也不显示按钮

