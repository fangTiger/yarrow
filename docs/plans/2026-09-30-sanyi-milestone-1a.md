# 三易里程碑 1A 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成「三易」里程碑 1A 的新站骨架与问事全流程，让用户付卦金后亲手六掷，并查看可复算的六爻、三家断语、时空黄历与奇门时盘。

**Architecture:** 以 `src/calendar/` 提供无网络、可回归的历法与术数纯函数，以 `src/sanyi/` 负责分类、六掷、事实核对、持久化和三家编排；`src/frontend/server.ts` 只暴露安全的 JSON/静态资源边界。React 前端按 hash 路由消费 reading 存档，付款复用现有 EIP-5792 原子批量流程，所有问事计算统一采用第一掷区块时间戳（UTC+8、零点换日）。

**Tech Stack:** TypeScript 5.9 ESM、Node.js ≥ 22、React 18、esbuild、wagmi 2、RainbowKit 2、viem、AJV、`lunar-javascript@1.7.7`、Node `test` + `tsx`；开发期以 Python 3.11、kinqimen 0.0.6.6 和 fonttools 生成回归资产。

---

## 分块预告

- Chunk 1：术数与历法引擎。
- Chunk 2A：分类、六掷与盘面核对。
- Chunk 2B：三家、存档与编排。
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


## Chunk 2B: 三家、存档与编排

下一轮编写。
