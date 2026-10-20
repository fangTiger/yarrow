# usage-metrics Specification

## Purpose
规定三易按北京时间逐日累计首页、示例、钱包、付款与解读终态等白名单事件，并通过受保护接口读取漏斗数据。本能力只提供匿名聚合使用计数，不采集地址、IP、问题或生辰。
## Requirements
### Requirement: 基础使用计数

系统 MUST 按天累计以下事件次数：首页访问、示例查看（按类型）、点连接钱包、点付款、付款成功（按类型）、结果完成、结果失败。系统 MUST 不记录地址、IP、问题或生辰等个人信息。前端事件经 `POST /api/events` 上报，只接受白名单事件名，沿用同源校验。`GET /api/stats` MUST 校验 `x-stats-token` 与环境变量 `STATS_TOKEN`；变量未设置时 MUST 返回 404。

#### Scenario: 查看漏斗

- **WHEN** 带正确口令请求 `GET /api/stats?days=7`
- **THEN** 返回最近 7 天各事件的每日次数

### Requirement: 付款失败分类计数

前端付款失败时 MUST 上报 `pay_failed:<类别>`，类别只能是：
- rejected：用户取消签名；
- insufficient：余额或 gas 不足；
- wrong-chain：切换网络失败；
- claim：链上已付、认领失败；
- other：其他。

MUST NOT 上报地址、交易哈希、金额或错误原文。服务端 MUST 只接受白名单内的类别。

#### Scenario: 用户取消签名

- **WHEN** 用户在钱包里拒绝付款
- **THEN** 当天 `pay_failed:rejected` 计数加一

### Requirement: 分享与内容页计数

系统 MUST 统计以下事件：
- `hexagram_page_view`、`bazi_page_view`：静态页加载时用很小的信标上报，失败静默，不影响页面；
- `day_master_lookup`：日主查询成功；
- `share_image:<类别>`：生成分享图，类别为 reading、almanac、day-master；
- `daily_hexagram_ask`、`daily_hexagram_verify`：今日一卦的问卦与核对点击。

MUST 只记录事件名，不记录页面路径以外的任何用户信息，也不记录生辰。

#### Scenario: 打开卦页

- **WHEN** 访客打开任一卦页
- **THEN** 当天 `hexagram_page_view` 加一

