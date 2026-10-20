## ADDED Requirements

### Requirement: 八字英文知识页

构建时 MUST 生成英文静态页：
- 索引页 `/bazi/`；
- 10 个日主页 `/bazi/day-master/<拼音小写>-<五行小写>/`，如 `/bazi/day-master/gui-water/`；
- 10 个十神页 `/bazi/ten-gods/<英文名小写连字符>/`，如 `/bazi/ten-gods/direct-officer/`。

页面 MUST 是不依赖脚本的完整 HTML，有唯一的 title、meta description、canonical 与 Open Graph 标签。内容为：
- 英文导读与要点；
- 相关页面互链；
- 引到「Find your Day Master」与付费命理的入口。

所有页面 MUST 列入 sitemap。导读 MUST NOT 给出医疗、法律、投资结论，不作宿命断言。

#### Scenario: 搜索日主性格

- **WHEN** 爬虫请求 `/bazi/day-master/gui-water/`
- **THEN** 不执行脚本即可读到 Gui Water 日主的性格导读

### Requirement: 八字页专属预览图

每个八字知识页 MUST 有专属的 1200×630 预览图，写明页面主题（如「Gui Water Day Master」）。og:image 与 twitter:image MUST 指向该图。

#### Scenario: 转发日主页

- **WHEN** 在社交平台粘贴日主页链接
- **THEN** 预览显示该日主的专属图
