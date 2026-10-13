# 命理优先 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> 本计划由 codex（gpt-5.6-sol）分批执行（D1–D3），Claude 每批审查、测试、提交；D4 由 Claude 执行。

**Goal:** 命理成为首选入口；命理结果先给性格画像与一生运势（三家逐运打分的走势图），让用户对照亲历验证准不准。

**Architecture:**
- 命理三家输出加 `periods`（逐运断语），核对、审计、删错留对仿照逐年断语；
- 公开视图算逐运合议；
- 命理总述加 `portrait`，与总述同一次调用；
- 前端新增性格画像与一生运势两个组件，中英共用；
- 首页命理第一、默认选中、问题选填。

**Tech Stack:** TypeScript strict、React 18、esbuild、Node test runner + tsx、DeepSeek 结构化输出、Ajv。

**依据：** `docs/plans/2026-10-13-destiny-first-design.md`（简称「设计」）；OpenSpec `openspec/changes/destiny-first/`。

## 通用约定（每批都适用）

- TDD：先写测试 → 运行确认失败 → 实现 → 运行确认通过。
- 风格同现有代码：ESM、`.js` 后缀导入、行宽 ≤110、注释与日志用中文。
- 命令：
  - 单测 `node --import tsx --test tests/<file>.test.ts`；
  - 全量 `node --import tsx --test "tests/*.test.ts"`；
  - 类型 `./node_modules/.bin/tsc --noEmit`。
- 不联网、不写 git、不安装依赖。沙箱内监听端口的测试失败（EPERM）如实列出。
- 既有测试的期望只在本设计必然改变时调整，并在报告中逐条列出。
- 中文输出不得无故变化：改动共用组件时，中文渲染除设计要求的部分外须逐字不变。
- 英文模式下页面主体不得出现汉字（折叠的传统盘与古文原文除外）。
- 文化守卫：不出现日文假名与「・」，不出现易者、押钱、赔付、封存，不出现五格术语。

---

## D1：逐运断语

**Files：**
- Modify：`src/sanyi/bazi-schema.ts`、`src/sanyi/schools/bazi-shared.ts`、`src/sanyi/bazi-audit.ts`、`src/sanyi/repair.ts`、`src/sanyi/bazi-public.ts`、`src/sanyi/mock-bazi-schools.ts`；
- Test：新增 `tests/sanyi-bazi-periods.test.ts`，必要时补充既有八字测试。

**要点：**
- [ ] 类型与 Schema：
  - `DestinyPeriodOutput { index; verdict; confidenceTenths; note }`；
  - `DestinySchoolOutput.periods?: DestinyPeriodOutput[]`：类型上可选（旧存档没有），`DESTINY_SCHOOL_SCHEMA` 把它列为必填；
  - items：`index` 为 1–12 的整数，`verdict` 与 `confidenceTenths` 复用问事 Schema 的定义，`note` 1–24 字；数组最多 12 项。
- [ ] `baziLanguageErrors` 纳入逐运短评。
- [ ] `checkBaziConsistency`（命理分支）：
  - `periods` 的 index 序列必须与 `chart.luck?.cycles` 的 index 完全一致，按顺序，不多不少；无大运时必须为空；
  - 每项吉凶与几成自洽，复用 `checkVerdictConsistency`，错误前缀如「第 3 步大运：」；
  - 命理仍不得有总断 verdict、years、timing（Schema 已保证，保留现状）。
- [ ] 提示词（`BAZI_BOUNDARIES` 与 `buildBaziPrompt`）：
  - 把「命理不得输出吉凶、把握、逐年列表或 timing」改为：命理不得输出总断吉凶、把握、逐年列表或 timing，但须输出 periods；
  - periods 规则：按「大运列表」顺序每步一项，index 与列表编号一致；依据本派用神喜忌判断该步大运干支（含藏干）对命局的作用；喜忌明确要给吉或凶，不要一律写平；短评不超过二十四字，点出依据，只用该步大运事实（luck:<index>）与原局事实；
  - 命理任务追加「大运列表」，每行形如 `第 3 步 luck:3 甲申 28–37 岁 2017–2026`；无大运时写「盘面无大运，periods 输出空数组」；
  - 运势提示词不变。
- [ ] 审计（`bazi-audit.ts`）：新增 `auditBaziPeriodNote(item, facts)`，仿 `auditBaziNote`，允许的事实为 `luck:<index>` 与原局事实（不含其它步大运与流年）；`auditBaziOutput` 逐项审计。
- [ ] 修补（`repairBazi` 命理分支）：
  - 只保留 index 属于盘面大运的项，按盘面顺序去重；多出的删去；
  - 几成不自洽时按现有 `clampConfidence` 夹到合法区间并计入 adjusted；
  - 审计不过的短评改为空字符串并计入 removed，吉凶与几成保留；
  - 缺失的项不补（页面显示「未给出」）。
- [ ] 合议（`bazi-public.ts`）：
  - `PeriodConsensus { index; average; min; max; count }`；
  - `periodConsensus(reading)` 按 `chart.luck?.cycles` 顺序返回 `(PeriodConsensus | null)[]`，算法同 `yearConsensus`；
  - 命理公开视图加 `periods: periodConsensus(reading)`；旧存档全为 null。
- [ ] mock：命理 mock 为每步大运给出确定性的、有起伏的吉凶（至少一吉一凶），短评用该运干支与十神，能通过核对与审计。
- [ ] 测试至少覆盖：
  - Schema 接受与拒绝；
  - 序列缺漏、多出、乱序、无大运却非空；
  - 吉凶不自洽；
  - 短评引用别的大运或流年事实被审计拦下；
  - 修补行为；
  - 合议计算；
  - 旧存档（无 periods）公开视图正常；
  - 提示词含大运列表与新规则；
  - mock 输出通过 `checkBaziConsistency` 与 `auditBaziOutput`。

---

## D2：性格画像与翻译单元

**Files：**
- Modify：`src/sanyi/summary.ts`、`src/sanyi/mock-summary.ts`、构建总述输入处（`src/sanyi/bazi-reading-service.ts` 或实际所在文件）；
- Modify：`src/sanyi/translation/units.ts`、`web/lib/reading-translation.ts`；
- Test：`tests/sanyi-summary.test.ts`、`tests/translation-units.test.ts`、`tests/frontend-result-translation.test.ts`（或新增文件）。

**要点：**
- [ ] `Portrait { traits; strengths; blindSpots; summary }`：
  - `PlainSummary.portrait?`；`SUMMARY_SCHEMA` 中为可选属性；
  - traits 3–5 项，每项 1–6 字；strengths 与 blindSpots 各恰好 2 项，每项 1–40 字；summary 1–60 字。
- [ ] 提示词（仅命理）：
  - portrait 只综合三家「性格」分项与用神已有的判断，不新增盘面依据，不做医疗、法律、投资结论；
  - 标签用简短的性格词（如「重情义」「求稳」），不要写干支或十神；
  - 命理总述可概括一生大运起伏，但不给总体吉凶评级。
- [ ] `SummaryInput.periodConsensus?: string`：命理且有逐运合议时，由服务端拼成一行，如「第1步 戊申 4–13岁 5.0成；第2步 …」，并写入提示词「逐运合议」。
- [ ] 核对与修补：
  - `checkSummary`：命理缺 portrait 或数量越界即报错；问事、运势出现 portrait 即报错；
  - portrait 各条走现有的文本核对（禁用词、语言、盘面核对器），traits 只走禁用词与语言；
  - `summaryTexts` 纳入 portrait；
  - `repairSummary`：删去不合格条目后，若 traits 少于 3 或 strengths、blindSpots 任一为空，整块省略。
- [ ] mock-summary：命理给出合格 portrait。
- [ ] 翻译单元（服务端 `units.ts` 与前端 `reading-translation.ts` 同步，顺序一致）：
  - summary 单元：portrait 放在 remedy 之后，依次为 traits.N、strengths.N、blindSpots.N、summary；
  - 八字三家单元：useGod、headline、reason、sections、timing.window、timing.condition、advice、years.N.note、periods.N.note；
  - 空字符串（被删去的短评）沿用现有 `add` 的跳过规则，两边一致。
- [ ] 测试：
  - 命理画像的核对与修补各分支；
  - 问事、运势出画像被拒；
  - 服务端单元路径与前端回填路径在命理、运势夹具上逐条相等（含应期、画像、逐运短评）；
  - 英文回填后应期与画像为英文。

---

## D3：前端与首页

**Files：**
- Create：`web/components/DestinyPortrait.tsx`、`web/components/LifeLuckPanel.tsx`，以及 `web/lib/life-luck.ts`（纯函数）；
- Modify：`web/pages/BaziReading.tsx`、`web/components/EnglishBaziReading.tsx`、`web/components/BaziLuck.tsx`（抽出当前大运判断）、`web/styles/bazi.css`；
- Modify：`web/lib/home-entry.ts`、`web/components/KindOptions.tsx`、`web/components/QuestionForm.tsx`、`web/pages/Home.tsx`、`web/pages/SampleReading.tsx`、`web/app.tsx`、`web/i18n/zh.ts`、`web/i18n/en.ts`；
- Modify：`scripts/font-charset.ts` 与 `web/fonts/mashanzheng-chars.txt`（字体子集由主管重建）；
- Test：新增 `tests/frontend-destiny.test.ts`，并更新首页、示例相关测试。

**要点：**
- [ ] `web/lib/life-luck.ts`：
  - `currentCycleIndex(chart, currentDate)`：从 `BaziLuck` 抽出，两处共用；
  - `cycleGroups(cycles, currentIndex)`：回看、当前、往后；
  - `schoolPeriod(reading, key, index)`；
  - `periodLabels(consensus, currentIndex)`：当前、一生最顺、回看中最低。
- [ ] `DestinyPortrait`：
  - 标题「性格画像」/「Character portrait」；
  - 标签一行，「优势」「短板」两列（英文 Strengths、Blind spots），一句总评；
  - 窄屏两列改为上下排列。
- [ ] `LifeLuckPanel`（参照 `LiuNianPanel` 的结构与样式，中英共用，文字走 `chart.life.*` 词条）：
  - 标题「一生运势」/「Life luck cycles」，标题下写顺逆与起运时间；
  - 走势图：每步大运一列，刻度为干支与年龄段；合议线、三家区间、五成参考线；当前之运高亮；直标「当前」「一生最顺」「回看中最低」；
  - 分组表头：「回看 · 对照你的经历」「当前」「往后」；
  - 逐运表行：大运、年龄、年份、十神、三家（吉凶 + 几成）、合议；
  - 默认选中当前之运（起运前选第一步），详情显示三家短评；空短评显示「短评与盘面不符，已删去」，缺项显示「未给出」；
  - 英文干支拼音、十神与吉凶英译、几成写「n/10」，与 G3.4 一致；
  - 窄屏：图完整显示，表在容器内横向滚动、首列固定。
- [ ] 命理页顺序（中英两个页面组件都改）：
  - 性格画像（有 portrait 时）→ 一生运势（有大运且任一家有 periods 时）→ 白话总述 → 解法 → 三家依据 → 盘面（四柱与校正）→ 合冲刑害、五行；
  - 显示一生运势时不再显示 `BaziLuck`；否则照旧显示 `BaziLuck`（含无大运的补时辰提示）；
  - 运势页顺序不变。
- [ ] 首页：
  - `KIND_OPTIONS` 顺序：destiny、question、fortune、naming；`DEFAULT_ENTRY.kind = "destiny"`；
  - 命理问题选填：命理且问题为空时，`entryGate` 不检查问题长度、手选类型与分类，提交时用默认问题（词条 `destiny.defaultQuestion`）；写了问题则按现有规则；
  - 命理输入框占位改为选填提示；
  - `home.description`、`home.step1`、`kind.destiny.example1/2` 按设计第 5 节改中英文。
- [ ] 示例：
  - `SampleKind` 加 `destiny`，路由接受 `#/sample/destiny`；
  - 首页示例入口顺序为命理、问事、运势、起名（新增 `sample.destiny` 词条）；
  - 示例文件由主管在 D4 生成；缺文件时显示「示例准备中」。
- [ ] 字体：`FIXED_COPY` 加入新的毛笔标题用字（「性格画像」「一生运势」等），重写 `mashanzheng-chars.txt`；woff2 子集需联网重建，由主管完成。字体覆盖测试若因此失败，在报告中列出。
- [ ] 测试：
  - 中英渲染命理页（含 portrait 与 periods 的夹具）：顺序、走势图、逐运表、当前高亮、回看分组、英文图表区无汉字；
  - 旧存档（无 portrait、无 periods）降级显示 `BaziLuck`；
  - 首页默认命理、顺序、空问题可放行且用默认问题、写了问题按原规则；
  - 示例路由。

---

## D4：验收（主管）

- [ ] 重建字体子集（小于 100 KB），全量测试、类型检查、构建、秘密扫描、`openspec validate destiny-first --strict`。
- [ ] 真实模型冒烟：中文与英文命理各一卦，检查逐运吉凶分布（不得八步全平）、画像出处、英文翻译。
- [ ] 生成 `web/samples/destiny.zh.json`、`destiny.en.json`，扩展示例渲染测试到四类。
- [ ] 1320 / 390 截图走查（中英）。
- [ ] 文档：设计文档执行记录、OpenSpec 任务勾选。
