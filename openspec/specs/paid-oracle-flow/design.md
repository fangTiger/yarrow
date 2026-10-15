# paid-oracle-flow 技术设计

## 概览

所有正式解读都先由用户钱包直接向配置的收款地址转入一笔 `0.05 USDC`，再由服务端核验回执并创建 reading。系统不托管钱包、不代签交易，也不使用旧金库或押注流程。

## 模块与文件

- `src/sanyi/fee.ts`
  - `FEE_USDC6 = 50_000n` 固定六位精度的卦金。
  - `feeRecipientFromEnv` 读取收款地址并做地址校验。
  - `verifySingleFeeTransfer` 核对成功回执中的 USDC `Transfer` 日志。
  - `ArcFeeVerifier` 通过 viem public client 读取链上交易回执。
- `src/sanyi/api.ts`：`payment` 下发付款配置，`feeProofFrom` 校验付款人和交易哈希格式，并在缺凭证时返回付款要求。
- `src/sanyi/store.ts`：`ReadingStore.claimPayment` 以交易哈希摘要做原子占用，返回已有 reading id。
- `src/sanyi/reading-service.ts`、`src/sanyi/bazi-reading-service.ts`、`src/sanyi/naming/service.ts`：分别在问事、命理/运势、起名创建流程中核验付款并认领凭证。
- `web/lib/use-fee-payment.ts`：组织连接钱包、切链、余额检查、USDC 转账和提交 reading。
- `web/components/PaymentButton.tsx`：一次点击启动付款流程并上报付款点击事件。
- `web/lib/fee-plan.ts`：`planFeePayment` 计算付款前资金门禁。

## 数据流

1. 前端先完成问题分类及必填字段校验，再请求 `GET /api/payment`。
2. `useFeePayment` 连接钱包并切换到服务端给出的 Arc 链。
3. 前端检查付款所需 USDC 与 gas 条件，然后调用 USDC ERC-20 `transfer(recipient, 50000)`。
4. 钱包仅需确认这笔转账；前端等待成功回执。
5. 前端提交 `feeProof = { payer, transactionHash }` 与原始业务输入。
6. 服务端读取同一链上的回执，要求 USDC 合约、付款人、收款方和金额全部精确匹配。
7. 交易哈希被 `claimPayment` 原子绑定到新 reading；若已绑定，则返回冲突及原 reading id。
8. 付款核验和认领完成后，问事进入六掷，命理/运势进入排盘，起名进入候选与三家生成。

## 关键决策

- 使用单笔 ERC-20 `transfer`，不依赖 EIP-5792、`approve` 或托管合约。
- 金额和收款地址由服务端下发，前端构建产物不作为收费真相来源。
- 输入格式在付款要求之前校验，避免用户为不能执行的请求付款。
- 付款认领持久化且跨实例原子化，服务重启或并发请求不能重复消费同一交易。
- 主网收款地址必须显式配置；测试网才允许代码中的默认地址。

## 约束与已知限制

- 凭证只接受已上链的交易哈希，不接受签名授权或完整 x402 facilitator 流程。
- 链上转账成功但业务认领尚未完成时，资金不会自动退回；同一凭证可在未被认领前重试。
- 正式 UI 不暴露 mock/live 选择；mock provider 仅供测试和排练代码使用。
- gas 与代币均为 USDC，但原生 gas 精度和 ERC-20 六位精度在前端严格分开。

## 测试

- `tests/sanyi-fee.test.ts`：单笔付款日志的精确核验。
- `tests/frontend-single-payment.test.ts`：一次转账付款路径。
- `tests/sanyi-bazi-reading-service.test.ts`、`tests/naming-service.test.ts`：付款先于排盘及跨类型复用保护。
- `tests/sanyi-store.test.ts`、`tests/sanyi-storage.test.ts`：跨实例付款认领原子性。
- `tests/frontend-wallet.test.ts`、`tests/frontend-fee-plan.test.ts`：切链、余额与费用门禁。
