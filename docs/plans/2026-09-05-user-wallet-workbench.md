# User Wallet Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion to implement this plan task-by-task.

**Goal:** 让提问者用自己的钱包承担用户交易，并把问卦改造成一次点击后自动推进的单屏工作台。

**Architecture:** React SPA 通过 wagmi/RainbowKit 让用户钱包负责用户交易，服务端通过准备/核验协议维持会话并只签 agent 预测；单一会话状态投影到六步进度轨、主舞台和三张常驻易者卡。卦历使用轻量哈希路由隔离。

**Tech Stack:** React 18、TypeScript、wagmi 2、RainbowKit 2、TanStack Query、viem、esbuild、Node HTTP、node:test、Playwright CLI。

---

### Task 1: 钱包领域与精度

**Files:**
- Create: `src/frontend/wallet.ts`
- Create: `tests/frontend-wallet.test.ts`
- Modify: `src/demo/secret-scan.ts`
- Test: `tests/frontend-content.test.ts`

1. 写失败测试固定 Arc chain、六位 ERC-20、十八位原生 gas 换算、余额差额与错误归类。
2. 运行 `node --import tsx --test tests/frontend-wallet.test.ts tests/frontend-content.test.ts`，确认因模块或行为缺失失败。
3. 实现最小钱包领域函数与安全扫描调整。
4. 重跑定向测试直至通过并清理重复。

### Task 2: 用户交易准备与核验协议

**Files:**
- Modify: `src/demo/service.ts`
- Modify: `src/demo/arc-driver.ts`
- Modify: `src/frontend/server.ts`
- Modify: `src/frontend/abis.ts`
- Test: `tests/demo-service.test.ts`
- Test: `tests/demo-arc-driver.test.ts`
- Test: `tests/frontend-server.test.ts`

1. 写失败测试覆盖 prepare/confirm、用户地址和交易哈希核验、服务端不再签用户交易。
2. 运行三个定向测试并确认预期失败。
3. 最小实现准备、确认、预测和结算核验 API。
4. 重跑定向测试，确保 agent 预测重试语义保持。

### Task 3: React 钱包壳与公开构建配置

**Files:**
- Create: `web/lib/wagmi.ts`
- Create: `web/providers/Providers.tsx`
- Create: `web/main.tsx`
- Modify: `scripts/build-frontend.ts`
- Modify: `package.json`
- Test: `tests/frontend-content.test.ts`

1. 写失败测试固定 React 根节点、Provider 顺序、RainbowKit 深色紧凑主题、Arc 单链与四项公开配置白名单。
2. 运行内容测试，确认因 React 文件和依赖缺失而失败。
3. 安装并配置 React、wagmi、RainbowKit 与 Query，调整 esbuild TSX/CSS 构建。
4. 重跑内容测试、构建与类型检查。

### Task 4: React 单屏结构与自动编排

**Files:**
- Modify: `web/index.html`
- Create: `web/app.tsx`
- Modify: `web/styles.css`
- Test: `tests/frontend-content.test.ts`

1. 写失败内容测试固定六步轨、唯一主按钮、独立卦历、三卡唯一呈现、术语清理和诚实披露。
2. 运行内容测试并确认旧长页面失败。
3. 重建 HTML/CSS 工作台并实现钱包动作、费用托盘、自动预测重试、倒计时和自动结算。
4. 重跑内容测试、构建和类型检查，修复所有静态问题。

### Task 5: Mock 浏览器验收与总验证

**Files:**
- Create or Modify: `output/playwright/*`
- Modify: `openspec/changes/user-wallet-workbench/tasks.md`

1. 构建前端并启动只使用 mock provider/钱包的本地验收服务。
2. 用 Playwright CLI 在 1440×1000 与 390×844 以真人节奏停顿走完整流程，保存最终截图并检查 console。
3. 运行 `npm test`、`npm run typecheck`、`npm run frontend:build`、`npm run frontend:secrets`。
4. 对照 OpenSpec 更新任务状态，记录模型费用 0、实际链上花费和部署者剩余余额。
