## 1. Implementation
- [x] 1.1 `src/sanyi/fee.ts`：解析 `0xfffe` 原生 `Transfer`，按"先 ERC-20 后原生、只认一条完整匹配"核验，返回 `feePaymentKind`
- [x] 1.2 `web/lib/arc-verify.ts`：结果页验证识别原生付款，金额统一换算显示
- [x] 1.3 `web/llms.txt`：补充原生转账同样有效
- [x] 1.4 单测：ERC-20 双日志只算一次、原生精确金额、原生低付与超付、付款人不符、收款人不符、ERC-4337 bundler 补偿不被认作卦金、陌生发射地址伪造、结果页核验原生收据
- [x] 1.5 跑全部相关测试与 `npm run typecheck`（全量 1,047 通过；`scripts/check-fee-receipt.ts` 只读复核两笔历史主网收据）
- [ ] 1.6 用户部署后：一笔原生 0.05 USDC 主网付款验收（创建解读、结果页验证通过、同一哈希不可复用）
