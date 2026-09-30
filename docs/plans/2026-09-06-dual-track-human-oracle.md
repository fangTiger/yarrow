# 双轨人间问卦 Implementation Plan

> **For Claude：** 实施时必须使用 `executing-plans`，按任务逐项执行并在每批后核验。

**目标：** 将问卦主流程改为可否决的中立双轨，使問轨无需钱包即可完成，使賭轨保留人间问题并走人层判定。

**架构：** 新增与易者隔离的分类器、只读区块哈希起卦服务和问轨 HTTP API；现有 `DemoActionService` 只承载賭轨，并将命题元数据改为人层。React 工作台先分类确认，再按轨道调用互斥服务；卦历把天层保留为回放证据。

**技术栈：** TypeScript、Node test runner、React 18、viem、wagmi、esbuild、Playwright CLI。

---

### Task 1: 中立分类器

**Files:**
- Create: `src/oracle/question-classifier.ts`
- Test: `tests/question-classifier.test.ts`

1. 写表驱动失败测试，覆盖规范判断、心理状态、宽泛主观问题与明确未来事实。
2. 运行 `npm test -- tests/question-classifier.test.ts`，确认因模块缺失失败。
3. 实现独立分类结果、理由、周期与确认后轨道切换函数。
4. 重跑定向测试，确认通过且模块不导入卦象或三位易者。

### Task 2: 問轨确定性起卦与三家解读

**Files:**
- Create: `src/oracle/question-oracle.ts`
- Test: `tests/question-oracle.test.ts`

1. 写失败测试，固定同一块哈希和问题产生完全相同六爻，并断言钱包/签名/交易/gas 均为零。
2. 运行定向测试，确认因接口缺失失败。
3. 实现只读区块源、3-bit 铜钱派生、文王序映射和 provider/确定性 mock 解读。
4. 重跑定向测试，确认三家解读与复算证据通过。

### Task 3: 双轨 HTTP 边界

**Files:**
- Modify: `src/frontend/server.ts`
- Modify: `scripts/run-frontend-mock.ts`
- Test: `tests/frontend-server.test.ts`

1. 写失败测试，断言分类与問轨 API 无钱包字段即可调用，且错误轨道拒绝进入問轨。
2. 运行定向测试观察预期 404/接口缺失。
3. 接入同源 JSON 路由及 mock 服务；生产路径只读 Arc 最新块哈希。
4. 重跑定向测试确认无钱包、无秘密响应。

### Task 4: 賭轨人层元数据与演示限制

**Files:**
- Modify: `src/demo/service.ts`
- Modify: `src/demo/mock-driver.ts`
- Modify: `src/demo/arc-driver.ts`
- Test: `tests/demo-service.test.ts`
- Test: `tests/demo-arc-driver.test.ts`

1. 写失败测试，断言命题为 human/attested 或 mutual、原问题不被改写、稳态一笔签名、冲突为未决。
2. 运行定向测试确认现有天层命题导致失败。
3. 增加人层判定描述、短/长周期和见证状态；mock 短周期可结算，长周期停在等待。
4. 将 live 驱动的冻结命题改接已部署人层 resolver，保留天层实现但不再从主流程选择。
5. 重跑定向测试，确认賭轨不再出现 Arc USDC 阈值。

### Task 5: React 双轨工作台与卦历证据

**Files:**
- Modify: `web/app.tsx`
- Modify: `web/styles.css`
- Test: `tests/frontend-content.test.ts`

1. 写失败内容测试，固定分类确认、可否决、关键責任文案、零成本证据、长周期说明与人间事卦历。
2. 运行定向测试确认文案与状态缺失。
3. 重构表单为“分类 → 确认 → 轨道执行”，問轨完全绕开 wagmi；复用现有视觉 token 与六爻组件。
4. 为 mock 卦历加入已结算人间事夹具，并保留天层 backtested 统计证据区。
5. 重跑前端内容测试与构建。

### Task 6: 文档、浏览器与全量验证

**Files:**
- Modify: `docs/plans/2026-09-05-yijing-oracle-design.md`
- Modify: `README.md`
- Modify: `openspec/changes/dual-track-human-oracle/tasks.md`
- Create: `output/playwright/dual-track-*.png`

1. 更新设计文档第 7 节：双轨、人层主流程、地层免費解卦、天层证据位置。
2. 启动 `npm run frontend:mock`，用 Playwright 分别走問轨和賭轨，检查桌面与移动端、控制台 0 错误 0 警告并截图。
3. 运行 `npm test`、`npm run typecheck`、`npm run frontend:build`、`npm run frontend:secrets`。
4. 对照 spec 与 tasks，勾选真实完成项；明确记录链上花费 0 USDC 与任何未完成项。
