# 問轨五卦与京房纳甲排盘 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在零额外随机源、零额外模型调用下，为問轨增加首屏五卦象群和可复算京房纳甲排盘。

**Architecture:** 新建无副作用的 `src/oracle/liuyao-chart.ts` 作为唯一规则源；`question-oracle.ts` 只负责用区块哈希/时间戳组织结果，`question-interpreter.ts` 读取同一结构，React 只展示。既有賭轨与合约路径保持不变。

**Tech Stack:** TypeScript、Node test、React 18、CSS、Playwright CLI、OpenSpec。

---

### Task 1: 五卦纯函数

**Files:**
- Create: `src/oracle/liuyao-chart.ts`
- Create: `tests/liuyao-chart.test.ts`

1. 写失败测试，固定屯卦的互卦剥、错卦鼎、综卦蒙，并固定只翻转 6/9 的变卦。
2. 运行 `node --import tsx --test tests/liuyao-chart.test.ts`，确认因模块缺失失败。
3. 实现六爻校验、阴阳位转换、五卦映射与卦名查询。
4. 重跑测试，确认五卦用例通过。

### Task 2: 京房纳甲基础盘

**Files:**
- Modify: `src/oracle/liuyao-chart.ts`
- Modify: `tests/liuyao-chart.test.ts`
- Modify: `THIRD_PARTY_NOTICES.md`

1. 写表驱动失败测试，逐爻固定乾、坤、屯、大有的宫、世应、纳甲和六亲；用姤/遁固定伏神。
2. 运行目标测试，确认缺少排盘 API。
3. 实现八宫表、内外卦纳甲、地支五行、六亲和本宫伏神。
4. 补充来源与不做飞伏吉凶的边界说明，重跑目标测试。

### Task 3: 区块日柱、旬空与六神

**Files:**
- Modify: `src/oracle/liuyao-chart.ts`
- Modify: `tests/liuyao-chart.test.ts`

1. 写失败测试：2000-01-07 为甲子，2024-09-05 为壬申/戌亥空，并断言壬日起玄武。
2. 运行目标测试，确认日期 API 缺失。
3. 实现 UTC+8、00:00 日界、儒略日/六十甲子、旬空和六神。
4. 重跑目标测试并做边界重构。

### Task 4: 問轨响应和五卦解读

**Files:**
- Modify: `src/oracle/question-oracle.ts`
- Modify: `src/oracle/question-interpreter.ts`
- Modify: `src/frontend/server.ts`
- Modify: `scripts/run-frontend-mock.ts`
- Modify: `tests/question-oracle.test.ts`
- Modify: `tests/question-interpreter.test.ts`

1. 写失败测试，要求 block timestamp、五卦、排盘随响应返回，提示词包含五卦角色。
2. 运行两项测试确认失败。
3. 扩展区块源与响应；接入纯函数；固定 mock timestamp；更新确定性 mock 文案。
4. 重跑两项测试并确保一次起卦仍只有三次既有解释调用。

### Task 5: 首屏象群与排盘表

**Files:**
- Modify: `web/app.tsx`
- Modify: `web/styles.css`
- Modify: `tests/frontend-content.test.ts`

1. 写失败内容测试，固定五个按钮、切换详情、表头、流派说明、结果 DOM 顺序和 overflow 边界。
2. 运行测试确认失败。
3. 实现 `FiveHexagramConstellation`、`LiuyaoChartTable`，将象群置于结果标题之后。
4. 实现响应式密集布局与表内横向滚动，重跑内容测试。

### Task 6: 浏览器与全量验证

**Files:**
- Create: `output/playwright/question-rich-desktop.png`
- Create: `output/playwright/question-rich-mobile.png`
- Modify: `openspec/changes/rich-liuyao-question-chart/tasks.md`

1. 运行 mock 前端并用 Playwright CLI 完成分類确认与問轨。
2. 在桌面和移动视口分别断言五卦象群位于首屏、页面无横向溢出并截图。
3. 运行 `npm test`、`npm run typecheck`、`npm run frontend:build`、`npm run frontend:secrets`。
4. 更新 tasks 状态，逐条核对 spec 与未实现维度。

### Task 7: 可否决事项主题与用神

**Files:**
- Modify: `src/oracle/question-classifier.ts`
- Modify: `src/oracle/question-oracle.ts`
- Modify: `web/app.tsx`
- Test: `tests/question-classifier.test.ts`
- Test: `tests/question-oracle.test.ts`

1. 写失败测试，固定辞职→工作/官职→官鬼、分类架构隔离、用户改选与服务端白名单。
2. 运行目标测试确认因主题字段/API 缺失失败。
3. 实现确定性主题建议、确认结果与問轨传递；UI 显示建议并提供改选下拉框。
4. 重跑目标测试确认通过。

### Task 8: 月建、旺衰与冲破

**Files:**
- Modify: `src/oracle/liuyao-chart.ts`
- Test: `tests/liuyao-chart.test.ts`
- Modify: `THIRD_PARTY_NOTICES.md`

1. 写失败测试，固定 2024-09-05 申月、金月五级旺衰、月破与壬申日静爻暗动/日破。
2. 运行目标测试确认新字段缺失。
3. 实现 NOAA/Meeus 太阳视黄经、节气月、五级表及冲破标记，并补来源和临界边界。
4. 重跑目标测试确认通过。

### Task 9: 动变关系、卦性与阅读事实

**Files:**
- Modify: `src/oracle/liuyao-chart.ts`
- Modify: `src/oracle/question-interpreter.ts`
- Test: `tests/liuyao-chart.test.ts`
- Test: `tests/question-interpreter.test.ts`

1. 写失败测试覆盖进退神、回头生克、六冲六合、爻位象征和用神上下文。
2. 运行目标测试确认失败。
3. 实现最小规则与结构化五步阅读事实，让 provider/mock 读取同一用神上下文。
4. 重跑目标测试确认通过。

### Task 10: 术语展开、首屏与浏览器验收

**Files:**
- Modify: `web/app.tsx`
- Modify: `web/styles.css`
- Test: `tests/frontend-content.test.ts`
- Create: `output/playwright/question-rich-desktop.png`
- Create: `output/playwright/question-rich-mobile.png`

1. 写失败内容测试，固定原生术语展开、情境文案、五步引导、语料缺口与主题改选。
2. 实现就地说明和紧凑首屏布局，重跑内容测试。
3. 用 mock 服务走真实页面，桌面/移动检查卦象首屏可见、页面无横向溢出并截图。
4. 运行四项全量验证并回填 OpenSpec tasks。
