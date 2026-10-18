# Change: 拉人与降低付款门槛——64 卦页面、每日一卦、黄历分享图、付款失败统计

## Why
线上三天只有 24 次首页访问，付费 3 卦。缺的不是功能，是来的人少、外国用户付款门槛高：
- 应用全是 `#/` 路由，搜索引擎收录不到内容；
- 想试一下也必须先准备 Arc 上的 USDC；
- 点了付款却没成卦的人，不知道卡在哪一步。

## What Changes
- **64 卦英文静态页**（新能力 hexagram-pages）：
  - 构建时为每一卦生成 `/hexagram/<序号>-<拼音>/` 页面，外加索引页 `/hexagram/`、`sitemap.xml`、`robots.txt`；
  - 页面包含卦象、上下卦、卦辞、大象、六爻英译、简短白话导读，中文原文默认收起；
  - 页内有「问一件事」的入口；
  - 不调用模型，不依赖前端路由。
- **每日一卦**（新能力 daily-hexagram）：
  - 每天用北京时间零点后的第一个 Arc 主网区块抽一卦，所有人看到同一卦；
  - 首页展示卦象、动爻、英译或原文和区块出处，可到浏览器核对；
  - 不调用模型，零成本；
  - 想要三家完整解读，一键带入问事付费。
- **黄历分享图**（daily-almanac）：首页黄历一键生成中英文分享图，含当日一卦。
- **付款失败分类计数**（usage-metrics）：前端在付款失败时上报原因类别（取消签名、余额不足、切网失败、认领失败、其他），只记类别。

## Impact
- Affected specs: hexagram-pages（新增）、daily-hexagram（新增）、daily-almanac、usage-metrics
- Affected code：
  - 构建脚本：`scripts/build-vercel.ts`、新增静态页生成脚本
  - 服务端：`src/sanyi/` 新增每日一卦模块与 `/api/daily-hexagram`，以及 `metrics.ts`
  - 首页组件、分享卡、`PaymentButton`、i18n
