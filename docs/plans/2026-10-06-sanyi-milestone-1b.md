# 三易里程碑 1B 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已验收的 1A 上完成生辰校正、八字客观排盘、命理与运势三家及隐私安全的结果存档；第 6 轮按确认样稿重写 B6b，修正逐年关系、mock 区分度与神煞去重，并补 B7 截图守卫，全部代码在隔离目录演练。

**Architecture:** `src/calendar/` 提供确定性的生辰转换、校正与命盘事实，`src/sanyi/` 扩展按类型区分的断语、核对与编排，前端消费明确字段。原始生辰和逐步校正详情只用于请求与本机展示，持久化边界使用字段白名单；八字出生时刻与问事卦时保持独立。

**Tech Stack:** TypeScript 5.9 ESM、Node.js ≥ 22、React 18、AJV、现有 `lunar-javascript@1.7.7`、Node `test` + `tsx`；开发期使用现有 Python 环境中的 `sxtwl==2.0.6` 生成双源基准。类型检查启用 strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes。

---

## 文件结构

以下为 1B 全部文件的职责清单；后续分块补充完整代码，不将本清单误当成已完成实现。既有问事流程与付款行为须保持回归通过。

### 新建

| 文件 | 单一职责 | 分块 |
|---|---|---|
| `src/calendar/solar-time.ts` | 民用时间运算、显式夏令时表、NOAA 均时差与逐步校正 | B1 |
| `src/calendar/data/cities.json` | 34 个省级行政区首府的经纬度数据 | B1 |
| `src/calendar/cities.ts` | 城市表类型化读取与来源说明 | B1 |
| `src/sanyi/birth-profile.ts` | 生辰请求校验与农历转公历 | B1 |
| `tests/solar-time.test.ts` | 夏令时边界、Intl 互校、真太阳时与组合顺序 | B1 |
| `tests/birth-profile.test.ts` | 生辰合法性、闰月与城市完整性 | B1 |
| `src/calendar/bazi.ts` | 四柱、派生事实、起运、大运与指定年份流年流月 | B2 |
| `tools/bazi/generate_fixtures.py` | 探测 sxtwl 口径并生成独立四柱标准答案 | B2 |
| `tests/fixtures/bazi/*.json` | 生成的 ≥ 40 个时刻、双 sect 标准答案及口径元数据 | B2 |
| `tests/bazi.test.ts` | 核验命例、顺逆、缺时辰与换日口径 | B2 |
| `tests/bazi-fixtures.test.ts` | 双源逐字段比对和覆盖矩阵守卫 | B2 |
| `src/calendar/bazi-relations.ts` | 原局及运年关系、七种神煞与分层五行计数 | B3 |
| `src/calendar/data/qiongtong.json` | 120 条调候用干、原书次序、章节与逐字摘句 | B3 |
| `src/calendar/qiongtong.ts` | 调候表合法性与日干月令查表 | B3 |
| `tests/bazi-relations.test.ts` | 关系、神煞、藏干分层计数 | B3 |
| `tests/qiongtong.test.ts` | 120 条覆盖、字段与出处完整性 | B3 |
| `src/sanyi/bazi-schema.ts` | 命理和运势独立输出 Schema 与类型 | B4a |
| `src/sanyi/bazi-facts.ts` | 命盘、关系、神煞、运年和调候编号事实 | B4a |
| `src/sanyi/bazi-audit.ts` | 十神与命盘组合的证据及正文核对 | B4a |
| `src/sanyi/schools/bazi-shared.ts` | 命理三家共用安全边界和输入契约 | B4b |
| `src/sanyi/schools/shenxiaozhan.ts` | 格局派提示词与输入组装 | B4b |
| `src/sanyi/schools/yuchuntai.ts` | 调候派提示词与对应调候条目组装 | B4b |
| `src/sanyi/schools/rentieqiao.ts` | 扶抑派提示词与输入组装 | B4b |
| `src/sanyi/schools/bazi-index.ts` | 命理三家稳定键与定义集合 | B4b |
| `src/sanyi/bazi-school-runner.ts` | 单家命理或运势调用、核对和一次重写 | B4b |
| `src/sanyi/mock-bazi-schools.ts` | 从事实表生成确定性的命理与运势断语 | B4b |
| `tests/helpers/sample-bazi.ts` | B4 测试共用已核验命例及事实输入 | B4a |
| `tests/sanyi-bazi-schema.test.ts` | 五个命理分项与运势吉凶把握约束 | B4a |
| `tests/sanyi-bazi-facts.test.ts` | 事实编号完整性与缺时柱隔离 | B4a |
| `tests/sanyi-bazi-audit.test.ts` | 未知引用、虚构十神及正文组合拒绝 | B4a |
| `tests/sanyi-bazi-schools.test.ts` | 三家输入隔离与调候原文约束 | B4b |
| `tests/sanyi-bazi-school-runner.test.ts` | 核对重写、拒绝和调用失败 | B4b |
| `src/sanyi/fortune-context.ts` | 按注入时钟解析 horizon 的立春年、节气月与流日 | B5 |
| `src/sanyi/bazi-reading-service.ts` | 命盘创建、三家并行与免费换日重排 | B5 |
| `src/sanyi/bazi-public.ts` | 命盘存档及公开响应的隐私白名单映射 | B5 |
| `tests/sanyi-fortune-context.test.ts` | 五种 horizon 与立春、交节和日界 | B5 |
| `tests/sanyi-bazi-reading-service.test.ts` | 付款幂等、并行失败隔离、重试和换日限额 | B5 |
| `tests/sanyi-bazi-privacy.test.ts` | 存档、日志、公开响应不含原始生辰及可还原校正详情 | B5 |
| `web/lib/birth-profile.ts` | 本机本人档案容错存取 | B6 |
| `web/lib/birth-entry.ts` | 付款前与 400 补问的纯函数 | B6a |
| `web/lib/liunian-chart.ts` | 流年几何、分组与数据对齐 | B6b |
| `web/components/BirthEntry.tsx` | 表单与付款插槽隔离 | B6a |
| `web/styles/bazi.css` | 样稿八字样式，.bazi 隔离 | B6b |
| `tests/frontend-bazi-round6.test.ts` | 样稿结构、关系过滤、神煞去重与 mock 区分 | B6b |
| `scripts/bazi-screenshot-server.ts` | 四类 mock 存档与固定时钟截图服务 | B7 |
| `web/components/LiuNianPanel.tsx` | 流年图表及逐年短评 | B6b |
| `tests/frontend-birth-entry.test.ts` | 缺档案不挂载付款 | B6a |
| `tests/frontend-liunian-chart.test.ts` | 坐标、交运与空值断线 | B6b |
| `tests/frontend-bazi-font.test.ts` | 现场摘要与子集字形守卫 | B7 |
| `tests/sanyi-bazi-public-warnings.test.ts` | 交节日公开警示回归 | B5a |
| `web/fonts/mashanzheng-subset.sha256` | 执行时生成的字体摘要 | B7 |
| `web/components/BirthForm.tsx` | 生辰编辑、合法性提示与使用告知 | B6 |
| `web/components/BirthCorrection.tsx` | 本机生辰摘要与逐步校正展示 | B6 |
| `web/components/BaziTable.tsx` | 四柱及缺时柱的客观字段展示 | B6 |
| `web/components/BaziLuck.tsx` | 大运时间轴与所问年份高亮 | B6 |
| `web/components/BaziRelations.tsx` | 关系图与对应文字列表 | B6 |
| `web/components/BaziElements.tsx` | 天干、本气、中气、余气五行分布 | B6 |
| `web/components/BaziSchools.tsx` | 三家用神对照与命理、运势断语展示 | B6 |
| `web/components/DayBoundaryChange.tsx` | 免费换日动作与剩余次数展示 | B6 |
| `web/pages/BaziReading.tsx` | 组合八字结果页与本机资料缺失状态 | B6 |
| `tests/frontend-birth-profile.test.ts` | 本机存取失败仍可排盘 | B6 |
| `tests/frontend-bazi-components.test.ts` | 样稿字段、三家状态、缺时柱与移动布局 | B6 |
| `docs/plans/2026-10-06-sanyi-1b-acceptance.md` | 1B 用户验收步骤与证据 | B7 |

### 修改

| 文件 | 单一职责及修改边界 | 分块 |
|---|---|---|
| `src/types/lunar-javascript.d.ts` | 保留 1A 声明，扩展实际使用的农历和八字 API | B1–B2 |
| `src/sanyi/store.ts` | 将 `StoredReading` 扩为判别联合并保留原子写与付款索引 | B5 |
| `src/sanyi/reading-service.ts` | 既有问事编排显式收窄类型并接入跨类型重试入口 | B5 |
| `src/sanyi/api.ts` | 开放命理运势创建、换日与按类型公开响应 | B5 |
| `src/sanyi/audit.ts` | 最长匹配分词函数增加可选扩展词表，问事默认不变 | B4a |
| `src/sanyi/mock-provider.ts` | 根据任务类型路由至对应确定性 mock | B4b |
| `src/sanyi/http-errors.ts` | 新输入错误与状态冲突继续映射中文 HTTP 错误 | B5 |
| `src/sanyi/log.ts` | 限定安全字段，剔除原始生辰及模型错误中的输入回显 | B5 |
| `src/frontend/server.ts` | 接入换日路由并保留 Origin、JSON、体积安全边界 | B5 |
| `scripts/rehearse-demo.ts` | 排练问事与夏令时命例各一份 | B5 |
| `tests/sanyi-api.test.ts` | 命理、运势、换日和输入错误接口测试 | B5 |
| `tests/sanyi-store.test.ts` | 三种存档类型及付款跨类型防复用 | B5 |
| `tests/sanyi-reading-service.test.ts` | 保持问事回归并验证联合类型收窄 | B5 |
| `tests/frontend-server.test.ts` | 新路由与安全边界 | B5 |
| `tests/sanyi-rehearsal.test.ts` | 问事与八字排练结果完整性 | B5 |
| `web/lib/api.ts` | 三种结果的类型化客户端及换日请求 | B6 |
| `web/lib/reading-state.ts` | 按 reading 类型派生页面状态 | B6 |
| `web/lib/term-definitions.ts` | 八字字段的就地术语解释 | B6 |
| `web/components/ClassificationTags.tsx` | 命理和运势标签、时间范围选择 | B6 |
| `web/components/QuestionForm.tsx` | 付款前生辰补问与改问事退路 | B6 |
| `web/components/RecentReadings.tsx` | 命理、运势记录标签 | B6 |
| `web/pages/Reading.tsx` | 根据联合类型路由至问事或八字结果 | B6 |
| `web/main.tsx` | 引入隔离 bazi.css | B6b2 |
| `web/styles/components.css` | 仅补生辰表单样式，问事规则原样保留 | B6 |
| `web/styles/layout.css` | 经确认的八字响应式布局 | B6 |
| `web/fonts/mashanzheng-chars.txt` | 补齐三家姓氏和八字固定标题 | B6 |
| `web/styles/tokens.css` | 翠色及透明 token 同步 | B6b |
| `web/components/CoinThrow.tsx` | 问事响应显式收窄 | B6b |
| `scripts/font-charset.ts` | 重跑仍保留八字固定字 | B6b |
| `tests/frontend-home.test.ts` | 去除八字未开放的旧期望 | B6a |
| `tests/frontend-font.test.ts` | 新增固定字守卫 | B6b |
| `openspec/changes/sanyi-chinese-redesign/specs/birth-profile/spec.md` | 明确校正本机展示边界 | B7 |
| `web/fonts/mashanzheng-subset.woff2` | 从既有字表与工具重新生成字体资产 | B6 |
| `tests/frontend-sanyi-content.test.ts` | 八字新增文案继续满足文化守卫 | B7 |
| `openspec/changes/sanyi-chinese-redesign/tasks.md` | 按实际完成状态更新第 2 节 | B7 |

无需新增依赖；不修改运行时配置、密钥或 1A 历法算法。B7 清理仅限 1B 中间占位与过期提示，不删除仍有调用的问事模块。

## 分块预告

- Chunk B1：生辰与出生时刻校正（本轮修订，Task B1.1–B1.3）。
- Chunk B2：八字排盘引擎（本轮修订，Task B2.1–B2.3）。
- Chunk B3：合冲刑害、神煞、五行计数与《穷通宝鉴》调候表（本轮修订 B3.1–B3.5）。
- Chunk B4a：命理与运势输出 Schema、事实表、最长匹配核对（Task B4.1–B4.3）。
- Chunk B4b：三家输入与提示词、单家运行器、确定性 mock 与路由（Task B4.4–B4.7）。
- Chunk B5：编排、接口与排练（命理、运势、换日切换、生辰隐私）。
- Chunk B6a：生辰表单、本机档案与付款前补问。
- Chunk B6b1：流年几何、样稿结构与数据回归。
- Chunk B6b2：客观命盘、三家、本机校正、样稿样式与字体字表。
- Chunk B7：清理与 1B 验收。

## 已核对的接口与执行约束

- 已逐一阅读本任务指定的设计章节、五份 spec、第 2 节任务、11 份 1A 源码、1A 计划及八字样稿。`classify.ts` 已有 `destiny`、`fortune`、`FortuneHorizon`，无需重复分类实现。
- 现有 `StoredReading.kind` 只有 `question`，`SchoolState.output` 为 `QuestionSchoolOutput`，`schools` 键为 `chengyi/jingfang/shaoyong`。不能把八字三家塞入这些键或假定存档已有 birth 字段。
- `api.ts` 的 `PublicReading.payment.firstHash` 来自 `payment.transactionHash`；`createReading` 仍以 `NotOpenYetError` 拒绝命理运势。B5 扩展实际边界，B6 再按联合类型消费。
- `FactTable` 为 `Map<string, { id, label, tokens: ReadonlySet<string> }>`；当前 `audit.ts` 只扫描问事词表，`runSchool` 只使用问事 Schema。B4 用独立八字核对器与运行器，复用事实表契约。
- `almanacAt` 返回对象字段，不是字符串数组：如 `solar.text`、`lunar.date`、`solarTerms.current`、`cycle.day`。样稿顶部取解读时刻的既有黄历；出生四柱另外取 `BaziChart.pillars`，绝不混用。
- `deriveSolarMonth` 用 NOAA/Meeus 量计算太阳视黄经。B1 使用同源的儒略世纪、平黄经、平近点角及黄赤交角计算均时差，不拿节气月函数代替均时差。
- `openspec list --specs` 与 `openspec list` 已执行；相关规范在现有变更中。CLI 遥测联网失败不影响清单。此轮只写计划，不勾 tasks，不创建重复提案。
- 本轮不提交、不安装、不修改其它项目文件。下列新建文件用完整代码块，既有文件用精确 diff；主管按文末方法抽取并应用到隔离目录验证。实现者每次先写测试、确认 RED，再落实现并确认 GREEN，最后整理；本轮没有实施这些勾选任务。
- 设计及 bazi-chart 已更正为癸未、7 年 2 月 20 天、1997-08-04，不再留命例修订疑点。新增窗口、逐年断语、天干相冲、半合/拱与章节摘句规范已纳入；B4 才定义 `years` Schema 与核对。

## Chunk B1：生辰与出生时刻校正

> 校正顺序固定为夏令时 → 真太阳时 → B2 换日。大陆夏令时按用户核验表；香港、澳门、台北不套大陆表，其当地历史夏令时由出生记录核对。未知时辰以当日正午排三柱和近似大运；仅实际交节日暂停大运并警示年/月柱不确定。

### Task B1.1：扩展真实历法类型边界

**文件：** 修改 `src/types/lunar-javascript.d.ts`。本文件一次给出 B1/B2 所需声明，保留 1A 的全部方法；接口与本机已装 1.7.7 源码对照。

- [ ] **Step 1：写 B1.3 的失败测试，再运行类型检查。**

运行：`node --import tsx --test tests/birth-profile.test.ts`。
预期 RED：新模块不存在。只扩展声明不能把运行时缺失误报为 GREEN。

- [ ] **Step 2：应用声明修改片段；先不写业务实现。**

修改 `src/types/lunar-javascript.d.ts`，以下 diff 的 `-` 为精确旧片段、`+` 为新片段；上下文与空行保留。

```diff
--- a/src/types/lunar-javascript.d.ts
+++ b/src/types/lunar-javascript.d.ts
@@ -1,25 +1,119 @@
 // src/types/lunar-javascript.d.ts
 declare module "lunar-javascript" {
-  interface SolarValue { toYmdHms(): string; }
-  interface JieQiValue { getName(): string; getSolar(): SolarValue; }
-  interface NineStarValue { toString(): string; }
+  interface SolarValue {
+    nextYear(years: number): SolarValue;
+    toYmd(): string;
+    toYmdHms(): string;
+    getYear(): number;
+    getMonth(): number;
+    getDay(): number;
+    getHour(): number;
+    getMinute(): number;
+    getSecond(): number;
+    getLunar(): LunarValue;
+  }
+  interface JieQiValue {
+    getName(): string;
+    getSolar(): SolarValue;
+  }
+  interface NineStarValue {
+    toString(): string;
+  }
+  interface LiuYueValue {
+    getMonthInChinese(): string;
+    getGanZhi(): string;
+  }
+  interface LiuNianValue {
+    getYear(): number;
+    getGanZhi(): string;
+    getAge(): number;
+    getLiuYue(): LiuYueValue[];
+  }
+  interface DaYunValue {
+    getIndex(): number;
+    getGanZhi(): string;
+    getStartAge(): number;
+    getEndAge(): number;
+    getStartYear(): number;
+    getEndYear(): number;
+    getLiuNian(count?: number): LiuNianValue[];
+  }
+  interface YunValue {
+    isForward(): boolean;
+    getStartYear(): number;
+    getStartMonth(): number;
+    getStartDay(): number;
+    getStartSolar(): SolarValue;
+    getDaYun(count?: number): DaYunValue[];
+  }
   interface EightCharValue {
     setSect(sect: 1 | 2): void;
-    getYear(): string; getMonth(): string; getDay(): string; getTime(): string;
-    getYearNaYin(): string; getMonthNaYin(): string; getDayNaYin(): string; getTimeNaYin(): string;
+    getYear(): string;
+    getMonth(): string;
+    getDay(): string;
+    getTime(): string;
+    getYearNaYin(): string;
+    getMonthNaYin(): string;
+    getDayNaYin(): string;
+    getTimeNaYin(): string;
+    getYearShiShenGan(): string;
+    getMonthShiShenGan(): string;
+    getTimeShiShenGan(): string;
+    getYearHideGan(): string[];
+    getMonthHideGan(): string[];
+    getDayHideGan(): string[];
+    getTimeHideGan(): string[];
+    getYearShiShenZhi(): string[];
+    getMonthShiShenZhi(): string[];
+    getDayShiShenZhi(): string[];
+    getTimeShiShenZhi(): string[];
+    getYearDiShi(): string;
+    getMonthDiShi(): string;
+    getDayDiShi(): string;
+    getTimeDiShi(): string;
+    getTaiYuan(): string;
+    getMingGong(): string;
+    getShenGong(): string;
+    getYun(gender: 0 | 1, startSect?: 1 | 2): YunValue;
   }
   interface LunarValue {
-    toString(): string; getTimeZhi(): string; getYueXiang(): string;
-    getEightChar(): EightCharValue; getDayXun(): string; getDayXunKong(): string;
-    getPrevJieQi(): JieQiValue; getNextJieQi(): JieQiValue;
-    getWuHou(): string; getHou(): string; getXiu(): string; getZheng(): string;
-    getAnimal(): string; getGong(): string; getShou(): string;
-    getZhiXing(): string; getDayTianShen(): string; getDayTianShenType(): string;
-    getDayChongDesc(): string; getDaySha(): string; getDayYi(): string[]; getDayJi(): string[];
-    getPengZuGan(): string; getPengZuZhi(): string; getDayNineStar(): NineStarValue;
-    getDayPositionXiDesc(): string; getDayPositionCaiDesc(): string; getDayPositionFuDesc(): string;
+    toString(): string;
+    getYear(): number;
+    getMonth(): number;
+    getDay(): number;
+    getSolar(): SolarValue;
+    getTimeZhi(): string;
+    getYueXiang(): string;
+    getEightChar(): EightCharValue;
+    getDayXun(): string;
+    getDayXunKong(): string;
+    getCurrentJie(): JieQiValue | null;
+    getPrevJieQi(): JieQiValue;
+    getNextJieQi(): JieQiValue;
+    getJieQiTable(): Record<string, SolarValue>;
+    getWuHou(): string;
+    getHou(): string;
+    getXiu(): string;
+    getZheng(): string;
+    getAnimal(): string;
+    getGong(): string;
+    getShou(): string;
+    getZhiXing(): string;
+    getDayTianShen(): string;
+    getDayTianShenType(): string;
+    getDayChongDesc(): string;
+    getDaySha(): string;
+    getDayYi(): string[];
+    getDayJi(): string[];
+    getPengZuGan(): string;
+    getPengZuZhi(): string;
+    getDayNineStar(): NineStarValue;
+    getDayPositionXiDesc(): string;
+    getDayPositionCaiDesc(): string;
+    getDayPositionFuDesc(): string;
   }
   interface SolarFactory {
+    fromYmd(year: number, month: number, day: number): SolarValue;
     fromYmdHms(
       year: number,
       month: number,
@@ -27,8 +121,19 @@
       hour: number,
       minute: number,
       second: number,
-    ): { getLunar(): LunarValue };
+    ): SolarValue;
   }
-  const lunarPkg: { Solar: SolarFactory };
+  const lunarPkg: {
+    Solar: SolarFactory;
+    Lunar: { fromYmd(year: number, month: number, day: number): LunarValue };
+    LunarYear: { fromYear(year: number): { getLeapMonth(): number } };
+    LunarMonth: {
+      fromYm(year: number, month: number): { getDayCount(): number } | null;
+    };
+    LunarUtil: {
+      SHI_SHEN: Record<string, string>;
+      ZHI_HIDE_GAN: Record<string, string[]>;
+    };
+  };
   export default lunarPkg;
 }
```

- [ ] **Step 3：运行 `npm run typecheck`。** 原有 1A 声明不得回退；B1.3 尚不存在时，其失败保持到 B1.3 实现。

### Task B1.2：校正纯函数与边界测试

**文件：** 新建 `tests/solar-time.test.ts`、`src/calendar/solar-time.ts`。

- [ ] **Step 1：写完整测试。** 测试独立写六年表，避免拿被测表作为唯一真值。

```ts
// tests/solar-time.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  DST_RANGES,
  civilFromMillis,
  civilMillis,
  correctBirthTime,
  daylightSavingAt,
  equationOfTimeMinutes,
  type CivilTime,
} from "../src/calendar/solar-time.js";

const ranges = [
  [1986, 5, 4, 9, 14],
  [1987, 4, 12, 9, 13],
  [1988, 4, 17, 9, 11],
  [1989, 4, 16, 9, 17],
  [1990, 4, 15, 9, 16],
  [1991, 4, 14, 9, 15],
] as const;

function at(year: number, month: number, day: number, hour: number, minute = 0): CivilTime {
  return { year, month, day, hour, minute, second: 0 };
}

test("六年显式表及钟表边界，重复时段选夏令时", () => {
  assert.equal(DST_RANGES.length, 6);
  for (const [year, sm, sd, em, ed] of ranges) {
    const start = at(year, sm, sd, 2);
    const end = at(year, em, ed, 2);
    const before = civilFromMillis(civilMillis(start) - 60_000);
    assert.equal(daylightSavingAt(before).active, false);
    assert.equal(daylightSavingAt(start).active, true);
    assert.equal(daylightSavingAt(at(year, em, ed, 0, 59)).repeated, false);
    for (const minute of [0, 30, 59]) {
      const result = daylightSavingAt(at(year, em, ed, 1, minute));
      assert.equal(result.active, true);
      assert.equal(result.repeated, true);
    }
    assert.equal(daylightSavingAt(end).active, false);
    assert.equal(daylightSavingAt(at(year, em, ed, 2, 1)).active, false);
    const corrected = correctBirthTime(at(year, em, ed, 1, 30), true, null);
    assert.equal(corrected.effective.hour, 0);
    assert.match(corrected.steps[0]?.description ?? "", /重复时段，按夏令时计/);
  }
  assert.equal(daylightSavingAt(at(1985, 7, 1, 12)).active, false);
  assert.equal(daylightSavingAt(at(1992, 7, 1, 12)).active, false);
});

test("Intl Asia/Shanghai 在真实 UTC 转换瞬间与六年表逐年互校", () => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  function offsetMinutes(instant: number): number {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
    const local = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    return (local - instant) / 60_000;
  }
  for (const [year, sm, sd, em, ed] of ranges) {
    const row = DST_RANGES.find((item) => item.year === year);
    assert.ok(row);
    assert.deepEqual(row.start, at(year, sm, sd, 2));
    assert.deepEqual(row.end, at(year, em, ed, 2));
    const startUtc = civilMillis(row.start) - 8 * 3_600_000;
    const endUtc = civilMillis(row.end) - 9 * 3_600_000;
    assert.equal(offsetMinutes(startUtc - 60_000), 480);
    assert.equal(offsetMinutes(startUtc), 540);
    assert.equal(offsetMinutes(endUtc - 60_000), 540);
    assert.equal(offsetMinutes(endUtc), 480);
    for (let instant = startUtc + 86_400_000; instant < endUtc; instant += 86_400_000) {
      assert.equal(offsetMinutes(instant), 540);
    }
  }
});

test("真太阳时规格：87.6 度使巳时变辰时", () => {
  const original = at(2000, 11, 3, 9, 10);
  const result = correctBirthTime(original, true, 87.6);
  const minutes = result.effective.hour * 60 + result.effective.minute;
  assert.ok(minutes >= 7 * 60 + 14 && minutes <= 7 * 60 + 20);
  assert.equal(Math.floor((result.effective.hour + 1) / 2) % 12, 4);
  assert.ok(Math.abs(result.longitudeMinutes + 129.6) < 1e-9);
  assert.ok(result.equationMinutes >= 15 && result.equationMinutes <= 17);
  assert.equal(result.steps[0]?.kind, "dst");
  assert.equal(result.steps[1]?.kind, "solar");
});

test("先夏令时再太阳时、跨日期运算、未填经度与缺时辰", () => {
  const original = at(1990, 5, 15, 15, 30);
  const result = correctBirthTime(original, true, 87.6);
  const standard = at(1990, 5, 15, 14, 30);
  assert.deepEqual(result.steps[0]?.after, standard);
  assert.deepEqual(result.steps[1]?.before, standard);
  const eot = equationOfTimeMinutes(standard);
  const expected = civilFromMillis(civilMillis(standard) + Math.round((-129.6 + eot) * 60_000));
  assert.deepEqual(result.effective, expected);
  assert.deepEqual(correctBirthTime(original, true, null).effective, standard);
  const crossed = correctBirthTime(at(2000, 11, 3, 0, 10), true, 73);
  assert.equal(crossed.effective.day, 2);
  const missing = correctBirthTime(at(1990, 5, 15, 12), false, 87.6);
  assert.equal(missing.timeKnown, false);
  assert.ok(missing.steps.every((step) => !step.applied && step.before === null && step.after === null));
  assert.equal(missing.effective.hour, 12);
  assert.throws(() => correctBirthTime(original, true, 136), /经度/);
});

 test("港澳台不套大陆夏令时，未填地点提示补填", () => {
  const civil = at(1988, 7, 1, 8, 30);
  const hk = correctBirthTime(civil, true, null, { mainlandDst: false, birthplace: "香港" });
  assert.equal(hk.effective.hour, 8);
  assert.equal(hk.steps[0]?.applied, false);
  assert.match(hk.steps[0]?.description ?? "", /出生地为香港，未按中国大陆夏令时校正/);
  assert.match(hk.steps[0]?.description ?? "", /当地历史夏令时请按出生记录自行核对/);
  const bj = correctBirthTime(civil, true, null, { mainlandDst: true, birthplace: "北京" });
  assert.equal(bj.effective.hour, 7);
  assert.equal(bj.steps[0]?.applied, true);
  const empty = correctBirthTime(civil, true, null);
  assert.equal(empty.effective.hour, 7);
  assert.match(empty.steps[0]?.description ?? "", /若出生在港澳台或海外，请填写出生地/);
});
```

- [ ] **Step 2：运行 `node --import tsx --test tests/solar-time.test.ts`，确认模块缺失导致 RED。**
- [ ] **Step 3：实现完整纯函数。** 起始日不存在的 02:00–03:00 仍按用户指定边界扣一小时，并标记钟表跳跃时段；结束日 01:00–02:00 选第一次，即夏令时。

```ts
// src/calendar/solar-time.ts
export interface CivilTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}
export interface CorrectionStep {
  kind: "dst" | "solar";
  applied: boolean;
  before: CivilTime | null;
  deltaMinutes: number;
  after: CivilTime | null;
  description: string;
}
export interface CorrectedBirthTime {
  effective: CivilTime;
  timeKnown: boolean;
  longitudeMinutes: number;
  equationMinutes: number;
  steps: readonly CorrectionStep[];
}

export function civilMillis(value: CivilTime): number {
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
}
export function civilFromMillis(value: number): CivilTime {
  const date = new Date(value);
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
  };
}
export function assertCivilTime(value: CivilTime): void {
  if (Object.values(value).some((part) => !Number.isInteger(part))) {
    throw new Error("出生日期与时间必须为整数");
  }
  if (value.year < 1900 || value.year > 2099) {
    throw new Error("出生年份仅支持 1900–2099 年");
  }
  const actual = civilFromMillis(civilMillis(value));
  if (Object.keys(value).some((key) => value[key as keyof CivilTime] !== actual[key as keyof CivilTime])) {
    throw new Error("出生日期或时间不合法");
  }
}
export function assertLongitude(value: number): void {
  if (!Number.isFinite(value) || value < 73 || value > 135) {
    throw new Error("经度须在 73°–135° 之间");
  }
}

const dates = [
  [1986, 5, 4, 9, 14], [1987, 4, 12, 9, 13], [1988, 4, 17, 9, 11],
  [1989, 4, 16, 9, 17], [1990, 4, 15, 9, 16], [1991, 4, 14, 9, 15],
] as const;
// 来源：本任务经 Asia/Shanghai 系统时区数据库核验的六年表。
export const DST_RANGES = dates.map(([year, sm, sd, em, ed]) => ({
  year,
  start: { year, month: sm, day: sd, hour: 2, minute: 0, second: 0 },
  end: { year, month: em, day: ed, hour: 2, minute: 0, second: 0 },
}));

export function daylightSavingAt(value: CivilTime): {
  active: boolean;
  repeated: boolean;
  skipped: boolean;
} {
  const row = DST_RANGES.find((item) => item.year === value.year);
  if (!row) {
    return { active: false, repeated: false, skipped: false };
  }
  const current = civilMillis(value);
  const start = civilMillis(row.start);
  const end = civilMillis(row.end);
  return {
    active: current >= start && current < end,
    repeated: current >= end - 3_600_000 && current < end,
    skipped: current >= start && current < start + 3_600_000,
  };
}

// 来源：NOAA Solar Calculator 的 calcEquationOfTime，采用完整儒略日而非表格近似。
export function equationOfTimeMinutes(standard: CivilTime): number {
  const utc = civilMillis(standard) - 8 * 3_600_000;
  const jd = utc / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525;
  const rad = Math.PI / 180;
  const l0 = (280.46646 + t * (36_000.76983 + t * 0.0003032)) * rad;
  const m = (357.52911 + t * (35_999.05029 - t * 0.0001537)) * rad;
  const e = 0.016708634 - t * (0.000042037 + t * 0.0000001267);
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const mean = 23 + (26 + seconds / 60) / 60;
  const obliquity = (mean + 0.00256 * Math.cos((125.04 - 1934.136 * t) * rad)) * rad;
  const y = Math.tan(obliquity / 2) ** 2;
  const equation = y * Math.sin(2 * l0) - 2 * e * Math.sin(m)
    + 4 * e * y * Math.sin(m) * Math.cos(2 * l0)
    - 0.5 * y * y * Math.sin(4 * l0) - 1.25 * e * e * Math.sin(2 * m);
  return 4 * equation / rad;
}

export function correctBirthTime(
  original: CivilTime,
  timeKnown: boolean,
  longitude: number | null,
  options = { mainlandDst: true, birthplace: null as string | null },
): CorrectedBirthTime {
  assertCivilTime(original);
  if (longitude !== null) {
    assertLongitude(longitude);
  }
  if (!timeKnown) {
    const steps: CorrectionStep[] = ["dst", "solar"].map((kind) => ({
      kind: kind as CorrectionStep["kind"], applied: false, before: null, after: null,
      deltaMinutes: 0, description: "时辰未知，未校正；三柱以当日正午为代表",
    }));
    return {
      effective: { ...original, hour: 12, minute: 0, second: 0 }, timeKnown,
      longitudeMinutes: 0, equationMinutes: 0, steps,
    };
  }
  const dst = options.mainlandDst
    ? daylightSavingAt(original)
    : { active: false, repeated: false, skipped: false };
  const delta = dst.active ? -60 : 0;
  const standard = civilFromMillis(civilMillis(original) + delta * 60_000);
  const longitudeMinutes = longitude === null ? 0 : (longitude - 120) * 4;
  const equationMinutes = longitude === null ? 0 : equationOfTimeMinutes(standard);
  const solarDelta = longitudeMinutes + equationMinutes;
  const effective = civilFromMillis(civilMillis(standard) + Math.round(solarDelta * 60_000));
  assertCivilTime(effective);
  const descriptions = [dst.active ? "已按夏令时减 1 小时" : "不在中国夏令时区间，未校正"];
  if (!options.mainlandDst) {
    descriptions.splice(0, 1,
      `出生地为${options.birthplace}，未按中国大陆夏令时校正；当地历史夏令时请按出生记录自行核对`);
  } else if (options.birthplace === null && longitude === null) {
    descriptions.push("若出生在港澳台或海外，请填写出生地");
  }
  if (dst.repeated) {
    descriptions.push("重复时段，按夏令时计");
  }
  if (dst.skipped) {
    descriptions.push("钟表跳跃时段，按夏令时边界计，请核对出生记录");
  }
  return {
    effective, timeKnown, longitudeMinutes, equationMinutes,
    steps: [
      {
        kind: "dst", applied: dst.active, before: { ...original }, deltaMinutes: delta,
        after: standard, description: descriptions.join("；"),
      },
      {
        kind: "solar", applied: longitude !== null, before: standard,
        deltaMinutes: solarDelta, after: effective,
        description: longitude === null
          ? "未填出生地经度，未作真太阳时校正"
          : `经度差 ${longitudeMinutes.toFixed(2)} 分钟；均时差 ${equationMinutes.toFixed(2)} 分钟`,
      },
    ],
  };
}
```

- [ ] **Step 4：运行 `node --import tsx --test tests/solar-time.test.ts`，预期全部通过；再运行 `npm run typecheck`。**
- [ ] **Step 5：整理命名，保留 NOAA 出处；不要改成依赖机器本地时区的 Date 构造。**

### Task B1.3：城市数据、生辰校验与农历转换

**文件：** 新建 `tests/birth-profile.test.ts`、`src/calendar/cities.ts`、`src/calendar/data/cities.json`、`src/sanyi/birth-profile.ts`。

- [ ] **Step 1：写完整测试。** 农历期望从库现场取得，非法闰月从该年的真实闰月反选。

```ts
// tests/birth-profile.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import lunarPkg from "lunar-javascript";
import { correctBirthTime } from "../src/calendar/solar-time.js";
import { readCities } from "../src/calendar/cities.js";
import { normalizeBirthProfile } from "../src/sanyi/birth-profile.js";

const base = {
  calendar: "solar", year: 1990, month: 5, day: 15,
  time: { hour: 15, minute: 30 }, gender: "male", isLeapMonth: false,
};

test("城市表 34 条、34 省级行政区、名称唯一且坐标合法", () => {
  const cities = readCities();
  assert.equal(cities.length, 34);
  assert.equal(new Set(cities.map((city) => city.name)).size, 34);
  assert.equal(new Set(cities.map((city) => city.province)).size, 34);
  for (const city of cities) {
    assert.ok(city.longitude >= 73 && city.longitude <= 135);
    assert.ok(city.latitude >= 0 && city.latitude <= 54);
    assert.ok(Math.abs(city.longitude * 100 - Math.round(city.longitude * 100)) < 1e-8);
  }
  for (const province of ["香港", "澳门", "台湾", "新疆", "西藏"]) {
    assert.ok(cities.some((city) => city.province === province));
  }
});

test("公历、缺时辰、性别与城市经度", () => {
  const birth = normalizeBirthProfile(base);
  assert.equal(birth.civil.hour, 15);
  assert.equal(birth.timeKnown, true);
  assert.equal(birth.longitude, null);
  const missing = normalizeBirthProfile({ ...base, time: null, gender: "female" });
  assert.equal(missing.timeKnown, false);
  assert.equal(missing.gender, "female");
  assert.equal(missing.civil.hour, 12);
  const city = readCities()[0];
  assert.ok(city);
  assert.equal(normalizeBirthProfile({ ...base, city: city.name }).longitude, city.longitude);
  assert.equal(normalizeBirthProfile({ ...base, longitude: 87.6 }).longitude, 87.6);
});

test("非法日期、时间、性别、经度与重复地点输入抛中文错误", () => {
  for (const patch of [
    { month: 2, day: 30 }, { year: 1899 }, { time: { hour: 24, minute: 0 } },
    { time: { hour: 15, minute: 60 } }, { gender: "unknown" }, { longitude: 136 },
    { longitude: Number.NaN }, { city: "不存在的城市" }, { calendar: "other" },
    { city: "北京", longitude: 120 }, { isLeapMonth: true }, { time: undefined },
  ]) {
    assert.throws(() => normalizeBirthProfile({ ...base, ...patch }), /[\u4e00-\u9fff]/);
  }
  assert.throws(() => normalizeBirthProfile(null), /生辰/);
});

test("农历有效闰月转换与不存在的闰月拒绝", () => {
  let year = 2000;
  while (year <= 2098 && lunarPkg.LunarYear.fromYear(year).getLeapMonth() === 0) {
    year += 1;
  }
  const leap = lunarPkg.LunarYear.fromYear(year).getLeapMonth();
  assert.ok(leap > 0);
  const converted = normalizeBirthProfile({
    ...base, calendar: "lunar", year, month: leap, day: 1, isLeapMonth: true,
  });
  const expected = lunarPkg.Lunar.fromYmd(year, -leap, 1).getSolar();
  assert.deepEqual(
    [converted.civil.year, converted.civil.month, converted.civil.day],
    [expected.getYear(), expected.getMonth(), expected.getDay()],
  );
  const wrong = leap === 1 ? 2 : 1;
  assert.throws(() => normalizeBirthProfile({
    ...base, calendar: "lunar", year, month: wrong, day: 1, isLeapMonth: true,
  }), /闰月不存在/);
  const month = lunarPkg.LunarMonth.fromYm(year, -leap);
  assert.ok(month);
  assert.throws(() => normalizeBirthProfile({
    ...base, calendar: "lunar", year, month: leap,
    day: month.getDayCount() + 1, isLeapMonth: true,
  }), /农历日期/);
});

test("城市决定大陆夏令时选项并贯通校正调用", () => {
  for (const city of ["香港", "澳门", "台北", "北京", undefined]) {
    const birth = normalizeBirthProfile({ ...base, year: 1988, month: 7, day: 1,
      time: { hour: 8, minute: 30 }, ...(city === undefined ? {} : { city }) });
    assert.equal(birth.mainlandDst, city === "北京" || city === undefined);
    const corrected = correctBirthTime(birth.civil, birth.timeKnown, birth.longitude,
      { mainlandDst: birth.mainlandDst, birthplace: birth.birthplace });
    assert.equal(corrected.steps[0]?.deltaMinutes, birth.mainlandDst ? -60 : 0);
    if (!birth.mainlandDst) assert.match(corrected.steps[0]?.description ?? "", new RegExp(`出生地为${city}`));
  }
  assert.equal(normalizeBirthProfile({ ...base, longitude: 120 }).mainlandDst, true);
});
```

- [ ] **Step 2：运行 `node --import tsx --test tests/birth-profile.test.ts`，确认 RED。**
- [ ] **Step 3：新增城市数据与读取函数。** 数据为城市中心代表坐标，四舍五入到两位，不声称为个人出生点。来源采用 [GeoNames 地名坐标数据](https://download.geonames.org/export/dump/)；城市选择后允许改为手填经度，但请求不能同时含两者。

JSON 不支持注释；以下块首行是抽取路径标记，写入 JSON 时去掉该行。来源放在读取模块，保持每条严格为四字段。

```json
// src/calendar/data/cities.json
[
  { "name": "北京", "province": "北京", "longitude": 116.40, "latitude": 39.91 },
  { "name": "天津", "province": "天津", "longitude": 117.20, "latitude": 39.13 },
  { "name": "上海", "province": "上海", "longitude": 121.46, "latitude": 31.22 },
  { "name": "重庆", "province": "重庆", "longitude": 106.55, "latitude": 29.56 },
  { "name": "石家庄", "province": "河北", "longitude": 114.48, "latitude": 38.04 },
  { "name": "太原", "province": "山西", "longitude": 112.56, "latitude": 37.87 },
  { "name": "呼和浩特", "province": "内蒙古", "longitude": 111.65, "latitude": 40.81 },
  { "name": "沈阳", "province": "辽宁", "longitude": 123.43, "latitude": 41.79 },
  { "name": "长春", "province": "吉林", "longitude": 125.32, "latitude": 43.88 },
  { "name": "哈尔滨", "province": "黑龙江", "longitude": 126.66, "latitude": 45.75 },
  { "name": "南京", "province": "江苏", "longitude": 118.78, "latitude": 32.06 },
  { "name": "杭州", "province": "浙江", "longitude": 120.16, "latitude": 30.29 },
  { "name": "合肥", "province": "安徽", "longitude": 117.28, "latitude": 31.86 },
  { "name": "福州", "province": "福建", "longitude": 119.31, "latitude": 26.06 },
  { "name": "南昌", "province": "江西", "longitude": 115.85, "latitude": 28.68 },
  { "name": "济南", "province": "山东", "longitude": 117.00, "latitude": 36.67 },
  { "name": "郑州", "province": "河南", "longitude": 113.65, "latitude": 34.76 },
  { "name": "武汉", "province": "湖北", "longitude": 114.27, "latitude": 30.58 },
  { "name": "长沙", "province": "湖南", "longitude": 112.98, "latitude": 28.20 },
  { "name": "广州", "province": "广东", "longitude": 113.25, "latitude": 23.12 },
  { "name": "南宁", "province": "广西", "longitude": 108.32, "latitude": 22.82 },
  { "name": "海口", "province": "海南", "longitude": 110.34, "latitude": 20.05 },
  { "name": "成都", "province": "四川", "longitude": 104.07, "latitude": 30.67 },
  { "name": "贵阳", "province": "贵州", "longitude": 106.71, "latitude": 26.58 },
  { "name": "昆明", "province": "云南", "longitude": 102.72, "latitude": 25.04 },
  { "name": "拉萨", "province": "西藏", "longitude": 91.10, "latitude": 29.65 },
  { "name": "西安", "province": "陕西", "longitude": 108.93, "latitude": 34.26 },
  { "name": "兰州", "province": "甘肃", "longitude": 103.84, "latitude": 36.06 },
  { "name": "西宁", "province": "青海", "longitude": 101.76, "latitude": 36.63 },
  { "name": "银川", "province": "宁夏", "longitude": 106.27, "latitude": 38.47 },
  { "name": "乌鲁木齐", "province": "新疆", "longitude": 87.60, "latitude": 43.80 },
  { "name": "香港", "province": "香港", "longitude": 114.17, "latitude": 22.28 },
  { "name": "澳门", "province": "澳门", "longitude": 113.55, "latitude": 22.20 },
  { "name": "台北", "province": "台湾", "longitude": 121.53, "latitude": 25.05 }
]
```

```ts
// src/calendar/cities.ts
import cities from "./data/cities.json" with { type: "json" };

export interface BirthCity {
  name: string;
  province: string;
  longitude: number;
  latitude: number;
}
// 来源：GeoNames 城市中心代表坐标，https://download.geonames.org/export/dump/ 。
// 经度与纬度四舍五入至两位小数；非精确出生点，可由用户手填经度替代。
export const CITY_DATA_SOURCE = "GeoNames 地名坐标数据（城市中心，两位小数）";
export function readCities(): readonly BirthCity[] {
  return cities.map((city) => ({ ...city }));
}
```

- [ ] **Step 4：实现生辰输入与校验。** `time: null` 是缺时辰唯一入口；不把漏传 time 自动解释为未知。农历负月表示闰月，先校验真实闰月与该月天数，再调用库；所有库异常转换为中文。

```ts
// src/sanyi/birth-profile.ts
import lunarPkg from "lunar-javascript";
import { readCities } from "../calendar/cities.js";
import { assertCivilTime, assertLongitude, type CivilTime } from "../calendar/solar-time.js";

export interface BirthProfileInput {
  calendar: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  time: { hour: number; minute: number } | null;
  gender: "male" | "female";
  city?: string;
  longitude?: number;
}
export interface NormalizedBirthProfile {
  civil: CivilTime;
  timeKnown: boolean;
  gender: "male" | "female";
  longitude: number | null;
  mainlandDst: boolean;
  birthplace: string | null;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("生辰必须为对象");
  }
  return value as Record<string, unknown>;
}
function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}须为 ${min}–${max} 的整数`);
  }
  return value;
}

export function normalizeBirthProfile(input: unknown): NormalizedBirthProfile {
  const body = record(input);
  const calendar = body.calendar;
  if (calendar !== "solar" && calendar !== "lunar") {
    throw new Error("历法须为公历或农历");
  }
  const gender = body.gender;
  if (gender !== "male" && gender !== "female") {
    throw new Error("性别须为男或女，用于确定大运顺逆");
  }
  if (typeof body.isLeapMonth !== "boolean") {
    throw new Error("须明确是否闰月");
  }
  if (calendar === "solar" && body.isLeapMonth) {
    throw new Error("公历不能选择农历闰月");
  }
  let year = integer(body.year, "出生年份", 1900, 2099);
  let month = integer(body.month, "出生月份", 1, 12);
  let day = integer(body.day, "出生日期", 1, 31);
  const timeKnown = body.time !== null;
  const time = timeKnown ? record(body.time) : null;
  const hour = time ? integer(time.hour, "小时", 0, 23) : 12;
  const minute = time ? integer(time.minute, "分钟", 0, 59) : 0;
  if (calendar === "lunar") {
    try {
      if (body.isLeapMonth && lunarPkg.LunarYear.fromYear(year).getLeapMonth() !== month) {
        throw new Error("所选农历闰月不存在");
      }
      const signedMonth = body.isLeapMonth ? -month : month;
      const lunarMonth = lunarPkg.LunarMonth.fromYm(year, signedMonth);
      if (!lunarMonth || day > lunarMonth.getDayCount()) {
        throw new Error("农历日期不合法");
      }
      const solar = lunarPkg.Lunar.fromYmd(year, signedMonth, day).getSolar();
      year = solar.getYear();
      month = solar.getMonth();
      day = solar.getDay();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      throw new Error(/[\u4e00-\u9fff]/.test(message) ? message : "农历日期不合法");
    }
  }
  const civil = { year, month, day, hour, minute, second: 0 };
  assertCivilTime(civil);
  let longitude: number | null = null;
  if (body.city !== undefined && body.longitude !== undefined) {
    throw new Error("出生城市与手填经度只能选择一种");
  }
  if (body.city !== undefined) {
    const city = readCities().find((item) => item.name === body.city);
    if (!city) {
      throw new Error("出生城市不在内置城市表中");
    }
    longitude = city.longitude;
  }
  if (body.longitude !== undefined) {
    if (typeof body.longitude !== "number") {
      throw new Error("经度须为数字");
    }
    assertLongitude(body.longitude);
    longitude = body.longitude;
  }
  return { civil, timeKnown, gender, longitude,
    mainlandDst: !["香港", "澳门", "台北"].includes(String(body.city)),
    birthplace: typeof body.city === "string" ? body.city : null };
}
```

- [ ] **Step 5：运行 `node --import tsx --test tests/solar-time.test.ts tests/birth-profile.test.ts`，预期全部通过。**
- [ ] **Step 6：运行 `npm run typecheck`，再整理校验错误；不输出原始请求到日志。**

### B1 交付核对

- [ ] 六年独立边界与真实 UTC 上的 Intl 互校通过；重复与跳跃时段均有中文说明。
- [ ] 规格样例落在 07:14–07:20 辰时；组合顺序与跨日期通过。
- [ ] 城市 34 条、唯一省级区、两位经度与来源可审计；非法闰月和农历超日拒绝。
- [ ] 本 Chunk 不持久化原始生辰；`CorrectedBirthTime` 是请求期对象，不是可直接 JSON 存档的结构。

## Chunk B2：八字排盘引擎

> 引擎只接收 B1 校正后的民用时刻，不再次扣夏令时，也不读取系统当前年份。`targetYear` 是所问立春年标签，B5 用注入时钟解析 horizon。默认 sect 1；库的 `getYun(gender, startSect)` 第二参数是起运算法口径，不能把日界 sect 传进去：本计划固定使用默认起运算法 1。

### Task B2.1：独立双源基准生成器

**文件：** 新建 `tools/bazi/generate_fixtures.py`、生成 `tests/fixtures/bazi/*.json`，新建 `tests/bazi-fixtures.test.ts`。

- [ ] **Step 1：写完整比对测试。** 所有期望由 sxtwl 生成并入库，TS 测试不依赖 Python。生成资产前运行测试必须因目录不存在而失败；生成资产后、排盘模块实现前仍为 RED。

```ts
// tests/bazi-fixtures.test.ts
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { correctBirthTime, type CivilTime } from "../src/calendar/solar-time.js";
import { normalizeBirthProfile } from "../src/sanyi/birth-profile.js";

interface Fixture {
  id: string;
  tag: string;
  clock: CivilTime;
  effective: CivilTime;
  dstMinutes: number;
  lunar: { year: number; month: number; day: number; leap: boolean } | null;
  source: {
    package: string;
    yearMonthRule: string;
    dayRule: string;
    timeRule: string;
  };
  native: Record<"year" | "month" | "day" | "time", string>;
  compareFields: string[];
  expected: Record<"1" | "2", Record<"year" | "month" | "day" | "time", string>>;
}

test("sxtwl 双源 ≥40 时刻，逐字段比较两种 sect", async () => {
  const root = new URL("./fixtures/bazi/", import.meta.url);
  const names = (await readdir(root)).filter((name) => name.endsWith(".json")).sort();
  assert.ok(names.length >= 40);
  const fixtures: Fixture[] = [];
  for (const name of names) {
    fixtures.push(JSON.parse(await readFile(new URL(name, root), "utf8")) as Fixture);
  }
  assert.equal(new Set(fixtures.map((item) => item.id)).size, fixtures.length);
  const tags = new Set(fixtures.map((item) => item.tag));
  for (let index = 1; index < 24; index += 2) {
    assert.ok(tags.has(`term:${index}:before`));
    assert.ok(tags.has(`term:${index}:after`));
  }
  for (let year = 1986; year <= 1991; year += 1) {
    for (const suffix of ["before", "start", "repeat", "after"]) {
      assert.ok(tags.has(`dst:${year}:${suffix}`));
    }
  }
  for (const tag of ["child:23:30", "child:00:30", "leap", "edge:1900", "edge:2099"]) {
    assert.ok(tags.has(tag));
  }
  for (const fixture of fixtures) {
    assert.equal(fixture.source.package, "sxtwl==2.0.6");
    assert.ok(fixture.source.yearMonthRule.includes("交节时刻"));
    assert.deepEqual(fixture.compareFields, ["year", "month", "day", "time"]);
    const corrected = correctBirthTime(fixture.clock, true, null);
    assert.deepEqual(corrected.effective, fixture.effective, fixture.id);
    assert.equal(corrected.steps[0]?.deltaMinutes, fixture.dstMinutes, fixture.id);
    if (fixture.lunar) {
      const converted = normalizeBirthProfile({
        calendar: "lunar", year: fixture.lunar.year, month: fixture.lunar.month,
        day: fixture.lunar.day, isLeapMonth: fixture.lunar.leap,
        time: { hour: fixture.clock.hour, minute: fixture.clock.minute }, gender: "male",
      });
      assert.deepEqual(converted.civil, fixture.clock);
    }
    for (const sect of [1, 2] as const) {
      const chart = buildBaziChart({
        corrected: fixture.effective, gender: "male", sect, timeKnown: true, targetYear: 2026,
      });
      for (const key of ["year", "month", "day", "time"] as const) {
        assert.equal(chart.pillars[key]?.ganZhi, fixture.expected[String(sect) as "1" | "2"][key],
          `${fixture.id} sect=${sect} ${key}`);
      }
    }
  }
});
```

- [ ] **Step 2：运行 `node --import tsx --test tests/bazi-fixtures.test.ts`，确认 RED。**
- [ ] **Step 3：写完整基准生成器。** 不调用 lunar，不导入 TS 引擎，不把被测结果写成期望。交节扫描使用 2.0.6 实际存在的 `hasJieQi/getJieQiJD`，不用不存在的 `getJieQiByYear`。

```python
// tools/bazi/generate_fixtures.py
"""以 sxtwl 独立生成可复算的八字四柱标准答案。"""
import argparse
import importlib.metadata
import json
from datetime import datetime, timedelta
from pathlib import Path

import sxtwl

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
DST = [
    (1986, 5, 4, 9, 14), (1987, 4, 12, 9, 13), (1988, 4, 17, 9, 11),
    (1989, 4, 16, 9, 17), (1990, 4, 15, 9, 16), (1991, 4, 14, 9, 15),
]


def day_at(value):
    return sxtwl.fromSolar(value.year, value.month, value.day)


def gan_zhi(value):
    return STEMS[value.tg] + BRANCHES[value.dz]


def civil(value):
    return dict(year=value.year, month=value.month, day=value.day,
                hour=value.hour, minute=value.minute, second=value.second)


def term_at(day):
    value = sxtwl.JD2DD(day.getJieQiJD())
    # 保留秒精度，前后各一小时的采样不受舍入秒影响。
    midnight = datetime(int(value.Y), int(value.M), int(value.D))
    return midnight + timedelta(hours=value.h, minutes=value.m, seconds=value.s)


def corrected_clock(clock):
    for year, sm, sd, em, ed in DST:
        if clock.year == year:
            start = datetime(year, sm, sd, 2)
            end = datetime(year, em, ed, 2)
            if start <= clock < end:
                return clock - timedelta(hours=1), -60
    return clock, 0


def probe_rules():
    """用库现场结果证明零点日界、晚子时参数和日期型交节。"""
    base = datetime(1990, 5, 15)
    day = day_at(base)
    following = day_at(base + timedelta(days=1))
    assert gan_zhi(day.getDayGZ()) != gan_zhi(following.getDayGZ())
    assert gan_zhi(day.getHourGZ(23, True)) == gan_zhi(following.getHourGZ(0, True))
    assert gan_zhi(day.getHourGZ(23, False)) == gan_zhi(day.getHourGZ(0, False))
    count = 0
    cursor = datetime(2026, 1, 1)
    while cursor.year == 2026:
        current = day_at(cursor)
        if current.hasJieQi() and current.getJieQi() % 2 == 1:
            previous = day_at(cursor - timedelta(days=1))
            assert gan_zhi(current.getMonthGZ()) != gan_zhi(previous.getMonthGZ())
            if current.getJieQi() == 3:
                assert gan_zhi(current.getYearGZ()) != gan_zhi(previous.getYearGZ())
            count += 1
        cursor += timedelta(days=1)
    assert count == 12
    return {
        "package": "sxtwl==2.0.6",
        "yearMonthRule": "原生按交节日切换；依 sxtwl 交节时刻在交节前取前一日年/月柱",
        "dayRule": "getDayGZ 按零点；sect 1 的 23 点取下一日，sect 2 取当日",
        "timeRule": "getHourGZ(hour, True) 按晚子时次日干起时；lunar 两种 sect 时柱同此口径",
    }


def expected_at(value, sect):
    day = day_at(value)
    month_day = day
    if day.hasJieQi() and day.getJieQi() % 2 == 1 and value < term_at(day):
        month_day = day_at(value - timedelta(days=1))
    civil_day = day_at(value + timedelta(days=1)) if sect == 1 and value.hour == 23 else day
    return {
        "year": gan_zhi(month_day.getYearGZ()),
        "month": gan_zhi(month_day.getMonthGZ()),
        "day": gan_zhi(civil_day.getDayGZ()),
        "time": gan_zhi(day.getHourGZ(value.hour, True)),
    }


def cases():
    result = []
    cursor = datetime(2026, 1, 1)
    while cursor.year == 2026:
        day = day_at(cursor)
        if day.hasJieQi() and day.getJieQi() % 2 == 1:
            term = term_at(day).replace(microsecond=0)
            for suffix, offset in [("before", -1), ("after", 1)]:
                result.append((f"term:{day.getJieQi()}:{suffix}", term + timedelta(hours=offset)))
        cursor += timedelta(days=1)
    for year, sm, sd, em, ed in DST:
        start = datetime(year, sm, sd, 2)
        end = datetime(year, em, ed, 2)
        for suffix, clock in [
            ("before", start - timedelta(minutes=1)), ("start", start),
            ("repeat", end - timedelta(minutes=30)), ("after", end),
        ]:
            result.append((f"dst:{year}:{suffix}", clock))
    for hour, minute in [(23, 0), (23, 30), (0, 0), (0, 30)]:
        result.append((f"child:{hour:02d}:{minute:02d}", datetime(2000, 11, 3, hour, minute)))
    cursor = datetime(2023, 1, 1)
    while cursor.year == 2023 and not day_at(cursor).isLunarLeap():
        cursor += timedelta(days=1)
    assert cursor.year == 2023
    result.append(("leap", cursor.replace(hour=12)))
    result.append(("edge:1900", datetime(1900, 1, 1, 0, 30)))
    result.append(("edge:2099", datetime(2099, 12, 31, 23, 30)))
    return result


def main():
    parser = argparse.ArgumentParser(description="生成 sxtwl 双源八字基准")
    parser.add_argument("--output", type=Path, default=Path("tests/fixtures/bazi"))
    args = parser.parse_args()
    assert importlib.metadata.version("sxtwl") == "2.0.6", "必须使用已核验版本"
    source = probe_rules()
    samples = cases()
    assert len(samples) >= 40
    args.output.mkdir(parents=True, exist_ok=True)
    for tag, clock in samples:
        effective, dst_minutes = corrected_clock(clock)
        day = day_at(effective)
        identity = tag.replace(":", "-")
        leap_day = day_at(clock)
        lunar = None
        if tag == "leap":
            lunar = dict(year=leap_day.getLunarYear(), month=leap_day.getLunarMonth(),
                         day=leap_day.getLunarDay(), leap=leap_day.isLunarLeap())
        fixture = {
            "id": identity, "tag": tag, "clock": civil(clock), "effective": civil(effective),
            "dstMinutes": dst_minutes, "lunar": lunar, "source": source,
            "native": {
                "year": gan_zhi(day.getYearGZ()), "month": gan_zhi(day.getMonthGZ()),
                "day": gan_zhi(day.getDayGZ()), "time": gan_zhi(day.getHourGZ(effective.hour, True)),
            },
            "compareFields": ["year", "month", "day", "time"],
            "expected": {"1": expected_at(effective, 1), "2": expected_at(effective, 2)},
        }
        path = args.output / f"{identity}.json"
        path.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已生成 {len(samples)} 个时刻，每个含两种换日口径和四柱标准答案")


if __name__ == "__main__":
    main()
```

Python 块首行 `// 路径` 与 JSON 块首行均为抽取标记，落入文件前移除；它们不是语言本身的注释。JSON 资产由上述完整生成器产生，不手填或抄 lunar 的答案。

- [ ] **Step 4：运行 `.venv-tools/bin/python tools/bazi/generate_fixtures.py`，预期生成 55 个时刻，含 12 节各前后 1 小时（立春属于其中）、6 年夏令时各 4 边界、早晚子时 4 点、闰月与两端年份。**
- [ ] **Step 5：检查生成的 native 与 expected 口径说明；年/月交节前适配不是忽略字段，四柱全部比较。** 23 点 `sect=2` 的日柱取当日，但时柱仍按库的晚子时起时规则；不自行重算成另一个时柱。

### Task B2.2：锁定已核验命例与排盘实现

**文件：** 新建 `tests/bazi.test.ts`、`src/calendar/bazi.ts`；使用 B1.1 已扩展的声明。

- [ ] **Step 1：写完整行为测试。** 除主管核验命例，其余干支期望在测试现场从六十甲子次序或库方法计算。

```ts
// tests/bazi.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import lunarPkg from "lunar-javascript";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { correctBirthTime, type CivilTime } from "../src/calendar/solar-time.js";

const clock: CivilTime = { year: 1990, month: 5, day: 15, hour: 15, minute: 30, second: 0 };
const corrected = correctBirthTime(clock, true, null).effective;
const input = { corrected, gender: "male" as const, sect: 1 as const, timeKnown: true, targetYear: 2026 };

test("校正后命例逐字段锁定四柱、十神、藏干、长生、纳音与三宫", () => {
  const chart = buildBaziChart(input);
  const pillars = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.time];
  assert.deepEqual(pillars.map((p) => p?.ganZhi), ["庚午", "辛巳", "庚辰", "癸未"]);
  assert.deepEqual(pillars.map((p) => p?.stemGod), ["比肩", "劫财", "日主", "伤官"]);
  assert.deepEqual(pillars.map((p) => p?.hidden.map((h) => `${h.stem}${h.god}`)), [
    ["丁正官", "己正印"], ["丙七杀", "庚比肩", "戊偏印"],
    ["戊偏印", "乙正财", "癸伤官"], ["己正印", "丁正官", "乙正财"],
  ]);
  assert.deepEqual(pillars.map((p) => p?.diShi), ["沐浴", "长生", "养", "冠带"]);
  assert.deepEqual(pillars.map((p) => p?.naYin), ["路旁土", "白蜡金", "白蜡金", "杨柳木"]);
  assert.equal(chart.taiYuan, "壬申");
  assert.equal(chart.mingGong, "辛巳");
  assert.equal(chart.shenGong, "己丑");
  assert.equal(chart.sect, 1);
  assert.equal(chart.dayBoundary, "23:00");
  assert.equal(chart.dayMaster, "庚");
  const raw = buildBaziChart({ ...input, corrected: clock });
  assert.equal(raw.pillars.time?.ganZhi, "甲申");
  assert.equal(chart.pillars.time?.ganZhi, "癸未");
});

test("已核验起运、八步大运、2026 流年及完整流月", () => {
  const chart = buildBaziChart(input);
  assert.ok(chart.luck);
  assert.equal(chart.luck.direction, "forward");
  assert.deepEqual(chart.luck.start, { years: 7, months: 2, days: 20, solarDate: "1997-08-04" });
  assert.deepEqual(chart.luck.cycles.map((d) => d.ganZhi), [
    "壬午", "癸未", "甲申", "乙酉", "丙戌", "丁亥", "戊子", "己丑",
  ]);
  assert.deepEqual(chart.luck.cycles[0], {
    index: 1, ganZhi: "壬午", stemGod: "食神", startAge: 8, endAge: 17,
    startYear: 1997, endYear: 2006,
  });
  assert.deepEqual(chart.luck.cycles[2], {
    index: 3, ganZhi: "甲申", stemGod: "偏财", startAge: 28, endAge: 37,
    startYear: 2017, endYear: 2026,
  });
  assert.equal(chart.luck.cycles[3]?.startYear, 2027);
  assert.equal(chart.luck.cycles[3]?.endYear, 2036);
  assert.equal(chart.annual?.ganZhi, "丙午");
  assert.equal(chart.annual?.age, 37);
  assert.equal(chart.annual?.currentLuck?.ganZhi, "甲申");
  const eight = lunarPkg.Solar.fromYmdHms(1990, 5, 15, 14, 30, 0).getLunar().getEightChar();
  eight.setSect(1);
  const current = eight.getYun(1).getDaYun().find((d) => d.getStartYear() <= 2026 && d.getEndYear() >= 2026);
  assert.ok(current);
  const year = current.getLiuNian().find((n) => n.getYear() === 2026);
  assert.ok(year);
  assert.equal(chart.annual?.months.length, 12);
  assert.deepEqual(chart.annual?.months.map((m) => [m.monthInChinese, m.ganZhi]),
    year.getLiuYue().map((m) => [m.getMonthInChinese(), m.getGanZhi()]));
});

test("阳男阴女顺行、阴男阳女逆行，以现场六十甲子方向断言", () => {
  const stems = "甲乙丙丁戊己庚辛壬癸";
  const branches = "子丑寅卯辰巳午未申酉戌亥";
  const cycle = Array.from({ length: 60 }, (_, i) => `${stems[i % 10]}${branches[i % 12]}`);
  for (const [year, gender, sign] of [
    [1990, "male", 1], [1991, "female", 1],
    [1991, "male", -1], [1990, "female", -1],
  ] as const) {
    const chart = buildBaziChart({ ...input, corrected: { ...corrected, year }, gender });
    const parity = stems.indexOf(chart.pillars.year.stem) % 2;
    assert.equal(parity, year === 1990 ? 0 : 1);
    assert.equal(chart.luck?.direction, sign === 1 ? "forward" : "backward");
    const monthIndex = cycle.indexOf(chart.pillars.month.ganZhi);
    assert.ok(monthIndex >= 0);
    assert.ok(chart.luck);
    for (const luck of chart.luck.cycles) {
      assert.equal(luck.ganZhi, cycle[(monthIndex + sign * luck.index + 60) % 60]);
    }
  }
});

test("缺时辰正午估运，交节日暂停大运", () => {
  const chart = buildBaziChart({ ...input, timeKnown: false });
  assert.equal(chart.pillars.time, null);
  assert.equal(chart.mingGong, null);
  assert.equal(chart.shenGong, null);
  assert.equal(chart.luck?.approximate, true);
  assert.equal(chart.luck?.cycles[0]?.ganZhi, "壬午");
  assert.ok(chart.liunian.years.every((y) => y.luck));
  assert.doesNotMatch(chart.warnings.join("；"), /交节日年\/月柱待确认/);
  const jie = buildBaziChart({ ...input, timeKnown: false, corrected: { ...corrected, day: 6 } });
  assert.equal(jie.luck, null);
  assert.equal(jie.warnings.length, 1);
  assert.doesNotMatch(jie.warnings.join("；"), /交节日年\/月柱待确认/);
  assert.match(jie.warnings.join("；"), /出生当日交节（立夏）/);
  assert.equal(chart.taiYuan, "壬申");
  assert.ok(chart.annual?.currentLuck);
  assert.equal(chart.annual?.ganZhi, "丙午");
  assert.equal(chart.annual?.months.length, 12);
  assert.match(chart.warnings.join("；"), /时辰未知/);
  assert.equal(buildBaziChart({ ...input, targetYear: 1989 }).annual, null);
});

test("23:30 两种日界日柱不同，时柱遵守库的共同晚子时口径", () => {
  const birth = { ...clock, year: 2000, month: 11, day: 3, hour: 23 };
  const first = buildBaziChart({ ...input, corrected: birth, sect: 1 });
  const second = buildBaziChart({ ...input, corrected: birth, sect: 2 });
  assert.notEqual(first.pillars.day.ganZhi, second.pillars.day.ganZhi);
  assert.equal(first.pillars.time?.ganZhi, second.pillars.time?.ganZhi);
  assert.equal(second.dayBoundary, "00:00");
  const e = lunarPkg.Solar.fromYmdHms(2000, 11, 3, 23, 30, 0).getLunar().getEightChar();
  e.setSect(1);
  assert.equal(first.pillars.day.ganZhi, e.getDay());
  e.setSect(2);
  assert.equal(second.pillars.day.ganZhi, e.getDay());
  assert.throws(() => buildBaziChart({ ...input, targetYear: 2100 }), /年份/);
  assert.throws(() => buildBaziChart({ ...input, sect: 3 as 1 }), /换日/);
});

 test("十年窗口锁定已核验事实与交运日期", () => {
  const years = buildBaziChart(input).liunian.years;
  const gz = ["癸卯", "甲辰", "乙巳", "丙午", "丁未", "戊申", "己酉", "庚戌", "辛亥", "壬子"];
  const gods = ["伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印", "比肩", "劫财", "食神"];
  years.forEach((y, i) => {
    assert.equal(y.year, 2023 + i);
    assert.equal(y.ganZhi, gz[i]);
    assert.equal(y.stem, gz[i]?.slice(0, 1));
    assert.equal(y.branch, gz[i]?.slice(1));
    assert.equal(y.age, 34 + i);
    assert.equal(y.stemGod, gods[i]);
    assert.equal(y.luck?.ganZhi, i < 4 ? "甲申" : "乙酉");
    const ranks = ["main", "middle", "residual"];
    assert.deepEqual(y.hidden, lunarPkg.LunarUtil.ZHI_HIDE_GAN[y.branch]?.map((stem, j) => ({
      stem, god: lunarPkg.LunarUtil.SHI_SHEN["庚" + stem], qi: ranks[j],
    })));
    assert.deepEqual(y.luckChange, y.year === 2027
      ? { date: "2027-08-04", from: "甲申", to: "乙酉" } : null);
  });
  assert.deepEqual(buildBaziChart({ ...input, targetYear: 2027 }).liunian.years.map((y) => y.year),
    Array.from({ length: 10 }, (_, i) => 2024 + i));
  assert.equal(lunarPkg.Solar.fromYmd(2000, 2, 29).nextYear(10).toYmd(), "2010-02-28");
});
 test("出生立春年裁剪、起运前与上限", () => {
  const recent = buildBaziChart({ ...input, corrected: { ...corrected, year: 2024, day: 1 },
    targetYear: 2025 });
  assert.equal(recent.liunian.years[0]?.year, 2024);
  assert.equal(recent.liunian.years[0]?.luckLabel, "起运前");
  const before = buildBaziChart({ ...input, corrected: { ...corrected, month: 1, day: 20 },
    targetYear: 1990 });
  assert.equal(before.pillars.year.ganZhi, "己巳");
  assert.equal(before.liunian.years[0]?.year, 1989);
  assert.ok(buildBaziChart({ ...input, corrected: { ...corrected, month: 1, day: 20 },
    targetYear: 1989 }).annual);
  const end = buildBaziChart({ ...input, targetYear: 2099 });
  assert.equal(end.liunian.years.at(-1)?.year, 2099);
  assert.equal(end.liunian.years.length, 4);
});
```

- [ ] **Step 2：运行 `node --import tsx --test tests/bazi.test.ts`，确认模块缺失 RED。**
- [ ] **Step 3：实现完整排盘模块。** 藏干顺序原样保存；`qi` 按库顺序给本/中/余气，不排序。显示八步大运，但为所问年份计算足够的周期，禁止把超出展示八步的年份误认为没有大运。

```ts
// src/calendar/bazi.ts
import lunarPkg from "lunar-javascript";
import { assertCivilTime, type CivilTime } from "./solar-time.js";
export type PillarKey = "year" | "month" | "day" | "time";
export interface BaziPillar {
  key: PillarKey;
  label: string;
  ganZhi: string;
  stem: string;
  branch: string;
  stemGod: string;
  hidden: readonly {
    stem: string;
    god: string;
    qi: "main" | "middle" | "residual";
  }[];
  diShi: string;
  naYin: string;
}
export interface LuckCycle {
  index: number;
  ganZhi: string;
  stemGod: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
}
export interface AnnualLuck {
  year: number;
  ganZhi: string;
  age: number;
  stemGod: string;
  currentLuck: LuckCycle | null;
  months: readonly {
    index: number;
    monthInChinese: string;
    ganZhi: string;
    stemGod: string;
  }[];
}
export interface LiuNianEntry {
  year: number;
  ganZhi: string;
  stem: string;
  branch: string;
  age: number;
  stemGod: string;
  hidden: BaziPillar["hidden"];
  luck: LuckCycle | null;
  luckLabel: "起运前" | "时辰未知" | null;
  luckChange: {
    date: string;
    from: string | null;
    to: string;
  } | null;
}
export interface BaziChart {
  sect: 1 | 2;
  dayBoundary: "23:00" | "00:00";
  timeKnown: boolean;
  dayMaster: string;
  pillars: {
    year: BaziPillar;
    month: BaziPillar;
    day: BaziPillar;
    time: BaziPillar | null;
  };
  taiYuan: string;
  mingGong: string | null;
  shenGong: string | null;
  luck: {
    approximate: boolean;
    direction: "forward" | "backward";
    start: {
      years: number;
      months: number;
      days: number;
      solarDate: string;
    };
    cycles: readonly LuckCycle[];
  } | null;
  annual: AnnualLuck | null;
  birthLiChunYear: number;
  liunian: {
    anchorYear: number;
    years: LiuNianEntry[];
  };
  warnings: readonly string[];
}
export interface BaziInput {
  corrected: CivilTime;
  gender: "male" | "female";
  sect: 1 | 2;
  timeKnown: boolean;
  targetYear: number;
}
function godFor(dayStem: string, stem: string): string {
  const god = lunarPkg.LunarUtil.SHI_SHEN[dayStem + stem];
  if (!god) {
    throw new Error("十神映射缺失，拒绝输出命盘");
  }
  return god;
}
function pillar(key: PillarKey, label: string, ganZhi: string, stemGod: string,
  stems: readonly string[], gods: readonly string[], diShi: string, naYin: string): BaziPillar {
  if (ganZhi.length !== 2 || stems.length !== gods.length) {
    throw new Error("四柱或藏干十神不一致，拒绝输出命盘");
  }
  const ranks = ["main", "middle", "residual"] as const;
  const hidden = stems.map((stem, index) => {
    const god = gods[index];
    const qi = ranks[index];
    if (!god || !qi) {
      throw new Error("藏干十神或气序缺失，拒绝输出命盘");
    }
    return { stem, god, qi };
  });
  return { key, label, ganZhi, stem: ganZhi.slice(0, 1), branch: ganZhi.slice(1),
    stemGod, hidden, diShi, naYin };
}
function independentAnnual(year: number, birthYear: number, dayStem: string): AnnualLuck {
  const stems = "甲乙丙丁戊己庚辛壬癸";
  const branches = "寅卯辰巳午未申酉戌亥子丑";
  const names = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
  // 七月一定在该标签年的立春之后；不以公历元旦替代立春年。
  const eight = lunarPkg.Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getEightChar();
  const ganZhi = eight.getYear();
  const offset = (stems.indexOf(ganZhi.slice(0, 1)) % 5 * 2 + 2) % 10;
  const months = Array.from({ length: 12 }, (_, index) => {
    const stem = stems[(offset + index) % 10];
    const branch = branches[index];
    const monthInChinese = names[index];
    if (!stem || !branch || !monthInChinese) {
      throw new Error("流月映射缺失");
    }
    return { index: index + 1, monthInChinese, ganZhi: stem + branch, stemGod: godFor(dayStem, stem) };
  });
  return { year, ganZhi, age: year - birthYear + 1, stemGod: godFor(dayStem, ganZhi.slice(0, 1)),
    currentLuck: null, months };
}
export function buildBaziChart(input: BaziInput): BaziChart {
  assertCivilTime(input.corrected);
  if (input.sect !== 1 && input.sect !== 2) {
    throw new Error("换日口径须为 1 或 2");
  }
  if (input.gender !== "male" && input.gender !== "female") {
    throw new Error("性别须为男或女");
  }
  if (!Number.isInteger(input.targetYear) || input.targetYear < 1900 || input.targetYear > 2099) {
    throw new Error("所问年份仅支持 1900–2099 年");
  }
  const birth = input.timeKnown ? input.corrected : { ...input.corrected, hour: 12, minute: 0, second: 0 };
  const eight = lunarPkg.Solar.fromYmdHms(birth.year, birth.month, birth.day, birth.hour,
    birth.minute, birth.second).getLunar().getEightChar();
  eight.setSect(input.sect);
  const year = pillar("year", "年柱", eight.getYear(), eight.getYearShiShenGan(),
    eight.getYearHideGan(), eight.getYearShiShenZhi(), eight.getYearDiShi(), eight.getYearNaYin());
  const month = pillar("month", "月柱", eight.getMonth(), eight.getMonthShiShenGan(),
    eight.getMonthHideGan(), eight.getMonthShiShenZhi(), eight.getMonthDiShi(), eight.getMonthNaYin());
  const day = pillar("day", "日柱", eight.getDay(), "日主", eight.getDayHideGan(),
    eight.getDayShiShenZhi(), eight.getDayDiShi(), eight.getDayNaYin());
  const time = input.timeKnown ? pillar("time", "时柱", eight.getTime(), eight.getTimeShiShenGan(),
    eight.getTimeHideGan(), eight.getTimeShiShenZhi(), eight.getTimeDiShi(), eight.getTimeNaYin()) : null;
  const midyear = lunarPkg.Solar.fromYmd(birth.year, 7, 1).getLunar().getEightChar().getYear();
  const birthLiChunYear = eight.getYear() === midyear ? birth.year : birth.year - 1;
  const jie = input.timeKnown ? null
    : lunarPkg.Solar.fromYmd(birth.year, birth.month, birth.day).getLunar().getCurrentJie();
  const warnings: string[] = [];
  if (!input.timeKnown) {
    if (jie) {
      warnings.push(`出生当日交节（${jie.getName()}），年/月柱与大运需补时辰确认`);
    } else {
      warnings.push("时辰未知，起运按当日正午估算，交运日期可能前后相差约两个月");
    }
  }
  const yun = jie ? null : eight.getYun(input.gender === "male" ? 1 : 0);
  const all = yun?.getDaYun(22) ?? [];
  const convert = (value: (typeof all)[number]): LuckCycle => ({
    index: value.getIndex(), ganZhi: value.getGanZhi(),
    stemGod: godFor(day.stem, value.getGanZhi().slice(0, 1)),
    startAge: value.getStartAge(), endAge: value.getEndAge(),
    startYear: value.getStartYear(), endYear: value.getEndYear(),
  });
  const luck: BaziChart["luck"] = yun ? {
    approximate: !input.timeKnown,
    direction: yun.isForward() ? "forward" : "backward",
    start: { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay(),
      solarDate: yun.getStartSolar().toYmd() },
    cycles: all.filter((value) => value.getIndex() > 0).slice(0, 8).map(convert),
  } : null;
  function entry(target: number): LiuNianEntry {
    const current = all.find((v) => v.getStartYear() <= target && target <= v.getEndYear());
    const raw = current?.getLiuNian().find((v) => v.getYear() === target);
    const independent = independentAnnual(target, birth.year, day.stem);
    const ganZhi = raw?.getGanZhi() ?? independent.ganZhi;
    const branch = ganZhi.slice(1);
    const ranks = ["main", "middle", "residual"] as const;
    const stems = lunarPkg.LunarUtil.ZHI_HIDE_GAN[branch];
    if (!stems) {
      throw new Error("流年藏干缺失");
    }
    const hidden = stems.map((stem, i) => {
      const qi = ranks[i];
      if (!qi) {
        throw new Error("流年藏干气序缺失");
      }
      return { stem, god: godFor(day.stem, stem), qi };
    });
    const cycle = current && current.getIndex() > 0 ? convert(current) : null;
    const previous = cycle ? all.find((v) => v.getIndex() === cycle.index - 1) : null;
    let luckLabel: LiuNianEntry["luckLabel"] = null;
    if (!yun) {
      luckLabel = "时辰未知";
    } else if (!cycle) {
      luckLabel = "起运前";
    }
    return {
      year: target, ganZhi, stem: ganZhi.slice(0, 1), branch,
      age: raw?.getAge() ?? independent.age, stemGod: godFor(day.stem, ganZhi.slice(0, 1)),
      hidden, luck: cycle, luckLabel,
      luckChange: cycle && yun && cycle.startYear === target ? {
        date: yun.getStartSolar().nextYear((cycle.index - 1) * 10).toYmd(),
        from: previous && previous.getIndex() > 0 ? previous.getGanZhi() : null,
        to: cycle.ganZhi,
      } : null,
    };
  }
  const years = Array.from({ length: 10 }, (_, i) => input.targetYear - 3 + i)
    .filter((y) => y >= birthLiChunYear && y <= 2099).map(entry);
  let annual: AnnualLuck | null = input.targetYear < birthLiChunYear
    ? null : independentAnnual(input.targetYear, birth.year, day.stem);
  if (annual) {
    const selected = entry(input.targetYear);
    annual = { ...annual, age: selected.age, currentLuck: selected.luck };
  }
  return {
    sect: input.sect, dayBoundary: input.sect === 1 ? "23:00" : "00:00",
    timeKnown: input.timeKnown, dayMaster: day.stem, pillars: { year, month, day, time },
    taiYuan: eight.getTaiYuan(), mingGong: input.timeKnown ? eight.getMingGong() : null,
    shenGong: input.timeKnown ? eight.getShenGong() : null, luck, annual, warnings,
    birthLiChunYear, liunian: { anchorYear: input.targetYear, years },
  };
}
```

- [ ] **Step 4：运行 `node --import tsx --test tests/bazi.test.ts tests/bazi-fixtures.test.ts`，预期全部通过。**
- [ ] **Step 5：运行 `npm run typecheck`；藏干与十神数组长度不等时必须拒绝，不用类型断言掩盖丢失项。**

### Task B2.3：样稿字段契约与交叉验收

本任务不新增界面。下表锁定 B1–B5 提供的数据，避免 B6 猜字段或把对象直接渲染成 `[object Object]`。B3/B4 字段由本轮完整代码给出；B5 编排仍是后续约束。B6 只消费。B5 组装 `{ chart, ...analyzeBazi(chart), qiongtong: lookupQiongtong(chart.dayMaster, chart.pillars.month.branch) }`，不把 B3 分析对象错误当成 `BaziChart` 原有字段。

| 样稿展示 | 数据来源与精确字段 | 隐私或缺时辰约束 |
|---|---|---|
| 原生日、公农历、性别 | 本机 `BirthProfileInput` | 只在持有本机档案的浏览器显示 |
| 每步原始/结果与校正量 | 请求期 `CorrectedBirthTime.steps[].before/after/deltaMinutes/description` | 不存档，不向分享链接返回 |
| 时柱校正前后对比 | 本机或请求期各排一次，取 `pillars.time?.ganZhi` | B5 持久化只留最终盘及不含时刻的校正状态 |
| 换日说明与切换 | `BaziChart.dayBoundary/sect`；B5 `boundaryChanges` | ≤2 次，重新提交本机生辰；分享查看者无生辰不能重排 |
| 四柱表 | `pillars.year/month/day/time` | `time=null` 显示缺，不引用时柱事实 |
| 干支、十神、藏干长生纳音 | `ganZhi/stem/branch/stemGod/hidden[].stem/god/qi/diShi/naYin` | 明确单字段；不要渲染 pillar 对象 |
| 胎元、命宫、身宫 | `taiYuan/mingGong/shenGong` | 缺时辰时后两项 null |
| 起运与交运日期 | `luck.start.years/months/days/solarDate` | 非交节缺时辰 `luck.approximate=true`；交节日 `luck=null`；交运日期为派生结果 |
| 大运方向与八步时间轴 | `luck.direction/cycles[].ganZhi/stemGod/startAge/endAge/startYear/endYear` | 起运前 currentLuck=null，不能高亮第一步 |
| 所问流年、虚岁与所在运 | `annual.year/ganZhi/age/currentLuck` | 按出生立春年判空；非交节缺时辰照常给近似当前运 |
| 流月与十神 | `annual.months[].index/monthInChinese/ganZhi/stemGod` | 节气月编号不是农历月日期；B5 补当前交节区间 |
| 神煞标签 | B3 `shensha[]`：`name/nodeId/basis` | 按日干、年支、日支等具体依据；不采信样稿为标准答案 |
| 合冲刑害文字与关系图 | B3 `nodes[]`：`id/label/type/value/scope`；`relations[]`：`id/kind/nodeIds/label/scope` | 原局、当前运年；天干合冲，地支半合/拱、三合/三会、自刑；成化结论由三家判断 |
| 五行堆叠条与总数 | B3 `elements[]`：`element/stem/main/middle/residual/total` | 从实际藏干现场计数，不把示意图宽度或总数写死 |
| 三家用神对照 | B4 `output.useGod` | 显示每家实际取用，不用调候表替代其它两家判断 |
| 三家断语卡片 | B4 `output.headline/reason/sections[].title/text/advice[]/evidence[].ref/claim` | 直断、理由、折叠分项、建议、展开证据；命理五分项固定顺序 |
| 运势卡片吉凶与几成 | B4 `output.verdict/confidenceTenths` | 命理不得含这两项，也无合议线 |
| 「留意 某月」标签 | 运势 `output.timing.window`；展开条件为 `output.timing.condition` | `timing` 可选，无值不显示标签；不用 sections 猜月份，不新增 watch 字段 |
| 流年面板锚年与列年 | `chart.liunian.anchorYear/years[].year`，`chart.birthLiChunYear` | 锚前 3 至后 6，裁去出生立春年前及 2099 后；B5 用提问时刻立春年解析锚年 |
| 每年干支、虚岁、十神 | `liunian.years[].ganZhi/stem/branch/age/stemGod/hidden[].stem/god/qi` | 虚岁与 lunar `getAge` 一致，按公历出生年计；藏干顺序取 `ZHI_HIDE_GAN` |
| 每年大运与交接线 | `liunian.years[].luck/luckLabel/luckChange.date/from/to` | `startYear ≤ year ≤ endYear`；交运年归新运，另显示旧→新及日期；起运前 null +「起运前」；交节缺时辰 null +「时辰未知」 |
| 逐年关系格、点选事实 | `years[].year/nodes/relations[].id/kind/label/nodeIds/scope/shensha[].name/nodeId/basis`（B3 分析对象） | 每年重算该年大运；关系按 scope 切换，不能复用锚年关系；神煞覆盖流年与运支 |
| 三家逐年格子与点选短评 | B4 `output.years[].year/verdict/confidenceTenths/note` | 以 year 对齐逐年格子显示吉凶与几成，点选后显示 note；B4 校验窗口、整年锚项与短评词，B6 只消费 |
| 逐年合议线、范围、回看与选中 | B4/B5 按通过核对各家 `years[]` 算平均、最低、最高；B5 提供提问立春年与所问年 | 不使用样稿 `ln-data` 的示意断语作期望；B6 据年份标回看、今年与所问年 |
| 余春台用神对照与出处 | `qiongtong.dayStem/monthBranch/monthName/useStems/section/quote` | B3 查表供 B4 调候家；三家对照显示 B4 该家实际 `useGod`，可展开底本用干与出处；不用卷次 |
| 问卦此刻的时空栏、黄历与奇门 | 既有 `almanacAt` 对象与 `qimenAt`；B5 固定解读时刻 | 与出生时刻完全独立；B6 按真实字段显示 |

- [ ] **Step 1：运行四个新测试文件。**

运行：`node --import tsx --test tests/solar-time.test.ts tests/birth-profile.test.ts tests/bazi.test.ts tests/bazi-fixtures.test.ts`。
预期：全部通过，55 个 fixture 每个两种 sect、每种四柱逐字段一致。

- [ ] **Step 2：运行 `npm run typecheck`。** 继承项目已有三项严格开关，不通过不得进入 B3。
- [ ] **Step 3：运行 `npm test`。** 既有问事、黄历、奇门、付款与 API 回归均须通过；若失败先定位原因，不能回滚用户改动。
- [ ] **Step 4：核对现有 OpenSpec 第 2 节任务。** B1/B2 只完成 2.2 的服务端部分和 2.3 的基础排盘部分，不能勾选整个 2.2/2.3；2.0 要等全计划，2.1 要等用户确认样稿。

### B2 交付核对

- [ ] 已核验校正命例所有字段通过；未校正甲申只是引擎对照。
- [ ] 四种男女阴阳方向现场六十甲子断言通过；缺时辰非交节日正午估运并警示，交节日不排运；命宫、身宫仍不调用。
- [ ] 两种 sect 的晚子时日柱与共同时柱规则明确；起运算法口径没有混用。
- [ ] 独立 sxtwl 原生与适配口径均记录，所有四柱比较；≥40 时刻和全部覆盖类别有测试守卫。
- [ ] 编排持久化不能直接 spread B1 生辰对象或逐步校正对象；B5 按白名单存派生命盘。

## Chunk B3：合冲刑害、神煞、五行计数与《穷通宝鉴》调候表

本块完整给出 B3.1–B3.5，未在项目实施，不勾选 OpenSpec tasks。关系是客观连线，不给身强身弱、成化或格局成败。

### Task B3.1：关系节点、合冲刑害与每年重算

**文件：** 新建 `tests/bazi-relations.test.ts`、`src/calendar/bazi-relations.ts`。测试同时覆盖 B3.2/B3.3，以完整文件给出，不拆同一路径的代码块。

- [ ] **Step 1：写下列完整测试；运行 `node --import tsx --test tests/bazi-relations.test.ts`，预期新模块缺失 RED。**

```ts
// tests/bazi-relations.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { analyzeBazi, findRelations, findShensha,
  type RelationNode } from "../src/calendar/bazi-relations.js";
const input = { corrected: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0 },
  gender: "male" as const, sect: 1 as const, timeKnown: true, targetYear: 2026 };
const chart = buildBaziChart(input);
function node(id: string, value: string, scope: RelationNode["scope"] = "natal"): RelationNode {
  return { id, label: id, value, type: "branch", scope };
}
const sorted = (values: string[]) => values.sort();
const key = (r: {
  label: string;
  nodeIds: string[];
}) => `${r.label}:${r.nodeIds.join(",")}`;
test("锚年原局与运年关系逐项锁定，原局三会不重复", () => {
  const r = analyzeBazi(chart).relations;
  assert.deepEqual(sorted(r.filter((v) => v.scope === "natal").map(key)), sorted([
    "午未合:natal.year.branch,natal.time.branch",
    "巳午未三会火:natal.month.branch,natal.year.branch,natal.time.branch",
  ]));
  assert.deepEqual(sorted(r.filter((v) => v.scope === "luck").map(key)), sorted([
    "甲庚冲:natal.year.stem,luck.stem", "甲庚冲:natal.day.stem,luck.stem",
    "巳申合:natal.month.branch,luck.branch", "巳申刑:natal.month.branch,luck.branch",
    "巳申破:natal.month.branch,luck.branch", "申辰拱水:natal.day.branch,luck.branch",
  ]));
});
const expected = [
  ["午卯破:year", "卯辰害:day", "卯未半合木:time"],
  ["甲庚冲:year", "甲庚冲:day", "辰辰自刑:day", "申辰拱水:luck"],
  ["乙庚合:year", "乙辛冲:month", "乙庚合:day", "巳申合:luck", "巳申刑:luck", "巳申破:luck"],
  ["丙辛合:month", "午午自刑:year", "午未合:time"],
  ["丁癸冲:time", "午未合:year"],
  ["戊癸合:time", "巳申合:month", "巳申刑:month", "巳申破:month", "申辰拱水:day"],
  ["巳酉半合金:month", "辰酉合:day", "酉酉自刑:luck"],
  ["乙庚合:luck", "午戌半合火:year", "辰戌冲:day", "戌未刑:time", "戌未破:time", "酉戌害:luck"],
  ["乙辛冲:luck", "巳亥冲:month", "亥未拱木:time"],
  ["子午冲:year", "子辰半合水:day", "子未害:time", "子酉破:luck"],
];
test("十年每年与原局及当年大运的关系使用集合比较", () => {
  analyzeBazi(chart).years.forEach((y, i) => {
    const actual = y.relations.filter((r) => r.scope === "year").map((r) => {
      const other = r.nodeIds[0]?.split(".");
      return `${r.label}:${other?.[0] === "luck" ? "luck" : other?.[1]}`;
    });
    assert.deepEqual(sorted(actual), sorted([...(expected[i] ?? [])]), String(y.year));
  });
});
test("半合、拱、三合、三会、自刑与缺时柱", () => {
  assert.equal(findRelations([node("a", "申"), node("b", "子")])[0]?.kind, "半合");
  assert.equal(findRelations([node("a", "申"), node("b", "辰")])[0]?.kind, "拱");
  const three = findRelations([node("a", "申"), node("b", "子"), node("c", "辰")]);
  assert.ok(three.some((r) => r.kind === "三合"));
  assert.ok(!three.some((r) => ["半合", "拱"].includes(r.kind)));
  assert.ok(findRelations([node("a", "寅"), node("b", "卯"), node("c", "辰")])
    .some((r) => r.kind === "三会"));
  assert.equal(findRelations([node("a", "辰")]).length, 0);
  assert.equal(findRelations([node("a", "辰"), node("b", "辰")])[0]?.kind, "自刑");
  const absent = analyzeBazi(buildBaziChart({ ...input, timeKnown: false }));
  assert.ok(absent.nodes.every((n) => !n.id.includes("natal.time")));
  assert.ok(absent.relations.every((r) => r.nodeIds.every((id) => !id.includes("natal.time"))));
});
test("独立两两表，固定种子抽样 200 组", () => {
  const tables = {
    stem: { 合: "甲己 乙庚 丙辛 丁壬 戊癸", 冲: "甲庚 乙辛 丙壬 丁癸" },
    branch: { 合: "子丑 寅亥 卯戌 辰酉 巳申 午未", 冲: "子午 丑未 寅申 卯酉 辰戌 巳亥",
      害: "子未 丑午 寅巳 卯辰 申亥 酉戌", 破: "子酉 午卯 巳申 寅亥 辰丑 戌未",
      刑: "寅巳 巳申 申寅 丑戌 戌未 未丑 子卯", 自刑: "辰辰 午午 酉酉 亥亥" },
  };
  let seed = 20261006;
  const rand = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let i = 0; i < 200; i++) {
    const type: RelationNode["type"] = i % 2 ? "stem" : "branch";
    const chars = type === "stem" ? "甲乙丙丁戊己庚辛壬癸" : "子丑寅卯辰巳午未申酉戌亥";
    const a = chars.charAt(rand(chars.length));
    const b = chars.charAt(rand(chars.length));
    const kinds = Object.entries(tables[type]).filter(([, pairs]) => pairs.split(" ")
      .some((p) => p === a + b || p === b + a)).map(([kind]) => kind);
    if (type === "branch" && a !== b) {
      for (const [group, center] of [["申子辰", "子"], ["亥卯未", "卯"],
        ["寅午戌", "午"], ["巳酉丑", "酉"]]) {
        if (group?.includes(a) && group.includes(b)) {
          kinds.push(a === center || b === center ? "半合" : "拱");
        }
      }
    }
    const nodes = [node("a", a), node("b", b)].map((n) => ({ ...n, type }));
    assert.deepEqual(sorted(findRelations(nodes).map((r) => r.kind)), sorted(kinds));
  }
});
test("七种神煞用独立表现场计算并锁定命例", () => {
  const out = analyzeBazi(chart);
  const byStem = {
    天乙贵人: ["丑未", "子申", "亥酉", "亥酉", "丑未", "子申", "丑未", "寅午", "巳卯", "巳卯"],
    文昌: ["巳", "午", "申", "酉", "申", "酉", "亥", "子", "寅", "卯"],
    禄神: ["寅", "卯", "巳", "午", "巳", "午", "申", "酉", "亥", "子"],
    羊刃: ["卯", "", "午", "", "午", "", "酉", "", "子", ""],
  };
  const groups = ["申子辰", "寅午戌", "巳酉丑", "亥卯未"];
  const byBranch = { 桃花: "酉卯午子", 驿马: "寅申亥巳", 华盖: "辰戌丑未" };
  for (const nodes of [out.nodes, ...out.years.map((y) => y.nodes)]) {
    const oracle: string[] = [];
    for (const [name, values] of Object.entries(byStem)) {
      for (const key of name === "天乙贵人" || name === "文昌" ? ["day", "year"] : ["day"]) {
        const stem = chart.pillars[key as "day" | "year"].stem;
        for (const n of nodes.filter((n) => n.type === "branch")) {
          if (values["甲乙丙丁戊己庚辛壬癸".indexOf(stem)]?.includes(n.value)) {
            oracle.push(`${name}:${n.id}:${key === "day" ? "日" : "年"}干${stem}`);
          }
        }
      }
    }
    for (const [name, values] of Object.entries(byBranch)) {
      for (const key of ["day", "year"] as const) {
        const branch = chart.pillars[key].branch;
        const target = values[groups.findIndex((g) => g.includes(branch))];
        for (const n of nodes.filter((n) => n.type === "branch" && n.value === target)) {
          oracle.push(`${name}:${n.id}:${key === "day" ? "日" : "年"}支${branch}`);
        }
      }
    }
    assert.deepEqual(sorted(findShensha(chart,
      nodes).map((v) => `${v.name}:${v.nodeId}:${v.basis}`)), sorted(oracle));
  }
  const has = (name: string, nodeId: string, basis: string) => out.shensha
    .some((v) => v.name === name && v.nodeId === nodeId && v.basis === basis);
  assert.ok(has("天乙贵人", "natal.time.branch", "日干庚"));
  assert.ok(has("华盖", "natal.day.branch", "日支辰"));
  assert.ok(has("禄神", "luck.branch", "日干庚"));
  assert.ok(has("驿马", "luck.branch", "年支午"));
  assert.ok(!out.shensha.some((v) => v.name === "羊刃" && v.nodeId.startsWith("natal")));
  assert.ok(out.years.find((v) => v.year === 2029)?.shensha.some((v) => v.name === "羊刃"));
  assert.ok(out.years.find((v) => v.year === 2027)?.shensha
    .some((v) => v.name === "羊刃" && v.nodeId === "luck.branch" && v.basis === "日干庚"));
  // 覆盖所有干支基准，包括阴干不标羊刃；期望由上述独立表计算。
  for (const stem of "甲乙丙丁戊己庚辛壬癸") {
    const changed = { ...chart, pillars: { ...chart.pillars,
        day: { ...chart.pillars.day, stem }, year: { ...chart.pillars.year, stem } } };
    const nodes = [..."子丑寅卯辰巳午未申酉戌亥"].map((b, i) => node(String(i), b));
    const actual = findShensha(changed, nodes);
    for (const [name, values] of Object.entries(byStem)) {
      const wanted = values["甲乙丙丁戊己庚辛壬癸".indexOf(stem)] ?? "";
      assert.deepEqual(sorted(actual.filter((v) => v.name === name && v.basis === `日干${stem}`)
        .map((v) => nodes.find((n) => n.id === v.nodeId)?.value ?? "")), sorted([...wanted]));
    }
  }
});
test("五行仅数原局，天干与三气从藏干现场重算", () => {
  for (const timeKnown of [true, false]) {
    const c = buildBaziChart({ ...input, timeKnown });
    const pillars = Object.values(c.pillars).filter((p) => p !== null);
    const elements = analyzeBazi(c).elements;
    const mapping = { 木: "甲乙", 火: "丙丁", 土: "戊己", 金: "庚辛", 水: "壬癸" };
    for (const e of elements) {
      const stems = mapping[e.element];
      assert.equal(e.stem, pillars.filter((p) => stems.includes(p.stem)).length);
      for (const qi of ["main", "middle", "residual"] as const) {
        assert.equal(e[qi], pillars.flatMap((p) => p.hidden)
          .filter((h) => h.qi === qi && stems.includes(h.stem)).length);
      }
      assert.equal(e.total, e.stem + e.main + e.middle + e.residual);
    }
    assert.equal(elements.reduce((n, e) => n + e.stem, 0), timeKnown ? 4 : 3);
    assert.equal(elements.reduce((n, e) => n + e.total, 0), pillars.length + pillars.reduce((n,
      p) => n + p.hidden.length, 0));
    if (timeKnown) {
      assert.equal(elements.reduce((n, e) => n + e.total, 0), 15);
    }
  }
});
test("原局半合不被跨范围三合吞掉，字序取表和局序", () => {
  const relations = findRelations([
    node("natal.month.branch", "子"), node("natal.day.branch", "辰"),
    node("year.branch", "申", "year"),
  ]);
  assert.ok(relations.some((r) => r.label === "申子辰三合水" && r.scope === "year"));
  assert.ok(relations.some((r) => r.label === "子辰半合水" && r.scope === "natal"));
  assert.equal(findRelations([node("a", "未"), node("b", "卯")])[0]?.label, "卯未半合木");
  assert.equal(findRelations([node("a", "午"), node("b", "午")])[0]?.label, "午午自刑");
});
```

- [ ] **Step 2：落入下列完整实现；再运行同命令，预期 7 项通过。**

节点 `id` 为 `natal.{year|month|day|time}.{stem|branch}`、`luck.{stem|branch}`、`year.{stem|branch}`。节点顺序先原局年月日时，再运，再年；两两 label 取关系表原对顺序，与节点遍历顺序无关；半合、拱取局序。三合/三会使用固定局名次序，`nodeIds` 对应局名各字。同对的合、刑、破分别保留。三支齐时，仅省略同一已列三合中的同范围成员对，保留原局自身半合/拱；同字替代不重复成局，优先使用原局节点，不能因流年同字把原局局改成流年事实。

```ts
// src/calendar/bazi-relations.ts
import type { BaziChart, LuckCycle } from "./bazi.js";
export type Scope = "natal" | "luck" | "year";
export interface RelationNode {
  id: string;
  label: string;
  type: "stem" | "branch";
  value: string;
  scope: Scope;
}
export interface BaziRelation {
  id: string;
  kind: string;
  label: string;
  nodeIds: string[];
  scope: Scope;
}
export interface Shensha {
  name: string;
  nodeId: string;
  basis: string;
}
const stemPairs = { 合: "甲己 乙庚 丙辛 丁壬 戊癸", 冲: "甲庚 乙辛 丙壬 丁癸" };
const branchPairs = {
  合: "子丑 寅亥 卯戌 辰酉 巳申 午未", 冲: "子午 丑未 寅申 卯酉 辰戌 巳亥",
  害: "子未 丑午 寅巳 卯辰 申亥 酉戌", 破: "子酉 午卯 巳申 寅亥 辰丑 戌未",
  刑: "寅巳 巳申 申寅 丑戌 戌未 未丑 子卯", 自刑: "辰辰 午午 酉酉 亥亥",
};
const combinations = [["申子辰", "水"], ["亥卯未", "木"], ["寅午戌", "火"], ["巳酉丑", "金"]] as const;
const meetings = [["寅卯辰", "木"], ["巳午未", "火"], ["申酉戌", "金"], ["亥子丑", "水"]] as const;
function scopeOf(nodes: RelationNode[]): Scope {
  if (nodes.some((n) => n.scope === "year")) {
    return "year";
  }
  if (nodes.some((n) => n.scope === "luck")) {
    return "luck";
  }
  return "natal";
}
export function makeNodes(chart: BaziChart, luck: LuckCycle | null, ganZhi: string | null): RelationNode[] {
  const nodes: RelationNode[] = [];
  function add(id: string, label: string, gz: string, scope: Scope): void {
    for (const type of ["stem", "branch"] as const) {
      nodes.push({ id: `${id}.${type}`, label: `${label}${type === "stem" ? "干" : "支"}`,
        value: gz.charAt(type === "stem" ? 0 : 1), type, scope });
    }
  }
  for (const p of Object.values(chart.pillars)) {
    if (p) {
      add(`natal.${p.key}`, p.label, p.ganZhi, "natal");
    }
  }
  if (luck) {
    add("luck", "大运", luck.ganZhi, "luck");
  }
  if (ganZhi) {
    add("year", "流年", ganZhi, "year");
  }
  return nodes;
}
export function findRelations(nodes: RelationNode[]): BaziRelation[] {
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length) {
    throw new Error("关系节点编号重复");
  }
  const result: BaziRelation[] = [];
  const full: BaziRelation[] = [];
  function add(kind: string, members: RelationNode[], label: string): void {
    const nodeIds = members.map((n) => n.id);
    result.push({ id: `${kind}:${nodeIds.join(":")}`, kind, label, nodeIds, scope: scopeOf(members) });
  }
  for (const [kind, groups] of [["三合", combinations], ["三会", meetings]] as const) {
    for (const [group, element] of groups) {
      // 每字仅选一个节点：优先原局、再运、再年。原局成局不因重复字另列。
      const members = [...group].map((b) => nodes.find((n) => n.type === "branch" && n.value === b));
      if (members.every((n): n is RelationNode => n !== undefined)) {
        add(kind, members, `${group}${kind}${element}`);
        if (kind === "三合") {
          full.push(result[result.length - 1]!);
        }
      }
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (!a) {
      continue;
    }
    for (const b of nodes.slice(i + 1)) {
      if (a.type !== b.type) {
        continue;
      }
      const pair = a.value + b.value;
      const reverse = b.value + a.value;
      for (const [kind, pairs] of Object.entries(a.type === "stem" ? stemPairs : branchPairs)) {
        // 标签采用关系表的原对顺序，与节点遍历顺序无关。
        const canonical = pairs.split(" ").find((p) => p === pair || p === reverse);
        if (canonical) {
          add(kind, [a, b], canonical + kind);
        }
      }
      if (a.type !== "branch" || a.value === b.value) {
        continue;
      }
      for (const [group, element] of combinations) {
        if (!group.includes(a.value) || !group.includes(b.value)) {
          continue;
        }
        // 只省略已列三合中同范围的成员对；原局半合不能被运年成局吞掉。
        const covered = full.some((relation) => {
          return relation.label === `${group}三合${element}`
            && relation.scope === scopeOf([a, b])
            && relation.nodeIds.includes(a.id) && relation.nodeIds.includes(b.id);
        });
        if (covered) {
          continue;
        }
        const kind = a.value === group.charAt(1) || b.value === group.charAt(1) ? "半合" : "拱";
        const orderedPair = [...group].filter((value) => value === a.value || value === b.value).join("");
        add(kind, [a, b], `${orderedPair}${kind}${element}`);
      }
    }
  }
  return result;
}
// 出处：《三命通会》论神煞诸篇。仅按指定基准查表，不推导吉凶。
const stemRules = {
  天乙贵人: ["丑未", "子申", "亥酉", "亥酉", "丑未", "子申", "丑未", "寅午", "巳卯", "巳卯"],
  文昌: ["巳", "午", "申", "酉", "申", "酉", "亥", "子", "寅", "卯"],
  禄神: ["寅", "卯", "巳", "午", "巳", "午", "申", "酉", "亥", "子"],
  // 阴干羊刃古说有分歧，产品只取阳干，阴干留空。
  羊刃: ["卯", "", "午", "", "午", "", "酉", "", "子", ""],
};
const branchRules = { 桃花: "酉卯午子", 驿马: "寅申亥巳", 华盖: "辰戌丑未" };
export function findShensha(chart: BaziChart, nodes: RelationNode[]): Shensha[] {
  const result: Shensha[] = [];
  function collect(name: string, targets: string, basis: string): void {
    for (const node of nodes) {
      if (node.type === "branch" && targets.includes(node.value)) {
        result.push({ name, nodeId: node.id, basis });
      }
    }
  }
  for (const [name, values] of Object.entries(stemRules)) {
    const keys = name === "天乙贵人" || name === "文昌" ? ["day", "year"] as const : ["day"] as const;
    for (const key of keys) {
      const stem = chart.pillars[key].stem;
      collect(name, values["甲乙丙丁戊己庚辛壬癸".indexOf(stem)] ?? "", `${key === "day" ? "日" : "年"}干${stem}`);
    }
  }
  for (const [name, values] of Object.entries(branchRules)) {
    for (const key of ["year", "day"] as const) {
      const branch = chart.pillars[key].branch;
      const i = ["申子辰", "寅午戌", "巳酉丑", "亥卯未"].findIndex((g) => g.includes(branch));
      collect(name, values.charAt(i), `${key === "day" ? "日" : "年"}支${branch}`);
    }
  }
  return result;
}
export interface ElementCount {
  element: "木" | "火" | "土" | "金" | "水";
  stem: number;
  main: number;
  middle: number;
  residual: number;
  total: number;
}
export function countElements(chart: BaziChart): ElementCount[] {
  const pillars = Object.values(chart.pillars).filter((p) => p !== null);
  const mapping = { 木: "甲乙", 火: "丙丁", 土: "戊己", 金: "庚辛", 水: "壬癸" } as const;
  return (Object.keys(mapping) as (keyof typeof mapping)[]).map((element) => {
    const chars = mapping[element];
    const stem = pillars.filter((p) => chars.includes(p.stem)).length;
    const hidden = pillars.flatMap((p) => p.hidden).filter((h) => chars.includes(h.stem));
    const main = hidden.filter((h) => h.qi === "main").length;
    const middle = hidden.filter((h) => h.qi === "middle").length;
    const residual = hidden.filter((h) => h.qi === "residual").length;
    return { element, stem, main, middle, residual, total: stem + main + middle + residual };
  });
}
export interface BaziAnalysis {
  nodes: RelationNode[];
  relations: BaziRelation[];
  shensha: Shensha[];
  elements: ElementCount[];
  years: {
    year: number;
    nodes: RelationNode[];
    relations: BaziRelation[];
    shensha: Shensha[];
  }[];
}
export function analyzeBazi(chart: BaziChart): BaziAnalysis {
  const nodes = makeNodes(chart, chart.annual?.currentLuck ?? null, chart.annual?.ganZhi ?? null);
  return {
    nodes, relations: findRelations(nodes), shensha: findShensha(chart, nodes),
    elements: countElements(chart),
    years: chart.liunian.years.map((year) => {
      const nodes = makeNodes(chart, year.luck, year.ganZhi);
      return { year: year.year, nodes, relations: findRelations(nodes), shensha: findShensha(chart, nodes) };
    }),
  };
}
// 供 B4 复用关系表的通行标签词表，不另写关系推导规则。
export function baziRelationWords(): string[] {
  const words: string[] = [];
  for (const table of [stemPairs, branchPairs]) {
    for (const [kind, pairs] of Object.entries(table)) {
      words.push(...pairs.split(" ").map((pair) => pair + kind));
    }
  }
  for (const [group, element] of combinations) {
    words.push(`${group}三合${element}`);
    for (const [left, right] of [[0, 1], [0, 2], [1, 2]] as const) {
      const kind = left === 1 || right === 1 ? "半合" : "拱";
      words.push(`${group.charAt(left)}${group.charAt(right)}${kind}${element}`);
    }
  }
  for (const [group, element] of meetings) {
    words.push(`${group}三会${element}`);
  }
  return words;
}
```

### Task B3.2：七种神煞与基准说明

**文件：** 已在 B3.1 的完整文件中给出 `findShensha`，不另建重复文件。

- [ ] **Step 1：先运行独立查表测试，确认未有神煞实现时 RED。** 年干/日干天乙与文昌分别标 basis；禄神和羊刃只查日干；桃花、驿马、华盖分别查年支/日支，含基准柱自身。
- [ ] **Step 2：实现 B3.1 中的查表函数，再运行 `node --import tsx --test --test-name-pattern="七种神煞" tests/bazi-relations.test.ts`。** 预期通过；四柱、运支、流年支均检查，窗口逐年重算。阴干不标羊刃，注释说明古说分歧。
- [ ] **Step 3：核对出处注释。** 使用有把握的《三命通会》论神煞诸篇，不编造卷次；四柱表只筛 `natal.*.branch`，不能将运年神煞贴回四柱。

### Task B3.3：天干和藏干三气五行计数

**文件：** B3.1 中的 `countElements` 与五行测试。

- [ ] **Step 1：先运行五行测试，确认计数缺失时 RED。** 木火土金水逐项按实际天干、藏干重算，不拿样稿条宽作答案。
- [ ] **Step 2：实现并运行 `node --import tsx --test --test-name-pattern="五行" tests/bazi-relations.test.ts`，预期通过。** 只计原局；有时柱 4 天干、11 藏干，共 15；缺时柱仅三柱。`qi` 按 lunar 藏干顺序对应本/中/余气，不加权、不混入大运流年。

### Task B3.4：120 条调候用干、章节与逐字底本摘句

**文件：** 新建 `tests/qiongtong.test.ts`、`src/calendar/data/qiongtong.json`、`src/calendar/qiongtong.ts`。选择完整 JSON 方案，无需安装依赖或额外生成器；下列 120 个对象即逐条复核表，每条均有日干、月令、用干、章节和摘句，可直接抽取复现。

- [ ] **Step 1：写完整测试；运行 `node --import tsx --test tests/qiongtong.test.ts`，预期模块缺失 RED。**

```ts
// tests/qiongtong.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readQiongtong, lookupQiongtong, validateQiongtong } from "../src/calendar/qiongtong.js";
const sourceUrl = new URL("../tools/bazi/reference/qiongtong-wikisource.txt", import.meta.url);
const source = readFileSync(sourceUrl, "utf8");
test("120 条无缺无重，原文逐字出自对应日干季节章节", () => {
  const rows = readQiongtong();
  assert.equal(rows.length, 120);
  assert.equal(new Set(rows.map((r) => r.dayStem + r.monthBranch)).size, 120);
  for (const stem of "甲乙丙丁戊己庚辛壬癸") {
    for (const branch of "寅卯辰巳午未申酉戌亥子丑") {
      assert.ok(lookupQiongtong(stem, branch));
    }
  }
  for (const row of rows) {
    const start = source.indexOf(`=== ${row.section} ===`);
    assert.ok(start >= 0);
    const end = source.indexOf("===", start + `=== ${row.section} ===`.length);
    const section = source.slice(start + `=== ${row.section} ===`.length, end < 0 ? undefined : end);
    assert.ok(section.includes(row.quote), `${row.dayStem}${row.monthBranch} 摘句不在章节内`);
    assert.equal(row.section.charAt(2), row.dayStem);
    const seasons = { 春: "寅卯辰", 夏: "巳午未", 秋: "申酉戌", 冬: "亥子丑" };
    assert.ok(seasons[row.section.charAt(1) as keyof typeof seasons]?.includes(row.monthBranch));
    assert.ok(row.useStems.length > 0);
    assert.equal(new Set(row.useStems).size, row.useStems.length);
    assert.ok(row.useStems.every((s) => s.length === 1 && "甲乙丙丁戊己庚辛壬癸".includes(s)));
    assert.ok(row.useStems.every((s) => row.quote.includes(s)));
  }
});
test("已核验庚巳与甲寅抽样及非法条目拒绝", () => {
  const geng = lookupQiongtong("庚", "巳");
  assert.deepEqual(geng.useStems, ["壬", "戊", "丙"]);
  assert.equal(geng.section, "三夏庚金");
  assert.ok(geng.quote.includes("但先壬水") && geng.quote.includes("次取戊土，丙火佐之"));
  const jia = lookupQiongtong("甲", "寅");
  assert.ok(jia.useStems.includes("丙") && jia.useStems.includes("癸"));
  assert.ok(jia.quote.includes("得丙癸逢"));
  assert.throws(() => lookupQiongtong("甲", "错"), /调候/);
  assert.throws(() => validateQiongtong([]), /120/);
  assert.throws(() => validateQiongtong([...readQiongtong().slice(1), readQiongtong()[1]]), /重复/);
  assert.throws(() => validateQiongtong(readQiongtong().map((r, i) => i ? r : { ...r,
    useStems: ["错"] })), /调候/);
});
test("酌用参酌不收，并用照收", () => {
  assert.deepEqual(lookupQiongtong("乙", "巳").useStems, ["癸", "庚", "辛"]);
  assert.deepEqual(lookupQiongtong("戊", "午").useStems, ["壬", "甲"]);
  assert.deepEqual(lookupQiongtong("癸", "午").useStems, ["庚", "辛", "壬"]);
});
```

- [ ] **Step 2：录入完整 JSON。** `quote` 保留底本繁简混用、标点与 wikitext 粗体标记，不改字、不拼接不连续句。**取材规则（主管本轮裁定）：** 用干按明确推荐项收入，先后词优先于背景字出现顺序。「为尊、为要、为先、宜、喜、不可少、必须、非某不可」均视为明确用神；「并用」「佐」照收。「酌用」「参酌」不收，因此乙巳为癸、庚、辛，戊午为壬、甲；癸午虽有「参酌」，因明确「并用」仍收庚、辛、壬。「忌」「病」「两透科甲」等成贵组合不作为用干。季总论有分月指示时按分月指示；丁午只有条件句且无可用季总论，按裁定收甲、庚并保留条件说明。其余 19 组取舍照准，文末留作已裁定取材记录。

```json
// src/calendar/data/qiongtong.json
[
{"dayStem":"甲","monthBranch":"寅","monthName":"正月","useStems":["丙","癸"],"section":"三春甲木","quote":"'''正月甲木'''，初春尚有余寒，得丙癸逢，富贵双全。癸藏丙透，名寒木向阳，主大富贵。倘风水不及，亦不失儒林俊秀。如无丙癸，平常人也。"},
{"dayStem":"甲","monthBranch":"卯","monthName":"二月","useStems":["庚","丁"],"section":"三春甲木","quote":"凡三春甲木，用庚者，土为妻，金为子。用丁者，木为妻，火为子。"},
{"dayStem":"甲","monthBranch":"辰","monthName":"三月","useStems":["庚","壬"],"section":"三春甲木","quote":"'''三月甲木'''，木气相竭。先取庚金，次用壬水。庚壬两透，一榜堪图。但要运用相生，风水阴德，方许富贵。"},
{"dayStem":"甲","monthBranch":"巳","monthName":"四月","useStems":["癸","丁"],"section":"三夏甲木","quote":"'''四月甲木'''退气，丙火司权，先癸后丁。"},
{"dayStem":"甲","monthBranch":"午","monthName":"五月","useStems":["癸","丁","庚"],"section":"三夏甲木","quote":"'''五六月甲木'''，木性虚焦，一理共推。五月先癸后丁庚金次之。六月三伏生寒，丁火退气。先丁后庚，无癸亦可。或五月乏癸，用丁亦可，要运行北地为隹。"},
{"dayStem":"甲","monthBranch":"未","monthName":"六月","useStems":["丁","庚"],"section":"三夏甲木","quote":"'''五六月甲木'''，木性虚焦，一理共推。五月先癸后丁庚金次之。六月三伏生寒，丁火退气。先丁后庚，无癸亦可。或五月乏癸，用丁亦可，要运行北地为隹。"},
{"dayStem":"甲","monthBranch":"申","monthName":"七月","useStems":["丁","庚"],"section":"三秋甲木","quote":"'''七月甲木'''，丁火为尊，庚金次之，庚金不可少。火隔水不能镕金，故丁火镕金，必赖甲木引助，方成洪炉。若有癸水阻隔，便灭丁火，壬水无碍，且能合丁，但须见戊土，方可制水存火。"},
{"dayStem":"甲","monthBranch":"酉","monthName":"八月","useStems":["丁","丙","庚"],"section":"三秋甲木","quote":"'''八月甲木'''，木囚金旺。丁火为先，次用丙火，庚金再次。"},
{"dayStem":"甲","monthBranch":"戌","monthName":"九月","useStems":["丁","癸"],"section":"三秋甲木","quote":"九月甲木，耑用丁癸，见戊透必贵。如戊戌、壬戌、甲子、甲申，支成水局，干有壬水，正合贵元武之说。配得中和，一榜之命，家计丰足。但庚丁未透出干，不能馆选。"},
{"dayStem":"甲","monthBranch":"亥","monthName":"十月","useStems":["庚","丁","丙"],"section":"三冬甲木","quote":"'''十月甲木'''，庚丁为要，丙火次之。忌壬水泛身，须戊土制之。"},
{"dayStem":"甲","monthBranch":"子","monthName":"十一月","useStems":["丁","庚","丙"],"section":"三冬甲木","quote":"'''十一月甲木'''，木性生寒，丁先庚后，丙火佐之。癸水司权，为火金之病。庚丁两透，支见巳寅，科甲有准，风水不及，选拔有之。若癸透伤丁。无戊己辅救，残疾之人。或壬水重出，丁火全无者，庸人也，得丙方妙。"},
{"dayStem":"甲","monthBranch":"丑","monthName":"十二月","useStems":["庚","丁"],"section":"三冬甲木","quote":"'''十二月甲木'''，天寒气冻，木性极寒，无生发之象，先用庚噼甲，方引丁火始得木火有通明之象，故丁次之。"},
{"dayStem":"乙","monthBranch":"寅","monthName":"正月","useStems":["丙","癸"],"section":"三春乙木","quote":"'''正月乙木'''，必须用丙，因天气尤有余寒，非丙不暖，虽有癸水，恐凝寒气，故以丙火为先，癸水次之。"},
{"dayStem":"乙","monthBranch":"卯","monthName":"二月","useStems":["丙","癸"],"section":"三春乙木","quote":"二月乙木，耑用丙癸，或支成木局，有癸透乃作贵命，更得丙洩木气，上上之命，但须透癸。或水多困丙，多戊化癸，皆下格。"},
{"dayStem":"乙","monthBranch":"辰","monthName":"三月","useStems":["癸","丙"],"section":"三春乙木","quote":"'''三月乙木'''，阳气愈炽，先癸后丙。"},
{"dayStem":"乙","monthBranch":"巳","monthName":"四月","useStems":["癸","庚","辛"],"section":"三夏乙木","quote":"'''四月乙木'''，自有丙火，耑取癸水为尊。四月乙木专用癸水，丙火酌用，虽以庚辛佐癸，须辛透为清。癸透、庚辛又透，科甲定然，独一点癸水、无金，是水无根，虽出天干，不过秀才小富，须要大运相扶。或土多困癸，贫贱之人。丙戊太多，支成火局，瞽目之流。"},
{"dayStem":"乙","monthBranch":"午","monthName":"五月","useStems":["癸","丙"],"section":"三夏乙木","quote":"'''五月乙木'''，丁火司权，禾稼俱旱。上半月属阳，仍用癸水。下半月属阴，三伏生寒，丙癸齐用。柱多金水，丙火为先，余皆用癸水为先。"},
{"dayStem":"乙","monthBranch":"未","monthName":"六月","useStems":["丙","癸"],"section":"三夏乙木","quote":"'''六月乙木'''，木性且寒，柱多金水，丙火为尊。支成水局，乙得无伤。癸水透干，大富大贵。无癸定作常人，运不行北，困苦一生。\n\n凡五六月乙木，气退枯焦，用癸水切忌戊己杂乱，则为下格。或甲木高透，制伏土神名为去浊留清，可许俊秀。土多乏甲秀气脱空，庸人而已。"},
{"dayStem":"乙","monthBranch":"申","monthName":"七月","useStems":["己"],"section":"三秋乙木","quote":"'''七月乙木'''，庚金乘令，庚虽输情于乙妹，怎奈干乙难合支金。柱见庚多，乙难受载。或丙透干，又加巳出埋金，此格可云科甲。有己透、加丙，亦是上命。七月喜己土为用，或不见丙癸。己土必不可少，此则以火为妻，土为子。"},
{"dayStem":"乙","monthBranch":"酉","monthName":"八月","useStems":["癸","丙"],"section":"三秋乙木","quote":"'''八月乙木'''，芝兰禾稼均退。以丹桂为乙木。在白露之后，桂蕊未开，耑用癸水以滋桂萼。若秋分后，桂花已开，却喜向阳，又宜用丙，癸水次之，丙癸两透，科甲名臣。"},
{"dayStem":"乙","monthBranch":"戌","monthName":"九月","useStems":["癸"],"section":"三秋乙木","quote":"'''九月乙木'''，根枯叶落，必赖癸水滋养。如见甲申时，名为藤萝系甲，可秋可冬。若见癸水，又遇辛金发水之源，定主科甲。或有癸无辛，常人。有辛无癸，贫贱。或四柱壬多，水难生乙，亦是寻常之辈。"},
{"dayStem":"乙","monthBranch":"亥","monthName":"十月","useStems":["丙","戊"],"section":"三冬乙木","quote":"'''十月乙木'''，木不受气，而壬水司令，取丙为用，戊土次之。丙戊两透，科甲定然。有丙无戊，虽不科甲，亦入儒林。支多丙火，运入火乡，亦主显达。"},
{"dayStem":"乙","monthBranch":"子","monthName":"十一月","useStems":["丙"],"section":"三冬乙木","quote":"'''十一月乙木'''，花木寒冻，一阳来复，喜用丙火解冻，则花木有向阳之意，不宜用癸以冻花木，故耑用丙火。"},
{"dayStem":"乙","monthBranch":"丑","monthName":"十二月","useStems":["丙"],"section":"三冬乙木","quote":"或四柱多己，不逢比劫，乃为从才，富比王侯，若见比劫，贫无立锥。虽或一派戊己，见甲颇有衣禄。耑以丙火为用，方妙。"},
{"dayStem":"丙","monthBranch":"寅","monthName":"正月","useStems":["壬","庚"],"section":"三春丙火","quote":"'''正月丙火'''，三阳开泰，火气渐炎，取壬为尊，庚金佐之。壬庚两透，科甲定然。即壬透庚藏，亦有异途显达。"},
{"dayStem":"丙","monthBranch":"卯","monthName":"二月","useStems":["壬"],"section":"三春丙火","quote":"'''二月丙火'''，阳气舒升，耑用壬水。壬透天干，不见丁化，加以庚辛己亦透，壬水有根，定主科甲。"},
{"dayStem":"丙","monthBranch":"辰","monthName":"三月","useStems":["壬","甲"],"section":"三春丙火","quote":"'''三月丙火'''，气渐炎升，用壬水。或成土局，取甲为辅，壬不可离。壬甲两透，科甲定宜，惟忌庚出制甲，则秀才而已。无甲用庚，助壬水洩土气。"},
{"dayStem":"丙","monthBranch":"巳","monthName":"四月","useStems":["壬"],"section":"三夏丙火","quote":"'''四月丙火'''，建禄于巳，火势炎炎，宜专用壬水，解炎威之力，成既济之功。如无壬水，孤阳失辅，难透清光。得庚发水源，方为有根之水。壬庚两透，不见戊土，号曰湖水汪洋，广映太阳，光辉显着，文明之象，人格合此，不但科甲峥嵘，必有恩谥封荣，若不验，必暗损阴德。"},
{"dayStem":"丙","monthBranch":"午","monthName":"五月","useStems":["壬"],"section":"三夏丙火","quote":"'''五月丙火'''，得壬高透，方为上命。或一壬无庚，亦主贡监，犹防戊己出干，丁壬化合，则为平人。即不透庚壬，或有申宫长生之水，济之坐禄之金，至妙，必入词林。又怕戊己杂乱，则为异路。"},
{"dayStem":"丙","monthBranch":"未","monthName":"六月","useStems":["壬","庚"],"section":"三夏丙火","quote":"'''六月丙火'''退气，三伏生寒，壬水为用，取庚辅佐。"},
{"dayStem":"丙","monthBranch":"申","monthName":"七月","useStems":["壬"],"section":"三秋丙火","quote":"'''七月丙火'''，太阳转西，阳气衰矣。日近西山，见土皆晦，惟日照湖海，暮夜光天，故仍用壬水，辅映光辉。"},
{"dayStem":"丙","monthBranch":"酉","monthName":"八月","useStems":["壬"],"section":"三秋丙火","quote":"'''八月丙火'''，日近黄昏，丙火之余光，存于光湖，仍用壬水辅映。"},
{"dayStem":"丙","monthBranch":"戌","monthName":"九月","useStems":["甲","壬"],"section":"三秋丙火","quote":"'''九月丙火'''，火气愈退，所忌土晦光火，必须先用甲木，次取壬水。甲壬两透，富贵非凡。若无壬水，得癸透干，亦可，虽不科甲，异路功名。壬癸藏支，贡监而已。甲藏壬透，无庚破甲，可许秀才。或庚戊困了水木，定是庸才。无甲壬癸者，下格。"},
{"dayStem":"丙","monthBranch":"亥","monthName":"十月","useStems":["庚","戊","壬"],"section":"三冬丙火","quote":"总之十月丙火，木旺宜庚，水旺宜戊，火旺用壬，随宜酌用可也。"},
{"dayStem":"丙","monthBranch":"子","monthName":"十一月","useStems":["壬","戊"],"section":"三冬丙火","quote":"'''十一月丙火'''，冬至一阳生，弱中复强，壬水为最，戊土佐之。"},
{"dayStem":"丙","monthBranch":"丑","monthName":"十二月","useStems":["壬","甲"],"section":"三冬丙火","quote":"'''十二月丙火'''，气进二阳，侮雪欺霜，喜壬为用。己土司令，土多又不可少甲。壬甲两透，科甲堪宜，甲藏则秀才而已。或无甲得一壬透，富中取贵。"},
{"dayStem":"丁","monthBranch":"寅","monthName":"正月","useStems":["庚"],"section":"三春丁火","quote":"'''正月丁火'''，甲木当权，乃为母旺，非庚不能噼甲，何以引丁，姑用庚金。"},
{"dayStem":"丁","monthBranch":"卯","monthName":"二月","useStems":["庚","甲"],"section":"三春丁火","quote":"'''二月丁火'''，溼乙伤丁，先庚后甲，非庚不能去乙，非甲不能引丁。庚甲两透，科甲定然。庚透甲藏，亦有生贡。甲透庚藏，异路功名。"},
{"dayStem":"丁","monthBranch":"辰","monthName":"三月","useStems":["甲","庚"],"section":"三春丁火","quote":"'''三月丁火'''，戊土司令，洩弱丁气，先用甲木引丁制土，次看庚金。庚甲两透，定主科甲。或一藏一透，终非白丁。"},
{"dayStem":"丁","monthBranch":"巳","monthName":"四月","useStems":["甲","庚"],"section":"三夏丁火","quote":"'''四月丁火'''乘旺，虽取甲引丁，必用庚噼甲。伐甲、方云木火通明。甲多、又取庚为先。但四柱忌见癸水。癸水一见，洩金、溼甲、伤丁，故以癸为病。或癸水藏支，壬水出干制丙，不夺丁光，自是雁塔题名，玉堂清贵。"},
{"dayStem":"丁","monthBranch":"午","monthName":"五月","useStems":["甲","庚"],"section":"三夏丁火","quote":"若干支无火局，有水透干，须用甲木，又要庚噼甲方明。木火通明，主大富贵。或木少火多，焚其木性，不能光透九霄，荣华不久。"},
{"dayStem":"丁","monthBranch":"未","monthName":"六月","useStems":["甲","壬"],"section":"三夏丁火","quote":"'''六月之丁'''，阴柔退气，但值三伏生寒，丁弱极矣，专取甲木，壬水次之。"},
{"dayStem":"丁","monthBranch":"申","monthName":"七月","useStems":["甲","丙"],"section":"三秋丁火","quote":"三秋甲庚丙并用，仍分优劣，何也？七月甲丙，申中有庚，八月甲丙庚皆用，七八月或无甲木，乙亦可用，为枯草引灯，却不离丙晒也。九月耑用甲庚。大扺甲不离庚，乙不离丙，其理极明。或见甲庚丙皆透，必主科甲。无甲用乙者，富贵皆小，且富而不贵者多。"},
{"dayStem":"丁","monthBranch":"酉","monthName":"八月","useStems":["甲","丙","庚"],"section":"三秋丁火","quote":"三秋甲庚丙并用，仍分优劣，何也？七月甲丙，申中有庚，八月甲丙庚皆用，七八月或无甲木，乙亦可用，为枯草引灯，却不离丙晒也。九月耑用甲庚。大扺甲不离庚，乙不离丙，其理极明。或见甲庚丙皆透，必主科甲。无甲用乙者，富贵皆小，且富而不贵者多。"},
{"dayStem":"丁","monthBranch":"戌","monthName":"九月","useStems":["甲","庚"],"section":"三秋丁火","quote":"三秋甲庚丙并用，仍分优劣，何也？七月甲丙，申中有庚，八月甲丙庚皆用，七八月或无甲木，乙亦可用，为枯草引灯，却不离丙晒也。九月耑用甲庚。大扺甲不离庚，乙不离丙，其理极明。或见甲庚丙皆透，必主科甲。无甲用乙者，富贵皆小，且富而不贵者多。"},
{"dayStem":"丁","monthBranch":"亥","monthName":"十月","useStems":["庚","甲"],"section":"三冬丁火","quote":"三冬丁火微寒，耑用庚甲。甲乃庚之良友。凡用甲木，庚不可少，无庚无甲，何能引丁？难云木火通明，冬丁有甲，不怕水多金多。可称上格。甲庚两透，科甲分明。见己则否。己多合甲，则为常人。"},
{"dayStem":"丁","monthBranch":"子","monthName":"十一月","useStems":["庚","甲"],"section":"三冬丁火","quote":"三冬丁火微寒，耑用庚甲。甲乃庚之良友。凡用甲木，庚不可少，无庚无甲，何能引丁？难云木火通明，冬丁有甲，不怕水多金多。可称上格。甲庚两透，科甲分明。见己则否。己多合甲，则为常人。"},
{"dayStem":"丁","monthBranch":"丑","monthName":"十二月","useStems":["庚","甲"],"section":"三冬丁火","quote":"三冬丁火微寒，耑用庚甲。甲乃庚之良友。凡用甲木，庚不可少，无庚无甲，何能引丁？难云木火通明，冬丁有甲，不怕水多金多。可称上格。甲庚两透，科甲分明。见己则否。己多合甲，则为常人。"},
{"dayStem":"戊","monthBranch":"寅","monthName":"正月","useStems":["丙","甲","癸"],"section":"三春戊土","quote":"三春戊土，无丙照暖，戊土不生，无甲疏噼，戊土不灵，无癸滋润，万物不长。正二月先丙后甲，癸又次之。三月先甲后丙，癸又次之，因戊土司权故也。有甲、丙、癸，三者齐透，必主一品当朝，或二透一藏，亦登金榜，二藏一透，也可异途。"},
{"dayStem":"戊","monthBranch":"卯","monthName":"二月","useStems":["丙","甲","癸"],"section":"三春戊土","quote":"三春戊土，无丙照暖，戊土不生，无甲疏噼，戊土不灵，无癸滋润，万物不长。正二月先丙后甲，癸又次之。三月先甲后丙，癸又次之，因戊土司权故也。有甲、丙、癸，三者齐透，必主一品当朝，或二透一藏，亦登金榜，二藏一透，也可异途。"},
{"dayStem":"戊","monthBranch":"辰","monthName":"三月","useStems":["甲","丙","癸"],"section":"三春戊土","quote":"三春戊土，无丙照暖，戊土不生，无甲疏噼，戊土不灵，无癸滋润，万物不长。正二月先丙后甲，癸又次之。三月先甲后丙，癸又次之，因戊土司权故也。有甲、丙、癸，三者齐透，必主一品当朝，或二透一藏，亦登金榜，二藏一透，也可异途。"},
{"dayStem":"戊","monthBranch":"巳","monthName":"四月","useStems":["甲","丙","癸"],"section":"三夏戊土","quote":"'''四月戊土'''，阳气发升，寒气内藏，外实内虚，不畏火炎，无阳气相催，万物不长，故先用甲疏噼，次取丙癸为佐。"},
{"dayStem":"戊","monthBranch":"午","monthName":"五月","useStems":["壬","甲"],"section":"三夏戊土","quote":"'''五月戊土'''，仲夏火炎，先看壬水，次取甲木，丙火酌用，用癸力微。"},
{"dayStem":"戊","monthBranch":"未","monthName":"六月","useStems":["癸","丙","甲"],"section":"三夏戊土","quote":"'''六月戊土'''，遇夏干枯，先看癸水，次用丙火甲木。癸丙两透，科甲中人。或有癸无丙，见甲可许秀才。无甲略富。或有丙无癸，假道斯文，衣食颇足。"},
{"dayStem":"戊","monthBranch":"申","monthName":"七月","useStems":["丙","癸","甲"],"section":"三秋戊土","quote":"七月戊土，阳气渐入，寒气渐出，先丙后癸，甲木次之。丙癸甲透者，富贵极品。癸藏丙透，不仅秀才。丙甲两透，癸水会局藏辰，亦不失富贵。无丙得癸甲透，此人清雅，家富千金。无癸甲者、常人。有丙火、妻贤子肖。若丙甲癸三者俱无，下流之命。"},
{"dayStem":"戊","monthBranch":"酉","monthName":"八月","useStems":["丙","癸"],"section":"三秋戊土","quote":"'''八月戊土'''，金洩身寒，赖丙照暖，喜水滋润，先丙后癸，不必木疏。丙癸两透，科甲中人。丙透癸藏，可许入泮。癸透丙藏，纳资得官。若丙藏又无癸，即多不透，此皆常人。丙癸全无，奔流之客。"},
{"dayStem":"戊","monthBranch":"戌","monthName":"九月","useStems":["甲","癸"],"section":"三秋戊土","quote":"'''九月戊土'''当权，不可专用丙，先看甲木，次取癸水，却忌化合。见金先用癸水，后取丙火，配合支干，方成有生之土，定发云程。"},
{"dayStem":"戊","monthBranch":"亥","monthName":"十月","useStems":["甲","丙"],"section":"三冬戊土","quote":"'''十月戊土'''，时值小阳，阳气略出，先用甲木，次取丙火。非甲、土不灵。非丙、土不暖，安能生发万物。甲丙两出，富贵中人。或甲得长生，遇支藏得地之水，一丙高透，亦主身贵扬名。"},
{"dayStem":"戊","monthBranch":"子","monthName":"十一月","useStems":["丙","甲"],"section":"三冬戊土","quote":"'''十一二月'''严寒冰冻，丙火为专，甲木为佐。丙甲两透，桃浪之人，丙出甲藏，采芹食饩。丙藏甲出，佐杂前程。有丙无甲者，豪富。有甲无丙者，清贫。丙甲全无，下流之造。"},
{"dayStem":"戊","monthBranch":"丑","monthName":"十二月","useStems":["丙","甲"],"section":"三冬戊土","quote":"'''十一二月'''严寒冰冻，丙火为专，甲木为佐。丙甲两透，桃浪之人，丙出甲藏，采芹食饩。丙藏甲出，佐杂前程。有丙无甲者，豪富。有甲无丙者，清贫。丙甲全无，下流之造。"},
{"dayStem":"己","monthBranch":"寅","monthName":"正月","useStems":["丙"],"section":"三春己土","quote":"'''正月己土'''，田园犹冻，盖因腊气未除，余寒未退，故丙为尊。得丙照暖，万物自生，忌见壬水，反为己病，何也？壬乃江湖之水，湖水一发，则田园洗荡，变为沙土，而根苗尽没矣。须戊作堤，以保园圃。壬多要见戊制。有戊出干者，定主玉堂金马。若乏戊制，必属平常。"},
{"dayStem":"己","monthBranch":"卯","monthName":"二月","useStems":["甲","癸"],"section":"三春己土","quote":"'''二月己土'''，阳气渐升，虽禾稼未成，万物出土，田园未展，先取甲木疏之，忌合。次取癸水润之。甲癸出干，定主科甲，加以一丙出透，势压百僚。一见壬水，微末官职。"},
{"dayStem":"己","monthBranch":"辰","monthName":"三月","useStems":["丙","癸","甲"],"section":"三春己土","quote":"'''三月己土'''，正栽培禾稼之时，先丙后癸，土暖而润，随用甲疏，三者俱透天干，必官居黄阁。或三者透一，科甲定然，但要得地。却以庚金为病。"},
{"dayStem":"己","monthBranch":"巳","monthName":"四月","useStems":["癸","丙"],"section":"三夏己土","quote":"三夏己土，杂气才官，禾稼在田，最喜甘沛，取癸为要，次用丙火。夏无太阳，禾稼不长，故无癸曰旱田，无丙曰孤阴。"},
{"dayStem":"己","monthBranch":"午","monthName":"五月","useStems":["癸","丙"],"section":"三夏己土","quote":"三夏己土，杂气才官，禾稼在田，最喜甘沛，取癸为要，次用丙火。夏无太阳，禾稼不长，故无癸曰旱田，无丙曰孤阴。"},
{"dayStem":"己","monthBranch":"未","monthName":"六月","useStems":["癸","丙"],"section":"三夏己土","quote":"三夏己土，杂气才官，禾稼在田，最喜甘沛，取癸为要，次用丙火。夏无太阳，禾稼不长，故无癸曰旱田，无丙曰孤阴。"},
{"dayStem":"己","monthBranch":"申","monthName":"七月","useStems":["癸","丙","辛"],"section":"三秋己土","quote":"总之，三秋己土，先癸后丙，取辛辅癸。九月土盛，宜甲木疏之，余皆酌用。"},
{"dayStem":"己","monthBranch":"酉","monthName":"八月","useStems":["癸","丙","辛"],"section":"三秋己土","quote":"总之，三秋己土，先癸后丙，取辛辅癸。九月土盛，宜甲木疏之，余皆酌用。"},
{"dayStem":"己","monthBranch":"戌","monthName":"九月","useStems":["癸","丙","辛","甲"],"section":"三秋己土","quote":"总之，三秋己土，先癸后丙，取辛辅癸。九月土盛，宜甲木疏之，余皆酌用。"},
{"dayStem":"己","monthBranch":"亥","monthName":"十月","useStems":["丙","戊","丁"],"section":"三冬己土","quote":"三冬己土，溼泥寒冻，非丙暖不生，取丙为尊，甲木参酌。戊土癸水不用。惟初冬壬旺，取戊制之。余皆用丙丁，但丁不能解冻除寒，不能大济。"},
{"dayStem":"己","monthBranch":"子","monthName":"十一月","useStems":["丙","丁"],"section":"三冬己土","quote":"三冬己土，溼泥寒冻，非丙暖不生，取丙为尊，甲木参酌。戊土癸水不用。惟初冬壬旺，取戊制之。余皆用丙丁，但丁不能解冻除寒，不能大济。"},
{"dayStem":"己","monthBranch":"丑","monthName":"十二月","useStems":["丙","丁"],"section":"三冬己土","quote":"三冬己土，溼泥寒冻，非丙暖不生，取丙为尊，甲木参酌。戊土癸水不用。惟初冬壬旺，取戊制之。余皆用丙丁，但丁不能解冻除寒，不能大济。"},
{"dayStem":"庚","monthBranch":"寅","monthName":"正月","useStems":["丙","甲"],"section":"三春庚金","quote":"'''正月庚金'''，木旺之际，有土皆死，不能生金，且金之寒气未除，先用丙暖庚性，又虑土厚埋金，须甲疏洩。丙甲两透，科甲显荣。二者透一，亦有生监。丙藏甲透，异路功名。"},
{"dayStem":"庚","monthBranch":"卯","monthName":"二月","useStems":["丁","甲"],"section":"三春庚金","quote":"'''二月庚金'''，柱中自然有乙，当令之乙，见庚必输情于乙，此金有暗强之势，如秋金一理，故二月庚金，专用丁火，借甲引丁，借庚噼甲。无丁用丙者，富贵多出于勉强。"},
{"dayStem":"庚","monthBranch":"辰","monthName":"三月","useStems":["甲","丁"],"section":"三春庚金","quote":"'''三月庚金'''，戊土司令，无生金之理，有埋金之忧，故先甲后丁，不用庚噼甲。三月之庚，土旺金顽，顽金宜丁，旺土须甲，乏甲不能立业，乏丁焉能成名。二者少一，富贵不真。"},
{"dayStem":"庚","monthBranch":"巳","monthName":"四月","useStems":["壬","戊","丙"],"section":"三夏庚金","quote":"'''四月庚金'''，长生于巳，巳内有戊。丙不镕金，故不畏火炎，丙亦可作用，但先壬水，方得中和，故曰群金生夏，喜用勾陈。次取戊土，丙火佐之。三者皆全，登科及第，即透一二，亦非白丁。"},
{"dayStem":"庚","monthBranch":"午","monthName":"五月","useStems":["壬","癸"],"section":"三夏庚金","quote":"'''五月庚金'''，丁火旺烈，庚金败地，专用壬水，癸又次之。壬透癸藏，支见庚辛，必然科甲，切忌戊己透干制水、则否。戊藏支内，不失儒林。或壬在支，有金生助，又得金神出干，明经之贵。或癸出带辛，异路之荣。"},
{"dayStem":"庚","monthBranch":"未","monthName":"六月","useStems":["丁","甲"],"section":"三夏庚金","quote":"'''六月庚金'''，三伏生寒，顽钝极矣，先用丁火，次取甲木。丁甲两透名显身荣，忌癸伤丁。有甲无丁、庸俗。有丁无甲、生员。丁甲全无，下贱之人。木虽有，丁不透，支又见水，执鞭之士。丁火无伤，贸易之流。"},
{"dayStem":"庚","monthBranch":"申","monthName":"七月","useStems":["丁","甲"],"section":"三秋庚金","quote":"'''七月庚金'''，刚锐极矣。专用丁火煅炼，次取甲木引丁，故曰：秋金锐锐最为奇，壬癸相逢总不宜，如逢木火来成局，试看福寿与天齐。"},
{"dayStem":"庚","monthBranch":"酉","monthName":"八月","useStems":["丁","甲","丙"],"section":"三秋庚金","quote":"'''八月庚金'''，刚锐未退，用丁用甲，丙不可少。若丁甲透，又见一丙，功名显赫，且见羊刃，无刑剋，丙杀藏支，名为羊刃驾杀，主出将入相，直介忠臣。"},
{"dayStem":"庚","monthBranch":"戌","monthName":"九月","useStems":["甲","壬"],"section":"三秋庚金","quote":"'''九月庚金'''，戊土司令，最怕土厚埋金，宜先用甲疏，后用壬洗，则金自出矣。忌见己土浊壬。"},
{"dayStem":"庚","monthBranch":"亥","monthName":"十月","useStems":["丁","丙"],"section":"三冬庚金","quote":"'''十月庚金'''，水冷性寒，非丁莫造，非丙不暖。丁甲两透，支无水局，一榜有之。支藏丙火，桃浪之仙。支见亥子，得己出制，亦有功名。"},
{"dayStem":"庚","monthBranch":"子","monthName":"十一月","useStems":["丁","甲","丙"],"section":"三冬庚金","quote":"'''十一月庚金'''，天气严寒，仍取丁甲，次取丙火照暖。或丁甲两透，丙在支中，必主科甲。即无丙火，亦有衣衿。有丁无甲，亦可富中取贵。有甲无丁，只作常人。或丙透丁藏，异途名望。丁藏有甲，武学可许。"},
{"dayStem":"庚","monthBranch":"丑","monthName":"十二月","useStems":["丙","丁","甲"],"section":"三冬庚金","quote":"'''十二月庚金'''，寒气太重，且多湿泥，愈寒愈冻，先取丙火解冻，次取丁火炼金，甲亦不可少。"},
{"dayStem":"辛","monthBranch":"寅","monthName":"正月","useStems":["己","壬"],"section":"三春辛金","quote":"'''正月辛金'''，阳气舒而寒气未除，不知正月建寅，中有长生之丙，解去寒气，忌甲木司权，辛金失令，取己土为生身之本，欲得辛金发现，全赖壬水之功，己壬两透，支见庚制甲，科甲定然。或己土透干，支中有甲，异路恩荣。或己土不全，号曰君臣失势，富贵难全。或有丙火出干，亦主武学。或见壬、无己庚者，贫贱之徒。"},
{"dayStem":"辛","monthBranch":"卯","monthName":"二月","useStems":["壬","甲"],"section":"三春辛金","quote":"'''二月辛金'''，阳和之际，壬水为尊，见戊己为病。得甲制伏，则辛金不致埋没，壬水不致混浊，合此者必身入玉堂。故二月辛金，有壬甲透者贵显。否则，乡绅。或壬坐亥支，不见土出，可能入芥，家亦小康。得申中之壬者，异途名望。无壬者常人。其生剋之理，与正月辛金皆同。"},
{"dayStem":"辛","monthBranch":"辰","monthName":"三月","useStems":["壬","甲"],"section":"三春辛金","quote":"'''三月辛金'''，戊土司令，辛承正气，母旺子相，先壬后甲。壬甲两透，富贵必然。壬透甲藏，廪贡不失。甲透壬藏，富则可云。壬甲皆无，平常之格。"},
{"dayStem":"辛","monthBranch":"巳","monthName":"四月","useStems":["壬"],"section":"三夏辛金","quote":"'''四月辛金'''，时逢首夏，忌丙火之燥烈，喜壬水之洗淘。支成金局，水透出干，有木制戊，名一清澈底，科甲功名。癸透壬藏，富真贵假。若壬癸皆藏，戊己亦藏，略富。若壬癸俱无，反见火出，必主鳏独。"},
{"dayStem":"辛","monthBranch":"午","monthName":"五月","useStems":["己","壬"],"section":"三夏辛金","quote":"'''五月辛金'''，丁火司权，辛金失令，阴柔之极，不宜煅炼，须己壬兼用，何也？己为泥沙，壬为湖海，己无壬不湿，辛无己不生，故壬己并用。无壬、癸亦可用。但癸力小。或支成火局，即重见癸出亦不济，得壬透破火方可，必主生员。若无壬，癸见戊，虽有午宫己土，燥泥成灰，金必毁镕，反遭埋没，必为僧道。有一二重比肩，不致孤独。"},
{"dayStem":"辛","monthBranch":"未","monthName":"六月","useStems":["壬","庚"],"section":"三夏辛金","quote":"'''六月辛金'''，己土当权，辅助太多，恐掩金光，先用壬水，取庚佐之。壬庚两透，科甲功名，即不出干，藏支得所，亦有荣华。但忌戊出，得甲制之，方吉。甲须隔位，恐贪己合，反掩金光，又塞壬水之流，下贱之格。又忌庚出制甲。或只有未中一己，见了壬水，又为湿泥。不可见甲，甲出，反作平人。总以一壬一己，见庚无甲，方妙﹐与五月用己壬同。"},
{"dayStem":"辛","monthBranch":"申","monthName":"七月","useStems":["壬"],"section":"三秋辛金","quote":"七月辛金，壬不在多，故书云：水浅金多，号曰体全之象，壬水为尊，甲戊酌用可也，癸水不可为用。"},
{"dayStem":"辛","monthBranch":"酉","monthName":"八月","useStems":["壬"],"section":"三秋辛金","quote":"'''八月辛金'''，当权得令，旺之极矣，专用壬水淘洗火，故云：金见水以流通。如见戊己，则生扶太过，故以土为病，见甲制土、方妙。无戊、不宜用甲。"},
{"dayStem":"辛","monthBranch":"戌","monthName":"九月","useStems":["壬","甲"],"section":"三秋辛金","quote":"'''九月辛金'''，戊土司令，母旺子相，须甲疏土，壬洩旺金，先壬后甲。壬甲两透，桃洞之仙。或壬透甲藏，又见戊者，平人。甲透、壬藏，戊在支内，异途之仕。"},
{"dayStem":"辛","monthBranch":"亥","monthName":"十月","useStems":["壬","丙"],"section":"三冬辛金","quote":"'''十月辛金'''，时值小阳，阳气渐升，寒气将降，先用壬水，次取丙火，壬丙两透，金榜题名，何也？盖辛金有壬水丙火，名金白水清，又在亥月故发。丙透壬藏，采芹之造。丙藏壬透，富有千金。壬丙在支，聪明之士。"},
{"dayStem":"辛","monthBranch":"子","monthName":"十一月","useStems":["壬","丙"],"section":"三冬辛金","quote":"'''十一月辛金'''，癸水司令，为寒冬雨露，切忌癸出冻金，而困丙火，壬丙两透，不见戊癸，衣锦腰金。即壬藏丙透，一榜堪图。"},
{"dayStem":"辛","monthBranch":"丑","monthName":"十二月","useStems":["丙","壬"],"section":"三冬辛金","quote":"'''十二月辛金'''，寒冻之极，先丙后壬，无丙不能解冻，无壬不能洗淘。丙壬两透，金马玉堂之客。壬丙俱藏，游庠食饩之人。有丙无壬富真贵假。有壬乏丙，贱而且贫。或丙多、无壬、有癸，市中贸易之流。"},
{"dayStem":"壬","monthBranch":"寅","monthName":"正月","useStems":["庚"],"section":"三春壬水","quote":"'''正月壬水'''，汪洋之象，能并百川之流，然水性柔弱，宜用庚金之源，庶不致汪洋无度。有庚丙戊三者齐透，科甲功名。或庚戊藏支，丙坐寅支者，亦有恩诰，即一庚透，贡监有之。"},
{"dayStem":"壬","monthBranch":"卯","monthName":"二月","useStems":["戊","辛","庚"],"section":"三春壬水","quote":"'''二月壬水'''，寒气初除，有并流之象，不用丙暖，专取戊土辛金。二月壬水，先戊后辛，庚金次之。"},
{"dayStem":"壬","monthBranch":"辰","monthName":"三月","useStems":["甲","庚"],"section":"三春壬水","quote":"'''三月壬水'''，戊土司权，恐有推山填海之患，先用甲疏季土，次取庚金。甲庚俱透，科甲定然。甲透庚藏，修齐品格。甲藏有根，可云俊秀。有癸滋甲，必主干城。独甲藏支，必富。独庚在柱，常人。无甲、刚暴之徒。乏庚、愚顽之辈。"},
{"dayStem":"壬","monthBranch":"巳","monthName":"四月","useStems":["壬","辛","庚"],"section":"三夏壬水","quote":"'''四月壬水'''，丙火司权，水弱极矣，专取壬水比肩为助，次取辛金发源，且暗合丙火，庚金为佐。壬辛两透，金榜有名，或癸辛两出，加以甲透，亦主异路之荣。无甲者、富贵门下之客。"},
{"dayStem":"壬","monthBranch":"午","monthName":"五月","useStems":["癸","庚","辛"],"section":"三夏壬水","quote":"'''五月壬水'''，丁旺壬弱，取癸为用，取庚为佐。无庚不能发水，无癸不能伤丁。五月壬水，辛癸亦可参用，其理与四月皆同。"},
{"dayStem":"壬","monthBranch":"未","monthName":"六月","useStems":["辛","甲","癸"],"section":"三夏壬水","quote":"'''六月壬水'''，己土当权，丁火退气，先用辛金癸水，次用甲木噼土。六月壬水，先辛后甲，次取癸水。辛甲两透，富贵清高。甲藏辛透，贡监生员。辛藏甲透，异途武职。甲壬两透，无伤，有治国之贵。即甲藏壬出无破，是拾芥之才。或支多土火，又只清贫。"},
{"dayStem":"壬","monthBranch":"申","monthName":"七月","useStems":["戊","丁"],"section":"三秋壬水","quote":"'''七月壬水'''，庚金司令，壬得申之长生，源流自远，转弱为强，专用戊土，次取丁火佐戊制庚。但用辰戌之戊，不用申中受病之戊。戊丁俱透，科甲生员。戊透天干，丁藏午戌，恩封可待，特忌戊癸化合。即支见寅戌，年出丁火，可许衣衿。或丁戊两藏，富中取贵。"},
{"dayStem":"壬","monthBranch":"酉","monthName":"八月","useStems":["甲","庚"],"section":"三秋壬水","quote":"八月壬水，专用甲木，庚金次之。用甲者，水妻、木子。"},
{"dayStem":"壬","monthBranch":"戌","monthName":"九月","useStems":["甲","丙"],"section":"三秋壬水","quote":"九月壬水，专用甲木，次用丙火。用土者，火妻土子。"},
{"dayStem":"壬","monthBranch":"亥","monthName":"十月","useStems":["戊","庚"],"section":"三冬壬水","quote":"'''十月壬水'''司权，至旺之极，取戊为用，若生辰日干，又见辰时，必须戊透，又须庚制甲，不伤戊土，戊庚两全，定主豋科乃第，位显权高。或甲出制戊，不见庚救者，断之贫穷。戊藏无制，可许生员。或戊庚两透无甲者，亦主荣显。"},
{"dayStem":"壬","monthBranch":"子","monthName":"十一月","useStems":["戊","丙"],"section":"三冬壬水","quote":"'''十一月壬水'''，阳刃帮身，较前更旺，先取戊土，次用丙火，丙戊两透，富贵荣华。有戊无丙，略可言富。有丙无戊，好谋无成。"},
{"dayStem":"壬","monthBranch":"丑","monthName":"十二月","useStems":["丙","甲"],"section":"三冬壬水","quote":"'''十二月壬水'''，旺极复衰，何也？上半月癸辛主事，故旺，专用丙火。下半月己土主事，故衰。亦用丙火，甲木佐之。"},
{"dayStem":"癸","monthBranch":"寅","monthName":"正月","useStems":["辛","丙"],"section":"三春癸水","quote":"'''正月癸水'''，值三阳之候，雨露之精，其性至柔，先用辛金，生癸水之源，次用丙火照暖，名阴阳和合，万物发生。辛丙两透，金榜有名。"},
{"dayStem":"癸","monthBranch":"卯","monthName":"二月","useStems":["庚","辛"],"section":"三春癸水","quote":"'''二月癸水'''，不刚不柔，乙木司令，洩弱元神，专以庚金为用，辛金次之。庚辛俱透，无丁出干者，贵由科甲。无庚辛者常人。或庚透辛藏，荣封有准。庚藏辛透，亦有衣衿。庚辛两藏，富中取贵，或刀笔扬名。或庚辛重见，有己丁出干者亦贵。"},
{"dayStem":"癸","monthBranch":"辰","monthName":"三月","useStems":["丙","辛","甲"],"section":"三春癸水","quote":"'''三月癸水'''，要分清明谷雨。清明后、火气未炽，专用丙火，为阴阳合谐。谷雨后，虽用丙火，尚宜辛甲佐之。如辛卯、壬辰、癸未、丙辰，生上半月，用丙火、显达。生下半月，必无伤辛金癸水、方妙。然丙亦不可少。用丙、木妻、火子。"},
{"dayStem":"癸","monthBranch":"巳","monthName":"四月","useStems":["辛","庚"],"section":"三夏癸水","quote":"'''四月癸水'''，喜辛金为用，无辛用庚。若辛高透，不见丁火，加以壬透，主科名荣贵，声播四夷。若有丁破格，贫无立锥，有壬可免。辛藏无丁，贡监衣衿。"},
{"dayStem":"癸","monthBranch":"午","monthName":"五月","useStems":["庚","辛","壬"],"section":"三夏癸水","quote":"'''五月癸水'''，至弱无根，必须庚辛为生身之本，但丁火司权，金难敌火，安能滋养癸水，宜见比劫，方得辛金之用。五月癸水，庚辛壬参酌并用可也。"},
{"dayStem":"癸","monthBranch":"未","monthName":"六月","useStems":["庚","辛"],"section":"三夏癸水","quote":"'''六月癸水'''，有上下月之分。下半月庚辛有气，上半月庚辛休囚。凡六癸日、多不验者，何也？俗士不知此理。因未中有乙己同宫，破而不破，故癸水不能从杀，所以专用庚辛。如上半月金神衰弱，火气炎烈，宜比劫助身，可云富贵。与五月一理。下半月庚辛有气，即无比劫亦可，又忌丁透，即丁在支亦不吉。其生剋制化，与五月略同。"},
{"dayStem":"癸","monthBranch":"申","monthName":"七月","useStems":["丁"],"section":"三秋癸水","quote":"'''七月癸水'''，正母旺子相之时，癸虽死申，殊不知申中有庚生之，名死处逢生，弱中复强，即运行西北，亦不死也。但庚司令刚锐极矣，必取丁火为用。或丁透有甲，名有燄之火，必主科甲。或丁透无甲，又无壬癸，即有一二庚金，亦有生监。有二丁更妙。或金多乏丁制者，贫困之人。"},
{"dayStem":"癸","monthBranch":"酉","monthName":"八月","useStems":["辛","丙"],"section":"三秋癸水","quote":"'''八月癸水'''，辛金虚灵，非顽金可比，正金白水清，故取辛金为用，丙火佐之。名水暖金温。如丙与辛隔位同透，主科甲功名。或丙透辛藏，一榜之士。或土多{{PUA|}}水，生意中人。"},
{"dayStem":"癸","monthBranch":"戌","monthName":"九月","useStems":["辛","甲"],"section":"三秋癸水","quote":"'''九月癸水'''，失令无根，戊土司权，剋制太过，专用辛金发水之源，要比肩滋甲制戊方妙。或辛甲两透，支见子癸，定主平步青云，或癸甲两透，富贵成名。或有甲辛无癸者，亦有恩封。或有甲癸无辛者，富大贵小。有甲无癸辛者，常人。二者俱无，贫贱之格。或有甲见壬者，颇许衣衿。"},
{"dayStem":"癸","monthBranch":"亥","monthName":"十月","useStems":["庚","辛"],"section":"三冬癸水","quote":"'''十月癸水'''，旺中有弱，何也？因亥摇木，洩散元神，宜用庚辛为妙。得庚辛两透，不见丁伤者，功名有准。"},
{"dayStem":"癸","monthBranch":"子","monthName":"十一月","useStems":["丙","辛"],"section":"三冬癸水","quote":"'''十一月癸水'''，值冰冻之时，金水无交欢之象，专用丙火解冻，庶不致成冰，又要辛金滋扶，无丙有辛，不妙。凡冬季癸水，有丙透解冻，则金温水暖，两两相生，要不见壬癸，自然豋科及第，紫诰金章。"},
{"dayStem":"癸","monthBranch":"丑","monthName":"十二月","useStems":["丙"],"section":"三冬癸水","quote":"'''十二月癸水'''，寒极成冰，万物不能舒泰，宜丙火解冻。或丙透年时，加以壬透，支中多戊，名水辅阳光，主显达名臣，无戊者，异途之职。若有丙无壬，黉门之客。有壬无丙，戊又出干者，皂隶之流。"}
]
```

- [ ] **Step 3：实现运行时形状、覆盖与查表校验；底本位置核验留在测试，生产请求不读取底本。**

```ts
// src/calendar/qiongtong.ts
import { readFileSync } from "node:fs";
export interface QiongtongEntry {
  dayStem: string;
  monthBranch: string;
  monthName: string;
  useStems: string[];
  section: string;
  quote: string;
}
export function validateQiongtong(value: unknown): QiongtongEntry[] {
  if (!Array.isArray(value) || value.length !== 120) {
    throw new Error("调候表必须有 120 条");
  }
  const seen = new Set<string>();
  const stems = "甲乙丙丁戊己庚辛壬癸";
  const branches = "寅卯辰巳午未申酉戌亥子丑";
  const names = ["正月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月"];
  for (const row of value) {
    if (!row || typeof row !== "object") {
      throw new Error("调候条目不合法");
    }
    const { dayStem, monthBranch, monthName, useStems, section, quote } = row;
    const index = typeof monthBranch === "string" ? branches.indexOf(monthBranch) : -1;
    if (typeof dayStem !== "string" || dayStem.length !== 1 || !stems.includes(dayStem)
      || typeof monthBranch !== "string" || monthBranch.length !== 1 || index < 0
      || monthName !== names[index] || typeof section !== "string" || typeof quote !== "string"
      || !quote || !Array.isArray(useStems) || !useStems.length
      || new Set(useStems).size !== useStems.length
      || !useStems.every((s: unknown) => typeof s === "string" && s.length === 1
        && stems.includes(s) && quote.includes(s))) {
      throw new Error("调候字段或用干不合法");
    }
    const season = "春夏秋冬".charAt(Math.floor(index / 3));
    const element = "木木火火土土金金水水".charAt(stems.indexOf(dayStem));
    if (section !== `三${season}${dayStem}${element}`) {
      throw new Error("调候章节不合法");
    }
    const key = dayStem + monthBranch;
    if (seen.has(key)) {
      throw new Error("调候条目重复");
    }
    seen.add(key);
  }
  return value as QiongtongEntry[];
}
export function readQiongtong(): QiongtongEntry[] {
  const text = readFileSync(new URL("./data/qiongtong.json", import.meta.url), "utf8");
  return validateQiongtong(JSON.parse(text));
}
export function lookupQiongtong(dayStem: string, monthBranch: string): QiongtongEntry {
  const row = readQiongtong().find((r) => r.dayStem === dayStem && r.monthBranch === monthBranch);
  if (!row) {
    throw new Error("调候日干或月令不合法");
  }
  return row;
}
```

- [ ] **Step 4：运行 `node --import tsx --test tests/qiongtong.test.ts`，预期 3 项通过。** 120 条完全覆盖，无重复；quote 位于对应三级标题区间，章节的日干、季节一致；每个用干在原文中，抽样庚巳和甲寅符合已核验事实。
- [ ] **Step 5：保留主管抽查记录，修改条目后重跑全部 120 条检查。** 主管第 2 轮抽查的 20 条均与底本相符；本轮语义裁定已同步，自动原文定位仍不能代替语义审查。

### Task B3.5：交付核对与字段契约

- [ ] **Step 1：按 B2.3 契约表核对样稿的关系图与文字、四柱神煞行、五行分布、余春台用神对照、十年面板逐年关系。** B3 分析与 B2 窗口以 year 关联，B4 事实编号同时覆盖原局与该年的流年/运节点；不得引用其它年份关系。
- [ ] **Step 2：运行六个新增测试文件、项目类型检查与全量回归。** 同 B2.3 验证命令，再追加 `tests/bazi-relations.test.ts tests/qiongtong.test.ts`；严格验证需覆盖新声明、B1–B3 及全部新增测试。
- [ ] **Step 3：逐条核对 bazi-chart spec 与 tasks。** 本块只提供基础事实；逐年断语 Schema、短评词核对归 B4，逐年合议归 B4/B5；B6 只消费。基础排盘与前端展示共用的 2.3 未整体完成，不能提前勾选。

## Chunk B4a：命理与运势的 Schema、事实表与核对

本块给出 B4.1–B4.3 的完整文件；代码只在隔离目录验证，工作区未实施、不勾选任务。B4b 接着提供这些测试引用的 mock 与三家；执行者先落测试确认 RED，再按任务顺序落实现。Ajv 复用 `validateStructuredOutput`，自洽复用 `checkVerdictConsistency`，分词复用 `tokenizeClaim`，不改变 1A 问事默认行为。

### B4 事实编号契约

`FactTable` 保持 Map 契约。关系和神煞按稳定键排序后从 1 编号，同一派生命盘重复构建编号不变；不同锚年不可沿用旧编号。label 的范围前缀供输入筛选与逐年隔离，tokens 是核对依据，不把 label 或 quote 任意分词扩充为“事实”。

| 编号 | label 与 tokens 契约 | 可用范围 |
|---|---|---|
| `pillar:year/month/day/time` | 柱名、干支、天干十神；tokens 为干支、干、支、十神 | 原局；缺时柱无 time |
| `hidden:<柱>` | 按本中余气次序列干及十神；tokens 为藏干、十神 | 原局；缺时柱无 time |
| `relation:<n>` | label 为 `natal/luck/year 节点列表 通行关系词`，tokens 为完整关系词 | 原局、当前运、锚年；逐年只允许 natal 前缀 |
| `shensha:<n>` | 神煞名、节点、基准；tokens 为神煞名 | 锚年总事实，三家按路径不额外输入神煞 |
| `luck:<index>`、`luck:current` | 大运干支、期间；tokens 为干支、干、支、十神 | 八步与当前大运；当前无运不造 current |
| `year:anchor` | 锚年流年、藏干、所在运、当年关系及神煞 | 运势正文；不会借其它年关系过关 |
| `year:<YYYY>` | tokens 含该年干支、干、支、十神、藏干与十神、所在运和十神、该年完整关系及神煞词 | 逐年只用该项加原局事实；不可借 luck:current 或其它年 |
| `tiaohou` | 用干与章节；tokens 严格只有按顺序用干及章节 | 余春台；quote 只放请求输入，不当盘面词放行 |
| `elements` | 分层五行个数；tokens 为木火土金水 | 余、任两家 |
| `structure:month`、`structure:roots` | 月令本气十神与透干、藏干透出、日主同五行通根；tokens 为实际干及十神 | 沈、任按路径选用；只陈述位置，不判强弱成败 |
| `chart:limit` | 缺时柱限制提示，tokens 为空 | 缺时柱三家均收，用于核对限制说明 |
| `period:<名称>` | B5 根据注入时钟提供所问节气月或流日，沿用 FactTable | 只给运势；禁止系统时钟猜盘或从问题自行造事实 |

本块不输出命宫、身宫事实；缺时柱不会生成时柱、时藏干或含时柱节点的关系。已知时柱时，命宫身宫仍属 B2 客观展示，设计第 11 节未要求将其输入三家。

### Task B4.1：输出 Schema 与业务一致性

**文件：** 新建 `tests/helpers/sample-bazi.ts`、`tests/sanyi-bazi-schema.test.ts`、`src/sanyi/bazi-schema.ts`。

- [ ] **Step 1：写下列共用输入与 Schema 测试，运行 `node --import tsx --test tests/sanyi-bazi-schema.test.ts`，确认新模块缺失 RED。**

```ts
// tests/helpers/sample-bazi.ts
import { buildBaziChart } from "../../src/calendar/bazi.js";
import { analyzeBazi } from "../../src/calendar/bazi-relations.js";
import { lookupQiongtong } from "../../src/calendar/qiongtong.js";
import { buildBaziFacts } from "../../src/sanyi/bazi-facts.js";
import type { BaziSchoolInput } from "../../src/sanyi/schools/bazi-shared.js";
import type { FortuneHorizon } from "../../src/sanyi/classify.js";
export function sampleBazi(kind: "destiny" | "fortune" = "fortune", timeKnown = true,
  horizon: FortuneHorizon = "year"): BaziSchoolInput {
  const chart = buildBaziChart({
    corrected: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0 },
    gender: "male", sect: 1, timeKnown, targetYear: 2026,
  });
  const analysis = analyzeBazi(chart);
  const tiaohou = lookupQiongtong(chart.dayMaster, chart.pillars.month.branch);
  return {
    kind, horizon, chart, tiaohou,
    question: kind === "fortune" ? "今年运势如何" : "我适合做什么",
    facts: buildBaziFacts(chart, analysis, tiaohou),
    period: { label: "2026 年", facts: new Map() },
  };
}
```

```ts
// tests/sanyi-bazi-schema.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { validateStructuredOutput } from "../src/agent/provider.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA, checkBaziConsistency,
  type DestinySchoolOutput, type FortuneSchoolOutput, } from "../src/sanyi/bazi-schema.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
function fortune(): FortuneSchoolOutput {
  return mockBaziSchoolOutput("shenxiaozhan", sampleBazi().facts, "fortune");
}
test("命理拒绝吉凶、把握、逐年字段，五分项标题顺序固定", () => {
  const output = mockBaziSchoolOutput("shenxiaozhan", sampleBazi("destiny").facts, "destiny");
  assert.doesNotThrow(() => validateStructuredOutput<DestinySchoolOutput>(DESTINY_SCHOOL_SCHEMA, output));
  for (const patch of [{ verdict: "吉" }, { confidenceTenths: 6 }, { years: [] }]) {
    assert.throws(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, { ...output, ...patch }));
  }
  const sections = [...output.sections].reverse();
  assert.throws(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, { ...output, sections }));
});
test("运势必填逐年列表，短评不得超过十六字", () => {
  const output = fortune();
  assert.doesNotThrow(() => validateStructuredOutput(FORTUNE_SCHOOL_SCHEMA, output));
  const { years, ...missing } = output;
  assert.throws(() => validateStructuredOutput(FORTUNE_SCHOOL_SCHEMA, missing));
  assert.throws(() => validateStructuredOutput(FORTUNE_SCHOOL_SCHEMA, {
    ...output, years: years.map((item) => ({ ...item, note: "甲".repeat(17) })),
  }));
});
test("年份缺漏、多出、乱序都失败", () => {
  const input = sampleBazi();
  const output = fortune();
  const variants = [
    output.years.filter((item) => item.year !== 2029),
    [...output.years, { ...output.years[0]!, year: 2033 }],
    [...output.years].reverse(),
  ];
  for (const years of variants) {
    assert.match(checkBaziConsistency({ ...output, years }, input.chart, "year").join("；"), /年份序列/);
  }
});
test("整年锚项与总断一致，今天本月不要求一致", () => {
  const input = sampleBazi();
  const output = { ...fortune(), verdict: "凶" as const, confidenceTenths: 4 };
  output.years = output.years.map((item) => ({ ...item, verdict: "平", confidenceTenths: 5 }));
  for (const horizon of ["year", "next-year", "year:2026"] as const) {
    assert.match(checkBaziConsistency(output, input.chart, horizon).join("；"), /锚年/);
  }
  for (const horizon of ["today", "month"] as const) {
    assert.deepEqual(checkBaziConsistency(output, input.chart, horizon), []);
  }
});
test("总断和每一项复用问事自洽规则，裁剪窗口仍精确覆盖", () => {
  const input = sampleBazi();
  const output = fortune();
  assert.match(checkBaziConsistency({ ...output, verdict: "吉", confidenceTenths: 4 }, input.chart,
    "month").join("；"), /六成/);
  const years = output.years.map((item) => ({ ...item, verdict: "凶" as const, confidenceTenths: 7 }));
  assert.match(checkBaziConsistency({ ...output, years }, input.chart, "month").join("；"), /2029.*四成/);
  const chart = { ...input.chart, liunian: { ...input.chart.liunian,
    years: input.chart.liunian.years.slice(3) } };
  assert.deepEqual(checkBaziConsistency({ ...output, years: output.years.slice(3) }, chart, "year"), []);
});
```

- [ ] **Step 2：实现两套 Schema 与一致性函数。** 命理用 draft-07 元组限定五标题，拒绝多余字段；运势按实际窗口允许 1–10 项，完整覆盖由业务函数检查。出生年与 2099 上限裁剪后不强造十项。

```ts
// src/sanyi/bazi-schema.ts
import type { JsonSchema } from "../agent/schemas.js";
import type { BaziChart } from "../calendar/bazi.js";
import type { FortuneHorizon } from "./classify.js";
import { QUESTION_SCHOOL_SCHEMA, checkVerdictConsistency, type QuestionSchoolOutput,
  type Verdict } from "./schema.js";
export interface DestinySchoolOutput {
  useGod: string;
  headline: string;
  reason: string;
  sections: QuestionSchoolOutput["sections"];
  advice: readonly string[];
  evidence: QuestionSchoolOutput["evidence"];
}
export interface FortuneYearOutput {
  year: number;
  verdict: Verdict;
  confidenceTenths: number;
  note: string;
}
export interface FortuneSchoolOutput extends QuestionSchoolOutput {
  useGod: string;
  years: FortuneYearOutput[];
}
export type BaziSchoolOutput = DestinySchoolOutput | FortuneSchoolOutput;
export const DESTINY_TITLES = ["性格", "事业", "财运", "感情", "健康"] as const;
const properties = QUESTION_SCHOOL_SCHEMA.properties;
const useGod = { type: "string", minLength: 1 } as const;
const section = properties.sections.items;
// Ajv 默认使用 draft-07：元组 items 按位置限定五个标题，避免仅凭数量通过。
export const DESTINY_SCHOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["useGod", "headline", "reason", "sections", "advice", "evidence"],
  properties: {
    useGod, headline: properties.headline, reason: properties.reason,
    advice: properties.advice, evidence: properties.evidence,
    sections: {
      type: "array", minItems: 5, maxItems: 5, additionalItems: false,
      items: DESTINY_TITLES.map((title) => ({
        ...section, properties: { ...section.properties, title: { type: "string", const: title } },
      })),
    },
  },
} as const satisfies JsonSchema;
export const FORTUNE_SCHOOL_SCHEMA = {
  ...QUESTION_SCHOOL_SCHEMA,
  required: [...QUESTION_SCHOOL_SCHEMA.required, "useGod", "years"],
  properties: {
    ...properties, useGod,
    years: {
      type: "array", minItems: 1, maxItems: 10,
      items: {
        type: "object", additionalProperties: false,
        required: ["year", "verdict", "confidenceTenths", "note"],
        properties: {
          year: { type: "integer", minimum: 1900, maximum: 2099 },
          verdict: properties.verdict, confidenceTenths: properties.confidenceTenths,
          note: { type: "string", minLength: 1, maxLength: 16 },
        },
      },
    },
  },
} as const satisfies JsonSchema;
export function checkBaziConsistency(output: BaziSchoolOutput, chart: BaziChart,
  horizon: FortuneHorizon): string[] {
  if (!("years" in output)) {
    return [];
  }
  const errors = checkVerdictConsistency(output);
  for (const item of output.years) {
    errors.push(...checkVerdictConsistency(item).map((error) => `${item.year} 年：${error}`));
  }
  const expected = chart.liunian.years.map((item) => item.year);
  const actual = output.years.map((item) => item.year);
  if (expected.length !== actual.length || expected.some((year, index) => actual[index] !== year)
    || actual.some((year, index) => index > 0 && year <= actual[index - 1]!)) {
    errors.push("逐年年份序列必须与命盘窗口完全一致，升序且不多不少");
  }
  // 锚年已由 B5 按立春年和 horizon 解析；本月、今天的总断可与全年不同。
  if (horizon === "year" || horizon === "next-year" || horizon.startsWith("year:")) {
    const anchor = output.years.find((item) => item.year === chart.liunian.anchorYear);
    if (!anchor || anchor.verdict !== output.verdict || anchor.confidenceTenths !== output.confidenceTenths) {
      errors.push("锚年逐年断语的吉凶与把握必须和整年总断相同");
    }
  }
  return errors;
}
```

- [ ] **Step 3：B4b mock 落入后重跑测试，预期 5 项通过；strict 类型检查不得报错。** 总断、每年自洽及整年锚项分开核验。

### Task B4.2：事实表与缺时柱隔离

**文件：** 新建 `tests/sanyi-bazi-facts.test.ts`、`src/sanyi/bazi-facts.ts`。

- [ ] **Step 1：写测试，运行 `node --import tsx --test tests/sanyi-bazi-facts.test.ts`，确认模块缺失 RED。**

```ts
// tests/sanyi-bazi-facts.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { analyzeBazi } from "../src/calendar/bazi-relations.js";
test("四柱、藏干、神煞、大运、锚年、调候与五行编号完整", () => {
  const input = sampleBazi();
  for (const id of ["pillar:year", "pillar:month", "pillar:day", "pillar:time",
    "hidden:year", "hidden:month", "hidden:day", "hidden:time", "luck:current",
    "luck:3", "year:anchor", "tiaohou", "elements"]) {
    assert.ok(input.facts.has(id), id);
  }
  assert.ok([...input.facts.keys()].some((id) => id.startsWith("relation:")));
  assert.ok([...input.facts.keys()].some((id) => id.startsWith("shensha:")));
  assert.deepEqual([...input.facts.get("tiaohou")!.tokens], ["壬", "戊", "丙", "三夏庚金"]);
  assert.ok(!input.facts.get("tiaohou")!.label.includes(input.tiaohou.quote));
});
test("2023 至 2032 每年事实含该年干支、十神、藏干、大运及已核验关系", () => {
  const input = sampleBazi();
  const expected = ["午卯破", "甲庚冲", "乙庚合", "丙辛合", "丁癸冲",
    "申辰拱水", "巳酉半合金", "辰戌冲", "巳亥冲", "子午冲"];
  const analysis = analyzeBazi(input.chart);
  for (const [index, year] of input.chart.liunian.years.entries()) {
    const fact = input.facts.get(`year:${year.year}`);
    assert.ok(fact);
    for (const token of [year.ganZhi, year.stemGod, year.luck!.ganZhi, expected[index]!]) {
      assert.ok(fact.tokens.has(token), `${fact.id}：${token}`);
    }
    for (const hidden of year.hidden) {
      assert.ok(fact.tokens.has(hidden.stem) && fact.tokens.has(hidden.god));
    }
    for (const shensha of analysis.years[index]!.shensha) {
      assert.ok(fact.tokens.has(shensha.name));
    }
  }
});
test("缺时柱无时柱、时藏干、命宫身宫事实及含时柱节点的关系", () => {
  const input = sampleBazi("fortune", false);
  for (const id of ["pillar:time", "hidden:time", "palace:ming", "palace:shen"]) {
    assert.ok(!input.facts.has(id));
  }
  assert.ok([...input.facts.values()].every((fact) => !fact.label.includes("natal.time")));
  assert.ok([...input.facts.values()].filter((fact) => fact.id.startsWith("pillar:")
    || fact.id.startsWith("hidden:")).every((fact) => !fact.tokens.has("癸未")));
  assert.ok(input.facts.get("luck:2")?.tokens.has("癸未"));
});
```

- [ ] **Step 2：实现确定性事实表。** 窗口各年使用 B3 各自重新分析的关系和神煞，禁止重用锚年列表。

```ts
// src/sanyi/bazi-facts.ts
import lunarPkg from "lunar-javascript";
import type { BaziChart, BaziPillar, LiuNianEntry, LuckCycle } from "../calendar/bazi.js";
import type { BaziAnalysis } from "../calendar/bazi-relations.js";
import type { QiongtongEntry } from "../calendar/qiongtong.js";
import type { FactTable } from "./facts.js";
function hiddenTokens(hidden: BaziPillar["hidden"]): string[] {
  return hidden.flatMap((item) => [item.stem, item.god]);
}
function luckTokens(luck: LuckCycle): string[] {
  return [luck.ganZhi, luck.ganZhi.charAt(0), luck.ganZhi.charAt(1), luck.stemGod];
}
function yearTokens(year: LiuNianEntry): string[] {
  const tokens = [year.ganZhi, year.stem, year.branch, year.stemGod, ...hiddenTokens(year.hidden)];
  if (year.luck) {
    tokens.push(...luckTokens(year.luck));
  }
  return tokens;
}
function scopedTokens(analysis: Pick<BaziAnalysis, "relations" | "shensha" | "nodes">): string[] {
  return [...analysis.relations.map((relation) => relation.label),
    ...analysis.shensha.map((item) => item.name)];
}
export function buildBaziFacts(chart: BaziChart, analysis: BaziAnalysis, tiaohou: QiongtongEntry): FactTable {
  const facts: FactTable = new Map();
  function add(id: string, label: string, tokens: readonly string[]): void {
    facts.set(id, { id, label, tokens: new Set(tokens) });
  }
  const pillars = Object.values(chart.pillars).filter((pillar) => pillar !== null);
  for (const pillar of pillars) {
    add(`pillar:${pillar.key}`, `${pillar.label} ${pillar.ganZhi} ${pillar.stemGod}`, [
      pillar.ganZhi, pillar.stem, pillar.branch, pillar.stemGod,
    ]);
    const tokens = hiddenTokens(pillar.hidden);
    add(`hidden:${pillar.key}`, `${pillar.label}藏干 ${tokens.join(" ")}`, tokens);
  }
  // 固定排序编号，保证同一派生命盘多次构建时 ref 可复算；label 保留范围和节点供隔离审查。
  const relations = [...analysis.relations].sort((left, right) => left.id.localeCompare(right.id, "en"));
  for (const [index, relation] of relations.entries()) {
    add(`relation:${index + 1}`,
      `${relation.scope} ${relation.nodeIds.join(",")} ${relation.label}`, [relation.label]);
  }
  const shensha = [...analysis.shensha].sort((left, right) => {
    const leftKey = `${left.nodeId}:${left.name}:${left.basis}`;
    const rightKey = `${right.nodeId}:${right.name}:${right.basis}`;
    return leftKey.localeCompare(rightKey, "en");
  });
  for (const [index, item] of shensha.entries()) {
    add(`shensha:${index + 1}`, `${item.nodeId} ${item.name} 依据${item.basis}`, [item.name]);
  }
  for (const luck of chart.luck?.cycles ?? []) {
    add(`luck:${luck.index}`, `大运 ${luck.ganZhi} ${luck.startYear}–${luck.endYear}`, luckTokens(luck));
  }
  const current = chart.annual?.currentLuck;
  if (current) {
    add("luck:current", `当前大运 ${current.ganZhi}`, luckTokens(current));
  }
  for (const year of chart.liunian.years) {
    const detail = analysis.years.find((item) => item.year === year.year);
    if (!detail) {
      throw new Error(`缺少 ${year.year} 年的关系分析`);
    }
    const tokens = [...yearTokens(year), ...scopedTokens(detail)];
    const label = `${year.year} 年 ${tokens.join(" ")}`;
    add(`year:${year.year}`, label, tokens);
    if (year.year === chart.liunian.anchorYear) {
      add("year:anchor", label, tokens);
    }
  }
  const year = chart.liunian.anchorYear;
  const terms = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露",
    "寒露", "立冬", "大雪", "小寒", "立春"];
  const dates = new Map<string, string>();
  for (const civilYear of [year, year + 1]) {
    const table = lunarPkg.Solar.fromYmd(civilYear, 7, 1).getLunar().getJieQiTable();
    for (const [name, solar] of Object.entries(table)) {
      dates.set(`${solar.getYear()}:${name}`, solar.toYmdHms());
    }
  }
  const names = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月",
    "九月", "十月", "冬月", "腊月"];
  for (const month of chart.annual?.months ?? []) {
    const index = month.index - 1;
    const startYear = index === 11 ? year + 1 : year;
    const endYear = index >= 10 ? year + 1 : year;
    const start = dates.get(`${startYear}:${terms[index]}`);
    const end = dates.get(`${endYear}:${terms[index + 1]}`);
    let range = "";
    if (start && end) {
      range = ` 节气月[${start}, ${end}) 北京时间`;
    }
    add(`liuyue:${month.index}`, `${names[index]} ${month.ganZhi} ${month.stemGod}${range}`,
      [month.ganZhi, month.ganZhi.charAt(0), month.ganZhi.charAt(1), month.stemGod]);
  }
  add("tiaohou", `${tiaohou.section} 用干${tiaohou.useStems.join("、")}`, [...tiaohou.useStems,
    tiaohou.section]);
  add("elements", analysis.elements.map((item) => {
    return `${item.element} 天干${item.stem} 本气${item.main} 中气${item.middle} 余气${item.residual}`;
  }).join("；"), analysis.elements.map((item) => item.element));
  const stems = pillars.map((pillar) => pillar.stem);
  const monthMain = chart.pillars.month.hidden[0];
  if (monthMain) {
    const exposed = stems.includes(monthMain.stem) ? "已透干" : "未透干";
    add("structure:month", `月令本气 ${monthMain.stem} ${monthMain.god} ${exposed}`, [monthMain.stem,
      monthMain.god]);
  }
  const roots = pillars.map((pillar) => {
    const exposed = pillar.hidden.filter((item) => stems.includes(item.stem)).map((item) => item.stem);
    return `${pillar.label}藏干透出 ${exposed.join("、") || "无"}`;
  });
  const sameElement = "甲乙 丙丁 戊己 庚辛 壬癸".split(" ").find((pair) => pair.includes(chart.dayMaster));
  const rootPillars = pillars.filter((pillar) => {
    return pillar.hidden.some((item) => sameElement?.includes(item.stem));
  });
  add("structure:roots", [...roots, `日主同五行通根 ${rootPillars.map((pillar) => pillar.label).join("、") || "无"}`]
    .join("；"), [...stems, ...pillars.flatMap((pillar) => hiddenTokens(pillar.hidden))]);
  // 限制也使用事实编号，方便请求级 mock 和核对器共同识别缺时柱。
  if (!chart.pillars.time) {
    add("chart:limit", "时辰未知，缺时柱，判断存在限制", []);
  }
  return facts;
}
export function isNatalFact(id: string, label: string): boolean {
  return id.startsWith("pillar:") || id.startsWith("hidden:") || id === "tiaohou"
    || (id.startsWith("relation:") && label.startsWith("natal "));
}
```

- [ ] **Step 3：运行同命令，预期 3 项通过。** 缺时柱不能删掉恰好同干支的合法大运，如命例第二步癸未；事实按角色隔离。

### Task B4.3：复用最长匹配的八字核对器

**文件：** 修改 `src/sanyi/audit.ts`；新建 `tests/sanyi-bazi-audit.test.ts`、`src/sanyi/bazi-audit.ts`；关系词表使用 B3 的 `baziRelationWords`。

- [ ] **Step 1：写核对测试，运行 `node --import tsx --test tests/sanyi-bazi-audit.test.ts`，确认新模块缺失 RED。**

```ts
// tests/sanyi-bazi-audit.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
test("2031 子午冲失败，2032 同词通过，包括倒序", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  for (const note of ["子午冲", "午子冲"]) {
    const wrong = { ...output, years: output.years.map((item) => {
        return item.year === 2031 ? { ...item, note } : item;
      }) };
    assert.match(auditBaziOutput(wrong, input.facts).errors.join("；"), /2031.*子午冲/);
    const right = { ...output, years: output.years.map((item) => {
        return item.year === 2032 ? { ...item, note } : item;
      }) };
    assert.equal(auditBaziOutput(right, input.facts).ok, true);
  }
});
test("庚甲冲在锚年正文通过，2031 短评失败", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.equal(auditBaziOutput({ ...output, reason: "庚甲冲宜审慎" }, input.facts).ok, true);
  const years = output.years.map((item) => {
    return item.year === 2031 ? { ...item, note: "庚甲冲" } : item;
  });
  assert.match(auditBaziOutput({ ...output, years }, input.facts).errors.join("；"), /2031.*甲庚冲/);
});
test("未知引用、所引事实不含的词、虚构关系都失败", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "missing", claim: "庚午" }] },
    input.facts).ok, false);
  assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "pillar:day", claim: "甲申" }] },
    input.facts).ok, false);
  // 两个字各自存在不代表该关系存在；必须整体匹配关系词。
  assert.equal(auditBaziOutput({ ...output, advice: ["子午冲"] }, input.facts).ok, false);
  assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "year:anchor", claim: "庚甲冲" }] },
    input.facts).ok, true);
});
test("缺时柱正文引用时柱干支失败，未说明限制也失败", () => {
  const input = sampleBazi("fortune", false);
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.equal(auditBaziOutput(output, input.facts).ok, true);
  assert.equal(auditBaziOutput({ ...output, headline: "时柱癸未" }, input.facts).ok, false);
  assert.equal(auditBaziOutput({ ...output, reason: "依事实判断" }, input.facts).ok, false);
});
test("正文各字段及每年短评扫描十神与关系完整词", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  const patches = [
    { headline: "寅申冲" }, { reason: "寅申冲" }, { useGod: "寅申冲" },
    { sections: output.sections.map((item) => ({ ...item, text: "寅申冲" })) },
    { timing: { window: "寅申冲", condition: "条件齐备" } },
  ];
  for (const patch of patches) {
    assert.equal(auditBaziOutput({ ...output, ...patch }, input.facts).ok, false);
  }
});

test("不存在的关系不能拆成两个合法单字蒙混通过", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  for (const reason of ["庚辛合", "巳午半合火", "午辰冲"]) {
    assert.equal(auditBaziOutput({ ...output, reason }, input.facts).ok, false);
  }
});

test("普通判断用语不被问事单字词表误判成盘面事实", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.equal(auditBaziOutput({ ...output, reason: "用神取正印，相神须看救应" }, input.facts).ok, true);
});
```

- [ ] **Step 2：原样保留问事核对逻辑，仅为其分词器增加默认空的扩展词表参数；落入八字核对器。** 两字关系倒序归一化后仍须事实中存在完整关系。语法上像关系的未知词也整体匹配，不能靠两个合法单字蒙混过关。

修改 `src/sanyi/audit.ts`，以下 diff 的 `-` 为精确旧片段、`+` 为新片段；上下文与空行保留。

```diff
--- a/src/sanyi/audit.ts
+++ b/src/sanyi/audit.ts
@@ -25,10 +25,11 @@
   "g",
 );

-export function tokenizeClaim(text: string): string[] {
+export function tokenizeClaim(text: string, extraWords: readonly string[] = []): string[] {
+  const words = [...new Set([...WORDS, ...extraWords])].sort((left, right) => right.length - left.length);
   const tokens: string[] = [];
   for (let index = 0; index < text.length;) {
-    const token = WORDS.find((candidate) => text.startsWith(candidate, index));
+    const token = words.find((candidate) => text.startsWith(candidate, index));
     if (token) {
       tokens.push(token);
       index += token.length;
```

```ts
// src/sanyi/bazi-audit.ts
import { baziRelationWords } from "../calendar/bazi-relations.js";
import { tokenizeClaim } from "./audit.js";
import { isNatalFact } from "./bazi-facts.js";
import type { BaziSchoolOutput } from "./bazi-schema.js";
import type { FactTable } from "./facts.js";
const aliases = new Map<string, string>();
for (const word of baziRelationWords()) {
  aliases.set(word, word);
  if (!word.includes("三合") && !word.includes("三会")) {
    aliases.set(word.charAt(1) + word.charAt(0) + word.slice(2), word);
  }
}
const EXTRA_WORDS = [
  ...aliases.keys(), "比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印", "日主",
  "天乙贵人", "文昌", "桃花", "驿马", "华盖", "羊刃", "禄神",
  ...[..."甲乙丙丁戊己庚辛壬癸"].flatMap((stem, index) => {
    return [..."春夏秋冬"].map((season) => `三${season}${stem}${"木木火火土土金金水水".charAt(index)}`);
  }),
];
const RELATION_PHRASE = new RegExp(
  "[子丑寅卯辰巳午未申酉戌亥]{3}(?:三合|三会)[金木水火土]"
  + "|[子丑寅卯辰巳午未申酉戌亥]{2}(?:半合|拱)[金木水火土]"
  + "|[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{2}(?:自刑|合|冲|害|破|刑)",
  "gu",
);
function words(text: string): string[] {
  // 语法上像关系的词也作为整体候选，避免不存在的关系拆成合法单字后过关。
  // 分词仍由 1A 的最长匹配循环完成；有效关系再按通行标签归一化。
  const candidates = [...text.matchAll(RELATION_PHRASE)].map((match) => match[0]);
  const vocabulary = new Set([...EXTRA_WORDS, ...candidates]);
  return tokenizeClaim(text, [...vocabulary]).filter((word) => {
    // 八字核对干支、十神、关系等完整词，不把问事的“体、用、相”等单字当成事实。
    return vocabulary.has(word) || /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]$/u.test(word)
      || /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(word);
  }).map((word) => aliases.get(word) ?? word);
}
function union(facts: FactTable): Set<string> {
  return new Set([...facts.values()].flatMap((fact) => [...fact.tokens]));
}
export function auditBaziOutput(output: BaziSchoolOutput, facts: FactTable): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  function check(text: string, allowed: ReadonlySet<string>, label: string): void {
    for (const word of words(text)) {
      if (!allowed.has(word)) {
        errors.push(`${label} 不支持关键词：${word}`);
      }
    }
  }
  for (const evidence of output.evidence) {
    const fact = facts.get(evidence.ref);
    if (!fact) {
      errors.push("事实编号不存在，请使用所供事实表中的 ref");
      continue;
    }
    check(evidence.claim, fact.tokens, evidence.ref);
  }
  // 正文只能用原局、运和锚年；窗口其它年份不会为总断虚构关系背书。
  const currentFacts = new Map([...facts].filter(([id]) => !/^year:\d{4}$/u.test(id)));
  const prose = [output.useGod, output.headline, output.reason,
    ...output.sections.flatMap((section) => [section.title, section.text]), ...output.advice];
  if ("timing" in output && output.timing) {
    prose.push(output.timing.window, output.timing.condition);
  }
  check(prose.join("\n"), union(currentFacts), "正文");
  // 同名干支可能属于合法大运，缺时柱时仍拒绝将其归给时柱、命宫或身宫。
  if (facts.has("chart:limit") && /(?:时柱|命宫|身宫)[^。；\n]{0,8}[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/u
    .test(prose.join("\n"))) {
    errors.push("缺时柱，不得引用时柱、命宫或身宫干支");
  }
  if (facts.has("chart:limit") && !/缺时柱|时辰未知/u.test(prose.join("\n"))) {
    errors.push("缺时柱时须说明判断限制");
  }
  if ("years" in output) {
    const natal = new Map([...facts].filter(([id, fact]) => isNatalFact(id, fact.label)));
    for (const item of output.years) {
      const year = facts.get(`year:${item.year}`);
      if (!year) {
        errors.push(`${item.year} 年事实不存在`);
        continue;
      }
      const allowed = new Set([...union(natal), ...year.tokens]);
      check(item.note, allowed, `${item.year} 年短评`);
    }
  }
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 3：B4b mock 落入后重跑核对与 1A `tests/sanyi-audit.test.ts`，新增 7 项及原有问事测试通过。** 正文额外核对 useGod、标题、timing；普通判断用语不套用问事单字词表；缺时柱说明与明显的时柱干支归属同时检查。逐年可用集合严格限定为该年加原局四柱、藏干、原局关系、调候。

## Chunk B4b：三家输入、单家落笔与确定性 mock

本块给出 B4.4–B4.7。沈、任不收调候摘句，余必须收匹配日干月令的完整条目及 quote。命理按设计第 11 节分派输入，运势为落实新增逐年规范，三家共同补收窗口与锚年事实；余家只取运年干支、十神、藏干、大运，不追加关系与神煞。沈、任的窗口事实保留每年关系。三家断语互不可见。

### Task B4.4：三家输入与提示词

**文件：** 新建 `tests/sanyi-bazi-schools.test.ts`、`src/sanyi/schools/bazi-shared.ts`、`shenxiaozhan.ts`、`yuchuntai.ts`、`rentieqiao.ts`、`bazi-index.ts`（后五项同目录）。

- [ ] **Step 1：写输入隔离与文化守卫测试，运行 `node --import tsx --test tests/sanyi-bazi-schools.test.ts`，确认模块缺失 RED。** 守卫正则原样取自 1A 测试，不另造较宽松列表。

```ts
// tests/sanyi-bazi-schools.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import { selectBaziFacts } from "../src/sanyi/schools/bazi-shared.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
// 原样复用 1A frontend-sanyi-content.test.ts 的文化守卫表达式。
const CULTURE_FORBIDDEN = /[\u3040-\u30ff]|・|易者|身銭|筮竹|神社|高島|断易|問|賭/u;
test("余春台输入有庚金巳月及原文，沈任输入无调候摘句", () => {
  const input = sampleBazi();
  for (const school of BAZI_SCHOOLS) {
    const prompt = school.buildUserPrompt(input);
    if (school.key === "yuchuntai") {
      assert.match(prompt, /三夏庚金/);
      assert.match(prompt, /但先壬水/);
      assert.ok(prompt.includes(input.tiaohou.quote));
      assert.ok(!selectBaziFacts(school.key, input).has("relation:1"));
    } else {
      assert.ok(!prompt.includes(input.tiaohou.quote));
      assert.doesNotMatch(prompt, /但先壬水/);
      assert.ok(!selectBaziFacts(school.key, input).has("tiaohou"));
    }
    assert.doesNotMatch(school.systemPrompt, CULTURE_FORBIDDEN);
    assert.match(school.systemPrompt, new RegExp(`自称只用本名“${school.name}”`));
    assert.match(prompt, /2023/);
    assert.match(school.systemPrompt, /十六字/);
    assert.match(school.systemPrompt, /整年/);
  }
});
test("命理无流年窗口输入，透干通根按原局确定性组装", () => {
  const input = sampleBazi("destiny");
  for (const school of BAZI_SCHOOLS) {
    const facts = selectBaziFacts(school.key, input);
    assert.ok(![...facts.keys()].some((id) => id.startsWith("year:")));
    assert.ok(!school.buildUserPrompt(input).includes("逐年窗口："));
    if (school.key === "shenxiaozhan") {
      assert.ok(facts.has("structure:month"));
      assert.ok(!facts.has("elements"));
    }
    if (school.key === "rentieqiao") {
      assert.ok(facts.has("structure:roots"));
    }
  }
});
```

- [ ] **Step 2：实现共同边界、事实筛选与三家定义。** `period` 由 B5 提供 today/month 的真实事实，B4 只传递；示例整年无须额外 period 事实。提示词保留缺时柱、引文、应期条件、医疗法律投资边界；用本名自称。

```ts
// src/sanyi/schools/bazi-shared.ts
import type { BaziChart } from "../../calendar/bazi.js";
import type { QiongtongEntry } from "../../calendar/qiongtong.js";
import type { FortuneHorizon } from "../classify.js";
import type { FactTable } from "../facts.js";
export type BaziSchoolKey = "shenxiaozhan" | "yuchuntai" | "rentieqiao";
export interface BaziSchoolInput {
  kind: "destiny" | "fortune";
  question: string;
  horizon: FortuneHorizon;
  chart: BaziChart;
  facts: FactTable;
  tiaohou: QiongtongEntry;
  // B5 按注入时钟生成今天/本月事实，B4 不从系统时钟或问题文本猜流日。
  period: {
    label: string;
    facts: FactTable;
  };
}
export interface BaziSchool {
  key: BaziSchoolKey;
  name: string;
  school: string;
  systemPrompt: string;
  buildUserPrompt(input: BaziSchoolInput): string;
}
const ALLOWED: Record<BaziSchoolKey, readonly string[]> = {
  shenxiaozhan: ["pillar:", "hidden:", "structure:month", "structure:roots", "relation:", "luck:"],
  yuchuntai: ["pillar:", "hidden:", "tiaohou", "elements", "luck:"],
  rentieqiao: ["pillar:", "hidden:", "structure:roots", "relation:", "elements", "luck:"],
};
export const BAZI_BOUNDARIES = `只能引用随请求提供的原文，不得补写或编造引文。
不得编造排盘数据，不得虚构外应；应期必须写明成立条件。
不做医疗、法律、投资结论，健康问题建议就医。
缺时柱时须说明判断限制，不得引用时柱、命宫或身宫事实。
evidence.ref 只能使用可用事实编号，claim 只陈述该事实支持的关键词。
命理不得输出吉凶、把握、逐年列表或 timing，五分项依次为性格、事业、财运、感情、健康。
正文与 timing 只谈所问时间范围；其它年份的干支、关系只写在对应年份的短评中。
运势须回应所问时间范围，years 按逐年窗口升序每年一项，通常十年；出生年与上限裁剪后以实际窗口为准。
每项包含 year、verdict、confidenceTenths、note，短评不超过十六字，只用该年与原局事实。
问整年时锚年那项的 verdict 和 confidenceTenths 与总断相同，今天、本月不要求一致。
吉与大吉为六至九成，平为四至六成，凶与大凶为一至四成，总断和逐年均遵守。
需要留意的月份或日子写入 timing.window，成立条件写入 timing.condition。
输出必须严格符合给定 JSON Schema。`;
export function selectBaziFacts(key: BaziSchoolKey, input: BaziSchoolInput): FactTable {
  const facts: FactTable = new Map();
  for (const [id, fact] of input.facts) {
    const allowed = ALLOWED[key].some((prefix) => id === prefix || id.startsWith(prefix));
    const monthFact = input.kind === "fortune" && id.startsWith("liuyue:");
    const yearFact = input.kind === "fortune" && id.startsWith("year:");
    if (id === "chart:limit" || allowed || yearFact || monthFact) {
      if (input.kind === "destiny" && id.startsWith("relation:") && fact.label.startsWith("year ")) {
        continue;
      }
      // 余家逐年只收运年干支、十神与藏干，不追加格局派使用的关系和神煞。
      if (key === "yuchuntai" && yearFact) {
        const match = fact.label.match(/^(\d{4}) 年/u);
        const entry = input.chart.liunian.years.find((year) => String(year.year) === match?.[1]);
        if (!entry) {
          throw new Error("调候派缺少对应流年事实");
        }
        const tokens = [entry.ganZhi, entry.stem, entry.branch, entry.stemGod,
          ...entry.hidden.flatMap((hidden) => [hidden.stem, hidden.god])];
        if (entry.luck) {
          tokens.push(entry.luck.ganZhi, entry.luck.stemGod);
        }
        facts.set(id, { id, label: `${entry.year} 年 ${tokens.join(" ")}`, tokens: new Set(tokens) });
      } else {
        facts.set(id, fact);
      }
    }
  }
  if (input.kind === "fortune") {
    for (const [id, fact] of input.period.facts) {
      if (!id.startsWith("period:")) {
        throw new Error("时间范围事实编号须以 period: 开头");
      }
      if (key === "yuchuntai") {
        const tokens = [...fact.tokens].filter((token) => {
          return /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{1,2}$/u.test(token)
            || ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"].includes(token);
        });
        facts.set(id, { id, label: `${input.period.label} ${tokens.join(" ")}`, tokens: new Set(tokens) });
      } else {
        facts.set(id, fact);
      }
    }
  }
  return facts;
}
export function buildBaziPrompt(key: BaziSchoolKey, input: BaziSchoolInput): string {
  const facts = selectBaziFacts(key, input);
  const prompt = [
    `问题：${input.question}`, `任务类型：${input.kind}`,
    `时柱限制：${input.chart.pillars.time ? "时柱已知" : "缺时柱，判断存在限制"}`,
    "可用事实编号：", ...[...facts.values()].map((fact) => `${fact.id}：${fact.label}`),
    // JSON 保留 tokens，使 mock 与真实家使用同一筛选后的事实，而不从 prose 反推数据。
    `事实表 JSON：${JSON.stringify([...facts.values()].map((fact) => ({ ...fact, tokens: [...fact.tokens] })))}`,
  ];
  if (input.kind === "fortune") {
    prompt.push(`所问范围：${input.horizon} ${input.period.label}`,
      `锚年：${input.chart.liunian.anchorYear}`,
      `逐年窗口：${input.chart.liunian.years.map((year) => year.year).join("、")}`);
  }
  if (key === "yuchuntai") {
    prompt.push(`调候条目：${JSON.stringify(input.tiaohou)}`, `可直接引用的原文：${input.tiaohou.quote}`);
  } else {
    prompt.push("本次未提供可直接引用的原文，不得编造本派典籍的原句。");
  }
  return prompt.join("\n");
}
```

```ts
// src/sanyi/schools/shenxiaozhan.ts
import { BAZI_BOUNDARIES, buildBaziPrompt, type BaziSchool, type BaziSchoolInput } from "./bazi-shared.js";
export const shenxiaozhan = {
  key: "shenxiaozhan", name: "沈孝瞻", school: "格局派",
  systemPrompt: `你是沈孝瞻，以格局派路径解读命理与运势。
按月令取格、成败救应、相神依次判断；不得把客观关系自动当作成化。
本次没有《子平真诠》原文，只能据所供事实推论，不得编造原句。
自称只用本名“沈孝瞻”。\n${BAZI_BOUNDARIES}`,
  buildUserPrompt(input: BaziSchoolInput): string {
    return buildBaziPrompt("shenxiaozhan", input);
  },
} satisfies BaziSchool;
```

```ts
// src/sanyi/schools/yuchuntai.ts
import { BAZI_BOUNDARIES, buildBaziPrompt, type BaziSchool, type BaziSchoolInput } from "./bazi-shared.js";
export const yuchuntai = {
  key: "yuchuntai", name: "余春台", school: "调候派",
  systemPrompt: `你是余春台，以调候派路径解读命理与运势。
按日干配月令、寒暖燥湿、调候用神依次判断，结合所供对应调候条目的 useStems 与 quote。
只有随请求提供的《穷通宝鉴》摘句可以直接引用，不得另引其它段落。
自称只用本名“余春台”。\n${BAZI_BOUNDARIES}`,
  buildUserPrompt(input: BaziSchoolInput): string {
    return buildBaziPrompt("yuchuntai", input);
  },
} satisfies BaziSchool;
```

```ts
// src/sanyi/schools/rentieqiao.ts
import { BAZI_BOUNDARIES, buildBaziPrompt, type BaziSchool, type BaziSchoolInput } from "./bazi-shared.js";
export const rentieqiao = {
  key: "rentieqiao", name: "任铁樵", school: "扶抑派",
  systemPrompt: `你是任铁樵，以扶抑派路径解读命理与运势。
按日主强弱、扶抑取用、气势流通依次判断，结合原局通根与透干。
本次没有《滴天髓阐微》原文，只能据所供事实推论，不得编造原句。
自称只用本名“任铁樵”。\n${BAZI_BOUNDARIES}`,
  buildUserPrompt(input: BaziSchoolInput): string {
    return buildBaziPrompt("rentieqiao", input);
  },
} satisfies BaziSchool;
```

```ts
// src/sanyi/schools/bazi-index.ts
import { shenxiaozhan } from "./shenxiaozhan.js";
import { yuchuntai } from "./yuchuntai.js";
import { rentieqiao } from "./rentieqiao.js";
export const BAZI_SCHOOLS = [shenxiaozhan, yuchuntai, rentieqiao] as const;
export type { BaziSchoolKey } from "./bazi-shared.js";
```

- [ ] **Step 3：运行同命令，预期 2 项通过；检查余家 quote 逐字包含「但先壬水」，沈任没有 quote。** B6 以 timing.window 展示关注月标签，以 timing.condition 展示成立条件。

### Task B4.5：单家调用、校验与一次重写

**文件：** 新建 `tests/sanyi-bazi-school-runner.test.ts`、`src/sanyi/bazi-school-runner.ts`。测试文件同时覆盖 B4.6 mock，完整一次给出。

- [ ] **Step 1：写运行器及 mock 测试，运行 `node --import tsx --test tests/sanyi-bazi-school-runner.test.ts`，确认模块缺失 RED。**

```ts
// tests/sanyi-bazi-school-runner.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicMockProvider, type StructuredOutputRequest } from "../src/agent/provider.js";
import { runBaziSchool } from "../src/sanyi/bazi-school-runner.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import { selectBaziFacts } from "../src/sanyi/schools/bazi-shared.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA,
  checkBaziConsistency } from "../src/sanyi/bazi-schema.js";
import { validateStructuredOutput } from "../src/agent/provider.js";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
test("首次核对失败，带中文错误完整重写一次后成功", async () => {
  const input = sampleBazi();
  const school = BAZI_SCHOOLS[0];
  const valid = mockBaziSchoolOutput(school.key, selectBaziFacts(school.key, input), "fortune");
  const provider = new DeterministicMockProvider("rewrite", {
    "sanyi/fortune/shenxiaozhan": (request: StructuredOutputRequest, index: number) => {
      if (index === 0) {
        return { ...valid, reason: "子午冲" };
      }
      assert.match(request.userPrompt, /不支持关键词.*子午冲/);
      return valid;
    },
  });
  const result = await runBaziSchool({ provider }, { ...input, school });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
});
test("两次失败无模型原文回显，另两家独立成功", async () => {
  const input = sampleBazi();
  const provider = new DeterministicMockProvider("bad", {
    "sanyi/fortune/shenxiaozhan": { ...mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune"),
      reason: "私人原文子午冲" },
  });
  const result = await runBaziSchool({ provider }, { ...input, school: BAZI_SCHOOLS[0] });
  assert.equal(result.status, "failed");
  assert.equal(result.calls, 2);
  if (result.status === "failed") {
    assert.doesNotMatch(result.error, /私人原文/);
    assert.match(result.error, /核对/);
  }
  for (const school of BAZI_SCHOOLS.slice(1)) {
    assert.equal((await runBaziSchool({ provider: new MockSchoolsProvider() }, { ...input,
      school })).status, "done");
  }
});
test("provider 抛错返回 failed，错误消息不回显", async () => {
  const provider = new DeterministicMockProvider("transport", {
    "sanyi/fortune/shenxiaozhan": () => {
      throw new Error("私人输入回显");
    },
  });
  const result = await runBaziSchool({ provider }, { ...sampleBazi(), school: BAZI_SCHOOLS[0] });
  assert.deepEqual(result, { status: "failed", calls: 1, error: "模型调用失败，请稍后重试" });
});
test("运行器自行校验 Schema，结构失败也只重写一次", async () => {
  const provider = new MockSchoolsProvider();
  let calls = 0;
  provider.generateStructured = async <T>(): Promise<T> => {
    calls += 1;
    return {} as T;
  };
  const result = await runBaziSchool({ provider }, { ...sampleBazi(), school: BAZI_SCHOOLS[0] });
  assert.equal(result.status, "failed");
  assert.equal(calls, 2);
});
test("三家命理运势 mock 全通过，窗口年份与锚项吻合", async () => {
  for (const kind of ["destiny", "fortune"] as const) {
    for (const timeKnown of [true, false]) {
      const input = sampleBazi(kind, timeKnown);
      for (const school of BAZI_SCHOOLS) {
        const facts = selectBaziFacts(school.key, input);
        const output = mockBaziSchoolOutput(school.key, facts, kind);
        const schema = kind === "destiny" ? DESTINY_SCHOOL_SCHEMA : FORTUNE_SCHOOL_SCHEMA;
        assert.doesNotThrow(() => validateStructuredOutput(schema, output));
        assert.deepEqual(checkBaziConsistency(output, input.chart, input.horizon), []);
        assert.equal(auditBaziOutput(output, facts).ok, true);
        if ("years" in output) {
          assert.equal(output.years.length, 10);
          assert.deepEqual(output.years.map((year) => year.year),
            input.chart.liunian.years.map((year) => year.year));
        }
        const result = await runBaziSchool({ provider: new MockSchoolsProvider() }, { ...input, school });
        assert.equal(result.status, "done");
        assert.equal(result.calls, 1);
      }
    }
  }
  const facts = sampleBazi("destiny").facts;
  assert.match(mockBaziSchoolOutput("shenxiaozhan", facts, "destiny").useGod, /正印/);
  assert.equal(mockBaziSchoolOutput("yuchuntai", facts, "destiny").useGod, "壬");
  assert.match(mockBaziSchoolOutput("rentieqiao", facts, "destiny").useGod, /比肩/);
});
```

- [ ] **Step 2：按 1A 的两轮结构实现单家运行器。** 顺序为一次调用 → Ajv → 一致性 → 核对；带中文问题重写一次，最终只返回 failed 和原因，无模型原文或 provider 异常消息回显。传输错误立即 failed。不抽改 1A 运行器，以免其 rejected 行为发生变化。

```ts
// src/sanyi/bazi-school-runner.ts
import { StructuredOutputError, validateStructuredOutput,
  type StructuredOutputProvider } from "../agent/provider.js";
import { auditBaziOutput } from "./bazi-audit.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA, checkBaziConsistency, type BaziSchoolOutput,
  } from "./bazi-schema.js";
import { selectBaziFacts, type BaziSchool, type BaziSchoolInput } from "./schools/bazi-shared.js";
export type BaziSchoolRunResult = {
  status: "done";
  output: BaziSchoolOutput;
  calls: number;
} | {
  status: "failed";
  error: string;
  calls: number;
};
export async function runBaziSchool(deps: {
  provider: StructuredOutputProvider;
}, input: BaziSchoolInput & {
  school: BaziSchool;
}): Promise<BaziSchoolRunResult> {
  const schema = input.kind === "destiny" ? DESTINY_SCHOOL_SCHEMA : FORTUNE_SCHOOL_SCHEMA;
  let calls = 0;
  try {
    const facts = selectBaziFacts(input.school.key, input);
    const basePrompt = input.school.buildUserPrompt(input);
    let userPrompt = basePrompt;
    let errors: string[] = [];
    for (let pass = 0; pass < 2; pass += 1) {
      calls += 1;
      try {
        const raw = await deps.provider.generateStructured<unknown>({
          taskId: `sanyi/${input.kind}/${input.school.key}`,
          systemPrompt: input.school.systemPrompt, cacheSystemPrompt: true,
          userPrompt, schema, effort: "medium",
        });
        // 不假设 provider 一定做过校验；Schema 失败也进入一次重写。
        const output = validateStructuredOutput<BaziSchoolOutput>(schema, raw);
        errors = [...checkBaziConsistency(output, input.chart, input.horizon),
          ...auditBaziOutput(output, facts).errors];
        if (errors.length === 0) {
          return { status: "done", output, calls };
        }
      }
      catch (error) {
        if (!(error instanceof StructuredOutputError)) {
          return { status: "failed", error: "模型调用失败，请稍后重试", calls };
        }
        errors = ["输出字段、类型、分项顺序或字数不符合 JSON Schema，请按规定完整重写"];
      }
      userPrompt = [basePrompt, "", "上一次输出未通过核对，请修正后完整重写：",
        ...errors.map((error) => `- ${error}`)].join("\n");
    }
    return { status: "failed", error: `断语未通过盘面核对：${errors.join("；")}`, calls };
  }
  catch {
    return { status: "failed", error: "三家输入组装失败，请检查事实表", calls };
  }
}
```

- [ ] **Step 3：B4.6 mock 落入后重跑同命令，预期 5 项通过。** 先测单家及另外两家独立调用；并行合议、存档状态和换日由 B5 验证。

### Task B4.6：确定性八字 mock 与任务路由

**文件：** 新建 `src/sanyi/mock-bazi-schools.ts`，修改 `src/sanyi/mock-provider.ts`；使用 B4.5 最后一项测试。

- [ ] **Step 1：先运行 B4.5 mock 测试，确认八字任务尚无路由时 RED。**

- [ ] **Step 2：实现事实驱动输出及 mock 路由。** 命例格局派取正印、调候派取第一用干壬、扶抑派取比肩，属于排练示例取法；正式判断仍由模型根据各派路径生成。运势按家与年份小哈希生成 3–7 成，以 ≥6 吉、≤4 凶、其余平推出吉凶；从该年事实取关系或十神写 ≤16 字短评。总断直接取锚项，各家有区分度。B6.3 的第 6 轮测试先对旧 mock 确认 RED，再运行本块及 B4.5 核对器测试确认 GREEN。

```ts
// src/sanyi/mock-bazi-schools.ts
import type { FactTable } from "./facts.js";
import { DESTINY_TITLES, type BaziSchoolOutput, type DestinySchoolOutput, type FortuneSchoolOutput } from "./bazi-schema.js";
import type { BaziSchoolKey } from "./schools/bazi-shared.js";
function useGodFor(key: BaziSchoolKey, facts: FactTable): {
    ref: string;
    word: string;
} {
    if (key === "yuchuntai") {
        const tiaohou = facts.get("tiaohou");
        const word = [...tiaohou?.tokens ?? []].find((token) => /^[甲乙丙丁戊己庚辛壬癸]$/u.test(token));
        if (!word) {
            throw new Error("调候 mock 缺少用神干");
        }
        return { ref: "tiaohou", word };
    }
    // 排练展示两派的典型取法，不把示例选择充当正式格局或强弱算法。
    const wanted = key === "shenxiaozhan" ? ["正印", "偏印", "正官", "七杀"] : ["比肩", "劫财", "正印", "偏印"];
    for (const word of wanted) {
        const fact = [...facts.values()].find((item) => {
            return (item.id.startsWith("pillar:") || item.id.startsWith("hidden:")) && item.tokens.has(word);
        });
        if (fact) {
            return { ref: fact.id, word };
        }
    }
    const day = facts.get("pillar:day");
    const word = [...day?.tokens ?? []].find((token) => /^[甲乙丙丁戊己庚辛壬癸]$/u.test(token));
    if (!word) {
        throw new Error("八字 mock 缺少日干事实");
    }
    return { ref: "pillar:day", word };
}
export function mockBaziSchoolOutput(key: BaziSchoolKey, facts: FactTable, kind: "destiny"): DestinySchoolOutput;
export function mockBaziSchoolOutput(key: BaziSchoolKey, facts: FactTable, kind: "fortune"): FortuneSchoolOutput;
export function mockBaziSchoolOutput(key: BaziSchoolKey, facts: FactTable, kind: "destiny" | "fortune"): BaziSchoolOutput;
export function mockBaziSchoolOutput(key: BaziSchoolKey, facts: FactTable, kind: "destiny" | "fortune"): BaziSchoolOutput {
    const useGod = useGodFor(key, facts);
    let reason = "依事实判断，先核实条件";
    if (facts.has("chart:limit")) {
        reason = "缺时柱，判断存在限制，先核实条件";
    }
    const base: DestinySchoolOutput = {
        useGod: useGod.word, headline: "审慎待时", reason,
        sections: DESTINY_TITLES.map((title) => ({ title, text: "先核实客观条件" })),
        advice: ["保留调整余地"], evidence: [{ ref: useGod.ref, claim: useGod.word }],
    };
    if (kind === "destiny") {
        return base;
    }
    // 家与年份共同决定分数；各家偏移保证锚年总断不同。
    const offset = { shenxiaozhan: 0, yuchuntai: 1, rentieqiao: 2 }[key];
    const years = [...facts.values()].filter(fact => /^year:\d{4}$/u.test(fact.id))
        .sort((a, b) => a.id.localeCompare(b.id, "en")).map(fact => {
        const year = Number(fact.id.slice(5));
        const hash = (Math.imul(year, 31) >>> 0) % 5;
        const confidenceTenths = 3 + (hash + offset) % 5;
        const verdict = confidenceTenths >= 6 ? "吉" as const : confidenceTenths <= 4 ? "凶" as const : "平" as const;
        const word = [...fact.tokens].find(token => /(合|冲|刑|害|破|会|拱)/u.test(token)) ?? [...fact.tokens].find(token => ["比肩", "劫财", "食神", "伤官", "正财", "偏财", "正官", "七杀", "正印", "偏印"].includes(token));
        if (!word)
            throw new Error("逐年 mock 缺少关系或十神事实");
        return { year, verdict, confidenceTenths, note: `${word}，${verdict === "吉" ? "宜进取" : "宜守成"}` };
    });
    const anchorYear = Number(facts.get("year:anchor")?.label.match(/^\d{4}/u)?.[0]);
    const anchor = years.find(item => item.year === anchorYear);
    if (!anchor)
        throw new Error("逐年 mock 缺少锚年事实");
    return { ...base, headline: `${useGod.word}宜审慎`, verdict: anchor.verdict, confidenceTenths: anchor.confidenceTenths, years };
}
```

修改 `src/sanyi/mock-provider.ts`，以下 diff 的 `-` 为精确旧片段、`+` 为新片段；上下文与空行保留。

```diff
--- a/src/sanyi/mock-provider.ts
+++ b/src/sanyi/mock-provider.ts
@@ -10,6 +10,27 @@
 import type { FactTable } from "./facts.js";
 import { mockSchoolOutput } from "./mock-schools.js";
 import type { QuestionSchoolKey } from "./schools/index.js";
+import { mockBaziSchoolOutput } from "./mock-bazi-schools.js";
+import type { BaziSchoolKey } from "./schools/bazi-shared.js";
+function baziFactsFromPrompt(prompt: string): FactTable {
+  const line = prompt.split("\n").find((row) => row.startsWith("事实表 JSON："));
+  if (!line) {
+    throw new Error("八字 mock 请求缺少事实表");
+  }
+  const rows: unknown = JSON.parse(line.slice("事实表 JSON：".length));
+  if (!Array.isArray(rows)) {
+    throw new Error("八字 mock 事实表格式错误");
+  }
+  const facts: FactTable = new Map();
+  for (const row of rows) {
+    if (!row || typeof row.id !== "string" || typeof row.label !== "string"
+      || !Array.isArray(row.tokens) || !row.tokens.every((token: unknown) => typeof token === "string")) {
+      throw new Error("八字 mock 事实条目格式错误");
+    }
+    facts.set(row.id, { id: row.id, label: row.label, tokens: new Set<string>(row.tokens) });
+  }
+  return facts;
+}
 function factsFromPrompt(prompt: string): FactTable {
   const facts: FactTable = new Map();
   for (const line of prompt.split("\n")) {
@@ -29,6 +50,11 @@
   readonly providerConfig = Object.freeze({ kind: "sanyi-mock-schools" });
   readonly providerConfigHash = hashJson(this.providerConfig);
   async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
+    const bazi = request.taskId.match(/^sanyi\/(destiny|fortune)\/(shenxiaozhan|yuchuntai|rentieqiao)$/u);
+    if (bazi) {
+      return mockBaziSchoolOutput(bazi[2] as BaziSchoolKey, baziFactsFromPrompt(request.userPrompt),
+        bazi[1] as "destiny" | "fortune") as T;
+    }
     const key = request.taskId.split("/").at(-1) as QuestionSchoolKey;
     if (!["chengyi", "jingfang", "shaoyong"].includes(key)) {
       throw new Error(`mock provider 不支持任务：${request.taskId}`);
```

- [ ] **Step 3：运行 B4 的全部测试，预期 22 项通过。** 三家 × 命理/运势 × 已知/缺时柱均通过 Schema、一致性、核对与真实 mock provider 路由；原有问事 mock 路径、事实解析与付款 mock 行为保持回归。

### Task B4.6R：第 4 轮阻断项回归

**文件：** 新建 `tests/sanyi-bazi-round4.test.ts`。

- [ ] **Step 1：先落入以下测试，对第 3 轮事实表与共同提示词运行，预期 4 项失败。**
- [ ] **Step 2：应用 B4.2 流月事实、B4.4 余家四柱藏干与正文分工修订，重跑预期 4 项通过。** 月名指节气月，不是农历初一到月底；日期用现场节气表，起点包含、终点不包含。`isNatalFact` 原样保留，流月不能为其它年份短评背书。

```ts
// tests/sanyi-bazi-round4.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import { selectBaziFacts } from "../src/sanyi/schools/bazi-shared.js";
test("锚年五月甲午、六月乙未、十月己亥及节气日期进入三家事实表", () => {
  const input = sampleBazi();
  for (const school of BAZI_SCHOOLS) {
    const facts = selectBaziFacts(school.key, input);
    for (const [index, gz] of [[5, "甲午"], [6, "乙未"], [10, "己亥"]] as const) {
      assert.ok(facts.get(`liuyue:${index}`)?.tokens.has(gz));
      assert.match(facts.get(`liuyue:${index}`)!.label, /2026-\d{2}-\d{2}/);
    }
  }
});
test("正文 timing 可写五月甲午，五月甲子无任何可用事实仍拒绝", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.ok(![...input.facts].filter(([id]) => !/^year:\d{4}$/.test(id))
    .some(([, fact]) => fact.tokens.has("甲子")));
  const timing = { window: "五月甲午", condition: "核实条件后行动" };
  assert.equal(auditBaziOutput({ ...output, timing }, input.facts).ok, true);
  assert.equal(auditBaziOutput({ ...output, timing: { ...timing, window: "五月甲子" } }, input.facts).ok, false);
  const years = output.years.map((item) => {
    if (item.year === 2031) {
      return { ...item, note: "甲午宜留意" };
    }
    return item;
  });
  assert.equal(auditBaziOutput({ ...output, years }, input.facts).ok, false);
});
test("余春台看到全部四柱藏干，时干癸水通过，午未合失败", () => {
  const input = sampleBazi();
  const facts = selectBaziFacts("yuchuntai", input);
  for (const key of ["year", "month", "day", "time"]) {
    assert.ok(facts.has(`pillar:${key}`));
    assert.ok(facts.has(`hidden:${key}`));
  }
  assert.ok(![...facts.keys()].some((id) => /^(relation|shensha|structure):/.test(id)));
  const output = mockBaziSchoolOutput("yuchuntai", facts, "fortune");
  assert.equal(auditBaziOutput({ ...output, reason: "时干癸水可借" }, facts).ok, true);
  assert.equal(auditBaziOutput({ ...output, reason: "午未合" }, facts).ok, false);
});
test("三家提示词明确正文与逐年短评分工", () => {
  for (const school of BAZI_SCHOOLS) {
    assert.match(school.systemPrompt, /正文与 timing 只谈所问时间范围/);
    assert.match(school.systemPrompt, /其它年份的干支、关系只写在对应年份的短评中/);
  }
});
```

### Task B4.7：字段契约与交叉验收

- [ ] **Step 1：核对 B2.3 样稿字段契约。** 命理不含吉凶把握；运势逐年格子按 year 取 verdict/confidenceTenths，点选短评取 note；「留意 某月」取 timing.window，并显示 condition，无值不造标签。
- [ ] **Step 2：运行 11 个新增测试文件及两种类型检查。** 使用下方验证记录中的完整命令，禁止仅凭 mock 返回 done 就宣称所有要求通过。
- [ ] **Step 3：运行 `npm test`，保留所有监听端口测试与 1A 回归。** 沙箱拒绝本机监听时如实记录 EPERM，不跳过或改动测试；主管在允许监听的隔离环境复跑。
- [ ] **Step 4：核对 bazi-three-schools 的逐年输出、核对、缺时柱及失败隔离场景。** B4 只准备完整代码，项目尚未实施，不勾 OpenSpec 2.5；逐年合议算术平均与失败家排除由 B5 完成。

## Chunk B5a：时间范围、存储联合、隐私投影与编排

沿用 `sanyi-chinese-redesign` 的 birth-profile、bazi-chart、bazi-three-schools、unified-question-entry、reading-archive、paid-oracle-flow 六份 spec delta；本轮只编写计划及隔离验证，不勾 OpenSpec 或计划实施任务。浏览器本机生辰保存与使用告知在 B6 完成，B5 不引入服务端原始生辰缓存。

**隐私局限：** 起运年月日和交运日期可能反推出生日期，这是八字本身的性质；保留这些派生字段，由 B6 生辰表单「分享会公开命盘」告知覆盖。原始出生日期时间、校正时刻、城市、经度与逐步校正只存在请求期，不存档、不记日志、不返回公开响应。B6 在本机用同一校正函数展示详情。服务端摘要只含 dst、solar、timeKnown、sect。

**分工：** `ReadingService` 继续负责问事，`BaziReadingService` 负责八字，两者共用同一 `ReadingStore` 与付款索引。问事 `withReadingLock`、原子写、付款 `wx` 索引及 update 队列保持不变；八字用同样的 promise 队列策略串行保护重试和换日。`kind` 是存档判别，旧 `kind: question` 不需要迁移或新增版本字段。泛型 read/update 默认问事，八字显式指定联合类型且运行时检查 kind。

### Task B5.1：注入时钟解析时间范围

**文件：** 新建 `tests/sanyi-fortune-context.test.ts`、`src/sanyi/fortune-context.ts`。

- [ ] **Step 1：写以下完整测试，运行 `node --import tsx --test tests/sanyi-fortune-context.test.ts`，模块未创建时 RED。**

```ts
// tests/sanyi-fortune-context.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import lunarPkg from "lunar-javascript";
import { resolveFortuneContext, periodFacts } from "../src/sanyi/fortune-context.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
function at(text: string, horizon = "year" as Parameters<typeof resolveFortuneContext>[0], sect: 1 | 2 = 1) {
  return resolveFortuneContext(horizon, () => new Date(text + "+08:00"), sect);
}
test("立春交接与五种范围锚年，公历跨年仍为旧立春年", () => {
  const term = lunarPkg.Solar.fromYmd(2026, 7, 1).getLunar().getJieQiTable()["立春"]!;
  const ms = Date.parse(term.toYmdHms().replace(" ", "T") + "+08:00");
  assert.equal(resolveFortuneContext("year", () => new Date(ms - 1_000), 1).anchorYear, 2025);
  assert.equal(resolveFortuneContext("year", () => new Date(ms), 1).anchorYear, 2026);
  for (const horizon of ["today", "month", "year"] as const) {
    assert.equal(at("2026-01-01T00:00:00", horizon).anchorYear, 2025);
    assert.equal(at("2026-10-06T21:00:00", horizon).anchorYear, 2026);
  }
  assert.equal(at("2026-01-01T00:00:00", "next-year").anchorYear, 2026);
  assert.equal(at("2026-10-06T21:00:00", "next-year").anchorYear, 2027);
  assert.equal(at("2026-10-06T21:00:00", "year:2030").anchorYear, 2030);
});
test("交节前后当前流月改变，与农历初一无关", () => {
  const term = lunarPkg.Solar.fromYmd(2026, 7, 1).getLunar().getJieQiTable()["寒露"]!;
  const ms = Date.parse(term.toYmdHms().replace(" ", "T") + "+08:00");
  const before = resolveFortuneContext("month", () => new Date(ms - 1_000), 1);
  const after = resolveFortuneContext("month", () => new Date(ms), 1);
  assert.equal(before.ganZhi, "丁酉");
  assert.equal(after.ganZhi, "戊戌");
});
test("流日按 sect 在 23 点或零点交接", () => {
  const before = at("2026-10-06T22:59:59", "today");
  const after = at("2026-10-06T23:00:00", "today");
  assert.notEqual(before.ganZhi, after.ganZhi);
  assert.equal(at("2026-10-06T23:00:00", "today", 2).ganZhi, before.ganZhi);
  assert.equal(at("2026-10-07T00:00:00", "today", 2).ganZhi, after.ganZhi);
});
test("流日事实含日干十神与原局关系，不混入大运", () => {
  const input = sampleBazi();
  const context = { ...at("2026-10-06T21:00:00", "today"), ganZhi: "壬子" };
  const fact = periodFacts(context, input.chart).get("period:day")!;
  assert.ok(fact.tokens.has("壬子"));
  assert.ok(fact.tokens.has("食神"));
  assert.ok(fact.tokens.has("子午冲"));
  const month = periodFacts(at("2026-10-06T21:00:00", "month"), input.chart).get("period:month")!;
  assert.ok(month.tokens.has("丁酉"));
});
```

- [ ] **Step 2：落入以下实现并重跑，预期 4 项通过。** 时钟只调用一次，转换为北京时间民用字段；年界用节气表立春精确时刻，流日按 sect，流月用当前节气月。today/month/year 取当前立春年，next-year 加一，指定年直接取该年，全部传入 buildBaziChart.targetYear。日/月关系只连接原局，不加大运；余家输入在 B4.4 再过滤掉关系词。

```ts
// src/sanyi/fortune-context.ts
import lunarPkg from "lunar-javascript";
import type { BaziChart } from "../calendar/bazi.js";
import { findRelations, makeNodes } from "../calendar/bazi-relations.js";
import type { FortuneHorizon } from "./classify.js";
import type { FactTable } from "./facts.js";
export interface FortuneContext {
  horizon: FortuneHorizon;
  anchorYear: number;
  label: string;
  ganZhi: string | null;
}
export function resolveFortuneContext(
  horizon: FortuneHorizon,
  clock: () => Date,
  sect: 1 | 2,
): FortuneContext {
  const now = clock();
  if (!Number.isFinite(now.getTime()) || (sect !== 1 && sect !== 2)) {
    throw new Error("提问时刻或换日口径无效");
  }
  const local = new Date(now.getTime() + 8 * 3_600_000);
  const civilYear = local.getUTCFullYear();
  const eight = lunarPkg.Solar.fromYmdHms(civilYear, local.getUTCMonth() + 1,
    local.getUTCDate(), local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds())
    .getLunar().getEightChar();
  eight.setSect(sect);
  const table = lunarPkg.Solar.fromYmd(civilYear, 7, 1).getLunar().getJieQiTable();
  const lichun = table["立春"];
  if (!lichun) {
    throw new Error("节气表缺少立春");
  }
  const boundary = Date.parse(lichun.toYmdHms().replace(" ", "T") + "+08:00");
  let anchorYear = civilYear;
  if (now.getTime() < boundary) {
    anchorYear -= 1;
  }
  if (horizon === "next-year") {
    anchorYear += 1;
  }
  if (horizon.startsWith("year:")) {
    if (!/^year:(19|20)\d{2}$/.test(horizon)) {
      throw new Error("指定年份无效");
    }
    anchorYear = Number(horizon.slice(5));
  }
  if (anchorYear < 1900 || anchorYear > 2099) {
    throw new Error("所问立春年超出支持范围");
  }
  let ganZhi: string | null = null;
  let label = `${anchorYear} 立春年`;
  if (horizon === "today") {
    ganZhi = eight.getDay();
    label = `今日 ${local.toISOString().slice(0, 10)} ${ganZhi}（北京时间）`;
  }
  if (horizon === "month") {
    ganZhi = eight.getMonth();
    label = `当前节气月 ${ganZhi}（北京时间）`;
  }
  return { horizon, anchorYear, label, ganZhi };
}
export function periodFacts(context: FortuneContext, chart: BaziChart): FactTable {
  const facts: FactTable = new Map();
  if (!context.ganZhi) {
    return facts;
  }
  const gz = context.ganZhi;
  const stem = gz.charAt(0);
  const branch = gz.charAt(1);
  const god = lunarPkg.LunarUtil.SHI_SHEN[chart.dayMaster + stem];
  if (!god) {
    throw new Error("流日或流月十神缺失");
  }
  const nodes = makeNodes(chart, null, gz);
  const relations = findRelations(nodes).filter((relation) => {
    return relation.nodeIds.some((id) => id.startsWith("year."));
  });
  const tokens = [gz, stem, branch, god, ...relations.map((relation) => relation.label)];
  const id = context.horizon === "today" ? "period:day" : "period:month";
  facts.set(id, { id, label: `${context.label} ${tokens.join(" ")}`, tokens: new Set(tokens) });
  return facts;
}
```

### Task B5.2：判别联合与派生命盘公开白名单

**文件：** 修改 `src/sanyi/store.ts`、`src/sanyi/reading-service.ts`；新建 `src/sanyi/bazi-public.ts`。

- [ ] **Step 1：先落入 B5.3 的测试和辅助文件，对旧类型与尚缺的新模块运行，确认 RED。** 旧问事原样读出、跨类型交易复用、三家合议与公开字段都是行为断言，不新增迁移层或第二套付款索引。
- [ ] **Step 2：应用以下既有文件修改。** read/update 的默认问事类型仅供 1A 调用；读取跨类型存档必须指定联合并检查 kind。问事所有读取改为受保护的 readQuestion，防止向八字 id 投掷、重试问事家或修改事项。事项与付款原有逻辑保留。

修改 `src/sanyi/store.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/src/sanyi/store.ts
+++ b/src/sanyi/store.ts
@@ -21,7 +21,7 @@
   error?: string;
 }

-export interface StoredReading {
+export interface StoredQuestionReading {
   id: string;
   kind: "question";
   createdAt: string;
@@ -50,6 +50,36 @@
   almanac?: AlmanacResult;
   qimen?: QimenResult;
 }
+
+export interface BaziSchoolState {
+  status: "pending" | "writing" | "done" | "failed";
+  output?: import("./bazi-schema.js").BaziSchoolOutput;
+  attempts: number;
+  retries: number;
+  error?: string;
+}
+export interface StoredBaziReading {
+  id: string;
+  kind: "destiny" | "fortune";
+  createdAt: string;
+  question: string;
+  payment: StoredQuestionReading["payment"];
+  status: "writing" | "done" | "failed";
+  chart: import("../calendar/bazi.js").BaziChart;
+  analysis: import("../calendar/bazi-relations.js").BaziAnalysis;
+  tiaohou: import("../calendar/qiongtong.js").QiongtongEntry;
+  correction: {
+    dst: "applied" | "not-applied" | "skipped-region";
+    solar: "applied" | "not-applied";
+    timeKnown: boolean;
+    sect: 1 | 2;
+  };
+  context: import("./fortune-context.js").FortuneContext;
+  almanac: AlmanacResult;
+  changes: number;
+  schools: Record<import("./schools/bazi-shared.js").BaziSchoolKey, BaziSchoolState>;
+}
+export type StoredReading = StoredQuestionReading | StoredBaziReading;

 const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

@@ -90,9 +120,9 @@
     return join(this.root, "readings", `${id}.json`);
   }

-  async read(id: string): Promise<StoredReading> {
+  async read<T extends StoredReading = StoredQuestionReading>(id: string): Promise<T> {
     const text = await readFile(this.readingPath(id), "utf8");
-    return JSON.parse(text) as StoredReading;
+    return JSON.parse(text) as T;
   }

   async write(reading: StoredReading): Promise<void> {
@@ -104,14 +134,14 @@
     await rename(temporary, target);
   }

-  async update(
+  async update<T extends StoredReading = StoredQuestionReading>(
     id: string,
-    change: (reading: StoredReading) => StoredReading,
-  ): Promise<StoredReading> {
-    let result: StoredReading | undefined;
+    change: (reading: T) => T,
+  ): Promise<T> {
+    let result: T | undefined;
     const previous = this.queues.get(id) ?? Promise.resolve();
     const next = previous.catch(() => {}).then(async () => {
-      result = change(await this.read(id));
+      result = change(await this.read<T>(id));
       await this.write(result);
     });
     this.queues.set(id, next);
```

修改 `src/sanyi/reading-service.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/src/sanyi/reading-service.ts
+++ b/src/sanyi/reading-service.ts
@@ -9,7 +9,7 @@
 import { buildLiuyaoChart, deriveFiveHexagrams } from "../oracle/liuyao-chart.js";
 import type { QuestionBlockSource } from "../oracle/question-oracle.js";
 import type { StructuredOutputProvider } from "../agent/provider.js";
-import { classifyQuestion, normalizeQuestion } from "./classify.js";
+import { classifyQuestion, normalizeQuestion, overrideClassification } from "./classify.js";
 import { buildQuestionFacts, type FactTable } from "./facts.js";
 import type { SanyiLogger } from "./log.js";
 import { buildOriginalTexts } from "./original-texts.js";
@@ -20,7 +20,7 @@
   ReadingStore,
   newReadingId,
   type SchoolState,
-  type StoredReading,
+  type StoredQuestionReading as StoredReading,
 } from "./store.js";
 import {
   assertNextThrow,
@@ -110,9 +110,13 @@
   async createQuestionReading(input: {
     question: string;
     subjectKey?: QuestionSubjectKey;
+    kind?: "question";
     feeProof: SanyiFeeProof;
   }): Promise<StoredReading> {
-    const classification = classifyQuestion(input.question);
+    let classification = classifyQuestion(input.question);
+    if (input.kind === "question") {
+      classification = overrideClassification(classification, { kind: "question" });
+    }
     if (classification.kind !== "question" || !classification.subject) {
       throw new Error("此服务只接受问事问题");
     }
@@ -158,7 +162,7 @@

   async throwCoin(id: string, index: number): Promise<RecordedThrow> {
     return this.withReadingLock(id, async () => {
-      const reading = await this.deps.store.read(id);
+      const reading = await this.readQuestion(id);
       const recorded = reading.throws.find((item) => item.index === index);
       if (recorded) {
         return recorded;
@@ -195,7 +199,7 @@

   async retrySchool(id: string, key: QuestionSchoolKey): Promise<StoredReading> {
     return this.withReadingLock(id, async () => {
-      const reading = await this.deps.store.read(id);
+      const reading = await this.readQuestion(id);
       const state = reading.schools[key];
       if (state.status !== "failed" && state.status !== "rejected") {
         throw new StateConflictError("此家当前状态不可重试");
@@ -224,7 +228,7 @@
     subjectKey: QuestionSubjectKey,
   ): Promise<StoredReading> {
     return this.withReadingLock(id, async () => {
-      const reading = await this.deps.store.read(id);
+      const reading = await this.readQuestion(id);
       if (reading.status !== "done") {
         throw new StateConflictError("三家尚未全部落笔，请稍后再改事项");
       }
@@ -267,7 +271,15 @@
   }

   async getReading(id: string): Promise<StoredReading> {
-    return this.deps.store.read(id);
+    return this.readQuestion(id);
+  }
+
+  private async readQuestion(id: string): Promise<StoredReading> {
+    const reading = await this.deps.store.read<import("./store.js").StoredReading>(id);
+    if (reading.kind !== "question") {
+      throw new StateConflictError("此接口只适用于问事");
+    }
+    return reading;
   }

   async whenSettled(id: string): Promise<void> {
@@ -381,7 +393,7 @@
     id: string,
     key: QuestionSchoolKey,
   ): Promise<void> {
-    const reading = await this.deps.store.read(id);
+    const reading = await this.readQuestion(id);
     const context = this.rebuildContext(reading);
     const school = QUESTION_SCHOOLS.find((item) => item.key === key);
     if (!school) {
@@ -396,7 +408,7 @@
     context: RebuiltContext,
     preserveRetries: boolean,
   ): Promise<void> {
-    const reading = await this.deps.store.read(id);
+    const reading = await this.readQuestion(id);
     const result = await runSchool(
       { provider: this.deps.provider },
       {
```

- [ ] **Step 3：落入隐私投影和合议。** 总断合议沿用 1A 的算术平均逻辑；逐年保留一位小数，每项 year/average/min/max/count，只有 done 家参加。一家 done 也照算，无 done 的年份为 null；年份位置与 chart.liunian.years 一一对应，所以全失败仍有十项 null。命理无总断合议与顶层 years。warnings 只存固定缺时柱说明，请求期节气/校正详情由本机展示。

```ts
// src/sanyi/bazi-public.ts
import type { BaziChart } from "../calendar/bazi.js";
import type { BaziSchoolState, StoredBaziReading } from "./store.js";
import type { FortuneSchoolOutput } from "./bazi-schema.js";
export interface YearConsensus {
  year: number;
  average: number;
  min: number;
  max: number;
  count: number;
}
export function derivedChart(chart: BaziChart): BaziChart {
  // 显式列举允许存档的派生字段，不复制请求、校正过程或出生地点。
  return { sect: chart.sect, dayBoundary: chart.dayBoundary, timeKnown: chart.timeKnown,
    dayMaster: chart.dayMaster, pillars: chart.pillars, taiYuan: chart.taiYuan,
    mingGong: chart.mingGong, shenGong: chart.shenGong, luck: chart.luck, annual: chart.annual,
    birthLiChunYear: chart.birthLiChunYear, liunian: chart.liunian,
    // 请求期警示可能包含节气时刻；公开只给固定、不可逆的缺时柱说明。
    warnings: chart.timeKnown ? [] : [chart.luck === null
      ? "时辰未知且出生当日交节，年/月柱与大运需补时辰确认"
      : "时辰未知，缺时柱，起运按正午估算仅供参考"] };
}
function doneOutputs(reading: StoredBaziReading): FortuneSchoolOutput[] {
  return Object.values(reading.schools).flatMap((state) => {
    if (state.status === "done" && state.output && "years" in state.output) {
      return [state.output];
    }
    return [];
  });
}
export function yearConsensus(reading: StoredBaziReading): (YearConsensus | null)[] {
  const outputs = doneOutputs(reading);
  return reading.chart.liunian.years.map(({ year }) => {
    const values = outputs.flatMap((output) => {
      const entry = output.years.find((item) => item.year === year);
      return entry ? [entry.confidenceTenths] : [];
    });
    if (values.length === 0) {
      return null;
    }
    const average = Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
    return { year, average, min: Math.min(...values), max: Math.max(...values), count: values.length };
  });
}
function visibleSchool(state: BaziSchoolState): Omit<BaziSchoolState, "attempts"> {
  const { attempts: _attempts, ...visible } = state;
  return visible;
}
function common(reading: StoredBaziReading) {
  return { id: reading.id, createdAt: reading.createdAt, question: reading.question,
    status: reading.status, payment: { firstHash: reading.payment.transactionHash },
    chart: derivedChart(reading.chart), analysis: reading.analysis, tiaohou: reading.tiaohou,
    correction: reading.correction, context: reading.context, almanac: reading.almanac,
    changes: reading.changes, schools: {
      shenxiaozhan: visibleSchool(reading.schools.shenxiaozhan),
      yuchuntai: visibleSchool(reading.schools.yuchuntai),
      rentieqiao: visibleSchool(reading.schools.rentieqiao),
    } };
}
export function publicBaziReading(reading: StoredBaziReading) {
  const value = common(reading);
  if (reading.kind === "destiny") {
    return { ...value, kind: "destiny" as const };
  }
  const outputs = doneOutputs(reading);
  let consensusTenths: number | null = null;
  if (outputs.length > 0) {
    consensusTenths = outputs.reduce((sum, output) => sum + output.confidenceTenths, 0) / outputs.length;
  }
  return { ...value, kind: "fortune" as const, consensusTenths, years: yearConsensus(reading) };
}
export type PublicBaziReading = ReturnType<typeof publicBaziReading>;
```

### Task B5.2R：第 5 轮公开警示回归

- [ ] **Step 1：先落下列测试，在旧公开文案上运行确认断言失败。** 再应用 B5.2 的两种固定警示；不复制请求期节气时刻。

```ts
// tests/sanyi-bazi-public-warnings.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { derivedChart } from "../src/sanyi/bazi-public.js";
test("公开警示区分近似大运与出生当日交节，不泄露节气时刻", () => {
    const input = { corrected: { year: 1990, month: 5, day: 15, hour: 12, minute: 0, second: 0 }, gender: "male" as const, sect: 1 as const, timeKnown: false, targetYear: 2026 };
    const ordinary = derivedChart(buildBaziChart(input));
    assert.notEqual(ordinary.luck, null);
    assert.deepEqual(ordinary.warnings, ["时辰未知，缺时柱，起运按正午估算仅供参考"]);
    const jie = derivedChart(buildBaziChart({ ...input, corrected: { ...input.corrected, day: 6 } }));
    assert.equal(jie.luck, null);
    assert.deepEqual(jie.warnings, ["时辰未知且出生当日交节，年/月柱与大运需补时辰确认"]);
    assert.doesNotMatch([...ordinary.warnings, ...jie.warnings].join(""), /\d{1,2}:\d{2}|立夏/);
});
```

- [ ] **Step 2：运行 `node --import tsx --test tests/sanyi-bazi-public-warnings.test.ts tests/sanyi-bazi-reading-service.test.ts`。** 已知时辰及缺时辰非交节日，都必须拒绝相反性别换日；交节日缺时辰的 luck 为 null 时比较 null，本身没有可区分性别的方向与起运，这是本轮明确要求的边界。

### Task B5.3：八字编排与免费重跑

**文件：** 新建 `tests/helpers/bazi-service.ts`、`tests/sanyi-bazi-reading-service.test.ts`、`src/sanyi/bazi-reading-service.ts`。

- [ ] **Step 1：落入辅助文件与完整测试，运行 `node --import tsx --test tests/sanyi-bazi-reading-service.test.ts`，新服务不存在时 RED。** 测试中的支付拒绝早于任何排盘，另测 3 类型互相复用和新 store 实例读取持久化索引；并行门闩验证三家调用先全部开始。一家失败、全失败、免费重试两次、四柱身份校验、晚子时日柱变化、两次切换与并发限额均须通过。

```ts
// tests/helpers/bazi-service.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReadingService } from "../../src/sanyi/reading-service.js";
import { BaziReadingService } from "../../src/sanyi/bazi-reading-service.js";
import { ReadingStore } from "../../src/sanyi/store.js";
import { createSanyiLogger } from "../../src/sanyi/log.js";
import { MockSchoolsProvider, mockSingleFeeReceipt } from "../../src/sanyi/mock-provider.js";
import { createSanyiApi } from "../../src/sanyi/api.js";
import type { StructuredOutputProvider } from "../../src/agent/provider.js";
export const birth = {
  calendar: "solar", isLeapMonth: false, year: 1990, month: 5, day: 15,
  time: { hour: 15, minute: 30 }, gender: "male",
};
export function proof(index = 1) {
  return { payer: `0x${"11".repeat(20)}` as `0x${string}`,
    transactionHash: `0x${index.toString(16).padStart(64, "0")}` as `0x${string}` };
}
export async function baziFixture(provider: StructuredOutputProvider = new MockSchoolsProvider()) {
  const root = await mkdtemp(join(tmpdir(), "sanyi-b5-"));
  const store = new ReadingStore(root);
  const calls = { payments: 0 };
  const clock = () => new Date("2026-10-06T21:00:00+08:00");
  const deps = {
    store, provider, clock, logger: createSanyiLogger(join(root, "log"), clock),
    feeVerifier: { verify: async (value: Parameters<typeof mockSingleFeeReceipt>[0]) => {
      calls.payments += 1;
      return mockSingleFeeReceipt(value);
    } },
    blockSource: { latest: async () => {
      throw new Error("八字不得取摇卦区块");
    } },
  };
  const question = new ReadingService(deps);
  const bazi = new BaziReadingService(deps);
  const api = createSanyiApi(question, { now: clock, bazi });
  return { root, store, calls, bazi, question, api,
    close: async () => rm(root, { recursive: true, force: true }) };
}
```

```ts
// tests/sanyi-bazi-reading-service.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { baziFixture, birth, proof } from "./helpers/bazi-service.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { statusForError } from "../src/sanyi/http-errors.js";
import { yearConsensus } from "../src/sanyi/bazi-public.js";
import type { StoredBaziReading } from "../src/sanyi/store.js";
async function create(f: Awaited<ReturnType<typeof baziFixture>>, index = 1,
  kind: "destiny" | "fortune" = "fortune") {
  const value = await f.bazi.create({ kind, question: kind === "fortune" ? "我今年运势如何" : "看看我的八字",
    birth, sect: 1, horizon: "year", feeProof: proof(index) });
  await f.bazi.whenSettled(value.id);
  return f.bazi.getReading(value.id);
}
test("缺生辰入口返回中文 400，非法生辰不调用付款", async () => {
  const f = await baziFixture();
  try {
    for (const question of ["我今年运势如何", "看看我的八字"]) {
      await assert.rejects(f.api.createReading({ question, feeProof: proof() }), (error: unknown) => {
        return error instanceof Error && error.message === "请先填写生辰" && statusForError(error) === 400;
      });
    }
    await assert.rejects(f.api.createReading({ question: "我今年运势如何", birth: {}, feeProof: proof() }));
    assert.equal(f.calls.payments, 0);
  } finally {
    await f.close();
  }
});
test("付款核验在排盘模型之前；跨三类型及重启后付款不可复用", async () => {
  const f = await baziFixture();
  try {
    const first = await create(f);
    for (const kind of ["destiny", "fortune"] as const) {
      await assert.rejects(create(f, 1, kind), /付款凭证已用于/);
    }
    await assert.rejects(f.question.createQuestionReading({ question: "这次面试能过吗", feeProof: proof() }),
      /付款凭证已用于/);
    const q = await f.question.createQuestionReading({ question: "这次面试能过吗", feeProof: proof(2) });
    await assert.rejects(create(f, 2), /付款凭证已用于/);
    const second = await create(f, 3, "destiny");
    await assert.rejects(create(f, 3), /付款凭证已用于/);
    assert.notEqual(q.id, first.id);
    assert.notEqual(second.id, first.id);
    // 同一目录新 store 实例验证持久化付款索引。
    const { ReadingStore } = await import("../src/sanyi/store.js");
    assert.equal(await new ReadingStore(f.root).claimPayment(proof().transactionHash, "unused"), first.id);
    // 核验拒绝时，即使排盘模块依赖抛错，也必须优先返回付款错误。
    const { BaziReadingService } = await import("../src/sanyi/bazi-reading-service.js");
    let modelCalls = 0;
    const denied = new BaziReadingService({ store: f.store, clock: () => new Date("2026-10-06T13:00:00Z"),
      logger: { write: async () => {} }, feeVerifier: { verify: async () => {
        throw new Error("付款核验拒绝");
      } }, provider: { ...new MockSchoolsProvider(), generateStructured: async <T>() => {
        modelCalls += 1;
        return {} as T;
      } } });
    await assert.rejects(denied.create({ kind: "fortune", question: "运势如何", birth: {},
      sect: 1, horizon: "year", feeProof: proof(4) }), /付款核验拒绝/);
    assert.equal(modelCalls, 0);
  } finally {
    await f.close();
  }
});
test("三家并行、一家失败隔离，免费重试最多两次", { timeout: 2_000 }, async () => {
  const mock = new MockSchoolsProvider();
  let fail = true;
  let started = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await baziFixture({ ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
    started += 1;
    if (started === 3) {
      release();
    }
    await gate;
    if (fail && request.taskId.endsWith("yuchuntai")) {
      throw new Error("供应商失败");
    }
    return mock.generateStructured<T>(request);
  } });
  try {
    const r = await create(f);
    assert.equal(started, 3);
    assert.equal(r.status, "done");
    assert.equal(r.schools.yuchuntai.status, "failed");
    assert.equal(r.schools.shenxiaozhan.status, "done");
    assert.equal(r.schools.rentieqiao.status, "done");
    assert.equal(yearConsensus(r)[0]?.count, 2);
    await f.bazi.retrySchool(r.id, "yuchuntai");
    await f.bazi.whenSettled(r.id);
    fail = false;
    await f.bazi.retrySchool(r.id, "yuchuntai");
    await f.bazi.whenSettled(r.id);
    assert.equal((await f.bazi.getReading(r.id)).schools.yuchuntai.status, "done");
    assert.equal(f.calls.payments, 1);
    await assert.rejects(f.bazi.retrySchool(r.id, "yuchuntai"), /不可重试/);
  } finally {
    release();
    await f.close();
  }
});
test("全失败免费重试限额，合议每年 null", async () => {
  const mock = new MockSchoolsProvider();
  const f = await baziFixture({ ...mock, generateStructured: async () => {
    throw new Error("失败");
  } });
  try {
    const r = await create(f);
    assert.deepEqual(yearConsensus(r), Array(10).fill(null));
    for (let index = 0; index < 2; index += 1) {
      await f.bazi.retrySchool(r.id, "yuchuntai");
      await f.bazi.whenSettled(r.id);
    }
    await assert.rejects(f.bazi.retrySchool(r.id, "yuchuntai"), /次数已用尽/);
    assert.equal(f.calls.payments, 1);
  } finally {
    await f.close();
  }
});
test("逐年算术平均保留一位，范围与 count 只含 done，一家也照算", async () => {
  const f = await baziFixture();
  try {
    const r = await create(f);
    for (const [key, value] of [["shenxiaozhan", 7], ["yuchuntai", 5], ["rentieqiao", 7]] as const) {
      const state = r.schools[key];
      if (!state.output || !("years" in state.output)) {
        throw new Error("缺运势输出");
      }
      state.output.years = state.output.years.map((item) => ({ ...item, confidenceTenths: value }));
    }
    assert.deepEqual(yearConsensus(r)[0], { year: 2023, average: 6.3, min: 5, max: 7, count: 3 });
    r.schools.yuchuntai.status = "failed";
    r.schools.rentieqiao.status = "failed";
    assert.deepEqual(yearConsensus(r)[0], { year: 2023, average: 7, min: 7, max: 7, count: 1 });
    r.schools.shenxiaozhan.status = "failed";
    assert.equal(yearConsensus(r)[0], null);
  } finally {
    await f.close();
  }
});
test("换日重传核验四柱，两次免费重跑；并发请求不越限", async () => {
  const f = await baziFixture();
  try {
    const r = await create(f);
    await assert.rejects(f.bazi.changeDayBoundary(r.id, { ...birth, day: 16 }, 2), (error: unknown) => {
      return error instanceof Error && error.message === "生辰与本卦命盘不符" && statusForError(error) === 400;
    });
    await assert.rejects(f.bazi.changeDayBoundary(r.id, { ...birth, gender: "female" }, 2),
      (error: unknown) => error instanceof Error && statusForError(error) === 400
        && error.message === "生辰与本卦命盘不符");
    const changed = await f.bazi.changeDayBoundary(r.id, birth, 2);
    assert.equal(changed.changes, 1);
    await f.bazi.whenSettled(r.id);
    const done = await f.bazi.getReading(r.id);
    assert.equal(done.chart.sect, 2);
    assert.ok(Object.values(done.schools).every((state) => state.status === "done" && state.attempts === 2));
    const both = await Promise.allSettled([
      f.bazi.changeDayBoundary(r.id, birth, 1), f.bazi.changeDayBoundary(r.id, birth, 1),
    ]);
    assert.equal(both.filter((item) => item.status === "fulfilled").length, 1);
    await f.bazi.whenSettled(r.id);
    await assert.rejects(f.bazi.changeDayBoundary(r.id, birth, 2), (error: unknown) => {
      return error instanceof Error && /换日切换次数已用尽/.test(error.message) && statusForError(error) === 409;
    });
    assert.equal(f.calls.payments, 1);
    assert.equal((await f.bazi.getReading(r.id)).changes, 2);
  } finally {
    await f.close();
  }
});
test("晚子时切换日柱，重启后凭派生盘可免费重试，无原始缓存", async () => {
  const f = await baziFixture();
  try {
    const late = { ...birth, year: 2000, month: 11, day: 3, time: { hour: 23, minute: 20 } };
    const r = await f.bazi.create({ kind: "fortune", question: "今年运势如何", birth: late,
      sect: 1, horizon: "year", feeProof: proof() });
    await f.bazi.whenSettled(r.id);
    await f.bazi.changeDayBoundary(r.id, late, 2);
    await f.bazi.whenSettled(r.id);
    assert.notEqual((await f.bazi.getReading(r.id)).chart.pillars.day.ganZhi, r.chart.pillars.day.ganZhi);
    const text = await readFile(join(f.root, "readings", `${r.id}.json`), "utf8");
    assert.ok(!text.includes("23:20"));
    assert.ok(!text.includes("2000-11-03"));
  } finally {
    await f.close();
  }
});
test("旧问事存档原样读出，公开响应按类型区分并附此刻黄历", async () => {
  const f = await baziFixture();
  try {
    const q = await f.question.createQuestionReading({ question: "这次面试能过吗", feeProof: proof() });
    assert.deepEqual(await f.store.read(q.id), q);
    const old = await f.api.getReading(q.id);
    assert.equal(old.kind, "question");
    const destiny = await f.api.createReading({ question: "看看我的八字", birth, feeProof: proof(2) });
    await f.bazi.whenSettled(destiny.id);
    const d = await f.api.getReading(destiny.id);
    assert.equal(d.kind, "destiny");
    assert.ok("almanac" in d && d.almanac);
    assert.ok(!("years" in d) && !("consensusTenths" in d) && !("verdict" in d));
    assert.ok(!JSON.stringify(d).includes('"verdict"'));
    const fortune = await f.api.createReading({ question: "我今年运势如何", birth, feeProof: proof(3) });
    await f.bazi.whenSettled(fortune.id);
    const r = await f.api.getReading(fortune.id);
    assert.equal(r.kind, "fortune");
    if (r.kind !== "fortune") {
      throw new Error("类型错误");
    }
    assert.equal(r.years.length, 10);
    assert.equal(r.consensusTenths, 5);
    assert.deepEqual(r.chart.pillars.time?.ganZhi, "癸未");
    assert.equal((await f.store.read<StoredBaziReading>(r.id)).kind, "fortune");
  } finally {
    await f.close();
  }
});

test("付款前可覆盖分类和范围，问事覆盖不要求生辰，非法范围拒绝", async () => {
  const f = await baziFixture();
  try {
    const q = await f.api.createReading({ question: "我今年运势如何", kind: "question", feeProof: proof() });
    assert.equal(q.kind, "question");
    const r = await f.api.createReading({ question: "这次面试能过吗", kind: "fortune", horizon: "next-year",
      birth, feeProof: proof(2) });
    await f.bazi.whenSettled(r.id);
    const done = await f.api.getReading(r.id);
    assert.equal(done.kind, "fortune");
    if (done.kind !== "fortune") {
      throw new Error("类型不符");
    }
    assert.equal(done.chart.liunian.anchorYear, 2027);
    for (const patch of [{ kind: "bad" }, { horizon: "yesterday" }, { sect: 3 }]) {
      await assert.rejects(f.api.createReading({ question: "我今年运势如何", birth, feeProof: proof(3), ...patch }));
    }
    assert.equal(f.calls.payments, 2);
    await assert.rejects(f.api.changeDayBoundary(r.id, {}), /请先填写生辰/);
    await assert.rejects(f.question.throwCoin(r.id, 1), /此接口只适用于问事/);
    await assert.rejects(f.api.retrySchool(r.id, "chengyi"), /此接口只适用于问事/);
    await assert.rejects(f.api.retrySchool(q.id, "yuchuntai"), /此接口只适用于命理或运势/);
  } finally {
    await f.close();
  }
});

test("缺时辰近似大运也拒绝相反性别换日", async () => {
  const f = await baziFixture();
  try {
    const input = { ...birth, time: null };
    const r = await f.bazi.create({ kind: "fortune", question: "今年运势如何", birth: input, sect: 1, horizon: "year", feeProof: proof() });
    await f.bazi.whenSettled(r.id);
    await assert.rejects(f.bazi.changeDayBoundary(r.id, { ...input, gender: "female" }, 2),
      (error: unknown) => error instanceof Error && statusForError(error) === 400 && error.message === "生辰与本卦命盘不符");
  } finally {
    await f.close();
  }
});
```

- [ ] **Step 2：落入实现。** API 只做生辰格式校验，服务付款核验先于 chartFrom 和模型调用。存档之后后台只捕获派生 reading，不捕获原始请求。失败家不影响另外两家；失败及核对错误落盘使用固定中文，避免模型异常回显敏感数据。免费重试用存档重建事实，无须生辰；换日必须重传生辰，先按存档旧 sect 核对四柱，再按新 sect 重排并三家全部重跑。所问时刻固定为 createdAt，切换时重新按 sect 计算该时刻流日，保留原问题与付款。

```ts
// src/sanyi/bazi-reading-service.ts
import { almanacAt } from "../calendar/almanac.js";
import { buildBaziChart } from "../calendar/bazi.js";
import { analyzeBazi } from "../calendar/bazi-relations.js";
import { lookupQiongtong } from "../calendar/qiongtong.js";
import { correctBirthTime } from "../calendar/solar-time.js";
import type { StructuredOutputProvider } from "../agent/provider.js";
import { normalizeBirthProfile } from "./birth-profile.js";
import { buildBaziFacts } from "./bazi-facts.js";
import { derivedChart } from "./bazi-public.js";
import { runBaziSchool } from "./bazi-school-runner.js";
import { resolveFortuneContext, periodFacts } from "./fortune-context.js";
import type { FortuneHorizon } from "./classify.js";
import type { SanyiFeeProof, SanyiFeeVerifier } from "./fee.js";
import type { SanyiLogger } from "./log.js";
import { LimitExceededError, PaymentAlreadyUsedError, StateConflictError } from "./reading-service.js";
import { SanyiInputError } from "./http-errors.js";
import { BAZI_SCHOOLS } from "./schools/bazi-index.js";
import type { BaziSchool, BaziSchoolInput, BaziSchoolKey } from "./schools/bazi-shared.js";
import { ReadingStore, newReadingId, type BaziSchoolState, type StoredBaziReading,
  type StoredReading } from "./store.js";
interface Dependencies {
  store: ReadingStore;
  provider: StructuredOutputProvider;
  feeVerifier: SanyiFeeVerifier;
  logger: SanyiLogger;
  clock: () => Date;
}
function schools(previous?: StoredBaziReading["schools"]): StoredBaziReading["schools"] {
  function state(key: BaziSchoolKey): BaziSchoolState {
    return { status: "writing", attempts: previous?.[key].attempts ?? 0,
      retries: previous?.[key].retries ?? 0 };
  }
  return { shenxiaozhan: state("shenxiaozhan"), yuchuntai: state("yuchuntai"),
    rentieqiao: state("rentieqiao") };
}
function chartFrom(birth: unknown, sect: 1 | 2, targetYear: number) {
  try {
    const profile = normalizeBirthProfile(birth);
    const corrected = correctBirthTime(profile.civil, profile.timeKnown, profile.longitude,
      { mainlandDst: profile.mainlandDst, birthplace: profile.birthplace });
    const chart = derivedChart(buildBaziChart({ corrected: corrected.effective, gender: profile.gender,
      timeKnown: profile.timeKnown, sect, targetYear }));
    let dst: StoredBaziReading["correction"]["dst"] = "not-applied";
    if (!profile.mainlandDst) {
      dst = "skipped-region";
    } else if (corrected.steps.some((step) => step.kind === "dst" && step.applied)) {
      dst = "applied";
    }
    const solar = corrected.steps.some((step) => step.kind === "solar" && step.applied)
      ? "applied" as const : "not-applied" as const;
    return { chart, correction: { dst, solar, timeKnown: profile.timeKnown, sect } };
  } catch {
    // 校验或底层错误可能包含输入，不把异常原文传播到日志或存档。
    throw new SanyiInputError("生辰格式或排盘口径无效，请检查填写内容");
  }
}
export class BaziReadingService {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly background = new Map<string, Promise<void>>();
  constructor(private readonly deps: Dependencies) {}
  async create(input: {
    kind: "destiny" | "fortune";
    question: string;
    birth: unknown;
    sect: 1 | 2;
    horizon: FortuneHorizon;
    feeProof: SanyiFeeProof;
  }): Promise<StoredBaziReading> {
    // 付款核验先于排盘；API 仅先做请求格式校验，不生成命盘。
    const receipt = await this.deps.feeVerifier.verify(input.feeProof);
    if (receipt.feeUsdc6 !== "50000") {
      throw new SanyiInputError("卦金付款凭证金额不完整");
    }
    const now = this.deps.clock();
    const context = resolveFortuneContext(input.horizon, () => now, input.sect);
    const { chart, correction } = chartFrom(input.birth, input.sect, context.anchorYear);
    const id = newReadingId();
    const existing = await this.deps.store.claimPayment(receipt.transactionHash.toLowerCase(), id);
    if (existing) {
      throw new PaymentAlreadyUsedError(existing);
    }
    const reading: StoredBaziReading = { id, kind: input.kind, question: input.question,
      createdAt: now.toISOString(), payment: { payer: receipt.payer, recipient: receipt.recipient,
        transactionHash: receipt.transactionHash, feeUsdc6: receipt.feeUsdc6 },
      chart, correction, context, analysis: analyzeBazi(chart),
      tiaohou: lookupQiongtong(chart.dayMaster, chart.pillars.month.branch),
      almanac: almanacAt(BigInt(Math.floor(now.getTime() / 1_000))),
      changes: 0, status: "writing", schools: schools() };
    await this.deps.store.write(reading);
    this.start(id, () => this.runAll(reading));
    return reading;
  }
  async readAny(id: string): Promise<StoredReading> {
    return this.deps.store.read<StoredReading>(id);
  }
  async getReading(id: string): Promise<StoredBaziReading> {
    const reading = await this.deps.store.read<StoredReading>(id);
    if (reading.kind === "question") {
      throw new StateConflictError("此接口只适用于命理或运势");
    }
    return reading;
  }
  async whenSettled(id: string): Promise<void> {
    await (this.background.get(id) ?? Promise.resolve());
  }
  private async lock<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const result = previous.catch(() => {}).then(action);
    const tail = result.then(() => {}, () => {});
    this.queues.set(id, tail);
    try {
      return await result;
    } finally {
      if (this.queues.get(id) === tail) {
        this.queues.delete(id);
      }
    }
  }
  async changeDayBoundary(id: string, birth: unknown, sect: 1 | 2): Promise<StoredBaziReading> {
    return this.lock(id, async () => {
      const current = await this.getReading(id);
      if (current.changes >= 2) {
        throw new LimitExceededError("换日切换次数已用尽");
      }
      const writing = Object.values(current.schools).some((state) => state.status === "writing");
      if (current.status !== "done" || writing) {
        throw new StateConflictError("三家尚未全部落笔，请稍后切换换日口径");
      }
      if (sect === current.chart.sect || (sect !== 1 && sect !== 2)) {
        throw new SanyiInputError("请选择另一种换日口径");
      }
      const original = chartFrom(birth, current.chart.sect, current.context.anchorYear).chart;
      const signature = (chart: typeof original) => {
        return { pillars: Object.values(chart.pillars).map((pillar) => pillar?.ganZhi ?? null),
          luck: chart.luck === null ? null : { direction: chart.luck.direction, start: chart.luck.start } };
      };
      if (JSON.stringify(signature(original)) !== JSON.stringify(signature(current.chart))) {
        throw new SanyiInputError("生辰与本卦命盘不符");
      }
      const { chart, correction } = chartFrom(birth, sect, current.context.anchorYear);
      // 所问时刻保持创建时刻，today 的流日按新 sect 重算，不漂移到切换当天。
      const context = resolveFortuneContext(current.context.horizon, () => new Date(current.createdAt), sect);
      const updated: StoredBaziReading = { ...current, chart, correction, context,
        analysis: analyzeBazi(chart), tiaohou: lookupQiongtong(chart.dayMaster, chart.pillars.month.branch),
        changes: current.changes + 1, status: "writing", schools: schools(current.schools) };
      await this.deps.store.write(updated);
      this.start(id, () => this.runAll(updated));
      return updated;
    });
  }
  async retrySchool(id: string, key: BaziSchoolKey): Promise<StoredBaziReading> {
    return this.lock(id, async () => {
      const current = await this.getReading(id);
      const state = current.schools[key];
      if (!state || state.status !== "failed" || current.status !== "done") {
        throw new StateConflictError("此家当前状态不可重试");
      }
      if (state.retries >= 2) {
        throw new LimitExceededError("此家重试次数已用尽");
      }
      const school = BAZI_SCHOOLS.find((item) => item.key === key);
      if (!school) {
        throw new SanyiInputError("三家键无效");
      }
      const updated = await this.deps.store.update<StoredBaziReading>(id, (reading) => ({ ...reading,
        status: "writing", schools: { ...reading.schools,
          [key]: { status: "writing", attempts: state.attempts, retries: state.retries + 1 } } }));
      this.start(id, async () => {
        await this.runOne(updated, school);
        await this.finish(id);
      });
      return updated;
    });
  }
  private input(reading: StoredBaziReading, school: BaziSchool): BaziSchoolInput & { school: BaziSchool } {
    return { school, kind: reading.kind, question: reading.question, horizon: reading.context.horizon,
      chart: reading.chart, facts: buildBaziFacts(reading.chart, reading.analysis, reading.tiaohou),
      tiaohou: reading.tiaohou,
      period: { label: reading.context.label, facts: periodFacts(reading.context, reading.chart) } };
  }
  private async runOne(reading: StoredBaziReading, school: BaziSchool): Promise<void> {
    const result = await runBaziSchool({ provider: this.deps.provider }, this.input(reading, school));
    await this.deps.store.update<StoredBaziReading>(reading.id, (current) => {
      const old = current.schools[school.key];
      const state: BaziSchoolState = { status: result.status,
        attempts: old.attempts + result.calls, retries: old.retries };
      if (result.status === "done") {
        state.output = result.output;
      } else {
        // 错误详情可能含模型回显；落盘只用固定中文说明。
        state.error = "此家解读失败，可免费重试";
      }
      return { ...current, schools: { ...current.schools, [school.key]: state } };
    });
  }
  private async runAll(reading: StoredBaziReading): Promise<void> {
    await Promise.all(BAZI_SCHOOLS.map((school) => this.runOne(reading, school)));
    await this.finish(reading.id);
  }
  private async finish(id: string): Promise<void> {
    await this.deps.store.update<StoredBaziReading>(id, (reading) => ({ ...reading, status: "done" }));
    await this.deps.logger.write("八字三家落笔完成", { readingId: id });
  }
  private start(id: string, operation: () => Promise<void>): void {
    const task = operation().catch(async () => {
      try {
        await this.deps.store.update<StoredBaziReading>(id, (reading) => ({ ...reading, status: "failed" }));
        await this.deps.logger.write("八字编排失败", { readingId: id });
      } catch {
        // 存储和日志异常不得产生未处理拒绝，也不得回显生辰。
      }
    });
    this.background.set(id, task);
    void task.then(() => {
      if (this.background.get(id) === task) {
        this.background.delete(id);
      }
    });
  }
}
```

- [ ] **Step 3：B5b 接口落入后重跑上述测试，预期 9 项通过。** 三家均终止即 reading.done，包括全失败；家状态分别保留 failed 供免费重试，公开合议排除它们。

## Chunk B5b：统一接口、HTTP 安全、隐私验收与排练

B6 使用 `src/sanyi/api.ts` 导出的公开判别联合；不读取服务端存档结构。此块只为旧问事前端保留显式 question 类型别名，不提前实现八字页面；B6 需从 AnyPublicReading 按 kind 分流，不能把八字响应传给问事组件。

### Task B5.4：类型入口与公开响应

**文件：** 修改 `src/sanyi/api.ts`、`tests/sanyi-api.test.ts`、`tests/sanyi-store.test.ts`、`web/lib/api.ts`。

- [ ] **Step 1：先运行 B5.3 入口、覆盖分类及公开响应测试，对旧 API 预期失败。** 命理/运势缺生辰中文 400「请先填写生辰」；非法生辰不付款；kind/horizon 支持付款前覆盖，改问事不要求生辰。未开放类型保留原建议和行为。
- [ ] **Step 2：精确应用以下修改。** 生辰仅格式化校验，不在 API 排盘。命理运势由已配置的八字服务承担，命理与运势不再使用 NotOpenYetError；服务器实际启动总会注入八字服务。getReading 读取 kind 分流，三家重试键按家与类型匹配；新增 changeDayBoundary 接口，不接付款参数。此刻黄历来自创建时的注入时钟，与出生时刻无关。

修改 `src/sanyi/api.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/src/sanyi/api.ts
+++ b/src/sanyi/api.ts
@@ -5,19 +5,26 @@
 import { ARC_CHAIN_ID, USDC_TOKEN_ADDRESS } from "../frontend/wallet.js";
 import { feeRecipientFromEnv, FEE_USDC6, type SanyiFeeProof } from "./fee.js";
 import { classifyQuestion } from "./classify.js";
-import { NotFoundError, NotOpenYetError, SanyiInputError } from "./http-errors.js";
+import { NotFoundError, SanyiInputError } from "./http-errors.js";
 import type { ReadingService } from "./reading-service.js";
 import type { QuestionSchoolKey } from "./schools/index.js";
-import type { StoredReading } from "./store.js";
+import type { StoredQuestionReading as StoredReading } from "./store.js";
+import type { StoredReading as AnyStoredReading } from "./store.js";
+import { normalizeBirthProfile } from "./birth-profile.js";
+import { overrideClassification, type FortuneHorizon, type QuestionKind } from "./classify.js";
+import type { BaziReadingService } from "./bazi-reading-service.js";
+import { publicBaziReading, type PublicBaziReading } from "./bazi-public.js";
+import type { BaziSchoolKey } from "./schools/bazi-shared.js";
 type ServiceBoundary = Pick<
   ReadingService,
   "createQuestionReading" | "throwCoin" | "getReading" | "retrySchool" | "changeSubject"
 >;
 type SubjectKey = StoredReading["subject"]["finalKey"];
-export interface PublicReading extends Omit<StoredReading, "payment" | "schools"> {
+export interface PublicQuestionReading extends Omit<StoredReading, "payment" | "schools"> {
   payment: { firstHash: StoredReading["payment"]["transactionHash"] };
   schools: Record<QuestionSchoolKey, Omit<StoredReading["schools"][QuestionSchoolKey], "attempts">>;
 }
+export type PublicReading = PublicQuestionReading | PublicBaziReading;
 export interface PaymentConfiguration {
   recipient: Address;
   amountUsdc6: string;
@@ -31,8 +38,9 @@
   createReading(input: unknown): Promise<PublicReading>;
   throwCoin(id: string, input: unknown): Promise<StoredReading["throws"][number]>;
   getReading(id: string): Promise<PublicReading>;
-  retrySchool(id: string, key: QuestionSchoolKey): Promise<PublicReading>;
+  retrySchool(id: string, key: QuestionSchoolKey | BaziSchoolKey): Promise<PublicReading>;
   changeSubject(id: string, input: unknown): Promise<PublicReading>;
+  changeDayBoundary(id: string, input: unknown): Promise<PublicReading>;
 }
 function record(value: unknown): Record<string, unknown> {
   if (!value || typeof value !== "object" || Array.isArray(value)) {
@@ -74,7 +82,7 @@
   }
   return { payer: getAddress(proof.payer), transactionHash: proof.transactionHash as `0x${string}` };
 }
-function publicReading(reading: StoredReading): PublicReading {
+function publicReading(reading: StoredReading): PublicQuestionReading {
   const school = (key: QuestionSchoolKey) => {
     const { attempts: _attempts, ...visible } = reading.schools[key];
     return visible;
@@ -101,7 +109,7 @@
 }
 export function createSanyiApi(
   service: ServiceBoundary,
-  options: { now?: () => Date; recipient?: Address } = {},
+  options: { now?: () => Date; recipient?: Address; bazi?: BaziReadingService } = {},
 ): SanyiApi {
   const clock = options.now ?? (() => new Date());
   let cache: { createdAt: number; value: ReturnType<typeof almanacAt> } | undefined;
@@ -124,9 +132,34 @@
     },
     async createReading(input) {
       const body = record(input);
-      const classification = classifyQuestion(questionFrom(body));
+      let classification = classifyQuestion(questionFrom(body));
+      try {
+        classification = overrideClassification(classification, {
+          ...(body.kind === undefined ? {} : { kind: body.kind as QuestionKind }),
+          ...(body.horizon === undefined ? {} : { horizon: body.horizon as FortuneHorizon }),
+        });
+      } catch {
+        throw new SanyiInputError("问题类型或时间范围无效");
+      }
       if (classification.kind === "destiny" || classification.kind === "fortune") {
-        throw new NotOpenYetError("命理与运势将在下一阶段开放，可先改为问事");
+        if (body.birth === undefined || body.birth === null) {
+          throw new SanyiInputError("请先填写生辰");
+        }
+        try {
+          normalizeBirthProfile(body.birth);
+        } catch {
+          throw new SanyiInputError("生辰格式无效，请检查填写内容");
+        }
+        const sect = body.sect ?? 1;
+        if (sect !== 1 && sect !== 2) {
+          throw new SanyiInputError("换日口径须为 1 或 2");
+        }
+        if (!options.bazi) {
+          throw new Error("八字服务尚未配置");
+        }
+        return publicBaziReading(await options.bazi.create({ kind: classification.kind,
+          question: classification.question, birth: body.birth, sect,
+          horizon: classification.horizon ?? "year", feeProof: feeProofFrom(body.feeProof) }));
       }
       if (classification.kind !== "question") {
         throw new SanyiInputError(classification.suggestion ?? "请改为一件具体的事来问");
@@ -134,6 +167,7 @@
       const subjectKey = subjectFrom(body.subjectKey);
       const reading = await service.createQuestionReading({
         question: classification.question,
+        ...(body.kind === "question" ? { kind: "question" as const } : {}),
         feeProof: feeProofFrom(body.feeProof),
         ...(subjectKey === undefined ? {} : { subjectKey }),
       });
@@ -147,10 +181,39 @@
       return notFound(() => service.throwCoin(id, index));
     },
     async getReading(id) {
-      return publicReading(await notFound(() => service.getReading(id)));
+      const reading = await notFound(async (): Promise<AnyStoredReading> => {
+        if (options.bazi) {
+          // 共用 store 读取判别，问事仍走原服务，不重新排盘或调用模型。
+          return options.bazi.readAny(id);
+        }
+        return service.getReading(id);
+      });
+      return reading.kind === "question" ? publicReading(reading) : publicBaziReading(reading);
     },
     async retrySchool(id, key) {
+      if (key === "shenxiaozhan" || key === "yuchuntai" || key === "rentieqiao") {
+        if (!options.bazi) {
+          throw new SanyiInputError("八字服务尚未配置");
+        }
+        return publicBaziReading(await notFound(() => options.bazi!.retrySchool(id, key)));
+      }
       return publicReading(await notFound(() => service.retrySchool(id, key)));
+    },
+    async changeDayBoundary(id, input) {
+      const body = record(input);
+      if (body.birth === undefined || body.birth === null) {
+        throw new SanyiInputError("请先填写生辰");
+      }
+      if (body.sect !== 1 && body.sect !== 2) {
+        throw new SanyiInputError("换日口径须为 1 或 2");
+      }
+      if (!options.bazi) {
+        throw new SanyiInputError("八字服务尚未配置");
+      }
+      const changed = await notFound(() => {
+        return options.bazi!.changeDayBoundary(id, body.birth, body.sect as 1 | 2);
+      });
+      return publicBaziReading(changed);
     },
     async changeSubject(id, input) {
       const subjectKey = subjectFrom(record(input).subjectKey);
```

修改 `tests/sanyi-api.test.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/tests/sanyi-api.test.ts
+++ b/tests/sanyi-api.test.ts
@@ -5,10 +5,9 @@
 import { createSanyiApi } from "../src/sanyi/api.js";
 import {
   NotFoundError,
-  NotOpenYetError,
   SanyiInputError,
 } from "../src/sanyi/http-errors.js";
-import type { StoredReading } from "../src/sanyi/store.js";
+import type { StoredQuestionReading as StoredReading } from "../src/sanyi/store.js";
 const ID = "abcdefghijklmnopqrstuvwxyz";
 const PROOF: SanyiFeeProof = {
   payer: `0x${"11".repeat(20)}`,
@@ -96,12 +95,12 @@
   );
   await assert.rejects(api.throwCoin(ID, { index: "1" }), SanyiInputError);
 });
-test("命理与运势明确留待下一阶段", async () => {
+test("命理与运势缺生辰先给中文 400", async () => {
   const { api } = fixture();
   for (const question of ["看看我的八字", "我今年运势如何"]) {
     await assert.rejects(api.createReading({ question, feeProof: PROOF }), (error: unknown) => {
-      return error instanceof NotOpenYetError
-        && error.message === "命理与运势将在下一阶段开放，可先改为问事";
+      return error instanceof SanyiInputError
+        && error.message === "请先填写生辰";
     });
   }
 });
@@ -119,6 +118,10 @@
   const text = JSON.stringify(value);
   assert.equal(value.question, "这次面试能过吗");
   assert.equal(value.payment.firstHash, PROOF.transactionHash);
+  assert.equal(value.kind, "question");
+  if (value.kind !== "question") {
+    throw new Error("问事类型不符");
+  }
   assert.equal(value.throws[0]?.blockNumber, "8");
   assert.deepEqual(value.lines, [7, 8, 7, 8, 7, 8]);
   assert.equal(value.castTime, "1790770501");
```

修改 `tests/sanyi-store.test.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/tests/sanyi-store.test.ts
+++ b/tests/sanyi-store.test.ts
@@ -5,7 +5,7 @@
 import { join } from "node:path";
 import test from "node:test";
 import { ReadingStore, isReadingId, newReadingId } from "../src/sanyi/store.js";
-import type { StoredReading } from "../src/sanyi/store.js";
+import type { StoredQuestionReading as StoredReading } from "../src/sanyi/store.js";

 function emptyReading(id = newReadingId()): StoredReading {
   return {
```

修改 `web/lib/api.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/web/lib/api.ts
+++ b/web/lib/api.ts
@@ -5,7 +5,8 @@
 export type PaymentConfiguration = Awaited<ReturnType<SanyiApi["payment"]>>;
 export type NowResponse = Awaited<ReturnType<SanyiApi["now"]>>;
 export type Classification = Awaited<ReturnType<SanyiApi["classify"]>>;
-export type PublicReading = Awaited<ReturnType<SanyiApi["getReading"]>>;
+export type AnyPublicReading = Awaited<ReturnType<SanyiApi["getReading"]>>;
+export type PublicReading = Extract<AnyPublicReading, { kind: "question" }>;
 export type ThrowResult = Awaited<ReturnType<SanyiApi["throwCoin"]>>;
 export interface CreateReadingInput {
   question: string;
```

- [ ] **Step 3：运行 `node --import tsx --test tests/sanyi-api.test.ts tests/sanyi-store.test.ts tests/sanyi-bazi-reading-service.test.ts`，旧问事与新类型全部通过。** `http-errors.ts` 的中文 400 与领域冲突 409 映射原样复用，`log.ts` 不变；新服务严格只传 readingId，不传请求或异常原文。

### Task B5.5：路由与实际启动编排

**文件：** 修改 `src/frontend/server.ts`、`tests/frontend-server.test.ts`。

- [ ] **Step 1：先应用测试片段并运行 `node --import tsx --test tests/frontend-server.test.ts`。** 新路由尚未实现时成功断言 RED；Origin、Content-Type、非法 JSON、8 KiB、非法 id 与中文错误映射同测换日及八字重试路由。测试需允许本机监听；沙箱 EPERM 不算业务 RED 或通过。
- [ ] **Step 2：应用服务端修改。** day-boundary 放在已有 requireSameOrigin/readJsonBody 之后，与所有 POST 共用解析器、8 KiB 上限和统一错误映射；实际启动注入同一 store、logger、feeVerifier，付款索引跨类型共享。问事保留原 2048 token，八字用 4096 token 容纳五分项和十年短评；不安装或更换 provider。

修改 `tests/frontend-server.test.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/tests/frontend-server.test.ts
+++ b/tests/frontend-server.test.ts
@@ -22,6 +22,7 @@
     getReading: async () => reading as never,
     retrySchool: async () => reading as never,
     changeSubject: async () => reading as never,
+    changeDayBoundary: async () => reading as never,
     ...overrides,
   };
 }
@@ -193,3 +194,45 @@
     await close(item);
   }
 });
+
+test("换日与八字重试路由沿用 Origin、JSON、8 KiB 和 id 边界", async () => {
+  const item = await fixture();
+  try {
+    const id = "abcdefghijklmnopqrstuvwxyz";
+    for (const path of [`/api/readings/${id}/day-boundary`, `/api/readings/${id}/schools/yuchuntai/retry`]) {
+      assert.equal((await post(item.base, path, {})).status, 200);
+      assert.equal((await fetch(`${item.base}${path}`, { method: "POST",
+        headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
+      assert.equal((await post(item.base, path, {}, { origin: "https://evil.example" })).status, 403);
+      assert.equal((await post(item.base, path, {}, { "content-type": "text/plain" })).status, 415);
+      assert.equal((await post(item.base, path, "{")).status, 400);
+      assert.equal((await post(item.base, path, "x".repeat(9 * 1_024))).status, 413);
+      assert.equal((await post(item.base, path.replace(id, "bad"), {})).status, 404);
+    }
+  } finally {
+    await close(item);
+  }
+});
+test("换日与八字重试中文错误沿用 400 与 409 映射", async () => {
+  const { SanyiInputError } = await import("../src/sanyi/http-errors.js");
+  const { LimitExceededError } = await import("../src/sanyi/reading-service.js");
+  const item = await fixture(fakeApi({
+    changeDayBoundary: async () => {
+      throw new SanyiInputError("生辰与本卦命盘不符");
+    },
+    retrySchool: async () => {
+      throw new LimitExceededError("此家重试次数已用尽");
+    },
+  }));
+  try {
+    const base = "/api/readings/abcdefghijklmnopqrstuvwxyz";
+    const wrong = await post(item.base, `${base}/day-boundary`, {});
+    assert.equal(wrong.status, 400);
+    assert.deepEqual(await wrong.json(), { error: "生辰与本卦命盘不符" });
+    const limit = await post(item.base, `${base}/schools/yuchuntai/retry`, {});
+    assert.equal(limit.status, 409);
+    assert.deepEqual(await limit.json(), { error: "此家重试次数已用尽" });
+  } finally {
+    await close(item);
+  }
+});
```

修改 `src/frontend/server.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/src/frontend/server.ts
+++ b/src/frontend/server.ts
@@ -16,6 +16,8 @@
 } from "../sanyi/http-errors.js";
 import { createSanyiLogger } from "../sanyi/log.js";
 import { ReadingService, PaymentAlreadyUsedError } from "../sanyi/reading-service.js";
+import { BaziReadingService } from "../sanyi/bazi-reading-service.js";
+import type { BaziSchoolKey } from "../sanyi/schools/bazi-shared.js";
 import type { QuestionSchoolKey } from "../sanyi/schools/index.js";
 import { isReadingId, ReadingStore } from "../sanyi/store.js";
 interface FrontendServerOptions {
@@ -31,7 +33,9 @@
   ".svg": "image/svg+xml",
   ".woff2": "font/woff2",
 };
-const SCHOOL_KEYS = new Set<QuestionSchoolKey>(["chengyi", "jingfang", "shaoyong"]);
+const SCHOOL_KEYS = new Set<QuestionSchoolKey | BaziSchoolKey>([
+  "chengyi", "jingfang", "shaoyong", "shenxiaozhan", "yuchuntai", "rentieqiao",
+]);
 export function resolveStaticPath(publicDir: string, pathname: string): string | null {
   let decoded: string;
   try {
@@ -110,6 +114,7 @@
       const retryRoute = url.pathname.match(
         /^\/api\/readings\/([^/]+)\/schools\/([^/]+)\/retry$/,
       );
+      const boundaryRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/day-boundary$/);
       const subjectRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/subject$/);
       const isApi = url.pathname.startsWith("/api/");
       const writing = request.method === "POST";
@@ -141,7 +146,7 @@
         json(response, 200, await api.throwCoin(throwRoute[1] as string, body));
         return;
       }
-      const retryKey = retryRoute?.[2] as QuestionSchoolKey | undefined;
+      const retryKey = retryRoute?.[2] as QuestionSchoolKey | BaziSchoolKey | undefined;
       if (
         retryRoute
         && request.method === "POST"
@@ -151,6 +156,10 @@
         && SCHOOL_KEYS.has(retryKey)
       ) {
         json(response, 200, await api.retrySchool(retryRoute[1] as string, retryKey));
+        return;
+      }
+      if (boundaryRoute && request.method === "POST" && api && isReadingId(boundaryRoute[1] ?? "")) {
+        json(response, 200, await api.changeDayBoundary(boundaryRoute[1] as string, body));
         return;
       }
       if (subjectRoute && request.method === "POST" && api && isReadingId(subjectRoute[1] ?? "")) {
@@ -190,8 +199,13 @@
 if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
   const publicClient = createArcPublicClient();
   const recipient = feeRecipientFromEnv(process.env);
+  const store = new ReadingStore("data");
+  const logger = createSanyiLogger();
+  const feeVerifier = new ArcFeeVerifier(publicClient, recipient);
+  const bazi = new BaziReadingService({ store, logger, feeVerifier,
+    provider: createDefaultProvider({ maxTokens: 4_096 }), clock: () => new Date() });
   const service = new ReadingService({
-    feeVerifier: new ArcFeeVerifier(publicClient, recipient),
+    feeVerifier,
     blockSource: {
       latest: async () => {
         const block = await publicClient.getBlock({ blockTag: "latest" });
@@ -202,11 +216,12 @@
       },
     },
     provider: createDefaultProvider({ maxTokens: 2_048 }),
-    store: new ReadingStore("data"),
-    logger: createSanyiLogger(),
+    store,
+    logger,
   });
   const port = Number(process.env.FRONTEND_PORT ?? "4173");
-  createFrontendServer({ api: createSanyiApi(service, { recipient }) }).listen(port, "127.0.0.1", () => {
+  const api = createSanyiApi(service, { recipient, bazi });
+  createFrontendServer({ api }).listen(port, "127.0.0.1", () => {
     console.log(`三易服务已启动：http://127.0.0.1:${port}`);
     console.log(`三易收款地址：${recipient}`);
     console.log("问事卦金：0.05 USDC；付款后亲手六掷，三家依同一卦独立落笔");
```

- [ ] **Step 3：同命令回归，预期共 10 项通过；不改安全守卫，不跳过旧测试。**

### Task B5.6：隐私全文扫描与重启重试

**文件：** 新建 `tests/sanyi-bazi-privacy.test.ts`。

- [ ] **Step 1：先写以下测试，对未实现白名单与编排模块运行，确认 RED。** 输入包含不填地点、城市、手填经度及另一组出生日期时间；每组扫描实际存档文件全文、真实日志全文、公开响应 JSON 全文。模型异常回显输入仍不得落盘；服务重启后无需原始生辰可免费重试，switch 仍需重新提交。

```ts
// tests/sanyi-bazi-privacy.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { baziFixture, birth, proof } from "./helpers/bazi-service.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { BaziReadingService } from "../src/sanyi/bazi-reading-service.js";
import { createSanyiLogger } from "../src/sanyi/log.js";
const forbidden = ["1990-05-15", "15:30", "14:30", "乌鲁木齐", "87.6", "2000-11-03", "09:10"];
async function directoryText(path: string): Promise<string> {
  const names = await readdir(path);
  return (await Promise.all(names.map((name) => readFile(join(path, name), "utf8")))).join("\n");
}
test("未填地点、城市、手填经度：存档日志公开 JSON 全文无原始输入串", async () => {
  const f = await baziFixture();
  try {
    const inputs = [birth, { ...birth, city: "乌鲁木齐" }, { ...birth, longitude: 87.6 },
      { ...birth, year: 2000, month: 11, day: 3, time: { hour: 9, minute: 10 }, longitude: 87.6 }];
    for (const [index, value] of inputs.entries()) {
      const r = await f.api.createReading({ question: "我今年运势如何", birth: value, feeProof: proof(index + 1) });
      await f.bazi.whenSettled(r.id);
      await f.api.changeDayBoundary(r.id, { birth: value, sect: 2 });
      await f.bazi.whenSettled(r.id);
      const texts = [await directoryText(join(f.root, "readings")), await directoryText(join(f.root, "log")),
        JSON.stringify(await f.api.getReading(r.id))];
      for (const text of texts) {
        for (const word of forbidden) {
          assert.ok(!text.includes(word), `隐私扫描发现：${word}`);
        }
        assert.doesNotMatch(text, /"(?:civil|effective|birthplace|longitude|steps|before|after)"\s*:/);
      }
    }
    const stored = await f.bazi.getReading((await f.api.createReading({ question: "看看我的八字",
      birth: { ...birth, city: "香港" }, feeProof: proof(9) })).id);
    await f.bazi.whenSettled(stored.id);
    assert.equal(stored.correction.dst, "skipped-region");
    assert.equal(stored.correction.solar, "applied");
    assert.ok(stored.chart.luck?.start.solarDate);
  } finally {
    await f.close();
  }
});
test("模型错误回显生辰不会进入存档、日志或公开响应，重启后重试无需生辰", async () => {
  const mock = new MockSchoolsProvider();
  const f = await baziFixture({ ...mock, generateStructured: async () => {
    throw new Error(forbidden.join(" "));
  } });
  try {
    const r = await f.api.createReading({ question: "我今年运势如何", birth, feeProof: proof() });
    await f.bazi.whenSettled(r.id);
    const restarted = new BaziReadingService({ store: f.store, provider: mock,
      clock: () => new Date("2026-10-06T13:00:00Z"), logger: createSanyiLogger(join(f.root, "log")),
      feeVerifier: { verify: async () => {
        throw new Error("免费重试不得核验新付款");
      } } });
    await restarted.retrySchool(r.id, "yuchuntai");
    await restarted.whenSettled(r.id);
    assert.equal((await restarted.getReading(r.id)).schools.yuchuntai.status, "done");
    const texts = [await directoryText(join(f.root, "readings")), await directoryText(join(f.root, "log")),
      JSON.stringify(await f.api.getReading(r.id))];
    for (const text of texts) {
      for (const word of forbidden) {
        assert.ok(!text.includes(word));
      }
    }
    assert.equal(f.calls.payments, 1);
  } finally {
    await f.close();
  }
});
```

- [ ] **Step 2：使用 B5a/B5.4 的派生白名单与固定中文失败说明，运行 `node --import tsx --test tests/sanyi-bazi-privacy.test.ts`，预期 2 项通过。** 不因全文扫描而删起运年月日或交运日期；可反推局限已在 B5a 写明，并由 B6 告知覆盖。

### Task B5.7：mock 排练追加运势与一次免费换日

**文件：** 修改 `scripts/rehearse-demo.ts`、`tests/sanyi-rehearsal.test.ts`。

- [ ] **Step 1：先应用排练测试修改，运行 `node --import tsx --test tests/sanyi-rehearsal.test.ts`，新 summary.bazi 尚不存在时 RED。** 保留原问事断言，新增命例四柱、2023–2032 窗口、三家 done、十项合议、sect=2、切换一次、总付款两笔的完整断言。

修改 `tests/sanyi-rehearsal.test.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/tests/sanyi-rehearsal.test.ts
+++ b/tests/sanyi-rehearsal.test.ts
@@ -10,3 +10,14 @@
   assert.equal(summary.schools.map((item) => item.name).join("、"), "程颐、京房、邵雍");
   assert.equal(Number.isFinite(summary.consensusTenths), true);
 });
+
+test("mock 排练追加十年运势与免费换日，只有两笔付款", async () => {
+  const summary = await runRehearsal();
+  assert.deepEqual(summary.bazi.pillars, ["庚午", "辛巳", "庚辰", "癸未"]);
+  assert.deepEqual(summary.bazi.window, [2023, 2032]);
+  assert.deepEqual(summary.bazi.schools, ["done", "done", "done"]);
+  assert.equal(summary.bazi.years, 10);
+  assert.equal(summary.bazi.sectAfterSwitch, 2);
+  assert.equal(summary.bazi.changes, 1);
+  assert.equal(summary.payments, 2);
+});
```

- [ ] **Step 2：应用排练修改，命理使用同一付款核验纯函数与 mock provider。** 问事先做完一卦，运势再用另一交易哈希；固定 2026-10-06 21:00 北京时间，出生地点不填。免费换日后检查三家 attempts 从 1 到 2、均 done，并比较付款计数不变。

修改 `scripts/rehearse-demo.ts`（精确旧片段 → 新片段，上下文排版保留）：

```diff
--- a/scripts/rehearse-demo.ts
+++ b/scripts/rehearse-demo.ts
@@ -3,6 +3,9 @@
 import { tmpdir } from "node:os";
 import { join, resolve } from "node:path";
 import { pathToFileURL } from "node:url";
+import assert from "node:assert/strict";
+import { BaziReadingService } from "../src/sanyi/bazi-reading-service.js";
+import { publicBaziReading } from "../src/sanyi/bazi-public.js";
 import type { SanyiFeeProof } from "../src/sanyi/fee.js";
 import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
 import { createSanyiLogger } from "../src/sanyi/log.js";
@@ -22,17 +25,34 @@
     confidenceTenths: number;
   }>;
   consensusTenths: number;
+  payments: number;
+  bazi: {
+    pillars: (string | null)[];
+    window: number[];
+    schools: string[];
+    years: number;
+    sectAfterSwitch: number;
+    changes: number;
+  };
 }
 export async function runRehearsal(): Promise<RehearsalSummary> {
   const root = await mkdtemp(join(tmpdir(), "sanyi-rehearsal-"));
   let height = 0n;
+  let payments = 0;
   try {
     const proof: SanyiFeeProof = {
       payer: `0x${"11".repeat(20)}`,
       transactionHash: `0x${"22".repeat(32)}`,
     };
+    const store = new ReadingStore(root);
+    const logger = createSanyiLogger(join(root, "log"));
+    const provider = new MockSchoolsProvider();
+    const feeVerifier = { verify: async (value: SanyiFeeProof) => {
+      payments += 1;
+      return mockSingleFeeReceipt(value);
+    } };
     const service = new ReadingService({
-      feeVerifier: { verify: async (value) => mockSingleFeeReceipt(value) },
+      feeVerifier,
       blockSource: {
         latest: async () => {
           height += 1n;
@@ -43,9 +63,9 @@
           };
         },
       },
-      provider: new MockSchoolsProvider(),
-      store: new ReadingStore(root),
-      logger: createSanyiLogger(join(root, "log")),
+      provider,
+      store,
+      logger,
       waitOptions: { pollMs: 1, timeoutMs: 100, sleep: async () => {} },
     });
     const created = await service.createQuestionReading({
@@ -74,7 +94,37 @@
         confidenceTenths: state.output.confidenceTenths,
       };
     });
+    const baziService = new BaziReadingService({ store, provider, logger, feeVerifier,
+      clock: () => new Date("2026-10-06T21:00:00+08:00") });
+    const birth = { calendar: "solar", isLeapMonth: false, year: 1990, month: 5, day: 15,
+      time: { hour: 15, minute: 30 }, gender: "male" };
+    const fortune = await baziService.create({ kind: "fortune", question: "我今年运势如何",
+      birth, sect: 1, horizon: "year", feeProof: { ...proof, transactionHash: `0x${"44".repeat(32)}` } });
+    await baziService.whenSettled(fortune.id);
+    const before = await baziService.getReading(fortune.id);
+    const pillars = Object.values(before.chart.pillars).map((pillar) => pillar?.ganZhi ?? null);
+    const window = [before.chart.liunian.years[0]!.year, before.chart.liunian.years.at(-1)!.year];
+    assert.deepEqual(pillars, ["庚午", "辛巳", "庚辰", "癸未"]);
+    assert.deepEqual(window, [2023, 2032]);
+    assert.ok(Object.values(before.schools).every((state) => state.status === "done"));
+    const publicBefore = publicBaziReading(before);
+    assert.equal(publicBefore.kind, "fortune");
+    if (publicBefore.kind !== "fortune") {
+      throw new Error("排练类型不符");
+    }
+    assert.equal(publicBefore.years.length, 10);
+    const paymentsBeforeSwitch = payments;
+    await baziService.changeDayBoundary(fortune.id, birth, 2);
+    await baziService.whenSettled(fortune.id);
+    const after = await baziService.getReading(fortune.id);
+    assert.equal(after.chart.sect, 2);
+    assert.equal(after.changes, 1);
+    assert.ok(Object.values(after.schools).every((state) => state.status === "done" && state.attempts === 2));
+    assert.equal(payments, paymentsBeforeSwitch);
     return {
+      payments,
+      bazi: { pillars, window, schools: Object.values(after.schools).map((state) => state.status),
+        years: publicBefore.years.length, sectAfterSwitch: after.chart.sect, changes: after.changes },
       status: "done",
       primary: five.primary.name,
       derived: five.derived.name,
@@ -98,6 +148,9 @@
       console.log(`${school.name}：${school.verdict}，${school.confidenceTenths}成`);
     }
     console.log(`合议平均：约${summary.consensusTenths.toFixed(1)}成`);
+    console.log(`运势四柱：${summary.bazi.pillars.join(" ")}；窗口：${summary.bazi.window.join("–")}`);
+    console.log(`三家已完成，逐年合议 ${summary.bazi.years} 项；免费换日后重跑完成`);
+    console.log(`付款共 ${summary.payments} 笔，换日未新增付款`);
   } catch (error) {
     console.error(error instanceof Error ? error.message : String(error));
     process.exitCode = 1;
```

- [ ] **Step 3：运行 `node --import tsx --test tests/sanyi-rehearsal.test.ts`，预期 2 项通过；再运行 `node --import tsx scripts/rehearse-demo.ts --mode=mock`，预期四柱与窗口正确、共两笔付款、换日无新增付款。**

### Task B5.8：交叉验收与全量回归

- [ ] **Step 1：运行 B1–B5 所有新增测试和上述已修改测试，使用文末验证命令。** 各范围事实、旧存档、两类公开 shape、并发隔离、隐私全文扫描必须有真实断言。
- [ ] **Step 2：运行项目 typecheck 及 skipLibCheck=false 的代码块严格类型检查。** 禁止靠前端未使用八字页而忽略服务端联合类型。
- [ ] **Step 3：运行 `npm test`，回归 1A 全部测试，保留监听端口测试；记录实际失败原因。**
- [ ] **Step 4：逐项核对六份相关 spec delta 与计划任务状态。** 本轮隔离演练不是工作区实施，所有实施步骤保持未勾，OpenSpec 仍不勾；生辰本机保存、表单告知、八字结果页属于 B6，B5 不宣称整份 1B 已实现。

## Chunk B6a：生辰表单与付款前补问

以已确认样稿与 birth-profile、unified-question-entry 为准。继续使用 1A 的 PaymentButton 与 useFeePayment；只扩大请求数据和补问入口，不改转账、钱包确认或付款核验。`Home` 继续组合 QuestionForm，无需重写；最近记录已能存 kind 字符串，无需另造存储版本。

### Task B6.1：本人档案、临时生辰与入口 RED

**文件：** 新建 `web/lib/birth-profile.ts`、`web/lib/birth-entry.ts`、`web/components/BirthForm.tsx`、`web/components/BirthEntry.tsx` 与下列测试；修改 `web/components/QuestionForm.tsx`、`web/components/ClassificationTags.tsx`、`web/components/PaymentButton.tsx`、`web/lib/api.ts`、`tests/frontend-home.test.ts`。

- [ ] **Step 1：只抽出下列两个测试文件，运行 `node --import tsx --test tests/frontend-birth-profile.test.ts tests/frontend-birth-entry.test.ts`。** 模块尚不存在时 RED；测试使用 createElement，不写 JSX，不导入钱包模块。

```ts
// tests/frontend-birth-profile.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_BIRTH, fromBirthInput, loadBirthProfile, toBirthInput, useBirthProfile } from "../web/lib/birth-profile.js";
import { needsBirth, isMissingBirth, entryHorizon } from "../web/lib/birth-entry.js";
import { ApiError } from "../web/lib/api.js";
test("表单与输入互转，非法日期与不存在闰月就地拒绝", () => {
    const birth = toBirthInput(EMPTY_BIRTH);
    assert.deepEqual(toBirthInput(fromBirthInput(birth)), birth);
    assert.throws(() => toBirthInput({ ...EMPTY_BIRTH, month: "2", day: "30" }), /日期/);
    assert.throws(() => toBirthInput({ ...EMPTY_BIRTH, calendar: "lunar", year: "2023", month: "3", isLeapMonth: true }), /闰月不存在/);
    const leap = toBirthInput({ ...EMPTY_BIRTH, calendar: "lunar", year: "2023", month: "2", day: "1", isLeapMonth: true, unknownTime: true });
    assert.equal(leap.time, null);
    assert.deepEqual(toBirthInput(fromBirthInput(leap)), leap);
});
test("存储读写抛错仍返回本次生辰；临时输入不改本人", () => {
    const birth = toBirthInput(EMPTY_BIRTH);
    const broken = { getItem: () => { throw new Error("不可用"); }, setItem: () => { throw new Error("不可用"); } };
    assert.equal(loadBirthProfile(broken), null);
    assert.deepEqual(useBirthProfile(birth, true, broken), birth);
    let saved = "";
    const storage = { getItem: () => saved || null, setItem: (_key: string, value: string) => { saved = value; } };
    useBirthProfile(birth, true, storage);
    assert.deepEqual(loadBirthProfile(storage), birth);
    const temporary = { ...birth, gender: "female" as const };
    assert.deepEqual(useBirthProfile(temporary, false, storage), temporary);
    assert.deepEqual(loadBirthProfile(storage), birth);
});
test("付款前命理运势缺档案走表单；400 补问同一路径", () => {
    assert.equal(needsBirth("destiny", null), true);
    assert.equal(needsBirth("fortune", null), true);
    assert.equal(needsBirth("question", null), false);
    assert.equal(needsBirth("fortune", toBirthInput(EMPTY_BIRTH)), false);
    assert.equal(isMissingBirth(new ApiError("请先填写生辰", 400)), true);
    assert.equal(isMissingBirth(new ApiError("请先填写生辰", 503)), false);
});
test("自动识别明年与指定年份不会被今年覆盖", () => {
    assert.equal(entryHorizon("next-year"), "next-year");
    assert.equal(entryHorizon("year:2027"), "custom");
    assert.equal(entryHorizon(undefined), "year");
});
```

```ts
// tests/frontend-birth-entry.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BirthEntry } from "../web/components/BirthEntry.js";
import { isMissingBirth } from "../web/lib/birth-entry.js";
import { ApiError } from "../web/lib/api.js";
const noop = () => { };
test("命理运势缺档案入口展示表单且不挂载付款；400 同样补问", () => {
    let payments = 0;
    for (const kind of ["destiny", "fortune"]) {
        const html = renderToStaticMarkup(createElement(BirthEntry, { kind, birth: null, open: true, temporary: false, onOpen: noop, onBirth: noop, onFallback: noop, onCancel: noop, payment: () => { payments += 1; return "付款"; } }));
        assert.match(html, /填写生辰/);
        assert.match(html, /改为起一卦问事/);
    }
    assert.equal(payments, 0);
    const open = isMissingBirth(new ApiError("请先填写生辰", 400));
    const html = renderToStaticMarkup(createElement(BirthEntry, { kind: "fortune", birth: null, open, temporary: false, onOpen: noop, onBirth: noop, onFallback: noop, onCancel: noop, payment: () => "付款" }));
    assert.match(html, /role="dialog"/);
});
```

### Task B6.2：表单完整实现与接口适配

- [ ] **Step 1：落入下列四个新文件。** 日期、闰月与时间校验复用 B1；城市与经度互斥，34 城来自同一表。本人档案只用一个存储键；临时输入只保留当前状态。localStorage 属性访问也在 try/catch 内，读取失败不阻止本次提交。

```ts
// web/lib/birth-profile.ts
import { normalizeBirthProfile, type BirthProfileInput } from "../../src/sanyi/birth-profile.js";
export type { BirthProfileInput };
export interface BirthFormValues {
    calendar: "solar" | "lunar";
    year: string;
    month: string;
    day: string;
    isLeapMonth: boolean;
    time: string;
    unknownTime: boolean;
    gender: "male" | "female";
    placeMode: "city" | "longitude";
    city: string;
    longitude: string;
}
export const EMPTY_BIRTH: BirthFormValues = {
    calendar: "solar", year: "1990", month: "5", day: "15", isLeapMonth: false,
    time: "15:30", unknownTime: false, gender: "male", placeMode: "city", city: "", longitude: "",
};
export function toBirthInput(values: BirthFormValues): BirthProfileInput {
    const parts = values.time.split(":");
    const input: BirthProfileInput = {
        calendar: values.calendar, year: Number(values.year), month: Number(values.month), day: Number(values.day),
        isLeapMonth: values.calendar === "lunar" && values.isLeapMonth,
        time: values.unknownTime ? null : { hour: Number(parts[0]), minute: Number(parts[1]) }, gender: values.gender,
    };
    if (values.placeMode === "city" && values.city) {
        input.city = values.city;
    }
    if (values.placeMode === "longitude" && values.longitude.trim()) {
        input.longitude = Number(values.longitude);
    }
    normalizeBirthProfile(input);
    return input;
}
export function fromBirthInput(input: BirthProfileInput): BirthFormValues {
    return {
        calendar: input.calendar, year: String(input.year), month: String(input.month), day: String(input.day),
        isLeapMonth: input.isLeapMonth, time: input.time ? `${pad(input.time.hour)}:${pad(input.time.minute)}` : "",
        unknownTime: input.time === null, gender: input.gender,
        placeMode: input.longitude === undefined ? "city" : "longitude", city: input.city ?? "",
        longitude: input.longitude === undefined ? "" : String(input.longitude),
    };
}
function pad(value: number): string {
    return String(value).padStart(2, "0");
}
const KEY = "sanyi.birth.self.v1";
export type BirthStorage = Pick<Storage, "getItem" | "setItem">;
export function loadBirthProfile(storage?: BirthStorage): BirthProfileInput | null {
    try {
        const target = storage ?? globalThis.localStorage;
        const value = JSON.parse(target.getItem(KEY) ?? "null") as BirthProfileInput | null;
        if (!value) {
            return null;
        }
        normalizeBirthProfile(value);
        return toBirthInput(fromBirthInput(value));
    }
    catch {
        return null;
    }
}
export function useBirthProfile(input: BirthProfileInput, remember: boolean, storage?: BirthStorage): BirthProfileInput {
    normalizeBirthProfile(input);
    if (remember) {
        try {
            const target = storage ?? globalThis.localStorage;
            target.setItem(KEY, JSON.stringify(input));
        }
        catch {
            // 记住失败不影响本次排盘。
        }
    }
    return input;
}
export function birthSummary(input: BirthProfileInput): string {
    const time = input.time ? `${pad(input.time.hour)}:${pad(input.time.minute)}` : "不知道时辰";
    let place = input.city ?? "未填出生地";
    if (input.longitude !== undefined) {
        place = `经度 ${input.longitude}°`;
    }
    const leap = input.isLeapMonth ? "闰" : "";
    return `${input.calendar === "solar" ? "公历" : "农历"} ${input.year}-${leap}${pad(input.month)}-${pad(input.day)} ${time} · ${input.gender === "male" ? "男" : "女"} · ${place}`;
}
```

```ts
// web/lib/birth-entry.ts
import { ApiError } from "./api.js";
import type { BirthProfileInput } from "./birth-profile.js";
export function needsBirth(kind: string, birth: BirthProfileInput | null): boolean {
    return (kind === "destiny" || kind === "fortune") && birth === null;
}
export function isMissingBirth(error: unknown): boolean {
    return error instanceof ApiError && error.status === 400 && error.message === "请先填写生辰";
}
export function entryHorizon(horizon?: string): string {
    const value = horizon ?? "year";
    return value.startsWith("year:") ? "custom" : value;
}
```

```tsx
// web/components/BirthForm.tsx
import { useState } from "react";
import { readCities } from "../../src/calendar/cities.js";
import { EMPTY_BIRTH, fromBirthInput, toBirthInput, useBirthProfile, type BirthProfileInput, type BirthFormValues } from "../lib/birth-profile.js";
export function BirthForm(props: {
    initial?: BirthProfileInput | null;
    temporary?: boolean;
    onBirth(input: BirthProfileInput): void;
    onFallback(): void;
    onCancel(): void;
}) {
    const [values, setValues] = useState(() => props.initial ? fromBirthInput(props.initial) : EMPTY_BIRTH);
    const [remember, setRemember] = useState(!props.temporary);
    const [error, setError] = useState("");
    function update<K extends keyof BirthFormValues>(key: K, value: BirthFormValues[K]): void {
        setValues((previous) => ({ ...previous, [key]: value }));
    }
    const submit = () => {
        try {
            const input = toBirthInput(values);
            props.onBirth(useBirthProfile(input, remember && !props.temporary));
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "请核对生辰");
        }
    };
    return <section className="panel birth-form" role="dialog" aria-label="填写生辰" aria-modal="false">
    <h2>{props.temporary ? "本次临时换一个生辰" : "本人生辰"}</h2>
    <label>历法<select value={values.calendar} onChange={(event) => update("calendar", event.target.value as BirthFormValues["calendar"])}>
      <option value="solar">公历</option><option value="lunar">农历</option>
    </select></label>
    {values.calendar === "lunar" ? <label><input type="checkbox" checked={values.isLeapMonth} onChange={(event) => update("isLeapMonth", event.target.checked)}/>闰月</label> : null}
    <div className="birth-date">{(["year", "month", "day"] as const).map((key, index) => <label key={key}>{["年", "月", "日"][index]}<input type="number" value={values[key]} onChange={(event) => update(key, event.target.value)}/></label>)}</div>
    <label>时间<input type="time" disabled={values.unknownTime} value={values.time} onChange={(event) => update("time", event.target.value)}/></label>
    <label><input type="checkbox" checked={values.unknownTime} onChange={(event) => update("unknownTime", event.target.checked)}/>不知道时辰</label>
    <label>性别<select value={values.gender} onChange={(event) => update("gender", event.target.value as BirthFormValues["gender"])}><option value="male">男</option><option value="female">女</option></select></label>
    <label>出生地方式<select value={values.placeMode} onChange={(event) => update("placeMode", event.target.value as BirthFormValues["placeMode"])}><option value="city">城市</option><option value="longitude">手填经度</option></select></label>
    {values.placeMode === "city" ? <label>出生城市<select value={values.city} onChange={(event) => update("city", event.target.value)}><option value="">未填出生地</option>{readCities().map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}</select></label> : <label>经度<input type="number" step="0.01" value={values.longitude} onChange={(event) => update("longitude", event.target.value)}/></label>}
    {["香港", "澳门", "台北"].includes(values.city) && values.placeMode === "city" ? <p className="hint">当地历史夏令时不自动校正，请核对出生记录。</p> : null}
    {!props.temporary ? <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}/>记住本人档案（仅本机）</label> : <p>临时生辰不写入本机档案。</p>}
    <p>生辰会发送给解读模型提供方。</p>
    <p>分享结果链接会公开显示命盘（命盘可反推出生日期）。</p>
    <p className="hint">此处校验只为提示，以服务端为准。</p>
    {error ? <p role="alert" className="error">{error}</p> : null}
    <button type="button" onClick={submit}>使用本次生辰</button>
    <button type="button" onClick={props.onFallback}>改为起一卦问事</button>
    <button type="button" onClick={props.onCancel}>取消</button>
  </section>;
}
```

```tsx
// web/components/BirthEntry.tsx
import type { ReactNode } from "react";
import { BirthForm } from "./BirthForm.js";
import { needsBirth } from "../lib/birth-entry.js";
import type { BirthProfileInput } from "../lib/birth-profile.js";
export function BirthEntry(props: {
    kind: string;
    birth: BirthProfileInput | null;
    open: boolean;
    temporary: boolean;
    onOpen(): void;
    onBirth(input: BirthProfileInput): void;
    onFallback(): void;
    onCancel(): void;
    payment(): ReactNode;
}) {
    const missing = needsBirth(props.kind, props.birth);
    return <>
    {props.open ? <BirthForm initial={props.birth} temporary={props.temporary} onBirth={props.onBirth} onFallback={props.onFallback} onCancel={props.onCancel}/> : null}
    {missing ? <button type="button" className="button button-primary" onClick={props.onOpen}>填写生辰后问卦</button> : <div hidden={props.open}>{props.payment()}</div>}
  </>;
}
```

- [ ] **Step 2：按顺序应用下面的精确修改片段。** 此 diff 基于已实施 B5 的隔离目录；B5 的 PublicReading 问事别名保留，get/create/retry 改为公开联合，问事组件稍后显式收窄。BirthEntry 只包八字入口，1A 问事仍直接挂 PaymentButton。收到缺生辰 400 时表单展开，付款组件隐藏但保持挂载，paidProof 在补填前后保留；创建不成功不再调用 pay。改为其它问题或离页则是新的用户动作，不把付款凭证写入生辰档案。

```diff
--- a/web/lib/api.ts
+++ b/web/lib/api.ts
@@ -13,6 +13,8 @@
   kind: Classification["kind"];
   subjectKey?: string;
   horizon?: string;
+  birth?: import("./birth-profile.js").BirthProfileInput;
+  sect?: 1 | 2;
   feeProof: SanyiFeeProof;
 }
 export class ApiError extends Error {
@@ -41,13 +43,15 @@
     getPayment: () => request<PaymentConfiguration>("/api/payment"),
     getNow: () => request<NowResponse>("/api/now"),
     classify: (question: string) => request<Classification>("/api/classify", { question }),
-    createReading: (input: CreateReadingInput) => request<PublicReading>("/api/readings", input),
+    createReading: (input: CreateReadingInput) => request<AnyPublicReading>("/api/readings", input),
     throwCoin: (id: string, index: number) => request<ThrowResult>(`/api/readings/${id}/throws`, { index }),
-    getReading: (id: string) => request<PublicReading>(`/api/readings/${id}`),
-    retrySchool: (id: string, key: QuestionSchoolKey) => request<PublicReading>(
+    getReading: (id: string) => request<AnyPublicReading>(`/api/readings/${id}`),
+    retrySchool: (id: string, key: QuestionSchoolKey | import("../../src/sanyi/schools/bazi-shared.js").BaziSchoolKey) => request<AnyPublicReading>(
       `/api/readings/${id}/schools/${key}/retry`,
       {},
     ),
+    changeDayBoundary: (id: string, birth: import("./birth-profile.js").BirthProfileInput, sect: 1 | 2) =>
+      request<AnyPublicReading>(`/api/readings/${id}/day-boundary`, { birth, sect }),
     changeSubject: (id: string, subjectKey: string) => request<PublicReading>(
       `/api/readings/${id}/subject`,
       { subjectKey },
--- a/web/components/ClassificationTags.tsx
+++ b/web/components/ClassificationTags.tsx
@@ -53,9 +53,7 @@
           ))}
         </div>
       ) : null}
-      {["destiny", "fortune"].includes(view.kind) ? (
-        <p>即将开放，可先改为问事</p>
-      ) : null}
+
       {!view.supported && view.suggestion ? <p>{view.suggestion}</p> : null}
       {view.kind !== "question" ? (
         <button onClick={props.onQuestionFallback} type="button">
--- a/web/components/PaymentButton.tsx
+++ b/web/components/PaymentButton.tsx
@@ -1,23 +1,30 @@
 // web/components/PaymentButton.tsx
 import { truncateAddress } from "../lib/wallet-summary.js";
+import type { BirthProfileInput } from "../lib/birth-profile.js";
+import { isMissingBirth } from "../lib/birth-entry.js";
+import type { SanyiFeeProof } from "../../src/sanyi/fee.js";
 import { useState } from "react";
 import { formatUnits } from "viem";
 import { api, ApiError } from "../lib/api.js";
 import { saveRecentReading } from "../lib/recent-readings.js";
 import { useFeePayment } from "../lib/use-fee-payment.js";
 import type { ClassificationView } from "./ClassificationTags.js";
-export function PaymentButton(props: { question: string; classification: ClassificationView }) {
+export function PaymentButton(props: { question: string; classification: ClassificationView; birth?: BirthProfileInput | null; onMissingBirth?(): void }) {
   const { pay, payment, estimatedGasWei18, connectionMessage } = useFeePayment();
+  const [paidProof, setPaidProof] = useState<SanyiFeeProof>();
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState("");
   const submit = async () => {
     setBusy(true);
     setError("");
     try {
-      const feeProof = await pay();
+      const feeProof = paidProof ?? await pay();
+      setPaidProof(feeProof);
       const reading = await api.createReading({
         question: props.question,
-        kind: "question",
+        kind: props.classification.kind as "question" | "destiny" | "fortune",
+        ...(props.birth ? { birth: props.birth, sect: 1 as const } : {}),
+        ...(props.classification.horizon ? { horizon: props.classification.horizon } : {}),
         ...(props.classification.subjectKey
           ? { subjectKey: props.classification.subjectKey }
           : {}),
@@ -34,6 +41,9 @@
       if (caught instanceof ApiError && caught.status === 409 && caught.readingId) {
         location.hash = `/r/${caught.readingId}`;
         return;
+      }
+      if (isMissingBirth(caught)) {
+        props.onMissingBirth?.();
       }
       setError(caught instanceof Error ? caught.message : "付款未完成，本次没有扣款");
     } finally { setBusy(false); }
--- a/web/components/QuestionForm.tsx
+++ b/web/components/QuestionForm.tsx
@@ -5,6 +5,9 @@
   ClassificationTags,
   type ClassificationView,
 } from "./ClassificationTags.js";
+import { entryHorizon } from "../lib/birth-entry.js";
+import { BirthEntry } from "./BirthEntry.js";
+import { birthSummary, loadBirthProfile, type BirthProfileInput } from "../lib/birth-profile.js";
 import { PaymentButton } from "./PaymentButton.js";
 function fromClassification(value: Classification): ClassificationView {
   const item = value as Classification & { subject?: { label?: string }; horizon?: string };
@@ -19,6 +22,10 @@
   };
 }
 export function QuestionForm() {
+  const [birth, setBirth] = useState<BirthProfileInput | null>(loadBirthProfile);
+  const [birthOpen, setBirthOpen] = useState(false);
+  const [temporary, setTemporary] = useState(false);
+  const [horizon, setHorizon] = useState("year");
   const [question, setQuestion] = useState("");
   const [view, setView] = useState<ClassificationView>();
   const [error, setError] = useState("");
@@ -31,16 +38,24 @@
     const timer = setTimeout(() => {
       setClassifying(true);
       void api.classify(question).then((value) => {
-        if (active) { setView(fromClassification(value)); setError(""); }
+        if (active) {
+          const nextView = fromClassification(value);
+          setView(nextView);
+          setHorizon(entryHorizon(nextView.horizon));
+          setError("");
+        }
       }).catch((caught: unknown) => {
         if (active) setError(caught instanceof Error ? caught.message : "分类暂不可用");
       }).finally(() => { if (active) setClassifying(false); });
     }, 400);
     return () => { active = false; clearTimeout(timer); };
   }, [question, valid]);
-  const changeToQuestion = () => setView({
+  const changeToQuestion = () => {
+    setBirthOpen(false);
+    setView({
     question, kind: "question", supported: true, subjectKey: "peers", subject: "人际／同辈",
-  });
+    });
+  };
   const changeSubject = (subjectKey: string, subject: string) => setView({
     question,
     kind: "question",
@@ -60,6 +75,20 @@
       ...(kind === "fortune" ? { horizon: "year" } : {}),
     });
   };
+  const available = valid && view && ["question", "destiny", "fortune"].includes(view.kind) && view.supported;
+  let payment = <button className="button button-primary" disabled type="button">问卦 · 0.05 USDC</button>;
+  if (available && view) {
+    payment = <BirthEntry kind={view.kind} birth={birth} open={birthOpen} temporary={temporary} onOpen={() => {
+          setTemporary(false);
+          setBirthOpen(true);
+        }} onBirth={(input) => {
+          setBirth(input);
+          setBirthOpen(false);
+        }} onFallback={changeToQuestion} onCancel={() => setBirthOpen(false)} payment={() => <PaymentButton question={question} classification={{ ...view, horizon: horizon === "custom" ? (view.horizon ?? "year:2026") : horizon }} birth={birth} onMissingBirth={() => setBirthOpen(true)} />} />;
+    if (view.kind === "question") {
+      payment = <PaymentButton question={question} classification={view} />;
+    }
+  }
   return (
     <form className="panel" onSubmit={(event) => event.preventDefault()}>
       <h1>所问之事</h1>
@@ -86,12 +115,19 @@
           view={view}
         />
       ) : null}
+      {view?.kind === "fortune" ? <label>时间范围<select aria-label="时间范围" value={horizon} onChange={(event) => setHorizon(event.target.value)}>
+        <option value="today">今天</option><option value="month">本月</option><option value="year">今年</option><option value="next-year">明年</option><option value="custom">指定年份</option>
+      </select></label> : null}
+      {horizon === "custom" ? <label>指定年份<input type="number" min="1900" max="2099" value={view?.horizon?.replace("year:", "") ?? "2026"} onChange={(event) => setView((previous) => previous ? { ...previous, horizon: `year:${event.target.value}` } : previous)} /></label> : null}
+      {view && ["destiny", "fortune"].includes(view.kind) && birth ? <p>{birthSummary(birth)} · <button type="button" onClick={() => {
+          setTemporary(false);
+          setBirthOpen(true);
+        }}>修改</button><button type="button" onClick={() => {
+          setTemporary(true);
+          setBirthOpen(true);
+        }}>本次临时换一个生辰</button></p> : null}
       {error ? <p className="error">{error}</p> : null}
-      {valid && view?.kind === "question" && view.supported ? (
-        <PaymentButton question={question} classification={view} />
-      ) : (
-        <button className="button button-primary" disabled type="button">问卦 · 0.05 USDC</button>
-      )}
+      {payment}
     </form>
   );
 }
--- a/tests/frontend-home.test.ts
+++ b/tests/frontend-home.test.ts
@@ -60,7 +60,8 @@
     }),
   }));
   assert.match(question, /问事.*工作官职/su);
-  assert.match(fortune, /即将开放，可先改为问事/u);
+  assert.doesNotMatch(fortune, /即将开放/u);
+  assert.match(fortune, /改为问事/u);
   assert.match(naming, /可改为问事/u);
   assert.doesNotMatch(question + fortune + naming, forbidden);
 });
```

- [ ] **Step 3：运行两项新测试文件与 `tests/frontend-home.test.ts`，由 RED 转 GREEN。** 静态入口测试付款插槽未调用；首页原防抖、过期响应、未开放类型与问事付款回归仍通过。
- [ ] **Step 4：在允许监听环境补走一次创建 400 → 补生辰 → 创建成功。** 钱包转账计数必须为 1，服务端复用 firstHash，不换收款或金额；真实付款操作见 B7 验收清单。

## Chunk B6b1：流年几何、样稿结构与数据回归

组件只消费 B2.3、B4.7 与 B5 公开字段。样稿 ln-data 仅用于看布局，不复制其三家用神、逐年吉凶或断语。`今年` 使用创建解读时刻的立春年，与 B5 固定卦时一致；所问年用 chart.liunian.anchorYear。分享浏览器不展示原始时刻；有档案还需命盘匹配才能展示本机重算校正。本轮界面直接移植 `docs/plans/assets/2026-10-06-bazi-mockup.html` 的结构、class 与 CSS，真实字段只填数据槽，禁止拷贝样稿断语。

### Task B6.3：几何与静态组件 RED

- [ ] **Step 1：先落下列两个完整测试文件，运行 `node --import tsx --test tests/frontend-liunian-chart.test.ts tests/frontend-bazi-components.test.ts`。** 新模块缺失时 RED；组件测试不导入 Reading、WalletBar、PaymentButton 或 web/lib/wagmi.ts。

```ts
// tests/frontend-liunian-chart.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { CHART, chartGeometry, directLabels, tooltipLeft, xFor, yFor, yearGroups } from "../web/lib/liunian-chart.js";
const value = (year: number, average: number) => ({ year, average, min: average - 1, max: average + 1, count: 3 });
test("一至九成全域、范围线与年内交运位置", () => {
    assert.equal(yFor(1), CHART.bottom);
    assert.equal(yFor(9), CHART.top);
    assert.equal(yFor(5), (CHART.top + CHART.bottom) / 2);
    const geometry = chartGeometry([value(2024, 5)], ["2024-07-02"]);
    assert.equal(geometry.points[0]?.low, yFor(4));
    assert.equal(geometry.points[0]?.high, yFor(6));
    assert.equal(geometry.changes[0]?.x, xFor(0, 1));
    assert.equal(tooltipLeft(-100), CHART.left);
    assert.equal(tooltipLeft(2000), CHART.width - CHART.right - 180);
});
test("空合议断线，无人完成不画零点", () => {
    const geometry = chartGeometry([value(2023, 5), null, value(2025, 6)], [null, null, null]);
    assert.equal(geometry.points[1], null);
    assert.equal(geometry.paths.length, 2);
    assert.ok(geometry.paths.every((path) => !path.includes(" L")));
    assert.deepEqual(chartGeometry([null, null], [null, null]).paths, []);
});
test("少数标注与窄屏规则、回看今年展望分组", () => {
    const years = [value(2023, 4), value(2024, 6), value(2025, 5)];
    assert.deepEqual(directLabels(years, 2024, false), [["回看中最低"], ["今年", "十年最顺"], []]);
    assert.deepEqual(directLabels(years, 2024, true), [[], ["今年", "十年最顺"], []]);
    assert.deepEqual(yearGroups([2023, 2024, 2025, 2026], 2025), [{ label: "回看", count: 2 }, { label: "今年", count: 1 }, { label: "展望", count: 1 }]);
});
```

```ts
// tests/frontend-bazi-components.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { baziFixture, birth as rawBirth, proof } from "./helpers/bazi-service.js";
import { publicBaziReading } from "../src/sanyi/bazi-public.js";
import { BaziLuck } from "../web/components/BaziLuck.js";
import { BaziTable } from "../web/components/BaziTable.js";
import { BirthForm } from "../web/components/BirthForm.js";
import { BaziReading } from "../web/pages/BaziReading.js";
import { LiuNianPanel } from "../web/components/LiuNianPanel.js";
import { DayBoundaryChange } from "../web/components/DayBoundaryChange.js";
import { BAZI_KEYS } from "../web/lib/liunian-chart.js";
const birth = { ...rawBirth, calendar: "solar" as const, gender: "male" as const };
const noop = () => { };
test("缺时柱四柱表显示缺，生辰表单告知与港澳台提示", () => {
    const input = sampleBazi("fortune", false);
    const table = renderToStaticMarkup(createElement(BaziTable, { chart: input.chart, analysis: requireAnalysis(input.chart) }));
    assert.match(table, /时柱/);
    assert.match(table, /<td>缺<\/td>/);
    for (const city of ["香港", "澳门", "台北"]) {
        const form = renderToStaticMarkup(createElement(BirthForm, { initial: { ...birth, city }, onBirth: noop, onFallback: noop, onCancel: noop }));
        assert.match(form, /生辰会发送给解读模型提供方/);
        assert.match(form, /命盘可反推出生日期/);
        assert.match(form, /当地历史夏令时不自动校正/);
    }
});
import { analyzeBazi as requireAnalysis } from "../src/calendar/bazi-relations.js";
test("命理无流年合议，分享不显示原始时刻，无档案切换禁用", async () => {
    const f = await baziFixture();
    try {
        const value = await f.bazi.create({ kind: "destiny", question: "我适合做什么", birth, sect: 1, horizon: "year", feeProof: proof() });
        await f.bazi.whenSettled(value.id);
        const reading = publicBaziReading(await f.bazi.getReading(value.id));
        const html = renderToStaticMarkup(createElement(BaziReading, { reading, birth: null, onReading: noop }));
        assert.doesNotMatch(html, /流年运势|三家合议|合议：|15:30|14:30/);
        assert.match(html, /校正摘要/);
        const local = renderToStaticMarkup(createElement(BaziReading, { reading, birth, onReading: noop }));
        assert.match(local, /15:30/);
        assert.match(local, /14:30/);
        const change = renderToStaticMarkup(createElement(DayBoundaryChange, { reading, birth: null, onReading: noop }));
        assert.match(change, /disabled=""/);
        assert.match(change, /需在填写生辰的设备上切换/);
    }
    finally {
        await f.close();
    }
});
test("流年一家失败不展示，全失败合议破折号且无折线", async () => {
    const f = await baziFixture();
    try {
        const value = await f.bazi.create({ kind: "fortune", question: "今年运势如何", birth, sect: 1, horizon: "year", feeProof: proof() });
        await f.bazi.whenSettled(value.id);
        const stored = await f.bazi.getReading(value.id);
        stored.schools.yuchuntai.status = "failed";
        let reading = publicBaziReading(stored);
        assert.equal(reading.kind, "fortune");
        if (reading.kind !== "fortune") {
            throw new Error("类型错误");
        }
        let html = renderToStaticMarkup(createElement(LiuNianPanel, { reading, currentYear: 2026 }));
        assert.match(html, /未展示/);
        assert.match(html, /虚岁/);
        assert.match(html, /回看/);
        assert.match(html, /甲申→乙酉/);
        assert.ok(!html.includes("[object Object]"));
        for (const key of BAZI_KEYS) {
            stored.schools[key].status = "failed";
        }
        reading = publicBaziReading(stored);
        if (reading.kind !== "fortune") {
            throw new Error("类型错误");
        }
        html = renderToStaticMarkup(createElement(LiuNianPanel, { reading, currentYear: 2026 }));
        assert.match(html, /<td[^>]*>—<\/td>/);
        assert.doesNotMatch(html, /class="ln-line"/);
    }
    finally {
        await f.close();
    }
});
test("起运前不高亮第一步，交运当天切换当前大运", () => {
    const chart = sampleBazi().chart;
    const before = renderToStaticMarkup(createElement(BaziLuck, { chart, currentYear: 1997, currentDate: "1997-08-03" }));
    assert.doesNotMatch(before, /class="now luck-current"/);
    assert.match(before, /当前起运前/);
    const after = renderToStaticMarkup(createElement(BaziLuck, { chart, currentYear: 1997, currentDate: "1997-08-04" }));
    assert.match(after, /class="now luck-current"/);
});
```

```ts
// tests/frontend-bazi-round6.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sampleBazi } from './helpers/sample-bazi.js';
import { analyzeBazi } from '../src/calendar/bazi-relations.js';
import { BaziTable } from '../web/components/BaziTable.js';
import { BaziLuck } from '../web/components/BaziLuck.js';
import { BaziElements } from '../web/components/BaziElements.js';
import { BaziRelations } from '../web/components/BaziRelations.js';
import { directLabels } from '../web/lib/liunian-chart.js';
import { mockBaziSchoolOutput } from '../src/sanyi/mock-bazi-schools.js';
const input = sampleBazi();
const analysis = analyzeBazi(input.chart);
const html = <P extends object>(component: FunctionComponent<P>, props: P) => renderToStaticMarkup(createElement(component, props));
test('四柱沿用样稿七行、日主整列、神煞按柱去重且保留依据', () => {
    const duplicate = { ...analysis, shensha: [...analysis.shensha, ...analysis.shensha] };
    const markup = html(BaziTable, { chart: input.chart, analysis: duplicate });
    assert.match(markup, /class="pillars"/);
    assert.equal(markup.split('<tbody>')[1]?.split('</tbody>')[0]?.match(/<tr>/g)?.length, 7);
    assert.match(markup, /日柱 · 日主/);
    assert.match(markup, /class="gz day"/);
    assert.equal(markup.match(/>天乙贵人</g)?.length, 1);
    assert.match(markup, /title="[^"]+"/);
});
test('大运八步与五行四段，关系图只画地支并按范围三行', () => {
    const luck = html(BaziLuck, { chart: input.chart, currentYear: 2026, currentDate: '2026-10-06' });
    assert.match(luck, /class="luck"/);
    assert.equal(luck.match(/data-cycle=/g)?.length, 8);
    const elements = html(BaziElements, { elements: analysis.elements });
    assert.equal(elements.match(/class="el-bar"/g)?.length, 5);
    assert.equal(elements.match(/data-qi=/g)?.length, 20);
    const relations = html(BaziRelations, { analysis });
    assert.match(relations, /class="rel-svg"/);
    assert.equal(relations.match(/data-node=/g)?.length, 6);
    assert.doesNotMatch(relations, /data-node="[^"]*stem/);
    assert.equal(relations.match(/data-scope=/g)?.length, 3);
});
test('等值并列取最早一年，最低与最顺同年不重复标注', () => {
    const years = [2023, 2024, 2025].map(year => ({ year, average: 5, min: 5, max: 5, count: 3 }));
    assert.deepEqual(directLabels(years, 2024, false), [['十年最顺'], ['今年'], []]);
});
test('mock 三家总断与逐年有差异，锚年与总断一致且短评不超过16字', () => {
    const outputs = ['shenxiaozhan', 'yuchuntai', 'rentieqiao'].map(key => mockBaziSchoolOutput(key as 'shenxiaozhan', input.facts, 'fortune'));
    assert.equal(new Set(outputs.map(o => o.confidenceTenths)).size, 3);
    assert.ok(outputs[0]!.years.some((y, i) => new Set(outputs.map(o => o.years[i]!.confidenceTenths)).size > 1));
    for (const output of outputs) {
        const anchor = output.years.find(y => y.year === 2026)!;
        assert.equal(anchor.confidenceTenths, output.confidenceTenths);
        assert.equal(anchor.verdict, output.verdict);
        for (const year of output.years) {
            assert.ok(year.confidenceTenths >= 3 && year.confidenceTenths <= 7);
            assert.equal(year.verdict, year.confidenceTenths >= 6 ? '吉' : year.confidenceTenths <= 4 ? '凶' : '平');
            assert.ok([...year.note].length <= 16);
        }
    }
});
test('流年2023列只放year关系并按标签去重，表头分组与HTML图层', async () => {
    const { baziFixture, birth, proof } = await import('./helpers/bazi-service.js');
    const { publicBaziReading } = await import('../src/sanyi/bazi-public.js');
    const { LiuNianPanel } = await import('../web/components/LiuNianPanel.js');
    const f = await baziFixture();
    try {
        const value = await f.bazi.create({ kind: 'fortune', question: '今年运势如何', birth, sect: 1, horizon: 'year', feeProof: proof() });
        await f.bazi.whenSettled(value.id);
        const reading = publicBaziReading(await f.bazi.getReading(value.id));
        if (reading.kind !== 'fortune')
            throw new Error('类型错误');
        const markup = html(LiuNianPanel, { reading, currentYear: 2026 });
        const row = markup.split('<th scope="row">合冲刑害</th>')[1]!.split('</tr>')[0]!;
        const first = row.split('</td>')[0]!;
        assert.deepEqual([...first.matchAll(/<span[^>]*>([^<]+)<\/span>/g)].map(m => m[1]).sort(), ['午卯破', '卯辰害', '卯未半合木'].sort());
        assert.match(markup, /class="ln-span"/);
        assert.match(markup, /回看 · 可对照亲历/);
        assert.match(markup, /preserveAspectRatio="none"/);
        assert.match(markup, /vector-effect="non-scaling-stroke"/);
        assert.doesNotMatch(markup, /<text|<circle|class="ln-hit"[^>]*><button/);
        assert.match(markup, /class="ln-detail-rows"/);
    }
    finally {
        await f.close();
    }
});
test('样稿CSS隔离在八字页，大运窄屏四列且文本不随SVG缩放', async () => {
    const { readFile } = await import('node:fs/promises');
    const css = await readFile(new URL('../web/styles/bazi.css', import.meta.url), 'utf8');
    assert.match(css, /\.bazi \.luck\s*\{[^}]*repeat\(8,/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*repeat\(4,/);
    assert.match(css, /\.bazi \.ln-lab\s*\{[^}]*font-size: 12px/);
    assert.match(css, /\.bazi \.pillars td.gz\s*\{[^}]*font-size: 34px/);
    assert.match(css, /\.bazi \.ln-table td.v.ji\s*\{[^}]*box-shadow: inset 3px/);
});
```

### Task B6.4：流年纯函数与交互面板

- [ ] **Step 1：落入下列完整文件。** 对合议 null 切开路径，不连接到零；范围线以公开 min/max 为准。交运位置按公历年内日数，不把日期一律画在年首；表格仍注明流年立春口径。宽屏图的左侧 9% 与表格行名列一致，其余等分年份列；窄屏保留完整图，表格独立滚动，首列 sticky，effect 只滚容器。图点、标注、范围线与读数框全部为 HTML；SVG 只放折线，preserveAspectRatio=none 且描边不缩放。键盘由表头年份按钮承担；悬停图区或聚焦按钮都显示夹在图区内的读数框。逐年关系先 scope=year，再按标签去重。

```ts
// web/lib/liunian-chart.ts
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import type { YearConsensus } from "../../src/sanyi/bazi-public.js";
export const BAZI_NAMES = { shenxiaozhan: "沈孝瞻", yuchuntai: "余春台", rentieqiao: "任铁樵" } as const;
export const BAZI_KEYS = ["shenxiaozhan", "yuchuntai", "rentieqiao"] as const;
export type FortuneReading = Extract<PublicBaziReading, {
    kind: "fortune";
}>;
export const CHART = { width: 1000, height: 260, left: 90, right: 0, top: 25, bottom: 215 };
export function yFor(value: number): number {
    return CHART.bottom - (value - 1) / 8 * (CHART.bottom - CHART.top);
}
export function xFor(index: number, count: number): number {
    return CHART.left + (index + 0.5) * (CHART.width - CHART.left - CHART.right) / Math.max(1, count);
}
export function yearGroups(years: readonly number[], currentYear: number) {
    const groups: {
        label: string;
        count: number;
    }[] = [];
    for (const year of years) {
        let label = "展望";
        if (year < currentYear) {
            label = "回看";
        }
        if (year === currentYear) {
            label = "今年";
        }
        const last = groups.at(-1);
        if (last?.label === label) {
            last.count += 1;
        }
        else {
            groups.push({ label, count: 1 });
        }
    }
    return groups;
}
export function chartGeometry(years: readonly (YearConsensus | null)[], dates: readonly (string | null)[]) {
    const points = years.map((item, index) => {
        if (item === null) {
            return null;
        }
        return { x: xFor(index, years.length), y: yFor(item.average), low: yFor(item.min), high: yFor(item.max) };
    });
    const paths: string[] = [];
    let path = "";
    for (const point of points) {
        if (point === null) {
            if (path) {
                paths.push(path);
            }
            path = "";
        }
        else {
            path += `${path ? " L" : "M"}${point.x},${point.y}`;
        }
    }
    if (path) {
        paths.push(path);
    }
    const changes = dates.flatMap((date, index) => {
        if (!date) {
            return [];
        }
        const year = Number(date.slice(0, 4));
        const start = Date.UTC(year, 0, 1);
        const end = Date.UTC(year + 1, 0, 1);
        const fraction = (Date.parse(`${date}T00:00:00Z`) - start) / (end - start);
        const cell = (CHART.width - CHART.left - CHART.right) / Math.max(1, years.length);
        return [{ date, x: CHART.left + (index + fraction) * cell }];
    });
    return { points, paths, changes };
}
export function directLabels(years: readonly (YearConsensus | null)[], currentYear: number, narrow: boolean) {
    const done = years.filter((year): year is YearConsensus => year !== null);
    const best = [...done].sort((a, b) => b.average - a.average || a.year - b.year)[0];
    const past = done.filter((year) => year.year < currentYear).sort((a, b) => a.average - b.average || a.year - b.year)[0];
    return years.map((year) => {
        const labels: string[] = [];
        if (year?.year === currentYear) {
            labels.push("今年");
        }
        if (year && year.year === best?.year) {
            labels.push("十年最顺");
        }
        if (!narrow && year && year.year === past?.year && past?.year !== best?.year) {
            labels.push("回看中最低");
        }
        return labels;
    });
}
export function tooltipLeft(x: number, width = 180): number {
    return Math.max(CHART.left, Math.min(x - width / 2, CHART.width - CHART.right - width));
}
export function relationClass(kind: string): string {
    if (["三合", "半合", "拱", "三会"].includes(kind)) {
        return "tag group relation-group";
    }
    if (kind === "合") {
        return "tag join relation-join";
    }
    return "tag clash relation-clash";
}
export function schoolYear(reading: FortuneReading, key: typeof BAZI_KEYS[number], year: number) {
    const state = reading.schools[key];
    if (state.status !== "done" || !state.output || !("years" in state.output)) {
        return undefined;
    }
    return state.output.years.find((item) => item.year === year);
}
```

```tsx
// web/components/LiuNianPanel.tsx
import { useEffect, useRef, useState } from "react";
import { BAZI_KEYS, BAZI_NAMES, CHART, chartGeometry, directLabels, relationClass, schoolYear, yearGroups, type FortuneReading } from "../lib/liunian-chart.js";
export function LiuNianPanel({ reading, currentYear }: {
    reading: FortuneReading;
    currentYear: number;
}) {
    const years = reading.chart.liunian.years;
    const [selected, setSelected] = useState(reading.chart.liunian.anchorYear);
    const [hover, setHover] = useState<number | null>(null);
    const scroll = useRef<HTMLDivElement>(null);
    const cells = useRef(new Map<number, HTMLTableCellElement>());
    const geometry = chartGeometry(reading.years, years.map(year => year.luckChange?.date ?? null));
    const labels = directLabels(reading.years, currentYear, false);
    const xp = (x: number) => (x - CHART.left) / (CHART.width - CHART.left) * 100;
    const yp = (y: number) => (y - CHART.top) / (CHART.bottom - CHART.top) * 100;
    const position = (i: number) => `${(i + .5) / years.length * 100}%`;
    useEffect(() => {
        if (window.matchMedia('(min-width: 1061px)').matches)
            return;
        const cell = cells.current.get(selected);
        const container = scroll.current;
        if (cell && container)
            container.scrollLeft = Math.max(0, cell.offsetLeft - 76 - (container.clientWidth - 166) / 2);
    }, [selected]);
    const rows: {
        label: string;
        className?: string;
        render(i: number): React.ReactNode;
    }[] = [
        { label: '流年', className: 'gz', render: i => <>{years[i]?.ganZhi}<small>虚岁 {years[i]?.age}</small></> },
        { label: '十神', render: i => <>{years[i]?.stemGod}<br />{years[i]?.hidden[0]?.god ?? '—'}</> },
        { label: '大运', render: i => { const year = years[i]!; return year.luckChange ? <>{year.luckChange.from ?? '起运前'}→{year.luckChange.to}<small>{year.luckChange.date}</small></> : year.luck?.ganZhi ?? year.luckLabel ?? '—'; } },
        { label: '合冲刑害', className: 'rels', render: i => {
                const relations = reading.analysis.years.find(item => item.year === years[i]?.year)?.relations.filter(item => item.scope === 'year') ?? [];
                return [...new Map(relations.map(item => [item.label, item])).values()].map(item => <span className={relationClass(item.kind)} key={item.label}>{item.label}</span>);
            } },
        ...BAZI_KEYS.map(key => ({ label: BAZI_NAMES[key], className: 'v', render: (i: number) => { const entry = schoolYear(reading, key, years[i]!.year); return entry ? <>{entry.verdict} {entry.confidenceTenths}成</> : '未展示'; } })),
        { label: '合议', render: i => reading.years[i] ? `${reading.years[i]!.average}成` : '—' }
    ];
    const active = years.find(year => year.year === selected)!;
    const hovered = hover === null ? undefined : years[hover];
    const consensus = hover === null ? undefined : reading.years[hover];
    return <section className="panel liunian-panel" aria-label="流年运势"><header className="panel-head"><h2>流年运势</h2><p>以所问之年为锚，流年以立春为界；回看可与亲历对照。缺少断语的年份不连线。</p></header><div className="ln-grid">
 <div className="ln-chart"><div className="ln-y">{[1, 3, 5, 7, 9].map(value => <span style={{ top: `${(9 - value) / 8 * 100}%` }} key={value}>{value}成</span>)}</div>
 <div className="ln-plot" role="img" aria-label={`流年合议走势图，${years[0]?.year}至${years.at(-1)?.year}，纵轴一至九成；完整数值见下表。`}>
 {[3, 5, 7].map(value => <i className={value === 5 ? 'ln-ref' : 'ln-grid-y'} style={{ top: `${(9 - value) / 8 * 100}%` }} key={value}/>)}
 {years.map((year, i) => <div key={year.year}>
 {year.year === currentYear ? <i className="ln-now" style={{ left: `${i / years.length * 100}%`, width: `${100 / years.length}%` }}/> : null}
 {geometry.points[i] ? <><i className="ln-range" style={{ left: position(i), top: `${yp(geometry.points[i]!.high)}%`, height: `${yp(geometry.points[i]!.low) - yp(geometry.points[i]!.high)}%` }}/><i className={`ln-dot ${year.year === currentYear ? 'now' : ''}`} style={{ left: position(i), top: `${yp(geometry.points[i]!.y)}%` }}/>
 {labels[i]?.length ? <span className="ln-lab" style={{ left: position(i), top: `${yp(geometry.points[i]!.y)}%` }}>{labels[i]?.map(label => <span className={label === '回看中最低' ? 'wide-only' : ''} key={label}>{label} {reading.years[i]?.average}成<br /></span>)}</span> : null}</> : null}
 <div className={`ln-hit ${selected === year.year ? 'sel' : ''}`} style={{ left: `${i / years.length * 100}%`, width: `${100 / years.length}%` }} onClick={() => setSelected(year.year)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}/>
 </div>)}
 <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">{geometry.paths.map((path, i) => <path className="ln-line" d={path} transform={`translate(${-CHART.left * CHART.width / (CHART.width - CHART.left)},${-CHART.top * CHART.height / (CHART.bottom - CHART.top)}) scale(${CHART.width / (CHART.width - CHART.left)},${CHART.height / (CHART.bottom - CHART.top)})`} vectorEffect="non-scaling-stroke" key={i}/>)}</svg>
 {geometry.changes.map(change => <i className="ln-yun" style={{ left: `${xp(change.x)}%` }} key={change.date}><span>{change.date} 交运</span></i>)}
 {hovered ? <div className="ln-tip" style={{ left: `${Math.max(26, Math.min(74, (hover! + .5) / years.length * 100))}%`, top: '50%' }}><b>{hovered.year} {hovered.ganZhi}</b><br />{consensus ? `${consensus.average}成 · ${consensus.min}–${consensus.max}成` : '未展示'}</div> : null}
 </div><div className="ln-x" style={{ gridTemplateColumns: `repeat(${years.length},minmax(0,1fr))` }}>{years.map(year => <span className={year.year === currentYear ? 'now' : ''} key={year.year}>{year.ganZhi}<small>{year.year}</small></span>)}</div></div>
 <div className="ln-key"><span><i className="k-line"/>三家合议（平均）</span><span><i className="k-range"/>三家最低至最高</span><span><i className="k-ref"/>五五之数</span></div>
 <div className="ln-scroll" ref={scroll} tabIndex={0} aria-label="流年逐年表，可横向滚动"><table className="ln-table"><colgroup><col className="ln-axis"/>{years.map(year => <col key={year.year}/>)}</colgroup><thead><tr className="ln-span"><th></th>{yearGroups(years.map(year => year.year), currentYear).map(group => <th scope="colgroup" colSpan={group.count} key={group.label}>{group.label === '回看' ? '回看 · 可对照亲历' : group.label}</th>)}</tr><tr><th>年份</th>{years.map((year, i) => <th className={year.year === currentYear ? 'now' : ''} key={year.year} ref={cell => {
                if (cell)
                    cells.current.set(year.year, cell);
            }}><button className={`ln-year ${selected === year.year ? 'sel' : ''}`} aria-pressed={selected === year.year} onClick={() => setSelected(year.year)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>{year.year}</button></th>)}</tr></thead><tbody>{rows.map(row => <tr className={row.label === '合议' ? 'avg' : ''} key={row.label}><th scope="row">{row.label}</th>{years.map((year, i) => {
                const key = BAZI_KEYS.find(key => BAZI_NAMES[key] === row.label);
                const entry = key ? schoolYear(reading, key, year.year) : undefined;
                return <td className={[year.year === currentYear ? 'now' : '', row.className ?? '', entry?.verdict.includes('吉') ? 'ji' : entry?.verdict.includes('凶') ? 'xiong' : ''].join(' ')} key={year.year}>{row.render(i)}</td>;
            })}</tr>)}</tbody></table></div>
 <div className="ln-detail"><div className="ln-detail-head"><b>{selected} {active.ganZhi}</b><span>虚岁 {active.age} · {active.luck?.ganZhi ?? active.luckLabel} · {active.stemGod}</span></div><div className="ln-detail-rows">{BAZI_KEYS.map(key => { const entry = schoolYear(reading, key, selected); return <div key={key}><span className="seal">{BAZI_NAMES[key].slice(0, 1)}</span><strong className={entry?.verdict.includes('吉') ? 'ji' : entry?.verdict.includes('凶') ? 'xiong' : ''}>{entry ? `${entry.verdict} ${entry.confidenceTenths}成` : '未展示'}<small>{BAZI_NAMES[key]}</small></strong><p>{entry?.note ?? '未展示'}</p></div>; })}</div></div>
 </div></section>;
}
```

## Chunk B6b2：客观命盘、三家、本机校正与样稿样式

承接 B6b1，不另起设计；本块所有 class 对齐已确认样稿。

### Task B6.5：客观命盘、三家与本机校正

- [ ] **Step 1：落入以下完整文件，顺序按样稿。** 胎元、命宫、身宫不传对象作文本；时柱为空时各行显示缺。大运按创建日期判断当前步，交运当天切换，起运前不高亮第一步。三家只有 done 才展示输出，留意月份取 timing.window 与 condition；命理不显示吉凶、合议与流年面板。无本人档案换日按钮置灰；切换时重新读本机存储并交服务端核验，不复用原始时刻缓存。

```tsx
// web/components/BirthCorrection.tsx
import { normalizeBirthProfile } from "../../src/sanyi/birth-profile.js";
import { correctBirthTime, type CivilTime } from "../../src/calendar/solar-time.js";
import { buildBaziChart } from "../../src/calendar/bazi.js";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import type { ReactNode } from "react";
import { birthSummary, type BirthProfileInput } from "../lib/birth-profile.js";
export function matchesReading(birth: BirthProfileInput, reading: PublicBaziReading): boolean {
    try {
        const profile = normalizeBirthProfile(birth);
        const corrected = correctBirthTime(profile.civil, profile.timeKnown, profile.longitude, profile);
        const chart = buildBaziChart({ corrected: corrected.effective, timeKnown: profile.timeKnown, gender: profile.gender, sect: reading.chart.sect, targetYear: reading.context.anchorYear });
        const signature = (value: typeof chart) => ({ pillars: value.pillars, luck: value.luck });
        return JSON.stringify(signature(chart)) === JSON.stringify(signature(reading.chart));
    }
    catch {
        return false;
    }
}
function civilText(value: CivilTime | null): string {
    if (!value) {
        return "未知";
    }
    return `${value.year}-${value.month}-${value.day} ${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`;
}
const DST_LABELS = { applied: "已减一小时", "not-applied": "未校正", "skipped-region": "当地历史夏令时未自动校正" };
export function BirthCorrection({ reading, birth, boundary }: {
    reading: PublicBaziReading;
    birth: BirthProfileInput | null;
    boundary?: ReactNode;
}) {
    let local = null;
    if (birth && matchesReading(birth, reading)) {
        const profile = normalizeBirthProfile(birth);
        local = correctBirthTime(profile.civil, profile.timeKnown, profile.longitude, profile);
    }
    return <div className="birth">
    {local && birth ? <><div className="birth-main"><b>{birthSummary(birth)}</b><span>本机档案</span></div><ul className="fixes" aria-label="出生时刻校正">{["夏令时", "真太阳时"].map((label, index) => <li key={label}><b>{label}</b><span>{local.steps[index] ? `${civilText(local.steps[index]!.before)} → ${civilText(local.steps[index]!.after)} · ${local.steps[index]!.description}` : "未校正"}</span></li>)}<li><b>换日口径</b><span>{boundary}</span></li></ul></> : <><p>校正摘要：夏令时 {DST_LABELS[reading.correction.dst]} · 真太阳时 {reading.correction.solar === "applied" ? "已校正" : "未校正"} · {reading.correction.timeKnown ? "已知时辰" : "时辰未知"}</p><ul className="fixes"><li><b>换日口径</b><span>{boundary}</span></li></ul></>}
    {reading.chart.warnings.map(warning => <p className="hint" key={warning}>{warning}</p>)}
  </div>;
}
```

```tsx
// web/components/BaziTable.tsx
import type { BaziChart } from "../../src/calendar/bazi.js";
import type { BaziAnalysis } from "../../src/calendar/bazi-relations.js";
export function BaziTable({ chart, analysis }: {
    chart: BaziChart;
    analysis: BaziAnalysis;
}) {
    const keys = ["year", "month", "day", "time"] as const;
    const rows = ["十神", "天干", "地支", "藏干", "长生", "纳音", "神煞"];
    return <div className="pillars-scroll" tabIndex={0} aria-label="四柱表，可横向滚动"><table className="pillars"><thead><tr><th></th>{["年柱", "月柱", "日柱 · 日主", "时柱"].map((label, i) => <th className={i === 2 ? "day" : ""} key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((label, i) => <tr key={label}><td className="rowlabel">{label}</td>{keys.map(key => {
                const pillar = chart.pillars[key];
                if (!pillar)
                    return <td key={key}>缺</td>;
                const names = new Map<string, string[]>();
                for (const item of analysis.shensha.filter(item => item.nodeId.startsWith(`natal.${key}.`)))
                    names.set(item.name, [...new Set([...(names.get(item.name) ?? []), item.basis])]);
                const values = [pillar.stemGod, pillar.stem, pillar.branch, pillar.hidden.map(item => <span className="hide" key={item.stem}>{item.stem}<small>{item.god}</small></span>), pillar.diShi, pillar.naYin, <div className="shensha">{names.size ? [...names].map(([name, basis]) => <span className="tag" title={basis.join("；")} key={name}>{name}</span>) : "—"}</div>];
                return <td className={`${i === 1 || i === 2 ? "gz " : ""}${key === "day" ? "day" : ""}`.trim()} key={key}>{values[i]}</td>;
            })}</tr>)}</tbody></table></div>;
}
```

```tsx
// web/components/BaziLuck.tsx
import type { BaziChart } from "../../src/calendar/bazi.js";
export function BaziLuck({ chart, currentYear, currentDate }: {
    chart: BaziChart;
    currentYear: number;
    currentDate: string;
}) {
    const luck = chart.luck;
    if (!luck) {
        return <section className="panel"><header className="panel-head"><h2>大运</h2></header><p>需补时辰确认起运与大运。</p></section>;
    }
    const currentGanZhi = "甲乙丙丁戊己庚辛壬癸".charAt((currentYear - 4) % 10) + "子丑寅卯辰巳午未申酉戌亥".charAt((currentYear - 4) % 12);
    const monthDay = luck.start.solarDate.slice(4);
    const current = luck.cycles.find((cycle, index) => {
        const start = `${cycle.startYear}${monthDay}`;
        const next = luck.cycles[index + 1];
        const end = `${next?.startYear ?? cycle.endYear + 1}${monthDay}`;
        return currentDate >= start && currentDate < end;
    });
    return <section className="panel"><header className="panel-head"><h2>大运</h2></header><p>{luck.direction === "forward" ? "顺行" : "逆行"} · {luck.start.years}年{luck.start.months}个月{luck.start.days}天起运 · {luck.start.solarDate}{luck.approximate ? "（正午估算）" : ""}</p><div className="luck">{luck.cycles.map((cycle) => <div data-cycle={cycle.index} className={current?.index === cycle.index ? "now luck-current" : ""} key={cycle.index}><b>{cycle.ganZhi}</b><small>{cycle.stemGod}<br />{cycle.startAge}–{cycle.endAge}岁<br />{cycle.startYear}–{cycle.endYear}</small>{current?.index === cycle.index ? <span className="flag">今年 {currentGanZhi} · {currentYear === cycle.endYear ? "本运末年" : "本运"}</span> : null}{chart.liunian.anchorYear >= cycle.startYear && chart.liunian.anchorYear <= cycle.endYear ? <span>所问之年 {chart.liunian.anchorYear}</span> : null}</div>)}</div>{currentDate < luck.start.solarDate ? <p>当前起运前</p> : null}</section>;
}
```

```tsx
// web/components/BaziSchools.tsx
import type { FortuneSchoolOutput } from "../../src/sanyi/bazi-schema.js";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { BAZI_KEYS, BAZI_NAMES } from "../lib/liunian-chart.js";
const META = { shenxiaozhan: "格局派 · 子平真诠", yuchuntai: "调候派 · 穷通宝鉴", rentieqiao: "扶抑派 · 滴天髓阐微" };
export function BaziSchools({ reading, onRetry }: {
    reading: PublicBaziReading;
    onRetry(key: typeof BAZI_KEYS[number]): void;
}) {
    const scores = BAZI_KEYS.flatMap(key => {
        const state = reading.schools[key];
        return state.status === "done" && state.output && "confidenceTenths" in state.output ? [state.output.confidenceTenths] : [];
    });
    const maxOverlap = Math.max(1, ...scores.map(score => scores.filter(value => value === score).length));
    return <section className="panel"><header className="panel-head"><h2>三家断语</h2><p>三派各自取用神，各自下断。</p></header><div className="usegod">{BAZI_KEYS.map(key => <div key={key}><small>{BAZI_NAMES[key]} · {META[key]}</small><b>{reading.schools[key].status === "done" ? reading.schools[key].output?.useGod : "未展示"}</b><span>{reading.schools[key].status === "done" ? reading.schools[key].output?.reason : "未展示"}</span></div>)}</div>
    {reading.kind === "fortune" ? <div className="consensus" aria-label="三家合议"><p>合议：{reading.consensusTenths === null ? "—" : `${reading.consensusTenths.toFixed(1)}成`}</p><div className="track" style={{ height: `${44 + (maxOverlap - 1) * 22}px` }}>
      {reading.consensusTenths !== null ? <span className="mean" style={{ left: `${reading.consensusTenths * 10}%` }}><span>合议 {reading.consensusTenths?.toFixed(1)}成</span></span> : null}
      {BAZI_KEYS.map((key) => {
                const state = reading.schools[key];
                const output = state.status === "done" ? state.output as FortuneSchoolOutput | undefined : undefined;
                return output ? <span className="pin" key={key} style={{ left: `${output.confidenceTenths * 10}%`, top: `${12 + BAZI_KEYS.slice(0, BAZI_KEYS.indexOf(key)).filter(previous => { const value = reading.schools[previous]; return value.status === "done" && value.output && "confidenceTenths" in value.output && value.output.confidenceTenths === output.confidenceTenths; }).length * 22}px` }}>{BAZI_NAMES[key].slice(0, 1)}</span> : null;
            })}
    </div><div className="scale"><span>断不成</span><span>断必成</span></div></div> : null}
    {BAZI_KEYS.map((key) => {
            const state = reading.schools[key];
            const output = state.status === "done" ? state.output : undefined;
            const fortune = output && "years" in output ? output as FortuneSchoolOutput : undefined;
            return <article className="diviner" key={key}><span className="seal">{BAZI_NAMES[key].slice(0, 1)}</span><div className="who"><b>{BAZI_NAMES[key]}</b><span>{META[key]}</span></div>{output ? <>
        {reading.kind === "fortune" && fortune ? <p className={`verdict dyn ${fortune.verdict.includes("吉") ? "good" : fortune.verdict.includes("凶") ? "bad" : ""}`}>{fortune.verdict} · {output.headline}<small>{fortune.confidenceTenths}成</small></p> : null}
        {reading.kind === "destiny" ? <p className="verdict dyn">{output.headline}</p> : null}<p className="why">{output.reason}</p>
        {fortune?.timing ? <div className="watch"><span className="tag" title={fortune.timing.condition}>{fortune.timing.window}</span></div> : null}
        <details><summary>展开详断</summary>{output.sections.map((section) => <p key={section.title}><b>{section.title}：</b>{section.text}</p>)}<ul>{output.advice.map((advice) => <li key={advice}>{advice}</li>)}</ul><p>{output.evidence.map((item) => `${item.ref}：${item.claim}`).join("；")}</p></details>
      </> : <p>{state.status === "failed" ? "未展示" : "正在落笔"}</p>}
        {state.status === "failed" ? <button type="button" disabled={state.retries >= 2 || reading.status !== "done"} onClick={() => onRetry(key)}>免费重试 · 剩余 {Math.max(0, 2 - state.retries)} 次</button> : null}
      </article>;
        })}
  </section>;
}
```

```tsx
// web/components/BaziRelations.tsx
import type { BaziAnalysis } from "../../src/calendar/bazi-relations.js";
import { relationClass } from "../lib/liunian-chart.js";
export function BaziRelations({ analysis }: {
    analysis: BaziAnalysis;
}) {
    const nodes = analysis.nodes.filter(node => node.type === "branch");
    const x = (id: string) => 28 + nodes.findIndex(node => node.id === id) * 60;
    const relations = analysis.relations.filter(item => item.nodeIds.every(id => nodes.some(node => node.id === id)));
    // 同跨度弧线再按占用层错开，文字沿弧顶排列；天干关系仅进入下方列表。
    const lanes: {
        left: number;
        right: number;
        level: number;
    }[] = [];
    const arcs = [...relations].sort((a, b) => Math.max(...a.nodeIds.map(x)) - Math.min(...a.nodeIds.map(x)) - (Math.max(...b.nodeIds.map(x)) - Math.min(...b.nodeIds.map(x)))).map(item => {
        const left = Math.min(...item.nodeIds.map(x));
        const right = Math.max(...item.nodeIds.map(x));
        let level = 0;
        while (lanes.some(lane => lane.level === level && left <= lane.right + 30 && right >= lane.left - 30))
            level++;
        lanes.push({ left, right, level });
        return { item, left, right, height: 35 + level * 24 };
    });
    const height = Math.max(180, ...arcs.map(arc => arc.height + 65));
    const base = height - 45;
    return <section className="panel"><header className="panel-head"><h2>合冲刑害</h2><p>原局四支与当前大运、流年之间的关系。</p></header><svg className="rel-svg" viewBox={`0 0 ${Math.max(240, nodes.length * 60)} ${height}`} role="img" aria-label="地支关系图，完整关系见下方三行文字">
 {nodes.filter(node => node.scope !== "natal").map(node => <line className="rel-divider" x1={x(node.id) - 30} x2={x(node.id) - 30} y1="8" y2={height} key={node.id}/>)}
 {arcs.map(({ item, left, right, height: h }) => <g key={item.id}><path className={relationClass(item.kind)} strokeDasharray={item.kind.includes("刑") ? "5 4" : undefined} fill="none" d={`M${left},${base} Q${(left + right) / 2},${base - h * 2} ${right},${base}`}/><text className={relationClass(item.kind)} x={(left + right) / 2} y={base - h - 6} textAnchor="middle">{item.label}</text></g>)}
 {nodes.map(node => <g data-node={node.id} key={node.id}><text className="rel-node" x={x(node.id)} y={base + 12} textAnchor="middle">{node.value}</text><text className="rel-caption" x={x(node.id)} y={base + 34} textAnchor="middle">{node.scope === "natal" ? node.label.replace("柱", "") : node.label.replace("支", "")}</text></g>)}
 </svg><ul className="rel-list">{(["natal", "luck", "year"] as const).map(scope => <li data-scope={scope} key={scope}><b>{scope === "natal" ? "原局" : `${scope === "luck" ? "大运" : "流年"}${analysis.nodes.filter(node => node.scope === scope).map(node => node.value).join("")}`}</b>{[...new Set(analysis.relations.filter(item => item.scope === scope).map(item => item.label))].join("、") || "无"}</li>)}</ul></section>;
}
```

```tsx
// web/components/BaziElements.tsx
import type { ElementCount } from "../../src/calendar/bazi-relations.js";
const parts = [["stem", "天干"], ["main", "本气"], ["middle", "中气"], ["residual", "余气"]] as const;
export function BaziElements({ elements }: {
    elements: readonly ElementCount[];
}) {
    const maximum = Math.max(1, ...elements.map(item => item.total));
    return <section className="panel"><header className="panel-head"><h2>五行分布</h2><p>天干与藏干按个数计，不据此下身强身弱结论。</p></header><div className="elements">{elements.map(item => <div className="el-row" key={item.element}><b>{item.element}</b><div className="el-bar" style={{ "--el-unit": `${100 / maximum}%` } as import("react").CSSProperties} aria-label={`${item.element}共${item.total}个`}>{parts.map(([key, label]) => <i data-qi={key} className={`el-${key}`} style={{ width: `${item[key] / maximum * 100}%` }} title={`${label} ${item[key]}`} key={key}/>)}</div><span>{item.total}</span></div>)}</div><div className="el-legend">{parts.map(([key, label]) => <span key={key}><i className={`el-${key}`}/>{label}</span>)}<span>每格 = 1 个单位</span></div></section>;
}
```

```tsx
// web/components/DayBoundaryChange.tsx
import { useState } from "react";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { matchesReading } from "./BirthCorrection.js";
import { api } from "../lib/api.js";
import { loadBirthProfile, type BirthProfileInput } from "../lib/birth-profile.js";
export function DayBoundaryChange({ reading, birth, onReading }: {
    reading: PublicBaziReading;
    birth: BirthProfileInput | null;
    onReading(value: PublicBaziReading): void;
}) {
    const available = birth !== null && matchesReading(birth, reading);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const change = async () => {
        const local = loadBirthProfile();
        if (!local) {
            setError("需在填写生辰的设备上切换");
            return;
        }
        setBusy(true);
        try {
            const value = await api.changeDayBoundary(reading.id, local, reading.chart.sect === 1 ? 2 : 1);
            if (value.kind !== "question") {
                onReading(value);
            }
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "切换暂不可用");
        }
        finally {
            setBusy(false);
        }
    };
    return <div className="day-boundary"><span>当前 {reading.chart.dayBoundary} 换日 · 剩余 {Math.max(0, 2 - reading.changes)} 次 · 免费</span><button type="button" disabled={!available || busy || reading.changes >= 2 || reading.status !== "done"} onClick={() => void change()}>切换换日口径</button>{!available ? <small>需在填写生辰的设备上切换</small> : null}{error ? <p className="error" role="alert">{error}</p> : null}</div>;
}
```

```tsx
// web/pages/BaziReading.tsx
import { useState } from "react";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { resolveFortuneContext } from "../../src/sanyi/fortune-context.js";
import { api } from "../lib/api.js";
import { loadBirthProfile, type BirthProfileInput } from "../lib/birth-profile.js";
import { BAZI_KEYS } from "../lib/liunian-chart.js";
import { BirthCorrection } from "../components/BirthCorrection.js";
import { BaziTable } from "../components/BaziTable.js";
import { BaziLuck } from "../components/BaziLuck.js";
import { BaziSchools } from "../components/BaziSchools.js";
import { BaziRelations } from "../components/BaziRelations.js";
import { BaziElements } from "../components/BaziElements.js";
import { DayBoundaryChange } from "../components/DayBoundaryChange.js";
import { LiuNianPanel } from "../components/LiuNianPanel.js";
export function BaziReading({ reading, onReading, birth: supplied }: {
    reading: PublicBaziReading;
    onReading(value: PublicBaziReading): void;
    birth?: BirthProfileInput | null;
}) {
    const [birth] = useState(() => supplied === undefined ? loadBirthProfile() : supplied);
    const [error, setError] = useState("");
    const currentYear = resolveFortuneContext("year", () => new Date(reading.createdAt), reading.chart.sect).anchorYear;
    const currentDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date(reading.createdAt));
    const retry = async (key: typeof BAZI_KEYS[number]) => {
        try {
            const value = await api.retrySchool(reading.id, key);
            if (value.kind !== "question") {
                onReading(value);
            }
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "重试暂不可用");
        }
    };
    return <div className="bazi" data-reading={reading.id}>
    <div className="hero"><section className="panel"><div className="ask"><span className="label">所问之事 · {reading.kind === "fortune" ? "运势" : "命理"}</span><p>{reading.question}</p></div><BirthCorrection reading={reading} birth={birth} boundary={<DayBoundaryChange reading={reading} birth={birth} onReading={onReading}/>}/><BaziTable chart={reading.chart} analysis={reading.analysis}/><div className="minor">{([["胎元", reading.chart.taiYuan], ["命宫", reading.chart.mingGong], ["身宫", reading.chart.shenGong]] as const).map(([label, value]) => <span key={label}><b>{label}</b> {value ?? "缺"}</span>)}<span><b>起运</b> {reading.chart.luck ? `${reading.chart.luck.start.years} 年 ${reading.chart.luck.start.months} 月 ${reading.chart.luck.start.days} 天（${reading.chart.luck.start.solarDate} 交运）${reading.chart.luck.approximate ? " · 正午估算" : ""}` : "需补时辰确认"}</span></div></section><BaziSchools reading={reading} onRetry={(key) => void retry(key)}/></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <BaziLuck chart={reading.chart} currentYear={currentYear} currentDate={currentDate}/>
    {reading.kind === "fortune" ? <LiuNianPanel reading={reading} currentYear={currentYear}/> : null}
    <div className="row2"><BaziRelations analysis={reading.analysis}/><BaziElements elements={reading.analysis.elements}/></div>
    <p className="provenance">数据来源：四柱、十神、藏干、长生、纳音与大运由 lunar-javascript 推算；合冲刑害与神煞按传统查表；调候据《穷通宝鉴》{reading.tiaohou.section}。原始生辰与逐步校正只在本机展示；流年以立春为界，三家各自独立落笔。</p>
  </div>;
}
```

### Task B6.6：kind 分流、布局与字体字表

- [ ] **Step 1：应用精确 diff。** Reading 按公开 kind 分流，顶栏沿用 WalletBar、时空栏沿用此刻 almanac；问事 CoinThrow/retry 显式收窄联合。八字结构逐段移植样稿，样式限定 .bazi，保持 1A 已有规则。page 使用 minmax(0, 1fr)，宽表不能撑开页面；年份按钮只保留在逐年表头；图上列点击仍可选中。

```diff
--- a/web/pages/Reading.tsx
+++ b/web/pages/Reading.tsx
@@ -9,7 +9,8 @@
 import { Luopan } from "../components/Luopan.js";
 import { ShikongBar, toView } from "../components/ShikongBar.js";
 import { ThrowRecord } from "../components/ThrowRecord.js";
-import { api, type PublicReading } from "../lib/api.js";
+import { BaziReading } from "./BaziReading.js";
+import { api, type AnyPublicReading, type PublicReading } from "../lib/api.js";
 import { saveRecentReading } from "../lib/recent-readings.js";
 import { readingStage, shouldPollReading } from "../lib/reading-state.js";
 import { AlmanacPanel } from "../components/AlmanacPanel.js";
@@ -45,7 +46,10 @@
   const retry = async (key: typeof SCHOOL_KEYS[number]) => {
     setRetryError("");
     try {
-      props.onReading(await api.retrySchool(reading.id, key));
+      const value = await api.retrySchool(reading.id, key);
+      if (value.kind === "question") {
+        props.onReading(value);
+      }
     } catch (caught) {
       setRetryError(caught instanceof Error ? caught.message : "此家暂未能重试，请稍后再试");
     }
@@ -114,7 +118,7 @@
   );
 }
 export function Reading({ id }: { id: string }) {
-  const [reading, setReading] = useState<PublicReading>();
+  const [reading, setReading] = useState<AnyPublicReading>();
   const [error, setError] = useState("");
   const refresh = useCallback(async () => {
     try {
@@ -159,6 +163,9 @@
       </main>
     );
   }
+  if (reading.kind !== "question") {
+    return <main className="page"><header className="topbar"><span className="seal">问</span><span className="brand">三易</span><nav className="nav"><a href="#/">返回首页</a></nav><WalletBar /></header><ShikongBar data={toView(reading.almanac)} /><BaziReading reading={reading} onReading={setReading} /></main>;
+  }
   const stage = readingStage(reading);
   const view = reading.almanac ? toView(reading.almanac) : undefined;
   return (
--- a/web/components/CoinThrow.tsx
+++ b/web/components/CoinThrow.tsx
@@ -30,7 +30,9 @@
       const result = await api.throwCoin(props.reading.id, state.nextIndex);
       dispatch({ type: "resolved", result });
       const reading = await api.getReading(props.reading.id);
-      props.onReading(reading);
+      if (reading.kind === "question") {
+        props.onReading(reading);
+      }
     } catch (caught) {
       const message = caught instanceof ApiError && [409, 503].includes(caught.status)
         ? caught.message || ARC_MESSAGE
--- a/web/lib/reading-state.ts
+++ b/web/lib/reading-state.ts
@@ -1,5 +1,5 @@
 // web/lib/reading-state.ts
-import type { PublicReading } from "./api.js";
+import type { AnyPublicReading, PublicReading } from "./api.js";

 export type ReadingStage = "awaiting-throws" | "charting" | "writing" | "done" | "failed";
 type Schools = PublicReading["schools"];
@@ -21,7 +21,7 @@
   return reading.status === "done" ? "done" : "writing";
 }

-export function shouldPollReading(reading: PublicReading): boolean {
+export function shouldPollReading(reading: AnyPublicReading): boolean {
   if (reading.status === "charting" || reading.status === "writing") {
     return true;
   }
--- a/web/components/RecentReadings.tsx
+++ b/web/components/RecentReadings.tsx
@@ -9,7 +9,7 @@
           {readings.map((item) => (
             <li key={item.id}>
               <a href={`#/r/${item.id}`}>
-                <span>{item.question}</span>
+                <span>{item.kind === "destiny" ? "命理" : null}{item.kind === "fortune" ? "运势" : null} · {item.question}</span>
                 <time>{item.createdAt}</time>
               </a>
             </li>
--- a/web/lib/term-definitions.ts
+++ b/web/lib/term-definitions.ts
@@ -79,3 +79,9 @@
     },
   ];
 }
+
+export const BAZI_TERM_DEFINITIONS = {
+  胎元: "从出生月柱推算的传统辅助字段。",
+  命宫: "按出生月份与时辰推算的传统辅助字段，缺时辰不展示。",
+  身宫: "按出生月份与时辰推算的传统辅助字段，缺时辰不展示。",
+} as const;
--- a/web/styles/layout.css
+++ b/web/styles/layout.css
@@ -28,6 +28,7 @@
 }
 .page {
   display: grid;
+  grid-template-columns: minmax(0, 1fr);
   gap: 26px;
   width: 100%;
   max-width: 1280px;
--- a/web/styles/tokens.css
+++ b/web/styles/tokens.css
@@ -18,8 +18,8 @@
   --line-strong: rgb(201 168 102 / 0.42);
   --cinnabar: #D0614A;
   --cinnabar-soft: rgb(208 97 74 / 0.15);
-  --jade: #82B59E;
-  --jade-soft: rgb(130 181 158 / 0.14);
+  --jade: #45A07E;
+  --jade-soft: rgb(69 160 126 / 0.14);
   --seal-bg: #A63A2B;
   --seal-text: #F6EFE2;
   --serif: "Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif;
--- a/web/styles/components.css
+++ b/web/styles/components.css
@@ -638,3 +638,9 @@
     font-size: 12px;
   }
 }
+
+/* 生辰表单使用现有 tokens。 */
+.birth-form label { display:grid;gap:6px;margin:12px 0; }
+.birth-form input,.birth-form select {color:var(--paper);background:var(--panel-2);border:1px solid var(--line-strong);padding:8px;min-width:0;width:100%;}
+.birth-form input[type="checkbox"] {width:auto;}
+.birth-date {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
--- a/scripts/font-charset.ts
+++ b/scripts/font-charset.ts
@@ -14,6 +14,8 @@
   "三易", "所问之事", "三家断语", "六爻排盘", "奇门时盘", "当日黄历", "卦历",
   "公历", "农历", "四柱", "节气", "月建日辰", "值日", "最近所问", "问卦",
   "程颐", "京房", "邵雍", "问",
+  "问题与生辰", "三家用神对照", "流年运势", "大运", "合冲刑害", "五行分布",
+  "胎元", "命宫", "身宫", "起运", "沈孝瞻", "余春台", "任铁樵",
 ] as const;
 export function buildFontCharset(): string {
   const source = [
--- a/web/fonts/mashanzheng-chars.txt
+++ b/web/fonts/mashanzheng-chars.txt
@@ -1 +1 @@
-丁三丑世丙中丰临为之乙九乾事井亥京人任休伤值兄兑公六农冲剥勾升午卦卯历合同否咸嗑噬四困地坎坤壬壮复大天太夬夷奇妄妹妻姤子孙孚官家寅小履屯山己巳巽师应庚建开弟归当心恒惊戊戌房所损排断旅无既日时明易晋景最月有未朱杜柱武死母比气水泰泽济涣渐火父爻玄生甲申畜癸白益盘睽离禽程符腾艮节芮英萃蒙蓬虎蛇蛊螣观解讼语谦豫财贲蹇辅辛辰过近遁邵酉门问阴陈随雀雍雷需震青革颐风鬼黄鼎龙
+丁三与丑世丙中丰临为之乙九乾事五井亥京人任休伤余值元兄兑公六农冲分刑剥势勾升午卦卯历台合同否命咸嗑噬四困地坎坤壬壮复大天太夬夷奇妄妹妻姤子孙孚孝官宫害家寅对小履屯山己巳巽布师年应庚建开弟归当心恒惊戊戌房所损排断旅无既日时明易春晋景最月有未朱杜柱樵武死母比气水沈泰泽流济涣渐火照父爻玄生用甲申畜癸白益盘睽瞻神离禽程符胎腾艮节芮英萃蒙蓬虎蛇蛊螣行观解讼语谦豫财贲起蹇身辅辛辰过运近遁邵酉铁门问阴陈随雀雍雷需震青革颐题风鬼黄鼎龙
--- a/tests/frontend-font.test.ts
+++ b/tests/frontend-font.test.ts
@@ -16,7 +16,7 @@
 test("毛笔体字表确定、有关键字且没有假名", () => {
   const charset = buildFontCharset();
   assert.equal(charset, [...charset].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join(""));
-  for (const value of ["泰", "巽", "螣", "勾", "程", "世", "应"]) {
+  for (const value of ["泰", "巽", "螣", "勾", "程", "世", "应", ..."沈孝瞻余春台任铁樵流年运势胎元命宫身宫"]) {
     assert.match(charset, new RegExp(value));
   }
   assert.doesNotMatch(charset, /[\u3040-\u30ff]/u);
```

**样式来源与隔离：** 以下 bazi.css 的四柱、大运、三家、流年、关系与五行规则逐段复制已确认样稿；共享选择器加 `.bazi` 前缀、字面颜色映射为 tokens。保留 1A 同名规则；仅补必要的数据定位、无障碍与 11px 下限。不是重新设计。

```css
// web/styles/bazi.css
/* 样稿八字规则原样移植；共享类限定在 .bazi 内，保护 1A。 */
.bazi { display:grid; gap:26px; min-width:0; --bazi-middle:rgb(201 168 102 / .55); --bazi-bar-bg:rgb(234 229 217 / .04); --bazi-grid:rgb(201 168 102 / .1); --bazi-ref:rgb(234 229 217 / .32); --bazi-range:rgb(234 229 217 / .34); --bazi-hover:rgb(234 229 217 / .05); --bazi-good-bg:rgb(69 160 126 / .22); --bazi-bad-bg:rgb(208 97 74 / .18); }
.bazi .hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 26px; align-items: start; }
.bazi .row2 { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 26px; align-items: start; }
@media (max-width: 980px) {
.bazi .hero, .bazi .row2 { grid-template-columns: minmax(0, 1fr); }
}
.bazi .ask { display: grid; gap: 6px; }
.bazi .ask p { margin: 0; font-size: 21px; line-height: 1.5; }
.bazi .consensus { display: grid; gap: 8px; }
.bazi .track { position: relative; height: 44px; margin: 16px 12px 0; }
.bazi .track::before { content: ""; position: absolute; left: 0; right: 0; top: 21px; height: 2px; background: linear-gradient(90deg, var(--cinnabar), var(--line-strong) 50%, var(--jade)); opacity: 0.8; }
.bazi .track .mean { position: absolute; top: 10px; width: 1px; height: 24px; background: var(--paper); }
.bazi .track .mean span { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-family: var(--sans); font-size: 11px; color: var(--paper); white-space: nowrap; }
.bazi .track .pin { position: absolute; top: 12px; width: 20px; height: 20px; margin-left: -10px; display: grid; place-items: center; background: var(--seal-bg); color: var(--seal-text); font-family: var(--brush); font-size: 13px; border-radius: 2px; }
.bazi .scale { display: flex; justify-content: space-between; margin-inline: 4px; font-family: var(--sans); font-size: 11.5px; color: var(--dim); }
.bazi .diviner { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 14px; padding: 16px 0; border-top: 1px solid var(--line); }
.bazi .diviner .seal { width: 40px; height: 40px; font-size: 24px; grid-row: span 3; }
.bazi .who { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.bazi .who b { font-size: 17px; font-weight: 600; }
.bazi .who span { font-size: 13px; color: var(--muted); }
.bazi .who em { margin-left: auto; font-style: normal; font-family: var(--sans); font-size: 12.5px; color: var(--gold); font-variant-numeric: tabular-nums; }
.bazi .verdict { margin: 0; font-family: var(--brush); font-size: 23px; letter-spacing: 0.06em; }
.bazi .verdict small { font-family: var(--serif); font-size: 13px; color: var(--muted); margin-left: 8px; letter-spacing: 0; }
.bazi .verdict.good { color: var(--jade); }
.bazi .verdict.bad { color: var(--cinnabar); }
.bazi .why { margin: 0; font-size: 14px; line-height: 1.85; color: var(--muted); }
.bazi .birth { display: grid; gap: 10px; }
.bazi .birth-main { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; }
.bazi .birth-main b { font-size: 20px; font-weight: 600; }
.bazi .birth-main span { color: var(--muted); font-size: 14px; }
.bazi .fixes { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 13.5px; line-height: 1.7; color: var(--muted); }
.bazi .fixes li { display: grid; grid-template-columns: 6.5em minmax(0, 1fr); gap: 10px; }
.bazi .fixes li b { color: var(--gold); font-weight: 600; font-family: var(--sans); font-size: 12.5px; }
.bazi .fixes li.hit span { color: var(--paper); }
.bazi .fixes li.hit em { font-style: normal; color: var(--cinnabar); }
.bazi .pillars-scroll { overflow-x: auto; }
.bazi table.pillars { width: 100%; min-width: 540px; border-collapse: collapse; text-align: center; font-variant-numeric: tabular-nums; }
.bazi .pillars th { padding: 0 6px 10px; font-family: var(--sans); font-size: 12px; font-weight: 400; letter-spacing: .12em; color: var(--dim); border-bottom: 1px solid var(--line-strong); }
.bazi .pillars th.day { color: var(--gold); }
.bazi .pillars td { padding: 9px 6px; border-bottom: 1px solid var(--line); font-size: 14px; color: var(--muted); }
.bazi .pillars td.rowlabel { text-align: left; font-family: var(--sans); font-size: 12px; color: var(--dim); white-space: nowrap; }
.bazi .pillars td.gz { font-family: var(--brush); font-size: 34px; line-height: 1.15; color: var(--paper); }
.bazi .pillars td.day { background: var(--gold-soft); }
.bazi .pillars td.gz.day { color: var(--gold); }
.bazi .pillars td .hide { display: block; font-size: 13px; color: var(--paper); }
.bazi .pillars td .hide small { color: var(--dim); font-size: 11.5px; margin-left: 2px; }
.bazi .pillars .changed { color: var(--cinnabar) !important; }
.bazi .pillars .shensha { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.bazi .minor { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: var(--muted); }
.bazi .minor b { color: var(--paper); font-weight: 600; }
.bazi .luck { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 0; border: 1px solid var(--line); }
.bazi .luck div { display: grid; gap: 4px; justify-items: center; padding: 12px 4px; border-right: 1px solid var(--line); position: relative; }
.bazi .luck div:last-child { border-right: 0; }
.bazi .luck b { font-family: var(--brush); font-weight: 400; font-size: 24px; color: var(--paper); }
.bazi .luck small { font-family: var(--sans); font-size: 11px; color: var(--dim); text-align: center; line-height: 1.5; }
.bazi .luck .now { background: var(--gold-soft); outline: 1px solid var(--line-strong); }
.bazi .luck .now b { color: var(--gold); }
.bazi .luck .flag { position: absolute; top: -11px; padding: 0 6px; background: var(--seal-bg); color: var(--seal-text); font-family: var(--sans); font-size: 11px; line-height: 20px; border-radius: 2px; white-space: nowrap; }
@media (max-width: 760px) {
.bazi .luck { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.bazi .luck div:nth-child(4) { border-right: 0; }
.bazi .luck div:nth-child(-n+4) { border-bottom: 1px solid var(--line); }
}
.bazi .elements { display: grid; gap: 10px; }
.bazi .el-row { display: grid; grid-template-columns: 2.4em minmax(0, 1fr) 2.5em; align-items: center; gap: 10px; font-size: 14px; }
.bazi .el-row > b { font-family: var(--brush); font-weight: 400; font-size: 22px; }
.bazi .el-bar { display: flex; height: 16px; background: var(--bazi-bar-bg); }
.bazi .el-bar i { display: block; height: 100%; border-right: 1px solid var(--bg); }
.bazi .el-row > span { font-family: var(--sans); font-size: 13px; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
.bazi .el-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-family: var(--sans); font-size: 12px; color: var(--dim); }
.bazi .el-legend span { display: inline-flex; align-items: center; gap: 5px; }
.bazi .el-legend i { width: 12px; height: 9px; display: inline-block; }
.bazi .rel-svg { width: 100%; height: auto; display: block; }
.bazi .rel-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 13.5px; color: var(--muted); line-height: 1.7; }
.bazi .rel-list b { color: var(--paper); font-weight: 600; margin-right: 6px; }
.bazi .usegod { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--line-strong); }
.bazi .usegod div { display: grid; gap: 4px; padding: 12px 14px; border-right: 1px solid var(--line); }
.bazi .usegod div:last-child { border-right: 0; }
.bazi .usegod small { font-family: var(--sans); font-size: 12px; color: var(--dim); }
.bazi .usegod b { font-family: var(--dynamic, "Kaiti SC", "STKaiti", serif); font-size: 19px; font-weight: 600; color: var(--gold); }
.bazi .usegod span { font-size: 12.5px; color: var(--muted); line-height: 1.6; }
@media (max-width: 620px) {
.bazi .usegod { grid-template-columns: minmax(0, 1fr); }
.bazi .usegod div { border-right: 0; border-bottom: 1px solid var(--line); }
}
.bazi .watch { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.bazi .diviner .seal { grid-row: span 4; }
.bazi .verdict.dyn { font-family: "Kaiti SC", "STKaiti", "KaiTi", serif; font-weight: 600; font-size: 21px; }
.bazi .mock-note { color: var(--cinnabar); }
.bazi .ln-grid { --axis: 76px; --axis-chart: 76px; display: grid; gap: 10px; }
.bazi .ln-scroll { overflow-x: auto; }
.bazi .ln-scroll table { min-width: 900px; }
.bazi .ln-chart { display: grid; grid-template-columns: var(--axis-chart) minmax(0, 1fr); grid-template-rows: 194px auto; padding-top: 10px; }
.bazi .ln-x { grid-column: 2; display: none; grid-template-columns: repeat(10, minmax(0, 1fr)); padding-top: 6px; text-align: center; font-size: 11.5px; color: var(--muted); }
.bazi .ln-x span { display: grid; line-height: 1.35; }
.bazi .ln-x span.now { color: var(--gold); }
.bazi .ln-x small { font-family: var(--sans); font-size: 10px; color: var(--dim); font-variant-numeric: tabular-nums; }
.bazi .ln-y { position: relative; }
.bazi .ln-y span { position: absolute; right: 12px; transform: translateY(-50%); font-family: var(--sans); font-size: 11.5px; color: var(--dim); font-variant-numeric: tabular-nums; }
.bazi .ln-plot { position: relative; border-bottom: 1px solid var(--line-strong); }
.bazi .ln-plot > i { position: absolute; display: block; }
.bazi .ln-now { top: 0; bottom: 0; width: 10%; background: var(--gold-soft); }
.bazi .ln-grid-y { left: 0; right: 0; height: 0; border-top: 1px solid var(--bazi-grid); }
.bazi .ln-ref { left: 0; right: 0; height: 0; border-top: 1px dashed var(--bazi-ref); }
.bazi .ln-yun { top: 0; bottom: 0; border-left: 1px dashed var(--line-strong); }
.bazi .ln-yun.first { border-left: 0; }
.bazi .ln-yun span { position: absolute; top: 4px; left: 8px; font-family: var(--sans); font-size: 11.5px; font-style: normal; color: var(--muted); white-space: nowrap; }
.bazi .ln-range { width: 2px; margin-left: -1px; background: var(--bazi-range); border-radius: 1px; }
.bazi .ln-range::before, .bazi .ln-range::after { content: ""; position: absolute; left: -3px; width: 8px; height: 2px; background: var(--bazi-range); }
.bazi .ln-range::before { top: -1px; }
.bazi .ln-range::after { bottom: -1px; }
.bazi .ln-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.bazi .ln-dot { width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 0 2px var(--panel); pointer-events: none; }
.bazi .ln-dot.now { width: 14px; height: 14px; margin: -7px 0 0 -7px; background: var(--paper); }
.bazi .ln-lab { position: absolute; transform: translate(-50%, -100%); margin-top: -8px; font-family: var(--sans); font-size: 12px; color: var(--paper); white-space: nowrap; pointer-events: none; font-variant-numeric: tabular-nums; }
.bazi .ln-hit { position: absolute; top: 0; bottom: 0; width: 10%; margin: 0; padding: 0; border: 0; background: transparent; cursor: pointer; }
.bazi .ln-hit:hover, .bazi .ln-hit:focus-visible { background: var(--bazi-hover); outline: none; }
.bazi .ln-hit.sel { box-shadow: inset 0 0 0 1px var(--line-strong); }
.bazi .ln-tip { position: absolute; z-index: 2; transform: translate(-50%, calc(-100% - 14px)); min-width: 148px; padding: 8px 10px; background: var(--bg); border: 1px solid var(--line-strong); font-family: var(--sans); font-size: 12px; line-height: 1.6; color: var(--muted); white-space: nowrap; pointer-events: none; }
.bazi .ln-tip b { color: var(--paper); font-weight: 600; }
.bazi .ln-key { display: flex; flex-wrap: wrap; gap: 6px 18px; padding-left: var(--axis-chart); font-family: var(--sans); font-size: 12px; color: var(--dim); }
.bazi .ln-key span { display: inline-flex; align-items: center; gap: 6px; }
.bazi .ln-key i { display: inline-block; }
.bazi .ln-key .k-line { width: 18px; height: 2px; background: var(--gold); }
.bazi .ln-key .k-range { width: 2px; height: 12px; background: var(--bazi-range); }
.bazi .ln-key .k-ref { width: 18px; border-top: 1px dashed var(--bazi-ref); }
.bazi table.ln-table { width: 100%; table-layout: fixed; border-collapse: collapse; text-align: center; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.bazi .ln-table col.ln-axis { width: var(--axis); }
.bazi .ln-table th, .bazi .ln-table td { padding: 7px 3px; border-bottom: 1px solid var(--line); vertical-align: middle; line-height: 1.45; }
.bazi .ln-table thead th { font-family: var(--sans); font-size: 12px; font-weight: 400; color: var(--dim); }
.bazi .ln-table .ln-span th { padding-bottom: 2px; border-bottom: 0; letter-spacing: 0.08em; }
.bazi .ln-table .ln-span th[colspan] { border-top: 1px solid var(--line); }
.bazi .ln-table tbody th { text-align: left; padding-left: 0; font-family: var(--sans); font-size: 12px; font-weight: 400; color: var(--dim); white-space: nowrap; }
.bazi .ln-table .now { background: var(--gold-soft); }
.bazi .ln-year { min-height: 32px; width: 100%; padding: 4px 0; border: 1px solid transparent; background: none; color: var(--paper); font-family: var(--sans); font-size: 13px; cursor: pointer; font-variant-numeric: tabular-nums; }
.bazi .ln-year:hover, .bazi .ln-year:focus-visible { border-color: var(--line-strong); outline: none; }
.bazi .ln-year.sel { border-color: var(--gold); color: var(--gold); }
.bazi .ln-table td.gz { font-family: var(--brush); font-size: 22px; line-height: 1.2; color: var(--paper); }
.bazi .ln-table td.gz small { display: block; font-family: var(--sans); font-size: 11px; color: var(--dim); }
.bazi .ln-table td.rels { vertical-align: top; }
.bazi .ln-table td.rels .tag { display: block; width: fit-content; margin: 0 auto 3px; font-size: 11px; padding: 0 4px; white-space: normal; }
.bazi .ln-table td.v { color: var(--paper); font-size: 12.5px; }
.bazi .ln-table td.v b { font-family: var(--serif); font-weight: 600; margin-right: 3px; }
.bazi .ln-table td.v.ji { background: var(--bazi-good-bg); box-shadow: inset 3px 0 0 var(--jade); }
.bazi .ln-table td.v.xiong { background: var(--bazi-bad-bg); box-shadow: inset 3px 0 0 var(--cinnabar); }
.bazi .ln-table tr.avg td { color: var(--paper); font-weight: 600; }
.bazi .ln-detail { display: grid; gap: 10px; padding-top: 4px; }
.bazi .ln-detail-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }
.bazi .ln-detail-head b { font-family: var(--brush); font-weight: 400; font-size: 26px; letter-spacing: 0.06em; }
.bazi .ln-detail-head span { font-size: 13.5px; color: var(--muted); }
.bazi .ln-detail-rows { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; border: 1px solid var(--line); }
.bazi .ln-detail-rows div { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; align-items: center; padding: 12px 14px; border-right: 1px solid var(--line); }
.bazi .ln-detail-rows div:last-child { border-right: 0; }
.bazi .ln-detail-rows .seal { width: 30px; height: 30px; font-size: 18px; grid-row: span 2; }
.bazi .ln-detail-rows strong { font-family: "Kaiti SC", "STKaiti", "KaiTi", serif; font-size: 18px; font-weight: 600; }
.bazi .ln-detail-rows strong.ji { color: var(--jade); }
.bazi .ln-detail-rows strong.xiong { color: var(--cinnabar); }
.bazi .ln-detail-rows strong small { margin-left: 6px; font-family: var(--sans); font-size: 12px; font-weight: 400; color: var(--muted); }
.bazi .ln-detail-rows p { margin: 0; font-size: 13.5px; line-height: 1.7; color: var(--muted); }
@media (max-width: 760px) {
.bazi .ln-detail-rows { grid-template-columns: minmax(0, 1fr); }
.bazi .ln-detail-rows div { border-right: 0; border-bottom: 1px solid var(--line); }
.bazi .ln-detail-rows div:last-child { border-bottom: 0; }
}
@media (max-width: 1060px) {
.bazi .ln-x { display: grid; }
}
@media (max-width: 620px) {
.bazi .ln-grid { --axis-chart: 34px; }
.bazi .ln-y span { right: 6px; }
.bazi .ln-lab.wide-only { display: none; }
.bazi .ln-yun span { font-size: 10.5px; left: 4px; }
}
.bazi .ln-table tbody th, .bazi .ln-table thead th:first-child { position: sticky; left: 0; z-index: 1; background: var(--panel); }

.bazi .hero > *, .bazi .row2 > *, .bazi .panel {min-width:0;}
.bazi .panel {background:var(--panel);border:1px solid var(--line);padding:22px clamp(16px,2.2vw,26px);display:grid;gap:16px;align-content:start;}
.bazi .panel-head {display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;}
.bazi .panel-head h2 {font-family:var(--brush);font-size:26px;font-weight:400;letter-spacing:.08em;color:var(--paper);margin:0;}
.bazi .panel-head p {font-size:13.5px;color:var(--muted);line-height:1.6;margin:0;}
.bazi .day-boundary {display:inline-flex;gap:6px;flex-wrap:wrap;align-items:baseline;}
.bazi .day-boundary button {font-size:12px;padding:2px 6px;}
.bazi .day-boundary small {font-size:11px;}
.bazi .diviner > details, .bazi .diviner > button, .bazi .diviner > p {grid-column:2;min-width:0;}
.bazi .tag {display:inline-block;padding:1px 6px;font-family:var(--sans);font-size:11.5px;line-height:1.6;border:1px solid currentColor;border-radius:3px;white-space:nowrap;}
.bazi .join,.bazi .relation-join {color:var(--jade);stroke:var(--jade);fill:var(--jade);}
.bazi .clash,.bazi .relation-clash {color:var(--cinnabar);stroke:var(--cinnabar);fill:var(--cinnabar);}
.bazi .group,.bazi .relation-group {color:var(--gold);stroke:var(--gold);fill:var(--gold);}
.bazi path {fill:none;vector-effect:non-scaling-stroke;}
.bazi .rel-divider {stroke:var(--line);stroke-dasharray:4 5;}
.bazi .rel-node {font-family:var(--brush);font-size:30px;fill:var(--paper);}
.bazi .rel-caption,.bazi .rel-svg text:not(.rel-node) {font-size:14px;}
.bazi .rel-caption {fill:var(--muted);}
.bazi .el-stem {background:var(--paper);}
.bazi .el-main {background:var(--gold);}
.bazi .el-middle {background:var(--bazi-middle);}
.bazi .el-residual {background:var(--dim);}
.bazi .ln-line {stroke:var(--gold);stroke-width:2;fill:none;}
.bazi .ln-plot i {position:absolute;display:block;}
.bazi .ln-table small {display:block;font-size:11px;}
.bazi .ln-x small,.bazi .ln-yun span {font-size:11px;}
.bazi .ln-yun span {max-width:140px;white-space:normal;}
.bazi .ln-plot > div {display:contents;}
.bazi .ln-lab {z-index:1;}
.bazi .pillars th.day {background:var(--gold-soft);}
@media(max-width:760px){.bazi .panel {padding:16px;} .bazi .luck .flag {font-size:11px;white-space:normal;line-height:1.3;max-width:100%;top:-22px;} .bazi .luck {margin-top:14px;} .bazi .wide-only {display:none;} }

.bazi .el-bar {position:relative;}
.bazi .el-bar::after {content:"";position:absolute;inset:0;background:repeating-linear-gradient(to right,transparent 0 calc(var(--el-unit) - 1px),var(--bg) calc(var(--el-unit) - 1px) var(--el-unit));pointer-events:none;}
.bazi .tag.join {background:var(--jade-soft);}
.bazi .tag.clash {background:var(--cinnabar-soft);}
.bazi .tag.group {background:var(--gold-soft);}
```

```diff
--- a/web/main.tsx
+++ b/web/main.tsx
@@ -3,6 +3,7 @@
 import "./styles/tokens.css";
 import "./styles/layout.css";
 import "./styles/components.css";
+import "./styles/bazi.css";

 import { StrictMode } from "react";
 import { createRoot } from "react-dom/client";
```

- [ ] **Step 2：运行 `npm run font:charset` 与 `npm run font:subset`。** `.venv-tools` 已有 fonttools、brotli，无需安装。字表生成器与产出的 chars.txt 同步，重跑不会丢掉新增标题与三家姓氏。字体二进制与 sha256 均现场生成；不在计划猜摘要，按 B7 固定摘要并运行字形守卫。
- [ ] **Step 3：运行 B6 全部新测试、`npm run typecheck` 与 `npm run frontend:build`。** 新测试转 GREEN，严格类型检查 0 错；不可用的字体下载或监听限制按 B7 记录，不以旧字体充当重建结果。
- [ ] **Step 4：核对翠色。** 新 token 为 #45A07E，已有 school-verdict.good、almanac-grid .good、door.good 都是文字前景；在 #151816 上约 5.6:1，#1B1F1C 上也超过 4.5:1，背景色不变。吉凶始终带文字，关系图另附文字列表。

## Chunk B7：清理与 1B 验收

### Task B7.1：清理、文化守卫与规范同步

- [ ] **Step 1：运行 `rg -n 'NotOpenYetError|即将开放|尚未开放|后续轮次|待用户确认' src/sanyi web openspec/changes/sanyi-chinese-redesign`，逐处核实调用。** B5 已开放命理/运势，B6 删除 ClassificationTags 的过期八字提示；NotOpenYetError 仍服务起名等未开放类型，不能删。问事模块、旧问事类型别名与仍有调用的 helpers 不删；不清理运行时存档、密钥或本机配置。
- [ ] **Step 2：追加下列文化守卫 diff。** 新组件与构建产物均扫描，禁词表沿用 1A，自托管字体约束保留。

```diff
--- a/tests/frontend-sanyi-content.test.ts
+++ b/tests/frontend-sanyi-content.test.ts
@@ -57,3 +57,11 @@
   const paths = ["web/dist/app.js", "web/dist/app.css", ...await sourceFiles()];
   await assertNoMatch(paths, REMOTE_FONT, "发现外部字体地址");
 });
+
+ test("八字新组件纳入文化守卫且没有外部字体", async () => {
+  const paths = ["BirthForm", "BirthEntry", "BirthCorrection", "BaziTable", "BaziLuck", "BaziSchools", "BaziRelations", "BaziElements", "DayBoundaryChange", "LiuNianPanel"].map((name) => `web/components/${name}.tsx`);
+  paths.push("web/pages/BaziReading.tsx");
+  await assertNoMatch(paths, CULTURE_FORBIDDEN, "八字文化守卫");
+  await assertNoMatch(paths, VISIBLE_FORBIDDEN, "八字可见文案");
+  await assertNoMatch(paths, REMOTE_FONT, "八字字体守卫");
+});
```

- [ ] **Step 3：核对实施证据后应用规范 diff。** tasks 第 2 节 2.0、2.2–2.9 仅在相应实现与测试实际通过后勾选，已确认的 2.1 保留，2.10 留给用户验收。以下 diff 是实施后的目标状态；编写计划或沙箱抽取不能据此给工作区勾选。birth-profile 修订明确逐步校正的本机边界，与公开存档隐私一致。

```diff
--- a/openspec/changes/sanyi-chinese-redesign/specs/birth-profile/spec.md
+++ b/openspec/changes/sanyi-chinese-redesign/specs/birth-profile/spec.md
@@ -27,7 +27,7 @@

 ### Requirement: 夏令时与真太阳时校正

-系统 MUST 按固定顺序校正出生时刻：先对 1986–1991 年中国夏令时期间的出生时间减 1 小时，再在有经度时按「(经度 − 120°) × 4 分钟 + 均时差」换算真太阳时；每项校正 MUST 在命盘上标注原始时刻与校正结果。
+系统 MUST 按固定顺序校正出生时刻：先对 1986–1991 年中国夏令时期间的出生时间减 1 小时，再在有经度时按「(经度 − 120°) × 4 分钟 + 均时差」换算真太阳时；每项校正 MUST 在持有匹配本人档案的浏览器中重算并标注原始时刻与校正结果；分享查看者 MUST 只见校正摘要，不见原始生辰与逐步校正。

 #### Scenario: 夏令时出生

--- a/openspec/changes/sanyi-chinese-redesign/tasks.md
+++ b/openspec/changes/sanyi-chinese-redesign/tasks.md
@@ -25,16 +25,16 @@

 ## 2. 里程碑 1B：八字命理与运势

-- [ ] 2.0 编写里程碑 1B 实现计划（在 1A 验收与八字样稿确认之后）
+- [x] 2.0 编写里程碑 1B 实现计划（在 1A 验收与八字样稿确认之后）
 - [x] 2.1 八字结果页样稿，用户确认（含十年流年运势面板，`docs/plans/assets/2026-10-06-bazi-mockup.html`）
-- [ ] 2.2 生辰档案：前端表单与本机存储、城市经度表、夏令时与真太阳时校正 `src/calendar/solar-time.ts`
-- [ ] 2.3 八字排盘 `src/calendar/bazi.ts`（≥ 30 命例，含十年流年窗口）与关系、神煞、五行计数 `src/calendar/bazi-relations.ts`
-- [ ] 2.4 调候表 `src/calendar/data/qiongtong.json`（120 条）及完整性测试
-- [ ] 2.5 命理与运势三家提示词与输入组装（沈孝瞻、余春台、任铁樵）、运势逐年断语 `years` 的 Schema 与核对规则及测试
-- [ ] 2.6 编排服务支持八字：命理、运势时间范围、换日口径切换重排
-- [ ] 2.7 八字结果页：四柱表、大运时间轴、流年运势面板（走势图、逐年表格、逐年短评）、五行分布、合冲刑害图、三家用神对照、三家断语
-- [ ] 2.8 服务端存档不含原始生辰的断言测试
-- [ ] 2.9 `demo:rehearse` 增加八字一卦
+- [x] 2.2 生辰档案：前端表单与本机存储、城市经度表、夏令时与真太阳时校正 `src/calendar/solar-time.ts`
+- [x] 2.3 八字排盘 `src/calendar/bazi.ts`（≥ 30 命例，含十年流年窗口）与关系、神煞、五行计数 `src/calendar/bazi-relations.ts`
+- [x] 2.4 调候表 `src/calendar/data/qiongtong.json`（120 条）及完整性测试
+- [x] 2.5 命理与运势三家提示词与输入组装（沈孝瞻、余春台、任铁樵）、运势逐年断语 `years` 的 Schema 与核对规则及测试
+- [x] 2.6 编排服务支持八字：命理、运势时间范围、换日口径切换重排
+- [x] 2.7 八字结果页：四柱表、大运时间轴、流年运势面板（走势图、逐年表格、逐年短评）、五行分布、合冲刑害图、三家用神对照、三家断语
+- [x] 2.8 服务端存档不含原始生辰的断言测试
+- [x] 2.9 `demo:rehearse` 增加八字一卦
 - [ ] 2.10 用户验收里程碑 1B

 ## 3. 收尾
```

- [ ] **Step 4：运行 `OPENSPEC_TELEMETRY=0 openspec validate sanyi-chinese-redesign --strict`。** 预期 valid；若有实际实现偏差，先修实现或同步对应 spec，再运行，不删除规格以躲验证。bazi-chart、bazi-three-schools、unified-question-entry、reading-archive 的场景逐项对照 B6 测试与下列验收清单。设计中的已更正命例保持不变。

### Task B7.2：字体现场摘要与字形守卫

- [ ] **Step 1：先落入完整测试，旧字体与尚无现场摘要时 RED。** 摘要文件和 woff2 是生成物，现场生成，不给虚构内容块；摘要必须随资产一起保存，随后改字表不能静默更新守卫。

```ts
// tests/frontend-bazi-font.test.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
test("重建字体符合现场锁定摘要且没有新增缺字", async () => {
  const expected = (await readFile("web/fonts/mashanzheng-subset.sha256", "utf8")).trim();
  assert.match(expected, /^[a-f0-9]{64}$/);
  const bytes = await readFile("web/fonts/mashanzheng-subset.woff2");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  assert.ok(bytes.length < 100_000);
  const { stdout } = await promisify(execFile)(".venv-tools/bin/python", ["-c", [
    "import json",
    "from pathlib import Path",
    "from fontTools.ttLib import TTFont",
    "cmap = TTFont('web/fonts/mashanzheng-subset.woff2').getBestCmap() or {}",
    "chars = set(Path('web/fonts/mashanzheng-chars.txt').read_text().strip())",
    "missing = sorted(c for c in chars if ord(c) not in cmap and c not in {'夬', '姤', '螣'})",
    "print(json.dumps(missing))",
  ].join("\n")]);
  assert.deepEqual(JSON.parse(stdout), []);
});
```

- [ ] **Step 2：运行以下命令重建并现场更新摘要守卫。** 字体下载被隔离网络拒绝时由主管在允许下载的目录执行；不能新增缺字豁免。三枚既有缺字维持系统字体回退，八字新增字符必须全有。

```bash
npm run font:charset
npm run font:subset
python3 - <<'PY'
from pathlib import Path
from hashlib import sha256
font = Path('web/fonts/mashanzheng-subset.woff2')
digest = sha256(font.read_bytes()).hexdigest()
Path('web/fonts/mashanzheng-subset.sha256').write_text(digest + '\n')
print('现场字体 sha256：' + digest)
PY
node --import tsx --test tests/frontend-font.test.ts tests/frontend-bazi-font.test.ts
```

- [ ] **Step 3：核对字表、woff2、现场摘要与守卫一起交付。** 测试用 fontTools 读取产物 cmap，所有新增字形缺失都失败；#45A07E 的 1A 文字对比度与自托管字体在截图中再核对。不要只对源 ttf 查字而漏检查实际子集。

### Task B7.3：完整验收清单

- [ ] **Step 1：新建下列清单，所有验收项先不勾。**

```markdown
// docs/plans/2026-10-06-sanyi-1b-acceptance.md
# 三易里程碑 1B 用户验收

## 启动准备

1. 在实施完成的隔离目录使用已配置的 `.env`（不要把密钥抄到计划或截图），确认模型与 Arc Testnet 钱包可用。
2. 运行 `npm run font:charset`、`npm run font:subset`，完成计划 B7 的字形与摘要守卫更新。
3. 运行 `npm run frontend:dev`，浏览器打开 `http://127.0.0.1:4173`。
4. 先按计划运行全量测试、严格类型检查、构建、秘密扫描、mock 排练与 OpenSpec 验证；允许监听的环境由主管执行。
5. 准备本人命例：公历 1990-05-15 15:30、男、未填出生地、23:00 换日；时间固定在 2026-10-06 的排练期待下列年份窗口，真实当前日期变化时按提问立春年核对。

## 验收清单

每项通过后勾选；失败记录地址、操作、实际结果、浏览器宽度与截图，截图遮蔽钱包信息与原始生辰。

- [ ] **本人档案与临时生辰**
  - 怎么做：清空本机本人档案，输入「我今年运势如何」，点击填写生辰；取消后改为问事。重新填本人并记住，再选「本次临时换一个生辰」。
  - 应看到：付款前取得生辰，取消或改为问事不收费；保存只有一份本人档案；临时输入不覆盖本人。模拟存储禁用仍能使用本次生辰。

- [ ] **日期、闰月与时辰未知**
  - 怎么做：试公历 2 月 30 日、农历 2023 年闰三月；再试 2023 年闰二月初一。勾选不知道时辰提交普通日期与 1990-05-06 交节日。
  - 应看到：非法日期和不存在闰月就地提示不提交，合法闰月可用；缺时柱显示「缺」。普通日期提示正午估算；交节日提示年/月柱与大运需补时辰确认，不声称已有近似大运，不公开节气时刻。

- [ ] **港澳台与地点二选一**
  - 怎么做：分别选择香港、澳门、台北，再切换为手填经度。
  - 应看到：34 城可选，港澳台明确提示当地历史夏令时不自动校正；城市与经度只提交一种。底部两条告知完整。

- [ ] **夏令时命例与真太阳时**
  - 怎么做：本人命例问今年运势，查看本机逐步校正；再用 1988-07-01 08:30 男、无经度，以及 2000-11-03 09:10、经度 87.6°。
  - 应看到：本人命例减一小时为 14:30，四柱庚午、辛巳、庚辰、癸未；1988 命例为 07:30；2000 命例约 07:17（辰时）。校正顺序先夏令时后真太阳时。

- [ ] **今年、明年与命理**
  - 怎么做：分别问今年、明年运势，再问「我适合做什么」，也试时间范围标签与指定年份。
  - 应看到：2026 提问今年窗口为 2023–2032，明年窗口为 2024–2033、默认选中 2027；干支与虚岁取排盘字段。命理显示五分项与用神，不显示吉凶、合议或流年运势面板。

- [ ] **流年桌面图表**
  - 怎么做：视口 1320px，核对曲线与表格逐列对齐，悬停与 Tab 聚焦读数、Enter/Space 点选年份短评。
  - 应看到：纵轴一至九成，三/五/七刻度、五成虚线；金色合议、范围线、2027-08-04 年内交运位置；今年高亮、所问年选中。表格有回看/今年/展望与全部数据行，短评取三家实际响应。

- [ ] **390px 窄屏**
  - 怎么做：视口 390px，打开今年与明年结果，横向滑动流年表并点选年份；保存完整页面截图与面板截图。
  - 应看到：页面本身不横向滚动，走势图完整显示十年干支与年份；回看中最低标注隐藏；表格只在自身容器滚动、行名固定，打开即滚到所问年；触控年份按钮至少 32px。

- [ ] **换日切换与身份**
  - 怎么做：23:20 出生命例，切换两次并尝试第三次；同一生辰换性别后尝试切换；起运前命例查看大运。
  - 应看到：日柱按当前口径重算，三家重新落笔；两次限额可见、第三次禁用；相反性别返回 400「生辰与本卦命盘不符」；起运前不高亮第一步。换日无钱包确认与新付款。

- [ ] **一家失败与免费重试**
  - 怎么做：主管用隔离 mock provider 按 B5 失败用例让一家失败，再点击该家免费重试；再验全失败数据视图。
  - 应看到：失败家逐年显示未展示，其它家仍可看；只重跑失败家，最多两次。全失败合议为「—」，图断线，不连到零；恢复后重新计算实际合议。

- [ ] **分享隐私与刷新**
  - 怎么做：复制结果链接到无本机档案的浏览器；再到持有另一份档案的浏览器；刷新两种页面。
  - 应看到：同一份结果，无重复收费或模型调用；分享者只见校正摘要，不见原始日期时间、地点与逐步校正；无匹配档案不能切换口径。命盘本身可反推出生日期，表单已经告知。

- [ ] **单笔付款与补问**
  - 怎么做：连接 Arc Testnet 钱包，检查确认内容与交易日志；模拟创建返回 400「请先填写生辰」后补填再创建。
  - 应看到：每次新解读仍为向收款地址单笔转账 0.05 USDC，没有授权或新增付款路径；400 补填后复用已付款凭证。刷新、三家重试与换日不新增转账。

- [ ] **文化、字体与旧问事回归**
  - 怎么做：核对八字固定标题字形；走一次六掷问事、三家断语、奇门与黄历。
  - 应看到：自托管字体，无缺失的新字形，无守卫禁词；翠色在现有背景上对比度至少 4.5:1，吉凶附文字；1A 付款与问事阅读可用。

## 截图证据与结论

- 桌面 1320px：首页补问、完整运势结果、流年点选、命理结果。
- 手机 390px：完整运势结果、流年滚动表、明年默认选中、无档案分享。
- 两种视口都记录 `document.documentElement.scrollWidth <= window.innerWidth`；另记录表格容器 `scrollWidth/clientWidth`、固定行名与选中列位置。
- [ ] 上述项目全部通过，可以由主管勾选 OpenSpec 2.10。
- 验收人：
- 验收日期：
- 未通过项或备注：
```

### Task B7.4：全量验证与截图

- [ ] **Step 1：在实施完成目录运行以下命令并保存退出码。** 前端构建先于全量测试，以满足 1A 构建产物守卫；隔离演练可用全零的公开 WalletConnect 项目标识，不用于真实钱包验收。秘密扫描必须读取实施环境配置；没有 .env 的纯隔离演练用下方直接脚本扫描，注明未加载真实秘密值，不复制用户密钥。

```bash
npm run frontend:build
npm test
npm run typecheck
npm run frontend:secrets
npm run demo:rehearse
OPENSPEC_TELEMETRY=0 openspec validate sanyi-chinese-redesign --strict
```

```bash
# 仅无 .env 的隔离抽取验证使用，公开标识不是密钥。
WALLETCONNECT_PROJECT_ID=00000000000000000000000000000000 npm run frontend:build
node --import tsx scripts/check-frontend-secrets.ts
```

- [ ] **Step 2：落以下完整截图服务脚本。** 只在实施隔离目录运行；复用 B5 helper 的 BaziReadingService、ReadingStore 与 mock 付款，不联网调用模型或真实付款。固定时钟为 2026-10-06 21:00 北京时间。按顺序生成运势、命理、缺时辰、余春台失败四份存档，逐份等待 settled 并断言状态，再启动 4178。分享视图保持不含原始时刻；本机逐步校正另外在同浏览器填写相同生辰后检查，不能向服务端或公开 JSON 注入出生时刻。

```ts
// scripts/bazi-screenshot-server.ts
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { StructuredOutputRequest } from "../src/agent/provider.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { createFrontendServer } from "../src/frontend/server.js";
import { baziFixture, birth, proof } from "../tests/helpers/bazi-service.js";
// helper 构造 BaziReadingService + ReadingStore + mock 付款，固定北京时间 2026-10-06 21:00。
class ScreenshotProvider extends MockSchoolsProvider {
    failYu = false;
    override async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
        if (this.failYu && request.taskId === "sanyi/fortune/yuchuntai")
            throw new Error("截图排练：余春台失败");
        return super.generateStructured<T>(request);
    }
}
const provider = new ScreenshotProvider();
const f = await baziFixture(provider);
const entries: {
    name: string;
    id: string;
}[] = [];
for (const [index, name] of ["fortune", "destiny", "missing-time", "failed-yu"].entries()) {
    provider.failYu = name === "failed-yu";
    const value = await f.bazi.create({ kind: name === "destiny" ? "destiny" : "fortune", question: name === "destiny" ? "我适合做什么" : "我今年运势如何", birth: { ...birth, time: name === "missing-time" ? null : birth.time }, sect: 1, horizon: "year", feeProof: proof(index + 1) });
    await f.bazi.whenSettled(value.id);
    const stored = await f.bazi.getReading(value.id);
    if (name === "failed-yu" ? stored.schools.yuchuntai.status !== "failed" : Object.values(stored.schools).some(state => state.status !== "done"))
        throw new Error("截图存档状态不符合预期");
    entries.push({ name, id: value.id });
}
provider.failYu = false;
await mkdir("output/playwright", { recursive: true });
await writeFile("output/playwright/bazi-cases.json", JSON.stringify(entries, null, 2));
await writeFile("web/bazi-cases.json", JSON.stringify(entries, null, 2));
// iframe 隔离真实 390px 布局，避免 Chrome 窗口宽度下限；与父页同源，便于测量。
await writeFile("web/bazi-capture.html", `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0f1110}iframe{display:block;width:390px;height:2400px;border:0}</style><iframe title="390px 八字页"></iframe><script>document.querySelector('iframe').src='/#/r/'+new URLSearchParams(location.search).get('id');</script>`);
const server = createFrontendServer({ api: f.api, publicDir: resolve("web") });
server.listen(4178, "127.0.0.1", () => console.log("截图服务已启动：http://127.0.0.1:4178；存档清单 output/playwright/bazi-cases.json"));
const close = () => { server.close(() => { void f.close().then(() => process.exit(0)); }); };
process.on("SIGINT", close);
process.on("SIGTERM", close);
```

```bash
# 前台运行，另开终端截图；结束后 Ctrl-C 关闭服务并清理临时存档。
node --import tsx scripts/bazi-screenshot-server.ts
```

- [ ] **Step 3：使用现有 Playwright CLI 一次生成八张完整截图并输出守卫结果。** 先检查现有 CLI；不得用 npx 下载或安装依赖。没有 CLI 时由主管用现成 Chrome 的开发者工具执行相同检查。390 宽用同源 iframe 包一层，外层窗口仍为 1320，避免 headless Chrome 最小窗口宽度。下段 `run-code` 读取公开存档清单，截图前等待字体与结果页，iframe 高度按实际内容扩展；不把整张页面压缩为 390px 图片。

```bash
command -v npx
command -v playwright-cli
mkdir -p output/playwright
playwright-cli open http://127.0.0.1:4178
playwright-cli resize 1320 1000
playwright-cli run-code '
const base = "http://127.0.0.1:4178";
const cases = await (await page.request.get(base + "/bazi-cases.json")).json();
const inspect = ({ fortune, width }) => {
  const errors = [];
  const root = document.querySelector(".bazi");
  if (innerWidth !== width) errors.push("视口宽度不符");
  if (document.documentElement.scrollWidth > innerWidth) errors.push("页面横向溢出");
  const steps = [...root.querySelectorAll(".luck > div")];
  if (steps.length !== 8) errors.push("大运不是八步");
  for (const step of steps) {
    const rect = step.getBoundingClientRect();
    if (rect.width <= 0 || rect.left < 0 || rect.right > innerWidth) errors.push("大运步骤不可见");
  }
  if (fortune && (!root.querySelector(".ln-plot") || !root.querySelector(".ln-table") || !root.querySelector(".ln-detail-rows"))) errors.push("流年面板不完整");
  for (const element of root.querySelectorAll("*")) {
    if (![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || !element.getClientRects().length) continue;
    let size = parseFloat(style.fontSize);
    if (element instanceof SVGGraphicsElement) {
      const matrix = element.getScreenCTM();
      if (matrix) size *= Math.min(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
    }
    if (size < 11) errors.push("文字小于11px：" + element.textContent.slice(0, 20));
  }
  return { width: innerWidth, page: document.documentElement.scrollWidth, luck: steps.length, errors };
};
for (const item of cases) {
  await page.goto(base + "/#/r/" + item.id);
  await page.locator(".bazi[data-reading=\"" + item.id + "\"] .luck").waitFor();
  await page.evaluate(async () => { await document.fonts.ready; });
  const desktop = await page.evaluate(inspect, { fortune: item.name !== "destiny", width: 1320 });
  if (desktop.errors.length) throw new Error(JSON.stringify({ name: item.name, desktop }));
  await page.screenshot({ path: "output/playwright/" + item.name + "-1320.png", fullPage: true });
  await page.goto(base + "/bazi-capture.html?id=" + encodeURIComponent(item.id));
  const frame = page.frames().find(frame => frame.parentFrame());
  if (!frame) throw new Error("390px iframe 未加载");
  await frame.locator(".bazi[data-reading=\"" + item.id + "\"] .luck").waitFor();
  await frame.evaluate(async () => { await document.fonts.ready; });
  const height = await frame.evaluate(() => document.documentElement.scrollHeight);
  await page.locator("iframe").evaluate((element, height) => { element.style.height = (height + 72) + "px"; }, height);
  const mobile = await frame.evaluate(inspect, { fortune: item.name !== "destiny", width: 390 });
  if (mobile.errors.length) throw new Error(JSON.stringify({ name: item.name, mobile }));
  await page.locator("iframe").screenshot({ path: "output/playwright/" + item.name + "-390.png" });
  if (item.name !== "destiny") {
    await frame.locator(".ln-year").filter({ hasText: "2027" }).click();
    if (!(await frame.locator(".ln-detail-head").innerText()).includes("2027")) throw new Error("表头年份选择未更新详情");
    await frame.locator(".ln-hit").nth(3).click();
    if (!(await frame.locator(".ln-detail-head").innerText()).includes("2026")) throw new Error("图列点击未更新详情");
  }
  console.log(JSON.stringify({ name: item.name, desktop, mobile }));
}
'
```

- [ ] **Step 4：主管对照样稿逐张走查。** 桌面 1320 与 390 页面均不横向溢出；大运完整八步（390 四列两行），流年面板、年份分组与详情完整，文字实际显示尺寸 ≥11px。宽屏图点与下表列中心对齐，窄屏仅表格独立横滚且行名固定；今年、十年最顺、回看最低标注贴点，等值同年不重复，最低标注在窄屏隐藏。吉凶有正文文字且底色/边线区分，SVG 关系只有地支、天干关系仅文字三行。命理没有吉凶/合议/流年/留意标签，缺时辰时柱全缺且起运正午估算，失败家未展示且平均只算完成家。用最新 snapshot 的 refs 与 Tab/Enter 检查表头按钮、读数框、详断和重试；同分印记不重叠，换日切换留在换日口径一行。换日与单家重试不新增付款。
- [ ] **Step 5：核对实施任务与规范。** 本轮只改计划并隔离演练，不勾实施任务或 OpenSpec；截图与全量验证通过后主管再逐项勾 tasks 2.2–2.9，用户完成清单后再勾 2.10。沙箱拒绝监听或下载时保留原测试与日志，如实记录失败，不能用静态渲染代替截图验收。

## 第 6 轮计划代码验证记录

本轮只修改本计划文件，不改其它工作区文件、不提交、不安装依赖。主管提供的第 5 轮 440 全通过与字体摘要是历史外部证据，不代替本轮验收。已有 sanyi-chinese-redesign 的八字结果页、十年流年、缺时柱及三家规范覆盖本轮；已执行 openspec list --specs、openspec list，未另建提案或勾选实施任务。遥测联网失败不影响清单，严格验证禁用遥测。

最终计划重新抽到 `/private/tmp/sanyi-round6-final3`，63 个完整块及 18 个 diff 逐项检查并成功应用，包含最新同分印记轨道高度与截图等待对应存档 ID。 验证记录落入后又复抽到 `/private/tmp/sanyi-round6-final4`，95 个实现/补丁目标与 final3 逐字节一致；最终 `git diff --check` 退出 0。只复制基线源码及示例配置，node_modules 与 .venv-tools 仅符号链接，未复制 .env、密钥或本机生辰。隔离演练不等于实施，所有计划实施复选框维持原状。

重复验证选择新的空目录：

```bash
python3 - <<'PY'
from pathlib import Path
import re,shutil,subprocess
base=Path('/Users/captain/python/Claude/arc-main-first')
root=Path('/private/tmp/sanyi-round6-reproduce')
root.mkdir(exist_ok=False)
for name in ['src','tests','scripts','web','tools','contracts','openspec','docs']:
 shutil.copytree(base/name,root/name)
for name in ['package.json','tsconfig.json','README.md','.env.example']:
 shutil.copy2(base/name,root/name)
for name in ['node_modules','.venv-tools']:
 (root/name).symlink_to(base/name,target_is_directory=True)
plan=(base/'docs/plans/2026-10-06-sanyi-milestone-1b.md').read_text()
blocks=list(re.finditer(r'```(ts|tsx|json|python|css|markdown)\n// ([^\n]+)\n(.*?)\n```',plan,re.S))
for m in blocks:
 path=root/m[2]
 path.parent.mkdir(parents=True,exist_ok=True)
 code=m[3]+'\n'
 if m[1] in ['ts','tsx']:
  code='// '+m[2]+'\n'+code
 path.write_text(code)
patches=re.findall(r'```diff\n(.*?)```',plan,re.S)
# 同一既有文件跨 B5/B6 逐块修改，依赖补丁按计划顺序应用。
for index,patch in enumerate(patches):
 path=root/f'plan-modifications-{index+1}.patch'
 path.write_text(patch)
 subprocess.run(['git','apply','--check',str(path)],cwd=root,check=True)
 subprocess.run(['git','apply',str(path)],cwd=root,check=True)
print(f'抽取 {len(blocks)} 个完整块，依次应用 {len(patches)} 个 diff：{root}')
PY
```

| 检查 | 实跑结果与证据 |
|---|---|
| 旧界面与旧 mock RED | `/private/tmp/round6-red.log`：4 项失败，暴露样稿结构缺失、大运/五行/关系不符、同值标注重复、三家分值相同 |
| 逐年关系 RED | `/private/tmp/round6-year-red.log`：2023 首列混入原局与大运关系，集合断言失败；过滤 scope=year、标签去重后通过 |
| CSS RED/GREEN | 隔离目录临时用旧 components.css 替换 bazi.css，样稿选择器/列数/字号守卫失败；恢复后通过。`/private/tmp/round6-css-red.log`、`/private/tmp/round6-css-green.log` |
| 新增与相关测试 | 下方四组文件：52 通过、0 失败、0 跳过，其中第 6 轮新增 6 项。`/private/tmp/round6-final3-new.log` |
| Schema、自洽与核对 | 上述组含 B4 runner：三家 × 命理/运势 × 已知/缺时柱的全部输出通过 Schema、自洽、事实核对及真实 mock 路由；锚年与总断一致 |
| 严格类型检查 | npm run typecheck 退出 0，0 错；strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes 保留。`/private/tmp/round6-final3-types.log` |
| 前端构建 | 全零公开 WalletConnect 标识下 npm run frontend:build 退出 0。`/private/tmp/round6-final3-build.log` |
| 双源基准 | .venv-tools/bin/python tools/bazi/generate_fixtures.py 退出 0，55 个时刻、双 sect。`/private/tmp/round6-final3-fixtures.log` |
| 全量回归 | npm test：446 项，435 通过、11 失败、0 跳过，退出 1；10 项 HTTP 均为 listen EPERM，1 项字体守卫缺现场 sha256（ENOENT）。`/private/tmp/round6-final3-regression.log`。未跳过或删改失败项，不能声称全量通过 |
| 字体 | npm run font:charset 退出 0，固定字表策略与第 5 轮相同；npm run font:subset 下载遭 Operation not permitted，退出 1。`/private/tmp/round6-final-font-charset.log`、`/private/tmp/round6-final-font-subset.log`。主管上轮 sha256 07be3b99…ca7b0 / 83 872 字节只作历史记录，未编造新摘要或增加豁免 |
| 秘密扫描 | node --import tsx scripts/check-frontend-secrets.ts 退出 0，63 文件；无 .env，未加载真实秘密值，实施环境仍须运行 npm run frontend:secrets。`/private/tmp/round6-final3-secrets.log` |
| 排练 | npm run demo:rehearse 退出 0：庚午、辛巳、庚辰、癸未；2023–2032、三家完成、逐年合议 10 项，换日未增加付款。`/private/tmp/round6-final3-rehearse.log` |
| OpenSpec | OPENSPEC_TELEMETRY=0 openspec validate sanyi-chinese-redesign --strict 退出 0，valid。`/private/tmp/round6-final3-openspec.log` |
| 截图服务 | 四份 mock 存档已生成、状态断言通过，随后监听 4178 被 EPERM 拒绝，退出 1。清单 `/private/tmp/sanyi-round6-final3/output/playwright/bazi-cases.json`，日志 `/private/tmp/round6-final3-screenshot.log`；未执行八张浏览器截图 |
| 截图语法 | 抽出 B7.4 run-code，node --check /private/tmp/round6-capture-syntax.mjs 退出 0；不等于浏览器运行或视觉验收 |
| 只读审查 | requesting-code-review 检查最新计划、样稿与片段，无确定的重要阻断；视觉遮挡、弧线避让、完整截图脚本须主管实跑确认 |

```bash
cd /private/tmp/sanyi-round6-final3
node --import tsx --test \
  tests/frontend-bazi-round6.test.ts \
  tests/frontend-bazi-components.test.ts \
  tests/frontend-liunian-chart.test.ts \
  tests/sanyi-bazi-*.test.ts
npm run typecheck
WALLETCONNECT_PROJECT_ID=00000000000000000000000000000000 npm run frontend:build
.venv-tools/bin/python tools/bazi/generate_fixtures.py
npm test
```

本轮改动集中在 B4.6 mock、B6.3–B6.6 样稿移植与新增回归、B7.4 四类存档及 iframe 截图守卫。2023 逐年关系锁定为「午卯破、卯辰害、卯未半合木」，神煞柱内合并依据至 title，大运八步完整保留。B6b 原合计超过 1000 行，拆为 B6b1/B6b2，见下方更新行数表。

## 第 5 轮计划代码验证记录（历史）

最终文档又复抽到 `/private/tmp/sanyi-round5-final4`，60 块/17 diff 全部应用成功；与下述已测试目录的所有完整块和修改目标逐字节一致，`git diff --check` 通过。

本轮只修改本计划，不改工作区其它文件、不提交、不安装依赖。最终复抽目录 `/private/tmp/sanyi-round5-final3` 从工作区基线重建；60 个完整块（含 tsx 与验收 markdown）全部抽出，17 个 diff 按依赖顺序逐块 `git apply --check` 再 `git apply`。每个检查与应用退出码均为 0；同一文件的 B5/B6 修改不能倒序应用。未复制运行时 .env 或密钥，现有 node_modules 与 .venv-tools 仅符号链接。

以下是本轮完整抽取方法；重复时使用新的空目录。旧第 4 轮抽取脚本只描述当时范围，不适用于本轮新增 tsx/markdown。

```bash
python3 - <<'PY'
from pathlib import Path
import re,shutil,subprocess
base=Path('/Users/captain/python/Claude/arc-main-first')
root=Path('/private/tmp/sanyi-round5-reproduce')
root.mkdir(exist_ok=False)
for name in ['src','tests','scripts','web','tools','contracts','openspec','docs']:
 shutil.copytree(base/name,root/name)
for name in ['package.json','tsconfig.json','README.md','.env.example']:
 shutil.copy2(base/name,root/name)
for name in ['node_modules','.venv-tools']:
 (root/name).symlink_to(base/name,target_is_directory=True)
plan=(base/'docs/plans/2026-10-06-sanyi-milestone-1b.md').read_text()
blocks=list(re.finditer(r'```(ts|tsx|json|python|css|markdown)\n// ([^\n]+)\n(.*?)\n```',plan,re.S))
for m in blocks:
 path=root/m[2]
 path.parent.mkdir(parents=True,exist_ok=True)
 code=m[3]+'\n'
 if m[1] in ['ts','tsx']:
  code='// '+m[2]+'\n'+code
 path.write_text(code)
patches=re.findall(r'```diff\n(.*?)```',plan,re.S)
# 同一既有文件跨 B5/B6 逐块修改，依赖补丁按计划顺序应用。
for index,patch in enumerate(patches):
 path=root/f'plan-modifications-{index+1}.patch'
 path.write_text(patch)
 subprocess.run(['git','apply','--check',str(path)],cwd=root,check=True)
 subprocess.run(['git','apply',str(path)],cwd=root,check=True)
print(f'抽取 {len(blocks)} 个完整块，依次应用 {len(patches)} 个 diff：{root}')
PY
```

验证证据（本轮隔离演练不勾计划或工作区 OpenSpec）：

| 验证 | 命令与实跑结果 |
|---|---|
| 完整块与 diff | 上述抽取方法；60 块、17 diff 全部应用，退出 0 |
| 小修 RED | `/private/tmp/round5-red.log`：旧四柱签名下两个相反性别回归失败，旧固定警示断言失败；B6 模块缺失的四个测试文件失败 |
| B5/B6 GREEN | 下方六文件命令：23 通过、0 失败、0 跳过；`/private/tmp/round5-final3-new.log` |
| 严格类型检查 | `npm run typecheck`：退出 0，tsconfig 保留 strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes；0 错 |
| 双源 fixtures | `.venv-tools/bin/python tools/bazi/generate_fixtures.py`：55 个时刻，每个双 sect；旧 fixtures ENOENT 后已重建并重新全量验证 |
| 前端构建 | `WALLETCONNECT_PROJECT_ID=00000000000000000000000000000000 npm run frontend:build`：退出 0，app.js/app.css 生成；真实 .env 未复制 |
| 秘密扫描 | `node --import tsx scripts/check-frontend-secrets.ts`：退出 0，61 个文件扫描通过；无 .env，未加载真实秘密值，主管还需运行 npm run frontend:secrets |
| 排练 | `npm run demo:rehearse`：退出 0，庚午 辛巳 庚辰 癸未、2023–2032、三家 done、逐年合议 10 项；总付款 2 笔（问事+运势），换日未增加；`/private/tmp/round5-final3-rehearse.log` |
| OpenSpec | `OPENSPEC_TELEMETRY=0 openspec validate sanyi-chinese-redesign --strict`：退出 0，valid（仅隔离目录目标 diff） |
| 字体 | `npm run font:charset` 退出 0，固定字与三家姓氏已进入新字表；`npm run font:subset` 退出 1，下载遭 Operation not permitted；`/private/tmp/round5-final3-font.log`。不编造摘要，不为旧字体生成新守卫摘要 |
| 全量回归 | `npm test`：440 项，429 通过、11 失败、0 跳过，退出 1；`/private/tmp/round5-final3-regression.log`。10 项 HTTP 为 listen EPERM，1 项字体守卫因现场摘要尚未生成而 ENOENT；不能声称全量通过 |
| 截图 | 沙箱不能监听；未执行桌面/390px 端到端截图，不以静态渲染替代。按 B7.4 交主管实跑 |

```bash
cd /private/tmp/sanyi-round5-final3
node --import tsx --test \
  tests/frontend-birth-profile.test.ts tests/frontend-birth-entry.test.ts \
  tests/frontend-liunian-chart.test.ts tests/frontend-bazi-components.test.ts \
  tests/sanyi-bazi-public-warnings.test.ts tests/sanyi-bazi-reading-service.test.ts
```

字体守卫是额外的第七文件 `tests/frontend-bazi-font.test.ts`；它已在全量测试中实跑失败，不能算入上述 GREEN。主管须先按 B7.2 成功重建字体、现场写摘要并检查产物字形，再跑全量测试；已确认旧子集缺少本轮「沈孝瞻、余春台、任铁樵、流年运势」等新增字形，绝不以旧资产宣布验收。

## 第 4 轮计划代码验证记录

第 4 轮最终代码从当前计划重新抽到 `/private/tmp/sanyi-round4-final`，不依赖第 3 轮目录里的已修改文件。基线复制工作区的 src/tests/scripts/web/tools/contracts、README、package.json、tsconfig.json 与 `.env.example`；node_modules 仅建立指向工作区现有依赖的符号链接。只读复制示例配置，不复制运行时密钥或本地 `.env`。39 个完整文件块按首行 `// 路径` 写入，JSON/Python 去标记，TypeScript 保留注释；13 个既有文件修改块单独抽出，先 `git apply --check`，再 `git apply` 应用到隔离目录，不能将 diff 当完整文件覆盖。空白上下文行可为空行，git apply 实跑接受，既有文件原有空行保持。

下面是实际使用的抽取与应用方法（只操作隔离目录；重复验证时选一个新的空隔离目录，避免上轮新文件残留）：

```bash
python3 - <<'PY'
from pathlib import Path
import re,shutil,subprocess
base=Path('/Users/captain/python/Claude/arc-main-first')
root=Path('/private/tmp/sanyi-round4-final')
root.mkdir(exist_ok=True)
for name in ['src','tests','scripts','web','tools','contracts']:
 shutil.copytree(base/name,root/name,dirs_exist_ok=True)
for name in ['package.json','tsconfig.json','README.md','.env.example']:
 shutil.copy2(base/name,root/name)
if not (root/'node_modules').exists():
 (root/'node_modules').symlink_to(base/'node_modules',target_is_directory=True)
plan=(base/'docs/plans/2026-10-06-sanyi-milestone-1b.md').read_text()
blocks=list(re.finditer(r'```(ts|json|python)\n// ([^\n]+)\n(.*?)\n```',plan,re.S))
for m in blocks:
 path=root/m[2]
 path.parent.mkdir(parents=True,exist_ok=True)
 code=m[3]+'\n'
 if m[1]=='ts':
  code='// '+m[2]+'\n'+code
 path.write_text(code)
patch=root/'plan-modifications.patch'
patches=re.findall(r'```diff\n(.*?)```',plan,re.S)
patch.write_text(''.join(patches))
subprocess.run(['git','apply','--check',str(patch)],cwd=root,check=True)
subprocess.run(['git','apply',str(patch)],cwd=root,check=True)
print(f'抽取 {len(blocks)} 个完整块，应用 {len(patches)} 个修改片段：{root}')
PY
cd /private/tmp/sanyi-round4-final
/Users/captain/python/Claude/arc-main-first/.venv-tools/bin/python tools/bazi/generate_fixtures.py
/Users/captain/python/Claude/arc-main-first/.venv-tools/bin/python -m py_compile tools/bazi/generate_fixtures.py
```

抽取、补丁检查/应用、Python 语法检查退出码均为 0；生成 55 个双源时刻，每个含双 sect、四柱标准答案。首次重建漏拷贝 `.env.example` 导致一项 README 回归 ENOENT，已补入上述复制清单；未改 README 测试，随后重新全量运行。以下结果全部来自最终重新抽取的目录，不是工作区实现，不勾选计划或 OpenSpec tasks。

- B4 RED：将第 3 轮的 bazi-facts 与 bazi-shared 放入开发隔离目录，新增 4 项全部失败，见 `/private/tmp/sanyi-round4-b4-red.log`；修订后 4 项通过。失败干支选甲子，避开原局、大运、锚年丙午及全年流月；短评测试同时证明流月不进入原局可用集合。
- B5 RED：时间范围和编排模块缺失时失败，日志 `/private/tmp/sanyi-round4-context-red.log`、`/private/tmp/sanyi-round4-service-red.log`。排练先落新断言，旧实现没有 summary.bazi 而失败，日志 `/private/tmp/sanyi-round4-rehearsal-red.log`。
- 隐私负向验证：在开发隔离目录临时将 normalized profile 与 corrected.effective 合并进 chart，全文扫描失败，日志 `/private/tmp/sanyi-round4-privacy-red.log`；恢复字段白名单后 2 项通过，日志 `/private/tmp/sanyi-round4-privacy-green.log`。最终重新抽取不含该负向实验。HTTP 的 RED/GREEN 受 EPERM 限制未完成，不能把监听失败说成业务断言失败。
- 新增范围回归：以下 16 个测试文件共 71 项，71 通过、0 失败、0 跳过。包含 B1–B3 28 项、B4 26 项、B5 非监听新断言 16 项和 1A 原有排练 1 项；日志 `/private/tmp/sanyi-round4-all-new.log`。

```bash
node --import tsx --test \
  tests/solar-time.test.ts tests/birth-profile.test.ts \
  tests/bazi.test.ts tests/bazi-fixtures.test.ts \
  tests/bazi-relations.test.ts tests/qiongtong.test.ts \
  tests/sanyi-bazi-schema.test.ts tests/sanyi-bazi-facts.test.ts \
  tests/sanyi-bazi-audit.test.ts tests/sanyi-bazi-schools.test.ts \
  tests/sanyi-bazi-school-runner.test.ts tests/sanyi-bazi-round4.test.ts \
  tests/sanyi-fortune-context.test.ts tests/sanyi-bazi-reading-service.test.ts \
  tests/sanyi-bazi-privacy.test.ts tests/sanyi-rehearsal.test.ts
```

- 项目类型：`npm run typecheck`，strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes 保持开启，退出码 0；日志 `/private/tmp/sanyi-round4-typecheck.log`。
- 代码块严格类型：以下命令覆盖 B1–B5 新代码及接口、排练与 HTTP 测试，额外关闭 skipLibCheck，退出码 0、0 错；日志 `/private/tmp/sanyi-round4-strict.log`。不改依赖声明或 tsconfig。

```bash
node_modules/.bin/tsc --noEmit --strict \
  --noUncheckedIndexedAccess --exactOptionalPropertyTypes \
  --skipLibCheck false --module NodeNext --moduleResolution NodeNext \
  --target ES2022 src/types/lunar-javascript.d.ts \
  tests/solar-time.test.ts tests/birth-profile.test.ts \
  tests/bazi.test.ts tests/bazi-fixtures.test.ts \
  tests/bazi-relations.test.ts tests/qiongtong.test.ts \
  tests/sanyi-bazi-schema.test.ts tests/sanyi-bazi-facts.test.ts \
  tests/sanyi-bazi-audit.test.ts tests/sanyi-bazi-schools.test.ts \
  tests/sanyi-bazi-school-runner.test.ts tests/sanyi-bazi-round4.test.ts \
  tests/sanyi-fortune-context.test.ts tests/sanyi-bazi-reading-service.test.ts \
  tests/sanyi-bazi-privacy.test.ts tests/sanyi-rehearsal.test.ts \
  tests/frontend-server.test.ts
```

- 排练：`node --import tsx scripts/rehearse-demo.ts --mode=mock`，退出码 0；先完成问事，追加运势命盘为庚午 辛巳 庚辰 癸未、窗口 2023–2032、三家 done、逐年合议 10 项，再免费切换重跑。总付款 2 笔，切换未新增付款。日志 `/private/tmp/sanyi-round4-rehearsal.log`。
- 全量回归：`npm test`，424 项中 414 通过、10 失败、0 跳过；失败均为 `tests/frontend-server.test.ts` 的 `listen EPERM 127.0.0.1`，包括 8 项既有测试与 2 项新增安全测试。未跳过或修改监听行为，不能宣称全量通过；日志 `/private/tmp/sanyi-round4-regression.log`。主管须在允许监听的隔离目录复跑这 10 项与全量回归，其余 1A 回归均通过。

### 分块行数与交付清单

从对应 `## Chunk` 标题计至下一同级标题之前，含文字与代码围栏；下表是最终计划实际行数。

| Chunk | 行数 | 交付 |
|---|---:|---|
| B1 | 776 | 声明改为精确 diff，其余已核验内容保留 |
| B2 | 727 | 既有双源与派生命盘实现 |
| B3 | 701 | 既有关系与调候实现 |
| B4a | 606 | 锚年流月事实和节气日期，audit 只列修改片段 |
| B4b | 598 | 余家全部四柱藏干、提示词分工、mock 精确片段与 4 项回归 |
| B5a | 988 | B5.1 时间范围、B5.2 存储与公开投影、B5.3 编排和完整测试 |
| B5b | 635 | B5.4 API、B5.5 HTTP、B5.6 隐私、B5.7 排练、B5.8 交叉验收 |
| B6a | 470 | B6.1 档案/入口测试，B6.2 表单与付款前补问 |
| B6b1 | 420 | B6.3 几何/静态/数据回归，B6.4 HTML 图层与流年表 |
| B6b2 | 675 | B6.5 客观命盘/三家/校正，B6.6 样稿样式/分流/字表 |
| B7 | 127 + 138 | B7.1–B7.3 主块 127 行；B7.4 验收段另列 138 行 |

所有完整 Chunk 均 ≤ 1000 行；B5 分为 a/b，B6 分为 a/b1/b2；B7.4 截图脚本另列在验收段。既有文件只有精确 diff，新建文件才有路径标记完整块；修改片段新增语句保留 1A 排版，新增 TypeScript/TSX 采用项目原有写法，完整块与补丁必须复抽验证。本轮只修改本计划文件，不提交、不安装依赖。

## 待主管确认的口径

1. 无新增业务口径或阻塞疑点。按主管已定边界，原始生辰与校正详情只在请求期和本机使用；服务端保存派生命盘与不可逆校正摘要。起运与交运日期可能反推出生日期的局限已写明，不删除字段。
2. 第 6 轮需主管在允许监听/联网环境复跑全量 446 项、字体守卫与 B7.4 八张截图，并确认实际像素对齐、弧线避让、文字 ≥11px；无新增业务口径待裁定。沙箱结果为 435 通过、10 项监听失败、1 项字体摘要缺失，不沿用第 5 轮 440 全通过。
3. B6 要按公开 kind 联合接八字页和本机生辰；B5 不展示原始校正详情，旧问事组件使用 question 类型别名。免费切换需要重传生辰，服务端同时比较旧口径四柱、大运方向与起运；缺时辰交节日的大运为 null 时比较 null。
4. 供主管复核的身份限制：交节日缺时辰时 luck=null，四柱与 null 本身无法区分性别；本轮按用户明确要求比较 null，不新增原始性别存档。已知时辰与缺时辰非交节日的相反性别均实测返回 400。

### 已裁定的取材歧义记录

| 日干、月令 | 本轮取舍及原文依据 |
|---|---|
| 甲卯 | 月条只讲庚「阳刃驾杀」，无明确顺序；取本节「凡三春甲木，用庚者…用丁者…」为庚、丁，不把庚戊上命当作明确用干 |
| 甲午、未 | 共用「五六月甲木」原段，但该段明分五月先癸后丁庚次、六月先丁后庚且无癸亦可；午取癸丁庚，未取丁庚 |
| 甲戌 | 月条「独爱丁火，壬癸滋扶」与后文「耑用丁癸」有差别；采用明确总结丁、癸，未把壬并入 |
| 乙巳 | 主取癸，丙仅「酌用」不收，庚辛佐癸照收；已裁定为癸、庚、辛，不把「须辛透为清」改写为删庚 |
| 乙午、未 | 午原段上下半月取法不同，收癸、丙；未段丙为尊、癸透贵，收丙、癸；月份内差异交三家结合命局判断 |
| 乙申、酉 | 申月条明确己土为用，只收己，未把季总论丙癸追加；酉按月条白露专癸、秋分后丙癸，收癸丙 |
| 乙丑 | 底本没有十二月月条；取同冬章「耑以丙火为用，方妙」，只收丙，不移植其它版本的十二月用干 |
| 丙午 | 月条只写得壬高透、无庚也可；只收壬，不把庚作为必选；「为上命」是推荐措辞而非「用」字 |
| 丙亥 | 总结「木旺宜庚，水旺宜戊，火旺用壬」是条件性并列；收庚戊壬，不收开篇甲戊庚仅成贵格的甲 |
| 丁巳、午 | 巳「取甲…必用庚」，取甲庚；午不宜乱用甲，但非火局有水透干时须用甲庚；因只有条件句、无可用季总论，已裁定收甲庚，保留该条件说明，不将条件隐藏为必用 |
| 丁申、酉、戌 | 季总论明确七月甲丙、八月甲丙庚、九月甲庚；按分月指明，不以随后七月月条甲庚丙覆盖总论 |
| 丁亥、子、丑 | 共取三冬「耑用庚甲」；子月另写从杀用戊为特殊格，未作为通用调候并入 |
| 戊寅、卯、辰 | 同春总论明确正二月先丙后甲癸又次，三月先甲后丙癸又次；同摘句不同排序 |
| 戊午、未、戌 | 午壬甲主用、丙仅「酌用」不收，已裁定壬甲，不收「用癸力微」的癸；未取癸丙甲；戌取通常甲癸，「见金」癸丙为条件变化，不并入丙 |
| 己寅 | 月首「丙为尊」是推荐，收丙；壬多才须戊作堤，不将条件救应戊列为通用调候 |
| 己申、酉、戌 | 取季总结癸丙辛；戌明确土盛宜甲疏，再加甲，不以其它条件甲透者富改动申酉 |
| 己亥、子、丑 | 季段丙为尊、余用丙丁；亥另取戊制壬，收丙戊丁；子丑收丙丁。甲仅「参酌」未收；戊癸「不用」中的癸未收，戊仅在亥按后句例外收 |
| 庚卯、酉、亥、丑 | 卯专丁、借甲引丁收丁甲，不收无丁才用丙；酉丁甲丙皆为明确助成；亥「非丁莫造、非丙不暖」收丁丙，甲只写成贵组合未收；丑先丙次丁且甲不可少，收丙丁甲。亥措辞已裁定满足明确用神规则 |
| 辛寅、卯、巳、申、子 | 寅取己壬，庚制甲是条件救应未并入；卯壬为尊、甲制土收壬甲；巳喜壬洗淘收壬；申取本月「壬水为尊」只收壬，甲戊参酌不收；子壬丙两透荐取壬丙，癸为病不收；这些推荐句已按裁定视为明确用神 |
| 壬寅、午、未、酉、亥 | 寅明确宜用庚，只收庚，不把丙戊成贵组合当通用用干；午癸用庚佐且辛癸参用，收癸庚辛；未优先同段更明确「先辛后甲，次取癸」；酉明确总结甲庚；亥戊用、庚制甲辅助，收戊庚 |
| 癸辰、巳、戌、丑 | 辰丙主、谷雨后辛甲佐，收丙辛甲；巳辛用、无辛用庚，收辛庚；戌辛用、甲制戊收辛甲；比肩没有明确指定天干，不将癸并入；丑宜丙解冻只收丙，不将壬透与戊条件成贵组合并入 |

上述 21 组已按主管本轮裁定同步 JSON：乙巳、戊午删除酌用丙，丁午保留条件性取甲庚，其余 19 组照准。癸午「庚辛壬参酌并用」因有并用照收，不与单独参酌混同。本轮不再请求主管重复确认已裁定的取材口径。
