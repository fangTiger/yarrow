## 0. 准备

- [x] 0.1 建立 git 基线并创建 `sanyi-redesign` 分支
- [x] 0.2 归档五个已完成旧变更并同步 `openspec/specs/`
- [x] 0.3 编写里程碑 1A 实现计划 `docs/plans/2026-09-30-sanyi-milestone-1a.md`

## 1. 里程碑 1A：新站骨架与问事

- [x] 1.1 历法基础：引入 `lunar-javascript`，实现 `src/calendar/almanac.ts` 与六爻引擎的日干支、月建一致性断言及抽样测试
- [x] 1.2 奇门：用 kinqimen 生成 ≥ 40 个标准答案 fixtures，实现 `src/calendar/qimen.ts` 并逐字段通过
- [x] 1.3 梅花体用 `src/calendar/meihua.ts` 与变占法 `src/calendar/bianzhan.ts` 及测试
- [x] 1.4 问题分类 `src/sanyi/classify.ts` 及测试
- [x] 1.5 六掷派生与区块约束 `src/sanyi/throws.ts` 及测试
- [x] 1.6 断语 Schema、自洽校验与盘面证据核对 `src/sanyi/schema.ts`、`src/sanyi/audit.ts` 及测试
- [x] 1.7 问事三家提示词与输入组装（程颐、京房、邵雍）及 mock provider 测试
- [x] 1.8 存档与付款凭证持久化 `src/sanyi/store.ts` 及测试
- [x] 1.9 编排服务 `src/sanyi/reading-service.ts`：创建、六掷、排盘、三家并行、失败隔离与免费重试、改事项只重跑京房
- [x] 1.10 服务端新接口 `/api/now`、`/api/classify`、`/api/readings/*`，下线旧接口，接口安全测试
- [x] 1.11 字体子集化脚本与 `web/fonts/mashanzheng-subset.woff2`
- [x] 1.12 重写前端：tokens、首页、时空栏、分类标签、付款按钮、六掷、问事结果页（卦象、五卦、三家、合议线、排盘表、五行详情、术语说明、奇门、黄历）
- [x] 1.13 文化守卫与秘密扫描测试；删除仅服务旧站的前端测试与模块
- [x] 1.14 重写 `demo:rehearse`（mock 问事全流程）
- [x] 1.16 卦金改为单笔转账到三易收款地址（服务端核验转账日志、`GET /api/payment` 下发收款信息）；顶栏钱包状态栏；钱包报错中文化（1A 验收中发现）
- [ ] 1.15 用户验收里程碑 1A

## 2. 里程碑 1B：八字命理与运势

- [x] 2.0 编写里程碑 1B 实现计划（在 1A 验收与八字样稿确认之后）
- [x] 2.1 八字结果页样稿，用户确认（含十年流年运势面板，`docs/plans/assets/2026-10-06-bazi-mockup.html`）
- [x] 2.2 生辰档案：前端表单与本机存储、城市经度表、夏令时与真太阳时校正 `src/calendar/solar-time.ts`
- [x] 2.3 八字排盘 `src/calendar/bazi.ts`（≥ 30 命例，含十年流年窗口）与关系、神煞、五行计数 `src/calendar/bazi-relations.ts`
- [x] 2.4 调候表 `src/calendar/data/qiongtong.json`（120 条）及完整性测试
- [x] 2.5 命理与运势三家提示词与输入组装（沈孝瞻、余春台、任铁樵）、运势逐年断语 `years` 的 Schema 与核对规则及测试
- [x] 2.6 编排服务支持八字：命理、运势时间范围、换日口径切换重排
- [x] 2.7 八字结果页：四柱表、大运时间轴、流年运势面板（走势图、逐年表格、逐年短评）、五行分布、合冲刑害图、三家用神对照、三家断语
- [x] 2.8 服务端存档不含原始生辰的断言测试
- [x] 2.9 `demo:rehearse` 增加八字一卦
- [ ] 2.10 用户验收里程碑 1B

## 2A. 验收反馈修订（设计文档第 21 节）

- [x] 2A.1 问事核对器修复：卦名与爻辞原文整词处理、常用词剔除、锚定 + 全盘存在、神位标记、编号宽容解析（bug 修复，用户实测一卦三家全被拦）
- [x] 2A.2 自动六掷：付款后服务端自动连掷、续掷与退避重试，前端自动播放动画并去掉「摇」按钮，下线单掷接口
- [x] 2A.3 删错留对：重写上限两次、统一修补函数（问事、命理、运势）、存档记录删去处数、卡片注明
- [x] 2A.4 模型调用失败后台自动再试一次，「暂未落笔」只用于调用失败
- [x] 2A.5 白话总述：Schema、提示词、核对与倾向一致性、编排（三家之后、改事项、换日、重试后重算）、存档
- [x] 2A.6 结果页：白话总述置顶、三家折叠为「看三家依据」、进度提示（问事与八字）
- [ ] 2A.7 测试、mock 排练、真实模型冒烟（问事与八字各若干卦）与截图走查
- [x] 2A.8 首页简化：问事 / 运势 / 命理选项与细项行、输入框居中，卦历收进右上角小图标，去掉首页时空栏与右侧最近记录
- [x] 2A.9 生辰只收生辰八字：内嵌生辰行（日期、时辰或不知道、男女、记住），去掉城市与经纬度，不做真太阳时校正
- [ ] 2A.10 用户验收修订

## 3. 收尾

- [ ] 3.1 README 改写为三易；旧 README 移至 `docs/archive/2026-09-hackathon-readme.md`；`package.json` 更名
- [ ] 3.2 `npm test`、`npm run typecheck`、`npm run frontend:secrets` 全部通过
- [ ] 3.3 OpenSpec 完整性检查后归档本变更，并为新增重要能力补充 `specs/*/design.md`
