# 永久封存与卦象消融实验实施计划

> **供执行者：** 必须使用 `executing-plans`、`test-driven-development` 与 `verification-before-completion` 逐项执行本计划。

**目标：** 在 Arc Testnet 通过真实评分结算使一位演示易者破产并永久封存，同时用同一批 101 个历史轮次完成四条件卦象消融实验。

**架构：** 封存演示使用独立的单易者合约栈，避免改变现有三易者主实验及其链上回放账本；演示只使用不可由提问者改写结果的 `UsdcSupplyResolver`，由一次正确预热提高倍率，再由连续错误结算使 Brier 恶化、倍率降至下限并穿越生存线。前端保留主栈作为首页现场数据源，并额外只读演示栈的 `SEALED` 金库、ScoreBook 最后一条记录与对应链上卦象。消融实验复用既有 101 个冻结历史轮次，在相同问题、命题、结果和初始资金下比较真实卦象、无卦象、独立随机卦象及互补卦象；显著性按轮次聚类做配对置换检验。

**技术栈：** Solidity 0.8.30、Foundry、TypeScript 5.9、Node.js 测试运行器、Viem、Arc Testnet、原生 TypeScript 前端。

**环境限制：** 当前目录没有 `.git`，无法创建 worktree 或逐步 commit；所有链上写操作必须在本地测试、模拟调用与 4 USDC 保守预算预检后执行，报告不得包含任何私钥。

---

### 任务 1：封死 SEALED 后再次应卦路径

**文件：**
- 修改：`contracts/test/DivinerVault.t.sol`
- 修改：`contracts/test/PredictionBook.t.sol`
- 修改：`contracts/src/DivinerVault.sol`

1. 修改永久封存测试：强制转入代币后，再次 `reserve` 必须以 `VaultSealed` 回滚，而不是返回 `false`。
2. 扩展 PredictionBook 测试：首次因低于生存线被拒并封存后，第二次应卦必须透传 `VaultSealed`，且不得消费提问者保证金。
3. 运行两个定向测试并观察 RED，失败原因必须是当前 SEALED 分支返回 `false`。
4. 把 `DivinerVault.reserve` 的既有 SEALED 分支改为 `revert VaultSealed()`；首次从 ACTIVE 穿越生存线仍返回 `false` 并完成封存。
5. 重跑定向测试与全量 Foundry 测试，确认 GREEN。

### 任务 2：确定性封存轨迹与可恢复报告骨架

**文件：**
- 创建：`src/seal-demo.ts`
- 创建：`tests/seal-demo.test.ts`
- 创建：`scripts/run-seal-demo.ts`
- 修改：`package.json`

1. 先写纯函数 RED 测试，固定参数 `F=0.005000`、`m_min=1`、`m_max=5`、初始金库 `0.130000`：一次 99% 正确预热后倍率升至 5，随后五次 99% 错误预测使倍率降至 1，最终余额低于 `3·m_min·F=0.015000`。
2. 测试报告必须逐笔保留交易哈希、块高、gas、成本、轮次、概率、倍率、Brier、结算前后余额与状态；JSON bigint 必须安全序列化。
3. 实现最小纯函数与中文 Markdown 报告渲染。
4. 实现可重入执行脚本：每笔成功或回滚交易后原子写入 `deployments/arc-testnet-seal-demo.json` 与 `reports/arc-seal-demo-*.{json,md}`；已存在的链上步骤只读核验后复用，不重复付费。
5. 脚本部署独立 `PredicateRegistry`、`ScoreBook`、`DivinationRegistry`、`PredictionBook`、`DivinerVault`、`UsdcSupplyResolver`，完成配置、注资及六轮真实 commit/reveal/submit/settle。
6. 封存后发送一笔预期回滚的再次应卦交易；正式 `deposit` 注资路径也发送预期回滚交易。再强制转入一个 USDC 最小单位，证明状态仍为 SEALED 且再次应卦仍回滚。
7. 只读核对 ScoreBook 历史、最后一卦、Sealed 事件、金库余额、永久状态与完整交易回执；累计保守预算必须小于 4 USDC。

### 任务 3：前端读取真实墓碑

**文件：**
- 修改：`src/frontend/data.ts`
- 修改：`src/frontend/domain.ts`
- 修改：`src/frontend/abis.ts`
- 修改：`tests/frontend-data.test.ts`
- 修改：`tests/frontend-domain.test.ts`
- 修改：`web/app.ts`

1. 先写 RED：墓碑必须来自链上 `SEALED` 状态，包含演示栈地址、最后一条 ScoreBook 记录及该记录 roundId 对应的本卦/之卦；ACTIVE 或历史为空均不得伪造墓碑。
2. 增加独立演示清单读取；文件不存在时保持现有真实空态，文件存在时逐项从 Arc Testnet 复核，不相信本地清单中的终态字段。
3. 墓碑展示遗留金库、卦历、最后一卦名称、最后 Brier 与演示合约地址；保持现有墨色墓域视觉语言与移动端布局。
4. 运行前端定向测试、构建与类型检查。

### 任务 4：四条件配对消融实验

**文件：**
- 创建：`src/replay/ablation.ts`
- 创建：`tests/replay-ablation.test.ts`
- 创建：`scripts/run-ablation.ts`
- 修改：`package.json`

1. 先写 RED：四组必须共享完全相同的 101 个 roundId、命题和 outcome；无卦象组的 provider 输入不得含六爻、卦号或截止块哈希；随机卦象必须仅由固定实验种子与 replayId 派生；同问题不同卦象必须使用保证不同的互补六爻。
2. 实现显式条件化的确定性 mock。四组只改变卦象暴露方式，概率仍由 mock 哈希生成，倍率和资金变化继续由确定性风险函数计算。
3. 每组输出 101 回合/303 条预测的总体与分易者 n、命中率、平均 Brier、Wilson 95%。
4. 对主组与三个对照组的逐轮平均 Brier、逐轮命中率做双侧配对置换检验，并对三项计划比较做 Holm 校正；报告方法、理由、效应量和显著性阈值。
5. 对真实卦象与互补卦象额外输出概率变化率、平均绝对变化、方向翻转率和有无一致方向偏移。
6. 报告明确：当前确定性 mock 只验证流水线及统计实现，不能推断真实模型是否利用卦象；真实 provider 可用后必须原样重跑。

### 任务 5：文档、链上执行与最终验证

**文件：**
- 修改：`README.md`
- 修改：`docs/plans/2026-09-05-yijing-oracle-design.md`
- 创建：`deployments/arc-testnet-seal-demo.json`
- 创建：`reports/arc-seal-demo-*.json`
- 创建：`reports/arc-seal-demo-*.md`
- 创建：`reports/arc-ablation-*.json`
- 创建：`reports/arc-ablation-*.md`

1. 本地先运行全量 Foundry、Node 测试、typecheck 和前端构建。
2. 只读预检链、账户余额、部署地址、gas price 与预算；随后执行封存脚本，任何模拟异常立即停止，禁止用管理调用替代自然结算。
3. 运行消融脚本并核对 JSON 与 Markdown 数字一致。
4. 更新设计文档第 9、14、15.7、16 节与 README，写入真实证据和 mock 限制。
5. 启动只读前端，调用 `/api/oracle` 验证 graves 非空，再用 Playwright 检查墓碑文本与页面截图。
6. 最后重新运行全量测试、类型检查、合约编译、前端构建、链上只读复核；输出逐笔哈希、总成本、剩余余额及未验证项。
