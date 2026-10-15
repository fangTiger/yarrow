# rich-liuyao-question-chart 技术设计

## 概览

六爻问事的所有盘面事实都由纯 TypeScript 规则从六个爻值和第一掷区块时间戳推导。模型不生成卦名、纳甲、世应、旬空、旺衰或动变字段，只在服务端事实表之上写解读。

## 模块与文件

- `src/oracle/liuyao-chart.ts`
  - `deriveFiveHexagrams` 生成本、互、变、错、综五卦。
  - `deriveSexagenaryDay`、`deriveSolarMonth` 生成日柱、旬空和节气月。
  - `buildLiuyaoChart` 汇总卦宫、世应、纳甲、六亲、六神、伏神、旺衰、冲破和动变。
  - `strengthFor`、`describeElementRelation` 计算五行关系与旺相休囚死。
  - `LIUYAO_CHART_SOURCES` 记录规则来源说明。
- `src/oracle/question-classifier.ts`：`classifyQuestionSubject` 和 `confirmQuestionSubject` 提供事项与用神映射。
- `src/calendar/meihua.ts`：`deriveMeihua` 从同一组六爻生成体用与互变信息。
- `src/calendar/bianzhan.ts`：`selectPrimaryOracleText` 按动爻数选择主占卦辞或爻辞。
- `src/sanyi/facts.ts`：把盘面转换为三家和总述共用的可核对事实表。
- `src/sanyi/reading-service.ts`：在第六掷后以第一掷时间统一构建六爻、黄历和奇门。
- `web/components/FiveHexagrams.tsx`、`LiuyaoTable.tsx`、`FiveElementsDetail.tsx`：展示五卦、宽排盘表和五行角色。
- `web/lib/term-definitions.ts`：术语定义和结合本卦实际值的阅读引导。

## 数据流

1. `ReadingService.finalize` 从六个 `RecordedThrow.value` 得到自下而上的爻值数组。
2. 第一掷 `blockTimestamp` 同时作为六爻日月、黄历、奇门和梅花体用的时间输入。
3. `deriveFiveHexagrams` 用固定爻位规则计算五卦，不增加随机源。
4. `buildLiuyaoChart` 先查八宫与纳甲表，再以本宫五行推六亲、世应、六神、旬空和伏神。
5. 节气月决定月建和旺相休囚死；日月冲合及动爻同位变化补充破、暗动、进退和回头生克。
6. 已确认的事项写入 `focus`，给出用神、原神、忌神和仇神角色。
7. 完整 chart 随 reading 存档并公开；前端直接渲染，不在浏览器重复排盘。

## 关键决策

- 五卦、京房纳甲、八宫世应等采用表驱动和纯函数，便于固定卦例回归。
- 日柱按第一掷区块时间戳、UTC+8 民用零点换日；六掷跨块不改变卦时。
- 伏神只补本卦未现六亲，不在排盘层生成飞伏吉凶结论。
- 事项分类只看问题文本和用户选择，不读取成卦结果。
- 排盘模块只陈列事实；综合吉凶、把握和带条件应期属于三家输出并接受审计。

## 约束与已知限制

- `deriveSolarMonth` 有明确算法有效范围；近交节时通过 `boundaryUncertain` 暴露不确定性。
- 当前六爻日界固定为 UTC+8 零点，与八字可切换的晚子时口径不是同一设置。
- 宽表依赖自身滚动容器；页面级横向溢出由前端样式测试保护。
- 术语说明是固定规则加本卦实值，不代替三家对具体问题的解释。

## 测试

- `tests/liuyao-chart.test.ts`：五卦、纳甲、世应、旬空、旺衰、伏神与动变。
- `tests/question-classifier.test.ts`：事项与用神分类。
- `tests/meihua.test.ts`、`tests/bianzhan.test.ts`：体用和主占之辞。
- `tests/sanyi-facts.test.ts`：盘面事实表。
- `tests/frontend-reading-components.test.ts`：五卦、六爻表、术语和响应式展示。
