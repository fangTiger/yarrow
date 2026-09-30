# Arc Testnet Pyth 与历史窗口增量实施计划

> **执行要求：** 按任务逐项执行本计划，并遵循 `executing-plans` 技能。

**目标：** 实测 Pyth Core pull 更新、历史价格验证与 ProbeVault 的 EIP-2935 精确边界。

**架构：** 沿用现有 TypeScript/viem 报告框架；Pyth 数据仅从官方 Hermes 获取，链上写入前先调用 `getUpdateFee` 并模拟交易。EIP-2935 探测把搜索上限扩到 8191 之外，以相邻有效/回滚证据确定真实边界。

**技术栈：** Solidity 0.8.30、Foundry 1.8.1、TypeScript、Node.js、viem、Hermes REST API

---

### 任务 1：修正 EIP-2935 边界探测

**文件：**
- Modify: `tests/transaction-probe.test.ts`
- Modify: `src/transaction-probe.ts`
- Modify: `scripts/run-arc-probe.ts`

**步骤：**
1. 先增加“搜索上限必须跨过 8191”和“历史合约内部回滚作为窗口无效边界”的失败测试。
2. 运行定向测试，确认因缺少新辅助函数而失败。
3. 增加最小辅助函数，并让交易脚本在 16384 距离内二分。
4. 运行定向测试、全量 Node 测试与类型检查。

### 任务 2：记录真实边界证据

**文件：**
- Modify: `reports/arc-probe-2026-09-04T17-57-08-597Z.json`
- Modify: `reports/arc-probe-2026-09-04T17-57-08-597Z.md`

**步骤：**
1. 在固定块高 60448967 直接读取 EIP-2935 合约的 8190、8191、8192、8193 距离。
2. 记录 8191 非零、8192 起回滚的相邻边界证据。

### 任务 3：Pyth pull 与历史更新

**文件：**
- Create: `reports/arc-pyth-<timestamp>.json`
- Create: `reports/arc-pyth-<timestamp>.md`

**步骤：**
1. 从 Hermes 最新端点获取 ETH/USD 签名更新。
2. 调用 `getUpdateFee`、模拟并发送 `updatePriceFeeds`，记录 receipt gas、费用和交易哈希。
3. 调用 `getPriceNoOlderThan(60)`，记录价格、置信区间、指数和发布时间。
4. 从时间戳端点获取一小时前的历史更新，以 `parsePriceFeedUpdates` 验证固定时间价格并发送验证交易。
5. 若 Hermes 拒绝请求，原样记录 HTTP 状态与官方鉴权变化，不发送伪造或非官方 payload。

### 任务 4：最终验证

**步骤：**
1. 运行 `forge test -vv`。
2. 运行 `npm test`、`npm run typecheck` 与 `npm run contracts:compile`。
3. 复核报告不含私钥，核对链上交易 receipt 和账户剩余余额。
