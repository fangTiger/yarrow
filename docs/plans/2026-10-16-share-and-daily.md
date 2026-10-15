# 分享卡片与今日黄历 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> 本计划由 codex（gpt-5.6-sol）分批执行（G1、G2），Claude 审查、测试、提交；G3 由 Claude 执行。

**依据：** `docs/plans/2026-10-16-share-and-daily-design.md`；OpenSpec `openspec/changes/share-and-daily/`。

## 通用约定

- TDD；ESM、`.js` 后缀、行宽 ≤110、注释中文。
- 命令：单测 `node --import tsx --test tests/<file>.test.ts`；全量 `node --import tsx --test "tests/*.test.ts"`；类型 `./node_modules/.bin/tsc --noEmit`。
- 不联网、不写 git、不装依赖（不得引入二维码、截图之类的新库）。
- 中英共用组件，文字走 `useT` 词条；英文界面不得出现汉字（所问原文除外）。
- 已有页面除设计要求的新增部分外，渲染不变。

## G1：分享卡片

**Files：** 新增 `web/lib/share-card.ts`、`web/components/ShareCard.tsx`；修改 `web/components/PlainSummaryPanel.tsx`、`web/components/EnglishReadingSections.tsx`（或总述所在的英文组件）、`web/i18n/zh.ts`、`web/i18n/en.ts`、`web/styles/components.css`；测试新增 `tests/frontend-share-card.test.ts`。

- [ ] `buildShareCard(reading, lang, t)` 返回卡片模型 `{ kind, title, question?, headline, lines, chips?, chart?, footer }`：
  - 命理：画像标签、总评、一生走势（八个点，标签只用年龄段如「36–45岁」/「ages 36–45」，数值为逐运合议）、一生走势概括；
  - 问事：所问、本卦与之卦名（英文用 `hexagramEn`）、六爻阴阳与动爻（用于画卦）、结论、三家判断（名与吉凶几成）；
  - 运势：所问、结论、十年走势（年份与合议）、十年走势概括；
  - 卡尾：站点地址 `yarrow-six.vercel.app` 与一句可验证说明（问事写六掷取自 Arc 区块，其余写在 Arc 付款可验证）；示例加「示例」标记。
- [ ] `wrapText(text, maxWidth, measure)`：中文逐字、英文按词分行，注入测量函数；超过行数上限加省略号。
- [ ] `drawShareCard(ctx, model, fonts)`：1080×1350，深底 `#0F1110`、金色 `#C9A866`、朱印红 `#A63A2B`、正文 `#EAE5D9`。曲线为折线加五成参考线；卦画为六条阳爻或阴爻，动爻标红点。
- [ ] `ShareCard` 组件：
  - 总述完成后显示「生成分享图」按钮；
  - 点开弹层预览（`<img src=blob>`），提供「分享」（`navigator.canShare({ files })` 为真时）与「下载」（`a[download]`）两个按钮，以及关闭；
  - 绘制前等待 `document.fonts.ready`；
  - 可用 Esc 关闭，焦点回到按钮；释放 object URL。
- [ ] 测试：
  - 三类模型字段（中英）；
  - 命理卡不含年份、四柱、大运干支、生辰（用真实示例 `web/samples/destiny.*.json` 断言）；
  - 问事卡不含付款哈希；
  - 英文卡模型除所问外无汉字；
  - `wrapText` 中英分行与省略；
  - 按钮仅在总述完成后出现。

## G2：今日黄历

**Files：** 新增 `web/lib/almanac-en.ts`、`web/components/DailyAlmanac.tsx`；修改 `web/pages/Home.tsx`（`HomeContent`）、`web/i18n/*`、`web/styles/*`；测试新增 `tests/frontend-daily-almanac.test.ts`。

- [ ] `almanac-en.ts`：
  - 建除十二值、值神十二、黄道 / 黑道、二十八宿（如「亢金龙」→「Kang (Neck) · Metal Dragon」之类，统一格式）、九星、八方位、十二生肖、二十四节气、农历月名；
  - lunar-javascript 全部宜忌词条（取自库内 `LunarUtil` 的宜忌表，测试中逐条核对全覆盖）。
- [ ] `DailyAlmanac` 组件：
  - 拉取 `api.now()`（已有接口，有 30 秒缓存）；
  - 显示设计第 3 节的内容，宜忌各最多 8 项；
  - 英文用 `almanac-en`，查不到的词条跳过；英文不显示彭祖与七十二候；
  - 窄屏（≤620px）折叠为一行摘要，点开展开；
  - 加载失败时不显示卡片，不影响首页。
- [ ] 入口「看看你今天的运势 →」：链接 `#/?kind=fortune&horizon=today&q=…`，问题中英按当前语言（用已有的 `prefillFromHash`）。
- [ ] 位置：`HomeContent` 中一句话说明区之后、表单之前。
- [ ] 测试：
  - 中英渲染（用固定的 now 数据）；
  - 英文无汉字；
  - 宜忌全覆盖；
  - 未知词条跳过；
  - 折叠摘要；
  - 入口链接；
  - 接口失败时不渲染。
