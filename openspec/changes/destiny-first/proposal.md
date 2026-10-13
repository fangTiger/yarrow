# Change: 命理优先——一生运势与性格画像

## Why

用户最关心自己这辈子的运势走向，以及说得准不准。最先能验证的是性格，以及已经过去的几步大运能否和亲历对上。现在命理排在第三、默认选问事、没有示例；命理结果只有三家各写的五段文字，大运不打分，也就画不出一生走势。

## What Changes

- **BREAKING（输出格式）**：命理三家输出新增 `periods`，对每步大运给出吉凶、几成与一句短评；核对、审计、删错留对沿用逐年断语。命理仍不给总断吉凶。
- 命理白话总述新增 `portrait`（性格标签、优势、短板、一句总评），与总述同一次调用生成。
- 命理结果页顶部依次为「性格画像」「一生运势」（合议走势图、逐运表、三家短评，过去的运标「回看 · 对照你的经历」），之后是总述、解法、三家依据与盘面；一生运势取代原大运时间轴。旧存档缺少新字段时降级显示。
- 首页：命理排第一并默认选中；命理问题选填（空着用默认问题）；首页说明改为突出一生走势与性格；新增中英命理示例并排第一。
- 翻译单元加入逐运短评、性格画像，以及运势三家的应期（修复英文页应期仍为中文）。
- 毛笔字体子集加入新标题用字。

## Impact

- Affected specs：`bazi-three-schools`、`plain-summary`、`bazi-chart`、`unified-question-entry`、`onboarding-home`、`reading-translation`（前五者的基线在未归档的 `sanyi-chinese-redesign`、`yarrow-global` 中，归档时一并合并）。
- Affected code：`src/sanyi/bazi-schema.ts`、`src/sanyi/schools/bazi-shared.ts`、`src/sanyi/bazi-audit.ts`、`src/sanyi/repair.ts`、`src/sanyi/bazi-public.ts`、`src/sanyi/mock-bazi-schools.ts`、`src/sanyi/summary.ts`、`src/sanyi/mock-summary.ts`、`src/sanyi/translation/units.ts`、`web/lib/reading-translation.ts`、`web/pages/BaziReading.tsx`、`web/components/EnglishBaziReading.tsx`、新组件（性格画像、一生运势）、`web/lib/home-entry.ts`、`web/components/KindOptions.tsx`、`web/components/QuestionForm.tsx`、`web/pages/SampleReading.tsx`、`web/app.tsx`、`web/i18n/*`、`scripts/font-charset.ts` 与字体子集、`web/samples/destiny.*.json`。
- 设计文档：`docs/plans/2026-10-13-destiny-first-design.md`
