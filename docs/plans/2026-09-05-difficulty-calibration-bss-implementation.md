# 命题难度校准与 BSS 实施计划

> **执行要求：** 按 TDD 逐项完成；任何 DeepSeek 付费回放前先验证校准结果并报告预算。

**目标：** 让进入押注层的阈值命题在截止块之前的历史回测基础概率稳定落入 35%–65%，并在 ScoreBook、回放、消融与 UI 中以经验基础概率常数预测为参照报告 Brier Skill Score。

**架构：** 新增纯函数难度校准器，对严格早于本轮截止块的同跨度历史增量枚举阈值，确定性选择基础概率最接近 50% 的候选；无法达到 35%–65% 时返回结构化拒绝。回放引擎与真实命题编译器共用该校准器。统计层统一计算批次 YES 占比、常数预测 Brier、BSS 与按轮次配对的 Brier 检验，报告与 UI 只消费这些显式字段。

**技术栈：** TypeScript、Node test runner、Solidity 0.8.30、Foundry、viem。

---

### 任务 1：锁定难度校准和前视边界

**文件：**
- 新建：`src/difficulty-calibration.ts`
- 修改：`src/replay/engine.ts`
- 修改：`src/replay/arc-source.ts`
- 测试：`tests/difficulty-calibration.test.ts`
- 测试：`tests/replay-engine.test.ts`
- 测试：`tests/replay-source.test.ts`

1. 先写失败测试：可分离历史增量应反解出 35%–65% 的阈值，重复增量导致无可用阈值时必须明确拒绝。
2. 先写失败测试：校准历史配对的结算端必须严格小于本轮截止块，未来结算块仍只能在三位预测完成后读取。
3. 实现确定性阈值枚举、固定 tie-break、结构化拒绝和 Arc 历史读取缓存。
4. 运行定向测试确认 GREEN。

### 任务 2：把校准接入 PropositionCompiler

**文件：**
- 修改：`src/agent/proposition-compiler.ts`
- 修改：`scripts/run-agent-e2e.ts`
- 测试：`tests/proposition-compiler.test.ts`

1. 先写失败测试：provider 只能看到已经校准且可测量的谓词及冻结参数。
2. 先写失败测试：provider 改写校准参数时拒绝且不重试；所有谓词都不适用时输出逐谓词原因。
3. 让编译器先冻结截止块、校准所有链上合格谓词，再调用 provider 选择；审计输出保留校准窗口、样本量和基础概率。
4. 运行定向测试确认 GREEN。

### 任务 3：统一基础概率参照与 BSS

**文件：**
- 新建：`src/scoring.ts`
- 修改：`src/replay/engine.ts`
- 修改：`src/replay/report.ts`
- 修改：`src/replay/ablation.ts`
- 修改：`src/replay/deepseek-ablation.ts`
- 修改：`contracts/src/ScoreBook.sol`
- 测试：`tests/scoring.test.ts`
- 测试：`tests/replay-report.test.ts`
- 测试：`tests/replay-ablation.test.ts`
- 测试：`contracts/test/ScoreBook.t.sol`

1. 先写失败测试，证明 `p0=0.05` 时常数参照 Brier 为 `0.0475`、`Brier=0.18` 时 BSS 约 `-2.78947`。
2. 先写失败测试，证明极端全 YES/全 NO 批次的 BSS 明确为不可定义，而不是除零或伪造 0。
3. 在 ScoreBook 中独立累计已决 YES/NO，提供现场与 backtest 的基础概率、常数 Brier 和有定义标志的 BSS；含未决样本时明确不可定义。
4. 回放与消融的总体、分易者和 Markdown/JSON 同时输出基础概率、原始 Brier、BSS、Wilson 与检验 p 值，并标注极端基础概率下命中率会误导。
5. 运行 Node 与 Foundry 定向测试确认 GREEN。

### 任务 4：更新 UI、说明与构建产物

**文件：**
- 修改：`src/frontend/data.ts`
- 修改：`src/frontend/domain.ts`
- 修改：`web/app.ts`
- 修改：`web/index.html`
- 修改：`README.md`
- 修改：`docs/plans/2026-09-05-yijing-oracle-design.md`
- 测试：`tests/frontend-data.test.ts`
- 测试：`tests/frontend-domain.test.ts`
- 测试：`tests/frontend-content.test.ts`

1. 先写失败测试：UI 必须显示批次 YES 占比、经验常数参照 Brier、BSS 及胜率警告，不再把 0.25 当成唯一正确基准。
2. 修改数据类型、判读逻辑与文案。
3. 重建 `web/dist` 并运行前端定向测试。

### 任务 5：真实校准、预算闸门与受限全量

**文件：**
- 修改：`scripts/run-deepseek-replay.ts`
- 修改：`scripts/run-deepseek-ablation.ts`
- 产出：`reports/deepseek-walk-forward-calibration-*.{json,md}`
- 产出：`reports/deepseek-walk-forward-1000.{json,md}`
- 产出：`reports/deepseek-ablation-*.{json,md}`

1. 提升实验版本，避免复用旧阈值对应的合法输出；保留旧审计日志，按新任务键继续追加。
2. 重跑 20–30 回合并验证实际基础概率为 35%–65%、BSS 数学一致、历史窗口无前视。
3. 查询余额与校准 token 实耗，先在终端报告主回放 1000 回合及三组等样本对照的预算分配和安全余量。
4. 主回放完成后复用 actual 输出，在余额闸门内执行三组最大安全等样本消融。
5. 运行完整 Node 测试、typecheck、Foundry 测试与报告一致性检查，列出未验证路径。
