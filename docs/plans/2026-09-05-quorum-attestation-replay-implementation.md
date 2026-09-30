# 法定人数、ERC-8004 人层判定与回放引擎实施计划

> **供执行者：** 必须使用 `executing-plans`、`test-driven-development` 与 `verification-before-completion` 逐项执行本计划。

**目标：** 在链上强制完整易者法定人数并提供可恢复的缺席超时路径，以 ERC-8004 ValidationRegistry 实现人层判定，并交付无前视偏差的 100+ 回合 Walk-Forward 回放及链上 ScoreBook 记录。

**架构：** `PredictionBook` 在每轮首个成功预测时冻结注册参与集合，只要求其中未封存成员全部提交；截止后缺席则整轮作废并原路释放双方预留。`AttestedResolver` 作为 ERC-8004 validator 合约，由 agent owner 向标准 Registry 发起请求，白名单人类判定者经 resolver 回写标准响应。回放引擎分离“截止块上下文读取”和“未来块结算读取”，结果写入 ScoreBook 的独立 backtested 账本，避免污染现场统计。

**技术栈：** Solidity 0.8.30、Foundry、TypeScript 5.9、Node.js 测试运行器、Viem、Arc Testnet、ERC-8004 ValidationRegistry。

**环境限制：** 当前目录没有 `.git`，不能建立 worktree 或执行逐步 commit；不得声称已提交。`.env` 只由既有脚本读取，禁止输出其中内容。

---

### 任务 1：复现并封堵单家结算

**文件：**
- 修改：`contracts/test/PredictionBook.t.sol`
- 修改：`contracts/src/PredictionBook.sol`

1. 添加三位已注册易者但仅一位提交后调用 `settle` 的测试，预期语义化 `QuorumNotReached`，先运行并观察 RED。
2. 为注册易者建立不可重复的有序集合；轮次首个成功提交时冻结集合成员资格。
3. 结算前遍历冻结集合：已提交者满足义务；未提交且金库为 `SEALED` 者豁免；其余成员触发 `QuorumNotReached(roundId, submitted, required)`。
4. 补测试证明三家齐交可结算、首交后新增注册者不追溯加入、封存者不阻塞。
5. 运行：`cd contracts && forge test --match-path test/PredictionBook.t.sol -vv`；预期全部通过。

### 任务 2：缺席超时作废与资金释放

**文件：**
- 修改：`contracts/test/PredictionBook.t.sol`
- 修改：`contracts/test/DivinerVault.t.sol`
- 修改：`contracts/test/DivinationRegistry.t.sol`
- 修改：`contracts/src/PredictionBook.sol`
- 修改：`contracts/src/DivinerVault.sol`
- 修改：`contracts/src/DivinationRegistry.sol`

1. 先写截止前不可作废、截止后任何人可作废、提问者全部剩余资金退回、已提交易者预留释放、预测进入 `CANCELLED` 且不写 Brier 的 RED 测试。
2. 为 `DivinerVault` 增加仅 controller 可调用的无损 `cancelReservation`。
3. 为 `DivinationRegistry` 增加仅 escrow operator 可调用的 `cancelIncomplete`，将卦金与剩余保证金退回提问者并进入 `CANCELLED`。
4. 为 `PredictionBook` 增加无许可 `cancelIncompleteRound`，仅允许截止后且法定人数不足时原子释放所有已提交头寸。
5. 运行三个定向测试文件，确认 GREEN，并运行完整 Foundry 测试防回归。

### 任务 3：ERC-8004 AttestedResolver

**文件：**
- 创建：`contracts/src/interfaces/IValidationRegistry.sol`
- 创建：`contracts/src/AttestedResolver.sol`
- 修改：`contracts/test/Resolvers.t.sol`

1. 用本地 mock Registry 写 RED 测试：请求必须指向 resolver 且 agentId 匹配；只有白名单 attestor 可提交；0/100 与固定 tag 映射为 NO/YES；未知、1–99、错 tag、迟到响应均未决；禁止重复提交。
2. 实现 `openCase(requestHash, agentId, deadline)`，从标准 Registry 的 `getValidationStatus` 验证请求目标。
3. 实现 `submitOutcome`：在截止块前由 attestor 调 resolver，resolver 再调用 Registry `validationResponse`，保留证据 URI/hash。
4. 实现 `IResolver`，截止后只接受该 case 的标准 0/100 最终响应。
5. 运行：`cd contracts && forge test --match-path test/Resolvers.t.sol -vv`。

### 任务 4：ScoreBook 独立回放账本

**文件：**
- 修改：`contracts/test/ScoreBook.t.sol`
- 修改：`contracts/src/ScoreBook.sol`

1. 先写 RED：回放条目必须含截止/结算真实时间戳并固定 `backtested=true`；只允许一次绑定的 replay recorder 批量写；回放统计与现场统计完全分离；时间顺序和概率范围非法时回滚。
2. 新增 `BacktestScoreEntry`、独立 stats/history、`setReplayRecorder`、`recordBacktestBatch` 和查询函数。
3. 回放数据不向 ReputationRegistry 发布，防止把模拟结果污染现场声誉。
4. 运行 ScoreBook 定向测试与完整 Foundry 测试。

### 任务 5：无前视偏差的 Walk-Forward 引擎

**文件：**
- 创建：`src/replay/types.ts`
- 创建：`src/replay/engine.ts`
- 创建：`src/replay/arc-source.ts`
- 创建：`src/replay/mock-provider.ts`
- 创建：`src/replay/report.ts`
- 创建：`tests/replay-engine.test.ts`
- 创建：`tests/replay-report.test.ts`
- 创建：`scripts/run-walk-forward.ts`
- 修改：`package.json`

1. 先写 RED：预测阶段的数据源若访问 `blockNumber > cutoffBlock` 立即抛错；provider 输入序列化后不得出现 resolution block、future supply 或 outcome；三位易者接收同一个冻结命题对象；结算读取必须发生在三份预测完成之后。
2. 写确定性 mock provider，仅使用 cutoff hash、截止前窗口和 diviner key 产生 `[100,9900]` 概率。
3. 写确定性 bankroll：Beta(1,1) 后验与最大风险比例共同限制倍率/下注，LLM 输出不得影响 stake。
4. 写 Wilson 95% 与 Brier 聚合，报告顶层及每条记录均标注 `backtested`，并明确“非现场历史、不能证明预测力”。
5. Arc 数据源按明确 block tag 读取 hash/timestamp/USDC 历史状态；运行 100+ 回合并生成 JSON/Markdown。
6. 运行 Node 定向测试、全量测试与 typecheck。

### 任务 6：部署、Validation 真流程、回放上链与完整端到端

**文件：**
- 修改：`src/yijing-deployment.ts`
- 修改：`scripts/deploy-arc-testnet.ts`
- 修改：`scripts/run-agent-e2e.ts`
- 创建：`scripts/run-validation-e2e.ts`
- 修改：`deployments/arc-testnet.json`
- 创建：`reports/arc-validation-e2e-*.json`
- 创建：`reports/arc-walk-forward-*.json`
- 创建：`reports/arc-walk-forward-*.md`

1. 部署新合约栈并逐笔记录 gas/cost；新增 ValidationRegistry、AttestedResolver、回放 recorder 与人层谓词配置。
2. 用现有 agent owner 真实调用 `validationRequest`，打开 case，由 attestor 经 resolver 调 `validationResponse`，再以 `getValidationStatus` 和 resolver 结果复验。
3. 分批将 100+×3 回放结果写入新 ScoreBook，读回数量、首尾时间戳和统计核对报告。
4. 用确定性 mock provider 重跑 commit/reveal、同题三家预测、第三方无许可三笔结算；额外模拟单家结算并确认链上回滚。
5. 核算本轮部署、资金移动、锁定及 gas，总支出不得超过 4 USDC。

### 任务 7：最终验证与交付

1. 运行 `forge fmt --check`、`forge test -vv`、`npm test`、`npm run typecheck`、`npm run contracts:build`。
2. 对部署地址读 bytecode，核对 `deployments/arc-testnet.json` 的交易回执和链上状态。
3. 重读规格 3.0.2、6.5、7、10、15.6.2，逐项对照证据；明确真实 provider、异常网络路径等未验证项。
4. 当前目录无 `.git`，不执行 commit、PR 或分支收尾。
