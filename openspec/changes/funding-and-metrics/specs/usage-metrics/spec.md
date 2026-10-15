## ADDED Requirements

### Requirement: 基础使用计数

系统 MUST 按天累计以下事件次数：首页访问、示例查看（按类型）、点连接钱包、点付款、付款成功（按类型）、结果完成、结果失败。系统 MUST 不记录地址、IP、问题或生辰等个人信息。前端事件经 `POST /api/events` 上报，只接受白名单事件名，沿用同源校验。`GET /api/stats` MUST 校验 `x-stats-token` 与环境变量 `STATS_TOKEN`；变量未设置时 MUST 返回 404。

#### Scenario: 查看漏斗

- **WHEN** 带正确口令请求 `GET /api/stats?days=7`
- **THEN** 返回最近 7 天各事件的每日次数
