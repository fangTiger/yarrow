# 三易里程碑 1B 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已验收的 1A 上完成生辰校正、八字客观排盘、命理与运势三家及隐私安全的结果存档；本轮写完 B1–B2，其余分块后续逐块审查。

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
| `src/calendar/data/qiongtong.json` | 120 条调候用干、原书次序与卷次 | B3 |
| `src/calendar/qiongtong.ts` | 调候表合法性与日干月令查表 | B3 |
| `tests/bazi-relations.test.ts` | 关系、神煞、藏干分层计数 | B3 |
| `tests/qiongtong.test.ts` | 120 条覆盖、字段与出处完整性 | B3 |
| `src/sanyi/bazi-schema.ts` | 命理和运势独立输出 Schema 与类型 | B4 |
| `src/sanyi/bazi-facts.ts` | 命盘、关系、神煞、运年和调候编号事实 | B4 |
| `src/sanyi/bazi-audit.ts` | 十神与命盘组合的证据及正文核对 | B4 |
| `src/sanyi/schools/bazi-shared.ts` | 命理三家共用安全边界和输入契约 | B4 |
| `src/sanyi/schools/shenxiaozhan.ts` | 格局派提示词与输入组装 | B4 |
| `src/sanyi/schools/yuchuntai.ts` | 调候派提示词与对应调候条目组装 | B4 |
| `src/sanyi/schools/rentieqiao.ts` | 扶抑派提示词与输入组装 | B4 |
| `src/sanyi/schools/bazi-index.ts` | 命理三家稳定键与定义集合 | B4 |
| `src/sanyi/bazi-school-runner.ts` | 单家命理或运势调用、核对和一次重写 | B4 |
| `src/sanyi/mock-bazi-schools.ts` | 从事实表生成确定性的命理与运势断语 | B4 |
| `tests/sanyi-bazi-schema.test.ts` | 五个命理分项与运势吉凶把握约束 | B4 |
| `tests/sanyi-bazi-facts.test.ts` | 事实编号完整性与缺时柱隔离 | B4 |
| `tests/sanyi-bazi-audit.test.ts` | 未知引用、虚构十神及正文组合拒绝 | B4 |
| `tests/sanyi-bazi-schools.test.ts` | 三家输入隔离与调候原文约束 | B4 |
| `tests/sanyi-bazi-school-runner.test.ts` | 核对重写、拒绝和调用失败 | B4 |
| `src/sanyi/fortune-context.ts` | 按注入时钟解析 horizon 的立春年、节气月与流日 | B5 |
| `src/sanyi/bazi-reading-service.ts` | 命盘创建、三家并行与免费换日重排 | B5 |
| `src/sanyi/bazi-public.ts` | 命盘存档及公开响应的隐私白名单映射 | B5 |
| `tests/sanyi-fortune-context.test.ts` | 五种 horizon 与立春、交节和日界 | B5 |
| `tests/sanyi-bazi-reading-service.test.ts` | 付款幂等、并行失败隔离、重试和换日限额 | B5 |
| `tests/sanyi-bazi-privacy.test.ts` | 存档、日志、公开响应不含原始生辰及可还原校正详情 | B5 |
| `web/lib/birth-profile.ts` | 本机本人档案容错存取 | B6 |
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
| `src/sanyi/mock-provider.ts` | 根据任务类型路由至对应确定性 mock | B4 |
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
| `web/lib/recent-readings.ts` | 最近记录支持命理和运势类型 | B6 |
| `web/lib/term-definitions.ts` | 八字字段的就地术语解释 | B6 |
| `web/components/ClassificationTags.tsx` | 命理和运势标签、时间范围选择 | B6 |
| `web/components/QuestionForm.tsx` | 付款前生辰补问与改问事退路 | B6 |
| `web/components/RecentReadings.tsx` | 命理、运势记录标签 | B6 |
| `web/pages/Home.tsx` | 组合问题入口与本机生辰入口 | B6 |
| `web/pages/Reading.tsx` | 根据联合类型路由至问事或八字结果 | B6 |
| `web/styles/components.css` | 八字组件样式 | B6 |
| `web/styles/layout.css` | 经确认的八字响应式布局 | B6 |
| `web/fonts/mashanzheng-chars.txt` | 补齐三家姓氏和八字固定标题 | B6 |
| `web/fonts/mashanzheng-subset.woff2` | 从既有字表与工具重新生成字体资产 | B6 |
| `tests/frontend-sanyi-content.test.ts` | 八字新增文案继续满足文化守卫 | B7 |
| `docs/plans/2026-09-30-sanyi-redesign-design.md` | 修正旧夏令时日期与未校正命例描述 | B7 |
| `openspec/changes/sanyi-chinese-redesign/specs/bazi-chart/spec.md` | 区分原钟表时刻与夏令时校正后的命例 | B7 |
| `openspec/changes/sanyi-chinese-redesign/tasks.md` | 按实际完成状态更新第 2 节 | B7 |

无需新增依赖；不修改运行时配置、密钥或 1A 历法算法。B7 清理仅限 1B 中间占位与过期提示，不删除仍有调用的问事模块。

## 分块预告

- Chunk B1：生辰与出生时刻校正（本轮写完，Task B1.1–B1.3）。
- Chunk B2：八字排盘引擎（本轮写完，Task B2.1–B2.3）。
- Chunk B3：合冲刑害、神煞、五行计数与《穷通宝鉴》调候表。
- Chunk B4：命理与运势三家（提示词、输出 Schema、事实表与核对、mock）。
- Chunk B5：编排、接口与排练（命理、运势、换日切换、生辰隐私）。
- Chunk B6：生辰表单与八字结果页（待用户确认样稿后编写）。
- Chunk B7：清理与 1B 验收。

## 已核对的接口与执行约束

- 已逐一阅读本任务指定的设计章节、五份 spec、第 2 节任务、11 份 1A 源码、1A 计划及八字样稿。`classify.ts` 已有 `destiny`、`fortune`、`FortuneHorizon`，无需重复分类实现。
- 现有 `StoredReading.kind` 只有 `question`，`SchoolState.output` 为 `QuestionSchoolOutput`，`schools` 键为 `chengyi/jingfang/shaoyong`。不能把八字三家塞入这些键或假定存档已有 birth 字段。
- `api.ts` 的 `PublicReading.payment.firstHash` 来自 `payment.transactionHash`；`createReading` 仍以 `NotOpenYetError` 拒绝命理运势。B5 扩展实际边界，B6 再按联合类型消费。
- `FactTable` 为 `Map<string, { id, label, tokens: ReadonlySet<string> }>`；当前 `audit.ts` 只扫描问事词表，`runSchool` 只使用问事 Schema。B4 用独立八字核对器与运行器，复用事实表契约。
- `almanacAt` 返回对象字段，不是字符串数组：如 `solar.text`、`lunar.date`、`solarTerms.current`、`cycle.day`。样稿顶部取解读时刻的既有黄历；出生四柱另外取 `BaziChart.pillars`，绝不混用。
- `deriveSolarMonth` 用 NOAA/Meeus 量计算太阳视黄经。B1 使用同源的儒略世纪、平黄经、平近点角及黄赤交角计算均时差，不拿节气月函数代替均时差。
- `openspec list --specs` 与 `openspec list` 已执行；相关规范在现有变更中。CLI 遥测联网失败不影响清单。此轮只写计划，不勾 tasks，不创建重复提案。
- 本轮不提交、不安装、不修改其它项目文件。下列代码块是将来逐步实施的完整文件；主管可抽取到隔离目录验证。实现者每次先写测试、确认 RED，再落实现并确认 GREEN，最后整理；本轮没有实施这些勾选任务。
- 设计旧稿及 bazi-chart 旧场景按 15:30 直接排盘得到甲申、7 年 2 月 10 天；产品校正后的事实应为癸未、7 年 2 月 20 天、1997-08-04。旧场景只适合标为“引擎直接接收未校正时刻”的对照，不作为产品入口期望。

## Chunk B1：生辰与出生时刻校正

> 校正顺序固定为夏令时 → 真太阳时 → B2 换日。中国大陆历史夏令时按用户核验表；当前输入统一解释为北京时间钟表读数，港澳台城市仅提供经度，不据城市自动替换历史时区。未知时辰以当日正午作三柱代表点，并明确提示交节日存在年/月柱不确定性；不假装已校正时辰。

### Task B1.1：扩展真实历法类型边界

**文件：** 修改 `src/types/lunar-javascript.d.ts`。本文件一次给出 B1/B2 所需声明，保留 1A 的全部方法；接口与本机已装 1.7.7 源码对照。

- [ ] **Step 1：写 B1.3 的失败测试，再运行类型检查。**

运行：`node --import tsx --test tests/birth-profile.test.ts`。
预期 RED：新模块不存在。只扩展声明不能把运行时缺失误报为 GREEN。

- [ ] **Step 2：落入完整声明；先不写业务实现。**

```ts
// src/types/lunar-javascript.d.ts
declare module "lunar-javascript" {
  interface SolarValue {
    toYmd(): string;
    toYmdHms(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getHour(): number;
    getMinute(): number;
    getSecond(): number;
    getLunar(): LunarValue;
  }
  interface JieQiValue {
    getName(): string;
    getSolar(): SolarValue;
  }
  interface NineStarValue {
    toString(): string;
  }
  interface LiuYueValue {
    getMonthInChinese(): string;
    getGanZhi(): string;
  }
  interface LiuNianValue {
    getYear(): number;
    getGanZhi(): string;
    getAge(): number;
    getLiuYue(): LiuYueValue[];
  }
  interface DaYunValue {
    getIndex(): number;
    getGanZhi(): string;
    getStartAge(): number;
    getEndAge(): number;
    getStartYear(): number;
    getEndYear(): number;
    getLiuNian(count?: number): LiuNianValue[];
  }
  interface YunValue {
    isForward(): boolean;
    getStartYear(): number;
    getStartMonth(): number;
    getStartDay(): number;
    getStartSolar(): SolarValue;
    getDaYun(count?: number): DaYunValue[];
  }
  interface EightCharValue {
    setSect(sect: 1 | 2): void;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearNaYin(): string;
    getMonthNaYin(): string;
    getDayNaYin(): string;
    getTimeNaYin(): string;
    getYearShiShenGan(): string;
    getMonthShiShenGan(): string;
    getTimeShiShenGan(): string;
    getYearHideGan(): string[];
    getMonthHideGan(): string[];
    getDayHideGan(): string[];
    getTimeHideGan(): string[];
    getYearShiShenZhi(): string[];
    getMonthShiShenZhi(): string[];
    getDayShiShenZhi(): string[];
    getTimeShiShenZhi(): string[];
    getYearDiShi(): string;
    getMonthDiShi(): string;
    getDayDiShi(): string;
    getTimeDiShi(): string;
    getTaiYuan(): string;
    getMingGong(): string;
    getShenGong(): string;
    getYun(gender: 0 | 1, startSect?: 1 | 2): YunValue;
  }
  interface LunarValue {
    toString(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getSolar(): SolarValue;
    getTimeZhi(): string;
    getYueXiang(): string;
    getEightChar(): EightCharValue;
    getDayXun(): string;
    getDayXunKong(): string;
    getPrevJieQi(): JieQiValue;
    getNextJieQi(): JieQiValue;
    getJieQiTable(): Record<string, SolarValue>;
    getWuHou(): string;
    getHou(): string;
    getXiu(): string;
    getZheng(): string;
    getAnimal(): string;
    getGong(): string;
    getShou(): string;
    getZhiXing(): string;
    getDayTianShen(): string;
    getDayTianShenType(): string;
    getDayChongDesc(): string;
    getDaySha(): string;
    getDayYi(): string[];
    getDayJi(): string[];
    getPengZuGan(): string;
    getPengZuZhi(): string;
    getDayNineStar(): NineStarValue;
    getDayPositionXiDesc(): string;
    getDayPositionCaiDesc(): string;
    getDayPositionFuDesc(): string;
  }
  interface SolarFactory {
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): SolarValue;
  }
  const lunarPkg: {
    Solar: SolarFactory;
    Lunar: { fromYmd(year: number, month: number, day: number): LunarValue };
    LunarYear: { fromYear(year: number): { getLeapMonth(): number } };
    LunarMonth: {
      fromYm(year: number, month: number): { getDayCount(): number } | null;
    };
    LunarUtil: { SHI_SHEN: Record<string, string> };
  };
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
): CorrectedBirthTime {
  assertCivilTime(original);
  if (longitude !== null) {
    assertLongitude(longitude);
  }
  if (!timeKnown) {
    const steps: CorrectionStep[] = ["dst", "solar"].map((kind) => ({
      kind: kind as CorrectionStep["kind"], applied: false, before: null, after: null,
      deltaMinutes: 0, description: "时辰未知，未校正；三柱以当日正午为代表，交节日年/月柱待确认",
    }));
    return {
      effective: { ...original, hour: 12, minute: 0, second: 0 }, timeKnown,
      longitudeMinutes: 0, equationMinutes: 0, steps,
    };
  }
  const dst = daylightSavingAt(original);
  const delta = dst.active ? -60 : 0;
  const standard = civilFromMillis(civilMillis(original) + delta * 60_000);
  const longitudeMinutes = longitude === null ? 0 : (longitude - 120) * 4;
  const equationMinutes = longitude === null ? 0 : equationOfTimeMinutes(standard);
  const solarDelta = longitudeMinutes + equationMinutes;
  const effective = civilFromMillis(civilMillis(standard) + Math.round(solarDelta * 60_000));
  assertCivilTime(effective);
  const descriptions = [dst.active ? "已按夏令时减 1 小时" : "不在中国夏令时区间，未校正"];
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
  return { civil, timeKnown, gender, longitude };
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

test("缺时辰不计算命宫、身宫、起运与大运；独立流年流月仍可给出", () => {
  const chart = buildBaziChart({ ...input, timeKnown: false });
  assert.equal(chart.pillars.time, null);
  assert.equal(chart.mingGong, null);
  assert.equal(chart.shenGong, null);
  assert.equal(chart.luck, null);
  assert.equal(chart.taiYuan, "壬申");
  assert.equal(chart.annual?.currentLuck, null);
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
  hidden: readonly { stem: string; god: string; qi: "main" | "middle" | "residual" }[];
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
  months: readonly { index: number; monthInChinese: string; ganZhi: string; stemGod: string }[];
}
export interface BaziChart {
  sect: 1 | 2;
  dayBoundary: "23:00" | "00:00";
  timeKnown: boolean;
  dayMaster: string;
  pillars: { year: BaziPillar; month: BaziPillar; day: BaziPillar; time: BaziPillar | null };
  taiYuan: string;
  mingGong: string | null;
  shenGong: string | null;
  luck: {
    direction: "forward" | "backward";
    start: { years: number; months: number; days: number; solarDate: string };
    cycles: readonly LuckCycle[];
  } | null;
  annual: AnnualLuck | null;
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

function pillar(
  key: PillarKey,
  label: string,
  ganZhi: string,
  stemGod: string,
  stems: readonly string[],
  gods: readonly string[],
  diShi: string,
  naYin: string,
): BaziPillar {
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
  const eight = lunarPkg.Solar.fromYmdHms(
    birth.year, birth.month, birth.day, birth.hour, birth.minute, birth.second,
  ).getLunar().getEightChar();
  eight.setSect(input.sect);
  const year = pillar("year", "年柱", eight.getYear(), eight.getYearShiShenGan(),
    eight.getYearHideGan(), eight.getYearShiShenZhi(), eight.getYearDiShi(), eight.getYearNaYin());
  const month = pillar("month", "月柱", eight.getMonth(), eight.getMonthShiShenGan(),
    eight.getMonthHideGan(), eight.getMonthShiShenZhi(), eight.getMonthDiShi(), eight.getMonthNaYin());
  const day = pillar("day", "日柱", eight.getDay(), "日主",
    eight.getDayHideGan(), eight.getDayShiShenZhi(), eight.getDayDiShi(), eight.getDayNaYin());
  const time = input.timeKnown ? pillar("time", "时柱", eight.getTime(), eight.getTimeShiShenGan(),
    eight.getTimeHideGan(), eight.getTimeShiShenZhi(), eight.getTimeDiShi(), eight.getTimeNaYin()) : null;
  let luck: BaziChart["luck"] = null;
  let annual: AnnualLuck | null = input.targetYear < birth.year
    ? null : independentAnnual(input.targetYear, birth.year, day.stem);
  if (input.timeKnown) {
    const yun = eight.getYun(input.gender === "male" ? 1 : 0);
    const all = yun.getDaYun(22);
    const convert = (value: (typeof all)[number]): LuckCycle => ({
      index: value.getIndex(), ganZhi: value.getGanZhi(),
      stemGod: godFor(day.stem, value.getGanZhi().slice(0, 1)),
      startAge: value.getStartAge(), endAge: value.getEndAge(),
      startYear: value.getStartYear(), endYear: value.getEndYear(),
    });
    luck = {
      direction: yun.isForward() ? "forward" : "backward",
      start: { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay(),
        solarDate: yun.getStartSolar().toYmd() },
      cycles: all.filter((value) => value.getIndex() > 0).slice(0, 8).map(convert),
    };
    const current = all.find((value) => value.getStartYear() <= input.targetYear
      && value.getEndYear() >= input.targetYear);
    const rawYear = current?.getLiuNian().find((value) => value.getYear() === input.targetYear);
    if (annual && rawYear && current) {
      annual = {
        year: rawYear.getYear(), ganZhi: rawYear.getGanZhi(), age: rawYear.getAge(),
        stemGod: godFor(day.stem, rawYear.getGanZhi().slice(0, 1)),
        currentLuck: current.getIndex() === 0 ? null : convert(current),
        months: rawYear.getLiuYue().map((value, index) => ({
          index: index + 1, monthInChinese: value.getMonthInChinese(), ganZhi: value.getGanZhi(),
          stemGod: godFor(day.stem, value.getGanZhi().slice(0, 1)),
        })),
      };
    }
  }
  return {
    sect: input.sect, dayBoundary: input.sect === 1 ? "23:00" : "00:00",
    timeKnown: input.timeKnown, dayMaster: day.stem, pillars: { year, month, day, time },
    taiYuan: eight.getTaiYuan(), mingGong: input.timeKnown ? eight.getMingGong() : null,
    shenGong: input.timeKnown ? eight.getShenGong() : null, luck, annual,
    warnings: input.timeKnown ? []
      : ["时辰未知：不计算时柱、命宫、身宫、起运与大运；交节日年/月柱待确认"],
  };
}
```

- [ ] **Step 4：运行 `node --import tsx --test tests/bazi.test.ts tests/bazi-fixtures.test.ts`，预期全部通过。**
- [ ] **Step 5：运行 `npm run typecheck`；藏干与十神数组长度不等时必须拒绝，不用类型断言掩盖丢失项。**

### Task B2.3：样稿字段契约与交叉验收

本任务不新增界面。下表锁定 B1–B5 提供的数据，避免 B6 猜字段或把对象直接渲染成 `[object Object]`。B3/B4/B5 的字段是后续计划的约束，尚未冒充本轮代码。

| 样稿展示 | 数据来源与精确字段 | 隐私或缺时辰约束 |
|---|---|---|
| 原生日、公农历、性别 | 本机 `BirthProfileInput` | 只在持有本机档案的浏览器显示 |
| 每步原始/结果与校正量 | 请求期 `CorrectedBirthTime.steps[].before/after/deltaMinutes/description` | 不存档，不向分享链接返回 |
| 时柱校正前后对比 | 本机或请求期各排一次，取 `pillars.time?.ganZhi` | B5 持久化只留最终盘及不含时刻的校正状态 |
| 换日说明与切换 | `BaziChart.dayBoundary/sect`；B5 `boundaryChanges` | ≤2 次，重新提交本机生辰；分享查看者无生辰不能重排 |
| 四柱表 | `pillars.year/month/day/time` | `time=null` 显示缺，不引用时柱事实 |
| 干支、十神、藏干长生纳音 | `ganZhi/stem/branch/stemGod/hidden[].stem/god/qi/diShi/naYin` | 明确单字段；不要渲染 pillar 对象 |
| 胎元、命宫、身宫 | `taiYuan/mingGong/shenGong` | 缺时辰时后两项 null |
| 起运与交运日期 | `luck.start.years/months/days/solarDate` | 缺时辰 luck=null；交运日期是规格允许的派生结果 |
| 大运方向与八步时间轴 | `luck.direction/cycles[].ganZhi/stemGod/startAge/endAge/startYear/endYear` | 起运前 currentLuck=null，不能高亮第一步 |
| 所问流年、虚岁与所在运 | `annual.year/ganZhi/age/currentLuck` | 年份在出生前 annual=null；未知时辰无当前运 |
| 流月与十神 | `annual.months[].index/monthInChinese/ganZhi/stemGod` | 节气月编号不是农历月日期；B5 补当前交节区间 |
| 神煞标签 | B3 `shensha[]`：`name/nodeId/basis` | 按日干、年支、日支等具体依据；不采信样稿为标准答案 |
| 合冲刑害文字与关系图 | B3 `nodes[]`：`id/label/stem/branch`；`relations[]`：`id/kind/nodeIds/label` | 覆盖原局、当前运年、半合与自刑；成化结论由三家判断 |
| 五行堆叠条与总数 | B3 `elements[]`：`element/stem/main/middle/residual/total` | 从实际藏干现场计数，不把示意图宽度或总数写死 |
| 三家用神、断语与月份提示 | B4 各家 `output.useGod/headline/reason/sections/advice/evidence`，运势额外 verdict/confidenceTenths/timing | 命理没有吉凶和合议；月份关注用 timing，别猜 watch 字段 |
| 问卦此刻的时空栏、黄历与奇门 | 既有 `almanacAt` 对象与 `qimenAt`；B5 固定解读时刻 | 与出生时刻完全独立；B6 按真实字段显示 |

- [ ] **Step 1：运行四个新测试文件。**

运行：`node --import tsx --test tests/solar-time.test.ts tests/birth-profile.test.ts tests/bazi.test.ts tests/bazi-fixtures.test.ts`。
预期：全部通过，55 个 fixture 每个两种 sect、每种四柱逐字段一致。

- [ ] **Step 2：运行 `npm run typecheck`。** 继承项目已有三项严格开关，不通过不得进入 B3。
- [ ] **Step 3：运行 `npm test`。** 既有问事、黄历、奇门、付款与 API 回归均须通过；若失败先定位原因，不能回滚用户改动。
- [ ] **Step 4：核对现有 OpenSpec 第 2 节任务。** B1/B2 只完成 2.2 的服务端部分和 2.3 的基础排盘部分，不能勾选整个 2.2/2.3；2.0 要等全计划，2.1 要等用户确认样稿。

### B2 交付核对

- [ ] 已核验校正命例所有字段通过；未校正甲申只是引擎对照。
- [ ] 四种男女阴阳方向现场六十甲子断言通过；缺时辰不调用起运和依赖时柱的宫位方法。
- [ ] 两种 sect 的晚子时日柱与共同时柱规则明确；起运算法口径没有混用。
- [ ] 独立 sxtwl 原生与适配口径均记录，所有四柱比较；≥40 时刻和全部覆盖类别有测试守卫。
- [ ] 编排持久化不能直接 spread B1 生辰对象或逐步校正对象；B5 按白名单存派生命盘。

## Chunk B3：合冲刑害、神煞、五行计数与《穷通宝鉴》调候表

后续轮次补充完整任务、代码与测试，依据 B2 字段计算事实，逐条核对神煞与调候出处。

## Chunk B4：命理与运势三家（提示词、输出 Schema、事实表与核对、mock）

后续轮次补充完整任务、代码与测试，明确沈孝瞻、余春台、任铁樵的独立输入与输出约束。

## Chunk B5：编排、接口与排练（命理、运势、换日切换、生辰隐私）

后续轮次补充完整任务、代码与测试，沿用真实 1A 接口并解决换日重新提交生辰和分享隐私。

## Chunk B6：生辰表单与八字结果页

待用户确认八字结果页样稿后编写本 Chunk 的完整任务、界面代码与测试。

## Chunk B7：清理与 1B 验收

后续轮次补充清理与验收步骤，核对实现和规范、tasks 实际状态及全量验证证据。

## 本轮计划代码验证记录

已把全部 TS、声明、JSON 和 Python 代码块按首行路径抽取至项目外的临时隔离目录；Python/JSON 移除路径标记。隔离目录复用项目已有 node_modules，不安装依赖、不改项目源码。

- 基准生成：使用现有 Python 环境执行 `tools/bazi/generate_fixtures.py`，生成 55 个时刻，每个记录原生口径和两种 sect 的四柱期望。
- 行为验证：`node --import tsx --test tests/solar-time.test.ts tests/birth-profile.test.ts tests/bazi.test.ts tests/bazi-fixtures.test.ts`，14 个测试通过、0 失败；双源测试覆盖 55 × 2 × 4 项四柱比较。
- 严格类型：隔离目录执行 `tsc --noEmit`，strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes 均开启，另外关闭 skipLibCheck，退出码 0。
- 此记录证明本轮计划块可抽取运行，不代表 1B 功能已在项目实现，也不提前勾选任何任务；全量回归仍是实施 B2.3 的必做步骤。

## 待主管确认的口径

1. 规范旧命例的描述需在后续实施中修订：入口自动扣夏令时后应为癸未、7 年 2 月 20 天；1988 年开始日应为 4 月 17 日。本轮只记录，不改原文件。
2. 未知时辰的年/月柱在交节日不唯一；本计划用正午代表并警示，起运、大运、命宫、身宫均不计算。若希望给候选年/月柱集合，需先扩充相关规范，不静默假定。
3. 输入统一为北京时间；港澳台城市只取经度，1986–1991 年夏令时仍按该北京时间输入规则。若产品要解释当地历史钟表时区，需要额外时区字段与校正规范。
4. 原始生辰和校正前后时刻不得服务端落盘，与分享页仍展示原生日的样稿有冲突。本计划将原生日、校正时刻限制为本机或本次请求展示；分享只看派生命盘及不含原时刻的校正状态。免费换日需浏览器重新提交生辰，服务端不留可逆缓存。
5. 样稿的半合、自刑关系与三家月份提示需要 B3/B4 数据支撑；不把示意神煞、条形宽度和三家用神当成核验期望。B6 保持待用户确认。
