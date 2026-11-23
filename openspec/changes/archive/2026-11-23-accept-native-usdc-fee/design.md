# Design: 卦金同时接受原生 USDC 转账

## 背景事实
- `0x3600…0000`：USDC 的 ERC-20 接口，`Transfer` 金额 6 位小数。
- `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`：EIP-7708 系统地址，记录所有原生 USDC 移动，金额 18 位小数；ERC-20 转账也会在这里留一条镜像。见 https://docs.arc.io/integrate/infrastructure/indexing-events
- 普通 gas 扣费没有 `Transfer`；ERC-4337 时 EntryPoint 转给 bundler 的补偿会出现在 `0xfffe` 日志里。

## 决策
1. **金额恰好相等**：原生付款要求 `value === 5×10¹⁶`。多付或少付一个最小单位都拒绝，与 ERC-20 现行规则一致，也避免误付超额后被自动认领。
2. **先 ERC-20，后原生**：先找 `0x3600` 中完整匹配的日志，找到即返回；否则找 `0xfffe` 中完整匹配的日志。每次只接受一条，镜像日志永远不会被算两次。
3. **错误提示**：两类日志都没有完整匹配时，按"最接近"的失败原因给出中文提示（无转账 → 付款人不符 → 收款不符 → 金额不符），沿用现有文案；原生金额不符时提示"须转账 0.05 USDC"。
4. **存档字段**：`feeUsdc6` 保持 `"50000"`，不破坏已有读取方；新增 `feePaymentKind`。
5. **不加前端付款选项**：网站钱包流程照旧发 ERC-20 `transfer`；原生付款主要来自 agent 或用户手动转账。
