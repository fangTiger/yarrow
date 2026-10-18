# daily-hexagram 技术设计

## 概览

服务端按北京日期，找 Arc 上时间戳不早于当日零点的第一个区块，用 `sanyi-daily-v1` 公式抽出六爻，并按日缓存。前端首页展示这一卦，可在浏览器里读链复算。全程不调用模型，也不需要钱包。

## 模块与文件

- `src/sanyi/daily-hexagram.ts`
  - `beijingDate`、`beijingMidnightTimestamp`：日期换算；
  - `deriveDailyLines`：抽卦公式；
  - `findFirstBlockAtOrAfter`：找区块；
  - `DailyHexagramService`：按日缓存、同进程并发合并；
  - `DailyHexagramUnavailableError`。
- `src/sanyi/coins.ts`：`throwFromHash`，与问事六掷共用的铜钱换算（最低三位，1 为背，背数加六）。
- `src/frontend/runtime.ts`、`server.ts`、`src/vercel/api.ts`：`GET /api/daily-hexagram`，`cache-control: public, max-age=300`。
- `web/components/DailyHexagram.tsx`：首页卡片、出处、「怎么抽的」、浏览器核对（复用 `web/lib/arc-verify.ts` 的读链）、带入问事、链接到卦页。
- `web/lib/share-card.ts`：黄历分享图带上今日一卦卦名与本卦到之卦的图。

## 数据流

1. 请求到达后，先读 `daily-hexagram/<date>` 缓存，命中就直接返回。
2. 未命中时找区块：
   - 用最新区块及其前 50 块估出平均出块时间，推算目标高度；
   - 区间夹不住目标时指数扩大；
   - 最后二分，找到时间戳不早于零点的最小区块号。
3. 对区块哈希、日期与掷序 1–6 算 keccak，取最低三位换算爻值；用 `setIfAbsent` 写入缓存，跨实例只保留一份。
4. 零点后若还没有区块，返回前一天的卦。

## 关键决策

- 所有人同一卦：方便分享和讨论，也便于独立核对。
- 用零点后首块而非付款块：不需要任何用户输入，结果在零点之后才可知、才确定。
- 只在当天第一次请求时访问链，之后读缓存。

## 约束与已知限制

- 依赖区块时间戳随高度单调不减。
- 首次请求要多次调用 RPC（实测约 4 秒），之后读缓存。

## 测试

`tests/daily-hexagram.test.ts`、`tests/frontend-daily-hexagram.test.ts`、`tests/frontend-share-card.test.ts`。
