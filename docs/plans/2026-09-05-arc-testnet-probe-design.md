# Arc Testnet 可行性验证套件设计

## 目标与边界

本套件用于在 ETHGlobal 开发开始前验证 Arc Testnet 的关键运行契约。只读探测必须在没有私钥时独立运行；交易探测只有在进程环境显式提供 `ARC_PRIVATE_KEY` 后才能启动。任何链上调用失败都保留原始错误并归类为 `PASS`、`FAIL` 或 `REVERT`，不把“有代码”误报成“功能可用”。

当前目录不是 Git 仓库，也没有现成 Foundry/Node 项目，因此无法创建隔离 worktree 或提交设计文档。本实现只新增本套件文件，并保留已有文档。

## 方案比较与选择

可选方案一是全部使用 Foundry script：合约与广播统一，但复杂 JSON/Markdown 报告、动态地址元数据探测和 RPC 错误保真处理比较笨重。方案二是全部使用 TypeScript 并用 `solc` 编译：报告方便，但不能交付规范的 Foundry 项目。最终选择混合边界清晰的方案：Foundry 负责 Solidity 项目、合约单测与产物；TypeScript/viem 统一负责只读 RPC、部署、逐项调用和双格式报告。两种执行入口共享同一链配置和报告模型，不混用两套广播逻辑。

## 组件与数据流

`contracts/src/ProbeVault.sol` 提供接收入口、两类转账、清空余额、双精度余额、EIP-2935、`PREVRANDAO` 和 `blockhash` 对比探针。转账探针使用低级 `call` 捕获内部失败，并通过事件返回成功标志与原始 revert data；只有部署者可以转出资金。TypeScript 执行器先验证链 ID、账户类型和包含保守 gas 预算的余额门槛，部署后依次发送 receive/fallback、已有 EOA、新账户、双精度、历史哈希、跨五块随机数和清空余额探针，最后写出同一份结构化数据的 JSON 与 Markdown。部署后的 RPC 流程即使中断，也会补齐八项失败结果并落盘。

`scripts/probe-readonly.ts` 只创建 public client，不读取私钥。地址清单区分“用户已确认”“官方文档”“非官方候选”和“官方未找到”。它对每个已知地址调用 `eth_getCode`，并按 ABI 能力尝试 `name`、`symbol`、`version`、`decimals`、`owner` 等只读字段。Pyth Core 读取 ETH/USD price ID 与严格新鲜度，Pyth Pro 复核官方验证合约和验证费，但在没有 WebSocket 签名 payload 时明确跳过端到端验证；Chainlink 在没有官方 Arc Data Feed 地址时明确记为“未找到”，不会猜地址。ERC-8183 社区候选单独探测并保留来源等级。

## 错误处理与判定

RPC 不可达、链 ID 不符、地址前置条件不满足、交易 receipt 失败、内部低级调用失败分别保存为独立结果。预期可能失败的“新账户转账”和“完全清空”若低级调用返回失败，状态为 `REVERT` 而不是 `PASS`，同时报告可解码的 `Error(string)`、`Panic(uint256)` 或原始十六进制数据。对预期事实的总体验证由 `expected` 和 `observed` 分开表达，避免把预期写成观测结果。

EIP-2935 窗口探测从 `min(8191, blockNumber - 1)` 开始，先检查边界，再用单调区间二分寻找最大的非零距离；结果同时记录最大有效距离及其相邻无效距离。时间顺序仅使用块高，不依赖可能重复的区块时间戳。

## 测试策略

TypeScript 先为状态归类、revert 解码、Markdown 渲染、二分窗口和只读地址探测写失败测试，再做最小实现。Solidity 使用不依赖 `forge-std` 的 Foundry 测试，覆盖 owner 限制、接收入口、低级转账结果、双精度换算、EIP-2935 调用编码以及上一块哈希对比。最终运行 Node 单测、TypeScript 类型检查、Solidity 编译/测试（若本机有 Foundry）和真实 Arc 只读探测；缺失工具必须在交付中明确说明。
