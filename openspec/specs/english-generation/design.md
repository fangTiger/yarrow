# english-generation 技术设计

## 概览

英文下单（`lang: "en"`）的解读由模型直接写英文，不经翻译。设计要点是「展示层用英文，核对层仍用中文」：

- 模型读到的仍是中文排盘事实表与中文古文原文，另附本盘术语英文对照和古文固定英译。
- 展示给用户的字段写英文；`evidence[].claim` 写中文，原样走中文逐条事实核对。英文页面本来就不展示 evidence。

中文下单的生成、核对与显示不变。完整背景见 `docs/plans/2026-10-17-native-english-design.md`。

## 模块与文件

- `src/sanyi/native-english.ts`：`NATIVE_ENGLISH_KINDS`（question、destiny、fortune、naming）与 `isNativeEnglishKind`。
- `src/sanyi/english/prompt.ts`
  - `ENGLISH_OUTPUT_CONVENTIONS`：读者、术语首现写法、固定古文译文、evidence 用中文、展示字段不含汉字、简洁与长度说明；
  - `appendEnglishReferenceMaterials` / `appendQuestionEnglishMaterials`：在中文用户提示后追加术语对照与古文英译。
- `src/sanyi/english/schema.ts`：问事家、八字（命理与运势）、总述的英文 Schema。字段与中文版相同，只放宽长度。起名英文 Schema 在 `naming/schema.ts`。
- `src/sanyi/english/audit.ts`
  - `englishBodyErrors`：汉字白名单；
  - `englishForbiddenErrors`：英文禁用词；
  - `auditQuestionEnglishProse`：甲子对，以及「地支 + 五行 + 六亲」组合；
  - `auditBaziEnglishProse`、`auditBaziEnglishSummaryProse`、`auditBaziEnglishYearNote`、`auditBaziEnglishPeriodNote`：甲子对与十神，事实范围与中文核对器一一对应；
  - `baziEnglishHourLimitErrors`：缺时柱时的说明与归属。
- `src/sanyi/english/salvage.ts`
  - `salvageEnglishOutput`：超长字段在句末截短，删去多余字段；
  - `trimEnglishText`；
  - `schemaHintsEn`：英文重写提示。
- `src/agent/provider.ts`
  - 请求可选的 `salvage` 钩子；
  - `validateWithSalvage`：DeepSeek、Anthropic 与测试 mock 共用。
- 各家英文系统提示：`schools/*.ts` 的 `systemPromptEn`、`schools/bazi-shared.ts`、`naming/families.ts`、`summary.ts` 与 `naming/runner.ts` 的英文总述提示。
- 语言参数贯穿：`school-runner.ts`、`bazi-school-runner.ts`、`summary.ts`、`repair.ts`、`naming/runner.ts`、`naming/audit.ts`，以及三类服务。
- 前端 `web/pages/Reading.tsx`：英文解读在英文界面直接渲染；中文界面显示「本卦以英文生成」与切换按钮。

## 数据流

1. 下单带 `lang: "en"`：API 写入存档 `lang: "en"`，公开 reading 带 `lang`。
2. 服务按语言选择系统提示、Schema、核对器与修复器；用户提示 = 中文事实 + 术语对照 + 古文英译。
3. 模型输出若不合 Schema，provider 先调用 `salvage`：只在问题全是超长或多余字段时截短或删除，修补后再校验；抢救不了才进入原有重写。
4. 核对：结构规则复用；evidence 用中文核对器；展示字段用英文核对器。不过时带错误说明重写，三次仍不过就按英文句子删错留对。
5. 翻译服务对 `lang: "en"` 的解读不建翻译单元；前端不请求翻译。

## 关键决策

- 不让英文绕过盘面核对：中文 evidence 核对是主防线，英文核对是补充，只识别不会误伤普通英文的术语（甲子对、十神、六亲组合）。
- 单音节拼音（Wu、You、Shen）不识别，避免把普通英文词当成盘面术语。
- 抢救只在英文订单启用，中文路径的重试与提示不变。
- 证据锚定交给 `auditQuestionEvidence`，它会解析带标签的编号与别名；不另加更严的锚定规则。

## 约束与已知限制

- 英文核对覆盖面小于中文，例如地支关系、藏干没有英文版。
- 截短可能丢掉最后一两句；上限已按英文放宽，并在提示词里给出建议长度。
- 中文用户打开英文解读看到的是英文正文，页面会提示；不做英文 → 中文翻译。
- 实测（2026-10-17，测试网）：问事 35s、命理 47s、运势 40s、起名 20s 完成，与中文生成时间相当。

## 测试

- `tests/sanyi-english.test.ts`：汉字、禁用词、甲子对（含连字符写法）、十神与组合识别。
- `tests/sanyi-english-salvage.test.ts`：截短、抢救、`validateWithSalvage`、英文 runner 一次通过、英文重写提示。
- `tests/sanyi-school-runner.test.ts`、`tests/sanyi-summary.test.ts`、`tests/naming-runner.test.ts`、`tests/sanyi-bazi-reading-service.test.ts` 等：各类英文路径。
- `tests/translation-api.test.ts`、`tests/translation-service.test.ts`：英文解读不建翻译单元。
