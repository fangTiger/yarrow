# 落笔与起卦中断恢复实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use test-driven-development to implement this plan task-by-task.

**目标：** 实现 OpenSpec `arc-verify-resilience` 第 2 节，让超时中断的落笔状态可免费重试，并让卡住的问事起卦可继续。

**架构：** 各服务在状态进入 `writing` 时用注入时钟写入内部 `startedAt`；问事起卦另记录最近进展时间。读取恢复集中在 `ReadingStore`，先读出候选状态，再通过现有 compare-and-set 更新重查 `status + startedAt`，确保并发完成不会被覆盖。服务的 `getReading` 与 `readAny` 均调用该恢复读取，公开投影显式剔除内部时间戳。

**技术栈：** TypeScript、Node.js test runner、ReadingStore/DocumentBackend CAS、OpenSpec。

---

### 任务 1：用失败测试固定恢复行为

**文件：**

- 新增：`tests/sanyi-resilience.test.ts`

1. 构造可变注入时钟与三类服务存档。
2. 覆盖问事三家、问事总述、八字三家、八字总述、起名一家超时后的失败改判。
3. 覆盖 `retries` 不变及现有重试接口成功。
4. 覆盖 330 秒内不变、无 `startedAt` 的旧存档不变。
5. 用可控 CAS 后端模拟读取与写回间已完成，断言完成结果不被覆盖。
6. 覆盖问事待掷超过 120 秒后暂停并可继续。
7. 运行 `node --import tsx --test tests/sanyi-resilience.test.ts`，确认因缺少新行为而失败。

### 任务 2：扩展内部状态与原子恢复读取

**文件：**

- 修改：`src/sanyi/store.ts`

1. 为三类子状态和总述状态增加可选 `startedAt`，为问事增加可选最近起卦进展时间。
2. 定义具名阈值常量，并以中文注明 330 秒来自 Vercel 300 秒上限加余量。
3. 增加带时钟的恢复读取：仅处理有合法时间戳且确已超时的状态。
4. 原子更新内逐个重查同一 `startedAt` 的 `writing`；改为 `failed`、写入「落笔中断，请重试」、保留 `retries`。
5. 当不再有进行中的落笔状态时把父级 `writing` 转为 `done`，开放已有重试前置条件。
6. 对超时未暂停的 `awaiting-throws` 设置 `castPaused`。

### 任务 3：覆盖所有进入 writing 与读取入口

**文件：**

- 修改：`src/sanyi/reading-service.ts`
- 修改：`src/sanyi/bazi-reading-service.ts`
- 修改：`src/sanyi/naming/service.ts`

1. 首次三家/各家落笔写 `startedAt`。
2. 各家重试、改事项、换日重算写新的 `startedAt`。
3. 总述首次与重试写新的 `startedAt`。
4. 问事创建、成功落掷与继续起卦更新最近进展时间。
5. `getReading`、`readAny` 统一走恢复读取。
6. 运行新增测试，完成 GREEN；再运行三类既有服务测试。

### 任务 4：保护公开视图

**文件：**

- 修改：`src/sanyi/api.ts`
- 修改：`src/sanyi/bazi-public.ts`
- 修改：`src/sanyi/naming/public.ts`

1. 从公开三家/各家与总述状态中剔除 `startedAt`。
2. 从问事公开顶层剔除最近起卦进展时间。
3. 添加或利用新增测试断言序列化公开响应不含内部字段。

### 任务 5：规范状态与完整验证

**文件：**

- 修改：`openspec/changes/arc-verify-resilience/tasks.md`

1. 仅在实现和测试证据齐备后勾选 2.1、2.2、2.3。
2. 运行 `node --import tsx --test tests/sanyi-resilience.test.ts`。
3. 运行相关三类服务、API、存储测试。
4. 运行 `node --import tsx --test "tests/*.test.ts"`。
5. 运行 `./node_modules/.bin/tsc --noEmit`。
6. 检查 `git diff --check` 与最终差异；遵守用户要求，不执行任何 git 写操作。
