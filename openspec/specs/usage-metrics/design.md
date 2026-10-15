# usage-metrics 技术设计

## 概览

使用计数只记录白名单事件名和北京时间日期，不记录用户标识或业务内容。前端上报交互事件，服务端在 reading 创建与首次终态时记录生命周期事件，所有计数复用文件或 Redis 文档后端的原子累加能力。

## 模块与文件

- `src/sanyi/metrics.ts`
  - `FrontendMetricEvent`、`MetricEvent` 定义有限事件集合。
  - `isFrontendMetricEvent`、`isMetricEvent` 执行白名单检查。
  - `DocumentUsageMetrics` 按日累加并读取日期窗口。
  - `incrementMetricSafely` 保证计数失败不改变 reading 主流程。
- `src/sanyi/storage.ts`：`DocumentBackend.incrementCounter`；文件实现串行写，Redis 实现用 Lua 原子增量。
- `src/frontend/runtime.ts`：创建一个共享 `DocumentUsageMetrics` 并注入各服务与 HTTP handler。
- `src/frontend/server.ts`：`POST /api/events` 接收前端事件，`GET /api/stats` 提供受保护统计。
- `web/lib/metrics.ts`：`track` 以 `keepalive` 静默上报，首页和示例事件在当前页面实例去重。
- `web/pages/Home.tsx`、`SampleReading.tsx`、`web/components/WalletBar.tsx`、`PaymentButton.tsx`：交互埋点位置。
- `src/sanyi/reading-service.ts`、`bazi-reading-service.ts`、`naming/service.ts`：创建、完成和失败事件。

## 数据流

1. 首页、示例、连接钱包或点击付款时，前端向 `/api/events` 发送单个事件名。
2. HTTP 层沿用 JSON、8 KiB 和同源检查，只接受 `FrontendMetricEvent` 白名单。
3. reading 付款核验并创建成功后，服务端记录 `reading_created:<kind>`，作为付款成功且创建完成的计数。
4. reading 首次进入完成或失败终态时，以存档中的 `terminalMetric.token` 保证只计一次。
5. `DocumentUsageMetrics.increment` 以北京时间日期生成 `metrics/YYYY-MM-DD` 键并原子加一。
6. 带正确 `x-stats-token` 的请求可读取最近 1–60 天，缺数据日期返回空计数。

## 关键决策

- 只存事件名和整数计数，接口不接受地址、IP、问题、生辰或任意属性。
- 前端事件与服务端生命周期事件分开：关键成功/失败不依赖浏览器上报。
- 计数异常只写日志且吞掉错误，不能令付款、起卦或落笔失败。
- 日期口径固定为 UTC+8，跨部署地区仍落在同一产品日。
- 未设置 `STATS_TOKEN` 时统计接口返回 404，避免形成无保护管理端点。

## 约束与已知限制

- `pay_click` 是意图事件；实际付款成功没有独立同名事件，而由 `reading_created:<kind>` 表示已核验并创建。
- 首页和示例去重集合只存在于当前前端进程，刷新页面后可再次计数。
- 这是次数统计，不做独立用户、会话或转化归因。
- 统计口令只做精确字符串比较，不提供用户管理或权限分级。

## 测试

- `tests/usage-metrics.test.ts`：白名单、北京时间、并发原子累加、接口授权、前端上报和服务生命周期。
- `tests/sanyi-storage.test.ts`：文件与 Redis 的原子计数。
- `tests/frontend-server.test.ts`：写接口通用安全边界。
