## 0. 准备

- [x] 0.1 建立 git 基线并创建 `sanyi-redesign` 分支
- [x] 0.2 归档五个已完成旧变更并同步 `openspec/specs/`
- [x] 0.3 编写里程碑 1A 实现计划 `docs/plans/2026-09-30-sanyi-milestone-1a.md`

## 1. 里程碑 1A：新站骨架与问事

- [ ] 1.1 历法基础：引入 `lunar-javascript`，实现 `src/calendar/almanac.ts` 与六爻引擎的日干支、月建一致性断言及抽样测试
- [ ] 1.2 奇门：用 kinqimen 生成 ≥ 40 个标准答案 fixtures，实现 `src/calendar/qimen.ts` 并逐字段通过
- [ ] 1.3 梅花体用 `src/calendar/meihua.ts` 与变占法 `src/calendar/bianzhan.ts` 及测试
- [ ] 1.4 问题分类 `src/sanyi/classify.ts` 及测试
- [ ] 1.5 六掷派生与区块约束 `src/sanyi/throws.ts` 及测试
- [ ] 1.6 断语 Schema、自洽校验与盘面证据核对 `src/sanyi/schema.ts`、`src/sanyi/audit.ts` 及测试
- [ ] 1.7 问事三家提示词与输入组装（程颐、京房、邵雍）及 mock provider 测试
- [ ] 1.8 存档与付款凭证持久化 `src/sanyi/store.ts` 及测试
- [ ] 1.9 编排服务 `src/sanyi/reading-service.ts`：创建、六掷、排盘、三家并行、失败隔离与免费重试、改事项只重跑京房
- [ ] 1.10 服务端新接口 `/api/now`、`/api/classify`、`/api/readings/*`，下线旧接口，接口安全测试
- [ ] 1.11 字体子集化脚本与 `web/fonts/mashanzheng-subset.woff2`
- [ ] 1.12 重写前端：tokens、首页、时空栏、分类标签、付款按钮、六掷、问事结果页（卦象、五卦、三家、合议线、排盘表、五行详情、术语说明、奇门、黄历）
- [ ] 1.13 文化守卫与秘密扫描测试；删除仅服务旧站的前端测试与模块
- [ ] 1.14 重写 `demo:rehearse`（mock 问事全流程）
- [ ] 1.15 用户验收里程碑 1A

## 2. 里程碑 1B：八字命理与运势

- [ ] 2.0 编写里程碑 1B 实现计划（在 1A 验收与八字样稿确认之后）
- [ ] 2.1 八字结果页样稿，用户确认
- [ ] 2.2 生辰档案：前端表单与本机存储、城市经度表、夏令时与真太阳时校正 `src/calendar/solar-time.ts`
- [ ] 2.3 八字排盘 `src/calendar/bazi.ts`（≥ 30 命例）与关系、神煞、五行计数 `src/calendar/bazi-relations.ts`
- [ ] 2.4 调候表 `src/calendar/data/qiongtong.json`（120 条）及完整性测试
- [ ] 2.5 命理与运势三家提示词与输入组装（沈孝瞻、余春台、任铁樵）及测试
- [ ] 2.6 编排服务支持八字：命理、运势时间范围、换日口径切换重排
- [ ] 2.7 八字结果页：四柱表、大运时间轴、五行分布、合冲刑害图、三家用神对照、三家断语
- [ ] 2.8 服务端存档不含原始生辰的断言测试
- [ ] 2.9 `demo:rehearse` 增加八字一卦
- [ ] 2.10 用户验收里程碑 1B

## 3. 收尾

- [ ] 3.1 README 改写为三易；旧 README 移至 `docs/archive/2026-09-hackathon-readme.md`；`package.json` 更名
- [ ] 3.2 `npm test`、`npm run typecheck`、`npm run frontend:secrets` 全部通过
- [ ] 3.3 OpenSpec 完整性检查后归档本变更，并为新增重要能力补充 `specs/*/design.md`
