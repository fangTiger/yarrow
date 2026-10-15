# question-three-schools 技术设计

## 概览

问事六爻排盘完成后，程颐、京房、邵雍三家并行读取同一问题和同一份程序事实，但各自只获得符合本派路径的事实子集。模型输出必须通过结构、自洽、中文和盘面核对；连续重写仍不合格时执行“删错留对”。

## 模块与文件

- `src/sanyi/schools/index.ts`：`QUESTION_SCHOOLS` 固定三家注册顺序和键。
- `src/sanyi/schools/chengyi.ts`、`jingfang.ts`、`shaoyong.ts`：三家人设、系统提示和事实选择。
- `src/sanyi/schools/shared.ts`：`buildSchoolPrompt` 按事实编号前缀隔离各家输入并附允许引用的原文。
- `src/sanyi/school-runner.ts`：`runSchool` 负责结构化生成、最多三次调用和最终修补。
- `src/sanyi/schema.ts`：`QUESTION_SCHOOL_SCHEMA`、`checkVerdictConsistency` 与统一输出类型。
- `src/sanyi/facts.ts`：`buildQuestionFacts` 把排盘、体用和主占之辞整理为事实表。
- `src/sanyi/audit.ts`：`auditQuestionEvidence`、`auditQuestionProse` 和 `auditOutput` 核对引证与正文。
- `src/sanyi/repair.ts`：`repairQuestion` 按句删除错误内容并夹回吉凶允许的把握范围。
- `src/sanyi/reading-service.ts`：排盘后并行运行三家、存储状态、提供单家重试和事项修改。
- `web/components/SchoolCard.tsx`、`ConsensusTrack.tsx`：折叠详断、显示重试与合议位置。

## 数据流

1. 六掷完成后，`ReadingService.finalize` 建立六爻盘、梅花体用、变占原文、黄历和奇门。
2. `buildQuestionFacts` 生成带稳定编号和关键词集合的事实表；`buildOriginalTexts` 提供允许直接引用的《周易》原文。
3. 三家经 `Promise.all` 并行调用 `runSchool`，彼此失败不取消其他家。
4. provider 返回符合 JSON Schema 的断语；运行器检查吉凶与把握、自述语言、证据编号及盘面组合。
5. 不合格输出附具体错误完整重写，最多三次模型调用。
6. 三次仍有事实错误时，`repairQuestion` 删除错误句和证据、修正把握，并保留其余内容。
7. 各家状态逐次写入 reading，前端轮询并展示已完成家；最终合议取已完成家把握的算术平均。
8. 修改事项只重算用神焦点并重跑京房，随后重写白话总述，不改变原卦和其他两家。

## 关键决策

- 程颐以变占所选《周易》原文为主，京房使用纳甲用神事实，邵雍使用程序生成的梅花体用。
- 模型不接收未授权的典籍原文，避免凭空直接引用。
- 事实表既限制提示词，也用于输出后确定性核对，形成同一事实源的闭环。
- 模型调用失败记为该家失败；内容核对失败则尽量修补，不因一句错误隐藏整家。
- 合议不覆盖三家原始判断，前端同时保留各家位置和平均线。

## 约束与已知限制

- 核对器重点识别干支、五行、六亲、旺衰、空破合冲等结构化词，不是通用语义证明器。
- 每家自动重写最多两次；完成后的手动免费重试每家每卦最多两次。
- 三家全部失败时没有可用合议，白话总述也会进入失败状态。
- 事项修改最多三次，且当前只重跑京房。

## 测试

- `tests/sanyi-schools.test.ts`：三家提示词、事实隔离与 mock 输出。
- `tests/sanyi-school-runner.test.ts`：重写、结构错误、修补和模型失败。
- `tests/sanyi-audit.test.ts`、`tests/sanyi-repair.test.ts`：证据、正文和删错留对。
- `tests/sanyi-reading-service.test.ts`：并行落笔、失败隔离、重试和事项修改。
- `tests/frontend-reading-components.test.ts`、`tests/frontend-plain-summary.test.ts`：三家卡片、合议与结果页顺序。
