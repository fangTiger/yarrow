# six-throw-casting 技术设计

## 概览

问事 reading 在付款核验后由服务端自动完成六掷。每一掷只依赖付款交易哈希、规范化问题、掷序和一个新的 Arc 区块哈希，因此结果可由公开材料复算；浏览器只轮询并展示进度，不参与抽签。

## 模块与文件

- `src/sanyi/throws.ts`
  - `deriveThrow` 实现铜钱推导公式并返回背数、爻值、交单拆重和动爻标记。
  - `assertNextThrow` 强制掷序为当前记录数加一，且最多六掷。
  - `waitForBlockAfter` 轮询严格高于给定高度的区块，超时或 RPC 失败时抛出 `ArcUnavailableError`。
- `src/sanyi/reading-service.ts`
  - `ReadingService.createQuestionReading` 写入 `awaiting-throws` 初始存档并启动后台自动起卦。
  - `throwCoin` 取得新区块、计算并原子追加一掷；第六掷后启动 `finalize`。
  - `continueCasting`、`resumePendingCasts` 分别处理手动续掷与常驻服务重启恢复。
- `src/sanyi/store.ts`：`StoredQuestionReading` 保存 `castAfterBlock`、`castProgressAt`、`castPaused` 和逐掷公开材料。
- `src/frontend/server.ts`：只暴露 `POST /api/readings/:id/cast` 继续暂停的整段起卦；旧单掷接口不存在。
- `web/components/AutoCast.tsx`、`web/components/ThrowRecord.tsx`：展示逐爻动画、铜钱正反、进度和继续按钮。

## 数据流

1. `createQuestionReading` 核验付款后，以付款区块号作为 `castAfterBlock` 写入 reading。
2. 后台循环令下一掷序等于 `throws.length + 1`。
3. 第一掷取付款区块之后的新块；以后每掷取上一掷区块之后的新块。
4. `deriveThrow` 计算：`keccak256(encodePacked("sanyi-throw-v1", paymentTxHash, blockHash, normalizeQuestion(question), index))`。
5. 哈希最低三位依次作为三枚铜钱，`1` 为背、`0` 为字；爻值为 `6 + backs`。
6. 每掷立即写入存档；页面按秒轮询 reading，并由 `AutoCast` 增量展示。
7. 六掷齐全后，第一掷的区块时间戳成为卦时，服务端继续排盘和三家落笔。

## 关键决策

- 随机源由付款和付款后的链上新区块共同决定，服务端不能预先选择结果。
- 六掷在服务端串行执行，避免客户端跳号、并发或重放单掷请求。
- 已记录的掷幂等返回，不重新选择区块；存储更新另有 reading 级队列保护。
- Arc 暂不可用时使用指数退避，默认从 1 秒增加到最多 30 秒；累计等待默认 10 分钟后暂停。
- 暂停后保留既有掷，用户继续时从断点恢复，不使用本地随机数降级。

## 约束与已知限制

- `waitForBlockAfter` 单次默认等待 10 秒；自动循环负责更长时间的退避重试。
- Vercel 后台任务依赖 `keepAlive`/`waitUntil`；平台中断后的停滞识别由 `reading-resilience` 处理。
- 常驻服务启动时会扫描存档续掷；Vercel 请求入口不会执行这一全量扫描。
- 页面显示速度受 Arc 出块和 RPC 可用性影响，代码不保证固定十秒内完成。

## 测试

- `tests/sanyi-throws.test.ts`：公式、四种爻值、掷序、新区块和超时。
- `tests/sanyi-auto-cast.test.ts`：自动六掷、暂停续掷和服务重启恢复。
- `tests/sanyi-reading-service.test.ts`：六掷后的排盘与三家编排。
- `tests/frontend-luopan.test.ts`：无“摇”按钮、逐爻进度与英文展示。
- `tests/sanyi-api.test.ts`、`tests/frontend-server.test.ts`：继续起卦路由与旧接口边界。
