# Change: 分享方向——免费「测测你的日主」、八字知识页、页面专属预览图、分享埋点

## Why
上线后两天几乎没有访问，眼下最缺的是让人愿意转发、能被搜到的内容：
- 64 卦页面已经上线，但转发时的预览图千篇一律；
- 外国人对八字的兴趣多在「我是哪种日主、性格如何」，这一块我们还没有能被搜到的内容，也没有免费、能分享的入口。

## What Changes
- **免费「测测你的日主」**（新能力 day-master-tool）：
  - 首页输入生日，立即得到日主（如「癸水 / Gui Water」）和简短性格介绍；
  - 计算与付费命理同一套排盘，不调用模型；
  - 可生成分享图，图中不含生日；
  - 一键带入付费命理。
- **八字知识页**（新能力 bazi-pages）：
  - 英文静态页：`/bazi/`，10 个日主页 `/bazi/day-master/<stem>-<element>/`，10 个十神页 `/bazi/ten-gods/<slug>/`；
  - 每页有导读、要点和引到付费命理的入口；
  - 加入 sitemap。
- **页面专属预览图**（hexagram-pages、bazi-pages）：64 卦页与 20 个八字页各有一张 1200×630 的预览图。由本机脚本预先渲染后提交到仓库，构建时不依赖浏览器。
- **分享相关埋点**（usage-metrics）：
  - 卦页与八字页访问；
  - 日主查询；
  - 分享图生成（按类别）；
  - 今日一卦的「问一卦」与「核对」点击。

## Impact
- Affected specs: day-master-tool（新增）、bazi-pages（新增）、hexagram-pages、usage-metrics
- Affected code：
  - 服务端：`src/sanyi/`（日主查询接口与日主计算）、`src/content/`（导读数据）
  - 脚本：`scripts/build-hexagram-pages.ts`（扩展到八字页，或新增生成器）、新增预览图渲染脚本
  - 前端：首页组件、分享卡、metrics
  - 静态资源：`web/brand/og/`
