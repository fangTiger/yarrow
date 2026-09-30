# 全付费问卦与五行显式层 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 取消用户可见的免费起卦，让每卦自动进入付费钱包流程，并把五行推导与排盘详情提升为结果主内容。

**Architecture:** 不修改合约；不可判定问题用原子批量调用直付三库，可判定问题复用 commit 并由现有 treasury 自动分账。领域层导出五行关系与逐爻情境数据，React 只负责可视化和就地说明。

**Tech Stack:** TypeScript、Node test runner、React 18、wagmi/RainbowKit、viem EIP-5792、esbuild、Playwright CLI。

---

### Task 1: 付费与五行领域规则

**Files:**
- Create: `src/oracle/fee-payment.ts`
- Modify: `src/oracle/liuyao-chart.ts`
- Test: `tests/oracle-fee-payment.test.ts`
- Test: `tests/liuyao-chart.test.ts`

1. 写三库精确分账、相生相克全表、五类六亲关系和上下卦五行失败测试。
2. 运行定向测试，确认因接口缺失失败。
3. 实现最小纯函数和结构化字段。
4. 重跑定向测试至通过。

### Task 2: 問轨付款门禁与賭轨分账

**Files:**
- Modify: `src/oracle/question-oracle.ts`
- Modify: `src/demo/service.ts`
- Modify: `src/demo/mock-driver.ts`
- Modify: `src/demo/arc-driver.ts`
- Test: `tests/question-oracle.test.ts`
- Test: `tests/demo-service.test.ts`
- Test: `tests/demo-arc-driver.test.ts`

1. 写“先验款后解读”、三库凭证和三家应卦后分账失败测试。
2. 运行定向测试确认失败原因。
3. 接入付款 verifier、分账交易类型和 mock/live 分账驱动。
4. 重跑定向测试至通过。

### Task 3: 一次点击钱包流与紧凑布局

**Files:**
- Modify: `web/app.tsx`
- Modify: `web/styles.css`
- Modify: `tests/fixtures/mock-eip1193-provider.js`
- Test: `tests/frontend-content.test.ts`

1. 写标价按钮、自动钱包、无可见 mock、细状态行及凭证展开失败测试。
2. 运行前端内容测试确认失败。
3. 实现待续流程、EIP-5792 原子授权/付款、提交前可选覆盖和紧凑状态行。
4. 重跑内容测试、类型检查和构建。

### Task 4: 五行可视化与逐爻解释

**Files:**
- Modify: `web/app.tsx`
- Modify: `web/styles.css`
- Test: `tests/frontend-content.test.ts`

1. 写相生环、相克星、上下卦与六条情境解释失败测试。
2. 实现 SVG 五行图和逐爻 `details`。
3. 重跑定向测试与构建。

### Task 5: 文档和全量验收

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-09-06-dual-track-human-oracle.md`
- Modify: `openspec/changes/paid-oracle-wuxing/tasks.md`
- Create: `output/playwright/paid-oracle-wuxing-*.png`

1. 清除 README 和旧设计中的用户可见免费/零成本双轨描述，保留 mock 开发边界。
2. 用 mock 服务和假钱包完成桌面/移动验收并截图，确认整页无横向溢出。
3. 运行 `npm test`、`npm run typecheck`、`npm run frontend:build`、`npm run frontend:secrets`。
4. 对照 spec 和 tasks 更新真实状态，记录链上花费 0 USDC 与未完成项。

