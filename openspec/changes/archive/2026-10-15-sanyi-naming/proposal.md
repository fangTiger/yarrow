# Change: 三易第二期——起名（人名与商号）

## Why

第一期只开放问事、命理、运势，用户问到起名时只看到「即将开放」。用户要求开放起名：既给宝宝起名、成人改名，也给公司和店铺起字号。

## What Changes

- 首页类型由三项变四项，新增「起名」，下设「人名 / 商号」；规则分类把起名改为可用，并识别人名或商号。
- 人名输入：姓氏、单名或双名、生辰（可按预产期，未出生时性别可选「不限」）、期望（选填）。商号输入：行业与期望、字号字数、店主生辰（选填）。
- 新增起名三家：五行补益、诗文出处、音形字义，各给 3 个名字；另有「三家合参」推荐 2–3 个。不用五格数理。
- 新增起名字库：《通用规范汉字表》8105 字的拼音、繁体、康熙笔画、五行（部首优先、读音其次）、简短释义与不宜入名标记；来源为 Unicode Unihan 与新华字典数据（MIT）。
- 新增诗文语料：《诗经》《楚辞》《论语》、唐诗三百首、宋词三百首（chinese-poetry，MIT），并复用已有的《周易》经文与《大象传》。诗文家只能从程序抽出的候选诗句里取字。
- 新增起名结果页与存档类型；不存原始生辰。

## Impact

- Affected specs：新增 `naming`。另外，第一期 `unified-question-entry` 中「起名即将开放」的场景，在两个变更都归档时由本变更取代。
- Affected code：新增 `src/sanyi/naming/`、`tools/naming/`、`web/pages/NamingReading.tsx` 及起名表单组件；修改 `src/sanyi/classify.ts`、`src/sanyi/api.ts`、`src/sanyi/store.ts`、`src/frontend/server.ts`、`web/lib/home-entry.ts`、`web/components/QuestionForm.tsx`、`web/components/KindOptions.tsx`、`web/components/BirthFields.tsx`、`scripts/rehearse-demo.ts`、字体子集。
- 依赖：构建期在 `.venv-tools` 使用 opencc-python-reimplemented（Apache-2.0），运行时不新增依赖。
- 设计文档：`docs/plans/2026-10-09-sanyi-naming-design.md`
