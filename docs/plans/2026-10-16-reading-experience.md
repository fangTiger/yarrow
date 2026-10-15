# 结果页体验 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> 本计划由 codex（gpt-5.6-sol）分批执行（E1、E2），Claude 每批审查、测试、提交；E3 由 Claude 执行。

**Goal:** 等待期间结果页稳定、信息充分；用户能标注过去的大运准不准；命理能一键引到运势。

**依据：** `docs/plans/2026-10-16-reading-experience-design.md`（简称「设计」）；OpenSpec `openspec/changes/reading-experience/`。

## 通用约定

- TDD：先写测试 → 确认失败 → 实现 → 确认通过。
- 风格同现有代码：ESM、`.js` 后缀、行宽 ≤110、注释中文。
- 命令：单测 `node --import tsx --test tests/<file>.test.ts`；全量 `node --import tsx --test "tests/*.test.ts"`；类型 `./node_modules/.bin/tsc --noEmit`。
- 不联网、不写 git、不装依赖。沙箱内端口测试失败（EPERM）如实列出。
- 中英文共用组件，文字走 `useT` 词条；英文图表区不得出现汉字。
- 已完成的中文结果页，除设计要求的部分外，渲染须逐字不变。

## E1：准不准接口（后端）

**Files：** `src/sanyi/store.ts`、`src/sanyi/bazi-reading-service.ts`、`src/sanyi/bazi-public.ts`、`src/sanyi/api.ts`、`src/frontend/server.ts`、`web/lib/api.ts`（客户端方法）；测试新增 `tests/sanyi-period-feedback.test.ts`，必要时补 `tests/frontend-server.test.ts`。

- [ ] `StoredBaziReading.feedback?: { periods: Record<string, { vote: "accurate" | "inaccurate"; at: string }> }`（键为大运编号字符串）。
- [ ] `BaziReadingService.setPeriodFeedback(id, periodIndex, vote | null)`：
  - 只接受 `kind === "destiny"`，否则 400；
  - `periodIndex` 须在 `chart.luck.cycles` 中，且该步 `startYear <= 今年`（按注入时钟取年份），否则 400；
  - `vote` 为 null 时删除该项；
  - 经 `store.update` 原子写回；返回存档。
- [ ] 公开视图：命理带出 `feedback: { periods: { [index]: vote } }`，不带时间；没有标注时省略或为空对象（二选一，并在测试中固定）。
- [ ] API：`api.setPeriodFeedback(id, body)`，校验请求体（periodIndex 为整数，vote 为三者之一），读取存档时沿用中断恢复的读取路径。
- [ ] 路由：`POST /api/readings/:id/feedback`，沿用写接口的同源、JSON、8 KiB 与 id 边界。
- [ ] 前端客户端：`web/lib/api.ts` 加 `setPeriodFeedback(id, periodIndex, vote)`。
- [ ] 测试：
  - 标注、改选、取消；
  - 未开始的大运、运势卦、问事卦、不存在的编号、非法 vote 均被拒；
  - 公开视图不带时间；
  - 路由同源校验；
  - 已有逐运断语与中断恢复不受影响。

## E2：前端

**Files：** `web/components/LifeLuckPanel.tsx`、`web/components/LiuNianPanel.tsx`、`web/lib/life-luck.ts`、`web/lib/liunian-chart.ts`、`web/components/PlainSummaryPanel.tsx`、`web/components/EnglishReadingSections.tsx`、`web/components/DestinyPortrait.tsx`、`web/pages/BaziReading.tsx`、`web/components/EnglishBaziReading.tsx`、`web/pages/Reading.tsx`、`web/lib/home-entry.ts`、`web/components/QuestionForm.tsx`、`web/i18n/zh.ts`、`web/i18n/en.ts`、`web/styles/bazi.css`；测试新增 `tests/frontend-reading-experience.test.ts`。

- [ ] **一生运势固定显示**：
  - `hasPeriodData` 之外新增判断「在写的新卦」：三家任一为 pending 或 writing，或已有逐运断语；
  - 命理且有大运时，满足此判断即显示 LifeLuckPanel（落笔中格子显示「落笔中」，没有合议点时不画线）；
  - 已完成且无逐运断语的旧存档才显示 BaziLuck 于原位；
  - 性格画像在总述完成前显示占位面板（中英）。
- [ ] **落笔中的图表**（LifeLuckPanel 与 LiuNianPanel）：
  - 三家未全部结束时，标题旁显示「已落笔 n/3 家，走势随落笔更新」，不画直标，图例文字改为「已落笔各家平均」；
  - 全部结束后与现在完全相同。
- [ ] **等待区**：总述面板落笔中状态（中英两个组件）列出三家状态（✓ 已落笔、落笔中、未落笔），显示已用时间（按 createdAt 每秒更新）与「通常 1–2 分钟」；超过 180 秒加提示「比平时久，可稍后回来，结果会保存在卦历里」。问事、运势、命理通用；起名保持现状。
- [ ] **标签页标题**：结果页落笔中显示「（n/3）」前缀，完成后显示「✓ 结果已出 · 」前缀，页面卸载时恢复原标题。用小 hook 实现，带测试。
- [ ] **准不准**：
  - LifeLuckPanel 详情区，对已开始的大运显示两个按钮，选中态高亮；
  - 点同一项取消；调用 `api.setPeriodFeedback`，成功后用返回的存档刷新；
  - 标题旁汇总「你已对照 n 步：准 a · 不太准 b」（英文对应）；
  - `readonly` 时不显示。
- [ ] **细看这十年**：
  - LifeLuckPanel 详情区，对当前与未来的大运显示链接，`readonly` 时不显示；
  - 链接为 `#/?kind=fortune&horizon=<h>&q=<问题>`，`h` 规则见设计第 4 节；问题中英按当前语言。
- [ ] **首页预填**：
  - `web/lib/home-entry.ts` 新增纯函数 `prefillFromHash(hash)`，校验 kind（四类）、horizon（与运势支持的取值一致）、q（4–280 字）；
  - QuestionForm 初始化时读取，视为手选类型，并用 `history.replaceState` 清除参数；
  - `web/app.tsx` 的路由对 `#/?…` 仍返回首页。
- [ ] **测试**：
  - 新卦落笔中的命理页：一生运势在总述之上、带「已落笔 0/3」、无直标；
  - 一家落笔后：仍无直标，图例为「已落笔各家平均」；全部落笔后与现状一致；
  - 旧存档降级不变；画像占位；
  - 等待区三家状态与超时提示；
  - 标题 hook；
  - 准不准按钮显示规则、汇总文字、只读不显示；
  - 细看这十年链接的 horizon 计算；
  - `prefillFromHash` 合法与非法输入；
  - 英文图表区无汉字。

## E3：验收（主管）

- [ ] 全量测试、类型检查、构建、秘密扫描、OpenSpec 校验。
- [ ] 本地测试网真付命理一卦，在第 10、45、90 秒截图，对比设计第 1 节的问题；1320 / 390 中英走查。
- [ ] 部署生产，线上验证接口与页面。
