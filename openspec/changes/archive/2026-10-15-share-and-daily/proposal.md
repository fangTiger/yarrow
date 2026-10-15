# Change: 分享卡片与今日黄历

## Why

主网上目前只有团队自测的付款，还没有陌生用户。需要让结果能被分享出去，带来自然传播，并让首页每天有免费内容，给人回访的理由。

## What Changes

- 结果页总述完成后可生成 1080×1350 的分享图（命理、问事、运势三类），可预览、调用系统分享或下载。卡片不含生辰、四柱、大运干支与付款哈希。
- 首页新增「今日黄历」卡片（数据来自现有 `/api/now`），附「看看你今天的运势」入口。英文版使用新增的展示用术语表，查不到的词条不显示。
- 撰写面向外国用户的发布文案草稿。

## Impact

- Affected specs：新增 `share-card`、`daily-almanac`。
- Affected code：新增 `web/lib/share-card.ts`、`web/components/ShareCard.tsx`、`web/lib/almanac-en.ts`、`web/components/DailyAlmanac.tsx`；修改 `web/components/PlainSummaryPanel.tsx`、`web/components/EnglishReadingSections.tsx`、`web/pages/Home.tsx`、`web/i18n/*`、`web/styles/*`；新增 `docs/launch/`。
