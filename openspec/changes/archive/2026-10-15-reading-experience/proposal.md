# Change: 结果页体验——边等边看、准不准、命理引到运势

## Why

一卦要等一两分钟。等待期间，命理页最上方只有一行进度，「一生运势」中途才突然插到页顶；而且一家落笔就画出「三家合议」与「一生最顺」，容易误导。用户想验证说得准不准，却没有地方表达；看完一生走势，想细看某十年时也没有下一步。

## What Changes

- **边等边看**：
  - 命理新卦的「一生运势」从一开始就固定显示，性格画像有占位；
  - 落笔中的图表标明已落笔几家，三家写完前不画直标；
  - 等待区列出三家状态与已用时间；
  - 标签页标题显示进度，完成后提示。
- **准不准**：已经开始的大运可标注「准 / 不太准」，存进存档，新增接口 `POST /api/readings/:id/feedback`。
- **命理引到运势**：当前与未来大运提供「细看这十年」入口，首页支持从链接预填类型、时间范围与问题。

## Impact

- Affected specs：新增 `reading-progress`、`period-feedback`、`destiny-upsell`。
- Affected code：
  - 后端：`src/sanyi/api.ts`、`src/sanyi/bazi-reading-service.ts`、`src/sanyi/store.ts`、`src/sanyi/bazi-public.ts`、`src/frontend/server.ts`；
  - 前端：`web/components/LifeLuckPanel.tsx`、`web/components/LiuNianPanel.tsx`、`web/components/PlainSummaryPanel.tsx`、`web/components/EnglishReadingSections.tsx`、`web/components/DestinyPortrait.tsx`、`web/pages/BaziReading.tsx`、`web/components/EnglishBaziReading.tsx`、`web/pages/Reading.tsx`、`web/lib/home-entry.ts`、`web/components/QuestionForm.tsx`、`web/lib/api.ts`、`web/i18n/*`。
- 设计文档：`docs/plans/2026-10-16-reading-experience-design.md`
