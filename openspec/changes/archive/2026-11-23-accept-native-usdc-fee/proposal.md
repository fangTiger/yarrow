# Change: 卦金同时接受原生 USDC 转账

## Why
Arc 上 USDC 既是 ERC-20，也是原生 gas 代币。钱包里直接"发送 USDC"（原生转账）不会产生 `0x3600` 的 `Transfer` 日志，所以现在会被服务端和结果页验证一起拒绝。2026-10-15 发帖时写过 "Native sends are rejected"，这次把这个限制去掉。

## What Changes
- 服务端卦金核验除 ERC-20 `0x3600` 日志外，也接受系统地址 `0xfffe`（EIP-7708）发出的原生 `Transfer`：付款人、收款地址相符，金额**恰为** 0.05 USDC（18 位小数 `50_000_000_000_000_000`）。
- 一笔 ERC-20 付款同时有 `0x3600` 与 `0xfffe` 两条日志：只认一条完整匹配的转账，不累加、不拼凑。
- 只核对日志里的 `from`，不看交易发送者（ERC-4337 外层发送者是 bundler）；EntryPoint 付给 bundler 的 gas 补偿收款方不是卦金地址，不会被认作卦金。
- 结果页「在 Arc 上验证」同样识别原生付款收据。
- 解读存档的 `feeUsdc6` 仍为 `"50000"`，新增 `feePaymentKind: "erc20" | "native"` 标明付款方式。
- 前端付款按钮、HTTP 402 返回体保持不变；`llms.txt` 补一句"原生转账 0.05 USDC 同样有效"。
- 交易哈希防复用（Redis `SET NX`）不变。

## Impact
- Affected specs: paid-oracle-flow、arc-verification、agent-payments
- Affected code:
  - 服务端：`src/sanyi/fee.ts`
  - 前端：`web/lib/arc-verify.ts`、结果页验证面板文案（如有"ERC-20"字样）
  - 文档：`web/llms.txt`
  - 测试：`tests/sanyi-fee.test.ts`、`tests/frontend-arc-verify.test.ts`
