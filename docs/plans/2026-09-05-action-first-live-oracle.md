# 动作式 LIVE 问卦 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use test-driven-development to implement this plan task-by-task.

**Goal:** 将现有前端重构为六段动作式深色产品，并只在一次完整真实验证通过后默认启用 LIVE。

**Architecture:** 保持 `/api/demo/*` 与合约不变，在既有 Web Component 单页状态机上重排入口、卡片、结算、卦历和档案；继续由 `/api/oracle` 统一 1000 回合回放和链上事件。服务端默认模式与浏览器显式模式共同受 live 验证结果和费用门禁约束。

**Tech Stack:** TypeScript 5、Web Components、CSS custom properties、viem、Node test、esbuild、Playwright CLI。

---

### Task 1: 费用门禁与唯一 LIVE 验证

**Files:** `tests/demo-rehearsal.test.ts`、`tests/demo-arc-driver.test.ts`、`src/demo/rehearsal.ts`、`src/demo/arc-driver.ts`、`scripts/rehearse-demo.ts`

1. 编写断言 1.5 USDC 上限的失败测试并确认 RED。
2. 将发送前和完成后预算常量收紧到 1.5 USDC，确认 GREEN。
3. 运行唯一一次 `npm run demo:smoke:live`；若完整通过则保存报告并核对命题、三家 reasoning、结算、模型余额差和链上费用，若中途失败则记录失败阶段与已发生费用并保持 MOCK 默认。

### Task 2: 默认模式与动作式信息架构

**Files:** `tests/demo-service.test.ts`、`tests/frontend-content.test.ts`、`src/demo/service.ts`、`src/frontend/server.ts`、`web/index.html`、`web/app.ts`

1. 编写默认模式验证门禁、可选 MOCK/LIVE、费用文案、首屏唯一动作及六段流程的失败测试。
2. 根据唯一 LIVE 验证结果决定默认值，并实现浏览器模式控件；保持 live 显式确认由前端随明确选择发送。
3. 以同构卡片呈现应卦、卦历和档案，逐阶段就地展示披露。

### Task 3: 深色视觉重构

**Files:** `tests/frontend-content.test.ts`、`web/index.html`、`web/styles.css`

1. 编写设计 token、纵书、和柄、等宽链上数据、局部横向滚动的失败测试。
2. 实现唯一深色主题、首屏静止、成卦与结算平滑动效和 390px 响应式布局。
3. 构建并检查没有旧米色 token、紫色渐变、鸟居或中式装饰。

### Task 4: 全量交付验证

**Files:** verification only

1. 运行 `npm test`、`npm run typecheck`、`npm run frontend:build`、`npm run frontend:secrets`、`npm run demo:rehearse`。
2. 启动本地前端，用 Playwright CLI 在桌面和移动端走完流程；确认控制台 0 错误 0 警告、根页面无横向滚动，保存两张截图。
3. 对照 OpenSpec 更新 `tasks.md`，输出六部分完成度、数据来源、人话示例、视觉证明、live 实际费用、默认模式、mock/密钥结果及未完成项。
