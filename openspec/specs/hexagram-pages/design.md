# hexagram-pages 技术设计

## 概览

`npm run frontend:build` 时，由 `scripts/build-hexagram-pages.ts` 生成以下内容，并纳入 Vercel 静态产物：
- `web/hexagram/<序号>-<拼音>/index.html`（64 页）；
- 索引页、样式表；
- `sitemap.xml`、`robots.txt`。

页面是完整的静态 HTML，不依赖脚本和 `#/` 路由，便于搜索引擎收录。

## 模块与文件

- `scripts/build-hexagram-pages.ts`：页面、索引、sitemap、robots 的生成；站点根常量为 `https://yarrow-six.vercel.app`。
- `src/content/hexagram-guides.en.json` 与 `hexagram-guides.ts`：64 条英文白话导读，附校验（条数、60–100 词、无汉字、无禁用词）。
- 数据来源：
  - `HEXAGRAMS_EN`、`TRIGRAMS_EN`；
  - `getZhouyiEnglish`；
  - 中文卦辞爻辞与大象；
  - `src/oracle/liuyao-chart.ts` 的 `getHexagramYangLines` 与 `getTrigramName`，与排盘共用同一份映射。
- `scripts/build-vercel.ts`：`STATIC_ENTRIES` 包含 `hexagram`、`sitemap.xml`、`robots.txt`。
- `src/frontend/server.ts`：本机访问以 `/` 结尾的路径时返回目录下的 `index.html`；路径穿越检查作用在最终路径上。
- `web/lib/hexagram-path.ts`：应用内链接到卦页的路径函数。

## 关键决策

- 生成物不提交仓库，每次构建现生成，内容只来自仓库数据。
- 中文原文放在默认收起的 details 里；收起区之外不出现汉字。
- 每页的 title、description、canonical 各不相同，并带 Open Graph 与 Twitter 标签。

## 测试

`tests/hexagram-pages.test.ts`。
