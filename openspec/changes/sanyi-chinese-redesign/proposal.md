# Change: 重构为中式命理产品「三易」（第一期）

## Why

现有网站是黑客松作品「身銭を切る易者」：门槛高（每卦钱包签名、押注保证金）、概念多（双轨、天层人层、Brier 计分、见证结算）、文化错位（日本流派、神社视觉、日文字体）。用户决定把它改造成面向中文用户、什么都能问的中式命理产品「三易」，并整体去掉"AI 押钱、算错赔付"的问责理念。

## What Changes

- **BREAKING** 旧网站整体下线：替换 `web/` 前端；下线 `/api/oracle`、`/api/demo/*`、`/api/question/*`。
- **BREAKING** 移除易者押注、赔付、封存、见证结算、双轨分流、mock/live 切换、六步工作台、Brier 与回放证据页等用户可见能力（合约与 CLI 脚本保留）。
- **BREAKING** 移除「夜の神社」视觉与全部日本文化元素，新增「水墨夜」视觉系统与文化守卫测试。
- 新增统一入口：一个问题框，规则分类为问事、命理、运势、起名、择日、星座、合婚、其它；第一期开放问事、命理、运势。
- 新增生辰档案：本机保存，支持缺时辰、夏令时与真太阳时校正、换日口径切换；服务端不落原始生辰。
- 新增亲手六掷起卦：每掷取 Arc 新区块哈希确定性派生，可公开复算。
- 新增问事三家（程颐义理、京房纳甲、邵雍梅花）与命理运势三家（沈孝瞻格局、余春台调候、任铁樵扶抑），统一结构化断语与盘面证据核对。
- 新增八字排盘（四柱、十神、藏干、长生、纳音、大运流年、合冲刑害、神煞、调候表）。
- 新增时空栏、黄历（lunar-javascript）与奇门时盘（时家转盘拆补法，仅显示）。
- 新增解读存档：每次解读有不可枚举的独立链接，付款凭证持久化防重用。
- 修改付款：卦金流程不变（0.05 USDC、一次确认），但不再关联押注，改称「三易卦金账户」。
- 修改六爻排盘：卦时取第一掷区块时间；解读可给吉凶与应期但必须通过盘面核对。
- 修改钱包：去掉立誓、揭示、保证金相关要求。

## Impact

- Affected specs:
  - 新增：`unified-question-entry`、`birth-profile`、`six-throw-casting`、`question-three-schools`、`bazi-chart`、`bazi-three-schools`、`shikong-almanac-qimen`、`ink-night-theme`、`reading-archive`
  - 修改：`paid-oracle-flow`、`rich-liuyao-question-chart`、`wallet-signed-divination`
  - 移除：`action-first-oracle`、`compact-oracle-layout`、`dual-track-question-routing`、`human-settled-wager`、`live-default-demo`、`night-shrine-terminal-theme`、`single-screen-oracle-workbench`、`walletless-question-reading`
  - 不变：`explicit-five-elements`
- Affected code: `web/`（重写）、`src/frontend/server.ts`、新增 `src/sanyi/`、`src/calendar/`、`web/fonts/`；复用 `src/oracle/liuyao-chart.ts`、`src/oracle/fee-payment.ts`、`src/oracle/arc-question-fee-verifier.ts`、`src/agent/*-provider.ts`；`package.json`、`README.md`、`tests/`
- 新依赖：`lunar-javascript`（MIT）；开发期工具：kinqimen（生成奇门标准答案，不进运行时）、fonttools（字体子集化）
- 合约：不改
- 设计文档：`docs/plans/2026-09-30-sanyi-redesign-design.md`
