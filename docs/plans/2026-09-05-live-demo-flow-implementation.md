# 90 秒现场演示流程 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把既有只读展览串成可在 Arc Testnet 上完成起卦、三家预测、结算与墓域展示的 90 秒现场流程，同时默认零模型费用。

**Architecture:** 浏览器继续只加载公开前端包，并通过同源 HTTP 调用本地演示控制器。控制器把每轮模式冻结为 mock 或 live，服务端驱动派生的提问者、三位易者与第三方结算账户签名；所有私钥只在 Node 进程内构造账户，API 只返回公开状态、概率、评分和交易哈希。链上适配器复用现有命题编译器、难度校准、agent 编排和合约，不修改合约。

**Tech Stack:** Node.js 22、TypeScript、viem、原生 HTTP、Web Components、Canvas 2D、Node test、esbuild、Foundry（仅最终回归，不修改合约）。

---

### Task 1: 演示状态机与安全 HTTP 边界

**Files:**
- Create: `src/demo/service.ts`
- Create: `tests/demo-service.test.ts`
- Modify: `src/frontend/server.ts`
- Modify: `tests/frontend-server.test.ts`

**Step 1: Write the failing test**

为默认 mock、显式 live 确认、单操作互斥、逐步交易回执、JSON POST 与同源限制编写最小测试。

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/demo-service.test.ts tests/frontend-server.test.ts`
Expected: FAIL，原因是演示服务及写接口尚不存在。

**Step 3: Write minimal implementation**

实现可注入链上驱动的状态机；新增 `GET /api/demo`、`POST /api/demo/round`、`POST /api/demo/predictions`、`POST /api/demo/settlement`。服务器只接受同源 JSON，限制请求体并把领域错误映射为 4xx/5xx。

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/demo-service.test.ts tests/frontend-server.test.ts`
Expected: PASS。

### Task 2: Arc Testnet 写入适配器与确定性 provider

**Files:**
- Create: `src/demo/arc-driver.ts`
- Create: `src/demo/provider.ts`
- Create: `tests/demo-arc-driver.test.ts`
- Modify: `src/frontend/server.ts`
- Modify: `src/frontend/abis.ts`

**Step 1: Write the failing test**

测试账户派生与部署清单匹配、默认 mock 固定输出、live 必须显式构造、交易回执不含秘密字段、截止等待和成本累计。

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/demo-arc-driver.test.ts`
Expected: FAIL，原因是 Arc 写入适配器尚不存在。

**Step 3: Write minimal implementation**

复用既有合约 ABI、`PropositionCompiler`、难度校准、`AgentOrchestrator` 与 `ViemPredictionSubmitter`，实现 approve → commit → 等待 → reveal、三家顺序提交和第三方等待截止后结算。每笔交易记录哈希、块高、gas 与成本；不记录密钥。

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/demo-arc-driver.test.ts`
Expected: PASS，且未访问真实 RPC 或 DeepSeek。

### Task 3: 可驱动前端与现场指标

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.ts`
- Modify: `web/styles.css`
- Modify: `src/frontend/data.ts`
- Modify: `tests/frontend-content.test.ts`
- Modify: `tests/frontend-data.test.ts`

**Step 1: Write the failing test**

测试问题输入、默认 mock 模式、live 显式确认、代签披露、交易凭证、基础概率、逐家出现、无许可结算按钮、live 金库与 Brier/BSS，以及前端源码禁止任何私钥/钱包入口。

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/frontend-content.test.ts tests/frontend-data.test.ts`
Expected: FAIL，原因是现场控件与 live 指标尚不存在。

**Step 3: Write minimal implementation**

沿用纸墨、朱印、细线分栏与 6.4 秒筮竹动效；新增模式印章、问题表单、阶段按钮、交易凭证带、现场金库变化与 live Brier/BSS 行。前端轮询演示状态并在每位易者提交后更新卡片。

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/frontend-content.test.ts tests/frontend-data.test.ts`
Expected: PASS。

### Task 4: 排练脚本与秘密扫描

**Files:**
- Create: `src/demo/rehearsal.ts`
- Create: `scripts/rehearse-demo.ts`
- Create: `scripts/check-frontend-secrets.ts`
- Create: `tests/demo-rehearsal.test.ts`
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Write the failing test**

测试完整 session 的断言器会拒绝缺交易、非三家、非结算终态或超预算结果，并验证 secret 扫描只报告文件名而不回显秘密。

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/demo-rehearsal.test.ts`
Expected: FAIL，原因是排练断言器尚不存在。

**Step 3: Write minimal implementation**

加入 `npm run demo:rehearse`（固定 mock）与需显式确认的 live 冒烟入口；输出中文逐步结果、模型用量、链上 gas 与余额变化。加入构建后秘密值/危险前端导入扫描。

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/demo-rehearsal.test.ts`
Expected: PASS，且不访问真实 DeepSeek。

### Task 5: 全量验证与唯一一次 live 冒烟

**Files:**
- Verify only; do not modify contracts.

**Step 1: Run deterministic verification**

Run: `npm test && npm run typecheck && npm run frontend:build && npm run frontend:secrets && (cd contracts && PATH="$HOME/.foundry/bin:$PATH" forge test -vv)`
Expected: Node、类型、前端构建、秘密扫描与 Foundry 全绿；不执行回放或消融。

**Step 2: Run browser verification**

启动 `npm run frontend:dev`，检查桌面与移动布局、无控制台错误、mock 默认值和按钮状态。

**Step 3: Run mock rehearsal**

先只读记录链上余额，再运行 `npm run demo:rehearse`，断言完整路径和每笔交易哈希，记录实际 Arc Testnet 成本。

**Step 4: Announce estimated paid cost**

在终端输出/对话中先报告 DeepSeek 预计约 `0.005 CNY`，确认本轮累计估计低于 `0.5 CNY`。

**Step 5: Run the single live smoke**

Run: `npm run demo:smoke:live`
Expected: 只执行一卦三家的一次 live 演示流程，记录调用前后余额差、token 用量与实际 CNY 成本；总链上花费低于 2 USDC。
