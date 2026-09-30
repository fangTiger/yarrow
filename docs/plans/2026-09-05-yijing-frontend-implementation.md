# 身銭を切る易者前端实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task.

**目标：** 构建可运行的展览型前端，从 Arc Testnet 与已落盘的审计记录读取真实数据，完成起卦仪式、三家解卦、金库曲线、Brier 面板和墓域五个画面。

**架构：** 使用原生 TypeScript 与 Web Components，浏览器端由 esbuild 打包；一个无私钥的只读 Node 服务聚合 Arc RPC、部署清单、回放报告与 agent 审计日志。链上状态是主数据源；合约没有保存的自然语言解读与逐轮 bankroll 轨迹分别取自审计日志和确定性回放报告，并在 UI 中明确标出来源。

**技术栈：** TypeScript 5、viem、Web Components、Canvas 2D、esbuild、Node `http`、Node test runner。

---

### 任务 1：建立可测试的前端领域模型

**文件：**

- 新建：`src/frontend/domain.ts`
- 新建：`tests/frontend-domain.test.ts`

**步骤：**

1. 先写失败测试，约束六爻源数据为自下而上、屏幕绘制为上爻到初爻，并约束老阴/老阳的变爻推演。
2. 运行 `node --import tsx --test tests/frontend-domain.test.ts`，确认因实现缺失而失败。
3. 实现 `createLineViews`、`buildBankrollSeries`、`interpretBacktestSignal` 和展示格式化函数。
4. 重跑定向测试，确认通过。

### 任务 2：实现只读链上聚合层

**文件：**

- 新建：`src/frontend/abis.ts`
- 新建：`src/frontend/data.ts`
- 新建：`tests/frontend-data.test.ts`

**步骤：**

1. 先写失败测试，约束部署清单映射、RPC 输出归一化、链上/审计/回放来源标签和空墓域行为。
2. 运行定向测试并确认 RED。
3. 使用 viem 读取最新块、最新轮次、本卦/之卦、三笔预测、实时与回放 ScoreBook、Wilson 区间、金库余额与封存状态；不创建 wallet client，不读取任何私钥。
4. 从当前部署对应的 journal 读取自然语言解读，从回放报告读取逐轮 bankroll；缺失时返回明确的不可用状态，不造假。
5. 重跑定向测试并确认 GREEN。

### 任务 3：搭建服务与前端 v0

**文件：**

- 新建：`src/frontend/server.ts`
- 新建：`scripts/build-frontend.ts`
- 新建：`web/index.html`
- 新建：`web/styles.css`
- 修改：`package.json`

**步骤：**

1. 先写服务路由测试，要求 `/api/oracle` 返回 JSON、静态路径禁止越界。
2. 运行测试确认 RED。
3. 实现只读 API 与静态文件服务，增加 `frontend:build`、`frontend:dev`、`frontend:start` 脚本。
4. 建立白木、墨、灰、暗朱设计 token 和五段式纵向版面骨架。
5. 运行构建与服务测试确认 GREEN。

### 任务 4：实现仪式与五个关键画面

**文件：**

- 新建：`web/app.ts`
- 完善：`web/index.html`
- 完善：`web/styles.css`
- 新建：`tests/frontend-content.test.ts`

**步骤：**

1. 先写内容契约测试，覆盖五个画面与全部诚实标注。
2. 运行测试确认 RED。
3. 用 `requestAnimationFrame` 实现 6.4 秒筮竹聚散与六爻自下而上显现；标出“链上确认约 0.5s・仪式演出 6.4s”，并支持减少动态效果。
4. 实现最新同卦的三家 p / m / 解读并列视图，明确 `mock provider`、链下中心化推理与卦辞到命题的解释跳跃。
5. 用 Canvas 绘制三条 bankroll 曲线，明确曲线来自 `backtested` 确定性回放，倍率收缩表示风险管理而非预测能力提升。
6. 实现 Brier、n、Wilson 95%、0.25 基准与“无可辨识信号”结论。
7. 实现墓域：仅为链上 `SEALED` 易者绘制墓碑；当前没有封存者时显示真实空态，不创建虚构墓碑。
8. 所有宽内容设置局部横向滚动，根页面禁止横向滚动。
9. 重跑内容测试与领域测试确认 GREEN。

### 任务 5：README、响应式与交付验证

**文件：**

- 修改：`README.md`
- 修改：`tests/readme.test.ts`（仅在现有约束需要扩展时）

**步骤：**

1. 先增加 README 启动说明测试并确认 RED。
2. 写入安装、构建、启动、数据来源、只读安全边界与已知限制说明。
3. 运行 `npm test`、`npm run typecheck`、`npm run frontend:build`。
4. 启动服务并请求首页与 `/api/oracle`，确认真实 Arc Testnet 数据可达。
5. 在桌面和窄屏截图中检查排版、局部滚动、六爻顺序和动效降级。

