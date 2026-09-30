# 单签名自动开卦与可恢复会话设计

## 目标与边界

稳态每卦只由连接钱包签一笔 `commit`。首次使用时，如果现有 allowance 不足 10.000000 USDC，额外签一笔固定额度授权；该额度可覆盖 18 轮 0.550000 USDC 托管，绝不使用无限授权。服务端持有 salt，等待未来块哈希出现后自动 `reveal`，并用无许可结算账户提交三笔 `settle`。浏览器只得到 commitment 与公开交易参数，不得到 salt、私钥或账户派生入口。合约不变，揭示窗口、三家法定人数与“截止块后首次观察”语义不变。

`DivinationRegistry.reveal` 要求 `msg.sender == querent`。因此不改合约时有三种选择：一是继续让任意用户钱包签 reveal，无法达到单签名；二是增加转发/智能账户合约，违反本轮边界；三是仅允许服务端已托管同一演示账户签名材料的连接钱包，并在 commit 前核验地址。采用第三种，既满足当前受控演示，也不会让不受支持的钱包先锁资金再失败。EIP-2612 与 Permit2 都无法改变 registry 直接调用 USDC `transferFrom(msg.sender, ...)` 的事实，故授权采用合约直接、固定 10 USDC 的一次性 approve。

## 数据流、安全与恢复

准备接口返回公开 preparation，私有 salt 只保存在 Node 进程内的活动会话秘密中。commit 回执经发送者、目标、函数和参数四项核验后，服务端使用与 querent 相同的托管账户等待 `commitBlock + N`，自动揭示并立即清除 salt。安全依据是 `seed = keccak256(abi.encode(salt, blockhash(commitBlock + N)))`：commit 时服务端和提问者都不知道未来块哈希，持有 salt 不能选择结果；自动揭示还消除了提问者看到结果后选择性不揭示的能力。

失败时会话进入可重开态。页面始终提供“弃卦重来 / 开始新的一卦”；旧轮若已有 roundId，则返回明确的资金状态与 `npm run demo:recover -- --round-id <id> --confirm` 路径。恢复仍只在链上截止后执行 `forfeit` 或 `cancelIncompleteRound`，不静默覆盖托管。延迟预算把 60 块作为自动流程的总交互余量，交易、校准预算只补足到该总量而不重复相加，另保留 4 块操作安全垫；UI 在现有工作台内显示各阶段预计和实测耗时。

