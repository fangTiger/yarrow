# Growth Daily Hexagram G1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成 OpenSpec `growth-daily-hexagram` 的 G1（1.1–1.5）：每日一卦、首页卡片与浏览器复算、黄历分享图、付款失败分类统计及测试。

**Architecture:** 服务端新增独立的每日一卦模块，以北京时间日期、区块时间二分查找、确定性铜钱公式和 `DocumentBackend.setIfAbsent` 组成；运行时将同一服务注入本机与 Vercel 共用的 HTTP handler。前端复用既有卦象、英译、Arc 读链与分享卡画布体系，用纯模型/纯复算函数承载可测试逻辑，React 组件只负责加载和交互。

**Tech Stack:** TypeScript、Node test runner、React 18、viem、Canvas 2D、OpenSpec。

---

### Task 1: 每日一卦确定性核心与区块查找

**Files:**
- Create: `tests/daily-hexagram.test.ts`
- Create: `src/sanyi/coins.ts`
- Create: `src/sanyi/daily-hexagram.ts`
- Modify: `src/sanyi/throws.ts`

1. 先写固定哈希/日期六爻、铜钱换算、北京时间 15:59/16:00 边界、首区块二分、RPC 错误与当日尚无新区块的失败测试。
2. 运行 `node --import tsx --test tests/daily-hexagram.test.ts`，确认因模块/API 缺失而失败。
3. 提取铜钱低三位换算函数；实现北京时间日期和零点时间戳、每日公式、近期样本平均出块时间估算及带边界扩展的二分查找；RPC 错误统一包装为可识别错误。
4. 重跑该测试至通过，并回归 `tests/sanyi-throws.test.ts`。

### Task 2: 每日缓存与 HTTP 接口

**Files:**
- Modify: `tests/daily-hexagram.test.ts`
- Modify: `src/sanyi/daily-hexagram.ts`
- Modify: `src/frontend/runtime.ts`
- Modify: `src/frontend/server.ts`
- Modify: `src/vercel/api.ts`
- Modify: `web/lib/api.ts`

1. 先写并发请求仅执行一次计算、`setIfAbsent` 竞争一致、GET 返回结构/缓存头且无需 Origin 的失败测试。
2. 运行定向测试确认 RED。
3. 实现按日 promise 去重、存档解析与竞争后重读；将服务注入 runtime 和共用 handler，返回 `public, max-age=300`，Vercel 与本机入口都传入当前网络实例。
4. 重跑定向测试与相关 HTTP/API 测试。

### Task 3: 首页今日一卦与浏览器复算

**Files:**
- Create: `tests/frontend-daily-hexagram.test.ts`
- Create: `web/components/DailyHexagram.tsx`
- Create: `web/lib/hexagram-path.ts`
- Modify: `web/lib/arc-verify.ts`
- Modify: `web/pages/Home.tsx`
- Modify: `web/i18n/zh.ts`
- Modify: `web/i18n/en.ts`
- Modify: `web/styles/components.css`

1. 先写中英文渲染、英文无汉字、接口失败隐藏、静态卦页路径、固定区块复算一致/不一致及首页位置的失败测试。
2. 运行定向测试确认 RED。
3. 以 `deriveFiveHexagrams`、中英文语料和 `HexagramFigure` 组装卡片；展示出处、公式说明、问事入口和英文静态页链接；浏览器直读区块并复算六爻。
4. 为 390px 布局添加断点并重跑测试。

### Task 4: 黄历分享图

**Files:**
- Modify: `tests/frontend-daily-almanac.test.ts`
- Modify: `tests/frontend-share-card.test.ts`
- Create: `web/components/ShareImageButton.tsx`
- Modify: `web/components/ShareCard.tsx`
- Modify: `web/components/DailyAlmanac.tsx`
- Modify: `web/lib/share-card.ts`
- Modify: `web/i18n/zh.ts`
- Modify: `web/i18n/en.ts`
- Modify: `web/styles/components.css`

1. 先写黄历分享模型中英文内容、英文无汉字、含/不含今日卦名和 1080×1350 布局边界测试，以及入口文案测试。
2. 运行定向测试确认 RED。
3. 抽取现有通用预览/下载弹层；新增黄历分享模型、复用字体/颜色/换行截断规则的布局与绘制；DailyAlmanac 异步取得每日一卦，拿到时才画卦名。
4. 重跑黄历与分享卡测试，确认既有结果分享行为不变。

### Task 5: 付款失败分类统计

**Files:**
- Modify: `tests/frontend-wallet-errors.test.ts`
- Modify: `tests/usage-metrics.test.ts`
- Modify: `web/lib/payment-error.ts`
- Modify: `web/lib/use-fee-payment.ts`
- Modify: `web/components/PaymentButton.tsx`
- Modify: `src/sanyi/metrics.ts`

1. 先写拒签、余额/gas 不足、切链、已有凭证后的 claim、other、表单错误不计和未知前端事件被拒绝的失败测试。
2. 运行定向测试确认 RED。
3. 实现 cause 链分类和付款阶段上下文；切链/余额预检加稳定类型标记；PaymentButton 仅对非表单错误上报 `pay_failed:<kind>`；扩充服务端精确白名单。
4. 重跑定向测试。

### Task 6: 规范状态与全量验证

**Files:**
- Modify: `openspec/changes/growth-daily-hexagram/tasks.md`

1. 对照四份 spec 逐项审查实现，仅勾选 G1 的 1.1–1.5，保持 G2/G3 未勾选。
2. 运行 `npx tsc --noEmit`。
3. 运行 `npm test`，仅接受已知 `tests/frontend-server.test.ts` 端口 EPERM。
4. 运行 `npm run -s frontend:build` 与 `npm run -s frontend:secrets`。
5. 运行 `openspec validate growth-daily-hexagram --strict`。
6. 检查 `git diff --check`、改动范围和英文界面汉字白名单测试，再汇报浏览器核对、风险和未决项。
