## ADDED Requirements

### Requirement: 卦页专属预览图

64 卦页 MUST 各有专属的 1200×630 预览图，含卦象、序号、拼音与英文名。og:image 与 twitter:image MUST 指向该图。预览图 MUST 预先渲染并随仓库提交，构建时不依赖浏览器。

#### Scenario: 转发卦页

- **WHEN** 在社交平台粘贴 `/hexagram/29-kan/`
- **THEN** 预览显示坎卦的专属图
