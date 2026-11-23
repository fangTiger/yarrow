## MODIFIED Requirements
### Requirement: 所有起卦先收卦金

系统 MUST 对所有已开放类型的解读（问事、命理、运势）收取 0.05 USDC 卦金，直接转入服务端配置的「三易收款地址」（默认 `0x737301a6A40ea453A877627c409EF5756a395DB9`，可由服务端环境变量覆盖）。付款方式 MUST 二选一：一笔 USDC ERC-20 `transfer`，或一笔原生 USDC 转账。系统 MUST 不依赖 EIP-5792 原子批量，MUST 不要求 ERC-20 授权，MUST 不把卦金转入旧易者金库合约（该合约没有提现功能）。收款地址与金额 MUST 由服务端接口下发，前端不得自行写死。卦金 MUST 在分类与生辰补填之后、起卦或排盘之前完成，服务端 MUST 读取该交易回执，确认交易成功，且其中存在一条自付款人至收款地址的完整匹配转账：由 USDC 合约 `0x3600…0000` 发出、金额恰为 50,000 最小单位（6 位小数）的 `Transfer` 日志；或由系统地址 `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` 发出、金额恰为 50,000,000,000,000,000 最小单位（18 位小数）的 `Transfer` 日志。服务端 MUST 先匹配 ERC-20 日志，再匹配原生日志，每笔交易只认一条，MUST 不把多条日志的金额相加。付款人 MUST 以日志中的 `from` 判断。系统 MUST 不创建任何押注，界面 MUST 不使用押钱、赔付、封存等表述。

#### Scenario: 问事付费后起卦

- **WHEN** 用户提交一个问事问题并在钱包中确认一笔 0.05 USDC 转账
- **THEN** 服务端核验该笔转账后创建 reading
- **AND** 系统自动完成六掷起卦
- **AND** 不创建任何押注或保证金托管

#### Scenario: 原生 USDC 付款

- **WHEN** 付款交易是一笔自付款人到收款地址、恰为 0.05 USDC 的原生转账
- **THEN** 服务端接受该付款并创建 reading，存档标明付款方式为原生

#### Scenario: ERC-20 付款的两条日志只算一次

- **WHEN** 一笔 ERC-20 付款同时产生 `0x3600` 与 `0xfffe` 两条 `Transfer`
- **THEN** 服务端只认 ERC-20 那一条，存档标明付款方式为 ERC-20

#### Scenario: 原生金额不是恰好 0.05

- **WHEN** 原生转账金额比 0.05 USDC 多或少一个最小单位
- **THEN** 服务端以「卦金金额不符」拒绝

#### Scenario: bundler 的 gas 补偿不算卦金

- **WHEN** ERC-4337 付款回执中有 EntryPoint 转给 bundler 的原生转账
- **THEN** 该转账不被认作卦金，只有付给收款地址的那一条被接受

#### Scenario: 不支持原子批量的钱包

- **WHEN** 用户使用不支持 EIP-5792 的钱包（如在 Arc Testnet 上的 MetaMask）问卦
- **THEN** 付款仍只需一次钱包确认即可完成

#### Scenario: 转账不符

- **WHEN** 交易失败、收款地址不符、金额不符或付款人不符
- **THEN** 服务端拒绝创建 reading 并以中文说明原因

#### Scenario: 付款凭证不可复用

- **WHEN** 同一付款交易被再次提交，包括服务重启之后
- **THEN** 服务端拒绝创建新的 reading
- **AND** 返回该凭证已对应的结果链接
