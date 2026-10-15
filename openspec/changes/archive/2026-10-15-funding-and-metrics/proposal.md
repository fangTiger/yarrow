# Change: USDC 获取指引与基础数据统计

## Why

主网上目前只有团队自测的付款。外国用户最大的门槛，是钱包里没有 Arc 主网上的 USDC，而现在只有一句「可从交易所或跨链桥转入」。我们也看不到访客停在哪一步，优化全靠猜。

## What Changes

- **USDC 获取指引（中英）**：三步说明，附两个已核实的官方链接：Circle USDC Bridge（https://bridge.usdc.com，CCTP 原生铸造）和 Across（https://across.to/arc-bridge，Arc 主网已上线）。
  - 显示位置：钱包余额为零时；付款按钮下方常驻「怎么付款？」，未连钱包也能看。
  - 测试网仍显示水龙头。
- **基础数据统计**：
  - 按天记录事件次数：首页访问、示例查看、点连接钱包、点付款、付款成功（按类型）、结果完成、结果失败。只记次数，不记地址、IP 或任何个人信息。
  - 前端经 `POST /api/events` 上报（白名单事件，同源校验）；服务端在创建结果、完成、失败处直接计数。
  - `GET /api/stats?days=14` 须带 `x-stats-token` 头且与环境变量 `STATS_TOKEN` 一致；未设置该变量时接口不存在（404）。

## Impact

- Affected specs：新增 `funding-guide`、`usage-metrics`。
- Affected code：新增 `web/components/FundingGuide.tsx`、`src/sanyi/metrics.ts`、`web/lib/metrics.ts`；修改 `web/components/WalletPaymentGuide.tsx`、`web/components/QuestionForm.tsx` 或付款按钮所在组件、`src/frontend/server.ts`、`src/frontend/runtime.ts`、三个结果服务（计数挂钩）、`web/i18n/*`。
