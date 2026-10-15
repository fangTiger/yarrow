# USDC 获取指引与基础数据统计 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Arc 主网付款区补齐中英 USDC 获取指引，并以匿名、按日计数的方式记录基础使用漏斗。

**Architecture:** 前端使用独立 `FundingGuide` 和 `track` 模块；服务端使用基于 `DocumentBackend` CAS 的指标存储，并通过依赖注入接入三类结果服务。HTTP 事件与统计接口继续复用现有同源、JSON 和体积限制，常驻进程与 Vercel 均从 `createSanyiRuntime` 取得同一套 metrics 实例。

**Tech Stack:** TypeScript、React 18、Node HTTP、DocumentBackend、node:test。

---

### Task 1: 固化付款指引行为

**Files:**
- Create: `tests/funding-guide.test.ts`
- Create: `web/components/FundingGuide.tsx`
- Modify: `web/components/WalletPaymentGuide.tsx`
- Modify: `web/components/QuestionForm.tsx`
- Modify: `web/i18n/zh.ts`
- Modify: `web/i18n/en.ts`
- Modify: `web/styles/components.css`

1. 先写主网三步、中英无串文、外链安全属性、测试网不显示新指引及两处入口的失败测试。
2. 运行 `node --import tsx --test tests/funding-guide.test.ts`，确认因组件缺失而失败。
3. 最小实现 `FundingGuide`、翻译词条和两处入口，保留测试网水龙头与复制地址。
4. 重跑测试并清理样式与重复文案。

### Task 2: 实现匿名按日计数存储

**Files:**
- Create: `tests/usage-metrics.test.ts`
- Create: `src/sanyi/metrics.ts`

1. 先写北京时间日期、并发原子累加、白名单、读取日期窗口和失败静默的失败测试。
2. 实现 `DocumentBackend` 指标仓库、空实现与安全记录接口。
3. 重跑指标单元测试，确认不保存地址、IP、问题或生辰。

### Task 3: 接入服务端生命周期与 HTTP

**Files:**
- Modify: `src/sanyi/reading-service.ts`
- Modify: `src/sanyi/bazi-reading-service.ts`
- Modify: `src/sanyi/naming/service.ts`
- Modify: `src/frontend/runtime.ts`
- Modify: `src/frontend/server.ts`
- Modify: `src/vercel/api.ts`
- Modify: `tests/usage-metrics.test.ts`

1. 先测试三类创建与首次终态事件，以及计数失败不影响结果流程。
2. 通过可替换 metrics 依赖接入 `reading_created`、`reading_done`、`reading_failed`。
3. 先测试 `/api/events` 的白名单、额外字段丢弃、同源/JSON/8 KiB，以及 `/api/stats` 的口令与天数边界。
4. 在共享 handler/runtime 中实现两个接口，并让两个部署入口使用同一装配结果。

### Task 4: 接入前端埋点

**Files:**
- Create: `web/lib/metrics.ts`
- Modify: `web/pages/Home.tsx`
- Modify: `web/pages/SampleReading.tsx`
- Modify: `web/components/WalletBar.tsx`
- Modify: `web/components/PaymentButton.tsx`
- Modify: `tests/usage-metrics.test.ts`

1. 先测试 keepalive、静默失败和首页/示例页面会话去重。
2. 实现 `track`，再分别接入挂载及点击位置。
3. 运行两份新增测试和受影响的既有前端/服务测试。

### Task 5: 验证与规范收尾

**Files:**
- Modify: `openspec/changes/funding-and-metrics/tasks.md`

1. 运行新增测试、相关既有测试、`npm test`、`npm run typecheck`、前端构建与秘密扫描。
2. 运行 `openspec validate funding-and-metrics --strict`。
3. 对照两份 spec 逐项检查，仅勾选实际完成的 tasks；不执行部署与生产环境变量设置。

