# 易经 Agent 层实现计划

> **供执行者：** 必须按 `test-driven-development` 的 RED-GREEN-REFACTOR 顺序逐项执行。

**目标：** 实现中立命题编译器、三位可自我校准的易者、可插拔 Anthropic/mock provider、完整卦辞语料、可审计链上提交，以及 mock provider 驱动的 Arc Testnet 生命周期。

**架构：** 命题编译与概率估计分成两个不可互相覆盖的阶段。编译器以本地谓词说明定位候选，但每次从 `PredicateRegistry` 读取链上配置并拒绝提问者可控项；确定性 C5 预算器生成截止块。三位易者只读取同一冻结命题、完整卦象和各自历史战绩，输出通过 JSON Schema 校验后立即由各自账户签名提交，倍率仍由合约计算。

**技术栈：** TypeScript 5.9、Node.js 测试运行器、Viem、`@anthropic-ai/sdk`、Ajv、Solidity 0.8.30、Foundry、Arc Testnet。

---

### 任务 1：C5 截止块与链上审计字段

**文件：**
- 修改：`tests/yijing-deployment.test.ts`
- 修改：`src/yijing-deployment.ts`
- 修改：`contracts/test/PredictionBook.t.sol`
- 修改：`contracts/src/PredictionBook.sol`
- 修改：`scripts/run-arc-e2e.ts`

1. 先写 C5 精确公式测试：`交易数 × 每笔块预算 + ceil(LLM 毫秒 / 510ms) + 安全余量`，覆盖非法输入。
2. 运行 Node 定向测试，确认旧 `plannedDeadline` 因缺少推理延迟参数而 RED。
3. 最小实现确定性预算器并确认 GREEN。
4. 先写 Solidity 测试，要求 `Prediction` 保存非零 `schemaHash`，零值必须在任何预留前回滚。
5. 运行 Foundry 定向测试确认 RED；修改 `PredictionRequest/Prediction` 与校验、存储后确认 GREEN。
6. 更新旧端到端脚本的结构参数，使其能通过新 ABI 编译，但不执行旧脚本。

### 任务 2：结构化 provider 与凭据失败路径

**文件：**
- 修改：`package.json`
- 修改：`package-lock.json`
- 创建：`src/agent/schemas.ts`
- 创建：`src/agent/provider.ts`
- 创建：`src/agent/anthropic-provider.ts`
- 创建：`tests/agent-provider.test.ts`

1. 安装官方 SDK 与 Ajv。
2. 先写测试：显式 mock 可确定性返回；未配置凭据时真实 provider 构造立即给出中文配置指引；请求只含 `claude-opus-5`、`max_tokens: 16000`、adaptive thinking、`output_config.effort/format`，不含任何采样参数、`budget_tokens`、旧 `output_format` 或 assistant prefill。
3. 运行测试确认 RED。
4. 用 SDK 导出类型实现 provider；异常按 `RateLimitError`、认证、连接、通用 API 异常的具体到宽泛顺序处理，禁止错误字符串匹配。
5. 运行定向测试与 typecheck 确认 GREEN。

### 任务 3：六十四卦语料与三位易者

**文件：**
- 创建：`src/agent/zhouyi-corpus.ts`
- 创建：`src/agent/diviners.ts`
- 创建：`tests/diviners.test.ts`
- 创建：`THIRD_PARTY_NOTICES.md`

1. 引入含 64 卦卦辞与每卦六爻辞的中文公共领域语料，并记录来源、许可证与项目方最终校勘责任。
2. 先写完整性测试：文王序 1–64 连续、名称/卦辞非空、每卦至少六条爻辞、乾坤特殊用辞不影响六爻索引。
3. 写三位易者输入与 prompt 测试：完整六爻、本卦/之卦序号和名称、变爻、对应卦辞/爻辞、各自历史战绩、同一冻结命题均可见；人格差异仅在解释方法，不允许选择或修改命题。
4. 确认 RED 后实现三个带 ephemeral cache control 的稳定 system prompt，并确认概率严格在 `[100,9900]`。

### 任务 4：中立 PropositionCompiler

**文件：**
- 创建：`src/agent/proposition-compiler.ts`
- 创建：`tests/proposition-compiler.test.ts`

1. 先写测试：逐项读取链上 Registry 配置；禁用、地层、零 resolver 或 `querentControllable=true` 均不进入候选；provider 即使回传可控谓词也必须拒绝；输出参数 ABI 编码正确并通过 schema 校验。
2. 写测试证明 compiler 与三位易者是不同调用，易者结果不能改变 `predicateId/params/deadlineBlock`。
3. 确认 RED 后实现最小编译器与 Viem Registry reader，最终截止块只由 C5 预算器生成。
4. 运行定向测试与 typecheck 确认 GREEN。

### 任务 5：立即签名提交的 Agent 编排器

**文件：**
- 创建：`src/agent/orchestrator.ts`
- 创建：`src/agent/onchain.ts`
- 创建：`tests/agent-orchestrator.test.ts`

1. 先写事件顺序测试：编译命题一次；每位易者 provider 只调用一次；其输出返回后下一动作就是对应签名提交；三个请求使用完全相同命题；编排器不接收或计算倍率。
2. 写失败测试：schema/概率越界、链上提交失败或重复结果均立即终止，禁止自动重新推理或择优。
3. 确认 RED 后实现编排器与 Viem 提交适配器；哈希使用确定性规范化 JSON/UTF-8 后 `keccak256`。
4. 运行定向测试与 typecheck 确认 GREEN。

### 任务 6：Mock Agent 的 Arc Testnet 端到端

**文件：**
- 创建：`scripts/deploy-agent-stack.ts`
- 创建：`scripts/run-agent-e2e.ts`
- 修改：`package.json`
- 创建：`reports/arc-agent-e2e-<timestamp>.json`
- 创建：`reports/arc-agent-e2e-<timestamp>.md`

1. 先为报告结构与预算保护写测试，要求总链上预算小于 3 USDC，日志不得含私钥。
2. 部署含 `schemaHash` 的新合约栈或最小必要组件，使用独立清单保留上一轮证据；每库只注资满足两轮验证的最小金额。
3. 用显式 `mock` provider 跑：commit/reveal 成卦 → 中立编译 USDC 总量命题 → 三家独立概率 → 每份结果立即签名提交 → 第三方无许可结算。
4. 在修正后的 C5 预算下真实跑双方冲突 → 三家同题 → 未决永久锁定，记录交易哈希、块高、gas 和状态。
5. 若网络或链状态失败，保留 FAIL 报告，禁止把再次运行当作择优；只有明确修复后的正当复跑可继续。

### 任务 7：最终验证与交付

**文件：**
- 仅在验证发现问题时修改上述文件。

1. 运行所有 Node 测试与 `npm run typecheck`。
2. 运行 `forge fmt --check`、`forge test -vv` 与 Solidity 编译。
3. 运行无凭据真实 provider 启动检查，确认在任何网络调用前给出中文配置指引。
4. 重读 `verification-before-completion` 并重跑最终验证。
5. 列出真实 provider 未执行的网络、认证、限流与真实结构化响应路径；当前目录无 `.git`，不得声称已提交。
