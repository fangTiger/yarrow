# Change: 链上自证与中断恢复——Arc 验证、真钱兜底、分享预览

## Why

三易已上 Arc 主网，收的是真钱，并参加 Arc Microgrants。评审看重两件事：主网上真的跑通，以及 Arc 是不可替代的组成部分。

现状有三处不足：
- 「每一掷可复算」只给了公式和链接，要用户自己算；
- Vercel 上后台任务最长 300 秒，一卦若被中断，三家或总述会一直停在「落笔中」，用户付了钱却拿不到结果，也无法重试；
- 链接分享到 X、Discord 等处没有预览卡片。

## What Changes

- **结果页「在 Arc 上验证」**：浏览器直接向 Arc RPC 取付款交易回执与六个起卦区块，本地核对付款（收款方、金额、区块），并按公式复算六掷，逐掷显示是否一致。八字与起名只核对付款。示例的付款哈希已抹零，不提供验证按钮。
- **中断恢复**：
  - 三家、总述、起名各家处于「落笔中」超过平台时限（330 秒）仍未结束的，读取时改判为失败（不扣重试次数），用户可用现有按钮重试；
  - 问事起卦停在「待掷」超过 120 秒且未暂停的，读取时改为暂停，用户可点「继续起卦」。
- **分享预览**：首页加 Open Graph 与 Twitter 卡片标签，以及一张 1200×630 的预览图。
- **README**：补「Mainnet proof」（收款地址、主网付款交易与浏览器链接、复算方法），以及「Why Arc」（USDC 即 gas、确定性终局、亚秒出块）。

## Impact

- Affected specs：新增 `arc-verification`、`reading-resilience`、`share-preview`。
- Affected code：
  - `web/components/VerifyPanel.tsx`、`web/components/EnglishQuestionResult.tsx`、新增 `web/lib/arc-verify.ts`；
  - `src/sanyi/reading-service.ts`、`src/sanyi/bazi-reading-service.ts`、`src/sanyi/naming/service.ts`、`src/sanyi/store.ts`（状态时间戳）；
  - `web/index.html`、新增 `web/brand/og.png`、`README.md`、`README.zh-CN.md`。
