# bazi-three-schools 技术设计

## 概览

命理与运势共用三家并行编排：沈孝瞻走格局路径，余春台走调候路径，任铁樵走扶抑路径。三家只读取程序生成的八字事实与各自允许的事实子集，输出经结构、语言和盘面核对后存档。

## 模块与文件

- `src/sanyi/schools/bazi-index.ts`：`BAZI_SCHOOLS` 注册三家。
- `src/sanyi/schools/shenxiaozhan.ts`、`yuchuntai.ts`、`rentieqiao.ts`：三家标识、流派与提示词。
- `src/sanyi/schools/bazi-shared.ts`
  - `selectBaziFacts` 按流派挑选事实。
  - `buildBaziPrompt` 组装命理或运势输入。
  - `withDestinyLuckRelations` 为命理逐运加入运柱关系事实。
- `src/sanyi/bazi-schema.ts`：命理、运势、逐运和逐年的结构化输出及一致性检查。
- `src/sanyi/bazi-facts.ts`：`buildBaziFacts` 从命盘、分析和调候条目建立事实表。
- `src/sanyi/bazi-audit.ts`：核对证据、正文、逐年短评和逐运短评。
- `src/sanyi/bazi-school-runner.ts`：`runBaziSchool` 管理生成、重写与删错留对。
- `src/sanyi/bazi-reading-service.ts`：`BaziReadingService` 负责创建、并行落笔、重试、换日重算、反馈和总述。
- `web/components/BaziSchools.tsx`、`LifeLuckPanel.tsx`、`LiuNianPanel.tsx`：三家取用、逐运和逐年展示。

## 数据流

1. `BaziReadingService.create` 在付款通过后构建命盘、分析、调候与所问时间范围。
2. `buildBaziFacts` 给每项盘面事实稳定编号和可核对词集合。
3. 命理三家输出用神、直断、五类详断、建议和完整逐运判断；运势三家另输出吉凶、把握、逐年与可选应期。
4. 三家通过 `Promise.all` 并行执行，单家 provider 失败不会终止其他家。
5. `runBaziSchool` 最多调用三次；每次以 Schema、一致性、中文守卫和事实审计判断是否通过。
6. 仍不合格时，`repairBazi` 删除错误句、证据或短评，夹回把握，并保留可用内容。
7. 每家状态独立写入 reading；逐年和逐运合议仅使用 `done` 家的有效项目。
8. 三家达到终态后生成白话总述；单家重试成功会重写总述。

## 关键决策

- 三家共享命盘但不共享结论，各自提示词只暴露符合流派的事实。
- 命理不输出总吉凶，重点是性格、事业、财运、感情、健康与逐运；运势保留吉凶和把握。
- 逐年窗口和逐运编号由程序给出，模型不能增删范围外年份或大运。
- 所问整年时，锚年逐年判断必须与总断一致；不一致由审计或最终修补校正。
- 缺时柱必须显式说明限制，避免模型借不存在的时柱下断。

## 约束与已知限制

- 核对器能验证结构化盘面词和关系，但不能证明所有自然语言因果都成立。
- 自动生成失败会整体再试一次；手动免费重试每家最多两次。
- 缺失的逐年或逐运项不会由修补器虚构补齐，前端显示未落笔或空缺。
- 一家完成时也会计算部分合议，但结果页明确标出已落笔家数。

## 测试

- `tests/sanyi-bazi-schools.test.ts`：三家事实选择与提示词。
- `tests/sanyi-bazi-school-runner.test.ts`：Schema、核对、重写和修补。
- `tests/sanyi-bazi-audit.test.ts`、`tests/sanyi-repair.test.ts`：盘面正文、逐年与缺时柱边界。
- `tests/sanyi-bazi-reading-service.test.ts`：并行、失败隔离、重试、换日和合议。
- `tests/sanyi-bazi-periods.test.ts`、`tests/frontend-destiny.test.ts`：逐运输出与一生运势展示。
- `tests/frontend-bazi-round6.test.ts`：总断、锚年和逐年短评一致性。
