# 三易里程碑 1A 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成「三易」里程碑 1A 的新站骨架与问事全流程，让用户付卦金后亲手六掷，并查看可复算的六爻、三家断语、时空黄历与奇门时盘。

**Architecture:** 以 `src/calendar/` 提供无网络、可回归的历法与术数纯函数，以 `src/sanyi/` 负责分类、六掷、事实核对、持久化和三家编排；`src/frontend/server.ts` 只暴露安全的 JSON/静态资源边界。React 前端按 hash 路由消费 reading 存档，付款复用现有 EIP-5792 原子批量流程，所有问事计算统一采用第一掷区块时间戳（UTC+8、零点换日）。

**Tech Stack:** TypeScript 5.9 ESM、Node.js ≥ 22、React 18、esbuild、wagmi 2、RainbowKit 2、viem、AJV、`lunar-javascript@1.7.7`、Node `test` + `tsx`；开发期以 Python 3.11、kinqimen 0.0.6.6 和 fonttools 生成回归资产。

---

## 分块预告

- Chunk 1：术数与历法引擎。
- Chunk 2A：分类、六掷与盘面核对。
- Chunk 2B：三家提示词、原文、存档与单家落笔（Task 12–14）。
- Chunk 2C：问事编排（Task 15）。
- Chunk 2B/2C 交叉验收：领域与全量回归（Task 16）。
- Chunk 3：服务端接口。
- Chunk 4：前端基础。
- Chunk 5：前端结果页。
- Chunk 6：清理与验收。

## 文件结构

以下清单覆盖里程碑 1A 全部任务 1.1–1.14；每个文件只承担列出的单一职责。

### 新建

- `src/types/lunar-javascript.d.ts`：声明 1A 实际调用的 CommonJS 历法 API。
- `src/calendar/almanac.ts`：把卦时转换成时空栏和黄历事实，并执行历法双源一致性守卫。
- `src/calendar/qimen.ts`：计算子时换日、阳遁用勾陈朱雀的时家转盘拆补法奇门盘。
- `src/calendar/meihua.ts`：从六爻计算梅花体、用、互、变及五行关系。
- `src/calendar/bianzhan.ts`：按朱熹变占法选择程颐主占之辞。
- `tools/qimen/generate_fixtures.py`：调用 kinqimen 并规范化标准答案。
- `tests/fixtures/qimen/*.json`：保存不少于 40 个奇门逐字段标准答案。
- `tests/almanac.test.ts`：验证样例字段、500 时刻互校、零点换日和错误日志。
- `tests/qimen.test.ts`：逐字段回归 fixtures，锁定人工核验样例及 23 点子时换日用例。
- `tests/meihua.test.ts`：覆盖体用取法各分支、互卦和旺衰复用。
- `tests/bianzhan.test.ts`：覆盖 0–6 动爻及乾坤用九用六。
- `src/sanyi/classify.ts`：确定性分类问题类型、运势时间范围和问事事项。
- `src/sanyi/throws.ts`：派生单掷铜钱并执行顺序、幂等与新区块约束。
- `src/sanyi/schema.ts`：定义三家结构化断语 JSON Schema 和自洽校验。
- `src/sanyi/facts.ts`：把六爻、梅花与变占结果转换为可核对的编号事实表。
- `src/sanyi/audit.ts`：用编号事实表核对证据及正文中的盘面组合。
- `src/sanyi/schools/shared.ts`：提供三家提示词共用的安全边界和序列化工具。
- `src/sanyi/schools/chengyi.ts`：组装程颐判断路径与卦爻辞输入。
- `src/sanyi/schools/jingfang.ts`：组装京房纳甲事实与用神输入。
- `src/sanyi/schools/shaoyong.ts`：组装邵雍体用互变输入。
- `src/sanyi/schools/index.ts`：汇总问事三家定义并提供稳定键类型。
- `src/sanyi/mock-schools.ts`：依据事实表生成可通过核对的确定性三家断语。
- `src/sanyi/store.ts`：原子持久化 reading 与付款凭证索引。
- `src/sanyi/school-runner.ts`：调用、核对并至多重写一次单家断语。
- `src/sanyi/reading-service.ts`：编排创建、六掷、排盘、三家并行、重试和改事项。
- `src/sanyi/log.ts`：向 `log/sanyi_{日期}.log` 写入脱敏中文日志。
- `tests/sanyi-classify.test.ts`：覆盖八类分类、时间范围、默认问事和替代建议。
- `tests/sanyi-throws.test.ts`：覆盖可复算映射、顺序、幂等、超时和区块递增。
- `tests/sanyi-schema.test.ts`：覆盖结构、字数、应期和吉凶把握自洽。
- `tests/sanyi-facts.test.ts`：覆盖编号事实表的完整性与已核验样例。
- `tests/sanyi-audit.test.ts`：覆盖未知 ref、矛盾 claim 和正文虚构事实。
- `tests/helpers/sample-question.ts`：构造事实表与核对测试共用的已核验问事样例盘。
- `tests/sanyi-schools.test.ts`：用 mock provider 验证三家输入隔离与提示词边界。
- `tests/sanyi-store.test.ts`：覆盖不可枚举 id、重启防复用和隐私边界。
- `tests/sanyi-school-runner.test.ts`：覆盖单家一次通过、核对重写、拒绝与模型失败。
- `tests/sanyi-reading-service.test.ts`：覆盖问事全流程、失败隔离、免费重试与仅重跑京房。
- `web/pages/Home.tsx`：呈现首页输入与最近记录。
- `web/pages/Reading.tsx`：按 reading 状态组合问事结果页。
- `web/components/ShikongBar.tsx`：呈现时空栏字段。
- `web/components/Luopan.tsx`：绘制仅装饰的二十四山后天八卦罗盘。
- `web/components/CoinThrow.tsx`：实现可键盘操作的按住摇、松开落钱交互。
- `web/components/HexagramFigure.tsx`：绘制本卦、动爻与之卦。
- `web/components/FiveHexagrams.tsx`：呈现本互变错综五卦。
- `web/components/SchoolCard.tsx`：呈现单家状态、摘要、折叠详断和重试。
- `web/components/ConsensusTrack.tsx`：呈现三家把握与算术平均线。
- `web/components/LiuyaoTable.tsx`：呈现可独立横向滚动的六爻排盘表。
- `web/components/FiveElementsDetail.tsx`：呈现五行生克与六亲来源。
- `web/components/QimenBoard.tsx`：按南上北下洛书方位呈现九宫。
- `web/components/AlmanacPanel.tsx`：呈现卦时黄历。
- `web/components/PaymentButton.tsx`：封装一次点击连接、切网、余额检查和 EIP-5792 付款。
- `web/components/RecentReadings.tsx`：容错读写本机最近 20 条链接。
- `web/lib/api.ts`：提供新 JSON 接口的类型化客户端。
- `web/lib/recent-readings.ts`：维护最近 reading 的 localStorage 数据。
- `web/styles/tokens.css`：定义水墨夜颜色、字体和尺寸令牌。
- `web/styles/layout.css`：定义双列、980px 单列和 390px 无溢出布局。
- `web/styles/components.css`：定义问事组件状态与门类着色。
- `web/fonts/mashanzheng-chars.txt`：保存可审计的毛笔体固定字表。
- `web/fonts/mashanzheng-subset.woff2`：提供小于 100KB 的本地字体子集。
- `scripts/subset-sanyi-font.py`：用 fonttools 从固定字表生成 woff2。
- `tests/frontend-sanyi-content.test.ts`：扫描文化禁词、外部字体与响应式静态约束。
- `tests/frontend-sanyi-components.test.ts`：服务端渲染关键组件并验证语义与状态。
- `tests/sanyi-rehearsal.test.ts`：验证 mock 排练走完一卦六掷和三家落笔。

### 修改

- `package.json`：加入 lunar 依赖、字体命令和新排练入口，不改项目名（项目更名属于 3.1）。
- `package-lock.json`：锁定 `lunar-javascript@1.7.7` 的解析结果。
- `src/oracle/liuyao-chart.ts`：仅导出既有旺衰计算函数供梅花复用。
- `src/frontend/server.ts`：接入 `/api/now`、`/api/classify`、`/api/readings/*` 并移除旧路由。
- `web/main.tsx`：保留 Providers，只挂载新应用入口。
- `web/app.tsx`：缩减为 `#/` 与 `#/r/<id>` 的 hash 路由。
- `web/index.html`：替换站名、说明与样式入口。
- `web/lib/wagmi.ts`：继续提供既有 Arc/RainbowKit 配置。
- `web/providers/Providers.tsx`：继续提供 wagmi、QueryClient 和 RainbowKit 上下文。
- `scripts/build-frontend.ts`：复制 CSS/font 静态资产并保持公开环境变量白名单。
- `scripts/check-frontend-secrets.ts`：扫描新构建产物和字体旁路资产。
- `scripts/rehearse-demo.ts`：改为调用新 reading 服务的 mock 问事全流程。
- `tests/frontend-server.test.ts`：改测新接口安全边界、旧接口 404 和静态资源。
- `.gitignore`：不跟踪 `.venv-tools/`、`data/readings/` 和运行日志。
- `openspec/changes/sanyi-chinese-redesign/tasks.md`：验收后勾选实际完成的 1.1–1.14。

### 删除

- `web/styles.css`：由分责样式文件替代。
- `src/frontend/data.ts`：旧链上快照读取不再服务新站。
- `src/frontend/domain.ts`：旧工作台展示模型不再服务新站。
- `tests/frontend-data.test.ts`：随旧快照模块删除。
- `tests/frontend-domain.test.ts`：随旧展示模型删除。
- `tests/frontend-wallet.test.ts`：旧押注钱包交互断言由新付款组件测试替代。
- `tests/demo-rehearsal.test.ts`：旧六步工作台排练由新问事排练替代。

## Chunk 1: 术数与历法引擎（纯函数，无网络）

> 本 Chunk 覆盖 OpenSpec 任务 1.1–1.3，以及 `shikong-almanac-qimen` 的全部服务端事实要求和 `question-three-schools` 中「主占之辞变占法」「梅花体用取法」要求。除生成 fixtures 的隔离工具外，运行时代码不得访问网络、Python 或系统时钟。

### Task 1: 锁定 lunar-javascript 并建立最小类型边界

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/types/lunar-javascript.d.ts`
- Test: `tests/almanac.test.ts`

- [ ] **Step 1: 安装精确版本（2–5 分钟）**

Run: `npm install lunar-javascript@1.7.7`

Expected: `package.json` 的 `dependencies` 出现 `"lunar-javascript": "^1.7.7"`，`package-lock.json` 锁定实际版本 `1.7.7`，审计不阻断安装。

- [ ] **Step 2: 确认已安装发布包没有类型文件（2 分钟）**

Run: `find node_modules/lunar-javascript -name '*.d.ts' -print`

Expected: 无输出；因此本任务必须提交最小声明，不能依赖 `any` 或 `skipLibCheck` 掩盖调用错误。

- [ ] **Step 3: 写 CommonJS/ESM 互操作失败测试（3 分钟）**

```ts
// tests/almanac.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import lunarPkg from "lunar-javascript";

test("lunar-javascript 的 CommonJS 默认导入暴露 Solar", () => {
  assert.equal(typeof lunarPkg.Solar.fromYmdHms, "function");
  const lunar = lunarPkg.Solar.fromYmdHms(2026, 9, 30, 20, 15, 0).getLunar();
  assert.equal(lunar.toString(), "二〇二六年八月二十");
});
```

- [ ] **Step 4: 运行测试并确认类型边界缺失（2 分钟）**

Run: `npm run typecheck`

Expected: FAIL，包含 `Could not find a declaration file for module 'lunar-javascript'`。

- [ ] **Step 5: 新增最小声明（5 分钟）**

```ts
// src/types/lunar-javascript.d.ts
declare module "lunar-javascript" {
  interface SolarValue { toYmdHms(): string; }
  interface JieQiValue { getName(): string; getSolar(): SolarValue; }
  interface NineStarValue { toString(): string; }
  interface EightCharValue {
    setSect(sect: 1 | 2): void;
    getYear(): string; getMonth(): string; getDay(): string; getTime(): string;
    getYearNaYin(): string; getMonthNaYin(): string; getDayNaYin(): string; getTimeNaYin(): string;
  }
  interface LunarValue {
    toString(): string; getTimeZhi(): string; getYueXiang(): string;
    getEightChar(): EightCharValue; getDayXun(): string; getDayXunKong(): string;
    getPrevJieQi(): JieQiValue; getNextJieQi(): JieQiValue;
    getWuHou(): string; getHou(): string; getXiu(): string; getZheng(): string;
    getAnimal(): string; getGong(): string; getShou(): string;
    getZhiXing(): string; getDayTianShen(): string; getDayTianShenType(): string;
    getDayChongDesc(): string; getDaySha(): string; getDayYi(): string[]; getDayJi(): string[];
    getPengZuGan(): string; getPengZuZhi(): string; getDayNineStar(): NineStarValue;
    getDayPositionXiDesc(): string; getDayPositionCaiDesc(): string; getDayPositionFuDesc(): string;
  }
  interface SolarFactory {
    fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): { getLunar(): LunarValue };
  }
  const lunarPkg: { Solar: SolarFactory };
  export default lunarPkg;
}
```

- [ ] **Step 6: 验证默认导入和类型检查（2 分钟）**

Run: `node --import tsx --test tests/almanac.test.ts && npm run typecheck`

Expected: 测试 `1 pass, 0 fail`；`tsc --noEmit` 退出码 0。

- [ ] **Step 7: 提交（2 分钟）**

```bash
git add package.json package-lock.json src/types/lunar-javascript.d.ts tests/almanac.test.ts && git commit -m "build(calendar): 引入农历历法依赖"
```

### Task 2: 实现时空栏、黄历与历法一致性守卫

**Files:**
- Create: `src/calendar/almanac.ts`
- Modify: `tests/almanac.test.ts`
- Test: `tests/almanac.test.ts`

- [ ] **Step 1: 用已核验时刻写完整失败测试（5 分钟）**

```ts
// tests/almanac.test.ts（保留 Task 1 测试，再加入）
import { almanacAt, assertCalendarConsistent } from "../src/calendar/almanac.js";

const SAMPLE = BigInt(Date.UTC(2026, 8, 30, 12, 15, 0) / 1_000);

test("时空栏和黄历逐字段符合已核验样例", () => {
  const result = almanacAt(SAMPLE);
  assert.deepEqual(result.solar, { timezone: "UTC+8", text: "2026-09-30 20:15:00" });
  assert.deepEqual(result.lunar, { date: "二〇二六年八月二十", timeBranch: "戌", moonPhase: "更待" });
  assert.deepEqual(result.pillars, ["丙午", "丁酉", "丁未", "庚戌"]);
  assert.deepEqual(result.naYin, ["天河水", "山下火", "天河水", "钗钏金"]);
  assert.deepEqual(result.solarTerms, {
    current: "秋分", hou: "秋分 二候", wuHou: "蛰虫坯户",
    previousAt: "2026-09-23 08:05:14", next: "寒露", nextAt: "2026-10-08 14:29:17",
  });
  assert.deepEqual(result.cycle, { monthBranch: "酉", day: "丁未", xun: "甲辰", voidBranches: ["寅", "卯"] });
  assert.deepEqual(result.dayOfficers, { officer: "开", deity: "天德", path: "黄道" });
  assert.deepEqual(result.mansion, { name: "壁水貐", palace: "北", guardian: "玄武" });
  assert.deepEqual(result.clash, { description: "(辛丑)牛", direction: "西" });
  assert.equal(result.almanac.nineStar, "五黄土玉衡");
  assert.equal(result.almanac.joy, "正南");
  assert.equal(result.almanac.wealth, "西南");
  assert.equal(result.almanac.fortune, "东南");
  assert.deepEqual(result.almanac.suitable.slice(0, 6), ["祭祀", "解除", "结网", "畋猎", "取渔", "会亲友"]);
  assert.deepEqual(result.almanac.avoid.slice(0, 6), ["开市", "祈福", "动土", "破土", "入殓", "安葬"]);
  assert.equal(result.almanac.suitable.length, 11);
  assert.equal(result.almanac.avoid.length, 7);
  assert.deepEqual(result.almanac.pengZu, ["丁不剃头头必生疮", "未不服药毒气入肠"]);
  assert.doesNotThrow(() => assertCalendarConsistent(result));
});

test("二十八宿只规范 lunar-javascript 的獝为貐", () => {
  assert.equal(almanacAt(SAMPLE).mansion.name, "壁水貐");
});

test("2020—2030 固定种子抽样 500 个时刻均通过双源互校", () => {
  let state = 0x51_41_4e_59;
  const start = Date.UTC(2020, 0, 1) / 1_000;
  const span = Date.UTC(2031, 0, 1) / 1_000 - start;
  for (let index = 0; index < 500; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const result = almanacAt(BigInt(Math.floor(start + (state / 2 ** 32) * span)));
    assert.doesNotThrow(() => assertCalendarConsistent(result));
  }
});

test("寒露交节前后只保留近交节提示，不误报月建不一致", () => {
  const boundary = Date.UTC(2026, 9, 8, 6, 29, 17) / 1_000;
  for (const offset of [-60, 60]) {
    const timestamp = BigInt(boundary + offset);
    assert.doesNotThrow(() => almanacAt(timestamp));
    assert.equal(almanacAt(timestamp).month.boundaryUncertain, true);
  }
});

test("距寒露约两小时继续执行月建比较", () => {
  const result = almanacAt(BigInt(Date.UTC(2026, 9, 8, 8, 29, 17) / 1_000));
  assert.equal(result.month.boundaryUncertain, false);
  assert.equal(result.cycle.monthBranch, result.month.branch);
  assert.doesNotThrow(() => assertCalendarConsistent(result));
});

test("一致性错误拒绝返回可能错误的盘", () => {
  const result = almanacAt(SAMPLE);
  assert.throws(
    () => assertCalendarConsistent({ ...result, cycle: { ...result.cycle, day: "戊申" } }),
    /历法不一致：黄历日干支戊申，六爻日干支丁未/,
  );
});
```

- [ ] **Step 2: 运行并确认模块尚不存在（2 分钟）**

Run: `node --import tsx --test tests/almanac.test.ts`

Expected: FAIL，包含 `Cannot find module '../src/calendar/almanac.js'`。

- [ ] **Step 3: 实现完整纯函数（5 分钟）**

```ts
// src/calendar/almanac.ts
import lunarPkg from "lunar-javascript";
import { deriveSexagenaryDay, deriveSolarMonth } from "../oracle/liuyao-chart.js";

export interface AlmanacResult {
  timestamp: string;
  solar: { timezone: "UTC+8"; text: string };
  lunar: { date: string; timeBranch: string; moonPhase: string };
  pillars: readonly [string, string, string, string];
  naYin: readonly [string, string, string, string];
  solarTerms: { current: string; hou: string; wuHou: string; previousAt: string; next: string; nextAt: string };
  cycle: { monthBranch: string; day: string; xun: string; voidBranches: readonly [string, string] };
  month: ReturnType<typeof deriveSolarMonth>;
  dayOfficers: { officer: string; deity: string; path: string };
  mansion: { name: string; palace: string; guardian: string };
  clash: { description: string; direction: string };
  almanac: {
    nineStar: string; joy: string; wealth: string; fortune: string;
    suitable: readonly string[]; avoid: readonly string[]; pengZu: readonly [string, string];
  };
}

const pad = (value: number): string => String(value).padStart(2, "0");

function utc8Parts(timestamp: bigint): [number, number, number, number, number, number] {
  if (timestamp < 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("历法时间戳必须是安全的非负整数秒");
  const date = new Date((Number(timestamp) + 8 * 3_600) * 1_000);
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()];
}

function formatSolar(value: { toYmdHms(): string }): string {
  return value.toYmdHms();
}

export function almanacAt(timestamp: bigint): AlmanacResult {
  const [year, month, day, hour, minute, second] = utc8Parts(timestamp);
  const lunar = lunarPkg.Solar.fromYmdHms(year, month, day, hour, minute, second).getLunar();
  const eight = lunar.getEightChar();
  eight.setSect(2);
  const previous = lunar.getPrevJieQi();
  const next = lunar.getNextJieQi();
  const liuyaoDay = deriveSexagenaryDay(timestamp);
  const liuyaoMonth = deriveSolarMonth(timestamp);
  const result: AlmanacResult = {
    timestamp: timestamp.toString(),
    solar: { timezone: "UTC+8", text: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}` },
    lunar: { date: lunar.toString(), timeBranch: lunar.getTimeZhi(), moonPhase: lunar.getYueXiang() },
    pillars: [eight.getYear(), eight.getMonth(), eight.getDay(), eight.getTime()],
    naYin: [eight.getYearNaYin(), eight.getMonthNaYin(), eight.getDayNaYin(), eight.getTimeNaYin()],
    solarTerms: {
      current: previous.getName(), hou: lunar.getHou(), wuHou: lunar.getWuHou(),
      previousAt: formatSolar(previous.getSolar()), next: next.getName(), nextAt: formatSolar(next.getSolar()),
    },
    cycle: {
      monthBranch: eight.getMonth().slice(1), day: eight.getDay(), xun: lunar.getDayXun(),
      voidBranches: lunar.getDayXunKong().split("") as [string, string],
    },
    month: liuyaoMonth,
    dayOfficers: { officer: lunar.getZhiXing(), deity: lunar.getDayTianShen(), path: lunar.getDayTianShenType() },
    mansion: { name: `${lunar.getXiu()}${lunar.getZheng()}${lunar.getAnimal() === "獝" ? "貐" : lunar.getAnimal()}`, palace: lunar.getGong(), guardian: lunar.getShou() },
    clash: { description: lunar.getDayChongDesc(), direction: lunar.getDaySha() },
    almanac: {
      nineStar: lunar.getDayNineStar().toString(), joy: lunar.getDayPositionXiDesc(),
      wealth: lunar.getDayPositionCaiDesc(), fortune: lunar.getDayPositionFuDesc(),
      suitable: lunar.getDayYi(), avoid: lunar.getDayJi(), pengZu: [lunar.getPengZuGan(), lunar.getPengZuZhi()],
    },
  };
  assertCalendarConsistent(result, liuyaoDay.ganzhi);
  return result;
}

export function assertCalendarConsistent(result: AlmanacResult, expectedDay = deriveSexagenaryDay(BigInt(result.timestamp)).ganzhi): void {
  if (result.cycle.day !== expectedDay) throw new Error(`历法不一致：黄历日干支${result.cycle.day}，六爻日干支${expectedDay}`);
  // NOAA 近似算法在交节窗口内只给“近交节”提示；日干支仍须严格互校。
  if (!result.month.boundaryUncertain && result.cycle.monthBranch !== result.month.branch) {
    throw new Error(`历法不一致：黄历月建${result.cycle.monthBranch}，六爻月建${result.month.branch}`);
  }
}
```

- [ ] **Step 4: 运行单测并确认样例与 500 抽样通过（2–5 分钟）**

Run: `node --import tsx --test tests/almanac.test.ts`

Expected: `7 pass, 0 fail`；交节前后一分钟均保留 `boundaryUncertain: true`，距交节约两小时恢复严格月建比较。

- [ ] **Step 5: 运行类型检查（2 分钟）**

Run: `npm run typecheck`

Expected: `tsc --noEmit` 退出码 0。

- [ ] **Step 6: 提交（2 分钟）**

```bash
git add src/calendar/almanac.ts tests/almanac.test.ts && git commit -m "feat(calendar): 实现时空黄历与双源互校"
```

### Task 3: 生成并锁定 kinqimen 标准答案 fixtures

**Files:**
- Create: `tools/qimen/generate_fixtures.py`
- Create: `tests/fixtures/qimen/*.json`
- Test: `tests/qimen.test.ts`

- [ ] **Step 1: 建立隔离工具环境（5 分钟）**

Run: `python3 -m venv .venv-tools && .venv-tools/bin/python -m pip install --upgrade pip && .venv-tools/bin/pip install --only-binary=:all: ephem==4.1.6 sxtwl && .venv-tools/bin/pip install --no-deps kinqimen==0.0.6.6`

Expected: 三次安装均退出码 0；`.venv-tools/bin/python -c 'import ephem,sxtwl; print(ephem.__version__)'` 输出 `4.1.6`。此环境只生成测试资产，不进入运行时依赖。

- [ ] **Step 2: 写固定时刻清单与规范化脚本（5 分钟）**

```py
# tools/qimen/generate_fixtures.py
import json
import re
import site
import sys
from datetime import datetime
from pathlib import Path

package_dir = Path(site.getsitepackages()[0]) / "kinqimen"
sys.path.insert(0, str(package_dir))
from kinqimen import Qimen  # type: ignore[import-not-found]  # 工具依赖不进入 TS 运行时

TIMES = [
    "2026-01-05T10:59", "2026-01-05T12:01", "2026-01-20T03:00", "2026-02-04T03:01",
    "2026-02-04T04:01", "2026-02-18T05:00", "2026-03-05T20:00", "2026-03-20T07:00",
    "2026-04-05T09:00", "2026-04-20T11:00", "2026-05-05T13:00", "2026-05-21T15:00",
    "2026-06-05T17:00", "2026-06-21T18:00", "2026-06-21T19:00", "2026-07-07T21:00",
    "2026-07-23T23:00", "2026-08-07T01:00", "2026-08-23T03:00", "2026-09-07T05:00",
    "2026-09-23T07:30", "2026-09-23T08:30", "2026-09-30T20:15", "2026-10-08T13:45",
    "2026-10-08T15:15", "2026-10-23T09:00", "2026-11-07T11:00", "2026-11-22T13:00",
    "2026-12-07T15:00", "2026-12-22T17:00", "2027-01-05T19:00", "2027-01-20T21:00",
    "2027-02-04T23:00", "2027-03-06T00:30", "2027-04-05T02:30", "2027-05-06T04:30",
    "2027-06-06T06:30", "2027-07-07T08:30", "2027-08-08T10:30", "2027-09-08T12:30",
    "2027-10-08T14:30", "2027-11-07T16:30", "2027-12-07T18:30", "2028-01-06T20:30",
    "2028-02-04T22:30", "2028-03-05T01:30", "2028-06-21T12:00", "2028-12-21T12:00",
]

PALACE = {"坎": "坎一", "坤": "坤二", "震": "震三", "巽": "巽四", "中": "中五", "乾": "乾六", "兌": "兑七", "艮": "艮八", "離": "离九"}
DOOR = {"休": "休门", "生": "生门", "傷": "伤门", "杜": "杜门", "景": "景门", "死": "死门", "驚": "惊门", "開": "开门"}
STAR = {"蓬": "天蓬", "任": "天任", "沖": "天冲", "輔": "天辅", "英": "天英", "芮": "天芮", "柱": "天柱", "心": "天心", "禽": "天芮"}
GOD = {
    "符": "值符", "蛇": "腾蛇", "陰": "太阴", "合": "六合",
    "勾": "勾陈", "雀": "朱雀", "虎": "白虎", "玄": "玄武", "地": "九地", "天": "九天",
}
SOLAR_TERM = {
    "冬至": "冬至", "小寒": "小寒", "大寒": "大寒", "立春": "立春", "雨水": "雨水", "驚蟄": "惊蛰",
    "春分": "春分", "清明": "清明", "穀雨": "谷雨", "立夏": "立夏", "小滿": "小满", "芒種": "芒种",
    "夏至": "夏至", "小暑": "小暑", "大暑": "大暑", "立秋": "立秋", "處暑": "处暑", "白露": "白露",
    "秋分": "秋分", "寒露": "寒露", "霜降": "霜降", "立冬": "立冬", "小雪": "小雪", "大雪": "大雪",
}
REQUIRED_KEYS = {"干支", "旬空", "排局", "節氣", "值符值使", "天盤", "地盤", "門", "星", "神", "馬星"}
EXPECTED_KEYS = REQUIRED_KEYS | {"排盤方式", "旬首", "局日", "天乙", "長生運"}

def checked(mapping, key, kind):
    if key not in mapping:
        raise ValueError(f"未知{kind}：{key}")
    return mapping[key]

def parse_pillars(text):
    match = re.fullmatch(r"(.{2})年(.{2})月(.{2})日(.{2})時", text)
    if not match:
        raise ValueError(f"无法解析干支：{text}")
    return list(match.groups())

def normalize_board(raw):
    board = {}
    for source_key, target_key, values in (
        ("天盤", "heavenStem", raw["天盤"]),
        ("地盤", "earthStem", raw["地盤"]),
        ("門", "door", raw["門"]),
        ("星", "star", raw["星"]),
        ("神", "god", raw["神"]),
    ):
        for palace, value in values.items():
            target_palace = checked(PALACE, palace, "宫名")
            cell = board.setdefault(target_palace, {})
            table = {"門": DOOR, "星": STAR, "神": GOD}.get(source_key)
            cell[target_key] = checked(table, value, source_key) if table else value
    return board

def normalize(moment, raw):
    missing = REQUIRED_KEYS - raw.keys()
    if missing:
        raise ValueError(f"kinqimen 输出缺少键：{sorted(missing)}")
    unknown = raw.keys() - EXPECTED_KEYS
    if unknown:
        raise ValueError(f"kinqimen 输出出现未知键：{sorted(unknown)}")
    duty = raw["值符值使"]
    void = raw["旬空"]
    horse = raw["馬星"]
    xun_head, chief_stem = duty["值符天干"]
    chief_star, chief_star_palace = duty["值符星宮"]
    chief_door, chief_door_palace = duty["值使門宮"]
    pillars = parse_pillars(raw["干支"])
    normalized_chief_star = "天禽" if chief_star == "禽" and raw["地盤"].get("中") == chief_stem else checked(STAR, chief_star, "九星简称")
    return {
        "localTime": moment.strftime("%Y-%m-%d %H:%M:00"),
        "method": "时家转盘拆补法",
        "dayPillar": pillars[2],
        "hourPillar": pillars[3],
        "solarTerm": checked(SOLAR_TERM, raw["節氣"], "节气"),
        "layout": raw["排局"].replace("陰", "阴").replace("陽", "阳"),
        "xunHead": xun_head,
        "chiefStem": chief_stem,
        "chiefStar": normalized_chief_star,
        "chiefStarPalace": checked(PALACE, chief_star_palace, "宫名"),
        "chiefDoor": checked(DOOR, chief_door, "八门简称"),
        "chiefDoorPalace": checked(PALACE, chief_door_palace, "宫名"),
        "dayVoid": void["日空"],
        "hourVoid": void["時空"],
        "horse": horse["驛馬"],
        "palaces": normalize_board(raw),
    }

out = Path("tests/fixtures/qimen")
out.mkdir(parents=True, exist_ok=True)
for text in TIMES:
    moment = datetime.fromisoformat(text)
    raw = Qimen(moment.year, moment.month, moment.day, moment.hour, moment.minute).pan(1)
    target = out / f"{moment.strftime('%Y%m%d-%H%M')}.json"
    target.write_text(json.dumps(normalize(moment, raw), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"已生成 {len(TIMES)} 个奇门标准答案")
```

- [ ] **Step 3: 生成 fixtures 并检查覆盖矩阵（5 分钟）**

Run: `.venv-tools/bin/python tools/qimen/generate_fixtures.py && find tests/fixtures/qimen -name '*.json' | wc -l`

Expected: 先输出 `已生成 48 个奇门标准答案`，再输出 `48`。清单覆盖阴阳遁、上中下三元、全部十二时辰、至少十二节气、包含时干为甲的时辰；小寒、立春、夏至、秋分、寒露交接各含一小时内前后样本。若 kinqimen 的实际节气时刻令某组不在一小时内，调整清单中的分钟后重新生成，而不是修改标准答案。

- [ ] **Step 4: 写 fixture 结构失败测试（3 分钟）**

```ts
// tests/qimen.test.ts
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("kinqimen 标准答案不少于 40 个且字段完整", async () => {
  const files = (await readdir("tests/fixtures/qimen")).filter((name) => name.endsWith(".json"));
  assert.ok(files.length >= 40);
  for (const file of files) {
    const fixture = JSON.parse(await readFile(`tests/fixtures/qimen/${file}`, "utf8")) as Record<string, unknown>;
    assert.deepEqual(Object.keys(fixture), [
      "localTime", "method", "dayPillar", "hourPillar", "solarTerm", "layout", "xunHead",
      "chiefStem", "chiefStar", "chiefStarPalace", "chiefDoor",
      "chiefDoorPalace", "dayVoid", "hourVoid", "horse", "palaces",
    ]);
  }
});
```

- [ ] **Step 5: 运行结构测试（2 分钟）**

Run: `node --import tsx --test tests/qimen.test.ts`

Expected: `1 pass, 0 fail`。

- [ ] **Step 6: 提交生成器和标准答案（2 分钟）**

```bash
git add tools/qimen/generate_fixtures.py tests/fixtures/qimen tests/qimen.test.ts && git commit -m "test(qimen): 锁定拆补法标准答案"
```

### Task 4: 实现时家转盘拆补法奇门引擎

**Files:**
- Create: `src/calendar/qimen.ts`
- Modify: `tests/qimen.test.ts`
- Test: `tests/qimen.test.ts`

- [ ] **Step 1: 先写 fixtures 逐字段与人工样例失败测试（5 分钟）**

```ts
// tests/qimen.test.ts（保留 Task 3 测试，再加入）
import { qimenAt } from "../src/calendar/qimen.js";

test("TS 实现与全部 kinqimen fixtures 逐字段一致", async () => {
  const files = (await readdir("tests/fixtures/qimen")).filter((name) => name.endsWith(".json")).sort();
  for (const file of files) {
    const expected = JSON.parse(await readFile(`tests/fixtures/qimen/${file}`, "utf8"));
    const timestamp = BigInt(Date.parse(`${expected.localTime.replace(" ", "T")}+08:00`) / 1_000);
    assert.deepEqual(qimenAt(timestamp), expected, file);
  }
});

test("2026-09-30 20:15 人工核验字段不受 fixture 生成器错误遮蔽", () => {
  const result = qimenAt(BigInt(Date.UTC(2026, 8, 30, 12, 15) / 1_000));
  assert.equal(result.dayPillar, "丁未");
  assert.equal(result.hourPillar, "庚戌");
  assert.equal(result.layout, "阴遁四局下元");
  assert.equal(result.chiefStem, "壬");
  assert.equal(result.chiefStar, "天英");
  assert.equal(result.chiefStarPalace, "坤二");
  assert.equal(result.chiefDoor, "景门");
  assert.equal(result.chiefDoorPalace, "震三");
  assert.deepEqual([result.dayVoid, result.hourVoid, result.horse], ["寅卯", "寅卯", "申"]);
  assert.deepEqual(result.palaces["巽四"], { heavenStem: "己", earthStem: "戊", star: "天冲", door: "死门", god: "太阴" });
  assert.equal(result.palaces["兑七"].god, "九天");
});

test("奇门在 23 点按子时换日", () => {
  const result = qimenAt(BigInt(Date.UTC(2026, 6, 23, 15, 0) / 1_000));
  assert.equal(result.dayPillar, "己亥");
  assert.equal(result.layout, "阴遁一局中元");
});
```

- [ ] **Step 2: 运行并确认引擎尚不存在（2 分钟）**

Run: `node --import tsx --test tests/qimen.test.ts`

Expected: FAIL，包含 `Cannot find module '../src/calendar/qimen.js'`。

- [ ] **Step 3: 实现局、元、九宫旋转和完整输出（5 分钟）**

```ts
// src/calendar/qimen.ts
import lunarPkg from "lunar-javascript";
import { almanacAt } from "./almanac.js";

type Palace = "坎一" | "坤二" | "震三" | "巽四" | "中五" | "乾六" | "兑七" | "艮八" | "离九";
type RingPalace = Exclude<Palace, "中五">;
type Dun = "阳" | "阴";
interface Cell {
  heavenStem?: string;
  earthStem: string;
  star?: string;
  door?: string;
  god?: string;
}
export interface QimenResult {
  localTime: string;
  method: "时家转盘拆补法";
  dayPillar: string;
  hourPillar: string;
  solarTerm: string;
  layout: string;
  xunHead: string;
  chiefStem: string;
  chiefStar: string;
  chiefStarPalace: Palace;
  chiefDoor: string;
  chiefDoorPalace: Palace;
  dayVoid: string;
  hourVoid: string;
  horse: string;
  palaces: Record<Palace, Cell>;
}

const PALACES: readonly Palace[] = [
  "坎一", "坤二", "震三", "巽四", "中五", "乾六", "兑七", "艮八", "离九",
];
const RING: readonly RingPalace[] = ["坎一", "艮八", "震三", "巽四", "离九", "坤二", "兑七", "乾六"];
const STEMS = ["戊", "己", "庚", "辛", "壬", "癸", "丁", "丙", "乙"] as const;
const ORIGINAL_STAR: Record<Palace, string> = {
  坎一: "天蓬", 坤二: "天芮", 震三: "天冲", 巽四: "天辅", 中五: "天禽",
  乾六: "天心", 兑七: "天柱", 艮八: "天任", 离九: "天英",
};
const ORIGINAL_DOOR: Record<RingPalace, string> = {
  坎一: "休门", 艮八: "生门", 震三: "伤门", 巽四: "杜门",
  离九: "景门", 坤二: "死门", 兑七: "惊门", 乾六: "开门",
};
const GODS = {
  阳: ["值符", "腾蛇", "太阴", "六合", "勾陈", "朱雀", "九地", "九天"],
  阴: ["值符", "腾蛇", "太阴", "六合", "白虎", "玄武", "九地", "九天"],
} as const;
const XUN: Record<string, { head: string; stem: string; void: string }> = {
  甲子: { head: "甲子", stem: "戊", void: "戌亥" },
  甲戌: { head: "甲戌", stem: "己", void: "申酉" },
  甲申: { head: "甲申", stem: "庚", void: "午未" },
  甲午: { head: "甲午", stem: "辛", void: "辰巳" },
  甲辰: { head: "甲辰", stem: "壬", void: "寅卯" },
  甲寅: { head: "甲寅", stem: "癸", void: "子丑" },
};
const TERM_JU: Record<string, readonly [number, number, number]> = {
  冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6],
  立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
  春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8],
  立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
  夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4],
  立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6],
  秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2],
  立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1],
};
const STEM_INDEX: Record<string, number> = {
  甲: 0, 乙: 1, 丙: 2, 丁: 3, 戊: 4, 己: 5, 庚: 6, 辛: 7, 壬: 8, 癸: 9,
};
const BRANCH_INDEX: Record<string, number> = {
  子: 0, 丑: 1, 寅: 2, 卯: 3, 辰: 4, 巳: 5,
  午: 6, 未: 7, 申: 8, 酉: 9, 戌: 10, 亥: 11,
};
const mod = (n: number, m: number): number => ((n % m) + m) % m;
const palaceByNumber = (n: number): Palace => PALACES[n - 1]!;
const ringIndex = (p: Palace): number => RING.indexOf(p === "中五" ? "坤二" : p);

function cycleIndex(gz: string): number {
  for (let n = 0; n < 60; n += 1) {
    if (n % 10 === STEM_INDEX[gz[0]!] && n % 12 === BRANCH_INDEX[gz[1]!]) return n;
  }
  throw new Error(`无效干支：${gz}`);
}
function xunFor(gz: string) {
  const n = cycleIndex(gz);
  return XUN[["甲子", "甲戌", "甲申", "甲午", "甲辰", "甲寅"][Math.floor(n / 10)]!]!;
}
// 符头取当日或之前最近的甲／己日，并由符头地支决定上中下元。
function yuanFor(day: string): 0 | 1 | 2 {
  const index = cycleIndex(day);
  let distance = 0;
  while (distance < 5) {
    const stem = mod(index - distance, 10);
    if (stem === 0 || stem === 5) break;
    distance += 1;
  }
  const branch = mod(index - distance, 12);
  return [0, 6, 3, 9].includes(branch) ? 0 : [2, 8, 5, 11].includes(branch) ? 1 : 2;
}
function branchHorse(branch: string): string {
  const groups: Record<string, string> = { 申子辰: "寅", 寅午戌: "申", 亥卯未: "巳", 巳酉丑: "亥" };
  const group = Object.keys(groups).find((key) => key.includes(branch));
  if (!group) throw new Error(`地支 ${branch} 没有驿马组`);
  return groups[group]!;
}

export function qimenAt(timestamp: bigint): QimenResult {
  const almanac = almanacAt(timestamp);
  // 奇门按子时（23:00）换日取日柱与时柱，与 kinqimen 及传统口径一致。
  const [y, mo, d, h, mi, se] = almanac.solar.text.split(/[- :]/).map(Number) as [number, number, number, number, number, number];
  const eight = lunarPkg.Solar.fromYmdHms(y, mo, d, h, mi, se).getLunar().getEightChar();
  eight.setSect(1);
  const day = eight.getDay();
  const hour = eight.getTime();
  // 节气交接采用 lunar-javascript 的精确时刻；冬至至芒种为阳遁，其余为阴遁。
  const term = almanac.solarTerms.current;
  const yangTerms = ["冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种"];
  const dun: Dun = yangTerms.includes(term) ? "阳" : "阴";
  const yuan = yuanFor(day);
  const ju = TERM_JU[term]?.[yuan];
  if (!ju) throw new Error(`节气 ${term} 没有拆补局表`);
  // 阳遁从局数宫起顺排六仪三奇，阴遁逆排。
  const earth = {} as Record<Palace, string>;
  STEMS.forEach((stem, index) => {
    const number = mod(ju - 1 + (dun === "阳" ? index : -index), 9) + 1;
    earth[palaceByNumber(number)] = stem;
  });
  const hourXun = xunFor(hour);
  const chiefBase = Object.entries(earth).find(([, stem]) => stem === hourXun.stem)?.[0] as Palace;
  const hostedChiefBase: RingPalace = chiefBase === "中五" ? "坤二" : chiefBase;
  const chiefStar = chiefBase === "中五" ? "天禽" : ORIGINAL_STAR[hostedChiefBase];
  const chiefDoor = ORIGINAL_DOOR[hostedChiefBase];
  if (!chiefStar || !chiefDoor) throw new Error("值符值使起宫失败");
  // 值符星随时干落宫；时干为甲时随旬首六仪，中五寄坤二。
  const hourStem = hour[0] === "甲" ? hourXun.stem : hour[0]!;
  const rawStarTarget = Object.entries(earth).find(([, stem]) => stem === hourStem)?.[0] as Palace;
  const starTarget: RingPalace = rawStarTarget === "中五" ? "坤二" : rawStarTarget;
  const hourOffset = cycleIndex(hour) - cycleIndex(hourXun.head);
  // 值使门按九宫数字阳顺阴逆移动并经过中五，落中五时寄坤二。
  const baseNumber = PALACES.indexOf(chiefBase) + 1;
  const doorNumber = mod(baseNumber - 1 + (dun === "阳" ? hourOffset : -hourOffset), 9) + 1;
  const doorTarget: RingPalace = doorNumber === 5 ? "坤二" : palaceByNumber(doorNumber) as RingPalace;
  const reportedDoorTarget: Palace = palaceByNumber(doorNumber);
  const cells = {} as Record<Palace, Cell>;
  PALACES.forEach((palace) => {
    cells[palace] = { earthStem: earth[palace] };
  });
  // 天盘九星与所带地盘干按八宫环同步旋转；天禽随天芮寄坤。
  const starShift = ringIndex(starTarget) - ringIndex(hostedChiefBase);
  RING.forEach((source, index) => {
    const target = RING[mod(index + starShift, 8)]!;
    cells[target].star = ORIGINAL_STAR[source];
    cells[target].heavenStem = earth[source];
  });
  // 值符为天禽或值符落中五时，中五不留天盘干；否则中五天盘干等于地盘干。
  if (chiefBase !== "中五" && rawStarTarget !== "中五") {
    cells["中五"].heavenStem = earth["中五"];
  }
  const doorShift = ringIndex(doorTarget) - ringIndex(hostedChiefBase);
  RING.forEach((source, index) => {
    cells[RING[mod(index + doorShift, 8)]!].door = ORIGINAL_DOOR[source];
  });
  // 八神从值符落宫起，阳遁顺时针、阴遁逆时针排列。
  GODS[dun].forEach((god, index) => {
    cells[RING[mod(ringIndex(starTarget) + (dun === "阳" ? index : -index), 8)]!].god = god;
  });
  const [date, time] = almanac.solar.text.split(" ") as [string, string];
  const dayXun = xunFor(day);
  return {
    localTime: `${date} ${time}`,
    method: "时家转盘拆补法",
    dayPillar: day,
    hourPillar: hour,
    solarTerm: term,
    layout: `${dun}遁${"一二三四五六七八九"[ju - 1]}局${["上元", "中元", "下元"][yuan]}`,
    xunHead: hourXun.head,
    chiefStem: hourXun.stem,
    chiefStar,
    // 值符和值使报告原始落宫，排盘时中五寄坤二；界面显示「中五（寄坤二）」。
    chiefStarPalace: rawStarTarget,
    chiefDoor,
    chiefDoorPalace: reportedDoorTarget,
    dayVoid: dayXun.void,
    hourVoid: hourXun.void,
    horse: branchHorse(hour[1]!),
    palaces: cells,
  };
}
```

- [ ] **Step 4: 运行回归并按真实 fixtures 修正差异（5 分钟一轮）**

Run: `node --import tsx --test tests/qimen.test.ts`

Expected: `4 pass, 0 fail`；结构、48 个 fixtures、人工样例和 23 点换日用例全部通过。首次 GREEN 前不得提交；每个差异必须判断为生成器映射错误或 TS 推导错误，并以 kinqimen 原始输出复核。

- [ ] **Step 5: 类型检查（2 分钟）**

Run: `npm run typecheck`

Expected: `tsc --noEmit` 退出码 0。

- [ ] **Step 6: 提交（2 分钟）**

```bash
git add src/calendar/qimen.ts tests/qimen.test.ts && git commit -m "feat(qimen): 实现时家转盘拆补法"
```

### Task 5: 实现朱熹变占法主占之辞

**Files:**
- Create: `src/calendar/bianzhan.ts`
- Create: `tests/bianzhan.test.ts`
- Test: `tests/bianzhan.test.ts`

- [ ] **Step 1: 写 0–6 动爻完整失败测试（5 分钟）**

```ts
// tests/bianzhan.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { selectPrimaryOracleText } from "../src/calendar/bianzhan.js";

const cases: ReadonlyArray<{
  lines: readonly number[];
  kind: string;
  primary: string;
  secondary: readonly string[];
}> = [
  { lines: [7, 7, 7, 8, 8, 8], kind: "本卦卦辞", primary: "卦辞", secondary: [] },
  { lines: [9, 7, 7, 8, 8, 8], kind: "本卦爻辞", primary: "初九", secondary: [] },
  { lines: [7, 9, 7, 8, 9, 8], kind: "本卦两爻辞", primary: "九五", secondary: ["九二"] },
  { lines: [9, 9, 9, 8, 8, 8], kind: "本卦与之卦卦辞", primary: "卦辞", secondary: ["之卦卦辞"] },
  { lines: [9, 9, 9, 8, 8, 9], kind: "之卦两不动爻辞", primary: "六四", secondary: ["六五"] },
  { lines: [9, 9, 9, 7, 9, 9], kind: "之卦不动爻辞", primary: "九四", secondary: [] },
];
for (const item of cases) {
  test(`${item.lines.filter((value) => value === 6 || value === 9).length} 个动爻`, () => {
    const result = selectPrimaryOracleText(item.lines);
    assert.equal(result.rule, item.kind);
    assert.equal(result.primary.label, item.primary);
    assert.ok(result.primary.text.length > 0);
    assert.deepEqual(result.secondary.map((value) => value.label), item.secondary);
    result.secondary.forEach((value) => assert.ok(value.text.length > 0));
  });
}
test("乾六爻皆动用九，坤六爻皆动用六，其余用之卦卦辞", () => {
  assert.equal(selectPrimaryOracleText([9, 9, 9, 9, 9, 9]).primary.label, "用九");
  assert.equal(selectPrimaryOracleText([6, 6, 6, 6, 6, 6]).primary.label, "用六");
  assert.equal(selectPrimaryOracleText([9, 6, 9, 6, 9, 6]).primary.label, "之卦卦辞");
});
```

- [ ] **Step 2: 运行并确认模块尚不存在（2 分钟）**

Run: `node --import tsx --test tests/bianzhan.test.ts`

Expected: FAIL，包含 `Cannot find module '../src/calendar/bianzhan.js'`。

- [ ] **Step 3: 实现语料选择（5 分钟）**

```ts
// src/calendar/bianzhan.ts
import { getHexagramText, type ZhouyiLineText } from "../agent/zhouyi-corpus.js";
import { deriveFiveHexagrams } from "../oracle/liuyao-chart.js";

export interface OracleSelection {
  rule: string;
  primary: ZhouyiLineText;
  secondary: readonly ZhouyiLineText[];
}
const judgement = (label: string, text: string): ZhouyiLineText => ({ label, text });

export function selectPrimaryOracleText(lines: readonly number[]): OracleSelection {
  const five = deriveFiveHexagrams(lines);
  const primary = getHexagramText(five.primary.kingWenNumber);
  const derived = getHexagramText(five.derived.kingWenNumber);
  const moving = lines.map((value, index) => value === 6 || value === 9 ? index : -1).filter((index) => index >= 0);
  const still = lines.map((_, index) => index).filter((index) => !moving.includes(index));
  if (moving.length === 0) return { rule: "本卦卦辞", primary: judgement("卦辞", primary.judgement), secondary: [] };
  if (moving.length === 1) return { rule: "本卦爻辞", primary: primary.lines[moving[0]!]!, secondary: [] };
  if (moving.length === 2) return { rule: "本卦两爻辞", primary: primary.lines[moving[1]!]!, secondary: [primary.lines[moving[0]!]!] };
  if (moving.length === 3) return {
    rule: "本卦与之卦卦辞",
    primary: judgement("卦辞", primary.judgement),
    secondary: [judgement("之卦卦辞", derived.judgement)],
  };
  if (moving.length === 4) return { rule: "之卦两不动爻辞", primary: derived.lines[still[0]!]!, secondary: [derived.lines[still[1]!]!] };
  if (moving.length === 5) return { rule: "之卦不动爻辞", primary: derived.lines[still[0]!]!, secondary: [] };
  const special = primary.kingWenNumber === 1 ? "用九" : primary.kingWenNumber === 2 ? "用六" : null;
  if (!special) return { rule: "之卦卦辞", primary: judgement("之卦卦辞", derived.judgement), secondary: [] };
  const extra = primary.extras.find((item) => item.label === special);
  if (!extra) throw new Error(`${primary.name}语料缺少${special}`);
  return { rule: special, primary: extra, secondary: [] };
}
```

- [ ] **Step 4: 运行测试和类型检查（2–5 分钟）**

Run: `node --import tsx --test tests/bianzhan.test.ts && npm run typecheck`

Expected: `7 pass, 0 fail`；`tsc --noEmit` 退出码 0。

- [ ] **Step 5: 提交（2 分钟）**

```bash
git add src/calendar/bianzhan.ts tests/bianzhan.test.ts && git commit -m "feat(calendar): 实现朱熹变占法"
```

### Task 6: 实现梅花体用、互变与节气月旺衰

**Files:**
- Modify: `src/oracle/liuyao-chart.ts`
- Create: `src/calendar/meihua.ts`
- Create: `tests/meihua.test.ts`
- Test: `tests/meihua.test.ts`

- [ ] **Step 1: 先写地天泰样例和体用分支失败测试（5 分钟）**

```ts
// tests/meihua.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { deriveMeihua } from "../src/calendar/meihua.js";

const SAMPLE = BigInt(Date.UTC(2026, 8, 30, 12, 15) / 1_000);
test("地天泰初爻独动：乾用坤体、体生用、变卦地风升且变卦克体", () => {
  const result = deriveMeihua([9, 7, 7, 8, 8, 8], SAMPLE);
  assert.deepEqual(result.body, { position: "upper", name: "坤", element: "土", strength: "休" });
  assert.deepEqual(result.use, { position: "lower", name: "乾", element: "金" });
  assert.equal(result.bodyUseRelation, "体生用");
  assert.equal(result.mutual.name, "雷泽归妹");
  assert.deepEqual(result.changed, {
    name: "地风升",
    changedUse: { name: "巽", element: "木" },
    relationToBody: "变卦克体",
  });
});
test("无动爻取下卦为用", () => {
  assert.equal(deriveMeihua([7, 7, 7, 8, 8, 8], SAMPLE).use.position, "lower");
});
test("上下都有动爻时多者为用，相同取下卦", () => {
  assert.equal(deriveMeihua([9, 9, 7, 6, 8, 8], SAMPLE).use.position, "lower");
  assert.equal(deriveMeihua([9, 7, 7, 6, 6, 8], SAMPLE).use.position, "upper");
  assert.equal(deriveMeihua([9, 7, 7, 6, 8, 8], SAMPLE).use.position, "lower");
});
```

- [ ] **Step 2: 运行并确认模块尚不存在（2 分钟）**

Run: `node --import tsx --test tests/meihua.test.ts`

Expected: FAIL，包含 `Cannot find module '../src/calendar/meihua.js'`。

- [ ] **Step 3: 仅把既有旺衰函数改为导出（2 分钟）**

在 `src/oracle/liuyao-chart.ts:399` 的既有 `function strengthFor` 前加 `export`；函数体不改写、不复制旺衰表。

- [ ] **Step 4: 实现梅花纯函数（5 分钟）**

```ts
// src/calendar/meihua.ts
import {
  deriveFiveHexagrams, deriveSolarMonth, FIVE_ELEMENT_GENERATES, FIVE_ELEMENT_OVERCOMES, strengthFor,
  type FiveElement, type PalaceName, type StrengthState,
} from "../oracle/liuyao-chart.js";

type Position = "upper" | "lower";
type Relation = "比和" | "体生用" | "用生体" | "体克用" | "用克体";
const CHANGED_RELATION: Record<Relation, string> = {
  比和: "变卦与体比和", 体生用: "体生变卦", 用生体: "变卦生体", 体克用: "体克变卦", 用克体: "变卦克体",
};
const TRIGRAMS: Record<number, { name: PalaceName; element: FiveElement }> = {
  0: { name: "坤", element: "土" }, 1: { name: "震", element: "木" }, 2: { name: "坎", element: "水" }, 3: { name: "兑", element: "金" },
  4: { name: "艮", element: "土" }, 5: { name: "离", element: "火" }, 6: { name: "巽", element: "木" }, 7: { name: "乾", element: "金" },
};
function trigram(lines: readonly boolean[]) {
  const number = lines.reduce((sum, yang, index) => sum + (yang ? 1 << index : 0), 0);
  return TRIGRAMS[number]!;
}
function relation(body: FiveElement, use: FiveElement): Relation {
  if (body === use) return "比和";
  if (FIVE_ELEMENT_GENERATES[body] === use) return "体生用";
  if (FIVE_ELEMENT_GENERATES[use] === body) return "用生体";
  return FIVE_ELEMENT_OVERCOMES[body] === use ? "体克用" : "用克体";
}
export interface MeihuaResult {
  body: { position: Position; name: PalaceName; element: FiveElement; strength: StrengthState };
  use: { position: Position; name: PalaceName; element: FiveElement };
  bodyUseRelation: Relation;
  mutual: { name: string; lower: PalaceName; upper: PalaceName };
  changed: { name: string; changedUse: { name: PalaceName; element: FiveElement }; relationToBody: string };
  rule: string;
}
export function deriveMeihua(lines: readonly number[], timestamp: bigint): MeihuaResult {
  const five = deriveFiveHexagrams(lines);
  const lowerMoves = lines.slice(0, 3).filter((value) => value === 6 || value === 9).length;
  const upperMoves = lines.slice(3).filter((value) => value === 6 || value === 9).length;
  const usePosition: Position = upperMoves > lowerMoves ? "upper" : "lower";
  const bodyPosition: Position = usePosition === "lower" ? "upper" : "lower";
  const lower = trigram(five.primary.yangLines.slice(0, 3));
  const upper = trigram(five.primary.yangLines.slice(3));
  const changedLower = trigram(five.derived.yangLines.slice(0, 3));
  const changedUpper = trigram(five.derived.yangLines.slice(3));
  const body = bodyPosition === "lower" ? lower : upper;
  const use = usePosition === "lower" ? lower : upper;
  const changedUse = usePosition === "lower" ? changedLower : changedUpper;
  const month = deriveSolarMonth(timestamp);
  return {
    body: { position: bodyPosition, ...body, strength: strengthFor(month.element, body.element) },
    use: { position: usePosition, ...use },
    bodyUseRelation: relation(body.element, use.element),
    mutual: { name: five.mutual.name, lower: trigram(five.primary.yangLines.slice(1, 4)).name, upper: trigram(five.primary.yangLines.slice(2, 5)).name },
    changed: { name: five.derived.name, changedUse, relationToBody: CHANGED_RELATION[relation(body.element, changedUse.element)] },
    rule: "按本站体用取法；本站不采集外应",
  };
}
```

- [ ] **Step 5: 运行测试；若样例旺衰预期与既有五级表冲突，以既有 `strengthFor` 实际结果修正测试说明（2–5 分钟）**

Run: `node --import tsx --test tests/meihua.test.ts && node --import tsx --test tests/liuyao-chart.test.ts`

Expected: 两个测试文件全部 PASS；现有六爻测试无回归。地天泰样例必须锁定乾为用、坤为体、体生用、地风升、巽木克坤土；旺衰值只来自已导出的既有函数，不复制表。

- [ ] **Step 6: 类型检查（2 分钟）**

Run: `npm run typecheck`

Expected: `tsc --noEmit` 退出码 0。

- [ ] **Step 7: 清理六爻输出中的日文中点（3 分钟）**

先用测试锁定六爻展示事实不含日文中点。在 `tests/liuyao-chart.test.ts` 加入：

```ts
test("六爻展示事实不含日文中点", () => {
  const chart = buildLiuyaoChart({ lines: [7, 8, 7, 8, 7, 8], timestamp: SAMPLE_TIMESTAMP });
  assert.doesNotMatch(JSON.stringify(chart), /・/u);
});
```

先运行 `node --import tsx --test tests/liuyao-chart.test.ts`，预期因两处 U+30FB 而 FAIL。检查 `rg -n '・|京房纳甲' tests/liuyao-chart.test.ts` 后，把 `src/oracle/liuyao-chart.ts` 中 `现状・初始` 与 `京房纳甲・八宫世应・六甲旬空・节气月` 的 `・` 替换为 `·`；现有 `chart.school` 正则不绑定分隔符。再次运行同一测试，预期全部 PASS，且 `rg -n '・' src/oracle/liuyao-chart.ts` 无输出。

- [ ] **Step 8: 提交（2 分钟）**

```bash
git add src/oracle/liuyao-chart.ts src/calendar/meihua.ts tests/meihua.test.ts tests/liuyao-chart.test.ts && git commit -m "feat(calendar): 实现梅花体用并清理展示分隔符"
```

### Task 7: Chunk 1 交叉验收

**Files:**
- Test: `tests/almanac.test.ts`
- Test: `tests/qimen.test.ts`
- Test: `tests/bianzhan.test.ts`
- Test: `tests/meihua.test.ts`
- Test: `tests/liuyao-chart.test.ts`

- [ ] **Step 1: 运行 Chunk 1 定向测试（2–5 分钟）**

Run: `node --import tsx --test tests/almanac.test.ts tests/qimen.test.ts tests/bianzhan.test.ts tests/meihua.test.ts tests/liuyao-chart.test.ts`

Expected: 所有测试 PASS、0 FAIL；奇门标准答案不少于 40 个且逐字段一致；历法 500 个固定抽样全部通过。

- [ ] **Step 2: 运行全量测试（5 分钟）**

Run: `npm test`

Expected: 所有测试 PASS、0 FAIL；旧六爻、问事与服务端测试无回归。

- [ ] **Step 3: 运行严格类型检查（2 分钟）**

Run: `npm run typecheck`

Expected: `tsc --noEmit` 退出码 0。

- [ ] **Step 4: 核对 OpenSpec 覆盖但不提前勾选任务（2 分钟）**

Run: `rg -n "1\.[123]" openspec/changes/sanyi-chinese-redesign/tasks.md && rg -n "时空栏|黄历面板|历法一致性守卫|奇门时盘|奇门回归标准|主占之辞变占法|梅花体用取法" openspec/changes/sanyi-chinese-redesign/specs/{shikong-almanac-qimen,question-three-schools}/spec.md`

Expected: 显示 1.1、1.2、1.3 和七条 Requirement；本 Chunk 的测试分别对应其全部 Scenario。`tasks.md` 只在 Chunk 6 全量验收后统一更新。

- [ ] **Step 5: 提交只在验收产生修正时执行（2 分钟）**

若验收没有产生文件改动，不创建空提交；若只修正本 Chunk 测试或实现，运行：

```bash
git add src/calendar src/oracle/liuyao-chart.ts src/types/lunar-javascript.d.ts tools/qimen tests/almanac.test.ts tests/qimen.test.ts tests/bianzhan.test.ts tests/meihua.test.ts && git commit -m "test(calendar): 完成术数历法交叉验收"
```

## Chunk 2A: 分类、六掷与盘面核对
### Task 8: 统一问题分类与付款前改选
**Files:**
- Create: `src/sanyi/classify.ts`
- Modify: `src/oracle/question-classifier.ts`
- Create: `tests/sanyi-classify.test.ts`
- Test: `tests/question-classifier.test.ts`
- [ ] **Step 1: 写失败测试（5 分钟）**
```ts
// tests/sanyi-classify.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { classifyQuestion, overrideClassification } from "../src/sanyi/classify.js";
const cases = [
  ["我本月财运怎么样", "fortune", "month"],
  ["我今年运势如何", "fortune", "year"],
  ["我明年运势如何", "fortune", "next-year"],
  ["2027年我的运势", "fortune", "year:2027"],
  ["今天运气怎么样", "fortune", "today"],
  ["我适合做什么工作", "destiny", undefined],
  ["看看我的八字", "destiny", undefined],
  ["那件事会怎样", "question", undefined],
  ["给女儿起个名字，姓王", "naming", undefined],
  ["下个月哪天搬家好", "date-selection", undefined],
  ["天蝎座本月运势", "zodiac", undefined],
  ["我们俩合不合", "compatibility", undefined],
] as const;
for (const [question, kind, horizon] of cases) {
  test(question, () => {
    const result = classifyQuestion(question);
    assert.equal(result.kind, kind);
    assert.equal(result.horizon, horizon);
  });
}
test("问事复用现有事项分类", () => {
  const result = classifyQuestion("这次面试能过吗");
  assert.equal(result.subject?.key, "career");
  assert.equal(result.subject?.useGod, "官鬼");
});
test("未开放类型给出问事替代建议", () => {
  const result = classifyQuestion("给女儿起个名字，姓王");
  assert.equal(result.supported, false);
  assert.match(result.suggestion ?? "", /给孩子起名叫某某好不好/);
});
test("付款前可改类型、事项和时间范围", () => {
  const base = classifyQuestion("我本月财运怎么样");
  const changed = overrideClassification(base, { kind: "question", subjectKey: "career" });
  assert.equal(changed.kind, "question");
  assert.equal(changed.subject?.key, "career");
  assert.throws(() => overrideClassification(base, { horizon: "year:20x7" }), /时间范围无效/);
});
test("规范化并拒绝无意义或越界输入", () => {
  assert.equal(classifyQuestion("  那件事   会怎样  ").question, "那件事 会怎样");
  assert.equal(classifyQuestion("1234").kind, "other");
  assert.throws(() => classifyQuestion("123"), /4–280/);
});
```
- [ ] **Step 2: 运行 RED（2 分钟）**
Run: `node --import tsx --test tests/sanyi-classify.test.ts`
Expected: FAIL，包含 `Cannot find module '../src/sanyi/classify.js'`。
- [ ] **Step 3: 实现分类器（5 分钟）**
```ts
// src/sanyi/classify.ts
import {
  QUESTION_SUBJECTS,
  classifyQuestionSubject,
  type QuestionSubjectKey,
  type QuestionSubjectSuggestion,
} from "../oracle/question-classifier.js";
export type QuestionKind =
  | "question"
  | "destiny"
  | "fortune"
  | "naming"
  | "date-selection"
  | "zodiac"
  | "compatibility"
  | "other";
export type FortuneHorizon = "today" | "month" | "year" | "next-year" | `year:${number}`;
export interface QuestionClassification {
  question: string;
  kind: QuestionKind;
  horizon?: FortuneHorizon;
  subject?: QuestionSubjectSuggestion;
  supported: boolean;
  needsBirth: boolean;
  suggestion?: string;
}

const RULES: ReadonlyArray<[Exclude<QuestionKind, "question" | "other">, RegExp]> = [
  ["naming", /起名|取名|名字/],
  ["compatibility", /合婚|合不合|八字合/],
  ["date-selection", /择日|哪天|吉日|搬家.*日/],
  [
    "zodiac",
    new RegExp(
      "星座|星盘|白羊|金牛|双子|巨蟹|狮子|处女|天秤|"+
      "天蝎|射手|摩羯|水瓶|双鱼",
    ),
  ],
  ["fortune", /运势|运气|流年|财运/],
  ["destiny", /八字|命里|命格|适合做什么|性格|一生命运/],
];
const UNSUPPORTED: Record<Exclude<QuestionKind, "question" | "destiny" | "fortune">, string> = {
  naming: "起名即将开放。也可以改为问事，例如「给孩子起名叫某某好不好」。",
  "date-selection": "择日即将开放。也可以把候选日期当作一件事来问。",
  zodiac: "星座即将开放。也可以把关心的事情改为问事。",
  compatibility: "合婚即将开放。也可以把这段关系改为一件事来问。",
  other: "暂时无法识别这个问题，请改写成一件具体的事来问。",
};
export function normalizeQuestion(value: string): string {
  const question = value.trim().replace(/\s+/g, " ");
  if (question.length < 4 || question.length > 280) {
    throw new Error("问题长度必须为 4–280 个字符");
  }
  return question;
}
function horizonFor(question: string): FortuneHorizon {
  const year = question.match(/(20\d{2})年/)?.[1];
  if (year) return `year:${Number(year)}`;
  if (/今天|今日/.test(question)) return "today";
  if (/本月|这个月/.test(question)) return "month";
  if (/明年/.test(question)) return "next-year";
  return "year";
}

export function classifyQuestion(raw: string): QuestionClassification {
  const question = normalizeQuestion(raw);
  const matched = RULES.find(([, pattern]) => pattern.test(question));
  const hasText = /[\p{Script=Han}A-Za-z]/u.test(question);
  const kind: QuestionKind = matched?.[0] ?? (hasText ? "question" : "other");
  const supported = kind === "question" || kind === "destiny" || kind === "fortune";
  return {
    question,
    kind,
    supported,
    needsBirth: kind === "destiny" || kind === "fortune",
    ...(kind === "fortune" ? { horizon: horizonFor(question) } : {}),
    ...(kind === "question" ? { subject: classifyQuestionSubject(question) } : {}),
    ...(!supported ? { suggestion: UNSUPPORTED[kind as keyof typeof UNSUPPORTED] } : {}),
  };
}
export function overrideClassification(
  base: QuestionClassification,
  patch: { kind?: QuestionKind; horizon?: FortuneHorizon | string; subjectKey?: QuestionSubjectKey },
): QuestionClassification {
  const kind = patch.kind ?? base.kind;
  const kinds: readonly QuestionKind[] = [
    "question",
    "destiny",
    "fortune",
    "naming",
    "date-selection",
    "zodiac",
    "compatibility",
    "other",
  ];
  if (!kinds.includes(kind)) {
    throw new Error("问题类型无效");
  }
  if (
    patch.horizon !== undefined
    && !/^(today|month|year|next-year|year:20\d{2})$/.test(patch.horizon)
  ) {
    throw new Error("时间范围无效");
  }
  const option = patch.subjectKey === undefined
    ? undefined
    : QUESTION_SUBJECTS.find((item) => item.key === patch.subjectKey);
  if (patch.subjectKey !== undefined && !option) {
    throw new Error("事项类型无效");
  }
  return {
    question: base.question,
    kind,
    supported: kind === "question" || kind === "destiny" || kind === "fortune",
    needsBirth: kind === "destiny" || kind === "fortune",
    ...(kind === "fortune" ? { horizon: (patch.horizon ?? base.horizon ?? "year") as FortuneHorizon } : {}),
    ...(kind === "question"
      ? {
          subject: option
            ? { ...option, reason: "用户在付款前主动改选事项。" }
            : base.subject ?? classifyQuestionSubject(base.question),
        }
      : {}),
    ...(!["question", "destiny", "fortune"].includes(kind)
      ? { suggestion: UNSUPPORTED[kind as keyof typeof UNSUPPORTED] }
      : {}),
  };
}
```

- [ ] **Step 4: 先扩展现有事业关键词（2 分钟）**

在 `src/oracle/question-classifier.ts` 的 `career` 项中，把 `pattern` 精确改为：

```ts
{
  key: "career",
  pattern: new RegExp(
    "面试|求职|应聘|跳槽|辞职|离职|工作|职业|事业|岗位|"+
    "官职|功名|升职|入职|offer|录取|丈夫|老公|先生|盗贼|小偷",
  ),
  reason: "问题涉及求职、工作、官职或功名。",
},
```

并在 `tests/question-classifier.test.ts` 的“事项主题独立建议用神”测试中加入：

```ts
const interview = classifyQuestion("这次面试能过吗").subject;
assert.equal(interview.key, "career");
assert.equal(interview.useGod, "官鬼");
```

- [ ] **Step 5: GREEN、类型检查与提交（5 分钟）**

Run: `node --import tsx --test tests/sanyi-classify.test.ts tests/question-classifier.test.ts && npm run typecheck`

Expected: `16 pass, 0 fail`；`tsc --noEmit` 退出码 0。

```bash
git add src/sanyi/classify.ts src/oracle/question-classifier.ts \
  tests/sanyi-classify.test.ts tests/question-classifier.test.ts \
  && git commit -m "feat(sanyi): 实现统一问题分类"
```

### Task 9: 六掷派生与区块约束

**Files:**
- Create: `src/sanyi/throws.ts`
- Create: `tests/sanyi-throws.test.ts`

- [ ] **Step 1: 写失败测试（5 分钟）**

```ts
// tests/sanyi-throws.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { encodePacked, keccak256, type Hex } from "viem";
import { ArcUnavailableError, assertNextThrow, deriveThrow, waitForBlockAfter } from "../src/sanyi/throws.js";
const TX = `0x${"11".repeat(32)}` as Hex;
const BLOCK = `0x${"22".repeat(32)}` as Hex;

test("单掷与 viem 现场计算完全一致", () => {
  const expectedHash = keccak256(encodePacked(
    ["string", "bytes32", "bytes32", "string", "uint8"],
    ["sanyi-throw-v1", TX, BLOCK, "这件事会怎样", 1],
  ));
  const bits = Number(BigInt(expectedHash) & 7n);
  const coins = [bits & 1, (bits >> 1) & 1, (bits >> 2) & 1];
  const result = deriveThrow({
    paymentTxHash: TX,
    blockHash: BLOCK,
    question: "  这件事会怎样 ",
    index: 1,
  });
  assert.deepEqual(result.coins, coins);
  assert.equal(result.value, 6 + coins.reduce((sum, coin) => sum + coin, 0));
});
test("四种背数映射为交单拆重", () => {
  const expected = [[0, 6, "交"], [1, 7, "单"], [2, 8, "拆"], [3, 9, "重"]] as const;
  for (const [backs, value, name] of expected) {
    assert.deepEqual({ value: 6 + backs, name: ["交", "单", "拆", "重"][backs] }, { value, name });
  }
});
test("顺序、上限与新区块约束", async () => {
  assert.equal(assertNextThrow([], 1), undefined);
  assert.throws(() => assertNextThrow([], 2), /需先完成第 1 掷/);
  const complete = Array.from({ length: 6 }, (_, offset) => ({ index: offset + 1 }));
  assert.throws(() => assertNextThrow(complete, 7), /六掷已经完成/);
  const blocks = [{ number: 9n, hash: BLOCK, timestamp: 1n }, { number: 11n, hash: BLOCK, timestamp: 2n }];
  const source = {
    latest: async () => {
      const block = blocks.shift();
      assert.ok(block);
      return block;
    },
  };
  const block = await waitForBlockAfter(source, 10n, {
    timeoutMs: 10,
    pollMs: 0,
    now: () => 0,
    sleep: async () => {},
  });
  assert.equal(block.number, 11n);
});
test("超时抛可续掷错误", async () => {
  let now = 0;
  await assert.rejects(
    waitForBlockAfter(
      { latest: async () => ({ number: 10n, hash: BLOCK, timestamp: 1n }) },
      10n,
      {
        timeoutMs: 10,
        pollMs: 5,
        now: () => now,
        sleep: async (ms) => {
          now += ms;
        },
      },
    ),
    (error: unknown) => error instanceof ArcUnavailableError && /未能取得天时/.test(error.message),
  );
});
```

- [ ] **Step 2: 运行 RED（2 分钟）**

Run: `node --import tsx --test tests/sanyi-throws.test.ts`

Expected: FAIL，包含 `Cannot find module '../src/sanyi/throws.js'`。

- [ ] **Step 3: 实现六掷纯函数（5 分钟）**

```ts
// src/sanyi/throws.ts
import { encodePacked, keccak256, type Hex } from "viem";
import type { QuestionBlockSource } from "../oracle/question-oracle.js";
import { normalizeQuestion } from "./classify.js";
export type Coin = 0 | 1;
export interface ThrowResult {
  index: number;
  coins: readonly [Coin, Coin, Coin];
  backs: number;
  value: number;
  name: "交" | "单" | "拆" | "重";
  moving: boolean;
}
export interface RecordedThrow extends ThrowResult {
  blockNumber: string;
  blockHash: Hex;
  blockTimestamp: string;
}
export class ArcUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("未能取得天时（Arc 网络无响应），稍后可继续", options);
    this.name = "ArcUnavailableError";
  }
}
export interface DeriveThrowInput {
  paymentTxHash: Hex;
  blockHash: Hex;
  question: string;
  index: number;
}
export function deriveThrow(input: DeriveThrowInput): ThrowResult {
  if (!Number.isInteger(input.index) || input.index < 1 || input.index > 6) {
    throw new Error("掷序必须为 1–6");
  }
  const hash = keccak256(encodePacked(
    ["string", "bytes32", "bytes32", "string", "uint8"],
    ["sanyi-throw-v1", input.paymentTxHash, input.blockHash, normalizeQuestion(input.question), input.index],
  ));
  const bits = Number(BigInt(hash) & 7n);
  const coins: [Coin, Coin, Coin] = [
    (bits & 1) as Coin,
    ((bits >> 1) & 1) as Coin,
    ((bits >> 2) & 1) as Coin,
  ];
  const backs = coins.reduce<number>((sum, coin) => sum + coin, 0);
  const value = 6 + backs;
  const names: readonly ThrowResult["name"][] = ["交", "单", "拆", "重"];
  const name = names[backs];
  if (!name) {
    throw new Error("铜钱背面数量无效");
  }
  return {
    index: input.index,
    coins,
    backs,
    value,
    name,
    moving: value === 6 || value === 9,
  };
}
export function assertNextThrow(recorded: readonly Pick<RecordedThrow, "index">[], index: number): void {
  if (index > 6 || recorded.length >= 6) throw new Error("六掷已经完成，不能进行第七掷");
  const expected = recorded.length + 1;
  if (index !== expected) throw new Error(`需先完成第 ${expected} 掷`);
}
export async function waitForBlockAfter(
  source: QuestionBlockSource,
  minExclusive: bigint,
  options: {
    timeoutMs?: number;
    pollMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<Awaited<ReturnType<QuestionBlockSource["latest"]>>> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollMs = options.pollMs ?? 250;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const started = now();
  try {
    while (now() - started < timeoutMs) {
      const block = await source.latest();
      if (block.number > minExclusive) return block;
      await sleep(pollMs);
    }
  } catch (error) {
    throw new ArcUnavailableError({ cause: error });
  }
  throw new ArcUnavailableError();
}
```

- [ ] **Step 4: GREEN、类型检查与提交（5 分钟）**

Run: `node --import tsx --test tests/sanyi-throws.test.ts && npm run typecheck`

Expected: `4 pass, 0 fail`；`tsc --noEmit` 退出码 0。

```bash
git add src/sanyi/throws.ts tests/sanyi-throws.test.ts && git commit -m "feat(sanyi): 实现可复算六掷"
```

### Task 10: 编号事实表、断语 Schema 与盘面核对

**Files:**
- Create: `src/sanyi/facts.ts`
- Create: `src/sanyi/schema.ts`
- Create: `src/sanyi/audit.ts`
- Create: `tests/helpers/sample-question.ts`
- Create: `tests/sanyi-facts.test.ts`
- Create: `tests/sanyi-schema.test.ts`
- Create: `tests/sanyi-audit.test.ts`

- [ ] **Step 1: 写失败测试（5 分钟）**

```ts
// tests/helpers/sample-question.ts
import { selectPrimaryOracleText } from "../../src/calendar/bianzhan.js";
import { deriveMeihua } from "../../src/calendar/meihua.js";
import {
  buildLiuyaoChart,
  deriveFiveHexagrams,
} from "../../src/oracle/liuyao-chart.js";
import { buildQuestionFacts } from "../../src/sanyi/facts.js";
import type { QuestionSchoolOutput } from "../../src/sanyi/schema.js";

export const TIME = BigInt(Date.UTC(2026, 8, 30, 12, 15) / 1_000);
export const LINES: readonly number[] = [9, 7, 7, 8, 8, 8];
export const chart = buildLiuyaoChart({
  lines: LINES,
  timestamp: TIME,
  focus: {
    subjectKey: "career",
    subjectLabel: "工作／官职",
    useGod: "官鬼",
    overridden: false,
  },
});
export const facts = buildQuestionFacts(
  chart,
  deriveFiveHexagrams(LINES),
  deriveMeihua(LINES, TIME),
  selectPrimaryOracleText(LINES),
);
export const baseOutput: QuestionSchoolOutput = {
  verdict: "平",
  confidenceTenths: 5,
  headline: "守正待时",
  reason: "条件未齐",
  sections: [
    { title: "用神", text: "先看用神" },
    { title: "世应", text: "再看世应" },
    { title: "动变", text: "后看动变" },
  ],
  advice: ["等待明确通知"],
  evidence: [{ ref: "line:2", claim: "官鬼" }],
};
```

```ts
// tests/sanyi-facts.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { facts } from "./helpers/sample-question.js";

test("事实表覆盖盘面编号并锁定已核验爻位", () => {
  assert.deepEqual(
    [...facts.keys()].slice(0, 3),
    ["line:1", "line:2", "line:3"],
  );
  assert.equal(facts.get("line:1")?.tokens.has("甲子"), true);
  assert.equal(facts.get("line:1")?.tokens.has("妻财"), true);
  assert.equal(facts.get("line:1")?.tokens.has("辛丑"), true);
  assert.equal(facts.get("line:1")?.tokens.has("回头克"), true);
  assert.equal(facts.get("line:2")?.tokens.has("旬空"), true);
  assert.equal(facts.get("line:2")?.tokens.has("伏"), true);
  for (const id of [
    "month",
    "day",
    "use-god",
    "body-use",
    "hexagram:primary",
    "hexagram:derived",
    "hexagram:mutual",
    "hexagram:opposite",
    "hexagram:reversed",
    "main-text",
  ]) {
    assert.equal(facts.has(id), true, `缺少事实：${id}`);
  }
});
```

```ts
// tests/sanyi-audit.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { auditOutput, tokenizeClaim } from "../src/sanyi/audit.js";
import type { QuestionSchoolOutput } from "../src/sanyi/schema.js";
import { baseOutput, facts } from "./helpers/sample-question.js";

function evidenceOutput(ref: string, claim: string): QuestionSchoolOutput {
  return {
    ...baseOutput,
    evidence: [{ ref, claim }],
  };
}

function proseOutput(text: string): QuestionSchoolOutput {
  return {
    ...baseOutput,
    sections: [
      { title: "正文", text },
      ...baseOutput.sections.slice(1),
    ],
  };
}

const CASES: ReadonlyArray<{
  name: string;
  output: QuestionSchoolOutput;
  expected: boolean;
}> = [
  {
    name: "允许二爻甲寅木官鬼死且旬空",
    output: evidenceOutput("line:2", "甲寅木官鬼死且旬空"),
    expected: true,
  },
  {
    name: "允许上爻应爻酉金子孙旺",
    output: evidenceOutput("line:6", "应爻酉金子孙旺"),
    expected: true,
  },
  {
    name: "允许初爻动化丑土回头克",
    output: evidenceOutput("line:1", "初爻子水动化丑土回头克"),
    expected: true,
  },
  {
    name: "允许三爻世爻辰土兄弟休",
    output: evidenceOutput("line:3", "世爻辰土兄弟休"),
    expected: true,
  },
  {
    name: "允许二爻伏乙巳火父母",
    output: evidenceOutput("line:2", "伏乙巳火父母"),
    expected: true,
  },
  {
    name: "允许用神官鬼与忌神子孙",
    output: evidenceOutput("use-god", "用神官鬼，忌神子孙"),
    expected: true,
  },
  {
    name: "允许正文引用盘中多个真实组合",
    output: proseOutput("寅木官鬼旬空，子水妻财发动来生，化丑土兄弟回头克"),
    expected: true,
  },
  {
    name: "正文普通词不触发单字误判",
    output: proseOutput("此事宜休息片刻，相助者多，应当耐心"),
    expected: true,
  },
  {
    name: "拦截不存在的时柱编号",
    output: evidenceOutput("pillar:time", "庚戌"),
    expected: false,
  },
  {
    name: "拦截三爻虚构旬空",
    output: evidenceOutput("line:3", "辰土兄弟旬空"),
    expected: false,
  },
  {
    name: "拦截二爻错误六亲",
    output: evidenceOutput("line:2", "寅木妻财"),
    expected: false,
  },
  {
    name: "拦截四爻虚构发动",
    output: evidenceOutput("line:4", "癸丑土兄弟动"),
    expected: false,
  },
  {
    name: "拦截正文不存在的午火官鬼",
    output: proseOutput("午火官鬼旺"),
    expected: false,
  },
];

for (const sample of CASES) {
  test(sample.name, () => {
    const result = auditOutput(sample.output, facts);
    assert.equal(result.ok, sample.expected, result.errors.join("；"));
  });
}

test("分词按最长候选从左到右匹配", () => {
  assert.deepEqual(
    tokenizeClaim("应爻酉金子孙旺"),
    ["应", "酉", "金", "子孙", "旺"],
  );
  assert.deepEqual(tokenizeClaim("甲寅木官鬼"), ["甲寅", "木", "官鬼"]);
  assert.deepEqual(tokenizeClaim("化丑土回头克"), ["丑", "土", "回头克"]);
});
```

```ts
// tests/sanyi-schema.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { Ajv } from "ajv";
import {
  QUESTION_SCHOOL_SCHEMA,
  checkVerdictConsistency,
  type QuestionSchoolOutput,
  type Verdict,
} from "../src/sanyi/schema.js";
import { baseOutput } from "./helpers/sample-question.js";

function consistency(verdict: Verdict, confidenceTenths: number): string[] {
  return checkVerdictConsistency({ verdict, confidenceTenths });
}

test("五种吉凶使用规定的把握边界", () => {
  for (const verdict of ["大吉", "吉"] as const) {
    assert.deepEqual(consistency(verdict, 6), []);
    assert.notDeepEqual(consistency(verdict, 5), []);
  }
  assert.deepEqual(consistency("平", 4), []);
  assert.deepEqual(consistency("平", 6), []);
  assert.notDeepEqual(consistency("平", 3), []);
  assert.notDeepEqual(consistency("平", 7), []);
  for (const verdict of ["凶", "大凶"] as const) {
    assert.deepEqual(consistency(verdict, 4), []);
    assert.notDeepEqual(consistency(verdict, 5), []);
  }
});

const validate = new Ajv({ allErrors: true }).compile(QUESTION_SCHOOL_SCHEMA);

function valid(value: unknown): boolean {
  return validate(value) === true;
}

test("JSON Schema 接受完整合法对象", () => {
  assert.equal(valid(baseOutput), true, JSON.stringify(validate.errors));
});

const INVALID_CASES: ReadonlyArray<{
  name: string;
  value: QuestionSchoolOutput | Record<string, unknown>;
}> = [
  {
    name: "拒绝十七字标题",
    value: { ...baseOutput, headline: "一二三四五六七八九十一二三四五六七" },
  },
  {
    name: "拒绝少于三段正文",
    value: { ...baseOutput, sections: baseOutput.sections.slice(0, 2) },
  },
  {
    name: "拒绝应期缺少成立条件",
    value: { ...baseOutput, timing: { window: "下月" } },
  },
  {
    name: "拒绝未声明的额外字段",
    value: { ...baseOutput, extra: true },
  },
];

for (const sample of INVALID_CASES) {
  test(sample.name, () => {
    assert.equal(valid(sample.value), false);
  });
}
```

- [ ] **Step 2: 运行 RED（2 分钟）**

Run: `node --import tsx --test tests/sanyi-facts.test.ts tests/sanyi-schema.test.ts tests/sanyi-audit.test.ts`

Expected: FAIL，三个模块均不存在。

- [ ] **Step 3: 实现 Schema 与自洽校验（5 分钟）**

```ts
// src/sanyi/schema.ts
import type { JsonSchema } from "../agent/schemas.js";
export type Verdict = "大吉" | "吉" | "平" | "凶" | "大凶";
export interface QuestionSchoolOutput {
  verdict: Verdict;
  confidenceTenths: number;
  headline: string;
  reason: string;
  sections: ReadonlyArray<{ title: string; text: string }>;
  timing?: { window: string; condition: string };
  advice: readonly string[];
  evidence: ReadonlyArray<{ ref: string; claim: string }>;
}
export const QUESTION_SCHOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "confidenceTenths", "headline", "reason", "sections", "advice", "evidence"],
  properties: {
    verdict: { type: "string", enum: ["大吉", "吉", "平", "凶", "大凶"] },
    confidenceTenths: { type: "integer", minimum: 1, maximum: 9 },
    headline: { type: "string", minLength: 1, maxLength: 16 },
    reason: { type: "string", minLength: 1, maxLength: 60 },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text"],
        properties: {
          title: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
        },
      },
    },
    timing: {
      type: "object",
      additionalProperties: false,
      required: ["window", "condition"],
      properties: {
        window: { type: "string", minLength: 1 },
        condition: { type: "string", minLength: 1 },
      },
    },
    advice: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 1 } },
    evidence: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "claim"],
        properties: {
          ref: { type: "string", minLength: 1 },
          claim: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const satisfies JsonSchema;
export function checkVerdictConsistency(
  output: Pick<QuestionSchoolOutput, "verdict" | "confidenceTenths">,
): string[] {
  const { verdict, confidenceTenths } = output;
  if ((verdict === "大吉" || verdict === "吉") && confidenceTenths < 6) {
    return [`${verdict}对应的把握不得低于六成`];
  }
  if (verdict === "平" && (confidenceTenths < 4 || confidenceTenths > 6)) {
    return ["平对应的把握必须为四至六成"];
  }
  if ((verdict === "凶" || verdict === "大凶") && confidenceTenths > 4) {
    return [`${verdict}对应的把握不得高于四成`];
  }
  return [];
}
```

- [ ] **Step 4: 实现事实表与核对器（5 分钟）**

```ts
// src/sanyi/facts.ts
import type { FiveHexagrams, LiuyaoChart } from "../oracle/liuyao-chart.js";
import type { MeihuaResult } from "../calendar/meihua.js";
import type { OracleSelection } from "../calendar/bianzhan.js";
export interface Fact { id: string; label: string; tokens: ReadonlySet<string> }
export type FactTable = Map<string, Fact>;
type TokenValue = string | null | undefined | false;

function words(values: readonly TokenValue[]): Set<string> {
  return new Set(
    values.filter((value): value is string => typeof value === "string" && value.length > 0),
  );
}

function stemOf(stemBranch: string): string {
  return stemBranch.slice(0, 1);
}

export function buildQuestionFacts(
  chart: LiuyaoChart,
  five: FiveHexagrams,
  meihua: MeihuaResult,
  main: OracleSelection,
): FactTable {
  const facts: FactTable = new Map();
  for (const row of chart.rows) {
    const tokens = words([
      row.primary.stemBranch,
      stemOf(row.primary.stemBranch),
      row.primary.branch,
      row.primary.element,
      row.primary.relation,
      row.sixSpirit,
      row.marker,
      row.primary.strength,
      row.primary.isVoid && "旬空",
      row.primary.isMonthBroken && "月破",
      row.isDayBroken && "日破",
      row.isHiddenMoving && "暗动",
      row.changing && "动",
      row.changing && row.changed.stemBranch,
      row.changing && stemOf(row.changed.stemBranch),
      row.changing && row.changed.branch,
      row.changing && row.changed.element,
      row.changing && row.changed.relation,
      row.returnEffect,
      row.advanceRetreat,
      row.hidden && "伏",
      row.hidden?.stemBranch,
      row.hidden && stemOf(row.hidden.stemBranch),
      row.hidden?.stemBranch.slice(1),
      row.hidden?.element,
      row.hidden?.relation,
    ]);
    const id = `line:${row.position}`;
    facts.set(id, { id, label: `${row.position}爻：${[...tokens].join(" ")}`, tokens });
  }
  const add = (id: string, label: string, tokens: readonly string[]): void => {
    facts.set(id, { id, label, tokens: new Set(tokens) });
  };
  add("month", `月建${chart.month.branch}`, [chart.month.branch, chart.month.element, "月建"]);
  add(
    "day",
    `日辰${chart.day.ganzhi}，旬空${chart.day.voidBranches.join("")}`,
    [chart.day.ganzhi, chart.day.stem, chart.day.branch, ...chart.day.voidBranches, "旬空"],
  );
  if (chart.focus) {
    add("use-god", `用神${chart.focus.useGod}`, [
      "用神",
      chart.focus.useGod,
      "原神",
      chart.focus.originalGod,
      "忌神",
      chart.focus.tabooGod,
      "仇神",
      chart.focus.enemyGod,
    ]);
  }
  add("body-use", `${meihua.body.name}为体，${meihua.use.name}为用`, [
    "体",
    meihua.body.name,
    meihua.body.element,
    "用",
    meihua.use.name,
    meihua.use.element,
    meihua.bodyUseRelation,
  ]);
  const keys = ["primary", "derived", "mutual", "opposite", "reversed"] as const;
  for (const key of keys) {
    add(`hexagram:${key}`, five[key].name, [five[key].name]);
  }
  add("main-text", `${main.primary.label}：${main.primary.text}`, [main.primary.label]);
  return facts;
}
```

```ts
// src/sanyi/audit.ts
import type { FactTable } from "./facts.js";
import type { QuestionSchoolOutput } from "./schema.js";

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const CYCLE = Array.from({ length: 60 }, (_, index) => {
  return `${STEMS[index % 10]}${BRANCHES[index % 12]}`;
});
const WORDS = [
  "回头生", "回头克",
  "父母", "子孙", "官鬼", "妻财", "兄弟",
  "青龙", "朱雀", "勾陈", "螣蛇", "白虎", "玄武",
  "旬空", "月破", "日破", "暗动", "进神", "退神",
  "用神", "原神", "忌神", "仇神",
  ...CYCLE,
  ...STEMS,
  ...BRANCHES,
  ..."金木水火土旺相休囚死世应伏动体用",
].sort((left, right) => right.length - left.length);
const COMBINATION = new RegExp(
  "([子丑寅卯辰巳午未申酉戌亥])"+
  "([金木水火土])"+
  "(父母|子孙|官鬼|妻财|兄弟)",
  "g",
);

export function tokenizeClaim(text: string): string[] {
  const tokens: string[] = [];
  for (let index = 0; index < text.length;) {
    const token = WORDS.find((candidate) => text.startsWith(candidate, index));
    if (token) {
      tokens.push(token);
      index += token.length;
    } else {
      index += 1;
    }
  }
  return tokens;
}

export function auditOutput(
  output: QuestionSchoolOutput,
  facts: FactTable,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const evidence of output.evidence) {
    const fact = facts.get(evidence.ref);
    if (!fact) {
      errors.push(`事实编号不存在：${evidence.ref}`);
      continue;
    }
    for (const token of tokenizeClaim(evidence.claim)) {
      if (!fact.tokens.has(token)) {
        errors.push(`${evidence.ref} 不支持关键词：${token}`);
      }
    }
  }
  const lineTokens = [...facts]
    .filter(([id]) => id.startsWith("line:"))
    .map(([, fact]) => fact.tokens);
  const prose = [
    output.headline,
    output.reason,
    ...output.sections.map((section) => section.text),
  ].join("\n");
  for (const match of prose.matchAll(COMBINATION)) {
    const tokens = match.slice(1);
    if (!lineTokens.some((set) => tokens.every((token) => set.has(token)))) {
      errors.push(`正文出现不存在的盘面组合：${match[0]}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 5: GREEN、类型检查与提交（5 分钟）**

Run: `node --import tsx --test tests/sanyi-facts.test.ts tests/sanyi-schema.test.ts tests/sanyi-audit.test.ts && npm run typecheck`

Expected: 全部 PASS、0 FAIL；`tsc --noEmit` 退出码 0。

```bash
git add src/sanyi/facts.ts src/sanyi/schema.ts src/sanyi/audit.ts tests/sanyi-facts.test.ts tests/sanyi-schema.test.ts tests/sanyi-audit.test.ts && git commit -m "feat(sanyi): 建立断语事实核对边界"
```

### Task 11: Chunk 2A 交叉验收

**Files:**
- Test: `tests/sanyi-classify.test.ts`
- Test: `tests/sanyi-throws.test.ts`
- Test: `tests/sanyi-facts.test.ts`
- Test: `tests/sanyi-schema.test.ts`
- Test: `tests/sanyi-audit.test.ts`
- Test: `tests/question-classifier.test.ts`
- Test: `tests/liuyao-chart.test.ts`

- [ ] **Step 1: 运行 2A 定向测试（5 分钟）**

Run: `node --import tsx --test tests/sanyi-classify.test.ts tests/sanyi-throws.test.ts tests/sanyi-facts.test.ts tests/sanyi-schema.test.ts tests/sanyi-audit.test.ts tests/question-classifier.test.ts tests/liuyao-chart.test.ts`

Expected: 全部 PASS、0 FAIL；分类器与六爻既有测试无回归。

- [ ] **Step 2: 运行严格类型检查（2 分钟）**

Run: `npm run typecheck`

Expected: `tsc --noEmit` 退出码 0。

- [ ] **Step 3: 提交（2 分钟）**

```bash
git add src/oracle/question-classifier.ts src/sanyi tests/helpers/sample-question.ts tests/sanyi-*.test.ts tests/question-classifier.test.ts && git commit -m "test(sanyi): 完成问事领域纯函数验收"
```


## Chunk 2B: 三家提示词、原文与存档

### Task 12: 三家提示词、原文与确定性 mock

**Files:**
- Create: `src/sanyi/original-texts.ts`
- Create: `src/sanyi/schools/shared.ts`
- Create: `src/sanyi/schools/chengyi.ts`
- Create: `src/sanyi/schools/jingfang.ts`
- Create: `src/sanyi/schools/shaoyong.ts`
- Create: `src/sanyi/schools/index.ts`
- Create: `src/sanyi/mock-schools.ts`
- Create: `tests/sanyi-schools.test.ts`

- [ ] **Step 1: 写失败测试（5 分钟）**

```ts
// tests/sanyi-schools.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { Ajv } from "ajv";
import { auditOutput } from "../src/sanyi/audit.js";
import { buildOriginalTexts } from "../src/sanyi/original-texts.js";
import { mockSchoolOutput } from "../src/sanyi/mock-schools.js";
import {
  QUESTION_SCHOOL_SCHEMA,
  checkVerdictConsistency,
} from "../src/sanyi/schema.js";
import { QUESTION_SCHOOLS } from "../src/sanyi/schools/index.js";
import {
  LINES,
  facts,
} from "./helpers/sample-question.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { selectPrimaryOracleText } from "../src/calendar/bianzhan.js";

const originals = buildOriginalTexts(
  deriveFiveHexagrams(LINES),
  selectPrimaryOracleText(LINES),
);

test("原文清单含本卦之卦全部爻辞与主占之辞", () => {
  assert.match(originals.join("\n"), /本卦 地天泰 初九：拔茅茹/);
  assert.match(originals.join("\n"), /之卦 地风升/);
  assert.match(originals.join("\n"), /主占之辞/);
  assert.equal(originals.filter((line) => /[初二三四五上]/.test(line)).length >= 12, true);
});

test("三家系统提示词给出完整写作与安全边界", () => {
  for (const school of QUESTION_SCHOOLS) {
    assert.match(school.systemPrompt, /不得出现押钱、赔付、封存/);
    assert.match(school.systemPrompt, /evidence\.ref/);
    assert.match(school.systemPrompt, /JSON/);
    assert.match(school.systemPrompt, /健康.*就医/s);
    assert.match(school.systemPrompt, /医疗、法律或投资结论/);
  }
  assert.match(QUESTION_SCHOOLS[1].systemPrompt, /以用神为纲/);
  assert.match(QUESTION_SCHOOLS[2].systemPrompt, /按本站体用取法/);
  assert.match(QUESTION_SCHOOLS[2].systemPrompt, /不得虚构外应/);
});

test("三家用户提示严格隔离事实且都收到原文", () => {
  const prompts = QUESTION_SCHOOLS.map((school) => {
    return school.buildUserPrompt({
      question: "这次面试能过吗",
      facts,
      originalTexts: originals,
    });
  });
  assert.doesNotMatch(prompts[0]!, /line:/);
  assert.doesNotMatch(prompts[2]!, /use-god/);
  for (const prompt of prompts) {
    assert.match(prompt, /本卦 地天泰/);
    assert.doesNotMatch(prompt, /值符|黄历|宜：|忌：/);
  }
});

test("三家 mock 同时通过结构、自洽和事实核对", () => {
  const validate = new Ajv({ allErrors: true }).compile(QUESTION_SCHOOL_SCHEMA);
  const pairs = QUESTION_SCHOOLS.map((school) => {
    return [school.key, mockSchoolOutput(school.key, facts)] as const;
  });
  assert.equal(new Set(pairs.map(([, output]) => output.verdict)).size, 3);
  assert.equal(new Set(pairs.map(([, output]) => output.confidenceTenths)).size, 3);
  for (const [key, output] of pairs) {
    assert.equal(validate(output), true, `${key}: ${JSON.stringify(validate.errors)}`);
    assert.deepEqual(checkVerdictConsistency(output), []);
    assert.deepEqual(auditOutput(output, facts), { ok: true, errors: [] });
    assert.doesNotMatch(JSON.stringify(output), /易者|押钱|赔付|封存|・/u);
  }
});
```

- [ ] **Step 2: 运行 RED（2 分钟）**

Run: `node --import tsx --test tests/sanyi-schools.test.ts`

Expected: FAIL，提示 `original-texts.js` 或三家模块不存在。

- [ ] **Step 3: 实现原文清单（5 分钟）**

```ts
// src/sanyi/original-texts.ts
import { getHexagramText } from "../agent/zhouyi-corpus.js";
import type { OracleSelection } from "../calendar/bianzhan.js";
import type { FiveHexagrams } from "../oracle/liuyao-chart.js";

function hexagramTexts(
  role: "本卦" | "之卦",
  figure: FiveHexagrams["primary"],
): string[] {
  const text = getHexagramText(figure.kingWenNumber);
  return [
    `${role} ${text.name} 卦辞：${text.judgement}`,
    ...text.lines.map((line) => {
      return `${role} ${text.name} ${line.label}：${line.text}`;
    }),
    ...text.extras.map((line) => {
      return `${role} ${text.name} ${line.label}：${line.text}`;
    }),
  ];
}

export function buildOriginalTexts(
  five: FiveHexagrams,
  selection: OracleSelection,
): string[] {
  return [
    ...hexagramTexts("本卦", five.primary),
    ...hexagramTexts("之卦", five.derived),
    `主占之辞 ${selection.primary.label}：${selection.primary.text}`,
    ...selection.secondary.map((item) => {
      return `辅占之辞 ${item.label}：${item.text}`;
    }),
  ];
}
```

- [ ] **Step 4: 实现三家定义（5 分钟）**

```ts
// src/sanyi/schools/shared.ts
import type { FactTable } from "../facts.js";

export interface SchoolInput {
  question: string;
  facts: FactTable;
  originalTexts: readonly string[];
}

export interface QuestionSchool {
  key: "chengyi" | "jingfang" | "shaoyong";
  name: string;
  school: string;
  systemPrompt: string;
  buildUserPrompt(input: SchoolInput): string;
}

export function buildSchoolPrompt(
  input: SchoolInput,
  allowed: readonly string[],
  mainFirst = false,
): string {
  const facts = [...input.facts.values()].filter((fact) => {
    return allowed.some((prefix) => {
      return fact.id === prefix || fact.id.startsWith(prefix);
    });
  });
  const originals = mainFirst
    ? [...input.originalTexts].sort((left) => left.startsWith("主占") ? -1 : 1)
    : input.originalTexts;
  return [
    `问题：${input.question}`,
    "可用事实编号：",
    ...facts.map((fact) => `${fact.id}：${fact.label}`),
    "可直接引用的原文：",
    ...originals,
  ].join("\n");
}
```

```ts
// src/sanyi/schools/chengyi.ts
import { buildSchoolPrompt, type QuestionSchool } from "./shared.js";

export const chengyi = {
  key: "chengyi",
  name: "程颐",
  school: "义理派",
  systemPrompt: `你是程颐，以义理派路径解读问事卦。
sections 依次写：一、主占之辞与卦义；二、卦时卦德与处境；三、处世之道与行动。
只能直接引用用户提示提供的原文，不得补写、改写为伪引文或编造排盘数据。
evidence.ref 只能使用用户提示“可用事实编号”中列出的编号。
应期必须同时说明成立条件；健康类问题必须建议就医。
不得给出医疗、法律或投资结论；不得出现押钱、赔付、封存。
自称使用“程颐”，不使用“易者”；输出必须严格符合给定 JSON Schema。`,
  buildUserPrompt(input) {
    return buildSchoolPrompt(
      input,
      ["hexagram:", "main-text", "month"],
      true,
    );
  },
} satisfies QuestionSchool;
```

```ts
// src/sanyi/schools/jingfang.ts
import { buildSchoolPrompt, type QuestionSchool } from "./shared.js";

export const jingfang = {
  key: "jingfang",
  name: "京房",
  school: "纳甲六爻",
  systemPrompt: `你是京房，以纳甲六爻路径解读问事卦。
以用神为纲，sections 依次写：一、用神旺衰空破；二、原神忌神；三、世应与动变；四、应期。
只能直接引用用户提示提供的原文，不得补写、改写为伪引文或编造排盘数据。
evidence.ref 只能使用用户提示“可用事实编号”中列出的编号。
应期必须同时说明成立条件；健康类问题必须建议就医。
不得给出医疗、法律或投资结论；不得出现押钱、赔付、封存。
自称使用“京房”，不使用“易者”；输出必须严格符合给定 JSON Schema。`,
  buildUserPrompt(input) {
    return buildSchoolPrompt(input, [
      "line:",
      "use-god",
      "day",
      "month",
      "hexagram:primary",
      "hexagram:derived",
    ]);
  },
} satisfies QuestionSchool;
```

```ts
// src/sanyi/schools/shaoyong.ts
import { buildSchoolPrompt, type QuestionSchool } from "./shared.js";

export const shaoyong = {
  key: "shaoyong",
  name: "邵雍",
  school: "梅花易数",
  systemPrompt: `你是邵雍，以梅花易数路径解读问事卦，按本站体用取法。
sections 依次写：一、体用生克；二、互卦与变卦；三、时令与行动。
本站不采集外应，不得虚构外应；不得编造排盘数据。
只能直接引用用户提示提供的原文，不得补写或改写为伪引文。
evidence.ref 只能使用用户提示“可用事实编号”中列出的编号。
应期必须同时说明成立条件；健康类问题必须建议就医。
不得给出医疗、法律或投资结论；不得出现押钱、赔付、封存。
自称使用“邵雍”，不使用“易者”；输出必须严格符合给定 JSON Schema。`,
  buildUserPrompt(input) {
    return buildSchoolPrompt(input, ["body-use", "hexagram:", "month"]);
  },
} satisfies QuestionSchool;
```

```ts
// src/sanyi/schools/index.ts
import { chengyi } from "./chengyi.js";
import { jingfang } from "./jingfang.js";
import { shaoyong } from "./shaoyong.js";

export const QUESTION_SCHOOLS = [chengyi, jingfang, shaoyong] as const;
export type QuestionSchoolKey = typeof QUESTION_SCHOOLS[number]["key"];
```

- [ ] **Step 5: 实现确定性 mock（5 分钟）**

```ts
// src/sanyi/mock-schools.ts
import type { FactTable } from "./facts.js";
import type { QuestionSchoolOutput } from "./schema.js";
import type { QuestionSchoolKey } from "./schools/index.js";

const SETTINGS = {
  chengyi: { verdict: "吉", confidenceTenths: 6, ref: "main-text" },
  jingfang: { verdict: "平", confidenceTenths: 5, ref: "use-god" },
  shaoyong: { verdict: "凶", confidenceTenths: 4, ref: "body-use" },
} as const;

export function mockSchoolOutput(
  key: QuestionSchoolKey,
  facts: FactTable,
): QuestionSchoolOutput {
  const setting = SETTINGS[key];
  const fact = facts.get(setting.ref);
  if (!fact) {
    throw new Error(`mock 缺少事实：${setting.ref}`);
  }
  return {
    verdict: setting.verdict,
    confidenceTenths: setting.confidenceTenths,
    headline: "守正待时",
    reason: "依盘面事实判断，宜先核实条件",
    sections: [
      { title: "依据", text: fact.label },
      { title: "判断", text: "条件尚未齐备" },
      { title: "行动", text: "先核实客观条件" },
    ],
    advice: ["保留调整余地"],
    evidence: [{ ref: fact.id, claim: [...fact.tokens].join(" ") }],
  };
}
```

- [ ] **Step 6: GREEN、类型检查与提交（5 分钟）**

Run: `node --import tsx --test tests/sanyi-schools.test.ts && npm run typecheck`

Expected: `4 pass, 0 fail`；严格类型检查退出码 0。

```bash
git add src/sanyi/original-texts.ts src/sanyi/schools src/sanyi/mock-schools.ts \
  tests/sanyi-schools.test.ts \
  && git commit -m "feat(sanyi): 实现三家提示词与原文输入"
```

### Task 13: 原子存档、付款凭证与脱敏日志

**Files:**
- Create: `src/sanyi/store.ts`
- Create: `src/sanyi/log.ts`
- Create: `tests/sanyi-store.test.ts`

- [ ] **Step 1: 写失败测试（5 分钟）**

```ts
// tests/sanyi-store.test.ts
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ReadingStore, isReadingId, newReadingId } from "../src/sanyi/store.js";
import type { StoredReading } from "../src/sanyi/store.js";

function emptyReading(id = newReadingId()): StoredReading {
  return {
    id,
    kind: "question",
    createdAt: "2026-09-30T12:15:00.000Z",
    question: "这次面试能过吗",
    subject: {
      suggestedKey: "career",
      finalKey: "career",
      overridden: false,
      changes: 0,
    },
    payment: {
      payer: `0x${"11".repeat(20)}`,
      transactionHashes: [`0x${"22".repeat(32)}`],
      firstHash: `0x${"22".repeat(32)}`,
      shares: [],
    },
    throws: [],
    schools: {
      chengyi: { status: "pending", attempts: 0, retries: 0 },
      jingfang: { status: "pending", attempts: 0, retries: 0 },
      shaoyong: { status: "pending", attempts: 0, retries: 0 },
    },
    status: "awaiting-throws",
  };
}

async function withStore(
  run: (store: ReadingStore, root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "sanyi-store-"));
  try {
    await run(new ReadingStore(root), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("写读往返保留具体类型字段", async () => {
  await withStore(async (store) => {
    const reading = emptyReading();
    await store.write(reading);
    assert.deepEqual(await store.read(reading.id), reading);
  });
});

test("reading id 固定 26 位且一千次无重复", () => {
  const ids = Array.from({ length: 1_000 }, () => newReadingId());
  assert.equal(ids.every(isReadingId), true);
  assert.equal(new Set(ids).size, 1_000);
});

test("付款凭证跨 store 实例仍不可复用", async () => {
  await withStore(async (store, root) => {
    const id = newReadingId();
    assert.equal(await store.claimPayment("claim", id), null);
    assert.equal(await store.claimPayment("claim", newReadingId()), id);
    const restarted = new ReadingStore(root);
    assert.equal(await restarted.claimPayment("claim", newReadingId()), id);
  });
});

test("同一 reading 的二十次并发更新不丢失", async () => {
  await withStore(async (store) => {
    const reading = emptyReading();
    await store.write(reading);
    await Promise.all(Array.from({ length: 20 }, (_, index) => {
      return store.update(reading.id, (current) => {
        return { ...current, lines: [...(current.lines ?? []), index] };
      });
    }));
    assert.equal((await store.read(reading.id)).lines?.length, 20);
  });
});

test("非法 id 被拒绝且存档键不含生辰前缀", async () => {
  await withStore(async (store) => {
    await assert.rejects(store.read("../bad"), /reading id 无效/);
    const reading = emptyReading();
    await store.write(reading);
    const keys: string[] = [];
    JSON.stringify(await store.read(reading.id), (key, value) => {
      keys.push(key);
      return value;
    });
    assert.equal(keys.some((key) => /^birth/i.test(key)), false);
  });
});
```

- [ ] **Step 2: 运行 RED（2 分钟）**

Run: `node --import tsx --test tests/sanyi-store.test.ts`

Expected: FAIL，提示 `store.js` 不存在。

- [ ] **Step 3: 实现具体类型与原子 store（5 分钟）**

```ts
// src/sanyi/store.ts
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Address, Hex } from "viem";
import type { QuestionFeeReceipt } from "../oracle/fee-payment.js";
import type { LiuyaoChart } from "../oracle/liuyao-chart.js";
import type { AlmanacResult } from "../calendar/almanac.js";
import type { OracleSelection } from "../calendar/bianzhan.js";
import type { MeihuaResult } from "../calendar/meihua.js";
import type { QimenResult } from "../calendar/qimen.js";
import type { QuestionSubjectKey } from "../oracle/question-classifier.js";
import type { QuestionSchoolOutput } from "./schema.js";
import type { QuestionSchoolKey } from "./schools/index.js";
import type { RecordedThrow } from "./throws.js";

export interface SchoolState {
  status: "pending" | "writing" | "done" | "failed" | "rejected";
  output?: QuestionSchoolOutput;
  attempts: number;
  retries: number;
  error?: string;
}

export interface StoredReading {
  id: string;
  kind: "question";
  createdAt: string;
  question: string;
  subject: {
    suggestedKey: QuestionSubjectKey;
    finalKey: QuestionSubjectKey;
    overridden: boolean;
    changes: number;
  };
  payment: {
    payer: Address;
    transactionHashes: readonly Hex[];
    firstHash: Hex;
    shares: QuestionFeeReceipt["shares"];
  };
  throws: readonly RecordedThrow[];
  schools: Record<QuestionSchoolKey, SchoolState>;
  status: "awaiting-throws" | "charting" | "writing" | "done" | "failed";
  error?: string;
  castTime?: string;
  lines?: readonly number[];
  chart?: LiuyaoChart;
  meihua?: MeihuaResult;
  bianzhan?: OracleSelection;
  almanac?: AlmanacResult;
  qimen?: QimenResult;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export function newReadingId(bytes = randomBytes(16)): string {
  let buffer = 0;
  let bitCount = 0;
  let result = "";
  for (const byte of bytes) {
    buffer = buffer * 256 + byte;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      const divisor = 2 ** bitCount;
      const index = Math.floor(buffer / divisor) & 31;
      result += ALPHABET[index];
      buffer %= divisor;
    }
  }
  if (bitCount > 0) {
    result += ALPHABET[(buffer << (5 - bitCount)) & 31];
  }
  return result;
}

export function isReadingId(value: string): boolean {
  return /^[a-z2-7]{26}$/.test(value);
}

export class ReadingStore {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly root = "data") {}

  private readingPath(id: string): string {
    if (!isReadingId(id)) {
      throw new Error("reading id 无效");
    }
    return join(this.root, "readings", `${id}.json`);
  }

  async read(id: string): Promise<StoredReading> {
    const text = await readFile(this.readingPath(id), "utf8");
    return JSON.parse(text) as StoredReading;
  }

  async write(reading: StoredReading): Promise<void> {
    const directory = join(this.root, "readings");
    await mkdir(directory, { recursive: true });
    const target = this.readingPath(reading.id);
    const temporary = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(temporary, `${JSON.stringify(reading, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }

  async update(
    id: string,
    change: (reading: StoredReading) => StoredReading,
  ): Promise<StoredReading> {
    let result: StoredReading | undefined;
    const previous = this.queues.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      result = change(await this.read(id));
      await this.write(result);
    });
    this.queues.set(id, next);
    try {
      await next;
    } finally {
      if (this.queues.get(id) === next) {
        this.queues.delete(id);
      }
    }
    if (!result) {
      throw new Error("存档更新未产生结果");
    }
    return result;
  }

  async claimPayment(claimKey: string, readingId: string): Promise<string | null> {
    const directory = join(this.root, "payment-claims");
    await mkdir(directory, { recursive: true });
    const digest = createHash("sha256").update(claimKey).digest("hex");
    const path = join(directory, `${digest}.json`);
    try {
      const handle = await open(path, "wx");
      try {
        await handle.writeFile(JSON.stringify({ readingId }), "utf8");
      } finally {
        await handle.close();
      }
      return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      const stored = JSON.parse(await readFile(path, "utf8")) as {
        readingId: string;
      };
      return stored.readingId;
    }
  }
}
```

- [ ] **Step 4: 实现脱敏日志（3 分钟）**

```ts
// src/sanyi/log.ts
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface SanyiLogger {
  write(
    message: string,
    fields?: Readonly<Record<string, string | number | boolean>>,
  ): Promise<void>;
}

export function createSanyiLogger(
  root = "log",
  clock: () => Date = () => new Date(),
): SanyiLogger {
  return {
    async write(message, fields = {}) {
      const now = clock();
      const local = new Date(now.getTime() + 8 * 3_600_000);
      const date = local.toISOString().slice(0, 10);
      const safe = Object.fromEntries(
        Object.entries(fields).filter(([key]) => {
          return !/^birth/i.test(key) && !/secret|mnemonic|private/i.test(key);
        }),
      );
      await mkdir(root, { recursive: true });
      const line = JSON.stringify({ time: now.toISOString(), message, ...safe });
      await appendFile(join(root, `sanyi_${date}.log`), `${line}\n`, "utf8");
    },
  };
}
```

- [ ] **Step 5: GREEN、类型检查与提交（5 分钟）**

Run: `node --import tsx --test tests/sanyi-store.test.ts && npm run typecheck`

Expected: `5 pass, 0 fail`；严格类型检查退出码 0。

```bash
git add src/sanyi/store.ts src/sanyi/log.ts tests/sanyi-store.test.ts \
  && git commit -m "feat(sanyi): 实现原子问事存档与脱敏日志"
```

### Task 14: 单家落笔与核对重写

**Files:**
- Create: `src/sanyi/school-runner.ts`
- Create: `tests/sanyi-school-runner.test.ts`

- [ ] **Step 1: 写单家调用、重写与失败测试（5 分钟）**

```ts
// tests/sanyi-school-runner.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import type {
  StructuredOutputProvider,
  StructuredOutputRequest,
} from "../src/agent/provider.js";
import { mockSchoolOutput } from "../src/sanyi/mock-schools.js";
import { runSchool } from "../src/sanyi/school-runner.js";
import type { QuestionSchoolOutput } from "../src/sanyi/schema.js";
import { QUESTION_SCHOOLS } from "../src/sanyi/schools/index.js";
import { facts } from "./helpers/sample-question.js";

class FakeProvider implements StructuredOutputProvider {
  readonly modelId = "fake";
  readonly providerConfig = {};
  readonly providerConfigHash = `0x${"00".repeat(32)}` as const;
  readonly requests: StructuredOutputRequest[] = [];

  constructor(
    private readonly responses: Array<QuestionSchoolOutput | Error>,
  ) {}

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error("测试响应不足");
    }
    if (response instanceof Error) {
      throw response;
    }
    return response as T;
  }
}

const school = QUESTION_SCHOOLS[1];
const valid = mockSchoolOutput("jingfang", facts);
const invalid: QuestionSchoolOutput = {
  ...valid,
  verdict: "吉",
  confidenceTenths: 3,
};
const input = {
  school,
  question: "这次面试能过吗",
  facts,
  originalTexts: ["本卦 地天泰 卦辞：泰，小往大来，吉亨。"],
};

test("一次通过返回 done 且 calls 为一", async () => {
  const provider = new FakeProvider([valid]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "done");
  assert.equal(result.calls, 1);
});

test("首次核对失败后重写通过，并附带上次错误", async () => {
  const provider = new FakeProvider([invalid, valid]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /吉对应的把握不得低于六成/);
});

test("连续两次核对失败返回 rejected", async () => {
  const provider = new FakeProvider([invalid, invalid]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "rejected");
  assert.equal(result.calls, 2);
  assert.match(result.status === "rejected" ? result.error : "", /未通过盘面核对/);
});

test("模型抛错返回 failed 与中文错误", async () => {
  const provider = new FakeProvider([new Error("暂不可用")]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "failed");
  assert.equal(result.calls, 1);
  assert.match(result.status === "failed" ? result.error : "", /模型调用失败.*暂不可用/);
});
```

- [ ] **Step 2: 运行 RED（2 分钟）**

Run: `node --import tsx --test tests/sanyi-school-runner.test.ts`

Expected: FAIL，提示 `school-runner.js` 不存在。

- [ ] **Step 3: 实现单家落笔与至多一次重写（5 分钟）**

```ts
// src/sanyi/school-runner.ts
import type { StructuredOutputProvider } from "../agent/provider.js";
import { auditOutput } from "./audit.js";
import type { FactTable } from "./facts.js";
import {
  QUESTION_SCHOOL_SCHEMA,
  checkVerdictConsistency,
  type QuestionSchoolOutput,
} from "./schema.js";
import type { QuestionSchool } from "./schools/shared.js";

export interface SchoolRunDependencies {
  provider: StructuredOutputProvider;
}

export interface SchoolRunInput {
  school: QuestionSchool;
  question: string;
  facts: FactTable;
  originalTexts: readonly string[];
}

export type SchoolRunResult =
  | { status: "done"; output: QuestionSchoolOutput; calls: number }
  | { status: "failed" | "rejected"; error: string; calls: number };

function validationErrors(
  output: QuestionSchoolOutput,
  facts: FactTable,
): string[] {
  return [
    ...checkVerdictConsistency(output),
    ...auditOutput(output, facts).errors,
  ];
}

export async function runSchool(
  deps: SchoolRunDependencies,
  input: SchoolRunInput,
): Promise<SchoolRunResult> {
  const basePrompt = input.school.buildUserPrompt(input);
  let userPrompt = basePrompt;
  let calls = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      calls += 1;
      const output = await deps.provider.generateStructured<QuestionSchoolOutput>({
        taskId: `sanyi/question/${input.school.key}`,
        systemPrompt: input.school.systemPrompt,
        cacheSystemPrompt: true,
        userPrompt,
        schema: QUESTION_SCHOOL_SCHEMA,
        effort: "medium",
      });
      const errors = validationErrors(output, input.facts);
      if (errors.length === 0) {
        return { status: "done", output, calls };
      }
      if (pass === 1) {
        return {
          status: "rejected",
          error: `断语未通过盘面核对：${errors.join("；")}`,
          calls,
        };
      }
      userPrompt = [
        basePrompt,
        "",
        "上一次输出未通过核对，请修正后完整重写：",
        ...errors.map((error) => `- ${error}`),
      ].join("\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: "failed", error: `模型调用失败：${message}`, calls };
    }
  }
  return { status: "rejected", error: "断语未通过盘面核对", calls };
}
```

- [ ] **Step 4: GREEN、严格类型检查与提交（5 分钟）**

Run: `node --import tsx --test tests/sanyi-school-runner.test.ts && npm run typecheck`

Expected: `4 pass, 0 fail`；`tsc --noEmit` 退出码 0。

```bash
git add src/sanyi/school-runner.ts tests/sanyi-school-runner.test.ts \
  && git commit -m "feat(sanyi): 实现单家落笔与核对重写"
```

## Chunk 2C: 问事编排

### Task 15: 问事编排服务

**Files:**
- Create: `src/sanyi/reading-service.ts`
- Create: `tests/sanyi-reading-service.test.ts`

- [ ] **Step 1: 写公开 API 失败测试（10 分钟）**

```ts
// tests/sanyi-reading-service.test.ts
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
  StructuredOutputProvider,
  StructuredOutputRequest,
} from "../src/agent/provider.js";
import { mockQuestionFeeReceipt } from "../src/oracle/fee-payment.js";
import type { QuestionFeeProof } from "../src/oracle/fee-payment.js";
import type { QuestionBlockSource } from "../src/oracle/question-oracle.js";
import { createSanyiLogger, type SanyiLogger } from "../src/sanyi/log.js";
import { mockSchoolOutput } from "../src/sanyi/mock-schools.js";
import {
  LimitExceededError,
  PaymentAlreadyUsedError,
  ReadingService,
  StateConflictError,
} from "../src/sanyi/reading-service.js";
import type { QuestionSchoolOutput } from "../src/sanyi/schema.js";
import type { FactTable } from "../src/sanyi/facts.js";
import type { QuestionSchoolKey } from "../src/sanyi/schools/index.js";
import { ReadingStore } from "../src/sanyi/store.js";
import { ArcUnavailableError } from "../src/sanyi/throws.js";

const TX = `0x${"22".repeat(32)}` as const;
const PROOF: QuestionFeeProof = {
  payer: `0x${"11".repeat(20)}`,
  bundleId: "bundle-1",
  transactionHashes: [TX],
};

class FakeBlockSource implements QuestionBlockSource {
  calls = 0;
  stalled = false;
  private height = 0n;

  async latest(): Promise<{
    number: bigint;
    hash: `0x${string}`;
    timestamp: bigint;
  }> {
    this.calls += 1;
    if (!this.stalled) {
      this.height += 1n;
    }
    return {
      number: this.height,
      hash: `0x${this.height.toString(16).padStart(64, "0")}`,
      timestamp: 1_790_776_500n + this.height,
    };
  }
}

function factsFromPrompt(prompt: string): FactTable {
  const facts: FactTable = new Map();
  for (const line of prompt.split("\n")) {
    const match = line.match(/^([a-z-]+(?::\w+)?)[：](.+)$/u);
    if (match?.[1] && match[2]) {
      facts.set(match[1], {
        id: match[1],
        label: match[2],
        tokens: new Set<string>(),
      });
    }
  }
  return facts;
}

interface ProviderGate {
  started: Promise<void>;
  release(): void;
}

class FakeProvider implements StructuredOutputProvider {
  readonly modelId = "fake";
  readonly providerConfig = {};
  readonly providerConfigHash = `0x${"00".repeat(32)}` as const;
  readonly calls = new Map<QuestionSchoolKey, number>();
  throwFor: QuestionSchoolKey | null = null;
  rejectFor: QuestionSchoolKey | null = null;
  private readonly gates = new Map<
    QuestionSchoolKey,
    Array<{ wait: Promise<void>; markStarted(): void }>
  >();

  delayNext(key: QuestionSchoolKey): ProviderGate {
    let release = (): void => {};
    let markStarted = (): void => {};
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const queue = this.gates.get(key) ?? [];
    queue.push({ wait, markStarted });
    this.gates.set(key, queue);
    return { started, release };
  }

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    const key = request.taskId.split("/").at(-1) as QuestionSchoolKey;
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1);
    const gate = this.gates.get(key)?.shift();
    if (gate) {
      gate.markStarted();
      await gate.wait;
    }
    if (this.throwFor === key) {
      throw new Error("模型暂不可用");
    }
    const output = mockSchoolOutput(key, factsFromPrompt(request.userPrompt));
    if (this.rejectFor === key) {
      return {
        ...output,
        verdict: "吉",
        confidenceTenths: 3,
      } as T;
    }
    return output as T;
  }
}

interface Fixture {
  root: string;
  store: ReadingStore;
  blocks: FakeBlockSource;
  provider: FakeProvider;
  logger: SanyiLogger;
  service: ReadingService;
}

async function fixture(input: {
  root?: string;
  calendarThrows?: boolean;
} = {}): Promise<Fixture> {
  const root = input.root ?? await mkdtemp(join(tmpdir(), "sanyi-service-"));
  const store = new ReadingStore(root);
  const blocks = new FakeBlockSource();
  const provider = new FakeProvider();
  const logger = createSanyiLogger(join(root, "log"), () => new Date(0));
  const service = new ReadingService({
    feeVerifier: {
      verify: async (proof: QuestionFeeProof) => mockQuestionFeeReceipt(proof),
    },
    blockSource: blocks,
    provider,
    store,
    logger,
    clock: () => new Date("2026-09-30T12:15:00.000Z"),
    waitOptions: {
      timeoutMs: 3,
      pollMs: 1,
      sleep: async () => {},
    },
    ...(input.calendarThrows
      ? {
          calendar: {
            almanacAt: () => {
              throw new Error("历法失败");
            },
            qimenAt: () => {
              throw new Error("不应继续计算奇门");
            },
          },
        }
      : {}),
  });
  return { root, store, blocks, provider, logger, service };
}

async function create(
  service: ReadingService,
  feeProof: QuestionFeeProof = PROOF,
) {
  return service.createQuestionReading({
    question: "这次面试能过吗",
    feeProof,
  });
}

async function castAll(service: ReadingService, id: string): Promise<void> {
  for (let index = 1; index <= 6; index += 1) {
    await service.throwCoin(id, index);
  }
  await service.whenSettled(id);
}

test("创建后为 awaiting-throws", async () => {
  const item = await fixture();
  try {
    assert.equal((await create(item.service)).status, "awaiting-throws");
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("六掷后按官鬼排盘且三家完成", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const done = await item.service.getReading(reading.id);
    assert.equal(done.status, "done");
    assert.equal(done.chart?.focus?.useGod, "官鬼");
    assert.deepEqual(
      Object.values(done.schools).map((state) => state.status),
      ["done", "done", "done"],
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("重复和并发同一掷幂等且只读取一次区块", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    const [left, right] = await Promise.all([
      item.service.throwCoin(reading.id, 1),
      item.service.throwCoin(reading.id, 1),
    ]);
    assert.deepEqual(left, right);
    const calls = item.blocks.calls;
    assert.deepEqual(await item.service.throwCoin(reading.id, 1), left);
    assert.equal(item.blocks.calls, calls);
    assert.equal((await item.service.getReading(reading.id)).throws.length, 1);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("乱序掷被拒绝", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await assert.rejects(item.service.throwCoin(reading.id, 2), /第 1 掷/);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("区块停滞保留前序掷且恢复后可续掷", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await item.service.throwCoin(reading.id, 1);
    item.blocks.stalled = true;
    await assert.rejects(
      item.service.throwCoin(reading.id, 2),
      (error: unknown) => error instanceof ArcUnavailableError,
    );
    assert.equal((await item.service.getReading(reading.id)).throws.length, 1);
    item.blocks.stalled = false;
    await item.service.throwCoin(reading.id, 2);
    assert.equal((await item.service.getReading(reading.id)).throws.length, 2);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("一家失败被隔离、可成功重试且每卦第三次重试超限", async () => {
  const item = await fixture();
  try {
    item.provider.throwFor = "chengyi";
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    let stored = await item.service.getReading(reading.id);
    assert.equal(stored.schools.chengyi.status, "failed");
    assert.equal(stored.schools.jingfang.status, "done");
    assert.equal(stored.schools.shaoyong.status, "done");
    item.provider.throwFor = null;
    await item.service.retrySchool(reading.id, "chengyi");
    await item.service.whenSettled(reading.id);
    stored = await item.service.getReading(reading.id);
    assert.equal(stored.schools.chengyi.status, "done");
    const second = await create(item.service, {
      ...PROOF,
      bundleId: "bundle-2",
    });
    item.provider.throwFor = "chengyi";
    await castAll(item.service, second.id);
    await item.service.retrySchool(second.id, "chengyi");
    await item.service.whenSettled(second.id);
    await item.service.retrySchool(second.id, "chengyi");
    await item.service.whenSettled(second.id);
    await assert.rejects(
      item.service.retrySchool(second.id, "chengyi"),
      (error: unknown) => error instanceof LimitExceededError,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("京房连续两次核对失败后标为 rejected", async () => {
  const item = await fixture();
  try {
    item.provider.rejectFor = "jingfang";
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const done = await item.service.getReading(reading.id);
    assert.equal(done.schools.jingfang.status, "rejected");
    assert.equal(item.provider.calls.get("jingfang"), 2);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("改事项只重跑京房且第四次修改超限", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const before = await item.service.getReading(reading.id);
    const calls = new Map(item.provider.calls);
    for (const key of ["wealth", "career", "wealth"] as const) {
      await item.service.changeSubject(reading.id, key);
      await item.service.whenSettled(reading.id);
    }
    const after = await item.service.getReading(reading.id);
    assert.equal(after.chart?.focus?.useGod, "妻财");
    assert.equal(item.provider.calls.get("jingfang"), (calls.get("jingfang") ?? 0) + 3);
    assert.equal(item.provider.calls.get("chengyi"), calls.get("chengyi"));
    assert.equal(item.provider.calls.get("shaoyong"), calls.get("shaoyong"));
    assert.deepEqual(after.schools.chengyi.output, before.schools.chengyi.output);
    assert.deepEqual(after.schools.shaoyong.output, before.schools.shaoyong.output);
    await assert.rejects(
      item.service.changeSubject(reading.id, "career"),
      (error: unknown) => error instanceof LimitExceededError,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("whenSettled 等待同一 reading 的全部后台任务", async () => {
  const item = await fixture();
  try {
    item.provider.throwFor = "chengyi";
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    item.provider.throwFor = null;
    const chengyi = item.provider.delayNext("chengyi");
    const jingfang = item.provider.delayNext("jingfang");
    await item.service.retrySchool(reading.id, "chengyi");
    await chengyi.started;
    await item.service.changeSubject(reading.id, "wealth");
    await jingfang.started;
    let settled = false;
    const waiting = item.service.whenSettled(reading.id).then(() => {
      settled = true;
    });
    chengyi.release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    jingfang.release();
    await waiting;
    assert.equal(settled, true);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("首次京房落笔期间不能改事项，完成后可以修改", async () => {
  const item = await fixture();
  try {
    const gate = item.provider.delayNext("jingfang");
    const reading = await create(item.service);
    for (let index = 1; index <= 6; index += 1) {
      await item.service.throwCoin(reading.id, index);
    }
    await gate.started;
    await assert.rejects(
      item.service.changeSubject(reading.id, "wealth"),
      (error: unknown) => error instanceof StateConflictError,
    );
    gate.release();
    await item.service.whenSettled(reading.id);
    await item.service.changeSubject(reading.id, "wealth");
    await item.service.whenSettled(reading.id);
    assert.equal(
      (await item.service.getReading(reading.id)).subject.finalKey,
      "wealth",
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("已完成的一家不能重试", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    await assert.rejects(
      item.service.retrySchool(reading.id, "chengyi"),
      (error: unknown) => error instanceof StateConflictError,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("并发第三次改事项只有一次成功", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    for (const key of ["wealth", "career"] as const) {
      await item.service.changeSubject(reading.id, key);
      await item.service.whenSettled(reading.id);
    }
    const results = await Promise.allSettled([
      item.service.changeSubject(reading.id, "wealth"),
      item.service.changeSubject(reading.id, "documents"),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.equal(
      rejected.reason instanceof LimitExceededError
        || rejected.reason instanceof StateConflictError,
      true,
    );
    await item.service.whenSettled(reading.id);
    assert.equal((await item.service.getReading(reading.id)).subject.changes, 3);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("付款凭证跨 service 与 store 实例返回原 reading id", async () => {
  const item = await fixture();
  try {
    const first = await create(item.service);
    const restarted = await fixture({ root: item.root });
    await assert.rejects(create(restarted.service), (error: unknown) => {
      return error instanceof PaymentAlreadyUsedError
        && error.readingId === first.id;
    });
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("历法异常落为 failed 且不产生未处理拒绝", async () => {
  const item = await fixture({ calendarThrows: true });
  const unhandled: unknown[] = [];
  const listener = (reason: unknown): void => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", listener);
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const failed = await item.service.getReading(reading.id);
    assert.equal(failed.status, "failed");
    assert.match(failed.error ?? "", /排盘失败/);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(unhandled.length, 0);
  } finally {
    process.off("unhandledRejection", listener);
    await rm(item.root, { recursive: true, force: true });
  }
});

test("日志文件存在且 birthDate 字段被过滤", async () => {
  const item = await fixture();
  try {
    await item.logger.write("测试日志", {
      birthDate: "不可记录",
      readingId: "safe-id",
    });
    const path = join(item.root, "log", "sanyi_1970-01-01.log");
    const log = await readFile(path, "utf8");
    assert.match(log, /测试日志/);
    assert.doesNotMatch(log, /birthDate|不可记录/);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 运行 RED（2 分钟）**

Run: `node --import tsx --test tests/sanyi-reading-service.test.ts`

Expected: FAIL，提示 `reading-service.js`、`school-runner.js` 或 `log.js` 不存在。

- [ ] **Step 3: 实现问事状态机（10 分钟）**

```ts
// src/sanyi/reading-service.ts
import { almanacAt } from "../calendar/almanac.js";
import { selectPrimaryOracleText } from "../calendar/bianzhan.js";
import { deriveMeihua } from "../calendar/meihua.js";
import { qimenAt } from "../calendar/qimen.js";
import { QUESTION_SUBJECTS } from "../oracle/question-classifier.js";
import type { QuestionSubjectKey } from "../oracle/question-classifier.js";
import type { QuestionFeeProof } from "../oracle/fee-payment.js";
import { buildLiuyaoChart, deriveFiveHexagrams } from "../oracle/liuyao-chart.js";
import type {
  QuestionBlockSource,
  QuestionFeeVerifier,
} from "../oracle/question-oracle.js";
import type { StructuredOutputProvider } from "../agent/provider.js";
import { classifyQuestion, normalizeQuestion } from "./classify.js";
import { buildQuestionFacts, type FactTable } from "./facts.js";
import type { SanyiLogger } from "./log.js";
import { buildOriginalTexts } from "./original-texts.js";
import { runSchool, type SchoolRunResult } from "./school-runner.js";
import { QUESTION_SCHOOLS, type QuestionSchoolKey } from "./schools/index.js";
import type { QuestionSchool } from "./schools/shared.js";
import {
  ReadingStore,
  newReadingId,
  type SchoolState,
  type StoredReading,
} from "./store.js";
import {
  assertNextThrow,
  deriveThrow,
  waitForBlockAfter,
  type RecordedThrow,
} from "./throws.js";

type WaitOptions = NonNullable<Parameters<typeof waitForBlockAfter>[2]>;

interface CalendarDependencies {
  almanacAt: typeof almanacAt;
  qimenAt: typeof qimenAt;
}

export interface ReadingServiceDependencies {
  feeVerifier: QuestionFeeVerifier;
  blockSource: QuestionBlockSource;
  provider: StructuredOutputProvider;
  store: ReadingStore;
  logger: SanyiLogger;
  clock?: () => Date;
  waitOptions?: WaitOptions;
  calendar?: CalendarDependencies;
}

interface RebuiltContext {
  facts: FactTable;
  originalTexts: readonly string[];
  chart: ReturnType<typeof buildLiuyaoChart>;
}

export class PaymentAlreadyUsedError extends Error {
  constructor(readonly readingId: string) {
    super(`付款凭证已用于 reading：${readingId}`);
    this.name = "PaymentAlreadyUsedError";
  }
}

export class LimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitExceededError";
  }
}

export class StateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateConflictError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function paymentClaimKey(proof: QuestionFeeProof): string {
  return JSON.stringify({
    payer: proof.payer.toLowerCase(),
    bundleId: proof.bundleId,
    transactionHashes: proof.transactionHashes.map((hash) => hash.toLowerCase()),
  });
}

function subjectOption(key: QuestionSubjectKey) {
  const option = QUESTION_SUBJECTS.find((item) => item.key === key);
  if (!option) {
    throw new Error("事项类型无效");
  }
  return option;
}

function initialSchools(): StoredReading["schools"] {
  return {
    chengyi: { status: "pending", attempts: 0, retries: 0 },
    jingfang: { status: "pending", attempts: 0, retries: 0 },
    shaoyong: { status: "pending", attempts: 0, retries: 0 },
  };
}

export class ReadingService {
  private readonly clock: () => Date;
  private readonly calendar: CalendarDependencies;
  private readonly waitOptions: WaitOptions;
  private readonly readingQueues = new Map<string, Promise<void>>();
  private readonly background = new Map<string, Promise<void>>();

  constructor(private readonly deps: ReadingServiceDependencies) {
    this.clock = deps.clock ?? (() => new Date());
    this.calendar = deps.calendar ?? { almanacAt, qimenAt };
    this.waitOptions = deps.waitOptions ?? {};
  }

  async createQuestionReading(input: {
    question: string;
    subjectKey?: QuestionSubjectKey;
    feeProof: QuestionFeeProof;
  }): Promise<StoredReading> {
    const classification = classifyQuestion(input.question);
    if (classification.kind !== "question" || !classification.subject) {
      throw new Error("此服务只接受问事问题");
    }
    const question = normalizeQuestion(input.question);
    const suggested = classification.subject;
    const selected = subjectOption(input.subjectKey ?? suggested.key);
    const receipt = await this.deps.feeVerifier.verify(input.feeProof);
    if (receipt.feeUsdc6 !== "50000" || receipt.shares.length !== 3) {
      throw new Error("三座卦金账户付款凭证不完整");
    }
    const firstHash = receipt.transactionHashes[0];
    if (!firstHash) {
      throw new Error("付款交易哈希不完整");
    }
    const id = newReadingId();
    const existing = await this.deps.store.claimPayment(
      paymentClaimKey(input.feeProof),
      id,
    );
    if (existing) {
      throw new PaymentAlreadyUsedError(existing);
    }
    const reading: StoredReading = {
      id,
      kind: "question",
      createdAt: this.clock().toISOString(),
      question,
      subject: {
        suggestedKey: suggested.key,
        finalKey: selected.key,
        overridden: selected.key !== suggested.key,
        changes: 0,
      },
      payment: {
        payer: input.feeProof.payer,
        transactionHashes: receipt.transactionHashes,
        firstHash,
        shares: receipt.shares,
      },
      throws: [],
      schools: initialSchools(),
      status: "awaiting-throws",
    };
    await this.deps.store.write(reading);
    return reading;
  }

  async throwCoin(id: string, index: number): Promise<RecordedThrow> {
    return this.withReadingLock(id, async () => {
      const reading = await this.deps.store.read(id);
      const recorded = reading.throws.find((item) => item.index === index);
      if (recorded) {
        return recorded;
      }
      assertNextThrow(reading.throws, index);
      const previous = reading.throws.at(-1);
      const block = await waitForBlockAfter(
        this.deps.blockSource,
        previous ? BigInt(previous.blockNumber) : 0n,
        this.waitOptions,
      );
      const result = deriveThrow({
        paymentTxHash: reading.payment.firstHash,
        blockHash: block.hash,
        question: reading.question,
        index,
      });
      const next: RecordedThrow = {
        ...result,
        blockNumber: block.number.toString(),
        blockHash: block.hash,
        blockTimestamp: block.timestamp.toString(),
      };
      await this.deps.store.update(id, (current) => ({
        ...current,
        throws: [...current.throws, next],
      }));
      if (index === 6) {
        this.startBackground(id, this.finalize(id));
      }
      return next;
    });
  }

  async retrySchool(id: string, key: QuestionSchoolKey): Promise<StoredReading> {
    return this.withReadingLock(id, async () => {
      const reading = await this.deps.store.read(id);
      const state = reading.schools[key];
      if (state.status !== "failed" && state.status !== "rejected") {
        throw new StateConflictError("此家当前状态不可重试");
      }
      if (state.retries >= 2) {
        throw new LimitExceededError("此家重试次数已用尽");
      }
      const updated = await this.deps.store.update(id, (current) => ({
        ...current,
        schools: {
          ...current.schools,
          [key]: {
            status: "writing",
            attempts: current.schools[key].attempts,
            retries: current.schools[key].retries + 1,
          },
        },
      }));
      this.startBackground(id, this.rerunSchool(id, key));
      return updated;
    });
  }

  async changeSubject(
    id: string,
    subjectKey: QuestionSubjectKey,
  ): Promise<StoredReading> {
    return this.withReadingLock(id, async () => {
      const reading = await this.deps.store.read(id);
      if (reading.status !== "done") {
        throw new StateConflictError("三家尚未全部落笔，请稍后再改事项");
      }
      if (reading.schools.jingfang.status === "writing") {
        throw new StateConflictError("京房正在落笔，请稍后再改事项");
      }
      if (!reading.lines || !reading.castTime) {
        throw new StateConflictError("尚未完成排盘，不能修改事项");
      }
      if (reading.subject.changes >= 3) {
        throw new LimitExceededError("事项修改次数已用尽");
      }
      subjectOption(subjectKey);
      const changed: StoredReading = {
        ...reading,
        subject: {
          ...reading.subject,
          finalKey: subjectKey,
          overridden: subjectKey !== reading.subject.suggestedKey,
          changes: reading.subject.changes + 1,
        },
      };
      const context = this.rebuildContext(changed);
      const updated = await this.deps.store.update(id, (current) => ({
        ...current,
        subject: changed.subject,
        chart: context.chart,
        schools: {
          ...current.schools,
          jingfang: {
            status: "writing",
            attempts: current.schools.jingfang.attempts,
            retries: current.schools.jingfang.retries,
          },
        },
      }));
      this.startBackground(id, this.rerunSchool(id, "jingfang"));
      return updated;
    });
  }

  async getReading(id: string): Promise<StoredReading> {
    return this.deps.store.read(id);
  }

  async whenSettled(id: string): Promise<void> {
    await (this.background.get(id) ?? Promise.resolve());
  }

  private async withReadingLock<T>(
    id: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const previous = this.readingQueues.get(id) ?? Promise.resolve();
    const result = previous.catch(() => {}).then(action);
    const tail = result.then(
      () => {},
      () => {},
    );
    this.readingQueues.set(id, tail);
    try {
      return await result;
    } finally {
      if (this.readingQueues.get(id) === tail) {
        this.readingQueues.delete(id);
      }
    }
  }

  private startBackground(id: string, task: Promise<void>): void {
    const current = task.catch(async (error: unknown) => {
      await this.failReading(id, error);
    });
    const previous = this.background.get(id) ?? Promise.resolve();
    const combined = Promise.all([previous, current]).then(() => {});
    this.background.set(id, combined);
    void combined.finally(() => {
      if (this.background.get(id) === combined) {
        this.background.delete(id);
      }
    });
  }

  private async finalize(id: string): Promise<void> {
    const reading = await this.deps.store.update(id, (current) => ({
      ...current,
      status: "charting",
    }));
    const first = reading.throws[0];
    if (!first || reading.throws.length !== 6) {
      throw new Error("六掷记录不完整");
    }
    const lines = reading.throws.map((item) => item.value);
    const castTime = first.blockTimestamp;
    const basis: StoredReading = { ...reading, lines, castTime };
    const context = this.rebuildContext(basis);
    const timestamp = BigInt(castTime);
    const meihua = deriveMeihua(lines, timestamp);
    const bianzhan = selectPrimaryOracleText(lines);
    const almanac = this.calendar.almanacAt(timestamp);
    const qimen = this.calendar.qimenAt(timestamp);
    await this.deps.store.update(id, (current) => ({
      ...current,
      lines,
      castTime,
      chart: context.chart,
      meihua,
      bianzhan,
      almanac,
      qimen,
      status: "writing",
      schools: {
        chengyi: { ...current.schools.chengyi, status: "writing" },
        jingfang: { ...current.schools.jingfang, status: "writing" },
        shaoyong: { ...current.schools.shaoyong, status: "writing" },
      },
    }));
    await Promise.all(QUESTION_SCHOOLS.map(async (school) => {
      await this.runAndStore(id, school, context, false);
    }));
    await this.deps.store.update(id, (current) => ({
      ...current,
      status: "done",
    }));
  }

  private rebuildContext(reading: StoredReading): RebuiltContext {
    if (!reading.lines || !reading.castTime) {
      throw new Error("存档缺少排盘材料");
    }
    const subject = subjectOption(reading.subject.finalKey);
    const timestamp = BigInt(reading.castTime);
    const chart = buildLiuyaoChart({
      lines: reading.lines,
      timestamp,
      focus: {
        subjectKey: subject.key,
        subjectLabel: subject.label,
        useGod: subject.useGod,
        overridden: reading.subject.overridden,
      },
    });
    const five = deriveFiveHexagrams(reading.lines);
    const meihua = deriveMeihua(reading.lines, timestamp);
    const bianzhan = selectPrimaryOracleText(reading.lines);
    return {
      chart,
      facts: buildQuestionFacts(chart, five, meihua, bianzhan),
      originalTexts: buildOriginalTexts(five, bianzhan),
    };
  }

  private async rerunSchool(
    id: string,
    key: QuestionSchoolKey,
  ): Promise<void> {
    const reading = await this.deps.store.read(id);
    const context = this.rebuildContext(reading);
    const school = QUESTION_SCHOOLS.find((item) => item.key === key);
    if (!school) {
      throw new Error("三家键无效");
    }
    await this.runAndStore(id, school, context, true);
  }

  private async runAndStore(
    id: string,
    school: QuestionSchool,
    context: RebuiltContext,
    preserveRetries: boolean,
  ): Promise<void> {
    const reading = await this.deps.store.read(id);
    const result = await runSchool(
      { provider: this.deps.provider },
      {
        school,
        question: reading.question,
        facts: context.facts,
        originalTexts: context.originalTexts,
      },
    );
    await this.deps.store.update(id, (current) => ({
      ...current,
      schools: {
        ...current.schools,
        [school.key]: this.schoolState(
          current.schools[school.key],
          result,
          preserveRetries,
        ),
      },
    }));
  }

  private schoolState(
    previous: SchoolState,
    result: SchoolRunResult,
    preserveRetries: boolean,
  ): SchoolState {
    const retries = preserveRetries ? previous.retries : 0;
    if (result.status === "done") {
      return {
        status: "done",
        output: result.output,
        attempts: previous.attempts + result.calls,
        retries,
      };
    }
    return {
      status: result.status,
      error: result.error,
      attempts: previous.attempts + result.calls,
      retries,
    };
  }

  private async failReading(id: string, error: unknown): Promise<void> {
    const message = `排盘失败：${errorMessage(error)}`;
    try {
      await this.deps.store.update(id, (current) => ({
        ...current,
        status: "failed",
        error: message,
      }));
    } catch {
      // 存档本身不可写时仍须继续尝试记录日志。
    }
    try {
      await this.deps.logger.write("问事排盘失败", {
        readingId: id,
        error: message,
      });
    } catch {
      // 日志失败不能产生未处理拒绝。
    }
  }
}
```

- [ ] **Step 4: GREEN、严格类型检查与提交（5 分钟）**

Run: `node --import tsx --test tests/sanyi-reading-service.test.ts && npm run typecheck`

Expected: `15 pass, 0 fail`；`tsc --noEmit` 退出码 0。

```bash
git add src/sanyi/reading-service.ts tests/sanyi-reading-service.test.ts \
  && git commit -m "feat(sanyi): 编排问事六掷与三家落笔"
```

## Chunk 2B/2C 交叉验收

### Task 16: 领域与全量回归

- [ ] 核对 Task 12–15 的实现与存档字段，再运行领域测试：

Run: `node --import tsx --test tests/sanyi-*.test.ts`

Expected: Chunk 2A–2C 全部测试 PASS、0 FAIL。

- [ ] 运行既有问事与六爻回归：

Run: `node --import tsx --test tests/question-oracle.test.ts tests/liuyao-chart.test.ts`

Expected: 既有问事与六爻回归测试全部 PASS、0 FAIL。

- [ ] 核对 `openspec/changes/sanyi-chinese-redesign/tasks.md` 状态与实现一致，
并运行严格类型检查和全量测试：

Run: `npm run typecheck && npm test`

Expected: `tsc --noEmit` 退出码 0；全量测试 PASS、0 FAIL。

## Chunk 3: 服务端接口与排练

> 本 Chunk 覆盖 OpenSpec 任务 1.10 与 1.14。HTTP 层只负责协议、安全边界和错误序列化；
> `SanyiApi` 负责校验与公开视图，`ReadingService` 继续独占业务状态机。旧接口统一下线，
> mock 只用于测试与排练，生产启动固定使用 Arc 区块、真实卦金核验和 DeepSeek provider。

### Task 17: 建立类型化错误与三易 API 边界

**Files:**
- Create: `src/sanyi/http-errors.ts`
- Create: `src/sanyi/api.ts`
- Create: `tests/sanyi-api.test.ts`

- [ ] **Step 1: 写 API 失败测试（8 分钟）**

```ts
// tests/sanyi-api.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import type { QuestionFeeProof } from "../src/oracle/fee-payment.js";
import { createSanyiApi } from "../src/sanyi/api.js";
import {
  NotFoundError,
  NotOpenYetError,
  SanyiInputError,
} from "../src/sanyi/http-errors.js";
import type { StoredReading } from "../src/sanyi/store.js";
const ID = "abcdefghijklmnopqrstuvwxyz";
const PROOF: QuestionFeeProof = {
  payer: `0x${"11".repeat(20)}`,
  bundleId: "bundle-1",
  transactionHashes: [`0x${"22".repeat(32)}`],
};
function reading(): StoredReading {
  return {
    id: ID,
    kind: "question",
    createdAt: "2026-09-30T12:15:00.000Z",
    question: "这次面试能过吗",
    subject: {
      suggestedKey: "career",
      finalKey: "career",
      overridden: false,
      changes: 0,
    },
    payment: {
      payer: PROOF.payer,
      transactionHashes: PROOF.transactionHashes,
      firstHash: PROOF.transactionHashes[0]!,
      shares: [],
    },
    throws: [{
      index: 1,
      coins: [1, 0, 0],
      backs: 1,
      value: 7,
      name: "单",
      moving: false,
      blockNumber: "8",
      blockHash: `0x${"33".repeat(32)}`,
      blockTimestamp: "1790770501",
    }],
    schools: {
      chengyi: { status: "pending", attempts: 7, retries: 0 },
      jingfang: { status: "pending", attempts: 8, retries: 0 },
      shaoyong: { status: "pending", attempts: 9, retries: 0 },
    },
    status: "awaiting-throws",
    lines: [7, 8, 7, 8, 7, 8],
    castTime: "1790770501",
  };
}
function fixture() {
  const calls: string[] = [];
  const value = reading();
  const service = {
    async createQuestionReading(input: unknown) {
      calls.push(`create:${JSON.stringify(input)}`);
      return value;
    },
    async throwCoin(id: string, index: number) {
      calls.push(`throw:${id}:${index}`);
      return value.throws[0]!;
    },
    async getReading(id: string) {
      calls.push(`get:${id}`);
      if (id === "aaaaaaaaaaaaaaaaaaaaaaaaaa") {
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return value;
    },
    async retrySchool(id: string, key: "chengyi" | "jingfang" | "shaoyong") {
      calls.push(`retry:${id}:${key}`);
      return value;
    },
    async changeSubject(id: string, key: string) {
      calls.push(`subject:${id}:${key}`);
      return value;
    },
  };
  let milliseconds = Date.parse("2026-09-30T12:15:00.000Z");
  const api = createSanyiApi(service, { now: () => new Date(milliseconds) });
  return { api, calls, advance: (value: number) => { milliseconds += value; } };
}
test("校验问题、事项与掷序", async () => {
  const { api } = fixture();
  await assert.rejects(api.classify({ question: "" }), SanyiInputError);
  await assert.rejects(
    api.createReading({ question: "这次面试能过吗", subjectKey: "bad", feeProof: PROOF }),
    SanyiInputError,
  );
  await assert.rejects(api.throwCoin(ID, { index: "1" }), SanyiInputError);
});
test("命理与运势明确留待下一阶段", async () => {
  const { api } = fixture();
  for (const question of ["看看我的八字", "我今年运势如何"]) {
    await assert.rejects(api.createReading({ question, feeProof: PROOF }), (error: unknown) => {
      return error instanceof NotOpenYetError
        && error.message === "命理与运势将在下一阶段开放，可先改为问事";
    });
  }
});
test("未开放类型返回具体替代建议", async () => {
  const { api } = fixture();
  await assert.rejects(
    api.createReading({ question: "给女儿起个名字，姓王", feeProof: PROOF }),
    (error: unknown) => error instanceof SanyiInputError
      && /给孩子起名叫某某好不好/.test(error.message),
  );
});
test("公开 reading 保留复算材料但移除内部字段", async () => {
  const { api } = fixture();
  const value = await api.getReading(ID);
  const text = JSON.stringify(value);
  assert.equal(value.question, "这次面试能过吗");
  assert.equal(value.payment.firstHash, PROOF.transactionHashes[0]);
  assert.equal(value.throws[0]?.blockNumber, "8");
  assert.deepEqual(value.lines, [7, 8, 7, 8, 7, 8]);
  assert.equal(value.castTime, "1790770501");
  assert.doesNotMatch(text, /attempts|payer|transactionHashes|claimKey/);
});
test("存档 ENOENT 转换为 NotFoundError", async () => {
  const { api } = fixture();
  await assert.rejects(
    api.getReading("aaaaaaaaaaaaaaaaaaaaaaaaaa"),
    NotFoundError,
  );
});
test("now 在三十秒内复用对象，满三十秒刷新", async () => {
  const { api, advance } = fixture();
  const first = await api.now();
  advance(29_999);
  assert.equal(await api.now(), first);
  advance(1);
  assert.notEqual(await api.now(), first);
});
```

- [ ] **Step 2: 运行 `node --import tsx --test tests/sanyi-api.test.ts`，确认缺少 API 模块**

- [ ] **Step 3: 实现稳定的错误类与状态映射**

```ts
// src/sanyi/http-errors.ts
import {
  LimitExceededError,
  PaymentAlreadyUsedError,
  StateConflictError,
} from "./reading-service.js";
import { ArcUnavailableError } from "./throws.js";
class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = new.target.name;
  }
}
export class SanyiInputError extends HttpError {
  constructor(message: string) { super(message, 400); }
}
export class NotFoundError extends HttpError {
  constructor(message = "未找到解读") { super(message, 404); }
}
export class NotOpenYetError extends HttpError {
  constructor(message: string) { super(message, 501); }
}
export class UnsupportedMediaType extends HttpError {
  constructor(message = "写接口只接受 application/json") { super(message, 415); }
}
export class ForbiddenOrigin extends HttpError {
  constructor(message = "拒绝跨源操作") { super(message, 403); }
}
export class PayloadTooLarge extends HttpError {
  constructor(message = "请求体超过 8 KiB 限制") { super(message, 413); }
}
export function statusForError(error: unknown): number {
  if (
    error instanceof SanyiInputError
    || error instanceof NotFoundError
    || error instanceof NotOpenYetError
    || error instanceof UnsupportedMediaType
    || error instanceof ForbiddenOrigin
    || error instanceof PayloadTooLarge
  ) {
    return error.status;
  }
  if (
    error instanceof PaymentAlreadyUsedError
    || error instanceof LimitExceededError
    || error instanceof StateConflictError
  ) {
    return 409;
  }
  if (error instanceof ArcUnavailableError) {
    return 503;
  }
  return 500;
}
```

- [ ] **Step 4: 实现无 HTTP 依赖的 API（10 分钟）**

```ts
// src/sanyi/api.ts
import { almanacAt } from "../calendar/almanac.js";
import { QUESTION_SUBJECTS } from "../oracle/question-classifier.js";
import type { QuestionFeeProof } from "../oracle/fee-payment.js";
import { classifyQuestion } from "./classify.js";
import { NotFoundError, NotOpenYetError, SanyiInputError } from "./http-errors.js";
import type { ReadingService } from "./reading-service.js";
import type { QuestionSchoolKey } from "./schools/index.js";
import type { StoredReading } from "./store.js";
type ServiceBoundary = Pick<
  ReadingService,
  "createQuestionReading" | "throwCoin" | "getReading" | "retrySchool" | "changeSubject"
>;
type SubjectKey = StoredReading["subject"]["finalKey"];
export interface PublicReading extends Omit<StoredReading, "payment" | "schools"> {
  payment: { firstHash: StoredReading["payment"]["firstHash"] };
  schools: Record<QuestionSchoolKey, Omit<StoredReading["schools"][QuestionSchoolKey], "attempts">>;
}
export interface SanyiApi {
  now(): Promise<ReturnType<typeof almanacAt>>;
  classify(input: unknown): Promise<ReturnType<typeof classifyQuestion>>;
  createReading(input: unknown): Promise<PublicReading>;
  throwCoin(id: string, input: unknown): Promise<StoredReading["throws"][number]>;
  getReading(id: string): Promise<PublicReading>;
  retrySchool(id: string, key: QuestionSchoolKey): Promise<PublicReading>;
  changeSubject(id: string, input: unknown): Promise<PublicReading>;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SanyiInputError("请求体必须是 JSON 对象");
  }
  return value as Record<string, unknown>;
}
function questionFrom(input: unknown): string {
  const question = record(input).question;
  if (typeof question !== "string") {
    throw new SanyiInputError("问题必须是字符串");
  }
  try {
    return classifyQuestion(question).question;
  } catch (error) {
    throw new SanyiInputError(error instanceof Error ? error.message : "问题无效");
  }
}
function subjectFrom(value: unknown): SubjectKey | undefined {
  if (value === undefined) {
    return undefined;
  }
  const option = QUESTION_SUBJECTS.find((item) => item.key === value);
  if (!option) {
    throw new SanyiInputError("事项类型无效");
  }
  return option.key;
}
function feeProofFrom(value: unknown): QuestionFeeProof {
  if (!value || typeof value !== "object") {
    throw new SanyiInputError("缺少卦金付款凭证");
  }
  return value as QuestionFeeProof;
}
function publicReading(reading: StoredReading): PublicReading {
  const school = (key: QuestionSchoolKey) => {
    const { attempts: _attempts, ...visible } = reading.schools[key];
    return visible;
  };
  return {
    ...reading,
    payment: { firstHash: reading.payment.firstHash },
    schools: {
      chengyi: school("chengyi"),
      jingfang: school("jingfang"),
      shaoyong: school("shaoyong"),
    },
  };
}
async function notFound<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NotFoundError();
    }
    throw error;
  }
}
export function createSanyiApi(
  service: ServiceBoundary,
  options: { now?: () => Date } = {},
): SanyiApi {
  const clock = options.now ?? (() => new Date());
  let cache: { createdAt: number; value: ReturnType<typeof almanacAt> } | undefined;
  return {
    async now() {
      const milliseconds = clock().getTime();
      if (cache && milliseconds - cache.createdAt < 30_000) {
        return cache.value;
      }
      const value = almanacAt(BigInt(Math.floor(milliseconds / 1_000)));
      cache = { createdAt: milliseconds, value };
      return value;
    },
    async classify(input) {
      return classifyQuestion(questionFrom(input));
    },
    async createReading(input) {
      const body = record(input);
      const classification = classifyQuestion(questionFrom(body));
      if (classification.kind === "destiny" || classification.kind === "fortune") {
        throw new NotOpenYetError("命理与运势将在下一阶段开放，可先改为问事");
      }
      if (classification.kind !== "question") {
        throw new SanyiInputError(classification.suggestion ?? "请改为一件具体的事来问");
      }
      const subjectKey = subjectFrom(body.subjectKey);
      const reading = await service.createQuestionReading({
        question: classification.question,
        feeProof: feeProofFrom(body.feeProof),
        ...(subjectKey === undefined ? {} : { subjectKey }),
      });
      return publicReading(reading);
    },
    async throwCoin(id, input) {
      const index = record(input).index;
      if (typeof index !== "number" || !Number.isInteger(index)) {
        throw new SanyiInputError("掷序必须是整数");
      }
      return notFound(() => service.throwCoin(id, index));
    },
    async getReading(id) {
      return publicReading(await notFound(() => service.getReading(id)));
    },
    async retrySchool(id, key) {
      return publicReading(await notFound(() => service.retrySchool(id, key)));
    },
    async changeSubject(id, input) {
      const subjectKey = subjectFrom(record(input).subjectKey);
      if (!subjectKey) {
        throw new SanyiInputError("缺少事项类型");
      }
      return publicReading(await notFound(() => service.changeSubject(id, subjectKey)));
    },
  };
}
```

- [ ] **Step 5: GREEN 与严格类型检查（3 分钟）**

Run: `node --import tsx --test tests/sanyi-api.test.ts && npm run typecheck`

### Task 18: 替换前端服务路由与生产启动装配

**Files:**
- Modify: `src/frontend/server.ts`
- Rewrite: `tests/frontend-server.test.ts`

- [ ] **Step 1: 整体改写服务端测试（10 分钟）**

```ts
// tests/frontend-server.test.ts
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { SanyiApi } from "../src/sanyi/api.js";
import { PaymentAlreadyUsedError } from "../src/sanyi/reading-service.js";
import { ArcUnavailableError } from "../src/sanyi/throws.js";
import { createFrontendServer } from "../src/frontend/server.js";
function fakeApi(overrides: Partial<SanyiApi> = {}): SanyiApi {
  const reading = { id: "abcdefghijklmnopqrstuvwxyz", status: "awaiting-throws" };
  return {
    now: async () => ({ solar: { text: "2026-09-30 20:15:00" } }) as never,
    classify: async () => ({ kind: "question" }) as never,
    createReading: async () => reading as never,
    throwCoin: async () => ({ index: 1, value: 7 }) as never,
    getReading: async () => reading as never,
    retrySchool: async () => reading as never,
    changeSubject: async () => reading as never,
    ...overrides,
  };
}
async function fixture(api: SanyiApi = fakeApi()) {
  const root = await mkdtemp(join(tmpdir(), "sanyi-http-"));
  const publicDir = join(root, "web");
  await mkdir(publicDir);
  await writeFile(join(publicDir, "index.html"), "三易", "utf8");
  await writeFile(join(publicDir, "font.woff2"), "font", "utf8");
  const server = createFrontendServer({ publicDir, api });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  return { root, server, base };
}
async function close(item: { root: string; server: Server }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    item.server.close((error) => error ? reject(error) : resolve());
  });
  await rm(item.root, { recursive: true, force: true });
}
function post(base: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
test("七条新路由返回成功状态", async () => {
  const item = await fixture();
  try {
    const id = "abcdefghijklmnopqrstuvwxyz";
    const routes: Array<[string, string, unknown?]> = [
      ["GET", "/api/now"],
      ["POST", "/api/classify", { question: "这件事会怎样" }],
      ["POST", "/api/readings", { question: "这件事会怎样" }],
      ["POST", `/api/readings/${id}/throws`, { index: 1 }],
      ["GET", `/api/readings/${id}`],
      ["POST", `/api/readings/${id}/schools/chengyi/retry`, {}],
      ["POST", `/api/readings/${id}/subject`, { subjectKey: "career" }],
    ];
    for (const [method, path, body] of routes) {
      const response = method === "GET"
        ? await fetch(`${item.base}${path}`)
        : await post(item.base, path, body);
      assert.equal(response.status, 200, `${method} ${path}`);
    }
  } finally {
    await close(item);
  }
});
test("写接口拒绝缺失或错误 Origin", async () => {
  const item = await fixture();
  try {
    const missing = await fetch(`${item.base}/api/classify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const wrong = await post(item.base, "/api/classify", {}, { origin: "https://evil.example" });
    assert.equal(missing.status, 403);
    assert.equal(wrong.status, 403);
  } finally {
    await close(item);
  }
});
test("写接口拒绝非 JSON 与超过 8 KiB 的请求体", async () => {
  const item = await fixture();
  try {
    const wrongType = await fetch(`${item.base}/api/classify`, {
      method: "POST",
      headers: { origin: item.base },
      body: "{}",
    });
    const tooLarge = await post(item.base, "/api/classify", "x".repeat(9 * 1_024));
    assert.equal(wrongType.status, 415);
    assert.equal(tooLarge.status, 413);
  } finally {
    await close(item);
  }
});
test("非法 id、非法三家键和四类旧接口均为 404", async () => {
  const item = await fixture();
  try {
    const paths = [
      "/api/readings/bad",
      "/api/readings/abcdefghijklmnopqrstuvwxyz/schools/bad/retry",
      "/api/oracle",
      "/api/demo",
      "/api/demo/round/prepare",
      "/api/question/classify",
    ];
    for (const path of paths) {
      assert.equal((await fetch(`${item.base}${path}`)).status, 404, path);
    }
  } finally {
    await close(item);
  }
});
test("已知领域错误按错误类映射", async () => {
  const id = "abcdefghijklmnopqrstuvwxyz";
  const conflict = await fixture(fakeApi({
    createReading: async () => { throw new PaymentAlreadyUsedError(id); },
  }));
  try {
    const response = await post(conflict.base, "/api/readings", {});
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: `付款凭证已用于 reading：${id}`,
      readingId: id,
    });
  } finally {
    await close(conflict);
  }
  const unavailable = await fixture(fakeApi({
    throwCoin: async () => { throw new ArcUnavailableError(); },
  }));
  try {
    const response = await post(unavailable.base, `/api/readings/${id}/throws`, { index: 1 });
    assert.equal(response.status, 503);
  } finally {
    await close(unavailable);
  }
});
test("未知错误为 500 且不泄露堆栈", async () => {
  const item = await fixture(fakeApi({
    now: async () => { throw new Error("boom"); },
  }));
  try {
    const response = await fetch(`${item.base}/api/now`);
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /at /);
  } finally {
    await close(item);
  }
});
test("woff2 使用正确类型且原始路径穿越返回 403", async () => {
  const item = await fixture();
  try {
    const font = await fetch(`${item.base}/font.woff2`);
    assert.equal(font.headers.get("content-type"), "font/woff2");
    const address = item.server.address();
    assert.ok(address && typeof address === "object");
    const status = await new Promise<number>((resolve, reject) => {
      const call = request({
        host: "127.0.0.1",
        port: address.port,
        path: "/%2e%2e/package.json",
      }, (response) => resolve(response.statusCode ?? 0));
      call.on("error", reject);
      call.end();
    });
    assert.equal(status, 403);
  } finally {
    await close(item);
  }
});
```

- [ ] **Step 2: 运行服务端测试，确认旧路由仍在线且构造函数尚不接受 `api`**

- [ ] **Step 3: 用静态资源、路由表与统一安全边界替换服务**

```ts
// src/frontend/server.ts
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createArcPublicClient } from "../arc.js";
import { createDefaultProvider } from "../agent/default-provider.js";
import { ArcQuestionFeeVerifier } from "../oracle/arc-question-fee-verifier.js";
import { createSanyiApi, type SanyiApi } from "../sanyi/api.js";
import {
  ForbiddenOrigin,
  PayloadTooLarge,
  SanyiInputError,
  statusForError,
  UnsupportedMediaType,
} from "../sanyi/http-errors.js";
import { createSanyiLogger } from "../sanyi/log.js";
import { ReadingService, PaymentAlreadyUsedError } from "../sanyi/reading-service.js";
import type { QuestionSchoolKey } from "../sanyi/schools/index.js";
import { isReadingId, ReadingStore } from "../sanyi/store.js";
interface FrontendServerOptions {
  publicDir?: string;
  api?: SanyiApi;
}
const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const SCHOOL_KEYS = new Set<QuestionSchoolKey>(["chengyi", "jingfang", "shaoyong"]);
export function resolveStaticPath(publicDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) {
    return null;
  }
  const requested = decoded === "/" ? "/index.html" : decoded;
  const candidate = resolve(publicDir, `.${requested}`);
  const fromRoot = relative(resolve(publicDir), candidate);
  return fromRoot.startsWith("..") || isAbsolute(fromRoot) ? null : candidate;
}
function json(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}
function requireSameOrigin(request: IncomingMessage): void {
  const host = request.headers.host;
  if (!host || request.headers.origin !== `http://${host}`) {
    throw new ForbiddenOrigin();
  }
}
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const type = request.headers["content-type"] ?? "";
  if (type.toLowerCase().split(";", 1)[0]?.trim() !== "application/json") {
    throw new UnsupportedMediaType();
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let oversized = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    oversized ||= size > 8_192;
    if (!oversized) {
      chunks.push(buffer);
    }
  }
  if (oversized) {
    throw new PayloadTooLarge();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new SanyiInputError("请求体不是合法 JSON");
  }
}
function errorPayload(error: unknown): { error: string; readingId?: string } {
  const message = statusForError(error) === 500
    ? "服务暂时不可用"
    : error instanceof Error ? error.message : "服务暂时不可用";
  return {
    error: message,
    ...(error instanceof PaymentAlreadyUsedError ? { readingId: error.readingId } : {}),
  };
}
export function createFrontendServer(options: FrontendServerOptions = {}): Server {
  const publicDir = resolve(options.publicDir ?? resolve(process.cwd(), "web"));
  const api = options.api;
  return createServer(async (request, response) => {
    const rawPath = (request.url ?? "/").split("?", 1)[0] ?? "/";
    const url = new URL(request.url ?? "/", "http://localhost");
    try {
      if (/^\/api\/(oracle|demo(?:\/|$)|question(?:\/|$))/.test(url.pathname)) {
        json(response, 404, { error: "接口已下线" });
        return;
      }
      const idRoute = url.pathname.match(/^\/api\/readings\/([^/]+)$/);
      const throwRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/throws$/);
      const retryRoute = url.pathname.match(
        /^\/api\/readings\/([^/]+)\/schools\/([^/]+)\/retry$/,
      );
      const subjectRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/subject$/);
      const isApi = url.pathname.startsWith("/api/");
      const writing = request.method === "POST";
      if (writing && isApi) {
        requireSameOrigin(request);
      }
      const body = writing && isApi ? await readJsonBody(request) : undefined;
      if (request.method === "GET" && url.pathname === "/api/now" && api) {
        json(response, 200, await api.now());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/classify" && api) {
        json(response, 200, await api.classify(body));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/readings" && api) {
        json(response, 200, await api.createReading(body));
        return;
      }
      if (idRoute && request.method === "GET" && api && isReadingId(idRoute[1] ?? "")) {
        json(response, 200, await api.getReading(idRoute[1] as string));
        return;
      }
      if (throwRoute && request.method === "POST" && api && isReadingId(throwRoute[1] ?? "")) {
        json(response, 200, await api.throwCoin(throwRoute[1] as string, body));
        return;
      }
      const retryKey = retryRoute?.[2] as QuestionSchoolKey | undefined;
      if (
        retryRoute
        && request.method === "POST"
        && api
        && isReadingId(retryRoute[1] ?? "")
        && retryKey
        && SCHOOL_KEYS.has(retryKey)
      ) {
        json(response, 200, await api.retrySchool(retryRoute[1] as string, retryKey));
        return;
      }
      if (subjectRoute && request.method === "POST" && api && isReadingId(subjectRoute[1] ?? "")) {
        json(response, 200, await api.changeSubject(subjectRoute[1] as string, body));
        return;
      }
      if (isApi) {
        json(response, 404, { error: "未找到接口" });
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        json(response, 405, { error: "静态资源只允许读取" });
        return;
      }
      const path = resolveStaticPath(publicDir, rawPath);
      if (!path) {
        json(response, 403, { error: "拒绝访问" });
        return;
      }
      try {
        const content = await readFile(path);
        const extension = path.slice(path.lastIndexOf("."));
        response.writeHead(200, {
          "cache-control": path.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
          "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        });
        response.end(request.method === "HEAD" ? undefined : content);
      } catch (error) {
        const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
        json(response, status, { error: status === 404 ? "未找到" : "读取失败" });
      }
    } catch (error) {
      json(response, statusForError(error), errorPayload(error));
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const publicClient = createArcPublicClient();
  const service = new ReadingService({
    feeVerifier: new ArcQuestionFeeVerifier(publicClient),
    blockSource: {
      latest: async () => {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        if (!block.hash) {
          throw new Error("最新区块没有可复算哈希");
        }
        return { number: block.number, hash: block.hash, timestamp: block.timestamp };
      },
    },
    provider: createDefaultProvider({ maxTokens: 2_048 }),
    store: new ReadingStore("data"),
    logger: createSanyiLogger(),
  });
  const port = Number(process.env.FRONTEND_PORT ?? "4173");
  createFrontendServer({ api: createSanyiApi(service) }).listen(port, "127.0.0.1", () => {
    console.log(`三易服务已启动：http://127.0.0.1:${port}`);
    console.log("问事卦金：0.05 USDC；付款后亲手六掷，三家依同一卦独立落笔");
    console.log("复算材料：付款首笔交易与六个 Arc 区块会随解读存档");
  });
}
```

- [ ] **Step 4: GREEN、断引用检查与严格类型检查（5 分钟）**

Run: `node --import tsx --test tests/frontend-server.test.ts && npm run typecheck`

Run: `rg 'frontend/data|demo/|question-oracle|question-interpreter|createDemoProvider' src/frontend/server.ts`

### Task 19: 新增确定性 provider 并改写问事排练

**Files:**
- Create: `src/sanyi/mock-provider.ts`
- Rewrite: `scripts/rehearse-demo.ts`
- Create: `tests/sanyi-rehearsal.test.ts`
- Modify: `package.json`

- [ ] **Step 1: 写排练失败测试（5 分钟）**

```ts
// tests/sanyi-rehearsal.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { runRehearsal } from "../scripts/rehearse-demo.js";
test("mock 排练完成六掷与三家落笔", async () => {
  const summary = await runRehearsal();
  assert.equal(summary.status, "done");
  assert.equal(summary.lines.length, 6);
  assert.deepEqual(summary.schools.map((item) => item.status), ["done", "done", "done"]);
  assert.equal(summary.schools.map((item) => item.name).join("、"), "程颐、京房、邵雍");
  assert.equal(Number.isFinite(summary.consensusTenths), true);
});
```

- [ ] **Step 2: 运行排练测试，确认旧脚本没有导出 `runRehearsal`**

- [ ] **Step 3: 实现排练专用 provider**

```ts
// src/sanyi/mock-provider.ts
import { hashJson } from "../agent/audit.js";
import type {
  StructuredOutputProvider,
  StructuredOutputRequest,
} from "../agent/provider.js";
import type { FactTable } from "./facts.js";
import { mockSchoolOutput } from "./mock-schools.js";
import type { QuestionSchoolKey } from "./schools/index.js";
function factsFromPrompt(prompt: string): FactTable {
  const facts: FactTable = new Map();
  for (const line of prompt.split("\n")) {
    const match = line.match(/^([a-z-]+(?::\w+)?)[：](.+)$/u);
    if (match?.[1] && match[2]) {
      facts.set(match[1], {
        id: match[1],
        label: match[2],
        tokens: new Set<string>(),
      });
    }
  }
  return facts;
}
export class MockSchoolsProvider implements StructuredOutputProvider {
  readonly modelId = "sanyi-mock-schools";
  readonly providerConfig = Object.freeze({ kind: "sanyi-mock-schools" });
  readonly providerConfigHash = hashJson(this.providerConfig);
  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    const key = request.taskId.split("/").at(-1) as QuestionSchoolKey;
    if (!["chengyi", "jingfang", "shaoyong"].includes(key)) {
      throw new Error(`mock provider 不支持任务：${request.taskId}`);
    }
    return mockSchoolOutput(key, factsFromPrompt(request.userPrompt)) as T;
  }
}
```

- [ ] **Step 4: 把脚本改为可调用的完整 mock 流程（8 分钟）**

```ts
// scripts/rehearse-demo.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mockQuestionFeeReceipt } from "../src/oracle/fee-payment.js";
import type { QuestionFeeProof } from "../src/oracle/fee-payment.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { createSanyiLogger } from "../src/sanyi/log.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { ReadingService } from "../src/sanyi/reading-service.js";
import { ReadingStore } from "../src/sanyi/store.js";
const SCHOOL_NAMES = { chengyi: "程颐", jingfang: "京房", shaoyong: "邵雍" } as const;
export interface RehearsalSummary {
  status: "done";
  primary: string;
  derived: string;
  lines: readonly number[];
  schools: ReadonlyArray<{
    name: string;
    status: "done";
    verdict: string;
    confidenceTenths: number;
  }>;
  consensusTenths: number;
}
export async function runRehearsal(): Promise<RehearsalSummary> {
  const root = await mkdtemp(join(tmpdir(), "sanyi-rehearsal-"));
  let height = 0n;
  try {
    const proof: QuestionFeeProof = {
      payer: `0x${"11".repeat(20)}`,
      bundleId: "rehearsal",
      transactionHashes: [`0x${"22".repeat(32)}`],
    };
    const service = new ReadingService({
      feeVerifier: { verify: async (value) => mockQuestionFeeReceipt(value) },
      blockSource: {
        latest: async () => {
          height += 1n;
          return {
            number: height,
            hash: `0x${height.toString(16).padStart(64, "0")}`,
            timestamp: 1_790_770_500n + height,
          };
        },
      },
      provider: new MockSchoolsProvider(),
      store: new ReadingStore(root),
      logger: createSanyiLogger(join(root, "log")),
      waitOptions: { pollMs: 1, timeoutMs: 100, sleep: async () => {} },
    });
    const created = await service.createQuestionReading({
      question: "这次面试能过吗",
      feeProof: proof,
    });
    for (let index = 1; index <= 6; index += 1) {
      await service.throwCoin(created.id, index);
    }
    await service.whenSettled(created.id);
    const reading = await service.getReading(created.id);
    if (reading.status !== "done" || !reading.lines || !reading.chart) {
      throw new Error(`排练未完成：${reading.status}`);
    }
    const five = deriveFiveHexagrams(reading.lines);
    const keys = ["chengyi", "jingfang", "shaoyong"] as const;
    const schools = keys.map((key) => {
      const state = reading.schools[key];
      if (state.status !== "done" || !state.output) {
        throw new Error(`${SCHOOL_NAMES[key]}未完成：${state.status}`);
      }
      return {
        name: SCHOOL_NAMES[key],
        status: "done" as const,
        verdict: state.output.verdict,
        confidenceTenths: state.output.confidenceTenths,
      };
    });
    return {
      status: "done",
      primary: five.primary.name,
      derived: five.derived.name,
      lines: reading.lines,
      schools,
      consensusTenths: schools.reduce((sum, item) => sum + item.confidenceTenths, 0) / 3,
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv.find((item) => item.startsWith("--mode="))?.slice(7) ?? "mock";
  if (mode !== "mock") {
    throw new Error("排练只支持 --mode=mock");
  }
  try {
    const summary = await runRehearsal();
    console.log(`本卦：${summary.primary}；之卦：${summary.derived}`);
    for (const school of summary.schools) {
      console.log(`${school.name}：${school.verdict}，${school.confidenceTenths}成`);
    }
    console.log(`合议平均：约${summary.consensusTenths.toFixed(1)}成`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
```

- [ ] **Step 5: 修改唯一相关脚本项（2 分钟）**

在 `package.json` 中精确替换：

```json
"demo:rehearse": "node --import tsx scripts/rehearse-demo.ts --mode=mock"
```

- [ ] **Step 6: GREEN、CLI 与严格类型检查（5 分钟）**

Run: `node --import tsx --test tests/sanyi-rehearsal.test.ts && npm run demo:rehearse && npm run typecheck`

### Task 20: Chunk 3 交叉验收

- [ ] 运行本 Chunk 的全部测试：

Run: `node --import tsx --test tests/sanyi-api.test.ts tests/frontend-server.test.ts tests/sanyi-rehearsal.test.ts`

- [ ] 运行 Chunk 1、2A、2B、2C 的全部测试：

Run: `node --import tsx --test tests/almanac.test.ts tests/qimen.test.ts tests/meihua.test.ts \
  tests/bianzhan.test.ts tests/sanyi-classify.test.ts tests/sanyi-throws.test.ts \
  tests/sanyi-schema.test.ts tests/sanyi-facts.test.ts tests/sanyi-audit.test.ts \
  tests/sanyi-schools.test.ts tests/sanyi-store.test.ts tests/sanyi-school-runner.test.ts \
  tests/sanyi-reading-service.test.ts`

- [ ] 检查计划代码行宽、旧依赖断开和严格类型：

Run: `npm run typecheck`

Run: `rg 'frontend/data|demo/|question-oracle|question-interpreter|createDemoProvider' src/frontend/server.ts`

- [ ] 核对 OpenSpec 与任务状态：`tasks.md` 的 1.10、1.14 只在实现与上述验收均完成后勾选；
确认公开 reading 不含 `attempts`、付款人、完整交易数组或内部 claim key，且仍含规范化问题、
付款首笔交易哈希、六掷区块号与哈希、六爻及卦时。
