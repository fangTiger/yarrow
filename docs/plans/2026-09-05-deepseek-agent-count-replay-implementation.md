# DeepSeek、Agent 计数与千回合回放实施计划

> **供执行者：** 必须按 `test-driven-development` 的 RED-GREEN-REFACTOR 顺序执行，并在结束前使用 `verification-before-completion`。

**目标：** 将真实推理默认 provider 切换为固定配置的 DeepSeek V4-Flash，实现可审计的合法失败重试和链上尝试次数；验证并在可行时部署 ERC-8004 agent 计数 resolver；用首个合法输出完成 1000 回合主回放与四组消融。

**架构：** `StructuredOutputProvider` 为每次生成同步记录原始输出哈希、结果类别与 token usage；DeepSeek 仅在传输失败、非法 JSON 或 schema 失败后重试，一旦合法立即返回。`PredictionBook` 保存 `providerConfigHash` 与 `attemptCount`。回放把每个条件、轮次、易者的首个合法输出原子追加到可恢复日志，校准与全量共用同一批冻结样本；消融主组复用主回放，三个对照组只改变卦象暴露。

**技术栈：** TypeScript 5.9、Node.js 22 原生 `fetch`、Ajv、Viem、Solidity 0.8.30、Foundry、Arc Testnet、DeepSeek OpenAI 兼容接口。

**环境限制：** 当前目录没有 `.git` 与 Graphify 输出，不能创建 worktree 或提交；密钥只由既有 `--env-file=.env` 入口注入，任何日志和报告不得包含密钥。DeepSeek 全量运行必须经过 20 回合实测预算门，链上写入前必须估算且本轮总花费小于 3 USDC。

---

### 任务 1：DeepSeek provider 与不可择优审计

**文件：**
- 创建：`src/agent/deepseek-provider.ts`
- 创建：`src/agent/default-provider.ts`
- 修改：`src/agent/provider.ts`
- 修改：`src/agent/anthropic-provider.ts`
- 修改：`src/agent/diviners.ts`
- 修改：`src/agent/proposition-compiler.ts`
- 修改：`src/agent/orchestrator.ts`
- 修改：`src/agent/run-journal.ts`
- 修改：`tests/agent-provider.test.ts`
- 修改：`tests/agent-orchestrator.test.ts`
- 修改：`package.json`
- 创建：`scripts/check-deepseek-provider.ts`

1. 先写 RED：固定模型、禁用思考、JSON 模式、固定 base URL、无采样参数；非法 JSON/schema 与 5xx 可重试；4xx 不重试；每次尝试先记录哈希；首个合法输出返回后即使尚有重试额度也只调用一次。
2. 运行 provider 定向测试，确认因 DeepSeek 实现和尝试审计接口缺失而失败。
3. 实现最小 provider；请求提示必须含字面量 `json`，每次响应在解析前计算哈希并等待审计持久化，合法即 `return`。
4. 让 mock 与保留的 Anthropic provider 也实现统一配置承诺和单次尝试记录；默认工厂只选择 DeepSeek，mock 仍须显式构造。
5. 编排器把命题编译和三位易者的尝试事件写入同一轮 JSONL，收集易者实际尝试次数；运行定向测试与 typecheck。

### 任务 2：provider 配置哈希与尝试次数上链

**文件：**
- 修改：`contracts/test/PredictionBook.t.sol`
- 修改：`contracts/src/PredictionBook.sol`
- 修改：`src/agent/orchestrator.ts`
- 修改：`src/agent/onchain.ts`
- 修改：`tests/agent-orchestrator.test.ts`
- 修改：`scripts/run-arc-e2e.ts`
- 修改：`scripts/run-agent-e2e.ts`
- 修改：`scripts/run-seal-demo.ts`

1. 先写 Solidity RED：`Prediction` 必须保存非零 `providerConfigHash` 与正数 `attemptCount`，零值在资金预留前回滚。
2. 运行 `PredictionBook.t.sol` 确认 RED；最小扩展请求、存储和校验后确认 GREEN。
3. 写 TypeScript RED，证明提交值等于固定 provider 配置的规范 JSON 哈希，尝试次数等于日志中的生成尝试数。
4. 更新 Viem ABI 与所有旧脚本的结构参数；运行 Node 定向测试、完整 Foundry 测试和 typecheck。

### 任务 3：`ownerOf` 探测与 AgentCountResolver

**文件：**
- 创建：`contracts/src/interfaces/IIdentityRegistry.sol`
- 创建：`contracts/src/AgentCountResolver.sol`
- 修改：`contracts/test/Resolvers.t.sol`
- 创建：`src/agent-count-probe.ts`
- 创建：`tests/agent-count-probe.test.ts`
- 创建：`scripts/probe-agent-count.ts`
- 修改：`scripts/deploy-arc-testnet.ts`
- 修改：`src/yijing-deployment.ts`

1. 只读实测不存在 id、0/1 基数、已知连续区间与当前高水位；对样本空洞和 `Transfer` 销毁证据保持显式结论，不把抽样伪装成全量证明。
2. 先写 RED：二分要求下界存在、上界不存在；模拟连续映射得到精确计数；内部空洞、上界已铸造或超时观察必须拒绝/未决；首次观察后结果冻结。
3. 若链上证据支持单调存在，实现约 32 次 `ownerOf` 的高水位搜索、首次允许结算观察与严格 `count > N`；否则停止合约实现并记录不可行证据。
4. 用真实 RPC 估算 resolver 搜索 gas 与单次 `register(string)` gas；按当前可观测注册速率和每跨越一个阈值所需注册数计算操纵成本。
5. 本地测试通过后部署 resolver、登记 `AGENT_COUNT_ABOVE` 为天层谓词，并做一次链上只读/状态观察验证；记录交易与成本。

### 任务 4：真实 DeepSeek 回放、可恢复输出与成本计量

**文件：**
- 创建：`src/replay/deepseek-predictor.ts`
- 创建：`src/replay/generation-journal.ts`
- 修改：`src/replay/engine.ts`
- 修改：`src/replay/report.ts`
- 修改：`tests/replay-engine.test.ts`
- 创建：`tests/replay-deepseek.test.ts`
- 修改：`scripts/run-walk-forward.ts`

1. 写 RED：预测 prompt 不含 outcome/未来状态；同轮三家并行但下一轮等待历史更新；成功输出先 fsync，再供引擎采用；恢复时合法键不得再次联网；报告保留实际 token/cache/尝试统计和 `backtested`。
2. 将样本量改为命令行参数，冻结 1000 回合来源；先运行 20 回合/60 次真实 DeepSeek 校准，保存正式日志和校准报告。
3. 以实际 cache miss/hit、completion tokens 和 DeepSeek 余额前后差估算主回放与全部消融预算；在终端报告后，仅当预计总额不超过余额安全垫时继续。
4. 恢复同一日志扩展至 1000 回合；不把回放批量写入旧 ScoreBook，除非新栈部署与 gas 预算明确支持，未写入须如实披露。

### 任务 5：四组真实消融与统计

**文件：**
- 修改：`src/replay/ablation.ts`
- 修改：`tests/replay-ablation.test.ts`
- 修改：`scripts/run-ablation.ts`

1. 写 RED：异步 predictor 可注入；actual 组逐项复用主回放概率且不发请求；none/random/counterfactual 各自只暴露允许输入；每个合法键可恢复。
2. 保留双侧配对置换检验、轮次聚类、Holm 校正、Wilson 区间与敏感性指标，报告 provider 改为 DeepSeek 并披露实际各组 n。
3. 预算允许则三组对照均跑满 1000 回合；不足时按用户优先级缩减消融并在标题、表格、限制中标注实际样本量，禁止补齐或外推数字。

### 任务 6：新栈部署、链上元数据验证与最终交付

**文件：**
- 修改：`scripts/deploy-arc-testnet.ts`
- 修改：`scripts/run-agent-e2e.ts`
- 修改：`deployments/arc-testnet.json`
- 创建：`reports/arc-agent-count-*.{json,md}`
- 创建：`reports/arc-walk-forward-deepseek-*.{json,md}`
- 创建：`reports/arc-ablation-deepseek-*.{json,md}`
- 修改：`README.md`
- 修改：`docs/plans/2026-09-05-pitch.md`

1. 编译后对新部署做保守 gas 估算，确认累计链上成本小于 3 USDC；不覆盖无法与新 ABI 兼容的旧地址证据。
2. 用 DeepSeek 完成一轮链上预测，读回 `modelId/promptHash/schemaHash/providerConfigHash/attemptCount`，核对本地审计日志的首个合法输出与尝试次数。
3. 查询部署者链上余额前后差、DeepSeek 余额前后差，区分 gas、资金移动/锁定与模型消费。
4. 运行 `npm test`、`npm run typecheck`、`forge fmt --check`、`forge test -vv`、`npm run contracts:build`；重读规格 7.0.5、11.2.5、11.2.6 对照全部硬约束。
5. 最终中文摘要列出 provider 切换、不可择优测试、ownerOf 证据、校准与预算、主回放/消融表、两类实际花费及所有未验证路径。
