# bazi-pages 技术设计

## 概览

与 64 卦页共用生成器 `scripts/build-hexagram-pages.ts`，构建时生成以下页面并加入 sitemap，页面不依赖脚本：
- `/bazi/`；
- 10 个日主页 `/bazi/day-master/<slug>/`；
- 10 个十神页 `/bazi/ten-gods/<slug>/`。

## 模块与文件

- `src/content/bazi-guides.en.ts`：日主（每条 120–180 词）与十神（每条 100–160 词）的英文导读，附校验：条数、字数、术语与 `STEMS_EN` / `TEN_GODS_EN` 一致、无汉字、无禁用词。
- `scripts/build-hexagram-pages.ts`：负责以下内容：
  - 页面结构：导读、要点、互链、两个入口、免责声明；
  - SEO 标签；
  - `bazi_page_view` 信标；
  - sitemap，共 87 条。
- 预览图：
  - `scripts/render-og-images.ts` 生成 84 张 1200×630 卡片 HTML，用本机 Chrome 无头截图；
  - `scripts/compress-og-images.py` 再压成 128 色调色板；
  - 产物在 `web/brand/og/` 下随仓库提交。`npm run og:render` 一次完成渲染和压缩。
- 页面的 `og:image` 指向专属图；图不存在时回退 `/brand/og.png`。

## 关键决策

- 预览图预先渲染并提交，Vercel 构建不依赖浏览器。
- 导读写成「可供反思的词汇」，不作宿命断言。

## 测试

`tests/bazi-guides.test.ts`、`tests/bazi-pages.test.ts`、`tests/render-og-images.test.ts`。
