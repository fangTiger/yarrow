# Arc Testnet 可行性验证套件实施计划

> **执行要求：** 按任务逐项执行本计划，并遵循 `executing-plans` 技能。

**目标：** 建立 Foundry + TypeScript/viem 项目，并交付可复现的 Arc Testnet 只读与交易验证报告。

**架构：** Foundry 编译和测试最小 `ProbeVault`；TypeScript/viem 统一处理只读 RPC、部署、交易编排、状态归类和 JSON/Markdown 报告。交易入口在任何链上写操作前强制校验 `ARC_PRIVATE_KEY` 与 chain ID。

**技术栈：** Solidity 0.8.30、Foundry、TypeScript、Node.js、viem、tsx

---

### 任务 1：建立测试与基础配置

**文件：**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `tests/report.test.ts`
- Create: `tests/history-window.test.ts`
- Create: `tests/readonly-probe.test.ts`

**步骤 1：编写失败测试**

为状态归类、Solidity revert data 解码、Markdown 转义/渲染、EIP-2935 最大有效距离二分和只读地址元数据容错写测试。

**步骤 2：运行并确认测试按预期失败**

运行：`npm test`
预期：FAIL，因为 `src/report.ts`、`src/revert.ts`、`src/history-window.ts` 和 `src/readonly-probe.ts` 尚不存在。

**步骤 3：编写最小实现**

创建上述模块，只实现测试要求的纯函数和依赖注入式 RPC 探测。

**步骤 4：运行并确认测试通过**

运行：`npm test`
预期：PASS

### 任务 2：实现并测试 ProbeVault

**文件：**
- Create: `contracts/foundry.toml`
- Create: `contracts/src/ProbeVault.sol`
- Create: `contracts/test/ProbeVault.t.sol`

**步骤 1：编写失败测试**

先写接收、owner 权限、成功/失败转账、双精度、EIP-2935 和块哈希对比测试。

**步骤 2：运行并确认测试按预期失败**

运行：`cd contracts && forge test -vv`
预期：FAIL，因为 `ProbeVault.sol` 尚不存在；若本机没有 Foundry，记录工具缺失并用 npm `solc` 编译作为替代语法验证。

**步骤 3：编写最小实现**

实现 `receive`、`fallback`、独立转账探针、双精度探针、历史哈希和 `PREVRANDAO` 探针；转账失败不冒泡，返回并记录原始数据。

**步骤 4：运行并确认测试通过**

运行：`cd contracts && forge test -vv`
预期：PASS；Foundry 缺失时运行 `npm run contracts:compile`。

### 任务 3：只读 RPC 探测与真实报告

**文件：**
- Create: `src/arc.ts`
- Create: `src/addresses.ts`
- Create: `scripts/probe-readonly.ts`
- Create: `reports/arc-readonly-<timestamp>.json`
- Create: `reports/arc-readonly-<timestamp>.md`

**步骤 1：编写失败测试**

断言无代码地址、ABI 读取成功、ABI 读取 revert 和“官方未找到”能被区分。

**步骤 2：运行并确认测试按预期失败**

运行：`npm test -- tests/readonly-probe.test.ts`
预期：FAIL，缺少实现。

**步骤 3：编写最小实现**

实现公开 RPC 客户端、地址清单、Pyth Core ETH/USD 与 Pyth Pro 合约读取和双格式报告输出，不访问任何私钥。

**步骤 4：运行并确认测试通过**

运行：`npm test && npm run probe:readonly`
预期：单测 PASS，并生成包含真实 chain ID、块高、代码大小与价格可用性判定的报告。

### 任务 4：部署与逐项交易执行器

**文件：**
- Create: `src/artifact.ts`
- Create: `src/transaction-probe.ts`
- Create: `scripts/run-arc-probe.ts`

**步骤 1：编写失败测试**

测试私钥缺失时在创建 wallet client 前终止、fresh 地址前置条件、receipt 回滚、EIP-2935 内部回滚、gas 预算、五块 `PREVRANDAO` 采样、八项报告兜底，以及事件结果到 `PASS/REVERT/FAIL` 的映射。

**步骤 2：运行并确认测试按预期失败**

运行：`npm test`
预期：FAIL，交易执行模块尚不存在。

**步骤 3：编写最小实现**

读取 Foundry artifact，部署合约并按固定顺序执行 8 类探针；所有日志使用中文，报告保存到 `reports/arc-probe-<timestamp>.{json,md}`。

**步骤 4：运行并确认测试通过**

运行：`npm test && npm run typecheck`
预期：PASS。没有 `ARC_PRIVATE_KEY` 时只验证脚本安全退出，不发送交易。

### 任务 5：文档与最终验证

**文件：**
- Create: `README.md`

**步骤 1：编写文档检查**

检查 README 必须包含水龙头、环境变量、只读命令、交易命令、报告字段和安全提示。

**步骤 2：运行最终验证**

运行：`npm test`
预期：PASS

运行：`npm run typecheck`
预期：PASS

运行：`npm run contracts:compile`
预期：PASS

运行：`npm run probe:readonly`
预期：生成真实只读报告；Chainlink/Pyth 判定来自官方地址发现结果与链上调用，不作推测。

运行：`test -z "$ARC_PRIVATE_KEY" && npm run probe:arc`
预期：在任何交易前以中文错误退出，说明必须由用户设置 `ARC_PRIVATE_KEY`。
