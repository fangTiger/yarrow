## ADDED Requirements

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
