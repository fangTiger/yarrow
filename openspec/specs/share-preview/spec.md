# share-preview Specification

## Purpose
规定三易站点链接在社交平台展开时使用的 Open Graph 与 Twitter 大图元数据。本能力提供统一品牌印、英文标语和绝对地址预览图，改善 Yarrow 首页链接的分享识别度。
## Requirements
### Requirement: 分享预览卡片

首页 MUST 带 Open Graph（title、description、image、url、type）与 Twitter 大图卡片标签，预览图为 1200×630 PNG，含品牌印与一句英文标语，使用站点绝对地址。

#### Scenario: 分享到 X

- **WHEN** 用户把站点链接发到 X 或 Discord
- **THEN** 显示带品牌印与标语的大图预览卡片

