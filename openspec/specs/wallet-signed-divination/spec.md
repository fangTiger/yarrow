# wallet-signed-divination Specification

## Purpose
规定浏览器钱包的网络与余额门禁、签名前后的资金透明，以及浏览器产物与秘密的隔离边界。第一期钱包只签署卦金付款，不再涉及立誓、揭示、保证金等押注流程；第二期将改为一次授权额度付款。

## Requirements
### Requirement: 用户钱包承担提问者交易

系统 SHALL 在首次 allowance 不足时使用注入钱包账户签署固定 10.000000 USDC 的 ERC-20 授权，并在每轮只签署立誓提交；服务端 SHALL 使用与受控演示提问者相同的托管账户自动揭示，并使用无许可账户执行结算；浏览器 SHALL 不包含任何私钥、salt、助记词或账户派生入口。

#### Scenario: 完整签名分工

- **WHEN** 用户从“求卦”完成一轮
- **THEN** 稳态只有 `commit` 的发送者为连接钱包
- **AND** 首次授权 10.000000 USDC 可覆盖 18 轮，UI 在签名前明确显示金额与次数
- **AND** `reveal` 的发送者为与连接钱包同地址的服务端托管演示账户，`settle` 由服务端无许可账户发送
- **AND** 三笔预测的发送者分别为三位易者 agent

### Requirement: salt 与自动揭示隔离

系统 SHALL 在服务端内存中生成并保存 salt，公开准备响应、浏览器源码和构建产物均不得包含 salt；commit 回执确认并严格超过目标块后，服务端 SHALL 自动揭示并清除 salt。

#### Scenario: 未来块哈希约束

- **WHEN** 服务端在 commit 前生成 salt
- **THEN** commit 时任何一方都不知道 `blockhash(commitBlock + N)`，服务端持有 salt 不产生结果操纵能力
- **AND** 自动揭示消除提问者选择性不揭示的能力
- **AND** 不受服务端托管的任意钱包在 commit 前被拒绝，不允许先锁资金后暴露无法自动揭示

### Requirement: Arc 网络与钱包状态

系统 SHALL 使用 RainbowKit `ConnectButton` 与 wagmi 自动配置或切换 Chain ID `5042002` 的 Arc Testnet，并显示截断地址、ERC-20 USDC 余额、原生 gas 余额与当前网络。

#### Scenario: 钱包或网络不可用

- **WHEN** 未安装钱包、用户拒绝连接或切网后仍不在 Arc Testnet
- **THEN** 页面显示可执行的中文说明而非原始 RPC 错误

### Requirement: 双精度资金门禁

系统 SHALL 以六位整数计算 ERC-20 卦金与保证金，以十八位整数计算原生 gas，并以 `10^12` 比率仅在展示层换算。

#### Scenario: 任一余额不足

- **WHEN** ERC-20 余额不足以覆盖 `0.050000 + 0.500000 USDC` 或原生余额不足以覆盖预估 gas
- **THEN** 页面分别说明所需金额、尚缺金额，并提供 Circle 水龙头链接

### Requirement: 交易前后透明

系统 SHALL 在每次钱包签名前显示资金用途、卦金、保证金与预估 gas，并在确认后显示交易哈希和 Arcscan 链接。

#### Scenario: 用户拒绝交易

- **WHEN** 钱包返回用户拒签错误
- **THEN** 页面说明具体被取消的步骤、资金未发生该笔变动并提供重试路径

### Requirement: 浏览器公开配置与秘密隔离

系统 SHALL 使用 esbuild 构建 React SPA，并且只把 WalletConnect project id、Arc RPC、Arc chain id 与 Arc Explorer 注入浏览器产物；系统 SHALL 禁止把私钥、助记词、账户派生模块或真实秘密值写入浏览器源码和产物。

#### Scenario: 依赖生产分支字面量

- **WHEN** React、wagmi 或 RainbowKit 的生产构建包含 `process.env.NODE_ENV` 优化分支
- **THEN** 安全测试 MAY 精确允许该非秘密字面量
- **AND** 仍 MUST 禁止 `PRIVATE_KEY`、`privateKey`、`mnemonic`、`viem/accounts`、`privateKeyToAccount` 与 `mnemonicToAccount`

