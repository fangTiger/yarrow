# 单签名自动开卦与可恢复会话 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将受控演示改为首次固定授权、稳态仅签 commit、服务端自动揭示与结算，并让失败会话可立即重开且 mock 总耗时低于 40 秒。

**Architecture:** `DemoActionService` 分离公开 preparation 与仅内存保存的 round secret；驱动负责服务端 reveal、permissionless settlement 和恢复状态描述。React 只发送 approve/commit，轮询服务端自动阶段，并在原有工作台中展示签名次数、阶段耗时与重开入口。

**Tech Stack:** TypeScript、Node.js、React 18、wagmi、RainbowKit、viem、Node test runner、esbuild。

---

### Task 1: 固定新协议与预算的失败测试

**Files:**
- Modify: `tests/demo-service.test.ts`
- Modify: `tests/demo-arc-driver.test.ts`
- Modify: `tests/demo-mock-driver.test.ts`
- Modify: `tests/demo-rehearsal.test.ts`
- Modify: `tests/frontend-server.test.ts`
- Modify: `tests/frontend-wallet.test.ts`
- Modify: `tests/frontend-content.test.ts`

**Steps:**
1. 写测试固定公开响应无 salt、confirm 只收 approve/commit、服务端自动 reveal/settle。
2. 写测试固定 allowance 目标为 10.000000 USDC、稳态钱包写入仅一次。
3. 写测试固定 60 块总交互余量、mock 40 秒上限和阶段耗时记录。
4. 写测试固定失败后可 abandon、新轮立即开始并返回旧资金恢复说明。
5. 运行定向测试，确认因旧协议而按预期失败。

### Task 2: 服务与驱动最小实现

**Files:**
- Modify: `src/demo/service.ts`
- Modify: `src/demo/arc-driver.ts`
- Modify: `src/demo/mock-driver.ts`
- Modify: `src/demo/rehearsal.ts`
- Modify: `src/frontend/server.ts`

**Steps:**
1. 将 `salt` 移到仅服务端持有的 `DemoRoundSecret`，公开 preparation 增加固定授权信息。
2. 让 confirm 验证 commit 后由驱动等待并以同地址托管账户自动 reveal。
3. 让 settle 由服务端 permissionless 账户发送三笔交易。
4. 增加 abandon、recoverable 资金状态与面向用户的错误文案。
5. 把 60 块作为总余量去重计入 deadline，记录七段预计/实测耗时。
6. 运行定向测试确认 GREEN。

### Task 3: 钱包与 React 流程

**Files:**
- Modify: `src/frontend/wallet.ts`
- Modify: `web/app.tsx`
- Modify: `web/styles.css`
- Modify: `tests/fixtures/mock-eip1193-provider.js`

**Steps:**
1. 实现固定 10 USDC allowance 判定和 18 轮说明。
2. 删除浏览器 reveal/settle 写入，只保留首次 approve 与每轮 commit。
3. 在现有状态区加入首次/稳态签名提示、阶段预计/实测耗时和重开按钮。
4. 让注入式 mock 钱包记录写入次数并验证首轮 2 次、稳态 1 次。
5. 运行前端定向测试与构建、秘密扫描。

### Task 4: 规范、排练与最终验证

**Files:**
- Modify: `openspec/changes/user-wallet-workbench/specs/wallet-signed-divination/spec.md`
- Modify: `openspec/changes/user-wallet-workbench/specs/single-screen-oracle-workbench/spec.md`
- Modify: `openspec/changes/user-wallet-workbench/design.md`
- Modify: `openspec/changes/user-wallet-workbench/tasks.md`
- Modify: `scripts/rehearse-demo.ts`
- Modify: `README.md`

**Steps:**
1. 同步规格与 tasks，记录自动揭示安全论证和受控账户边界。
2. mock 真人节奏跑完整流程并生成阶段耗时、签名次数与零费用报告。
3. 运行 `npm test`、`npm run typecheck`、`npm run frontend:build`、`npm run frontend:secrets`。
4. 使用 Playwright 注入 mock 钱包完成首轮和稳态第二轮，检查控制台与 UI。
5. 输出中文摘要；不调用 DeepSeek、不执行回放/消融、不发送真实链上交易。

