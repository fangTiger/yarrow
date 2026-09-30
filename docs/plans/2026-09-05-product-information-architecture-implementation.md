# 易者产品信息架构 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use test-driven-development to implement this plan task-by-task.

**Goal:** 在不改合约与 `/api/demo/*` 的前提下，把前端重构为以提问和卦卡为核心的六段动作式产品。

**Architecture:** 扩展只读 `/api/oracle` 快照，将链上已揭示轮次和 1000 条回放轮次规范化为统一卦历数据；浏览器继续使用原生 TypeScript/Web Components，并固定向演示写接口发送 mock 模式。仪式、卡片流、结算和档案在一个无路由依赖的渐进式页面内按用户动作显现。

**Tech Stack:** TypeScript 5、Web Components、Canvas 2D、viem、Node test、esbuild、Playwright CLI。

---

### Task 1: 固化六段信息架构与人话文案

**Files:**
- Modify: `tests/frontend-content.test.ts`
- Modify: `web/index.html`

1. 先写失败测试，覆盖六段结构、首屏唯一动作、就地披露、自然语言优先、卦历筛选与档案入口。
2. 运行内容测试，确认因旧结构缺项而失败。
3. 重写语义 HTML 骨架，并移除底部披露墙与 live 模式入口。
4. 重跑内容测试。

### Task 2: 将 1000 回合和链上轮次变为统一卦历数据

**Files:**
- Modify: `tests/frontend-data.test.ts`
- Modify: `src/frontend/abis.ts`
- Modify: `src/frontend/data.ts`

1. 先写失败测试，约束优先选择 1000 回合报告及卡片字段、来源与盈亏。
2. 运行定向测试确认 RED。
3. 增加只读事件聚合和回放记录规范化，不改任何演示写接口。
4. 运行定向测试确认 GREEN。

### Task 3: 实现动作流、卦卡、结算和档案

**Files:**
- Modify: `web/app.ts`
- Modify: `web/styles.css`

1. 由内容测试约束所需交互挂点。
2. 实现固定 mock 的提问流程、渐进式结果、卡片筛选/加载、详情展开与档案对话框。
3. 实现单人资金曲线与结算数字动效。
4. 运行前端内容测试、类型检查和构建。

### Task 4: 全量与浏览器验收

**Files:**
- Verify only.

1. 运行 `npm test`、`npm run typecheck`、`npm run frontend:build`、`npm run frontend:secrets`。
2. 启动前端，以桌面和移动视口完成提问、展开卦历、筛选和档案流程，确认控制台 0 错误 0 警告且页面无横向滚动。
3. 运行 `npm run demo:rehearse`，确认 mock provider 和零模型费用；不运行回放、消融或合约测试。
