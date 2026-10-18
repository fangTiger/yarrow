# hexagram-pages Specification

## Purpose
规定 64 卦英文静态页、索引、sitemap 与 robots 的内容与结构。本能力让搜索引擎能收录 Yarrow 的易经内容，为外国用户带来自然流量，并引导到付费问事。
## Requirements
### Requirement: 64 卦英文静态页

构建时 MUST 为 64 卦各生成一个英文静态页，地址为 `/hexagram/<King Wen 序号>-<拼音小写>/`（如 `/hexagram/50-ding/`），并生成索引页 `/hexagram/`、`sitemap.xml` 与 `robots.txt`。

页面 MUST 是服务端可直接读取的完整 HTML，不依赖前端脚本或 `#/` 路由，内容包括：
- 卦序与卦名（拼音 · 英文名）、卦象图、上下卦及其象；
- 卦辞、大象与六爻的固定英译；
- 一段英文白话导读；
- 默认收起的中文原文；
- 上一卦与下一卦的链接、回到索引的链接；
- 「Ask Yarrow a question」入口。

页面 MUST 有唯一的 title、meta description、canonical 与 Open Graph 标签。导读 MUST NOT 给出医疗、法律、投资结论，也不承诺改运。

#### Scenario: 搜索引擎收录

- **WHEN** 爬虫请求 `/hexagram/50-ding/`
- **THEN** 不执行脚本即可读到卦名、卦辞与爻辞英译

#### Scenario: sitemap

- **WHEN** 请求 `/sitemap.xml`
- **THEN** 列出首页、索引页与 64 个卦页

