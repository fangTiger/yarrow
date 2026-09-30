## Why

当前主流程把任意自然语言问题编译为 Arc USDC 总量阈值，实际只暴露了三层设计中的天层。这会把个人问题伪装成链上指标预测，既改变用户原意，也让未连接钱包的用户无法进入产品主体。

## What Changes

- 新增独立、中立的可判定性分类步骤，只判断问题是否会在未来由可观察事实揭晓，不读取卦象、不参与三位易者推理。
- 分类结果必须由用户确认；用户可否决并切换到另一轨道。
- 新增問轨：无需钱包，以只读区块哈希和原问题确定性派生六爻，三位易者只解卦，不签名、不交易、不产生 gas，并庄重披露无人能为不可判定问题负责。
- 賭轨保留钱包与单次立誓签名流程，但冻结原问题为人层命题，由提问者见证并经 `AttestedResolver` 或 `MutualResolver` 判定；冲突、缺席或无法确认时进入未决之卦。
- 天层退出用户主流程，保留在卦历回放和数据证据中，继续展示 backtested、Brier/BSS、Wilson 区间与置换检验。
- 短周期人间事可用于现场演示；长周期问题明确展示需要等待，不伪造即时结算。

## Capabilities

### New Capabilities

- `dual-track-question-routing`: 中立分类、用户确认与可否决双轨分流。
- `walletless-question-reading`: 基于只读区块哈希的零成本、可复算問轨。
- `human-settled-wager`: 保留原问题语义的人层见证、未决处理与长短周期说明。

### Modified Capabilities

- `single-screen-oracle-workbench`: 从钱包前置改为问题前置，只有賭轨需要钱包。
- `wallet-signed-divination`: 单次立誓签名只属于賭轨；問轨不得触发钱包能力。

## Impact

主要影响问卦领域服务、演示服务的人层命题元数据、前端 HTTP 路由、React 单屏工作台、卦历展示与对应测试。合约、部署清单、`.env`、既有天层代码、回放数据和视觉 token 均不修改。
