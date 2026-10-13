# Arc Testnet 可行性验证套件（旧版，已归档）

> 本文是项目早期参加 ETHGlobal 时的测试网可行性验证说明，描述的是旧方向。当前产品说明见仓库根目录的 [README.zh-CN.md](../../README.zh-CN.md)。

这是 ETHGlobal 项目的赛前硬门槛验证。套件包含一个最小 Foundry 合约、无需私钥的链上只读探测，以及一条命令完成的部署与 8 项真实行为验证。所有观测结果都会同时写成 JSON 和 Markdown；失败或回滚不会被伪装成通过。

## 环境要求

- Node.js 22 或更高版本
- npm
- Foundry（运行 `forge test` 时需要；部署命令自带锁定为 0.8.30 的 `solc-js` 编译入口）

安装 Node 依赖：

```bash
npm ci
```

## 启动现场演示

前端采用 React、wagmi、RainbowKit 与 viem，由 esbuild 打包；保留「夜の神社をターミナルで見る」视觉语言与 6.0 秒起卦仪式，入口改为問／賭双轨。

构建并启动本地演示服务：

```bash
npm run frontend:dev
```

然后打开 `http://127.0.0.1:4173`。如已完成构建，也可以只运行 `npm run frontend:start`；单独构建使用 `npm run frontend:build`。

用户先写下原问题，由与三位易者分离的中立分类器判断「未来是否会出现单一、可观察的答案」并直接进入对应轨道。事项主题也自动采用分类结果；解读旁保留修改入口，修改后复用原付款与起卦区块重算。分类器不读取卦象、易者输出、概率、押注额或链上候选谓词。

- **問轨**：适用于「我该不该辞职」等没有唯一未来答案的问题。无需连接钱包，0 签名、0 交易、0 gas；`/api/question/cast` 只读取公开区块哈希，与规范化原问题共同派生可复算六爻，再由三位易者分别解读。
- **賭轨**：适用于「今天之内会不会收到那条消息」等有时间边界和可观察结果的问题。保留既有钱包 commit 与三家押钱流程，但命题保持用户原话，到期由提问者见证，经 `AttestedResolver` / `MutualResolver` 进入结算；见证冲突或缺席成为未决之卦。
- **天层**：USDC 总量与 agent 计数不再出现在用户主流程，只在卦历与数据页作为 1000 回合 backtested、BSS、Wilson 95% 区间和配对置换检验的机制证据。

页面的 `/api/oracle` 接口仍只创建 viem public client，不会签名或发送交易；它在运行时读取 Arc Testnet，并把人层现场记录与天层 `backtested・非现场` 记录分开展示。

同源的 `/api/demo/*` 接口只监听 `127.0.0.1`，且其带签名能力的賭轨驱动按需延迟初始化，問轨启动与请求不会触发它。賭轨连接钱包首次把 10.000000 USDC 固定额度授权给现有登记合约（可覆盖 18 轮），稳态每卦只签一笔 `commit`；salt 只保存在 Node 进程内，服务端使用同地址受控演示账户自动 `reveal`，再代表三位易者预测并走人层结算。浏览器包没有私钥、salt、环境变量入口或账户派生材料。写接口必须携带严格匹配当前 Host 的 `Origin`，只接受 `application/json`，请求体上限为 8 KiB。

演示模式在每轮开始前冻结：

- `mock` 是默认值，使用确定性 mock provider，模型费用为零，适合开发和验收；
- `live` 必须在页面二次确认后才能开始，调用 DeepSeek 且不自动重试。

现场演示优先用短周期賭轨问题，例如「今天之内会不会收到那条消息」。本周、本月等长周期问题会如实停在等待应验，不会用几十个区块伪造已经发生的人间事实；已结算的人层轮次可从卦历展示实际赔付。

可重复的完整排练命令：

```bash
npm run demo:rehearse
```

它会在 mock 模式下以真人节奏走完一卦三家与服务端三笔结算，断言首次两次钱包确认、稳态一次钱包确认、七段耗时、40 秒耗时上限及 1.5 USDC 链上 gas 上限。若只需释放一次中断演示，可运行 `npm run demo:recover -- --round-id <轮次> --confirm`；该命令只接受显式目标，目标在启动时尚未到期会立即拒绝，且不会调用模型。未揭示轮次到期后按合约罚没，已揭示但法定人数不足的轮次由 `cancelIncompleteRound` 退回剩余托管，已满足法定人数则必须继续无许可结算。构建后可用 `npm run frontend:secrets` 扫描浏览器源码与产物；扫描失败只报告文件和泄漏类别，不回显秘密值。

数据来源按画面明确区分：

- p、m、轮次、卦象、评分摘要和金库状态来自 Arc Testnet；
- 自然语言解读来自与当前合约及轮次匹配的本地 agent 审计日志，并用链上概率再次对齐；
- 逐轮 bankroll 曲线来自确定性 walk-forward 报告，标为 `backtested`，其样本量、平均 Brier 与 Wilson 95% 区间会和链上 ScoreBook 交叉核对；
- 墓域额外读取 `deployments/arc-testnet-seal-demo.json` 指向的独立演示栈，并再次从链上核对 `SEALED`、金库、卦历和最后一卦；文件缺失、状态非封存或历史为空时仍显示真实空态，不生成示意墓碑。

Arc 单块实测约 0.51 秒；`waitBlocks=8` 的自动揭示等待约 4.1 秒。mock 的命题截止预算把三笔预测、校准与 60 块总交互余量去重计算，最终为 64 块、约 32.6 秒，而非旧版额外叠加 300 块。底层仪式演出 6 秒，与链上流程并行。页面不会在 RPC 失败时用静态假数据填补结果。

## 永久封存演示

运行以下命令会复用已完成的封存清单；只有清单不存在时才部署独立的单易者演示栈并发送交易：

```bash
npm run e2e:seal
```

该流程用一次正确结算预热倍率，再以五次由 `UsdcSupplyResolver` 真实判定的错误预测自然扣减金库。演示易者最终由 `0.018182` USDC 跌至 `0.003580` USDC，穿越 `3·m_min·F=0.015000` USDC 生存线而进入 `SEALED`；没有管理函数写状态。随后再次应卦、正式注资均以 `VaultSealed()` 回滚，强制转入一个 ERC-20 最小单位后状态仍不可复活。

完整逐笔交易、回滚回执、块高、gas 与余额见：

- `deployments/arc-testnet-seal-demo.json`
- `reports/arc-seal-demo-2026-09-04T23-03-53-894Z.json`
- `reports/arc-seal-demo-2026-09-04T23-03-53-894Z.md`

## 卦象消融实验

```bash
npm run replay:ablation
```

该命令复用冻结的 101 个历史轮次，对有真实卦象、无卦象、独立随机卦象、同问题互补卦象四个条件各回放 303 条预测。显著性检验以 101 个轮次为配对聚类单位，使用双侧配对置换检验，并对三项计划比较做 Holm 校正。当前确定性 mock 结果没有显示真实卦象相对无卦象和随机卦象的稳定预测增量；这只验证条件隔离、回放、计分和统计流水线，不能推断真实模型能力。真实 provider 可用后必须用相同冻结样本和方案重跑。

报告见 `reports/arc-ablation-2026-09-04T23-22-15-958Z.{json,md}`。其中“有真实卦象”复用主实验的冻结问题、卦象与结果，但四组概率均由同一个消融 mock 重跑，不直接复制旧主实验概率。

Foundry 项目位于 `contracts/`，RPC 别名 `arc_testnet` 已指向 `https://rpc.testnet.arc.io`：

```bash
cd contracts
forge build
forge test -vv
```

如果机器没有 Foundry，仍可执行 Solidity 0.8.30 编译检查：

```bash
npm run contracts:compile
```

## 先运行无需私钥的只读探测

```bash
npm run probe:readonly
```

该命令只使用公开 JSON-RPC，不读取 `ARC_PRIVATE_KEY`，不会签名或发送交易。它会完成以下检查：

- Pyth 官方 Arc Testnet Core 与 Pyth Pro 合约存在性、可识别信息和 ETH/USD Core 价格读取；
- Pyth `getPriceNoOlderThan` 实时有效期验证；
- Chainlink 官方 Data Feed 地址页是否存在 Arc 条目；
- ERC-8004 IdentityRegistry；
- ERC-8183 官方地址发现，以及明确标注的社区候选地址；
- USDC ERC-20、EIP-2935、Multicall3、Permit2、CREATE2 Factory、GatewayWallet 和 GatewayMinter 的代码存在性与可识别元数据。

报告保存在：

- `reports/arc-readonly-<timestamp>.json`
- `reports/arc-readonly-<timestamp>.md`

## 领取 Arc Testnet USDC

1. 打开 [Circle Faucet](https://faucet.circle.com)。
2. 选择 Arc Testnet。
3. 输入测试账户地址并领取 USDC。
4. 在区块浏览器 `https://testnet.arcscan.app` 确认到账。Arc 使用原生 USDC 支付 gas。

## 设置私钥并运行完整验证

私钥只从当前进程环境读取，不要把它写入仓库、`.env`、命令脚本、测试输出或报告。建议使用专门的测试网账户：

```bash
export ARC_PRIVATE_KEY="0x你的64位十六进制测试网私钥"
npm run probe:arc
```

完成后可从当前 shell 移除变量：

```bash
unset ARC_PRIVATE_KEY
```

`npm run probe:arc` 会编译、部署 `ProbeVault` 并依次执行：

1. 通过 `receive` 和 `fallback` 接收原生 USDC；
2. 向已存在且有余额的部署者 EOA 转账；
3. 向由部署交易哈希确定性派生、且调用前确认零余额/零 nonce/无代码的地址转账；
4. 尝试把合约余额完全清空（实际最后执行，避免影响其余探针）；
5. 对比 `address(this).balance` 与 USDC ERC-20 `balanceOf(this) * 1e12`；
6. 从 8191 距离开始，以二分方式实测 EIP-2935 最大非零历史哈希距离；
7. 在五个不同块高读取 `block.prevrandao`，只有全部为 0 才通过；
8. 对比上一块 `BLOCKHASH` opcode 与 EIP-2935 返回值。

交易报告保存在：

- `reports/arc-probe-<timestamp>.json`
- `reports/arc-probe-<timestamp>.md`

未设置或错误设置 `ARC_PRIVATE_KEY` 时，脚本会在创建任何链上交易前终止。完整交易探测会按实时 `gasPrice` 加上 2,000,000 gas 单位的保守预算检查余额，会消耗测试网 USDC 作为 gas，并会部署一个新的 `ProbeVault`。部署后的 RPC 流程即使中断，也会把未执行项明确补为 `FAIL` 并写出完整八项报告。

## 如何读报告

- `PASS`：该次真实调用满足报告中的预期条件。
- `FAIL`：调用完成但观测值不满足条件，或前置条件/RPC 操作失败。
- `REVERT`：外层交易或合约内部低级调用回滚；报告保留可解码 reason 或原始返回数据。
- `NOT_FOUND`：指定的官方资料没有 Arc Testnet 地址，因此没有猜测地址或执行 `eth_getCode`。
- `SKIP`：必要的上游探测失败，无法诚实执行后续检查。

JSON 中的 `expected` 是判定条件，`observed` 是实际观测，`reason` 是失败/回滚原因，`details` 保留块高、代码大小、余额、哈希等证据。区块相关顺序只使用块高，不使用可能重复的时间戳排序。

## 本次只读实测结论

最新已生成报告位于 `reports/`。本次连接到 Chain ID `5042002`，确认所有用户给定的已知地址均有代码，其中 EIP-2935 合约为 83 字节、USDC ERC-20 `decimals()` 为 6。

价格 feed 的硬门槛结论：

- Pyth 官方 Core 合约 `0x2880aB155794e7179c9eE2e38200202908C17B43` 存在，版本为 `1.4.5-alpha.1`；`getPriceUnsafe` 可读到 ETH/USD 历史值。
- 该历史值在本次探测时已超过合约 60 秒有效期约 9 天，`getPriceNoOlderThan(..., 60)` 实际回滚。因此当前不能把合约内存量值直接当成实时 feed；设计必须实现 Pyth pull update 数据获取与同交易更新/消费流程，并另做有私钥的端到端验证。
- Pyth 官方还列出了 Arc Testnet 的 Pyth Pro 合约 `0xACeA761c27A909d4D3895128EBe6370FDE2dF481`。只读脚本会实测代码与 `verification_fee()`；但官方流程要求从 WebSocket 取得签名更新，再在交易中执行 `verifyUpdate` 和解析。本套件没有数据订阅凭据或签名 payload，因此把该端到端项诚实标为 `SKIP`，不能从 Core 存量值过期推断 Pyth Pro 不可用。
- Chainlink 官方 Data Feed 地址页没有 Arc/Arc Testnet 条目，所以本套件明确报告 `NOT_FOUND`，当前没有可由官方地址复核的 Chainlink push feed。

因此，“无需提交更新即可读取实时价格”的天层条件当前不成立；Pyth Core 只验证到“部署存在、历史值可读”，Pyth Pro 则只验证到“官方验证合约存在”，签名更新实时路径仍是未验证项。

ERC-8004 官方 IdentityRegistry 已确认存在并返回 `AgentIdentity` / `AGENT`。ERC-8183 官方规范与参考仓库没有发布 Arc Testnet 地址；社区候选 `0x0747EEf0706327138c69792bF28Cd525089e4583` 有代码且 `paymentToken()` 指向 Arc USDC，但这不构成官方部署证明。

## 安全说明

- 本套件新增的源码、示例配置和报告不包含私钥或助记词；安全交付前，项目根目录不得保留真实 `.env`。
- 只读脚本不访问私钥。
- 交易脚本不会输出私钥，也不会把私钥写入报告。
- 如果工作区原本已有 `.env`，请将其移出项目并轮换其中出现过的测试网私钥；本套件不会自动读取、覆盖或删除该文件。
- 只在 Arc Testnet 使用专门测试账户；不要复用主网私钥。
