# arc-verification 技术设计

## 概览

验证完全在浏览器内进行：前端直接连接当前配置的 Arc RPC，读取付款回执和起卦区块，与公开 reading 中的付款哈希、问题和六掷记录比较。三易服务端只提供当前收款地址，不代理链上验证。

## 模块与文件

- `web/lib/arc-verify.ts`
  - `checkPayment` 检查交易成功、USDC `Transfer`、收款方和 `50_000` 最小单位金额。
  - `recomputeCoins` 复刻服务端 `deriveThrow` 的哈希公式。
  - `checkThrows` 核对区块哈希、付款后高度与三枚铜钱。
  - `verifyOnArc` 汇总付款与逐掷结果。
  - `isVerifiablePayment` 排除格式错误和示例使用的全零哈希。
- `web/components/ArcVerify.tsx`
  - `ArcVerify` 创建 viem public client、请求 `/api/payment` 取得收款方并呈现逐项结果。
  - `ArcVerifyPanel` 为八字与起名结果提供只核对付款的面板。
- `web/components/VerifyPanel.tsx`：问事结果同时展示验证入口与原始复算材料。
- `web/lib/wagmi.ts`：提供构建时注入的 Arc 链、RPC 和浏览器地址。
- `src/sanyi/api.ts`、`src/frontend/server.ts`：`GET /api/payment` 返回当前链、代币、金额和收款方。

## 数据流

1. 结果页从公开 reading 取得 `payment.firstHash`；问事另取得规范化问题与逐掷记录。
2. 用户点击验证后，组件读取服务端当前收款地址。
3. 浏览器经 Arc RPC 读取付款回执，从 USDC 合约日志解析付款人、收款方和金额。
4. 对问事的每一掷，浏览器按存档区块号读取链上区块并比较区块哈希。
5. `recomputeCoins` 用链上区块哈希重新计算最低三位，与存档铜钱逐位比较。
6. UI 分别显示付款与每一掷的通过或失败原因，并链接 Arc 浏览器。

## 关键决策

- 链上读取不经过三易 API，降低“由被验证者提供验证结果”的信任循环。
- 浏览器与服务端各自实现同一公式，并由交叉测试锁定规范化与位序一致性。
- 收款地址运行时从 `/api/payment` 获取，避免验证代码硬编码部署收款方。
- 示例数据抹去真实付款哈希，因此只显示不可验证说明，不伪造通过状态。
- 八字、运势和起名没有六掷，只验证付款；问事才进入逐掷复算。

## 约束与已知限制

- 当前 `checkThrows` 要求每个起卦区块高于付款区块，但不验证六个区块彼此严格递增，也不证明它是“之后第一个新区块”。
- RPC 不可达时组件显示通用验证错误，不会改写 reading 或触发服务端补救。
- 当前验证依赖存档中的原问题；问题改变一字会导致铜钱复算不一致。
- 全零哈希和非法哈希不可验证，适用于只读示例。

## 测试

- `tests/frontend-arc-verify.test.ts`：付款回执、篡改区块、篡改铜钱、问题变化及中英文面板。
- `tests/sanyi-throws.test.ts`：服务端推导公式。
- `tests/frontend-reading-components.test.ts`：结果页复算材料与区块链接。
- `tests/sanyi-api.test.ts`：公开 reading 的付款首哈希和逐掷材料。
