# day-master-tool 技术设计

## 概览

首页卡片收集生辰后调用 `POST /api/day-master`。服务端用 `buildBirthChart`（付费命理用的同一个函数）算出日主，只返回 `{ stem, element, yinYang, slug }`。前端根据 slug 读取静态短介绍并展示，可以生成分享图。全程不调用模型，生辰既不存储也不回显。

## 模块与文件

- `src/sanyi/api.ts`：`dayMaster` 方法，sect 缺省为 1，与首页命理下单一致。
- `src/frontend/server.ts`：路由，沿用写接口的同源、JSON、8 KiB 规则。
- `src/content/day-masters.ts`：十天干的中英短介绍（名称、阴阳、意象、概述、关键词、优势、需留意），附校验。
- `web/components/DayMasterFinder.tsx`：首页卡片，自动带出本机已存的生辰；提供知识页链接、`#/?kind=destiny` 付费入口和分享按钮。
- `web/lib/share-card.ts`：`buildDayMasterShareCard`，只接收公开短介绍，从结构上就拿不到生辰。
- 埋点：`day_master_lookup`、`share_image:day-master`。

## 关键决策

- 复用付费命理的排盘函数，保证两处日主一致。
- 生辰只用于当次计算；分享图模型不含生辰字段。

## 测试

`tests/day-master.test.ts`、`tests/frontend-day-master.test.ts`、`tests/frontend-share-card.test.ts`。
