## ADDED Requirements

### Requirement: 黄历分享图

首页黄历 MUST 提供「分享今日黄历」，在浏览器生成一张分享图，按当前界面语言显示。图上 MUST 有：日期与农历、宜与忌、冲煞、吉神方位，有今日一卦时加上卦名，以及品牌与网址。图片 MUST 在本机生成，不上传服务器。

#### Scenario: 英文分享图

- **WHEN** 英文界面点「Share today's almanac」
- **THEN** 生成英文分享图，宜忌用英文，不出现汉字（品牌印除外）
