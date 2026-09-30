# 三易里程碑 1A 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成「三易」里程碑 1A 的新站骨架与问事全流程，让用户付卦金后亲手六掷，并查看可复算的六爻、三家断语、时空黄历与奇门时盘。

**Architecture:** 以 `src/calendar/` 提供无网络、可回归的历法与术数纯函数，以 `src/sanyi/` 负责分类、六掷、事实核对、持久化和三家编排；`src/frontend/server.ts` 只暴露安全的 JSON/静态资源边界。React 前端按 hash 路由消费 reading 存档，付款复用现有 EIP-5792 原子批量流程，所有问事计算统一采用第一掷区块时间戳（UTC+8、零点换日）。

**Tech Stack:** TypeScript 5.9 ESM、Node.js ≥ 22、React 18、esbuild、wagmi 2、RainbowKit 2、viem、AJV、`lunar-javascript@1.7.7`、Node `test` + `tsx`；开发期以 Python 3.11、kinqimen 0.0.6.6 和 fonttools 生成回归资产。

---

## 分块预告

- Chunk 1A：历法与奇门（Task 1–4）。
- Chunk 1B：变占、梅花与交叉验收（Task 5–7）。
- Chunk 2A：分类、六掷与盘面核对。
- Chunk 2B：三家提示词、原文、存档与单家落笔（Task 12–14）。
- Chunk 2C：问事编排（Task 15）。
- Chunk 2B/2C 交叉验收：领域与全量回归（Task 16）。
- Chunk 3：服务端接口。
- Chunk 4A：前端基础（字体、视觉令牌、数据客户端与最近记录）。
- Chunk 4B：前端基础（付款、首页与 hash 路由）。
- Chunk 5A：结果页状态、六掷与首屏卦象（Task 27–28）。
- Chunk 5B：三家、排盘、五行、术语与事项修改（Task 29）。
- Chunk 5C：奇门、黄历、复算、页面编排与交叉验收（Task 30–31）。
- Chunk 6：旧站遗留清理、文化与秘密守卫、全量验证及 1A 用户验收（Task 32–36）。

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
- `web/components/ClassificationTags.tsx`：纯展示分类标签、未开放提示与改选动作。
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
- `web/lib/fee-plan.ts`：提供不依赖浏览器钱包配置的纯卦金付款计划。
- `web/lib/use-fee-payment.ts`：封装连接、切网、余额检查与 EIP-5792 原子付款钩子。
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

- `package.json`：加入 lunar 依赖与字体命令，保留新排练入口，并将包名和描述更新为三易。
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
- `.gitignore`：不跟踪 `.venv-tools/`、根目录 `/data/`、原始字体和运行日志；字体子集、许可证与字表入库。
- `openspec/changes/sanyi-chinese-redesign/tasks.md`：验收后勾选实际完成的 1.1–1.14。
- `tests/frontend-wallet.test.ts`：必须保留；仅在确认个别用例只覆盖旧押注流程时删除这些用例。
- `src/frontend/wallet.ts`、`src/frontend/abis.ts`：必须保留，供新付款流程复用。
- `src/demo/secret-scan.ts`：必须保留，供 `scripts/check-frontend-secrets.ts` 复用。
- `src/oracle/question-oracle.ts` 及其测试：必须保留，新服务依赖其中的类型。
- `docs/plans/2026-09-30-sanyi-1a-acceptance.md`：提供里程碑 1A 的用户验收手册。

### 删除

- `web/styles.css`：由分责样式文件替代。
- `src/frontend/data.ts`：旧链上快照读取不再服务新站。
- `src/frontend/domain.ts`：旧工作台展示模型不再服务新站。
- `tests/frontend-data.test.ts`：随旧快照模块删除。
- `tests/frontend-domain.test.ts`：随旧展示模型删除。
- `src/demo/service.ts`、`src/demo/arc-driver.ts`、`src/demo/mock-driver.ts`、`src/demo/rehearsal.ts`、
  `src/demo/human-proposition.ts`、`src/demo/predicate.ts`、`src/demo/provider.ts`：删除旧演示层；
  `src/demo/provider.ts` 与仍保留的 `src/agent/provider.ts` 无关。
- `scripts/run-frontend-mock.ts`、`scripts/recover-demo.ts`：删除旧前端 mock 与恢复脚本。
- `src/oracle/question-interpreter.ts`：删除旧问轨解读。
- `tests/demo-*.test.ts`、`tests/human-proposition.test.ts`、`tests/question-interpreter.test.ts`：
  删除旧演示层与问轨测试。
- `tests/frontend-content.test.ts`：删除旧站内容测试；仍适用于新站的秘密断言迁入新文化守卫。

## Chunk 1A: 历法与奇门

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
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): { getLunar(): LunarValue };
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
  assert.deepEqual(result.lunar, {
    date: "二〇二六年八月二十",
    timeBranch: "戌",
    moonPhase: "更待",
  });
  assert.deepEqual(result.pillars, ["丙午", "丁酉", "丁未", "庚戌"]);
  assert.deepEqual(result.naYin, ["天河水", "山下火", "天河水", "钗钏金"]);
  assert.deepEqual(result.solarTerms, {
    current: "秋分", hou: "秋分 二候", wuHou: "蛰虫坯户",
    previousAt: "2026-09-23 08:05:14", next: "寒露", nextAt: "2026-10-08 14:29:17",
  });
  assert.deepEqual(result.cycle, {
    monthBranch: "酉",
    day: "丁未",
    xun: "甲辰",
    voidBranches: ["寅", "卯"],
  });
  assert.deepEqual(result.dayOfficers, { officer: "开", deity: "天德", path: "黄道" });
  assert.deepEqual(result.mansion, { name: "壁水貐", palace: "北", guardian: "玄武" });
  assert.deepEqual(result.clash, { description: "(辛丑)牛", direction: "西" });
  assert.equal(result.almanac.nineStar, "五黄土玉衡");
  assert.equal(result.almanac.joy, "正南");
  assert.equal(result.almanac.wealth, "西南");
  assert.equal(result.almanac.fortune, "东南");
  assert.deepEqual(
    result.almanac.suitable.slice(0, 6),
    ["祭祀", "解除", "结网", "畋猎", "取渔", "会亲友"],
  );
  assert.deepEqual(
    result.almanac.avoid.slice(0, 6),
    ["开市", "祈福", "动土", "破土", "入殓", "安葬"],
  );
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
  solarTerms: {
    current: string;
    hou: string;
    wuHou: string;
    previousAt: string;
    next: string;
    nextAt: string;
  };
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
  if (timestamp < 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("历法时间戳必须是安全的非负整数秒");
  }
  const date = new Date((Number(timestamp) + 8 * 3_600) * 1_000);
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
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
    solar: {
      timezone: "UTC+8",
      text: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    },
    lunar: { date: lunar.toString(), timeBranch: lunar.getTimeZhi(), moonPhase: lunar.getYueXiang() },
    pillars: [eight.getYear(), eight.getMonth(), eight.getDay(), eight.getTime()],
    naYin: [eight.getYearNaYin(), eight.getMonthNaYin(), eight.getDayNaYin(), eight.getTimeNaYin()],
    solarTerms: {
      current: previous.getName(), hou: lunar.getHou(), wuHou: lunar.getWuHou(),
      previousAt: formatSolar(previous.getSolar()),
      next: next.getName(),
      nextAt: formatSolar(next.getSolar()),
    },
    cycle: {
      monthBranch: eight.getMonth().slice(1), day: eight.getDay(), xun: lunar.getDayXun(),
      voidBranches: lunar.getDayXunKong().split("") as [string, string],
    },
    month: liuyaoMonth,
    dayOfficers: {
      officer: lunar.getZhiXing(),
      deity: lunar.getDayTianShen(),
      path: lunar.getDayTianShenType(),
    },
    mansion: {
      name: `${lunar.getXiu()}${lunar.getZheng()}${
        lunar.getAnimal() === "獝" ? "貐" : lunar.getAnimal()
      }`,
      palace: lunar.getGong(),
      guardian: lunar.getShou(),
    },
    clash: { description: lunar.getDayChongDesc(), direction: lunar.getDaySha() },
    almanac: {
      nineStar: lunar.getDayNineStar().toString(), joy: lunar.getDayPositionXiDesc(),
      wealth: lunar.getDayPositionCaiDesc(), fortune: lunar.getDayPositionFuDesc(),
      suitable: lunar.getDayYi(),
      avoid: lunar.getDayJi(),
      pengZu: [lunar.getPengZuGan(), lunar.getPengZuZhi()],
    },
  };
  assertCalendarConsistent(result, liuyaoDay.ganzhi);
  return result;
}

export function assertCalendarConsistent(
  result: AlmanacResult,
  expectedDay = deriveSexagenaryDay(BigInt(result.timestamp)).ganzhi,
): void {
  if (result.cycle.day !== expectedDay) {
    throw new Error(`历法不一致：黄历日干支${result.cycle.day}，六爻日干支${expectedDay}`);
  }
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

PALACE = {
    "坎": "坎一", "坤": "坤二", "震": "震三",
    "巽": "巽四", "中": "中五", "乾": "乾六",
    "兌": "兑七", "艮": "艮八", "離": "离九",
}
DOOR = {
    "休": "休门", "生": "生门", "傷": "伤门", "杜": "杜门",
    "景": "景门", "死": "死门", "驚": "惊门", "開": "开门",
}
STAR = {
    "蓬": "天蓬", "任": "天任", "沖": "天冲",
    "輔": "天辅", "英": "天英", "芮": "天芮",
    "柱": "天柱", "心": "天心", "禽": "天芮",
}
GOD = {
    "符": "值符", "蛇": "腾蛇", "陰": "太阴", "合": "六合",
    "勾": "勾陈", "雀": "朱雀", "虎": "白虎", "玄": "玄武", "地": "九地", "天": "九天",
}
SOLAR_TERM = {
    "冬至": "冬至", "小寒": "小寒", "大寒": "大寒",
    "立春": "立春", "雨水": "雨水", "驚蟄": "惊蛰",
    "春分": "春分", "清明": "清明", "穀雨": "谷雨",
    "立夏": "立夏", "小滿": "小满", "芒種": "芒种",
    "夏至": "夏至", "小暑": "小暑", "大暑": "大暑",
    "立秋": "立秋", "處暑": "处暑", "白露": "白露",
    "秋分": "秋分", "寒露": "寒露", "霜降": "霜降",
    "立冬": "立冬", "小雪": "小雪", "大雪": "大雪",
}
REQUIRED_KEYS = {
    "干支", "旬空", "排局", "節氣", "值符值使", "天盤",
    "地盤", "門", "星", "神", "馬星",
}
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
    normalized_chief_star = (
        "天禽"
        if chief_star == "禽" and raw["地盤"].get("中") == chief_stem
        else checked(STAR, chief_star, "九星简称")
    )
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
    target.write_text(
        json.dumps(normalize(moment, raw), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
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
    const fixture = JSON.parse(
      await readFile(`tests/fixtures/qimen/${file}`, "utf8"),
    ) as Record<string, unknown>;
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
  const files = (await readdir("tests/fixtures/qimen"))
    .filter((name) => name.endsWith(".json"))
    .sort();
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
  assert.deepEqual(result.palaces["巽四"], {
    heavenStem: "己",
    earthStem: "戊",
    star: "天冲",
    door: "死门",
    god: "太阴",
  });
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

type Palace =
  | "坎一" | "坤二" | "震三" | "巽四" | "中五"
  | "乾六" | "兑七" | "艮八" | "离九";
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
const RING: readonly RingPalace[] = [
  "坎一", "艮八", "震三", "巽四", "离九", "坤二", "兑七", "乾六",
];
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
  const groups: Record<string, string> = {
    申子辰: "寅",
    寅午戌: "申",
    亥卯未: "巳",
    巳酉丑: "亥",
  };
  const group = Object.keys(groups).find((key) => key.includes(branch));
  if (!group) throw new Error(`地支 ${branch} 没有驿马组`);
  return groups[group]!;
}

export function qimenAt(timestamp: bigint): QimenResult {
  const almanac = almanacAt(timestamp);
  // 奇门按子时（23:00）换日取日柱与时柱，与 kinqimen 及传统口径一致。
  const [y, mo, d, h, mi, se] = almanac.solar.text
    .split(/[- :]/)
    .map(Number) as [number, number, number, number, number, number];
  const eight = lunarPkg.Solar.fromYmdHms(y, mo, d, h, mi, se).getLunar().getEightChar();
  eight.setSect(1);
  const day = eight.getDay();
  const hour = eight.getTime();
  // 节气交接采用 lunar-javascript 的精确时刻；冬至至芒种为阳遁，其余为阴遁。
  const term = almanac.solarTerms.current;
  const yangTerms = [
    "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰",
    "春分", "清明", "谷雨", "立夏", "小满", "芒种",
  ];
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
    // 值符和值使报告原始落宫，排盘时中五寄坤二；
    // 界面显示「中五（寄坤二）」。
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

## Chunk 1B: 变占、梅花与交叉验收

> 本 Chunk 覆盖 OpenSpec 任务 1.3，以及 `question-three-schools` 中「主占之辞变占法」与「梅花体用取法」要求。

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
  {
    lines: [9, 9, 9, 8, 8, 8],
    kind: "本卦与之卦卦辞",
    primary: "卦辞",
    secondary: ["之卦卦辞"],
  },
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
  const moving = lines
    .map((value, index) => value === 6 || value === 9 ? index : -1)
    .filter((index) => index >= 0);
  const still = lines.map((_, index) => index).filter((index) => !moving.includes(index));
  if (moving.length === 0) {
    return {
      rule: "本卦卦辞",
      primary: judgement("卦辞", primary.judgement),
      secondary: [],
    };
  }
  if (moving.length === 1) {
    return { rule: "本卦爻辞", primary: primary.lines[moving[0]!]!, secondary: [] };
  }
  if (moving.length === 2) {
    return {
      rule: "本卦两爻辞",
      primary: primary.lines[moving[1]!]!,
      secondary: [primary.lines[moving[0]!]!],
    };
  }
  if (moving.length === 3) return {
    rule: "本卦与之卦卦辞",
    primary: judgement("卦辞", primary.judgement),
    secondary: [judgement("之卦卦辞", derived.judgement)],
  };
  if (moving.length === 4) {
    return {
      rule: "之卦两不动爻辞",
      primary: derived.lines[still[0]!]!,
      secondary: [derived.lines[still[1]!]!],
    };
  }
  if (moving.length === 5) {
    return { rule: "之卦不动爻辞", primary: derived.lines[still[0]!]!, secondary: [] };
  }
  const special = primary.kingWenNumber === 1 ? "用九" : primary.kingWenNumber === 2 ? "用六" : null;
  if (!special) {
    return {
      rule: "之卦卦辞",
      primary: judgement("之卦卦辞", derived.judgement),
      secondary: [],
    };
  }
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
  比和: "变卦与体比和",
  体生用: "体生变卦",
  用生体: "变卦生体",
  体克用: "体克变卦",
  用克体: "变卦克体",
};
const TRIGRAMS: Record<number, { name: PalaceName; element: FiveElement }> = {
  0: { name: "坤", element: "土" },
  1: { name: "震", element: "木" },
  2: { name: "坎", element: "水" },
  3: { name: "兑", element: "金" },
  4: { name: "艮", element: "土" },
  5: { name: "离", element: "火" },
  6: { name: "巽", element: "木" },
  7: { name: "乾", element: "金" },
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
    mutual: {
      name: five.mutual.name,
      lower: trigram(five.primary.yangLines.slice(1, 4)).name,
      upper: trigram(five.primary.yangLines.slice(2, 5)).name,
    },
    changed: {
      name: five.derived.name,
      changedUse,
      relationToBody: CHANGED_RELATION[relation(body.element, changedUse.element)],
    },
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

### Task 7: Chunk 1A/1B 交叉验收

**Files:**
- Test: `tests/almanac.test.ts`
- Test: `tests/qimen.test.ts`
- Test: `tests/bianzhan.test.ts`
- Test: `tests/meihua.test.ts`
- Test: `tests/liuyao-chart.test.ts`

- [ ] **Step 1: 运行 Chunk 1A/1B 定向测试（2–5 分钟）**

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
    assert.match(school.systemPrompt, /自称只用本名/);
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
自称只用本名“程颐”，不用其它称谓；输出必须严格符合给定 JSON Schema。`,
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
自称只用本名“京房”，不用其它称谓；输出必须严格符合给定 JSON Schema。`,
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
自称只用本名“邵雍”，不用其它称谓；输出必须严格符合给定 JSON Schema。`,
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

- [ ] 运行 Chunk 1A、1B、2A、2B、2C 的全部测试：

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

## Chunk 4A: 前端基础（字体、视觉令牌与数据层）

> 本 Chunk 覆盖 OpenSpec 任务 1.11、1.12、1.13 的首页部分。视觉值以已确认的水墨夜样稿和
> 设计文档第 13 节为准；HTTP 类型严格服从 Chunk 3。`Reading.tsx` 是 Chunk 4/5 的有意边界，
> 本 Chunk 只保证结果链接可进入并可测试，Chunk 5 再替换为完整结果页。

### Task 21: 生成并自托管毛笔字体子集

**Files:**
- Create: `scripts/font-charset.ts`
- Create: `scripts/subset-sanyi-font.py`
- Create: `web/fonts/mashanzheng-chars.txt`
- Create: `web/fonts/mashanzheng-subset.woff2`
- Create: `web/fonts/OFL.txt`
- Create: `tests/frontend-font.test.ts`

- [ ] **Step 1: 写字表与字体来源失败测试**

```ts
// tests/frontend-font.test.ts
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import test from "node:test";
import { buildFontCharset } from "../scripts/font-charset.js";
async function webSources(root = "web"): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return webSources(path);
    return [path];
  }));
  return nested.flat().filter((path) => [".css", ".html", ".ts", ".tsx"].includes(extname(path)));
}
test("毛笔体字表确定、有关键字且没有假名", () => {
  const charset = buildFontCharset();
  assert.equal(charset, [...charset].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join(""));
  for (const value of ["泰", "巽", "螣", "勾", "程", "世", "应"]) {
    assert.match(charset, new RegExp(value));
  }
  assert.doesNotMatch(charset, /[\u3040-\u30ff]/u);
});
test("字体只从站内 woff2 提供", async () => {
  const css = await readFile("web/styles/tokens.css", "utf8");
  assert.match(css, /url\(["']?\/fonts\/mashanzheng-subset\.woff2["']?\)/u);
  assert.match(css, /--brush:[^;]*"Ma Shan Zheng Subset"[^;]*"Kaiti SC"/u);
  const text = (await Promise.all((await webSources()).map((path) => readFile(path, "utf8")))).join("\n");
  assert.doesNotMatch(text, /fonts\.(?:googleapis|gstatic)\.com/u);
});
test("入口使用水墨夜样式且构建保留站内字体 URL", async () => {
  const main = await readFile("web/main.tsx", "utf8");
  const build = await readFile("scripts/build-frontend.ts", "utf8");
  const html = await readFile("web/index.html", "utf8");
  assert.match(main, /styles\/tokens\.css/u);
  assert.doesNotMatch(main, /\.\/styles\.css/u);
  assert.match(build, /external:\s*\["\/fonts\/\*"\]/u);
  assert.match(html, /<title>三易<\/title>/u);
  assert.match(html, /name="theme-color" content="#0F1110"/u);
});
```

- [ ] **Step 2: RED**

Run: `node --import tsx --test tests/frontend-font.test.ts`

Expected: FAIL，缺少字表生成器与 `tokens.css`。

- [ ] **Step 3: 实现确定性字表生成器**

```ts
// scripts/font-charset.ts
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ZHOUYI_CORPUS } from "../src/agent/zhouyi-corpus.js";
const EIGHT_GATES = "休生伤杜景死惊开";
const NINE_STARS = "天蓬天任天冲天辅天英天芮天柱天心天禽";
const EIGHT_SPIRITS = "值符腾蛇螣蛇太阴六合白虎玄武九地九天勾陈朱雀";
const SIX_SPIRITS = "青龙朱雀勾陈腾蛇白虎玄武";
const SIX_RELATIONS = "父母兄弟子孙妻财官鬼";
const STEMS_BRANCHES = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥";
const SHI_YING = "世应";
const FIXED_COPY = [
  "三易", "所问之事", "三家断语", "六爻排盘", "奇门时盘", "当日黄历", "卦历",
  "公历", "农历", "四柱", "节气", "月建日辰", "值日", "最近所问", "问卦",
  "程颐", "京房", "邵雍", "问",
] as const;
export function buildFontCharset(): string {
  const source = [
    ...ZHOUYI_CORPUS.map((item) => item.name),
    EIGHT_GATES,
    NINE_STARS,
    EIGHT_SPIRITS,
    SIX_SPIRITS,
    SIX_RELATIONS,
    STEMS_BRANCHES,
    SHI_YING,
    ...FIXED_COPY,
  ].join("");
  return [...new Set(source)].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join("");
}
export async function writeFontCharset(path = "web/fonts/mashanzheng-chars.txt"): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${buildFontCharset()}\n`, "utf8");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeFontCharset();
}
```

- [ ] **Step 4: 锁定上游摘要，再实现下载与子集化脚本**

先在 Chunk 1A 创建的工具环境安装唯一新增工具依赖：

Run: `.venv-tools/bin/pip install fonttools brotli`

首次下载地址固定为：
`https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf`。
已核验原文件大小为 5,857,936 字节，SHA-256 为
`6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb`。后续每次运行都先校验
摘要，再检查字形覆盖并调用 `pyftsubset`。

```python
# scripts/subset-sanyi-font.py
from hashlib import sha256
from pathlib import Path
from subprocess import run
from urllib.request import urlopen

from fontTools.ttLib import TTFont

FONT_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/"
    "MaShanZheng-Regular.ttf"
)
LICENSE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/OFL.txt"
EXPECTED_SHA256 = "6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb"
EXPECTED_SIZE = 5_857_936
KNOWN_MISSING = {"夬", "姤", "螣"}
ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "web" / "fonts"


def download(url: str) -> bytes:
    with urlopen(url, timeout=30) as response:
        return response.read()


def main() -> None:
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    source = download(FONT_URL)
    if len(source) != EXPECTED_SIZE:
        raise RuntimeError(f"字体大小不匹配：{len(source)}")
    digest = sha256(source).hexdigest()
    if digest != EXPECTED_SHA256:
        raise RuntimeError(f"字体摘要不匹配：{digest}")
    source_path = FONT_DIR / "MaShanZheng-Regular.ttf"
    source_path.write_bytes(source)
    charset = set((FONT_DIR / "mashanzheng-chars.txt").read_text(encoding="utf-8").strip())
    cmap = TTFont(source_path).getBestCmap() or {}
    missing = {character for character in charset if ord(character) not in cmap}
    print("字体缺字：" + ("、".join(sorted(missing)) if missing else "无"))
    unexpected = missing - KNOWN_MISSING
    if unexpected:
        raise RuntimeError("字体存在未登记缺字：" + "、".join(sorted(unexpected)))
    (FONT_DIR / "OFL.txt").write_bytes(download(LICENSE_URL))
    run([
        str(ROOT / ".venv-tools" / "bin" / "pyftsubset"),
        str(source_path),
        f"--text-file={FONT_DIR / 'mashanzheng-chars.txt'}",
        "--flavor=woff2",
        f"--output-file={FONT_DIR / 'mashanzheng-subset.woff2'}",
        "--layout-features=*",
    ], check=True)
    source_path.unlink()
    if (FONT_DIR / "mashanzheng-subset.woff2").stat().st_size >= 100_000:
        raise RuntimeError("字体子集必须小于 100 KB")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: 生成资产并 GREEN**

Run: `node --import tsx scripts/font-charset.ts && .venv-tools/bin/python scripts/subset-sanyi-font.py`

Run: `node --import tsx --test tests/frontend-font.test.ts && test $(wc -c < web/fonts/mashanzheng-subset.woff2) -lt 100000`

### Task 22: 建立视觉令牌、响应式布局与入口

**Files:**
- Create: `web/styles/tokens.css`
- Create: `web/styles/layout.css`
- Create: `web/styles/components.css`
- Modify: `scripts/build-frontend.ts`
- Modify: `web/index.html`
- Modify: `web/main.tsx`
- Modify: `web/providers/Providers.tsx`

- [ ] **Step 1: 运行 Task 21 已写好的入口与 CSS 契约测试，确认仍为 RED**

- [ ] **Step 2: RED 后创建三份完整样式**

```css
/* web/styles/tokens.css */
@font-face {
  font-family: "Ma Shan Zheng Subset";
  src: url("/fonts/mashanzheng-subset.woff2") format("woff2");
  font-display: swap;
}
:root {
  color-scheme: dark;
  --bg: #0F1110;
  --panel: #151816;
  --panel-2: #1B1F1C;
  --paper: #EAE5D9;
  --muted: #A6A195;
  --dim: #75716A;
  --gold: #C9A866;
  --gold-soft: rgb(201 168 102 / 0.13);
  --line: rgb(201 168 102 / 0.18);
  --line-strong: rgb(201 168 102 / 0.42);
  --cinnabar: #D0614A;
  --cinnabar-soft: rgb(208 97 74 / 0.15);
  --jade: #82B59E;
  --jade-soft: rgb(130 181 158 / 0.14);
  --seal-bg: #A63A2B;
  --seal-text: #F6EFE2;
  --serif: "Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif;
  --brush: "Ma Shan Zheng Subset", "Kaiti SC", "STKaiti", "KaiTi", serif;
  --dynamic: "Kaiti SC", "STKaiti", "KaiTi", serif;
  --sans: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

```css
/* web/styles/layout.css */
* {
  box-sizing: border-box;
}
html {
  min-width: 0;
  overflow-x: hidden;
}
body {
  margin: 0;
  min-width: 0;
  overflow-x: hidden;
  background: radial-gradient(1100px 560px at 8% -8%, rgb(255 255 255 / 0.055), transparent 62%),
    radial-gradient(900px 520px at 104% 34%, rgb(201 168 102 / 0.05), transparent 66%), var(--bg);
  color: var(--paper);
  font-family: var(--serif);
  font-size: 14px;
  padding: 0 clamp(16px, 3.5vw, 44px) 72px;
}
button, input, textarea, select {
  font: inherit;
}
button, a, input, select {
  min-height: 44px;
}
.page {
  display: grid;
  gap: 26px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}
.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
  gap: 26px;
  align-items: start;
}
@media (max-width: 980px) {
  .home-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

```css
/* web/styles/components.css */
.topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}
.seal {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 3px;
  background: var(--seal-bg);
  color: var(--seal-text);
  font-family: var(--brush);
  font-size: 24px;
}
.brand, .panel-head h2 {
  font-family: var(--brush);
  font-weight: 400;
  letter-spacing: 0.08em;
}
.brand {
  font-size: 26px;
}
.shikong {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  border: 1px solid var(--line);
  background: rgb(21 24 22 / 0.7);
}
.shikong-item {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 14px 16px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  margin: 0 -1px -1px 0;
}
.shikong-item span, .hint, .recent time {
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.5;
}
.panel {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 22px clamp(16px, 2.2vw, 26px);
  border: 1px solid var(--line);
  background: var(--panel);
}
.question-input {
  width: 100%;
  min-height: 150px;
  resize: vertical;
  border: 1px solid var(--line-strong);
  background: var(--panel-2);
  color: var(--paper);
  padding: 16px;
  line-height: 1.7;
}
.tags, .actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag, .button {
  border: 1px solid var(--gold);
  border-radius: 3px;
  background: var(--gold-soft);
  color: var(--gold);
  padding: 10px 14px;
}
.button-primary {
  background: var(--gold);
  color: #17130B;
  cursor: pointer;
}
.button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.error {
  color: var(--cinnabar);
}
.recent {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.recent a {
  display: grid;
  gap: 3px;
  color: var(--paper);
  text-decoration: none;
  border-bottom: 1px solid var(--line);
  padding: 8px 0;
}
```

- [ ] **Step 3: 修改构建、HTML、入口与 Provider**

将 `index.html` 的标题改为「三易」，描述改为「一问三家：六爻问事，程颐、京房、邵雍各自解卦。」，
`theme-color` 改为 `#0F1110`，保留 `lang="zh-CN"`。四个文件使用下列完整内容。

```html
<!-- web/index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0F1110" />
    <meta
      name="description"
      content="一问三家：六爻问事，程颐、京房、邵雍各自解卦。"
    />
    <link rel="icon" href="data:," />
    <link rel="stylesheet" href="/dist/app.css" />
    <title>三易</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/dist/app.js"></script>
  </body>
</html>
```

```ts
// web/main.tsx
import "@rainbow-me/rainbowkit/styles.css";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import { Providers } from "./providers/Providers.js";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) {
  throw new Error("页面缺少 React 根节点");
}
createRoot(root).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
```

```tsx
// web/providers/Providers.tsx
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "../lib/wagmi.js";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale="zh-CN"
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#C9A866",
            accentColorForeground: "#17130B",
            borderRadius: "small",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

```ts
// scripts/build-frontend.ts
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const rootDir = process.cwd();
const outputDir = resolve(rootDir, "web/dist");
await mkdir(outputDir, { recursive: true });

const PUBLIC_DEFAULTS = {
  ARC_RPC_URL: "https://rpc.testnet.arc.io",
  ARC_CHAIN_ID: "5042002",
  ARC_EXPLORER: "https://testnet.arcscan.app",
} as const;
const walletConnectProjectId = process.env.WALLETCONNECT_PROJECT_ID ?? "";
if (!/^[0-9a-fA-F]{32}$/.test(walletConnectProjectId)) {
  throw new Error("WALLETCONNECT_PROJECT_ID 必须是 32 位十六进制公开项目标识");
}
const publicConfig = {
  walletConnectProjectId,
  arcRpcUrl: process.env.ARC_RPC_URL ?? PUBLIC_DEFAULTS.ARC_RPC_URL,
  arcChainId: process.env.ARC_CHAIN_ID ?? PUBLIC_DEFAULTS.ARC_CHAIN_ID,
  arcExplorer: process.env.ARC_EXPLORER ?? PUBLIC_DEFAULTS.ARC_EXPLORER,
};
if (!/^\d+$/.test(publicConfig.arcChainId)) {
  throw new Error("ARC_CHAIN_ID 必须是十进制整数");
}
await build({
  entryPoints: [resolve(rootDir, "web/main.tsx")],
  outfile: resolve(outputDir, "app.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  external: ["/fonts/*"],
  logOverride: {
    // 当前钱包清单未启用 MetaMask SDK 的可选动态入口。
    "empty-glob": "silent",
  },
  plugins: [{
    name: "rainbowkit-safe-defaults",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@rainbow-me\/rainbowkit$/ }, (args) => {
        if (!args.importer.endsWith("/web/lib/wagmi.ts")) {
          return undefined;
        }
        return { path: resolve(rootDir, "web/lib/secure-rainbow-config.ts") };
      });
      buildContext.onResolve({ filter: /^wagmi\/chains$/ }, (args) => {
        if (!args.importer.includes("/node_modules/@rainbow-me/rainbowkit/")) {
          return undefined;
        }
        return { path: resolve(rootDir, "web/lib/rainbowkit-mainnet.ts") };
      });
    },
  }],
  define: {
    // 浏览器只接收逐项列出的公开配置，不继承构建机环境。
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify("production"),
    __WALLETCONNECT_PROJECT_ID__: JSON.stringify(publicConfig.walletConnectProjectId),
    __ARC_RPC_URL__: JSON.stringify(publicConfig.arcRpcUrl),
    __ARC_CHAIN_ID__: JSON.stringify(publicConfig.arcChainId),
    __ARC_EXPLORER__: JSON.stringify(publicConfig.arcExplorer),
  },
});
console.log("前端构建完成：web/dist/app.js");
```

- [ ] **Step 4: GREEN、构建与 390px 静态守卫**

Run: `node --import tsx --test tests/frontend-font.test.ts && npm run typecheck && npm run frontend:build`

Expected: PASS；esbuild 不把 `/fonts/...` 当磁盘根路径解析。浏览器 390px 视口下 `documentElement.scrollWidth`
不大于 `innerWidth`，所有按钮与链接的可点击框高至少 44px。

### Task 23: 实现与 Chunk 3 对齐的数据客户端和最近记录

**Files:**
- Create: `web/lib/api.ts`
- Create: `web/lib/recent-readings.ts`
- Create: `tests/frontend-api.test.ts`
- Create: `tests/frontend-recent.test.ts`

- [ ] **Step 1: 写完整失败测试**

```ts
// tests/frontend-api.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApiClient } from "../web/lib/api.js";
test("非 2xx 保留中文错误、状态与冲突 readingId", async () => {
  const fakeFetch: typeof fetch = async () => new Response(
    JSON.stringify({ error: "付款凭证已用于这一卦", readingId: "reading-1" }),
    { status: 409, headers: { "content-type": "application/json" } },
  );
  const api = createApiClient(fakeFetch);
  await assert.rejects(api.createReading({} as never), (error: unknown) => {
    return error instanceof ApiError
      && error.status === 409
      && error.message === "付款凭证已用于这一卦"
      && error.readingId === "reading-1";
  });
});
test("非 JSON 错误仍给中文消息", async () => {
  const api = createApiClient(async () => new Response("bad", { status: 503 }));
  await assert.rejects(api.getNow(), (error: unknown) => {
    return error instanceof ApiError && error.status === 503 && error.message === "请求未能完成";
  });
});
```

```ts
// tests/frontend-recent.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { loadRecentReadings, saveRecentReading } from "../web/lib/recent-readings.js";
class MemoryStorage implements Storage {
  readonly data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
test("最近记录去重并只保留二十条", () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 22; index += 1) {
    saveRecentReading({
      id: `id-${index}`,
      kind: "question",
      question: `问题${index}`,
      createdAt: new Date(index * 1_000).toISOString(),
    }, storage);
  }
  saveRecentReading({ id: "id-21", kind: "question", question: "新问题", createdAt: "later" }, storage);
  const values = loadRecentReadings(storage);
  assert.equal(values.length, 20);
  assert.equal(values[0]?.question, "新问题");
  assert.equal(values.filter((item) => item.id === "id-21").length, 1);
});
test("存储读写抛错时返回空且不向外抛", () => {
  const broken = new Proxy({} as Storage, { get() { throw new Error("blocked"); } });
  assert.deepEqual(loadRecentReadings(broken), []);
  assert.doesNotThrow(() => saveRecentReading({
    id: "id", kind: "question", question: "问题", createdAt: "now",
  }, broken));
});
```

- [ ] **Step 2: RED 后实现客户端**

```ts
// web/lib/api.ts
import type { QuestionFeeProof } from "../../src/oracle/fee-payment.js";
import type { SanyiApi } from "../../src/sanyi/api.js";
import type { QuestionSchoolKey } from "../../src/sanyi/schools/index.js";
export type NowResponse = Awaited<ReturnType<SanyiApi["now"]>>;
export type Classification = Awaited<ReturnType<SanyiApi["classify"]>>;
export type PublicReading = Awaited<ReturnType<SanyiApi["getReading"]>>;
export type ThrowResult = Awaited<ReturnType<SanyiApi["throwCoin"]>>;
export interface CreateReadingInput {
  question: string;
  kind: Classification["kind"];
  subjectKey?: string;
  horizon?: string;
  feeProof: QuestionFeeProof;
}
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly readingId?: string) {
    super(message);
    this.name = "ApiError";
  }
}
async function decode<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  let payload: { error?: unknown; readingId?: unknown } = {};
  try { payload = await response.json() as typeof payload; } catch {}
  const message = typeof payload.error === "string" ? payload.error : "请求未能完成";
  const readingId = typeof payload.readingId === "string" ? payload.readingId : undefined;
  throw new ApiError(message, response.status, readingId);
}
export function createApiClient(fetcher: typeof fetch = fetch) {
  const request = async <T>(path: string, body?: unknown): Promise<T> => decode<T>(await fetcher(path, {
    ...(body === undefined ? {} : {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  }));
  return {
    getNow: () => request<NowResponse>("/api/now"),
    classify: (question: string) => request<Classification>("/api/classify", { question }),
    createReading: (input: CreateReadingInput) => request<PublicReading>("/api/readings", input),
    throwCoin: (id: string, index: number) => request<ThrowResult>(`/api/readings/${id}/throws`, { index }),
    getReading: (id: string) => request<PublicReading>(`/api/readings/${id}`),
    retrySchool: (id: string, key: QuestionSchoolKey) => request<PublicReading>(
      `/api/readings/${id}/schools/${key}/retry`,
      {},
    ),
    changeSubject: (id: string, subjectKey: string) => request<PublicReading>(
      `/api/readings/${id}/subject`,
      { subjectKey },
    ),
  };
}
export const api = createApiClient();
```

```ts
// web/lib/recent-readings.ts
export interface RecentReading {
  id: string;
  kind: string;
  question: string;
  createdAt: string;
}
const KEY = "sanyi.recent-readings.v1";
function isRecent(value: unknown): value is RecentReading {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return [item.id, item.kind, item.question, item.createdAt].every((field) => typeof field === "string");
}
export function loadRecentReadings(storage: Storage = localStorage): RecentReading[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isRecent).slice(0, 20) : [];
  } catch { return []; }
}
export function saveRecentReading(item: RecentReading, storage: Storage = localStorage): void {
  try {
    const previous = loadRecentReadings(storage).filter((value) => value.id !== item.id);
    const values = [item, ...previous].slice(0, 20);
    storage.setItem(KEY, JSON.stringify(values));
  } catch {}
}
```

- [ ] **Step 3: GREEN**

Run: `node --import tsx --test tests/frontend-api.test.ts tests/frontend-recent.test.ts && npm run typecheck`

## Chunk 4B: 前端基础（付款、首页与 hash 路由）

### Task 24: 提取卦金计划并保留 EIP-5792 原子付款

**Files:**
- Create: `web/lib/fee-plan.ts`
- Create: `web/lib/use-fee-payment.ts`
- Create: `tests/frontend-fee-plan.test.ts`

- [ ] **Step 1: 写纯函数三分支失败测试**

```ts
// tests/frontend-fee-plan.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { planFeePayment } from "../web/lib/fee-plan.js";
const enoughNative = 10n ** 18n;
test("余额不足时报告短缺", () => {
  const value = planFeePayment({
    erc20Balance: 1n, nativeBalance: 1n, gasPrice: 1n, allowances: [0n, 0n, 0n],
  });
  assert.equal(value.shortfall.missingErc20Usdc6, 49_999n);
  assert.ok(value.shortfall.missingNativeWei18 > 0n);
});
test("首次付款列出三笔授权与三笔入账", () => {
  const value = planFeePayment({
    erc20Balance: 50_000n, nativeBalance: enoughNative, gasPrice: 1n, allowances: [0n, 0n, 0n],
  });
  assert.equal(value.missingApprovals.length, 3);
  assert.equal(value.depositCalls.length, 3);
});
test("已有授权时不再授权", () => {
  const value = planFeePayment({
    erc20Balance: 50_000n,
    nativeBalance: enoughNative,
    gasPrice: 1n,
    allowances: [10_000_000n, 10_000_000n, 10_000_000n],
  });
  assert.deepEqual(value.missingApprovals, []);
  assert.deepEqual(value.depositCalls.map((call) => call.amount), [16_667n, 16_667n, 16_666n]);
});
```

- [ ] **Step 2: RED 后实现纯计划与薄钩子**

```ts
// web/lib/fee-plan.ts
import { walletShortfalls } from "../../src/frontend/wallet.js";
import { buildQuestionFeePlan } from "../../src/oracle/fee-payment.js";

export const PREFLIGHT_GAS_UNITS = 600_000n;
export interface FeePlanInput {
  erc20Balance: bigint;
  nativeBalance: bigint;
  gasPrice: bigint;
  allowances: readonly bigint[];
}
export function planFeePayment(input: FeePlanInput) {
  const plan = buildQuestionFeePlan();
  const shortfall = walletShortfalls({
    erc20BalanceUsdc6: input.erc20Balance,
    nativeBalanceWei18: input.nativeBalance,
    feeUsdc6: plan.feeUsdc6,
    bondUsdc6: 0n,
    estimatedGasWei18: input.gasPrice * PREFLIGHT_GAS_UNITS,
  });
  return {
    shortfall,
    missingApprovals: plan.approvals.filter((share, index) => {
      return (input.allowances[index] ?? 0n) < share.amountUsdc6;
    }),
    depositCalls: plan.deposits.map((share) => ({ vault: share.vault, amount: share.amountUsdc6 })),
  };
}
```

```ts
// web/lib/use-fee-payment.ts
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useState } from "react";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { divinerVaultAbi, erc20WalletAbi } from "../../src/frontend/abis.js";
import { formatUsdc6, USDC_TOKEN_ADDRESS } from "../../src/frontend/wallet.js";
import {
  buildQuestionFeePlan,
  type QuestionFeeProof,
} from "../../src/oracle/fee-payment.js";
import { planFeePayment, PREFLIGHT_GAS_UNITS } from "./fee-plan.js";
import { ARC_CHAIN_ID, arcTestnet } from "./wagmi.js";

function atomicMessage(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/atomic|wallet_sendCalls|method.*(?:not found|support)|capabilit/iu.test(message)) {
    return new Error(
      "当前钱包不支持原子批量交易。为保证三易卦金账户要么全部收款、"
        + "要么全部不收，本次没有扣款。",
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error("付款未完成，本次没有扣款");
}
export function useFeePayment() {
  const { address, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID });
  const { data: walletClient, refetch } = useWalletClient({ chainId: ARC_CHAIN_ID });
  const [estimatedGasWei18, setEstimatedGasWei18] = useState<bigint>();
  const pay = useCallback(async (): Promise<QuestionFeeProof> => {
    if (!address) {
      openConnectModal?.();
      throw new Error("请先连接钱包，再支付卦金");
    }
    if (chainId !== ARC_CHAIN_ID) await switchChainAsync({ chainId: ARC_CHAIN_ID });
    const activeWallet = walletClient ?? (await refetch()).data;
    if (!activeWallet || !publicClient) throw new Error("钱包尚未准备好，请稍后重试");
    const base = buildQuestionFeePlan();
    const [erc20Balance, nativeBalance, gasPrice, ...allowances] = await Promise.all([
      publicClient.readContract({
        address: USDC_TOKEN_ADDRESS,
        abi: erc20WalletAbi,
        functionName: "balanceOf",
        args: [address],
      }),
      publicClient.getBalance({ address }),
      publicClient.getGasPrice(),
      ...base.approvals.map((share) => publicClient.readContract({
        address: USDC_TOKEN_ADDRESS,
        abi: erc20WalletAbi,
        functionName: "allowance",
        args: [address, share.vault],
      })),
    ]);
    setEstimatedGasWei18(gasPrice * PREFLIGHT_GAS_UNITS);
    const planned = planFeePayment({ erc20Balance, nativeBalance, gasPrice, allowances });
    if (planned.shortfall.missingErc20Usdc6 || planned.shortfall.missingNativeWei18) {
      const amount = formatUsdc6(base.feeUsdc6);
      throw new Error(`支付卦金需要 ${amount} USDC 及少量 gas；当前余额不足`);
    }
    const send = async (calls: ReadonlyArray<{ to: Address; data: Hex }>) => {
      try {
        const bundle = await activeWallet.sendCalls({
          account: address,
          chain: arcTestnet,
          calls,
          forceAtomic: true,
        });
        const status = await activeWallet.waitForCallsStatus({
          id: bundle.id,
          throwOnFailure: true,
          timeout: 90_000,
        });
        if (!status.atomic || status.status !== "success") {
          throw new Error("钱包没有原子确认整组交易");
        }
        const hashes = (status.receipts ?? []).map((item) => item.transactionHash).filter(
          (hash): hash is Hex => typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/u.test(hash),
        );
        if (!hashes.length) throw new Error("钱包未返回可核验的交易哈希");
        return { id: bundle.id, hashes };
      } catch (error) { throw atomicMessage(error); }
    };
    if (planned.missingApprovals.length) {
      await send(planned.missingApprovals.map((share) => ({
        to: USDC_TOKEN_ADDRESS,
        data: encodeFunctionData({
          abi: erc20WalletAbi,
          functionName: "approve",
          args: [share.vault, share.amountUsdc6],
        }),
      })));
    }
    const paid = await send(planned.depositCalls.map((call) => ({
      to: call.vault,
      data: encodeFunctionData({ abi: divinerVaultAbi, functionName: "deposit", args: [call.amount] }),
    })));
    return { payer: address, bundleId: paid.id, transactionHashes: paid.hashes };
  }, [address, chainId, openConnectModal, publicClient, refetch, switchChainAsync, walletClient]);
  return { pay, estimatedGasWei18 };
}
```

- [ ] **Step 3: GREEN 与旧行为核对**

Run: `node --import tsx --test tests/frontend-fee-plan.test.ts && npm run typecheck`

对照旧 `web/app.tsx` 的 `sendAtomicCalls` 与 `payQuestionFee`：授权和付款必须是两次独立的原子批次；
已有授权时只有付款一次确认；不支持 EIP-5792 时不降级为逐笔发送，且文案不得出现旧产品称谓。

### Task 25: 构建首页组件与 hash 路由

**Files:**
- Rewrite: `web/app.tsx`
- Create: `web/pages/Home.tsx`
- Create: `web/pages/Reading.tsx`
- Create: `web/components/ClassificationTags.tsx`
- Create: `web/components/ShikongBar.tsx`
- Create: `web/components/QuestionForm.tsx`
- Create: `web/components/PaymentButton.tsx`
- Create: `web/components/RecentReadings.tsx`
- Create: `tests/frontend-home.test.ts`

- [ ] **Step 1: 写完整 SSR 失败测试**

```ts
// tests/frontend-home.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClassificationTags,
  type ClassificationView,
} from "../web/components/ClassificationTags.js";
import { RecentReadings } from "../web/components/RecentReadings.js";
import { ShikongBar } from "../web/components/ShikongBar.js";
const forbidden = /易者|押钱|赔付|封存|・|[\u3040-\u30ff]/u;
test("时空栏渲染六格", () => {
  const html = renderToStaticMarkup(createElement(ShikongBar, {
    data: {
      solar: "2026年9月30日 20:15",
      lunar: "八月二十",
      pillars: "丙午 丁酉 丁未 庚戌",
      solarTerm: "秋分",
      monthDay: "酉月 未日",
      duty: "开日 天德",
    },
  }));
  const labels = ["公历", "农历", "四柱", "节气", "月建日辰", "值日"];
  for (const label of labels) assert.match(html, new RegExp(label));
  assert.doesNotMatch(html, forbidden);
});
const view = (overrides: Partial<ClassificationView>): ClassificationView => ({
  question: "这次面试能过吗", kind: "question", supported: true, subject: "工作官职", ...overrides,
});
test("问事、运势与起名标签提供正确动作", () => {
  const callbacks = {
    onKindChange: () => {},
    onQuestionFallback: () => {},
    onSubjectChange: () => {},
  };
  const question = renderToStaticMarkup(createElement(ClassificationTags, {
    ...callbacks,
    view: view({}),
  }));
  const fortune = renderToStaticMarkup(createElement(ClassificationTags, {
    ...callbacks,
    view: view({
      kind: "fortune",
      supported: true,
      horizon: "今年",
    }),
  }));
  const naming = renderToStaticMarkup(createElement(ClassificationTags, {
    ...callbacks,
    view: view({
      kind: "naming",
      supported: false,
      suggestion: "可改为问事",
    }),
  }));
  assert.match(question, /问事.*工作官职/su);
  assert.match(fortune, /即将开放，可先改为问事/u);
  assert.match(naming, /可改为问事/u);
  assert.doesNotMatch(question + fortune + naming, forbidden);
});
test("最近记录可以打开", () => {
  const html = renderToStaticMarkup(createElement(RecentReadings, {
    readings: [{
      id: "abc",
      kind: "question",
      question: "面试能过吗",
      createdAt: "2026-09-30T12:15:00Z",
    }],
  }));
  assert.match(html, /href="#\/r\/abc"/u);
  assert.match(html, /面试能过吗/u);
  assert.doesNotMatch(html, forbidden);
});
```

- [ ] **Step 2: RED 后实现时空栏与最近记录**

```tsx
// web/components/ShikongBar.tsx
import { useEffect, useState } from "react";
import { api, type NowResponse } from "../lib/api.js";
export interface ShikongView {
  solar: string;
  lunar: string;
  pillars: string;
  solarTerm: string;
  monthDay: string;
  duty: string;
}
function toView(value: NowResponse): ShikongView {
  const item = value as unknown as Record<string, unknown>;
  return {
    solar: String(item.solar ?? item.gregorian ?? ""),
    lunar: String(item.lunar ?? ""),
    pillars: String(item.pillars ?? item.fourPillars ?? ""),
    solarTerm: String(item.solarTerm ?? ""),
    monthDay: String(item.monthDay ?? item.monthBuildDayBranch ?? ""),
    duty: String(item.duty ?? item.dayOfficer ?? ""),
  };
}
export function ShikongBar({ data }: { data?: ShikongView }) {
  const [view, setView] = useState<ShikongView | undefined>(data);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (data) return undefined;
    let active = true;
    const refresh = () => api.getNow().then((value) => {
      if (active) { setView(toView(value)); setFailed(false); }
    }).catch(() => { if (active) setFailed(true); });
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [data]);
  if (!view) {
    return (
      <section className="shikong" aria-label="此刻">
        {failed ? "天时暂不可得" : "正在推算天时"}
      </section>
    );
  }
  const cells = [
    ["公历", view.solar], ["农历", view.lunar], ["四柱", view.pillars],
    ["节气", view.solarTerm], ["月建日辰", view.monthDay], ["值日", view.duty],
  ];
  return (
    <section className="shikong" aria-label="此刻">
      {cells.map(([label, value]) => (
        <div className="shikong-item" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </section>
  );
}
```

```tsx
// web/components/RecentReadings.tsx
import type { RecentReading } from "../lib/recent-readings.js";
export function RecentReadings({ readings }: { readings: readonly RecentReading[] }) {
  return (
    <section className="panel">
      <h2>最近所问</h2>
      {readings.length ? (
        <ul className="recent">
          {readings.map((item) => (
            <li key={item.id}>
              <a href={`#/r/${item.id}`}>
                <span>{item.question}</span>
                <time>{item.createdAt}</time>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">本机还没有留下卦历。</p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: 实现分类问题框**

```tsx
// web/components/ClassificationTags.tsx
export interface ClassificationView {
  question: string;
  kind: string;
  supported: boolean;
  subjectKey?: string;
  subject?: string;
  horizon?: string;
  suggestion?: string;
}
interface ClassificationTagsProps {
  view: ClassificationView;
  onKindChange(kind: "question" | "destiny" | "fortune"): void;
  onQuestionFallback(): void;
  onSubjectChange(subjectKey: string, label: string): void;
}
const KINDS = [
  ["question", "问事"],
  ["destiny", "命理"],
  ["fortune", "运势"],
] as const;
const SUBJECTS = [
  ["career", "工作官职"],
  ["wealth", "求财"],
  ["relationship", "感情婚姻"],
  ["health", "健康疾病"],
  ["travel", "出行行人"],
  ["lawsuit", "诉讼是非"],
  ["other", "其它事项"],
] as const;
export function ClassificationTags(props: ClassificationTagsProps) {
  const { view } = props;
  return (
    <section aria-label="分类结果">
      <div className="tags">
        {KINDS.map(([kind, label]) => (
          <button
            className="tag"
            key={kind}
            onClick={() => props.onKindChange(kind)}
            type="button"
          >
            {label}
          </button>
        ))}
        {view.subject ? <span className="tag">{view.subject}</span> : null}
        {view.horizon ? <span className="tag">{view.horizon}</span> : null}
      </div>
      {view.kind === "question" ? (
        <div className="tags" aria-label="改事项">
          {SUBJECTS.map(([key, label]) => (
            <button
              className="tag"
              key={key}
              onClick={() => props.onSubjectChange(key, label)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {["destiny", "fortune"].includes(view.kind) ? (
        <p>即将开放，可先改为问事</p>
      ) : null}
      {!view.supported && view.suggestion ? <p>{view.suggestion}</p> : null}
      {view.kind !== "question" ? (
        <button onClick={props.onQuestionFallback} type="button">
          改为问事
        </button>
      ) : null}
    </section>
  );
}
```

```tsx
// web/components/QuestionForm.tsx
import { useState, type FormEvent } from "react";
import { api, type Classification } from "../lib/api.js";
import {
  ClassificationTags,
  type ClassificationView,
} from "./ClassificationTags.js";
import { PaymentButton } from "./PaymentButton.js";
function fromClassification(value: Classification): ClassificationView {
  const item = value as Classification & { subject?: { label?: string }; horizon?: string };
  return {
    question: item.question,
    kind: item.kind,
    supported: item.supported,
    ...(item.subject?.key ? { subjectKey: item.subject.key } : {}),
    ...(item.subject?.label ? { subject: item.subject.label } : {}),
    ...(item.horizon ? { horizon: item.horizon } : {}),
    ...(item.suggestion ? { suggestion: item.suggestion } : {}),
  };
}
export function QuestionForm() {
  const [question, setQuestion] = useState("");
  const [view, setView] = useState<ClassificationView>();
  const [error, setError] = useState("");
  const classify = async (event: FormEvent) => {
    event.preventDefault();
    if ([...question.trim()].length < 4 || [...question.trim()].length > 280) {
      setError("问题需为 4 至 280 字");
      return;
    }
    try { setView(fromClassification(await api.classify(question))); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "分类暂不可用"); }
  };
  const changeToQuestion = () => setView({
    question, kind: "question", supported: true, subjectKey: "other", subject: "其它事项",
  });
  const changeSubject = (subjectKey: string, subject: string) => setView({
    question,
    kind: "question",
    supported: true,
    subjectKey,
    subject,
  });
  const changeKind = (kind: "question" | "destiny" | "fortune") => {
    if (kind === "question") {
      changeToQuestion();
      return;
    }
    setView({
      question,
      kind,
      supported: true,
      ...(kind === "fortune" ? { horizon: "year" } : {}),
    });
  };
  return (
    <form className="panel" onSubmit={classify}>
      <h1>所问之事</h1>
      <textarea
        aria-label="所问之事"
        className="question-input"
        maxLength={280}
        minLength={4}
        onChange={(event) => setQuestion(event.target.value)}
        value={question}
      />
      {view ? (
        <ClassificationTags
          onKindChange={changeKind}
          onQuestionFallback={changeToQuestion}
          onSubjectChange={changeSubject}
          view={view}
        />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {view?.kind === "question" ? (
        <PaymentButton question={question} classification={view} />
      ) : (
        <button className="button button-primary" type="submit">识别所问</button>
      )}
    </form>
  );
}
```

- [ ] **Step 4: 实现付款、首页、占位结果页和路由**

```tsx
// web/components/PaymentButton.tsx
import { useState } from "react";
import { formatUnits } from "viem";
import { api, ApiError } from "../lib/api.js";
import { saveRecentReading } from "../lib/recent-readings.js";
import { useFeePayment } from "../lib/use-fee-payment.js";
import type { ClassificationView } from "./ClassificationTags.js";
export function PaymentButton(props: { question: string; classification: ClassificationView }) {
  const { pay, estimatedGasWei18 } = useFeePayment();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const feeProof = await pay();
      const reading = await api.createReading({
        question: props.question,
        kind: "question",
        ...(props.classification.subjectKey
          ? { subjectKey: props.classification.subjectKey }
          : {}),
        feeProof,
      });
      saveRecentReading({
        id: reading.id,
        kind: reading.kind,
        question: reading.question,
        createdAt: reading.createdAt,
      });
      location.hash = `/r/${reading.id}`;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.readingId) {
        location.hash = `/r/${caught.readingId}`;
        return;
      }
      setError(caught instanceof Error ? caught.message : "付款未完成，本次没有扣款");
    } finally { setBusy(false); }
  };
  const gas = estimatedGasWei18 === undefined
    ? "连接钱包后计算"
    : `${formatUnits(estimatedGasWei18, 18)} USDC`;
  return (
    <div>
      <p className="hint">
        金额：0.05 USDC；去向：三易卦金账户；预估 gas：{gas}。
      </p>
      <button
        className="button button-primary"
        disabled={busy}
        onClick={submit}
        type="button"
      >
        {busy ? "正在确认" : "问卦 · 0.05 USDC"}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
```

```tsx
// web/pages/Home.tsx
import { useState } from "react";
import { QuestionForm } from "../components/QuestionForm.js";
import { RecentReadings } from "../components/RecentReadings.js";
import { ShikongBar } from "../components/ShikongBar.js";
import { loadRecentReadings } from "../lib/recent-readings.js";
export function Home() {
  const [recent] = useState(loadRecentReadings);
  return (
    <main className="page">
      <header className="topbar">
        <span className="seal">问</span>
        <span className="brand">三易</span>
      </header>
      <ShikongBar />
      <div className="home-grid">
        <QuestionForm />
        <RecentReadings readings={recent} />
      </div>
    </main>
  );
}
```

```tsx
// web/pages/Reading.tsx
export function Reading({ id }: { id: string }) {
  return (
    <main className="page">
      <section className="panel" aria-live="polite">
        <h1>正在打开这一卦</h1>
        <p className="hint">卦历编号：{id}</p>
      </section>
    </main>
  );
}
```

```tsx
// web/app.tsx
import { useEffect, useState } from "react";
import { Home } from "./pages/Home.js";
import { Reading } from "./pages/Reading.js";
function route(hash: string): { page: "home" } | { page: "reading"; id: string } {
  const match = hash.match(/^#\/r\/([a-z2-7]{26})$/u);
  return match?.[1] ? { page: "reading", id: match[1] } : { page: "home" };
}
export function App() {
  const [current, setCurrent] = useState(() => route(location.hash));
  useEffect(() => {
    const update = () => setCurrent(route(location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return current.page === "reading" ? <Reading id={current.id} /> : <Home />;
}
```

- [ ] **Step 5: GREEN、严格类型与构建**

Run: `node --import tsx --test tests/frontend-home.test.ts && npm run typecheck && npm run frontend:build`

Expected: 3 tests PASS；占位结果页可由合法 reading id 路由进入；分类失败和时空栏失败均不阻塞输入。

### Task 26: Chunk 4 交叉验收

- [ ] 运行本 Chunk 全部测试：

Run: `node --import tsx --test tests/frontend-font.test.ts tests/frontend-api.test.ts \
  tests/frontend-recent.test.ts tests/frontend-fee-plan.test.ts tests/frontend-home.test.ts`

- [ ] 运行严格类型、构建、秘密扫描与字体大小检查：

Run: `npm run typecheck && npm run frontend:build && npm run frontend:secrets`

Run: `test $(wc -c < web/fonts/mashanzheng-subset.woff2) -lt 100000`

- [ ] 运行文化与外链守卫：

Run: `! rg 'fonts\.(googleapis|gstatic)\.com|易者|押钱|赔付|封存|・|[ぁ-ヿ]' web \
  --glob '!fonts/OFL.txt'`

- [ ] 在 390px、980px、981px 三个视口人工核对：页面无横向溢出；980px 单列、981px 双列；正文不小于
14px；所有可点击目标至少 44px；键盘可操作分类、改类型、改事项、付款和最近记录。

- [ ] 对照 Chunk 3 逐项核对七个客户端方法的路径、方法和请求体；确认 409 的 `readingId` 可直接恢复结果；
对照旧站确认授权批次与付款批次都要求 `forceAtomic: true`，且任何不支持原子批量的错误都不会触发逐笔扣款。

- [ ] 核对 OpenSpec：`unified-question-entry` 的分类可改、`paid-oracle-flow` 的全付费入口、
`wallet-signed-divination` 的余额与网络门禁、`reading-archive` 的本机最近 20 条、`ink-night-theme` 的
水墨夜令牌与文化守卫均有测试或人工验收对应项。`tasks.md` 仅在实现和上述验收全部完成后更新。

## Chunk 5A: 结果页状态、六掷与首屏卦象

> 本 Chunk 以已确认的水墨夜样稿为视觉基线，完成 OpenSpec 任务 1.12 的问事结果页。纯状态函数不得
> 依赖 React、DOM、钱包配置或系统时钟；组件只消费 Chunk 3 的 `PublicReading`。先锁定阶段与六掷状态机，
> 再实现交互和展示。旧站说明文字的唯一移植来源是基线 `310afdc:web/app.tsx` 第 415–740 行；移植后
> 使用中文间隔号「·」，不得保留旧产品称谓。

### Task 27: 建立结果页阶段与六掷纯状态机

**Files:**
- Create: `web/lib/reading-state.ts`
- Create: `web/lib/throw-machine.ts`
- Create: `tests/frontend-reading-state.test.ts`
- Create: `tests/frontend-throw-machine.test.ts`

- [ ] **Step 1: 写结果页阶段失败测试**

```ts
// tests/frontend-reading-state.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import type { PublicReading } from "../web/lib/api.js";
import {
  consensusTenths,
  readingStage,
  shouldPollReading,
} from "../web/lib/reading-state.js";

function reading(
  status: PublicReading["status"],
  schoolStatuses: readonly [string, string, string],
): PublicReading {
  const school = (index: number, confidenceTenths?: number) => ({
    status: schoolStatuses[index],
    retries: 0,
    ...(confidenceTenths === undefined
      ? {}
      : {
          output: {
            verdict: "平",
            confidenceTenths,
            headline: "静待其时",
            reason: "盘面尚需合看",
            sections: [{ title: "卦义", text: "守正" }],
            advice: ["先核对条件"],
            evidence: [{ ref: "day", claim: "日辰" }],
          },
        }),
  });
  return {
    id: "abcdefghijklmnopqrstuvwxyz",
    kind: "question",
    createdAt: "2026-09-30T12:15:00.000Z",
    question: "这次面试能过吗",
    subject: {
      suggestedKey: "career",
      finalKey: "career",
      overridden: false,
      changes: 0,
    },
    payment: { firstHash: `0x${"11".repeat(32)}` },
    throws: [],
    schools: {
      chengyi: school(0, 6),
      jingfang: school(1, 3),
      shaoyong: school(2, 4),
    },
    status,
  } as PublicReading;
}

test("阶段由 reading 与三家状态共同确定", () => {
  assert.equal(readingStage(reading("awaiting-throws", ["pending", "pending", "pending"])),
    "awaiting-throws");
  assert.equal(readingStage(reading("charting", ["pending", "pending", "pending"])), "charting");
  assert.equal(readingStage(reading("writing", ["done", "writing", "pending"])), "writing");
  assert.equal(readingStage(reading("done", ["done", "done", "done"])), "done");
  assert.equal(readingStage(reading("failed", ["done", "failed", "done"])), "failed");
});

test("排盘或任一家仍落笔时需要轮询", () => {
  assert.equal(shouldPollReading(reading("charting", ["pending", "pending", "pending"])), true);
  assert.equal(shouldPollReading(reading("done", ["done", "writing", "done"])), true);
  assert.equal(shouldPollReading(reading("done", ["done", "done", "done"])), false);
  assert.equal(shouldPollReading(reading("failed", ["done", "failed", "rejected"])), false);
});

test("合议只平均已完成且有输出的家", () => {
  const value = reading("writing", ["done", "failed", "done"]);
  assert.equal(consensusTenths(value.schools), 5);
  const none = reading("writing", ["pending", "failed", "rejected"]);
  assert.equal(consensusTenths(none.schools), undefined);
});
```

- [ ] **Step 2: 写六掷状态机失败测试**

```ts
// tests/frontend-throw-machine.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  initialThrowState,
  reduceThrow,
  type ThrowMachineState,
} from "../web/lib/throw-machine.js";
import type { RecordedThrow } from "../src/sanyi/throws.js";

const result: RecordedThrow = {
  index: 1,
  coins: [1, 0, 0] as const,
  backs: 1,
  value: 7,
  name: "单" as const,
  moving: false,
  blockNumber: "8",
  blockHash: `0x${"ab".repeat(32)}` as `0x${string}`,
  blockTimestamp: "1790770501",
};

test("按住、松开、落钱与记录依次推进", () => {
  let state: ThrowMachineState = initialThrowState([]);
  state = reduceThrow(state, { type: "press" });
  assert.equal(state.phase, "shaking");
  state = reduceThrow(state, { type: "release" });
  assert.equal(state.phase, "landing");
  state = reduceThrow(state, { type: "resolved", result });
  assert.equal(state.phase, "recorded");
  assert.equal(state.throws.length, 1);
  state = reduceThrow(state, { type: "ready" });
  assert.equal(state.phase, "idle");
  assert.equal(state.nextIndex, 2);
});

test("第六掷后完成，完成态不能再摇", () => {
  const previous = Array.from({ length: 5 }, (_, index) => ({
    ...result,
    index: index + 1,
  }));
  let state = reduceThrow(initialThrowState(previous), { type: "press" });
  state = reduceThrow(state, { type: "release" });
  state = reduceThrow(state, { type: "resolved", result: { ...result, index: 6 } });
  assert.equal(state.phase, "complete");
  assert.equal(reduceThrow(state, { type: "press" }), state);
});

test("Arc 不可用时暂停并从原掷序恢复", () => {
  let state = reduceThrow(initialThrowState([result]), { type: "press" });
  state = reduceThrow(state, { type: "release" });
  state = reduceThrow(state, { type: "pause", message: "未能取得天时" });
  assert.equal(state.phase, "paused");
  assert.equal(state.nextIndex, 2);
  state = reduceThrow(state, { type: "resume" });
  assert.equal(state.phase, "idle");
  assert.equal(state.throws.length, 1);
});

test("过期响应与非法转换不改状态", () => {
  const state = initialThrowState([]);
  assert.equal(reduceThrow(state, { type: "release" }), state);
  const landing = reduceThrow(reduceThrow(state, { type: "press" }), { type: "release" });
  assert.equal(reduceThrow(landing, { type: "resolved", result: { ...result, index: 2 } }), landing);
});
```

- [ ] **Step 3: 运行 RED**

Run: `node --import tsx --test tests/frontend-reading-state.test.ts \
  tests/frontend-throw-machine.test.ts`

Expected: FAIL，两个纯逻辑模块尚不存在。

- [ ] **Step 4: 实现结果页阶段纯函数**

```ts
// web/lib/reading-state.ts
import type { PublicReading } from "./api.js";

export type ReadingStage = "awaiting-throws" | "charting" | "writing" | "done" | "failed";
type Schools = PublicReading["schools"];

export function readingStage(reading: PublicReading): ReadingStage {
  if (reading.status === "awaiting-throws") {
    return "awaiting-throws";
  }
  if (reading.status === "charting") {
    return "charting";
  }
  if (reading.status === "failed") {
    return "failed";
  }
  const states = Object.values(reading.schools).map((school) => school.status);
  if (states.some((status) => status === "pending" || status === "writing")) {
    return "writing";
  }
  return reading.status === "done" ? "done" : "writing";
}

export function shouldPollReading(reading: PublicReading): boolean {
  if (reading.status === "charting" || reading.status === "writing") {
    return true;
  }
  return Object.values(reading.schools).some((school) => {
    return school.status === "pending" || school.status === "writing";
  });
}

export function consensusTenths(schools: Schools): number | undefined {
  const values = Object.values(schools).flatMap((school) => {
    return school.status === "done" && school.output
      ? [school.output.confidenceTenths]
      : [];
  });
  if (!values.length) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
```

- [ ] **Step 5: 实现六掷纯状态机**

```ts
// web/lib/throw-machine.ts
import type { ThrowResult } from "./api.js";

export type ThrowPhase =
  | "idle"
  | "shaking"
  | "landing"
  | "recorded"
  | "paused"
  | "complete";

export interface ThrowMachineState {
  phase: ThrowPhase;
  throws: readonly ThrowResult[];
  nextIndex: number;
  message?: string;
}

export type ThrowAction =
  | { type: "press" }
  | { type: "release" }
  | { type: "resolved"; result: ThrowResult }
  | { type: "ready" }
  | { type: "pause"; message: string }
  | { type: "resume" };

export function initialThrowState(throws: readonly ThrowResult[]): ThrowMachineState {
  const ordered = [...throws].sort((left, right) => left.index - right.index);
  return {
    phase: ordered.length >= 6 ? "complete" : "idle",
    throws: ordered,
    nextIndex: Math.min(ordered.length + 1, 6),
  };
}

export function reduceThrow(
  state: ThrowMachineState,
  action: ThrowAction,
): ThrowMachineState {
  if (action.type === "press" && state.phase === "idle") {
    const next = { ...state };
    delete next.message;
    return { ...next, phase: "shaking" };
  }
  if (action.type === "release" && state.phase === "shaking") {
    return { ...state, phase: "landing" };
  }
  if (action.type === "resolved" && state.phase === "landing") {
    if (action.result.index !== state.nextIndex) {
      return state;
    }
    const throws = [...state.throws, action.result];
    return {
      phase: throws.length === 6 ? "complete" : "recorded",
      throws,
      nextIndex: Math.min(throws.length + 1, 6),
    };
  }
  if (action.type === "ready" && state.phase === "recorded") {
    return { ...state, phase: "idle" };
  }
  if (action.type === "pause" && state.phase === "landing") {
    return { ...state, phase: "paused", message: action.message };
  }
  if (action.type === "resume" && state.phase === "paused") {
    const next = { ...state };
    delete next.message;
    return { ...next, phase: "idle" };
  }
  return state;
}
```

- [ ] **Step 6: GREEN 与严格类型检查**

Run: `node --import tsx --test tests/frontend-reading-state.test.ts \
  tests/frontend-throw-machine.test.ts && npm run typecheck`

Expected: 7 tests PASS；纯逻辑文件不导入 React、DOM 或 `web/lib/wagmi.ts`。

### Task 28: 实现六掷交互、罗盘与卦象首屏

**Files:**
- Create: `web/components/CoinThrow.tsx`
- Create: `web/components/Luopan.tsx`
- Create: `web/components/HexagramFigure.tsx`
- Create: `web/components/FiveHexagrams.tsx`
- Create: `web/components/ThrowRecord.tsx`
- Create: `web/components/TermDisclosure.tsx`
- Create: `web/lib/term-definitions.ts`
- Create: `tests/frontend-luopan.test.ts`

- [ ] **Step 1: 写罗盘常量失败测试**

```ts
// tests/frontend-luopan.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { BAGUA, MOUNTAINS } from "../web/components/Luopan.js";

test("二十四山自午顺时针且恰为二十四个", () => {
  assert.equal(MOUNTAINS[0], "午");
  assert.equal(MOUNTAINS.length, 24);
  assert.equal(MOUNTAINS.join(""), "午丁未坤申庚酉辛戌乾亥壬子癸丑艮寅甲卯乙辰巽巳丙");
});

test("后天八卦离南在上并按顺时针排列", () => {
  assert.deepEqual(BAGUA.map(([name]) => name), ["离", "坤", "兑", "乾", "坎", "艮", "震", "巽"]);
});
```

- [ ] **Step 2: 实现 SVG 罗盘；不得从 DOM 命令式补画**

```tsx
// web/components/Luopan.tsx
import { createElement } from "react";

export const MOUNTAINS = [..."午丁未坤申庚酉辛戌乾亥壬子癸丑艮寅甲卯乙辰巽巳丙"] as const;
export const BAGUA = [
  ["离", "101"],
  ["坤", "000"],
  ["兑", "110"],
  ["乾", "111"],
  ["坎", "010"],
  ["艮", "001"],
  ["震", "100"],
  ["巽", "011"],
] as const;

const CENTER = 160;

function Trigram({ bits, index }: { bits: string; index: number }) {
  return (
    <g transform={`rotate(${index * 45} ${CENTER} ${CENTER})`}>
      {[...bits].map((bit, line) => {
        const y = CENTER - 108 - line * 6;
        return bit === "1" ? (
          <rect className="luopan-stroke" height="3" key={y} width="22" x="149" y={y} />
        ) : (
          <g key={y}>
            <rect className="luopan-stroke" height="3" width="9" x="149" y={y} />
            <rect className="luopan-stroke" height="3" width="9" x="162" y={y} />
          </g>
        );
      })}
    </g>
  );
}

export function Luopan() {
  return (
    <svg aria-hidden="true" className="luopan" viewBox="0 0 320 320">
      <g className="luopan-rotor">
        {[150, 126, 100].map((radius) => (
          <circle className="luopan-ring" cx={CENTER} cy={CENTER} key={radius} r={radius} />
        ))}
        {MOUNTAINS.map((mountain, index) => {
          const rotation = index * 15;
          return createElement(
            "g",
            { key: `${mountain}-${index}` },
            <text
              className={"子午卯酉".includes(mountain) ? "luopan-cardinal" : ""}
              dominantBaseline="central"
              textAnchor="middle"
              transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
              x={CENTER}
              y="22"
            >
              {mountain}
            </text>,
            <line
              className="luopan-tick"
              transform={`rotate(${rotation + 7.5} ${CENTER} ${CENTER})`}
              x1={CENTER}
              x2={CENTER}
              y1="10"
              y2="34"
            />,
          );
        })}
        {BAGUA.map(([name, bits], index) => (
          <Trigram bits={bits} index={index} key={name} />
        ))}
      </g>
    </svg>
  );
}
```

- [ ] **Step 3: 实现可复用卦画、五卦和六掷记录**

先建立五卦所需的就地说明最小边界；Task 29 会在同一字典补齐排盘术语。

```ts
// web/lib/term-definitions.ts
// 原文移植自基线 310afdc:web/app.tsx 第 415–740 行。
// 已统一中文间隔号并删除旧产品表述。
export const FIGURE_DEFINITIONS = {
  primary: "本卦由起出的六爻直接组成，用来陈列当前问题的起点。",
  mutual: "互卦抽取本卦二至五爻重新成卦，用来换一个角度看内部结构。",
  derived: "变卦只翻转老阴与老阳，呈现动爻改变后的结构。",
  opposite: "错卦把本卦每爻阴阳全反，作为反面条件的参照。",
  reversed: "综卦把六爻次序上下颠倒，作为位置互换后的参照。",
} as const;
```

```tsx
// web/components/TermDisclosure.tsx
export function TermDisclosure(props: {
  term: string;
  value?: string;
  definition: string;
  actual: string;
}) {
  return (
    <details className="term-disclosure">
      <summary>
        <span>{props.term}</span>
        {props.value ? <strong>{props.value}</strong> : null}
      </summary>
      <div>
        <p><b>是什么：</b>{props.definition}</p>
        <p><b>这一卦里：</b>{props.actual}</p>
      </div>
    </details>
  );
}
```

```tsx
// web/components/HexagramFigure.tsx
export function HexagramFigure(props: {
  lines: readonly boolean[];
  moving?: readonly number[];
  label: string;
  compact?: boolean;
}) {
  const moving = new Set(props.moving ?? []);
  return (
    <span
      aria-label={props.label}
      className={`hexagram-figure${props.compact ? " compact" : ""}`}
      role="img"
    >
      {[...props.lines].reverse().map((yang, index) => {
        const position = 6 - index;
        const classes = [yang ? "yang" : "yin", moving.has(position) ? "moving" : ""];
        return <i className={classes.filter(Boolean).join(" ")} key={position} />;
      })}
    </span>
  );
}
```

```tsx
// web/components/FiveHexagrams.tsx
import type { FiveHexagrams as Figures } from "../../src/oracle/liuyao-chart.js";
import { FIGURE_DEFINITIONS } from "../lib/term-definitions.js";
import { HexagramFigure } from "./HexagramFigure.js";
import { TermDisclosure } from "./TermDisclosure.js";

const ORDER = ["primary", "mutual", "derived", "opposite", "reversed"] as const;
const MOTTO = {
  primary: "为体",
  mutual: "探隐",
  derived: "测果",
  opposite: "警变",
  reversed: "观反",
} as const;

export function FiveHexagrams(props: {
  figures: Figures;
  moving: readonly number[];
}) {
  return (
    <div aria-label="本互变错综五卦" className="five-hexagrams">
      {ORDER.map((kind) => {
        const figure = props.figures[kind];
        return (
          <figure className={kind === "primary" ? "active" : ""} key={kind}>
            <HexagramFigure
              compact
              label={`${figure.label}${figure.name}`}
              lines={figure.yangLines}
              moving={kind === "primary" ? props.moving : []}
            />
            <figcaption>
              {figure.name}
              <small>{figure.label} · {MOTTO[kind]}</small>
            </figcaption>
            <TermDisclosure
              actual={`${figure.derivation}；这一卦为${figure.name}。`}
              definition={FIGURE_DEFINITIONS[kind]}
              term={figure.label}
            />
          </figure>
        );
      })}
    </div>
  );
}
```

```tsx
// web/components/ThrowRecord.tsx
import type { ThrowResult } from "../lib/api.js";

function lineName(index: number): string {
  return index === 1 ? "初爻" : index === 6 ? "上爻" : `${"一二三四五六"[index - 1]}爻`;
}

export function ThrowRecord({ throws }: { throws: readonly ThrowResult[] }) {
  return (
    <div aria-label="铜钱六掷记录" className="throw-record">
      <span className="label">铜钱六掷 · 火珠林法</span>
      {[...throws].reverse().map((item) => (
        <div className={item.moving ? "throw moving" : "throw"} key={item.index}>
          <span>{lineName(item.index)}</span>
          <span aria-label={`${item.backs}背`} className="coins">
            {item.coins.map((coin, index) => (
              <i className={coin === 1 ? "coin back" : "coin face"} key={index} />
            ))}
          </span>
          <span>
            {item.backs}背 · {item.name} · {item.value % 2 ? "阳" : "阴"}
            {item.moving ? " · 动" : ""}
          </span>
        </div>
      ))}
      <p className="legend">
        实心为背，空心为字。一背为单（少阳），二背为拆（少阴），
        三背为重（老阳，动），三字为交（老阴，动）。
      </p>
    </div>
  );
}
```

- [ ] **Step 4: 实现按住摇、松开落钱；指针和键盘共用同一状态机**

```tsx
// web/components/CoinThrow.tsx
import { useEffect, useReducer, useRef, type KeyboardEvent } from "react";
import { ApiError, api, type PublicReading } from "../lib/api.js";
import {
  initialThrowState,
  reduceThrow,
} from "../lib/throw-machine.js";
import { HexagramFigure } from "./HexagramFigure.js";
import { ThrowRecord } from "./ThrowRecord.js";

const ARC_MESSAGE = "未能取得天时（Arc 网络无响应），稍后可继续";

export function CoinThrow(props: {
  reading: PublicReading;
  onReading: (reading: PublicReading) => void;
}) {
  const [state, dispatch] = useReducer(
    reduceThrow,
    props.reading.throws,
    initialThrowState,
  );
  const held = useRef(false);
  const release = async () => {
    if (!held.current || state.phase !== "shaking") {
      return;
    }
    held.current = false;
    dispatch({ type: "release" });
    try {
      const result = await api.throwCoin(props.reading.id, state.nextIndex);
      dispatch({ type: "resolved", result });
      const reading = await api.getReading(props.reading.id);
      props.onReading(reading);
    } catch (caught) {
      const message = caught instanceof ApiError && [409, 503].includes(caught.status)
        ? caught.message || ARC_MESSAGE
        : ARC_MESSAGE;
      dispatch({ type: "pause", message });
    }
  };
  const press = () => {
    if (state.phase !== "idle") {
      return;
    }
    held.current = true;
    dispatch({ type: "press" });
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      press();
    }
  };
  const keyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      void release();
    }
  };
  useEffect(() => {
    if (state.phase !== "recorded") {
      return undefined;
    }
    const timer = window.setTimeout(() => dispatch({ type: "ready" }), 500);
    return () => window.clearTimeout(timer);
  }, [state.phase]);
  const lines = state.throws.map((item) => item.value % 2 === 1);
  const moving = state.throws.filter((item) => item.moving).map((item) => item.index);
  return (
    <section aria-live="polite" className="panel coin-throw">
      <h1>亲手六掷</h1>
      <p className="hint">卦从初爻向上长出；按住摇，松开落钱。</p>
      <HexagramFigure label={`已成${lines.length}爻`} lines={lines} moving={moving} />
      <button
        className={`throw-button ${state.phase === "shaking" ? "shaking" : ""}`}
        disabled={state.phase === "landing" || state.phase === "complete"}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onPointerCancel={() => void release()}
        onPointerDown={press}
        onPointerUp={() => void release()}
        type="button"
      >
        {state.phase === "shaking" ? "松手落钱" : `摇 · 第${state.nextIndex}掷`}
      </button>
      {state.phase === "paused" ? (
        <div className="throw-pause">
          <p className="error">{state.message}</p>
          <button
            className="button"
            onClick={() => dispatch({ type: "resume" })}
            type="button"
          >
            继续摇
          </button>
        </div>
      ) : null}
      {state.phase === "complete" ? <p className="good-text">六爻已成，正在排盘。</p> : null}
      <ThrowRecord throws={state.throws} />
    </section>
  );
}
```

- [ ] **Step 5: GREEN**

Run: `node --import tsx --test tests/frontend-luopan.test.ts && npm run typecheck`

Expected: 2 tests PASS；罗盘清单与样稿逐字符一致；六掷按钮的指针与键盘路径都只调用一次接口。

## Chunk 5B: 三家、排盘、五行、术语与事项修改

### Task 29: 实现结果页核心面板和旧说明文字移植

**Files:**
- Modify: `web/lib/term-definitions.ts`
- Modify: `web/components/TermDisclosure.tsx`
- Create: `web/components/SchoolCard.tsx`
- Create: `web/components/ConsensusTrack.tsx`
- Create: `web/components/LiuyaoTable.tsx`
- Create: `web/components/FiveElementsDetail.tsx`
- Create: `web/components/SubjectChange.tsx`

- [ ] **Step 1: 建立术语定义与阅读引导纯函数**

```ts
// web/lib/term-definitions.ts
import type {
  LiuyaoChart,
  LiuyaoChartRow,
  SixRelation,
} from "../../src/oracle/liuyao-chart.js";

// 原文移植自基线 310afdc:web/app.tsx 第 415–740 行。
// 已统一中文间隔号并删除旧产品表述。
export const FIGURE_DEFINITIONS = {
  primary: "本卦由起出的六爻直接组成，用来陈列当前问题的起点。",
  mutual: "互卦抽取本卦二至五爻重新成卦，用来换一个角度看内部结构。",
  derived: "变卦只翻转老阴与老阳，呈现动爻改变后的结构。",
  opposite: "错卦把本卦每爻阴阳全反，作为反面条件的参照。",
  reversed: "综卦把六爻次序上下颠倒，作为位置互换后的参照。",
} as const;

export const TERM_DEFINITIONS = {
  卦宫: "八宫法把六十四卦归入乾坎艮震巽离坤兑，并标记本宫、世数、游魂或归魂。",
  宫序: "宫序记录本卦从本宫卦逐爻变化所得的位置，并据此确定世应。",
  世应: "世爻代表提问者自己，应爻代表与之相对的对象、环境或外部条件。",
  六神: "青龙、朱雀、勾陈、螣蛇、白虎、玄武随日干轮排，是传统象征名。",
  六亲: "父母、子孙、官鬼、妻财、兄弟由爻支五行与卦宫五行的生克关系确定。",
  伏神: "本卦缺少某类六亲时，按本宫首卦相同爻位补出的隐藏六亲。",
  旬空: "六十甲子每旬有两个未配到天干的地支，称旬空；这里只作排盘标记。",
  月建: "月建按太阳节气划月，不按公历每月一日切换，用来判断月令强弱与月破。",
  旺衰: "旺相休囚死是节气月下的五级强弱标签，不单独等于吉凶。",
  冲破: "月建冲爻为月破；日辰冲休囚静爻为日破，冲旺相静爻为暗动。",
  动变: "动爻翻转阴阳形成变爻，并可出现回头生克和固定进退神关系。",
} as const;

export const RELATION_DEFINITIONS: Record<SixRelation, string> = {
  父母: "六亲之一，常用于房产、单位与文书契约。",
  子孙: "六亲之一，常用于技术、医药、解忧与子女。",
  官鬼: "六亲之一，常用于工作、官职、疾病与忧虑。",
  妻财: "六亲之一，常用于钱财、物价、货品与债务。",
  兄弟: "六亲之一，常用于同辈、朋友、同事与竞争者。",
};

export function lineName(position: number): string {
  return position === 1 ? "初爻" : position === 6 ? "上爻" : `${"一二三四五六"[position - 1]}爻`;
}

function positions(rows: readonly LiuyaoChartRow[]): string {
  return rows.length ? rows.map((row) => lineName(row.position)).join("、") : "本卦明爻未出现";
}

export function readingGuide(chart: LiuyaoChart): readonly { title: string; text: string }[] {
  const focus = chart.focus;
  const useRows = chart.rows.filter((row) => row.primary.relation === focus?.useGod);
  const strong = chart.rows.filter((row) => ["旺", "相"].includes(row.primary.strength));
  const role = (relation?: SixRelation) => positions(
    chart.rows.filter((row) => row.primary.relation === relation),
  );
  const movement = chart.rows.filter((row) => row.changing || row.isHiddenMoving).map((row) => {
    const suffix = [row.advanceRetreat, row.returnEffect].filter(Boolean).join("、");
    return `${lineName(row.position)}${row.isHiddenMoving ? "暗动" : "动"}${suffix ? `，${suffix}` : ""}`;
  });
  return [
    {
      title: "用神",
      text: `本题先看${focus?.useGod ?? "未定用神"}：${positions(useRows)}。`,
    },
    {
      title: "旺衰",
      text: `${chart.month.branch}月属${chart.month.element}，旺相爻在${positions(strong)}；强弱不单独等于吉凶。`,
    },
    {
      title: "原神、忌神、仇神",
      text: `原神在${role(focus?.originalGod)}；忌神在${role(focus?.tabooGod)}；仇神在${role(focus?.enemyGod)}。`,
    },
    {
      title: "世应",
      text: `世在${lineName(chart.shiPosition)}，应在${lineName(chart.yingPosition)}，先比较两处再下判断。`,
    },
    {
      title: "动变",
      text: movement.length ? movement.join("；") : "本卦无动爻或暗动爻，按静卦读取。",
    },
  ];
}
```

```tsx
// web/components/TermDisclosure.tsx
export function TermDisclosure(props: {
  term: string;
  value?: string;
  definition: string;
  actual: string;
}) {
  return (
    <details className="term-disclosure">
      <summary>
        <span>{props.term}</span>
        {props.value ? <strong>{props.value}</strong> : null}
      </summary>
      <div>
        <p><b>是什么：</b>{props.definition}</p>
        <p><b>这一卦里：</b>{props.actual}</p>
      </div>
    </details>
  );
}
```

- [ ] **Step 2: 实现三家卡片与合议线**

```tsx
// web/components/SchoolCard.tsx
import type { PublicReading } from "../lib/api.js";

type School = PublicReading["schools"][keyof PublicReading["schools"]];
const META = {
  chengyi: { seal: "程", name: "程颐", school: "义理派" },
  jingfang: { seal: "京", name: "京房", school: "纳甲六爻" },
  shaoyong: { seal: "邵", name: "邵雍", school: "梅花易数" },
} as const;

export function SchoolCard(props: {
  schoolKey: keyof typeof META;
  school: School;
  onRetry: () => void;
}) {
  const meta = META[props.schoolKey];
  const remaining = Math.max(0, 2 - props.school.retries);
  if (props.school.status === "pending" || props.school.status === "writing") {
    return (
      <article className="school-card pending">
        <span className="seal">{meta.seal}</span>
        <p>落笔中</p>
      </article>
    );
  }
  if (props.school.status === "failed" || props.school.status === "rejected") {
    const message = props.school.status === "failed"
      ? "此家暂未落笔"
      : "此家断语未通过盘面核对，暂不展示";
    return (
      <article className="school-card failed">
        <span className="seal">{meta.seal}</span>
        <div>
          <h3>{meta.name}<small>{meta.school}</small></h3>
          <p>{message}</p>
          <button className="button" disabled={remaining === 0} onClick={props.onRetry} type="button">
            {remaining ? `重试（还可 ${remaining} 次）` : "重试次数已用尽"}
          </button>
        </div>
      </article>
    );
  }
  const output = props.school.output;
  if (!output) {
    return null;
  }
  const tone = ["大吉", "吉"].includes(output.verdict)
    ? "good"
    : ["凶", "大凶"].includes(output.verdict) ? "bad" : "plain";
  return (
    <article className="school-card">
      <span className="seal">{meta.seal}</span>
      <div className="school-copy">
        <h3>{meta.name}<small>{meta.school}</small></h3>
        <p className={`school-verdict ${tone}`}>
          {output.verdict} · {output.headline}
          <small>{output.confidenceTenths}成</small>
        </p>
        <p className="school-reason">{output.reason}</p>
        <details>
          <summary>展开详断</summary>
          {output.sections.map((section) => (
            <section key={section.title}>
              <h4>{section.title}</h4>
              <p>{section.text}</p>
            </section>
          ))}
          {output.timing ? (
            <p><b>应期：</b>{output.timing.window}；条件：{output.timing.condition}</p>
          ) : null}
          <div><b>建议：</b><ul>{output.advice.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </details>
      </div>
    </article>
  );
}
```

```tsx
// web/components/ConsensusTrack.tsx
import type { PublicReading } from "../lib/api.js";
import { consensusTenths } from "../lib/reading-state.js";

const META = { chengyi: "程", jingfang: "京", shaoyong: "邵" } as const;

export function ConsensusTrack({ schools }: { schools: PublicReading["schools"] }) {
  const values = Object.entries(schools).flatMap(([key, school]) => {
    return school.status === "done" && school.output
      ? [{ key: key as keyof typeof META, value: school.output.confidenceTenths }]
      : [];
  });
  const average = consensusTenths(schools);
  return (
    <div aria-label="三家合议" className="consensus">
      <div className="consensus-track">
        {average === undefined ? null : (
          <span className="mean" style={{ left: `${average * 10}%` }}>
            <span>合议 约{average.toFixed(1)}成</span>
          </span>
        )}
        {values.map((item) => (
          <span className="pin" key={item.key} style={{ left: `${item.value * 10}%` }}>
            {META[item.key]}
          </span>
        ))}
      </div>
      <div className="consensus-scale"><span>断不成</span><span>断必成</span></div>
    </div>
  );
}
```

- [ ] **Step 3: 实现六爻宽表、标签和阅读引导**

```tsx
// web/components/LiuyaoTable.tsx
import type { LiuyaoChart, LiuyaoChartRow } from "../../src/oracle/liuyao-chart.js";
import {
  lineName,
  readingGuide,
  TERM_DEFINITIONS,
} from "../lib/term-definitions.js";
import { HexagramFigure } from "./HexagramFigure.js";
import { TermDisclosure } from "./TermDisclosure.js";

function tags(row: LiuyaoChartRow, chart: LiuyaoChart): readonly string[] {
  const focus = chart.focus;
  return [
    row.primary.strength,
    row.primary.relation === focus?.useGod ? "用神" : "",
    row.primary.relation === focus?.originalGod ? "原神" : "",
    row.primary.relation === focus?.tabooGod ? "忌神" : "",
    row.primary.relation === focus?.enemyGod ? "仇神" : "",
    row.primary.isVoid ? "旬空" : "",
    row.primary.isMonthBroken ? "月破" : "",
    row.isDayBroken ? "日破" : "",
    row.isHiddenMoving ? "暗动" : "",
  ].filter(Boolean);
}

export function LiuyaoTable({ chart }: { chart: LiuyaoChart }) {
  const moving = chart.rows.filter((row) => row.changing).map((row) => row.position);
  const termItems = [
    [
      "卦宫",
      `${chart.palace.name}宫`,
      `本卦归${chart.palace.name}宫，宫五行为${chart.palace.element}。`,
    ],
    ["宫序", chart.palace.sequence, `本卦宫序为${chart.palace.sequence}。`],
    [
      "世应",
      `${lineName(chart.shiPosition)}、${lineName(chart.yingPosition)}`,
      "世应位置由宫序确定。",
    ],
    ["六神", chart.rows.map((row) => row.sixSpirit).join("、"), `${chart.day.stem}日起六神。`],
    ["六亲", "逐爻纳甲", `以${chart.palace.element}为我比较逐爻五行。`],
    ["伏神", chart.rows.some((row) => row.hidden) ? "有" : "无", "按本宫首卦同位补取。"],
    ["旬空", chart.day.voidBranches.join("、"), `${chart.day.ganzhi}日旬空如此。`],
    ["月建", `${chart.month.branch}月`, `${chart.month.range}，属${chart.month.element}。`],
    ["旺衰", "旺相休囚死", "逐爻标签来自当前节气月。"],
    ["冲破", "月破、日破、暗动", "三类标记分别计算，不互相替代。"],
    [
      "动变",
      moving.length ? moving.map(lineName).join("、") : "无动爻",
      "化出、回头生克与进退神见表。",
    ],
  ] as const;
  return (
    <section aria-labelledby="liuyao-title" className="panel liuyao-panel">
      <header className="panel-head">
        <h2 id="liuyao-title">六爻排盘</h2>
        <p>京房纳甲 · 八宫世应 · {chart.day.stem}日起六神</p>
      </header>
      <ol className="reading-guide">
        {readingGuide(chart).map((item) => (
          <li key={item.title}><strong>{item.title}</strong><p>{item.text}</p></li>
        ))}
      </ol>
      <div className="term-grid">
        {termItems.map(([term, value, actual]) => (
          <TermDisclosure
            actual={actual}
            definition={TERM_DEFINITIONS[term]}
            key={term}
            term={term}
            value={value}
          />
        ))}
      </div>
      <div aria-label="六爻排盘表，可横向滚动" className="chart-scroll" tabIndex={0}>
        <table className="chart">
          <thead>
            <tr>
              <th>六神</th><th>伏神</th><th>六亲纳甲</th><th>卦画</th>
              <th>世应</th><th>旺衰与角色</th><th>动变</th>
            </tr>
          </thead>
          <tbody>
            {[...chart.rows].reverse().map((row) => (
              <tr className={row.primary.relation === chart.focus?.useGod ? "use" : ""} key={row.position}>
                <td>{row.sixSpirit}</td>
                <td>
                  {row.hidden
                    ? `${row.hidden.relation}${row.hidden.stemBranch}${row.hidden.element}`
                    : "—"}
                </td>
                <td><b>{row.primary.relation}</b> {row.primary.stemBranch}{row.primary.element}</td>
                <td>
                  <HexagramFigure
                    compact
                    label={`${lineName(row.position)}${row.primaryYang ? "阳" : "阴"}`}
                    lines={[row.primaryYang]}
                    moving={row.changing ? [1] : []}
                  />
                </td>
                <td className="mark">{row.marker ?? "·"}</td>
                <td>
                  <span className="state">
                    {tags(row, chart).map((tag) => <i key={tag}>{tag}</i>)}
                  </span>
                </td>
                <td className="change">
                  {row.changing
                    ? `化出${row.changed.relation}${row.changed.stemBranch}${row.changed.element}`
                    : "—"}
                  {row.returnEffect ? ` · ${row.returnEffect}` : ""}
                  {row.advanceRetreat ? ` · ${row.advanceRetreat}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="provenance">
        京房纳甲 · 八宫世应 · 六甲旬空；UTC+8 零点换日；月建按节气月；
        旺相休囚死依《三命通会》。排盘只陈列事实，不以单一标签直接判断吉凶。
      </footer>
    </section>
  );
}
```

- [ ] **Step 4: 移植五行相生环、相克星与逐爻来源说明**

```tsx
// web/components/FiveElementsDetail.tsx
import type { FiveElement, LiuyaoChart } from "../../src/oracle/liuyao-chart.js";
import { lineName } from "../lib/term-definitions.js";
import { TermDisclosure } from "./TermDisclosure.js";

// 原文与结构移植自基线 310afdc:web/app.tsx 第 552–646 行。
const POINTS: Record<FiveElement, { x: number; y: number }> = {
  木: { x: 140, y: 24 },
  火: { x: 238, y: 95 },
  土: { x: 201, y: 210 },
  金: { x: 79, y: 210 },
  水: { x: 42, y: 95 },
};
const GENERATES = [
  ["木", "火", "木生火"], ["火", "土", "火生土"], ["土", "金", "土生金"],
  ["金", "水", "金生水"], ["水", "木", "水生木"],
] as const;
const OVERCOMES = [
  ["木", "土", "木克土"], ["土", "水", "土克水"], ["水", "火", "水克火"],
  ["火", "金", "火克金"], ["金", "木", "金克木"],
] as const;

function relation(self: FiveElement, other: FiveElement): { name: string; explanation: string } {
  const generates = Object.fromEntries(GENERATES.map(([from, to]) => [from, to]));
  const overcomes = Object.fromEntries(OVERCOMES.map(([from, to]) => [from, to]));
  if (self === other) return { name: "兄弟", explanation: "与我同五行" };
  if (generates[other] === self) return { name: "父母", explanation: `${other}生${self}，是“生我”` };
  if (generates[self] === other) return { name: "子孙", explanation: `${self}生${other}，是“我生”` };
  if (overcomes[other] === self) return { name: "官鬼", explanation: `${other}克${self}，是“克我”` };
  return { name: "妻财", explanation: `${self}克${other}，是“我克”` };
}

export function FiveElementsDetail({ chart }: { chart: LiuyaoChart }) {
  return (
    <details className="panel five-elements-detail">
      <summary>五行生克与逐爻六亲来源</summary>
      <p>卦宫五行为{chart.palace.element}，在六亲比较里称“我”。</p>
      <svg aria-label="五行相生环与相克星" role="img" viewBox="0 0 280 238">
        <defs>
          <marker id="generate-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path d="M0,0 L7,3.5 L0,7 Z" />
          </marker>
          <marker id="overcome-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path d="M0,0 L7,3.5 L0,7 Z" />
          </marker>
        </defs>
        {GENERATES.map(([from, to, label]) => (
          <line
            className="generate-edge"
            key={label}
            markerEnd="url(#generate-arrow)"
            x1={POINTS[from].x}
            x2={POINTS[to].x}
            y1={POINTS[from].y}
            y2={POINTS[to].y}
          />
        ))}
        {OVERCOMES.map(([from, to, label]) => (
          <line
            className="overcome-edge"
            key={label}
            markerEnd="url(#overcome-arrow)"
            x1={POINTS[from].x}
            x2={POINTS[to].x}
            y1={POINTS[from].y}
            y2={POINTS[to].y}
          />
        ))}
        {(Object.keys(POINTS) as FiveElement[]).map((element) => (
          <g key={element} transform={`translate(${POINTS[element].x} ${POINTS[element].y})`}>
            <circle className={element === chart.palace.element ? "active" : ""} r="20" />
            <text dy="5" textAnchor="middle">{element}</text>
          </g>
        ))}
      </svg>
      <div className="term-grid">
        {[...chart.rows].reverse().map((row) => {
          const item = relation(chart.palace.element, row.primary.element);
          const focus = chart.focus;
          const role = row.primary.relation === focus?.useGod
            ? "用神自身"
            : row.primary.relation === focus?.originalGod ? "原神"
              : row.primary.relation === focus?.tabooGod ? "忌神"
                : row.primary.relation === focus?.enemyGod ? "仇神" : "一般爻";
          return (
            <TermDisclosure
              actual={`${lineName(row.position)}纳${row.primary.stemBranch}${row.primary.element}；${item.explanation}，`
                + `故为${item.name}。月令为${row.primary.strength}，本题作${role}观察；强弱不单独等于吉凶。`}
              definition="先以纳甲地支取得五行，再与卦宫之“我”比较，并接到节气月旺衰。"
              key={row.position}
              term={`${lineName(row.position)} · ${row.primary.element}`}
              value={`${row.primary.relation} · ${row.primary.strength}`}
            />
          );
        })}
      </div>
    </details>
  );
}
```

- [ ] **Step 5: 实现事项修改**

```tsx
// web/components/SubjectChange.tsx
import { useState } from "react";
import { QUESTION_SUBJECTS } from "../../src/oracle/question-classifier.js";
import { api, type PublicReading } from "../lib/api.js";

export function SubjectChange(props: {
  reading: PublicReading;
  onReading: (reading: PublicReading) => void;
}) {
  const [selected, setSelected] = useState(props.reading.subject.finalKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remaining = Math.max(0, 3 - props.reading.subject.changes);
  const jingfangBusy = ["pending", "writing"].includes(props.reading.schools.jingfang.status);
  const disabled = busy || remaining === 0 || jingfangBusy || selected === props.reading.subject.finalKey;
  const changeSelected = (value: string) => {
    const subject = QUESTION_SUBJECTS.find((item) => item.key === value);
    if (subject) {
      setSelected(subject.key);
    }
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      props.onReading(await api.changeSubject(props.reading.id, selected));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "事项未能修改");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="subject-change">
      <label htmlFor="subject-change">事项修改（还可 {remaining} 次）</label>
      <select
        id="subject-change"
        onChange={(event) => changeSelected(event.target.value)}
        value={selected}
      >
        {QUESTION_SUBJECTS.map((item) => (
          <option key={item.key} value={item.key}>{item.label}</option>
        ))}
      </select>
      <button
        className="button"
        disabled={disabled}
        onClick={() => void submit()}
        type="button"
      >
        确认修改
      </button>
      {jingfangBusy ? <p className="hint">京房正在落笔，完成后才可改事项。</p> : null}
      {remaining === 0 ? <p className="hint">本卦三次事项修改已用尽。</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
```

- [ ] **Step 6: 先不单独运行组件测试；Task 30 用真实引擎数据统一 RED/GREEN**

检查：本 Task 的 `.tsx` 组件只导入 `web/lib/api.ts` 类型和纯逻辑，不导入 `app.tsx`、
`PaymentButton.tsx`、Providers 或任何牵出 `web/lib/wagmi.ts` 的模块。

## Chunk 5C: 奇门、黄历、复算、页面编排与交叉验收
### Task 30: 实现附属面板并用真实引擎数据做组件回归

**Files:**
- Create: `web/components/QimenBoard.tsx`
- Create: `web/components/AlmanacPanel.tsx`
- Create: `web/components/VerifyPanel.tsx`
- Create: `tests/frontend-reading-components.test.ts`

- [ ] **Step 1: 实现奇门九宫；组件只展示服务端事实**

```tsx
// web/components/QimenBoard.tsx
import type { QimenResult } from "../../src/calendar/qimen.js";
const GRID = [
  "巽四", "离九", "坤二", "震三", "中五", "兑七", "艮八", "坎一", "乾六",
] as const;
const GOOD = new Set(["开门", "休门", "生门"]);
const BAD = new Set(["伤门", "死门", "惊门"]);
const HORSE_PALACE: Record<string, string> = { 寅: "艮八", 申: "坤二", 巳: "巽四", 亥: "乾六" };
const BRANCH_PALACE: Record<string, string> = {
  子: "坎一", 丑: "艮八", 寅: "艮八", 卯: "震三", 辰: "巽四", 巳: "巽四",
  午: "离九", 未: "坤二", 申: "坤二", 酉: "兑七", 戌: "乾六", 亥: "乾六",
};
function palaceLabel(value: string): string {
  return value === "中五" ? "中五（寄坤二）" : value;
}
function doorTone(door?: string): string {
  return door && GOOD.has(door) ? "good" : door && BAD.has(door) ? "bad" : "plain";
}
export function QimenBoard({ value }: { value: QimenResult }) {
  return (
    <section aria-labelledby="qimen-title" className="panel">
      <header className="panel-head">
        <h2 id="qimen-title">奇门时盘</h2>
        <p>
          {value.layout} · {value.method} · 值符{value.chiefStar}落{palaceLabel(value.chiefStarPalace)}
          · 值使{value.chiefDoor}落{palaceLabel(value.chiefDoorPalace)}
        </p>
      </header>
      <p className="hint">奇门按子时换日；仅作显示，不输入三家断语。</p>
      <div aria-label="奇门九宫，南上北下" className="qimen-board">
        {GRID.map((palace) => {
          const cell = value.palaces[palace];
          const voids = `${value.dayVoid}${value.hourVoid}`;
          const branches = Object.entries(BRANCH_PALACE)
            .filter(([, target]) => target === palace)
            .map(([branch]) => branch);
          const isVoid = branches.some((branch) => voids.includes(branch));
          const flags = [
            value.chiefStarPalace === palace || (value.chiefStarPalace === "中五" && palace === "坤二")
              ? "值符" : "",
            value.chiefDoorPalace === palace || (value.chiefDoorPalace === "中五" && palace === "坤二")
              ? "值使" : "",
            HORSE_PALACE[value.horse] === palace ? "驿马" : "",
            isVoid ? "空亡" : "",
          ].filter(Boolean);
          if (palace === "中五") {
            return (
              <div className="qimen-cell center" data-gua="中" key={palace}>
                <b>中五（寄坤二）</b>
                <small>天盘{cell.heavenStem ?? "—"} · 地盘{cell.earthStem}</small>
              </div>
            );
          }
          return (
            <div className="qimen-cell" data-gua={palace[0]} key={palace}>
              <span className={cell.god === "值符" ? "god chief" : "god"}>{cell.god}</span>
              <span className="heaven">{cell.heavenStem ?? "—"}</span>
              <span className="star">{cell.star}<small>{palace}宫</small></span>
              <span className="qimen-flags">{flags.map((flag) => <i key={flag}>{flag}</i>)}</span>
              <span className={`door ${doorTone(cell.door)}`}>{cell.door}</span>
              <span className="earth">{cell.earthStem}</span>
            </div>
          );
        })}
      </div>
      <p className="qimen-legend">
        吉门：开、休、生 · 凶门：伤、死、惊 · 平门：杜、景
        · 右上天盘干 · 右下地盘干
      </p>
    </section>
  );
}
```
- [ ] **Step 2: 实现黄历与复算面板**
```tsx
// web/components/AlmanacPanel.tsx
import type { AlmanacResult } from "../../src/calendar/almanac.js";
export function AlmanacPanel({ value }: { value: AlmanacResult }) {
  const rows = [
    ["建除 · 值神", `${value.dayOfficers.officer}日 · ${value.dayOfficers.deity}（${value.dayOfficers.path}）`],
    ["二十八宿", `${value.mansion.name} · ${value.mansion.palace}${value.mansion.guardian}`],
    ["冲煞", `${value.clash.description} · 煞${value.clash.direction}`],
    ["日家九星", value.almanac.nineStar],
    ["吉神方位", `喜神${value.almanac.joy} · 财神${value.almanac.wealth} · 福神${value.almanac.fortune}`],
    ["宜", value.almanac.suitable.join(" ")],
    ["忌", value.almanac.avoid.join(" ")],
    ["彭祖百忌", value.almanac.pengZu.join("；")],
  ] as const;
  return (
    <section aria-labelledby="almanac-title" className="panel">
      <header className="panel-head">
        <h2 id="almanac-title">当日黄历</h2>
        <p>{value.lunar.date} · {value.cycle.day}日</p>
      </header>
      <div className="almanac-grid">
        {rows.map(([label, text]) => (
          <div key={label}>
            <span className="label">{label}</span>
            <b className={label === "宜" ? "good" : label === "忌" ? "bad" : ""}>{text}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
```
```tsx
// web/components/VerifyPanel.tsx
import type { PublicReading } from "../lib/api.js";
function explorer(path: string): string {
  return `${__ARC_EXPLORER__.replace(/\/$/u, "")}/${path}`;
}
export function VerifyPanel({ reading }: { reading: PublicReading }) {
  return (
    <details className="panel verify-panel">
      <summary>复算信息</summary>
      <dl>
        <div><dt>规范化问题</dt><dd>{reading.question}</dd></div>
        <div>
          <dt>付款首笔交易</dt>
          <dd>
            <a href={explorer(`tx/${reading.payment.firstHash}`)} rel="noreferrer" target="_blank">
              Arcscan 查看
            </a>
          </dd>
        </div>
        {reading.throws.map((item) => (
          <div key={item.index}>
            <dt>第 {item.index} 掷区块 #{item.blockNumber}</dt>
            <dd>
              <a href={explorer(`block/${item.blockNumber}`)} rel="noreferrer" target="_blank">
                Arcscan 查看
              </a>
            </dd>
          </div>
        ))}
      </dl>
      <p>
        复算公式：keccak256(encodePacked("sanyi-throw-v1", 付款首笔交易哈希，
        区块哈希，规范化问题，掷序))，取最低三位；1 为背、0 为字。
      </p>
    </details>
  );
}
```
- [ ] **Step 3: 写完整组件回归测试**
```ts
// tests/frontend-reading-components.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import type { QimenResult } from "../src/calendar/qimen.js";
import type { PublicReading } from "../web/lib/api.js";
import { ConsensusTrack } from "../web/components/ConsensusTrack.js";
import { FiveElementsDetail } from "../web/components/FiveElementsDetail.js";
import { FiveHexagrams } from "../web/components/FiveHexagrams.js";
import { LiuyaoTable } from "../web/components/LiuyaoTable.js";
import { QimenBoard } from "../web/components/QimenBoard.js";
import { SchoolCard } from "../web/components/SchoolCard.js";
import { TermDisclosure } from "../web/components/TermDisclosure.js";
import { LINES, baseOutput, chart } from "./helpers/sample-question.js";
const forbidden = /易者|押钱|赔付|封存|・|[ぁ-ヿ]/u;
function school(status: string, confidenceTenths = 5) {
  return {
    status,
    retries: 0,
    output: { ...baseOutput, confidenceTenths },
  } as PublicReading["schools"]["chengyi"];
}
test("六爻表与五行详情锁定已核验第二爻", () => {
  const html = renderToStaticMarkup(createElement(
    "main",
    null,
    createElement(LiuyaoTable, { chart }),
    createElement(FiveElementsDetail, { chart }),
  ));
  assert.match(html, /官鬼/u);
  assert.match(html, /甲寅/u);
  assert.match(html, /旬空/u);
  assert.match(html, /克我/u);
  assert.match(html, /强弱不单独等于吉凶/u);
  assert.doesNotMatch(html, forbidden);
});
test("真实五卦和术语说明完整渲染", () => {
  const html = renderToStaticMarkup(createElement(
    "main",
    null,
    createElement(FiveHexagrams, {
      figures: deriveFiveHexagrams(LINES),
      moving: [1],
    }),
    createElement(TermDisclosure, {
      term: "旬空",
      value: "寅卯",
      definition: "六十甲子的空支。",
      actual: "这一卦为寅卯空。",
    }),
  ));
  assert.match(html, /本卦 · 为体/u);
  assert.match(html, /互卦 · 探隐/u);
  assert.match(html, /变卦 · 测果/u);
  assert.match(html, /错卦 · 警变/u);
  assert.match(html, /综卦 · 观反/u);
  assert.match(html, /是什么/u);
  assert.match(html, /这一卦里/u);
  assert.doesNotMatch(html, forbidden);
});
test("奇门 fixture 按南上北下渲染关键宫", () => {
  const path = new URL("./fixtures/qimen/20260930-2015.json", import.meta.url);
  const fixture = JSON.parse(readFileSync(path, "utf8")) as QimenResult;
  const html = renderToStaticMarkup(createElement(QimenBoard, { value: fixture }));
  assert.match(html, /data-gua="巽"[\s\S]*死门/u);
  assert.match(html, /data-gua="坤"[\s\S]*值符/u);
  assert.match(html, /data-gua="兑"[\s\S]*九天/u);
  assert.match(html, /奇门按子时换日/u);
  assert.doesNotMatch(html, forbidden);
});
test("合议线保留三家原始位置并显示算术平均", () => {
  const schools = {
    chengyi: school("done", 6),
    jingfang: school("done", 3),
    shaoyong: school("done", 4),
  } as PublicReading["schools"];
  const html = renderToStaticMarkup(createElement(ConsensusTrack, { schools }));
  assert.match(html, /left:60%/u);
  assert.match(html, /left:30%/u);
  assert.match(html, /left:40%/u);
  assert.match(html, /合议 约4\.3成/u);
});
test("SchoolCard 覆盖完成、落笔、失败和拒绝四种状态", () => {
  const html = [
    school("done"),
    school("writing"),
    school("failed"),
    school("rejected"),
  ].map((value) => renderToStaticMarkup(createElement(SchoolCard, {
    schoolKey: "chengyi",
    school: value,
    onRetry() {},
  }))).join("");
  assert.match(html, /展开详断/u);
  assert.match(html, /落笔中/u);
  assert.match(html, /此家暂未落笔/u);
  assert.match(html, /此家断语未通过盘面核对，暂不展示/u);
  assert.match(html, /还可 2 次/u);
  assert.doesNotMatch(html, forbidden);
});
```
- [ ] **Step 4: 运行 RED/GREEN 与类型检查**
Run: `node --import tsx --test tests/frontend-reading-components.test.ts && npm run typecheck`
Expected: 5 tests PASS；测试文件扩展名为 `.ts`，所有组件均以 `createElement` 创建，且没有导入任何会牵出
`web/lib/wagmi.ts` 的模块。

### Task 31: 编排完整结果页、补齐样式并交叉验收

**Files:**
- Modify: `web/pages/Reading.tsx`
- Modify: `web/styles/components.css`

- [ ] **Step 1: 用完整实现替换占位结果页**

```tsx
// web/pages/Reading.tsx
import { useCallback, useEffect, useState } from "react";
import { deriveFiveHexagrams } from "../../src/oracle/liuyao-chart.js";
import { AlmanacPanel } from "../components/AlmanacPanel.js";
import { CoinThrow } from "../components/CoinThrow.js";
import { ConsensusTrack } from "../components/ConsensusTrack.js";
import { FiveElementsDetail } from "../components/FiveElementsDetail.js";
import { FiveHexagrams } from "../components/FiveHexagrams.js";
import { HexagramFigure } from "../components/HexagramFigure.js";
import { LiuyaoTable } from "../components/LiuyaoTable.js";
import { Luopan } from "../components/Luopan.js";
import { QimenBoard } from "../components/QimenBoard.js";
import { SchoolCard } from "../components/SchoolCard.js";
import { ShikongBar, type ShikongView } from "../components/ShikongBar.js";
import { SubjectChange } from "../components/SubjectChange.js";
import { ThrowRecord } from "../components/ThrowRecord.js";
import { VerifyPanel } from "../components/VerifyPanel.js";
import { api, type PublicReading } from "../lib/api.js";
import { saveRecentReading } from "../lib/recent-readings.js";
import { readingStage, shouldPollReading } from "../lib/reading-state.js";
const SCHOOL_KEYS = ["chengyi", "jingfang", "shaoyong"] as const;
const SUBJECT_LABELS: Record<string, string> = {
  career: "工作、官职",
  wealth: "钱财、货品",
  relationship: "感情、婚姻",
  health: "健康、疾病",
  study: "学业、考试",
  travel: "出行、迁移",
};
function shikong(reading: PublicReading): ShikongView | undefined {
  const value = reading.almanac;
  if (!value) {
    return undefined;
  }
  return {
    solar: `${value.solar.text} 北京时间`,
    lunar: `${value.lunar.date} ${value.lunar.timeBranch}时 · ${value.lunar.moonPhase}`,
    pillars: `${value.pillars.join(" ")} · ${value.naYin.join(" ")}`,
    solarTerm: `${value.solarTerms.current} · ${value.solarTerms.hou} · ${value.solarTerms.wuHou}`,
    monthDay: `${value.cycle.monthBranch}月 · ${value.cycle.day}日 · 旬空${value.cycle.voidBranches.join("")}`,
    duty: `${value.dayOfficers.officer}日 · ${value.dayOfficers.deity}${value.dayOfficers.path}`,
  };
}
function Result(props: {
  reading: PublicReading;
  onReading: (reading: PublicReading) => void;
}) {
  const { reading } = props;
  const chart = reading.chart;
  if (!chart || !reading.lines || !reading.almanac || !reading.qimen) {
    return (
      <section className="panel">
        <h1>正在排盘</h1>
        <p className="hint">六爻已成，三家稍候。</p>
      </section>
    );
  }
  const figures = deriveFiveHexagrams(reading.lines);
  const moving = reading.lines.flatMap((value, index) => [6, 9].includes(value) ? [index + 1] : []);
  const primary = figures.primary;
  const retry = async (key: typeof SCHOOL_KEYS[number]) => {
    props.onReading(await api.retrySchool(reading.id, key));
  };
  return (
    <>
      <div className="reading-hero">
        <section aria-labelledby="hexagram-title" className="panel hexagram-panel">
          <div className="ask">
            <span className="label">
              所问之事 · {SUBJECT_LABELS[reading.subject.finalKey] ?? "其他"}
            </span>
            <p>{reading.question}</p>
          </div>
          <SubjectChange onReading={props.onReading} reading={reading} />
          <div className="hexagram-stage">
            <div className="luopan-wrap">
              <Luopan />
              <HexagramFigure
                label={`${primary.name}，${moving.map((value) => `第${value}爻动`).join("，")}`}
                lines={primary.yangLines}
                moving={moving}
              />
            </div>
            <div className="hexagram-title">
              <span className="label">本卦</span>
              <h1 id="hexagram-title">{primary.name}</h1>
              <p>
                动爻 {moving.length ? moving.join("、") : "无"} · 之卦
                <b>{figures.derived.name}</b>
              </p>
              <span className="tag">{chart.palace.name}宫 · {chart.palace.sequence}</span>
            </div>
          </div>
          <p className="judgement"><b>卦辞：</b>{primary.judgement}</p>
          <ThrowRecord throws={reading.throws} />
          <FiveHexagrams figures={figures} moving={moving} />
        </section>
        <section aria-labelledby="schools-title" className="panel">
          <header className="panel-head">
            <h2 id="schools-title">三家断语</h2>
            <p>同一卦、同一件事，三派独立落笔。</p>
          </header>
          <ConsensusTrack schools={reading.schools} />
          {SCHOOL_KEYS.map((key) => (
            <SchoolCard
              key={key}
              onRetry={() => void retry(key)}
              school={reading.schools[key]}
              schoolKey={key}
            />
          ))}
        </section>
      </div>
      <div className="reading-secondary">
        <div className="reading-column">
          <LiuyaoTable chart={chart} />
          <FiveElementsDetail chart={chart} />
        </div>
        <QimenBoard value={reading.qimen} />
      </div>
      <AlmanacPanel value={reading.almanac} />
      <VerifyPanel reading={reading} />
    </>
  );
}
export function Reading({ id }: { id: string }) {
  const [reading, setReading] = useState<PublicReading>();
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const value = await api.getReading(id);
      setReading(value);
      setError("");
      saveRecentReading({
        id: value.id,
        kind: value.kind,
        question: value.question,
        createdAt: value.createdAt,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "未能打开这一卦");
    }
  }, [id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!reading || !shouldPollReading(reading)) {
      return undefined;
    }
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => window.clearInterval(timer);
  }, [reading, refresh]);
  if (error) {
    return (
      <main className="page">
        <section className="panel error-panel">
          <h1>这一卦暂时打不开</h1>
          <p className="error">{error}</p>
          <a className="button" href="#/">返回首页</a>
        </section>
      </main>
    );
  }
  if (!reading) {
    return (
      <main className="page">
        <section aria-live="polite" className="panel">正在打开这一卦</section>
      </main>
    );
  }
  const stage = readingStage(reading);
  const view = shikong(reading);
  return (
    <main className="page">
      <header className="topbar">
        <span className="seal">问</span>
        <span className="brand">三易</span>
        <a href="#/">返回首页</a>
      </header>
      {view ? <ShikongBar data={view} /> : null}
      {reading.chart?.month.boundaryUncertain ? <p className="boundary-tag">月建 · 近交节</p> : null}
      {stage === "awaiting-throws" ? (
        <CoinThrow onReading={setReading} reading={reading} />
      ) : stage === "failed" && !reading.chart ? (
        <section className="panel">
          <h1>排盘未能完成</h1>
          <p className="error">{reading.error ?? "请稍后再试"}</p>
          <a className="button" href="#/">返回首页</a>
        </section>
      ) : (
        <Result onReading={setReading} reading={reading} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: 在 `components.css` 末尾追加结果页完整样式；所有色值只引用令牌**

```css
/* web/styles/components.css：追加 */
.reading-hero, .reading-secondary {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 26px;
  align-items: start;
}
.reading-secondary {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
}
.reading-column, .coin-throw, .throw-record, .school-copy, .term-grid {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.topbar a, .verify-panel a {
  margin-left: auto;
  color: var(--gold);
}
.boundary-tag, .good-text {
  width: fit-content;
  margin: 0;
  border: 1px solid var(--gold);
  color: var(--gold);
  padding: 4px 8px;
}
.ask p, .judgement {
  margin: 0;
  line-height: 1.8;
}
.ask p {
  font-size: 21px;
}
.subject-change {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.subject-change select {
  border: 1px solid var(--line-strong);
  background: var(--panel-2);
  color: var(--paper);
  padding: 8px;
}
.subject-change p {
  flex-basis: 100%;
  margin: 0;
}
.hexagram-stage {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 28px;
  align-items: center;
}
.luopan-wrap {
  position: relative;
  width: min(300px, 100%);
  aspect-ratio: 1;
}
.luopan {
  width: 100%;
  height: 100%;
}
.luopan-ring, .luopan-tick {
  fill: none;
  stroke: var(--line-strong);
}
.luopan-stroke {
  fill: var(--gold);
  opacity: 0.62;
}
.luopan text {
  fill: var(--muted);
  font-family: var(--serif);
  font-size: 12px;
}
.luopan text.luopan-cardinal {
  fill: var(--gold);
}
.luopan-wrap > .hexagram-figure {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.hexagram-title h1 {
  margin: 6px 0;
  font-family: var(--brush);
  font-size: clamp(44px, 6vw, 60px);
}
.hexagram-title b {
  color: var(--gold);
  font-family: var(--brush);
  font-size: 22px;
}
.hexagram-figure {
  display: grid;
  gap: 8px;
  width: 118px;
}
.hexagram-figure i {
  display: block;
  height: 10px;
}
.hexagram-figure .yang {
  background: var(--paper);
}
.hexagram-figure .yin {
  background: linear-gradient(90deg, var(--paper) 0 42%, transparent 42% 58%, var(--paper) 58% 100%);
}
.hexagram-figure .moving {
  background: var(--cinnabar);
}
.hexagram-figure.compact {
  width: 34px;
  gap: 3px;
}
.hexagram-figure.compact i {
  height: 4px;
}
.five-hexagrams {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.five-hexagrams figure {
  display: grid;
  justify-items: center;
  gap: 6px;
  min-width: 76px;
  margin: 0;
  padding: 10px;
  border: 1px solid var(--line);
}
.five-hexagrams figure.active {
  border-color: var(--line-strong);
  background: var(--gold-soft);
}
.five-hexagrams figcaption, .five-hexagrams small {
  display: grid;
  text-align: center;
}
.five-hexagrams figcaption {
  font-family: var(--brush);
}
.five-hexagrams small, .legend {
  color: var(--dim);
  font-family: var(--sans);
  font-size: 12px;
}
.throw {
  display: grid;
  grid-template-columns: 3.2em auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  color: var(--muted);
}
.throw.moving, .change, .school-verdict.bad, .almanac-grid .bad {
  color: var(--cinnabar);
}
.coins {
  display: flex;
  gap: 5px;
}
.coin {
  position: relative;
  width: 18px;
  height: 18px;
  border: 2px solid var(--gold);
  border-radius: 50%;
}
.coin::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  border: 1px solid var(--gold);
  background: var(--panel);
  content: "";
  transform: translate(-50%, -50%);
}
.coin.back {
  background: var(--gold);
}
.throw-button {
  min-width: 132px;
  min-height: 52px;
  border: 1px solid var(--gold);
  background: var(--gold-soft);
  color: var(--gold);
  cursor: pointer;
}
.throw-button.shaking {
  animation: coin-shake 180ms linear infinite alternate;
}
.consensus-track {
  position: relative;
  height: 44px;
  margin: 18px 12px 0;
  border-bottom: 2px solid var(--line-strong);
}
.consensus .mean {
  position: absolute;
  bottom: -12px;
  width: 1px;
  height: 24px;
  background: var(--paper);
}
.consensus .mean span {
  position: absolute;
  bottom: 28px;
  transform: translateX(-50%);
  white-space: nowrap;
}
.consensus .pin {
  position: absolute;
  bottom: -10px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-left: -10px;
  background: var(--seal-bg);
  color: var(--seal-text);
  font-family: var(--brush);
}
.consensus-scale {
  display: flex;
  justify-content: space-between;
  color: var(--dim);
}
.school-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.school-card h3, .school-card p {
  margin: 0;
}
.school-card h3 small, .school-verdict small {
  margin-left: 10px;
  color: var(--muted);
  font-size: 13px;
}
.school-verdict {
  font-family: var(--dynamic);
  font-size: 22px;
}
.school-verdict.good, .almanac-grid .good {
  color: var(--jade);
}
.school-reason {
  color: var(--muted);
  line-height: 1.8;
}
.chart-scroll {
  max-width: 100%;
  overflow-x: auto;
}
.chart {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}
.chart th, .chart td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  white-space: nowrap;
}
.chart tr.use td {
  background: var(--gold-soft);
}
.chart .mark {
  color: var(--gold);
  font-family: var(--brush);
  text-align: center;
}
.state {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.state i, .qimen-flags i {
  border: 1px solid var(--line-strong);
  color: var(--muted);
  font-style: normal;
  padding: 1px 5px;
}
.reading-guide {
  display: grid;
  gap: 8px;
  margin: 0;
}
.reading-guide p {
  margin: 2px 0 0;
  color: var(--muted);
}
.term-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
}
.term-disclosure {
  border-bottom: 1px solid var(--line);
  padding: 8px 0;
}
.term-disclosure summary {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  align-items: center;
  cursor: pointer;
}
.term-disclosure strong {
  color: var(--gold);
}
.term-disclosure p {
  color: var(--muted);
  line-height: 1.7;
}
.five-elements-detail > summary, .verify-panel > summary {
  min-height: 44px;
  cursor: pointer;
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 600;
}
.five-elements-detail svg {
  width: min(280px, 100%);
}
.five-elements-detail circle {
  fill: var(--panel-2);
  stroke: var(--line-strong);
}
.five-elements-detail circle.active {
  stroke: var(--gold);
}
.five-elements-detail text {
  fill: var(--paper);
}
.generate-edge {
  stroke: var(--gold);
}
.overcome-edge {
  stroke: var(--cinnabar);
}
.qimen-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--line-strong);
}
.qimen-cell {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto 1fr auto;
  gap: 4px 6px;
  min-height: 136px;
  padding: 10px;
  border: 1px solid var(--line);
  overflow: hidden;
}
.qimen-cell::before {
  position: absolute;
  right: -4px;
  bottom: -14px;
  color: var(--line);
  content: attr(data-gua);
  font-family: var(--brush);
  font-size: 72px;
}
.qimen-cell .heaven, .qimen-cell .earth {
  text-align: right;
}
.qimen-cell .star {
  grid-column: 1 / -1;
  color: var(--muted);
}
.qimen-cell .star small {
  margin-left: 6px;
  color: var(--dim);
}
.qimen-flags {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.door {
  font-family: var(--brush);
  font-size: 22px;
}
.door.good {
  color: var(--jade);
}
.door.bad {
  color: var(--cinnabar);
}
.god.chief, .qimen-flags i {
  color: var(--gold);
}
.qimen-cell.center {
  place-content: center;
  text-align: center;
}
.qimen-legend, .provenance {
  color: var(--dim);
  line-height: 1.7;
}
.almanac-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
}
.almanac-grid div {
  display: grid;
  gap: 4px;
  padding: 14px 16px 14px 0;
  border-bottom: 1px solid var(--line);
}
.verify-panel dl {
  display: grid;
  gap: 8px;
}
.verify-panel dl div {
  display: grid;
  grid-template-columns: minmax(8em, auto) minmax(0, 1fr);
  gap: 12px;
}
@keyframes coin-shake {
  from { transform: rotate(-2deg); }
  to { transform: rotate(2deg); }
}
@media (prefers-reduced-motion: no-preference) {
  .luopan-rotor {
    animation: luopan-turn 240s linear infinite;
    transform-origin: 160px 160px;
  }
  @keyframes luopan-turn {
    to { transform: rotate(360deg); }
  }
}
@media (prefers-reduced-motion: reduce) {
  .throw-button.shaking, .luopan-rotor {
    animation: none;
  }
}
@media (max-width: 980px) {
  .reading-hero, .reading-secondary {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 620px) {
  .hexagram-stage {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }
  .qimen-cell {
    min-height: 120px;
    padding: 7px;
  }
  .qimen-cell::before {
    font-size: 54px;
  }
}
```

- [ ] **Step 3: 运行 Chunk 5 全部定向测试**

Run: `node --import tsx --test tests/frontend-reading-state.test.ts \
  tests/frontend-throw-machine.test.ts tests/frontend-luopan.test.ts \
  tests/frontend-reading-components.test.ts`

Expected: 14 tests PASS、0 FAIL；六爻第二爻、奇门三个关键宫、三家四种状态、合议位置、术语两段说明和
文化禁词均由测试锁定。

- [ ] **Step 4: 严格类型、前端构建与产物文化扫描**

Run: `npm run typecheck && npm run frontend:build && npm run frontend:secrets`

Run: `! rg '易者|押钱|赔付|封存|・|[ぁ-ヿ]' web public \
  --glob '!fonts/OFL.txt'`

Expected: `tsc --noEmit`、构建与秘密扫描退出码均为 0；禁词与假名命中数为 0。

- [ ] **Step 5: 静态约束与超长行检查**

Run: `! awk 'length($0) > 110 { print FNR ":" length($0) ":" $0; bad=1 } END { exit bad }' \
  web/lib/reading-state.ts web/lib/throw-machine.ts web/components/*.tsx \
  web/pages/Reading.tsx tests/frontend-reading-state.test.ts \
  tests/frontend-throw-machine.test.ts tests/frontend-luopan.test.ts \
  tests/frontend-reading-components.test.ts`

Expected: 0 行超过 110 字符；若字符串、正则或 CSS 长值确需豁免，先手工确认只属于硬性要求允许的三类，
再在验收记录中逐行列出，不得静默忽略。

- [ ] **Step 6: 浏览器人工验收**

在 390px、980px、981px 三个视口逐项核对：

1. 390px 页面本身无横向滚动，六爻表只在 `.chart-scroll` 内横向滚动；正文不小于 14px。
2. 980px 为单列，981px 为“卦象｜三家”和“排盘｜奇门”双列。
3. 指针按住与空格／回车按住均进入摇晃，松开只落一次；按钮及所有 summary、链接、选择器不小于 44px。
4. 系统开启减少动态效果后，罗盘与摇钱动画静止，内容、落钱请求和状态提示不受影响。
5. 第六掷完成后先见排盘，三家逐家落笔；单家失败、核对拒绝、重试用尽不遮挡另两家。
6. 修改事项只令京房重写；京房落笔中入口禁用并解释；三次用尽后入口持续禁用。
7. 卦时栏使用第一掷时间；近交节显示标签；奇门明确写“奇门按子时换日”。
8. 黄历宜忌展示完整数组；复算面板默认折叠，展开后有一笔交易和六个区块的 Arcscan 链接。

- [ ] **Step 7: 对照规范与计划边界**

逐项核对 `six-throw-casting`、`question-three-schools`、`shikong-almanac-qimen`、`ink-night-theme`、
`reading-archive`、`rich-liuyao-question-chart`、`explicit-five-elements` 的每个结果页 Scenario。确认：

- 盘面事实由程序生成，奇门与黄历不进入三家输入；页面没有自行推断吉凶或应期。
- 旧说明文字已经就地移植，五行生克、逐爻六亲来源和五步阅读引导没有因改版丢失。
- `openspec/changes/sanyi-chinese-redesign/tasks.md` 仍只在 Chunk 6 全量验收后统一更新。
- 本 Chunk 不提交；执行者按用户当次指示决定是否在后续 Chunk 提交。

## Chunk 6: 清理与验收

> 本 Chunk 覆盖 OpenSpec 任务 0.3、1.13–1.15。删除遵循“先证后删”：每组先用精确的
> `.js` 导入路径检查删除集合之外的引用，只有所有命令均无输出时才执行 `git rm`。任何命中都先判断
> 引用方是否也应删除；若不在本计划删除清单内，立即停止该组，不得靠改成宽泛 glob 或强删绕过。
> 合约、探测、回放、消融、封存演示相关的全部 `src/`、`scripts/` 与测试均不在本 Chunk 删除范围。

### Task 32: 逐组复查并删除旧网站遗留

**Files:**
- Delete: `src/demo/service.ts`
- Delete: `src/demo/arc-driver.ts`
- Delete: `src/demo/mock-driver.ts`
- Delete: `src/demo/rehearsal.ts`
- Delete: `src/demo/human-proposition.ts`
- Delete: `src/demo/predicate.ts`
- Delete: `src/demo/provider.ts`
- Delete: `scripts/run-frontend-mock.ts`
- Delete: `scripts/recover-demo.ts`
- Delete: `src/oracle/question-interpreter.ts`
- Delete: `src/frontend/data.ts`
- Delete: `src/frontend/domain.ts`
- Delete: `web/styles.css`
- Delete: `tests/demo-*.test.ts`
- Delete: `tests/human-proposition.test.ts`
- Delete: `tests/question-interpreter.test.ts`
- Delete: `tests/frontend-data.test.ts`
- Delete: `tests/frontend-domain.test.ts`
- Delete: `tests/frontend-content.test.ts`
- Modify: `tests/frontend-wallet.test.ts`（仅当存在只覆盖旧押注流程的用例）

- [ ] **Step 1: 锁定必须保留的边界（3 分钟）**

Run:

```bash
test -f src/frontend/wallet.ts && test -f src/frontend/abis.ts \
  && test -f tests/frontend-wallet.test.ts \
  && test -f src/demo/secret-scan.ts \
  && test -f src/oracle/question-oracle.ts \
  && rg -n 'QuestionBlockSource|QuestionFeeVerifier' src/sanyi src/frontend tests
```

Expected: 命令退出码为 0；最后一条至少显示新服务对 `QuestionBlockSource` 或
`QuestionFeeVerifier` 的引用。`src/agent/provider.ts`、合约、探测、回放、消融与封存演示文件保持不动。

- [ ] **Step 2: 确认服务端已经脱离旧模块（2 分钟）**

Run:

```bash
rg -n 'demo/|frontend/data\.js|question-interpreter\.js' src/frontend/server.ts
```

Expected: 无输出、退出码 1；已改写的服务端不得再导入旧演示层、旧前端数据或旧问轨解读器。
若有输出，先回到 Task 18 完成服务端改写，不得开始删除。

- [ ] **Step 3: 由外向内复查并删除旧脚本（4 分钟）**

Run:

```bash
rg -n 'scripts/run-frontend-mock\.js|run-frontend-mock\.js' scripts src tests web \
  --glob '!scripts/run-frontend-mock.ts'
rg -n 'scripts/recover-demo\.js|recover-demo\.js' scripts src tests web \
  --glob '!scripts/recover-demo.ts'
```

Expected: 两条命令均无输出、退出码 1。`package.json` 中同名脚本键不是 TS 导入，留到 Task 33 删除。

Run:

```bash
git rm scripts/run-frontend-mock.ts scripts/recover-demo.ts
npm test
npm run typecheck
```

Expected: 两个旧脚本被删除；全量测试 PASS，类型检查退出码 0。

- [ ] **Step 4: 复查并删除旧问轨解读及其测试（4 分钟）**

Run:

```bash
rg -n 'src/oracle/question-interpreter\.js|oracle/question-interpreter\.js' scripts src tests web \
  --glob '!src/oracle/question-interpreter.ts' --glob '!tests/question-interpreter.test.ts'
```

Expected: 无输出、退出码 1；不得误删 `src/oracle/question-oracle.ts` 及其测试。

Run:

```bash
git rm src/oracle/question-interpreter.ts tests/question-interpreter.test.ts
npm test
npm run typecheck
```

Expected: 只删除旧解读器及其测试；全量测试 PASS，类型检查退出码 0。

- [ ] **Step 5: 复查并删除旧前端数据层及其测试（4 分钟）**

Run:

```bash
rg -n 'src/frontend/data\.js|frontend/data\.js' scripts src tests web \
  --glob '!src/frontend/data.ts' --glob '!tests/frontend-data.test.ts'
rg -n 'src/frontend/domain\.js|frontend/domain\.js' scripts src tests web \
  --glob '!src/frontend/domain.ts' --glob '!tests/frontend-domain.test.ts'
```

Expected: 两条命令均无输出、退出码 1。

Run:

```bash
git rm src/frontend/data.ts src/frontend/domain.ts \
  tests/frontend-data.test.ts tests/frontend-domain.test.ts
npm test
npm run typecheck
```

Expected: 旧数据层及对应测试被删除；全量测试 PASS，类型检查退出码 0。

- [ ] **Step 6: 逐个复查旧演示层的精确导入路径（5 分钟）**

旧脚本、旧问轨解读和旧前端数据层此时均已删除。以下每条命令的 Expected 均为无输出、退出码 1；
排除项只覆盖本组七个候选及随本组删除的测试，任何输出都代表仍有本组之外的调用者：

```bash
rg -n 'src/demo/service\.js|demo/service\.js' scripts src tests web \
  --glob '!src/demo/{service,arc-driver,mock-driver,rehearsal,human-proposition,predicate,provider}.ts' \
  --glob '!tests/demo-*.test.ts'
rg -n 'src/demo/arc-driver\.js|demo/arc-driver\.js' scripts src tests web \
  --glob '!src/demo/{service,arc-driver,mock-driver,rehearsal,human-proposition,predicate,provider}.ts' \
  --glob '!tests/demo-*.test.ts'
rg -n 'src/demo/mock-driver\.js|demo/mock-driver\.js' scripts src tests web \
  --glob '!src/demo/{service,arc-driver,mock-driver,rehearsal,human-proposition,predicate,provider}.ts' \
  --glob '!tests/demo-*.test.ts'
rg -n 'src/demo/rehearsal\.js|demo/rehearsal\.js' scripts src tests web \
  --glob '!src/demo/{service,arc-driver,mock-driver,rehearsal,human-proposition,predicate,provider}.ts' \
  --glob '!tests/demo-*.test.ts'
rg -n 'src/demo/human-proposition\.js|demo/human-proposition\.js' scripts src tests web \
  --glob '!src/demo/{service,arc-driver,mock-driver,rehearsal,human-proposition,predicate,provider}.ts' \
  --glob '!tests/human-proposition.test.ts' --glob '!tests/demo-*.test.ts'
rg -n 'src/demo/predicate\.js|demo/predicate\.js' scripts src tests web \
  --glob '!src/demo/{service,arc-driver,mock-driver,rehearsal,human-proposition,predicate,provider}.ts' \
  --glob '!tests/demo-*.test.ts'
rg -n 'src/demo/provider\.js|demo/provider\.js' scripts src tests web \
  --glob '!src/demo/{service,arc-driver,mock-driver,rehearsal,human-proposition,predicate,provider}.ts' \
  --glob '!tests/demo-*.test.ts'
```

最后一条只匹配 `demo/provider.js`，不得把 `src/agent/provider.ts` 或 `agent/provider.js` 算入删除范围。

- [ ] **Step 7: 删除旧演示层及其测试并立刻回归（5 分钟）**

Run:

```bash
git rm src/demo/service.ts src/demo/arc-driver.ts src/demo/mock-driver.ts \
  src/demo/rehearsal.ts src/demo/human-proposition.ts src/demo/predicate.ts \
  src/demo/provider.ts tests/demo-*.test.ts tests/human-proposition.test.ts
npm test
npm run typecheck
```

Expected: `git rm` 只删除列出的旧演示层和对应测试；`npm test` 全部 PASS，`tsc --noEmit` 退出码 0。
若 glob 没有匹配文件，先用 `git ls-files 'tests/demo-*.test.ts'` 核对，不得加 `--ignore-unmatch` 掩盖差异。

- [ ] **Step 8: 复查并删除旧样式与旧内容测试（4 分钟）**

Run:

```bash
rg -n '\./styles\.css"|web/styles\.css' scripts src tests web \
  --glob '!web/styles.css' --glob '!tests/frontend-content.test.ts'
rg -n 'tests/frontend-content\.test\.js|frontend-content\.test\.js' scripts src tests web \
  --glob '!tests/frontend-content.test.ts'
```

Expected: 两条命令均无输出、退出码 1；旧测试中仍适用的秘密、环境变量入口、助记词和账户派生断言
已经由 `src/demo/secret-scan.ts` 与 Task 34 的新守卫承接。

Run:

```bash
git rm web/styles.css tests/frontend-content.test.ts
npm test
npm run typecheck
```

Expected: 旧总样式和旧内容测试被删除；全量测试 PASS，类型检查退出码 0。

- [ ] **Step 9: 审计删除与保留集合（3 分钟）**

Run:

```bash
git diff --name-status -- src scripts tests web
test -f src/frontend/wallet.ts && test -f src/frontend/abis.ts \
  && test -f tests/frontend-wallet.test.ts && test -f src/demo/secret-scan.ts \
  && test -f src/oracle/question-oracle.ts
```

Expected: 删除项只来自本 Task 清单，五个必须保留的路径仍存在。检查 `tests/frontend-wallet.test.ts`：若有
只针对旧押注流程且已失去生产入口的用例，只删除这些用例并在执行记录中逐个写明测试名；新付款计划、
授权、余额、链切换和 EIP-5792 原子调用相关用例必须保留。

### Task 33: 更新包元数据、命令与忽略规则

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: 写元数据与脚本约束检查并确认当前状态不满足（3 分钟）**

Run:

```bash
node -e 'const p=require("./package.json"); if(p.name!=="sanyi")process.exit(1); \
if(p.description!=="三易：一问三家的中式命理")process.exit(1); \
for(const k of ["frontend:mock","demo:smoke:live","demo:recover"])if(k in p.scripts)process.exit(1); \
for(const k of ["font:charset","font:subset","demo:rehearse"])if(!(k in p.scripts))process.exit(1)'
```

Expected: FAIL；当前包名、描述、旧脚本或字体脚本至少一项不符合目标。

- [ ] **Step 2: 最小修改 `package.json`**

将顶层字段改为：

```json
"name": "sanyi",
"description": "三易：一问三家的中式命理"
```

删除 `frontend:mock`、`demo:smoke:live`、`demo:recover`，加入：

```json
"font:charset": "node --import tsx scripts/font-charset.ts",
"font:subset": ".venv-tools/bin/python scripts/subset-sanyi-font.py"
```

`demo:rehearse` 必须保持 Chunk 3 已定义的精确值：

```json
"demo:rehearse": "node --import tsx scripts/rehearse-demo.ts --mode=mock"
```

- [ ] **Step 3: 更新 `.gitignore` 并核对字体资产边界（3 分钟）**

确保 `.gitignore` 包含：

```gitignore
.venv-tools/
/data/
web/fonts/MaShanZheng-Regular.ttf
```

Run:

```bash
git check-ignore -q .venv-tools/bin/python
git check-ignore -q data/readings/example.json
git check-ignore -q web/fonts/MaShanZheng-Regular.ttf
! git check-ignore src/calendar/data/example.json
! git check-ignore web/fonts/mashanzheng-subset.woff2
! git check-ignore web/fonts/OFL.txt
! git check-ignore web/fonts/mashanzheng-chars.txt
```

Expected: 七条检查均退出码 0；只有根目录运行数据被忽略，`src/calendar/data/` 可入库；原始字体被忽略，
字体子集、许可证与固定字表可入库。

- [ ] **Step 4: 运行元数据检查、测试与类型检查（3 分钟）**

Run:

```bash
node -e 'const p=require("./package.json"); if(p.name!=="sanyi")process.exit(1); \
if(p.description!=="三易：一问三家的中式命理")process.exit(1); \
for(const k of ["frontend:mock","demo:smoke:live","demo:recover"])if(k in p.scripts)process.exit(1); \
for(const k of ["font:charset","font:subset","demo:rehearse"])if(!(k in p.scripts))process.exit(1)'
npm test
npm run typecheck
```

Expected: 元数据检查退出码 0；全量测试 PASS，类型检查退出码 0。

### Task 34: 建立新站文化守卫并扩展秘密扫描

**Files:**
- Create: `tests/frontend-sanyi-content.test.ts`
- Modify: `scripts/check-frontend-secrets.ts`
- Preserve: `src/demo/secret-scan.ts`

- [ ] **Step 1: 写完整文化守卫测试**

```ts
// tests/frontend-sanyi-content.test.ts
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html"]);
const CULTURE_FORBIDDEN = /[\u3040-\u30ff]|・|易者|身銭|筮竹|神社|高島|断易/u;
const VISIBLE_FORBIDDEN = /押钱|赔付|封存/u;
const REMOTE_FONT = /fonts\.(?:googleapis|gstatic)\.com/u;

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

async function sourceFiles(): Promise<string[]> {
  const [webFiles, sanyiFiles] = await Promise.all([walk("web"), walk("src/sanyi")]);
  return [...webFiles, ...sanyiFiles].filter((path) =>
    TEXT_EXTENSIONS.has(extname(path)) && !path.startsWith("web/dist/"));
}

async function assertNoMatch(paths: string[], pattern: RegExp, label: string): Promise<void> {
  const failures: string[] = [];
  for (const path of paths) {
    const text = await readFile(path, "utf8");
    if (pattern.test(text)) failures.push(relative(process.cwd(), path));
  }
  assert.deepEqual(failures, [], `${label}：${failures.join("、")}`);
}

test("文化扫描要求先生成 app.js 与 app.css", async () => {
  for (const path of ["web/dist/app.js", "web/dist/app.css"]) {
    await assert.doesNotReject(
      access(path),
      `缺少 ${path}；请先运行 npm run frontend:build`,
    );
  }
});

test("构建产物与源码不含日式文化残留", async () => {
  const paths = ["web/dist/app.js", "web/dist/app.css", ...await sourceFiles()];
  await assertNoMatch(paths, CULTURE_FORBIDDEN, "发现日式文化残留");
});

test("用户可见源码不含旧押注与归档文案", async () => {
  const paths = ["web/dist/app.js", "web/dist/app.css", ...(await sourceFiles()).filter((path) =>
    !path.startsWith("src/sanyi/schools/"))];
  await assertNoMatch(paths, VISIBLE_FORBIDDEN, "发现旧产品文案");
});

test("构建产物与源码不加载 Google Fonts", async () => {
  const paths = ["web/dist/app.js", "web/dist/app.css", ...await sourceFiles()];
  await assertNoMatch(paths, REMOTE_FONT, "发现外部字体地址");
});
```

其中 `CULTURE_FORBIDDEN` 的 `\u3040-\u30ff` 精确覆盖 Unicode U+3040–U+30FF 假名区间；
`src/sanyi/schools/` 只对“押钱／赔付／封存”三项禁止句豁免，不豁免假名、日式文化词或外部字体。

- [ ] **Step 2: 运行测试并确认 RED 信息明确（2 分钟）**

Run: `node --import tsx --test tests/frontend-sanyi-content.test.ts`

Expected: 在尚未完成新构建或仍有旧文案时 FAIL；若 `web/dist` 缺失，错误明确包含
`请先运行 npm run frontend:build`，而不是把缺失文件当作空文本跳过。

- [ ] **Step 3: 用以下完整内容替换秘密扫描脚本**

```ts
// scripts/check-frontend-secrets.ts
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import { scanFrontendSources } from "../src/demo/secret-scan.js";

const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".ts", ".tsx", ".txt"]);
const BINARY_EXTENSIONS = new Set([".woff", ".woff2", ".ttf", ".otf", ".png", ".jpg", ".webp"]);

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

const paths = (await walk("web")).filter((path) => {
  const extension = extname(path).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) return false;
  return TEXT_EXTENSIONS.has(extension);
});
const sources = await Promise.all(paths.map(async (path) => ({
  path,
  text: await readFile(path, "utf8"),
})));
const secrets = [
  { label: "Arc 签名秘密值", value: process.env.ARC_PRIVATE_KEY ?? "" },
  { label: "DeepSeek 凭据值", value: process.env.DEEPSEEK_API_KEY ?? "" },
];
const leaks = scanFrontendSources(sources, secrets);
if (leaks.length > 0) {
  for (const leak of leaks) {
    console.error(`前端秘密扫描失败：${leak.path}（${leak.reasons.join("、")}）`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `前端秘密扫描通过：${paths.length} 个浏览器源码或构建文件不含秘密值、` +
    "环境变量入口、助记词或账户派生入口",
  );
}
```

该实现递归覆盖 `web/dist/app.js`、`web/dist/app.css` 和所有前端文本源码；字体等二进制按扩展名跳过，
但 `web/fonts/OFL.txt` 与 `mashanzheng-chars.txt` 仍作为文本参与扫描。

- [ ] **Step 4: 构建后运行 GREEN 与回归（5 分钟）**

运行 `npm test` 前需先运行 `npm run frontend:build`，以生成文化守卫依赖的 `web/dist` 产物。

Run:

```bash
npm run frontend:build
node --import tsx --test tests/frontend-sanyi-content.test.ts
npm run frontend:secrets
npm test
npm run typecheck
```

Expected: 文化守卫 4 tests PASS；秘密扫描明确报告扫描到浏览器源码及构建文件且退出码 0；全量测试
PASS，类型检查退出码 0。若扫描命中，修改实际文案或资源引用，不得扩大豁免；唯一文案豁免仍是
`src/sanyi/schools/` 中用于约束模型的禁止句。

### Task 35: 编写里程碑 1A 用户验收手册

**Files:**
- Create: `docs/plans/2026-09-30-sanyi-1a-acceptance.md`

- [ ] **Step 1: 用以下完整内容新建验收文档**

```markdown
# 三易里程碑 1A 用户验收

## 启动准备

1. 在项目根目录准备 `.env`，至少填写 `DEEPSEEK_API_KEY` 和 `WALLETCONNECT_PROJECT_ID`。
2. 运行 `npm run frontend:dev`。
3. 浏览器打开 `http://127.0.0.1:4173`，使用 Arc Testnet 钱包和测试币验收。

如需运行 `npm test`，需先运行 `npm run frontend:build`，生成测试依赖的 `web/dist` 产物。

## 验收清单

每项通过后勾选；发现问题时记录页面、操作、实际结果和截图。

- [ ] **首页时空栏**
  - 怎么做：打开首页，等待时空信息载入，并与本机北京时间对照。
  - 应看到：公历、农历、四柱、节气、月建、日辰、旬空与值日信息齐全，时间按北京时间显示。

- [ ] **分类标签与改选**
  - 怎么做：输入一个具体问事，观察自动分类，再点击其它可用事项标签并改回。
  - 应看到：分类结果清楚；付款前可以改选，最终事项以最后一次选择为准。

- [ ] **未开放门类提示**
  - 怎么做：分别输入命理、运势、起名类问题或选择对应入口。
  - 应看到：三类均明确提示“尚未开放”及当前可用范围，不会进入收费或六掷流程。

- [ ] **付款一次确认**
  - 怎么做：选择可用问事并点击付款，连接 Arc Testnet 钱包，检查钱包确认内容。
  - 应看到：卦金为 0.05 USDC；正常路径只需一次用户确认，付款成功后进入六掷。

- [ ] **六掷交互与键盘操作**
  - 怎么做：分别用指针按住后松开、键盘 Space 和 Enter 完成六掷；尝试重复触发同一掷。
  - 应看到：按住时有摇卦状态，松开只落一次；自下而上累计六爻，重复操作不会多记。

- [ ] **排盘表、术语说明与阅读引导**
  - 怎么做：完成六掷，展开排盘及术语说明，按页面引导依次阅读。
  - 应看到：世应、六亲、六神、纳甲、旬空、月日旺衰可读；术语包含“是什么”和“这一卦里”，
    阅读引导能从本卦走到动爻、之卦和三家结果。

- [ ] **五行详情**
  - 怎么做：展开五行详情，抽查一爻的地支、五行、六亲来源和旺衰说明。
  - 应看到：生克关系与六亲来源明确，且提示强弱本身不等同于吉凶。

- [ ] **三家短断、详断与合议线**
  - 怎么做：等待程颐、京房、邵雍逐家完成，阅读短断并展开详断。
  - 应看到：三家可独立成功或失败；各自把握位置保留，合议线显示三家的算术平均。

- [ ] **修改事项只重跑京房**
  - 怎么做：记下三家内容，修改问事事项并确认，等待更新结束。
  - 应看到：程颐和邵雍内容不变，只有京房进入落笔并更新；次数限制和禁用原因清楚。

- [ ] **奇门九宫**
  - 怎么做：查看奇门时盘，找到死门、九天、中五宫及换日说明。
  - 应看到：九宫按南上北下排列；死门、九天可辨；中五明确“寄坤二”；页面注明子时换日。

- [ ] **黄历**
  - 怎么做：展开当日黄历并逐行查看。
  - 应看到：建除、值神、二十八宿、冲煞、九星、吉神方位、宜忌和彭祖百忌完整显示。

- [ ] **复算信息与 Arcscan**
  - 怎么做：展开复算信息，依次点击付款交易和六个掷卦区块链接。
  - 应看到：每个链接在 Arcscan 打开正确交易或区块，页面同时给出规范化问题和复算公式。

- [ ] **刷新与分享链接**
  - 怎么做：在结果页刷新；复制当前 `#/r/<id>` 链接到新标签页打开。
  - 应看到：两种方式均恢复同一卦、六掷与三家结果，不会重复收费或重新掷卦。

- [ ] **390px 手机布局**
  - 怎么做：把视口设为 390px，从首页走到完整结果页并左右滑动页面。
  - 应看到：页面本身没有横向滚动；六爻宽表只在自己的滚动容器内横向移动，按钮可正常操作。

- [ ] **断网时不改用本地随机**
  - 怎么做：进入六掷后断开网络，再尝试下一掷；恢复网络后重试。
  - 应看到：断网时摇卦暂停并解释网络问题，爻数与结果不变；不会生成本地随机结果，恢复后可继续。

## 验收结论

- [ ] 上述项目全部通过，可以勾选 OpenSpec 任务 1.15。
- 验收人：
- 验收日期：
- 未通过项或备注：
```

- [ ] **Step 2: 检查文档覆盖面（2 分钟）**

Run:

```bash
rg -n '首页时空栏|分类标签与改选|未开放门类提示|付款一次确认|六掷交互与键盘操作|排盘表|五行详情|三家短断|修改事项只重跑京房|奇门九宫|黄历|Arcscan|刷新与分享链接|390px|断网时不改用本地随机' \
  docs/plans/2026-09-30-sanyi-1a-acceptance.md
```

Expected: 15 个验收主题全部命中；每项均同时包含“怎么做”和“应看到”。

### Task 36: 全量验证、OpenSpec 收口与用户验收交接

**Files:**
- Modify: `openspec/changes/sanyi-chinese-redesign/tasks.md`
- Verify: `docs/plans/2026-09-30-sanyi-milestone-1a.md`
- Verify: `docs/plans/2026-09-30-sanyi-1a-acceptance.md`

- [ ] **Step 1: 重新生成生产前端（3 分钟）**

Run: `npm run frontend:build`

Expected: 退出码 0，重新生成 `web/dist/app.js` 与 `web/dist/app.css`；
`web/fonts/mashanzheng-subset.woff2` 已存在，且 `app.css` 引用 `/fonts/mashanzheng-subset.woff2`。

- [ ] **Step 2: 运行全量单元与集成测试（按顺序，不短路记录）（5–15 分钟）**

Run: `npm test`

Expected: 退出码 0，所有测试 PASS、0 FAIL；输出包含
`tests/frontend-sanyi-content.test.ts` 的 4 个文化守卫用例。

- [ ] **Step 3: 运行严格类型检查（3 分钟）**

Run: `npm run typecheck`

Expected: `tsc --noEmit` 退出码 0，无 TypeScript 诊断。

- [ ] **Step 4: 扫描前端秘密（2 分钟）**

Run: `npm run frontend:secrets`

Expected: 退出码 0；输出说明浏览器源码和构建产物不含秘密值、服务端环境变量入口、私钥入口、
助记词或账户派生入口；字体二进制未按 UTF-8 读取。

- [ ] **Step 5: 跑完确定性 mock 排练（3–10 分钟）**

Run: `npm run demo:rehearse`

Expected: 退出码 0；一卦完成付款凭证校验、六次递增区块掷卦、排盘与三家落笔，且不请求真实付款或
真实模型服务。

- [ ] **Step 6: 验证固定字体字表可重复生成（2 分钟）**

Run:

```bash
npm run font:charset
git diff --exit-code web/fonts/mashanzheng-chars.txt
```

Expected: 两条命令退出码均为 0；字表内容与已跟踪版本完全一致，没有顺序漂移或漏字。

- [ ] **Step 7: 验收通过后更新 OpenSpec 完成状态（3 分钟）**

只有 Step 1–6 全部通过后，才把
`openspec/changes/sanyi-chinese-redesign/tasks.md` 的 `0.3` 与 `1.1`–`1.14` 改为 `[x]`。
`1.15` 必须保持 `[ ]`，直到用户按 Task 35 文档完成并明确确认验收通过。

Run:

```bash
rg -n '^- \[x\] (0\.3|1\.(?:[1-9]|1[0-4]))\b' \
  openspec/changes/sanyi-chinese-redesign/tasks.md
rg -n '^- \[ \] 1\.15\b' openspec/changes/sanyi-chinese-redesign/tasks.md
openspec validate sanyi-chinese-redesign --strict
```

Expected: 第一条命中 15 项（0.3 加 1.1–1.14），第二条只命中尚待用户确认的 1.15；严格校验显示
`sanyi-chinese-redesign` 有效并以退出码 0 结束。

- [ ] **Step 8: 最终范围与工作区审计（3 分钟）**

Run:

```bash
git status --short
git diff --check
git diff --name-status
```

Expected: 没有尾随空白或补丁格式错误；删除、保留、修改和新增文件与本 Chunk 清单一致；没有修改
运行时密钥、本地数据、合约、探测、回放、消融或封存演示文件。本 Chunk 不提交，由主管审查后决定
后续集成方式。
