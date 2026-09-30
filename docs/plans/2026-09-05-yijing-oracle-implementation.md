# 易经预言合约实现计划

> **供执行者：** 必须使用 `executing-plans` 子技能逐项执行本计划。

**目标：** 按 `2026-09-05-yijing-oracle-design.md` 实现 Solidity 0.8.30 核心合约、结算数学、起卦、谓词与两类 resolver，并以 Foundry 测试验证。

**架构：** `DivinationRegistry` 管理 commit-reveal、轮次状态及提问者的卦金/保证金；`PredictionBook` 统一编排谓词、倍率、双边资金预留与结算；每位易者使用独立 `DivinerVault`。纯数学和六爻逻辑放入库，`ScoreBook` 记录 Brier 与 Wilson 区间，resolver 只负责确定结果。每条预测由保证金预留 `m·F` 的最大正收益、由金库预留 `3·m·F` 的最大负收益；未决时两边均不释放。

**技术栈：** Solidity 0.8.30、Foundry 1.8.1、Arc ERC-20 USDC（6 位）、自包含测试工具（不新增外部依赖）。

---

### 任务 1：结算与风险数学

**文件：**
- 创建：`contracts/src/lib/SettlementMath.sol`
- 创建：`contracts/src/lib/RiskMath.sol`
- 创建：`contracts/test/SettlementMath.t.sol`
- 创建：`contracts/test/RiskMath.t.sol`

1. 先写精确端点、向零舍入、恰当性全区间扫描、单调/对称/最大安全输入测试。
2. 运行 `forge test --match-path test/SettlementMath.t.sol -vv`，确认因库缺失而 RED。
3. 严格按规格中的有符号“先乘后除”表达式实现 `deltaFromDistance` 和受 `[100,9900]` 约束的 `scoreDelta`。
4. 先写 Beta(1,1) 后验 + 偶赔率 Kelly 风险比例测试，确认 RED，再实现 `RiskMath`。
5. 分别运行两个定向测试，确认 GREEN。

### 任务 2：六爻与文王序

**文件：**
- 创建：`contracts/src/lib/Hexagram.sol`
- 创建：`contracts/test/Hexagram.t.sol`

1. 写 18-bit 三钱派生、初爻最低位、动爻翻转以及乾/坤/屯/蒙/既济/未济查表测试。
2. 运行定向测试确认 RED。
3. 实现 64 项二进制索引到文王序查表及派生函数。
4. 运行定向测试确认 GREEN。

### 任务 3：起卦与托管

**文件：**
- 创建：`contracts/src/interfaces/IERC20.sol`
- 创建：`contracts/src/lib/SafeERC20.sol`
- 创建：`contracts/src/DivinationRegistry.sol`
- 创建：`contracts/test/DivinationRegistry.t.sol`
- 创建：`contracts/test/support/TestBase.sol`
- 创建：`contracts/test/support/MockERC20.sol`

1. 写 commitment 域分离、等待块、揭示窗口、历史哈希、错盐/错发送者、超时弃卦和状态推进测试。
2. 运行定向测试确认 RED。
3. 实现只用块高的 commit/reveal/forfeit、EIP-2935 回退读取、卦金与保证金托管。
4. 运行定向测试确认 GREEN。

### 任务 4：谓词、计分与金库

**文件：**
- 创建：`contracts/src/interfaces/IResolver.sol`
- 创建：`contracts/src/interfaces/IReputationRegistry.sol`
- 创建：`contracts/src/PredicateRegistry.sol`
- 创建：`contracts/src/ScoreBook.sol`
- 创建：`contracts/src/DivinerVault.sol`
- 创建：`contracts/test/PredicateRegistry.t.sol`
- 创建：`contracts/test/ScoreBook.t.sol`
- 创建：`contracts/test/DivinerVault.t.sol`

1. 先写白名单/可控谓词禁押、Brier/未决惩罚/Wilson、预留/赔付/永久封存测试并逐一确认 RED。
2. 实现最小权限边界和状态机。
3. 逐个定向测试确认 GREEN。

### 任务 5：Resolver

**文件：**
- 创建：`contracts/src/MutualResolver.sol`
- 创建：`contracts/src/UsdcSupplyResolver.sol`
- 创建：`contracts/test/Resolvers.t.sol`

1. 写双方同意、冲突/缺席未决、全程块高截止，以及 USDC 总量首次结算快照测试。
2. 运行定向测试确认 RED。
3. 实现 `IResolver`、双方声明状态机、USDC `totalSupply()` 缓存判定。
4. 运行定向测试确认 GREEN。

### 任务 6：PredictionBook 编排与端到端

**文件：**
- 创建：`contracts/src/PredictionBook.sol`
- 创建：`contracts/test/PredictionBook.t.sol`

1. 写同题约束、概率边界、确定性倍率、保证金 `mF` 与金库 `3mF` 双预留、正负结算、未决永久锁定、可控谓词拒绝测试。
2. 运行定向测试确认 RED。
3. 实现提交与无许可结算编排，使用概率作为 YES 概率，`direction` 只用于胜负统计。
4. 运行定向测试确认 GREEN。

### 任务 7：全量验证

**文件：**
- 仅在测试证据要求时修改：上述文件

1. 运行 `forge fmt --check`；若失败，运行 `forge fmt` 后复查。
2. 运行 `forge test -vv`。
3. 若出现失败，先按 `systematic-debugging` 定位，再补失败测试后修复。
4. 重读 `verification-before-completion`，运行最终 `forge test -vv` 并记录通过数。
5. 当前目录没有 `.git`，因此无法执行计划模板要求的逐步 commit；不得声称已提交。
