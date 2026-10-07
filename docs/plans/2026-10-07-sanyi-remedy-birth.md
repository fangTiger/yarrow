# 三易 2B：解法与生辰再简化 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> 本轮按用户要求由 Claude 本人在当前会话执行，不用 codex、不派子代理。

**Goal:** 结果页在白话总述之后给出「解法」（心法、怎么做、别做什么）；生辰输入去掉「不知道时辰」与「记住」，时间选填、自动保存。

**Architecture:** 解法与白话总述同一次模型调用：`SUMMARY_SCHEMA` 以 `remedy` 取代 `advice`。心法依据（问事为《大象传》原文，八字为三家取用与调候）由服务端组装成 `anchor`，写进提示词，也随 `summary.anchor` 存档；核对前从正文里剔除。前端新增 `RemedyPanel`。生辰只改前端：时间空即 `time: null`，填完整即写入 localStorage。

**Tech Stack:** TypeScript（strict、exactOptionalPropertyTypes）、React 18 SSR 测试、Node test runner + tsx、Ajv Schema、DeepSeek 结构化输出。

**依据：** 设计文档 `docs/plans/2026-09-30-sanyi-redesign-design.md` 第 22 节；OpenSpec `sanyi-chinese-redesign` 任务 2B.1–2B.6，规范 `birth-profile`、`plain-summary`。

**通用命令：**
- 单测：`node --import tsx --test tests/<file>.test.ts`
- 全量：`node --import tsx --test "tests/*.test.ts"`
- 类型：`./node_modules/.bin/tsc --noEmit`
- 构建与秘密扫描：`npm run frontend:build && npm run frontend:secrets`
- 规范：`openspec validate sanyi-chinese-redesign --strict`
- 行宽不超过 110 字符；注释、日志用中文。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/agent/daxiang-corpus.json` | 新建 | 《大象传》64 条，按文王卦序的数组 |
| `src/agent/daxiang-corpus.ts` | 新建 | 读取与校验，`getDaxiang(kingWen)`，来源说明 |
| `tests/sanyi-daxiang.test.ts` | 新建 | 齐全性、样例条目、无繁体残留 |
| `src/sanyi/summary.ts` | 改 | `Remedy` 类型与 Schema、`anchor` 输入、禁用词、原文剔除、修补 |
| `src/sanyi/mock-summary.ts` | 改 | mock 输出带 `remedy` |
| `src/sanyi/store.ts` | 改 | `SummaryState.anchor` |
| `src/sanyi/reading-service.ts` | 改 | 问事 anchor（本卦大象），存档 anchor |
| `src/sanyi/bazi-reading-service.ts` | 改 | 八字 anchor（三家取用 + 调候），存档 anchor |
| `src/frontend/server.ts` | 改 | 问事 provider `maxTokens: 4_096` |
| `web/components/RemedyPanel.tsx` | 新建 | 解法面板 |
| `web/components/PlainSummaryPanel.tsx` | 改 | 「建议」只在旧存档（有 advice）时显示 |
| `web/pages/Reading.tsx`、`web/pages/BaziReading.tsx` | 改 | 总述之后插入 `RemedyPanel` |
| `web/styles/components.css` | 改 | `.remedy` 样式 |
| `scripts/font-charset.ts` + `web/fonts/*` | 改 | 补「解法」并重建子集 |
| `web/lib/birth-profile.ts` | 改 | 去掉 `unknownTime`；`saveBirthProfile` 取代 `useBirthProfile`；摘要「未填时间」 |
| `web/components/BirthFields.tsx` | 改 | 去勾选与告知；时间（选填）与三柱提示 |
| `web/components/QuestionForm.tsx` | 改 | 去掉 remember 状态，生辰合法即自动保存 |
| `scripts/rehearse-demo.ts`、`tests/sanyi-rehearsal.test.ts` | 改 | 断言解法存在 |
| 相关测试 | 改 | 见各任务 |

---

## Chunk 1: 生辰再简化（2B.1）

### Task 1: 表单值与存储

**Files:** Modify `web/lib/birth-profile.ts`；Test `tests/frontend-birth-profile.test.ts`

- [ ] **Step 1: 改测试（先红）**
  - 删除所有 `unknownTime` 用法；`EMPTY_BIRTH` 不再有该字段。
  - 「空白生辰」测试：`birthProblem({ ...filled, time: "" })` 为 `null`；`toBirthInput({ ...filled, time: "" }).time` 为 `null`；`birthProblem({ ...filled, time: "25:99" })` 匹配 `/出生时间/`。
  - 闰月测试里 `unknownTime: true` 改为 `time: ""`。
  - 摘要测试：`birthSummary(toBirthInput({ ...filled, time: "", gender: "female" }))` 等于 `"公历 1990-05-15 未填时间 · 女"`。
  - 存储测试改名「存储读写抛错仍返回本次生辰；合法生辰自动保存并可读回」，改用 `saveBirthProfile(birth, storage)`，不再有不保存分支。
- [ ] **Step 2: 运行确认失败**：`node --import tsx --test tests/frontend-birth-profile.test.ts`，预期因 `saveBirthProfile` 未导出与时间校验而失败。
- [ ] **Step 3: 实现**
  ```ts
  export interface BirthFormValues {
    calendar: "solar" | "lunar"; year: string; month: string; day: string;
    isLeapMonth: boolean;
    /** 出生时间，选填；空串表示时辰不详，按三柱排盘。 */
    time: string;
    gender: "male" | "female" | "";
  }
  // toBirthInput：时间非空才校验格式
  const time = values.time.trim();
  if (time !== "" && !/^\d{1,2}:\d{2}$/.test(time)) throw new Error("出生时间格式不对，可以留空");
  ... time: time === "" ? null : { hour: Number(parts[0]), minute: Number(parts[1]) },
  // fromBirthInput：time 为 null 时为 ""
  /** 合法生辰直接存入本机，下次自动带出；存储不可用时静默跳过。 */
  export function saveBirthProfile(input: BirthProfileInput, storage?: BirthStorage): BirthProfileInput
  // birthSummary：无时间写「未填时间」
  ```
- [ ] **Step 4: 运行通过**（同上命令）。

### Task 2: 生辰行组件与表单

**Files:** Modify `web/components/BirthFields.tsx`、`web/components/QuestionForm.tsx`；Test `tests/frontend-home-parts.test.ts`

- [ ] **Step 1: 改测试（先红）**
  - `fields()` 只传 `{ values, problem, onChange }`。
  - 第一条测试改为：有 `type="time"` 与「时间（选填）」；不出现 `不知道时辰|记住|仅存本机|只存本机|分享链接`。
  - 第二条测试去掉禁用时间框断言，改为：日期已填、时间为空时出现「未填时间，按年月日三柱推算」；时间已填时不出现。
  - 新增源码断言：`QuestionForm.tsx` 不含 `remember`，含 `saveBirthProfile(`。
- [ ] **Step 2: 运行确认失败**：`node --import tsx --test tests/frontend-home-parts.test.ts`
- [ ] **Step 3: 实现**
  - `BirthFields` props 去掉 `remember`、`onRememberChange`；删去「不知道时辰」与「记住」两个勾选和告知行；时间框外包 `<label className="birth-time"><span>时间（选填）</span><input …/></label>`。
  - 日期齐全且 `values.time === ""` 时显示 `<p className="hint">未填时间，按年月日三柱推算</p>`。
  - `QuestionForm`：删去 `remember` 状态；`onChange` 里 `setBirthValues(values)`，`birthProblem(values) === null` 时 `saveBirthProfile(toBirthInput(values))`。
- [ ] **Step 4: 运行通过**，并跑 `tests/frontend-*.test.ts` 防回归。
- [ ] **Step 5: 提交**：`fix(web): 生辰时间选填、去掉记住勾选，填好自动保存`；勾选 tasks 2B.1。

---

## Chunk 2: 《大象传》语料（2B.2）

### Task 3: 语料入库与核对

**Files:** Create `src/agent/daxiang-corpus.json`、`src/agent/daxiang-corpus.ts`、`tests/sanyi-daxiang.test.ts`

- [ ] **Step 1: 写测试（先红）**
  ```ts
  import { DAXIANG, getDaxiang } from "../src/agent/daxiang-corpus.js";
  test("大象传 64 条齐全，按文王卦序", () => {
    assert.equal(DAXIANG.length, 64);
    for (const text of DAXIANG) assert.match(text, /以/u);
    assert.equal(getDaxiang(1), "天行健，君子以自强不息。");
    assert.equal(getDaxiang(2), "地势坤，君子以厚德载物。");
    assert.equal(getDaxiang(58), "丽泽，兑；君子以朋友讲习。");
    assert.equal(getDaxiang(64), "火在水上，未济；君子以慎辨物居方。");
    assert.throws(() => getDaxiang(65));
  });
  test("已转为简体，不残留常见繁体字", () => {
    assert.doesNotMatch(DAXIANG.join(""), /[強載經綸雲於與違師親諸萬國辯誥歷樂過澤說險習]/u);
  });
  ```
- [ ] **Step 2: 运行确认失败**（模块不存在）。
- [ ] **Step 3: 生成数据**：取维基文库《周易/大象》原始 wikitext（`action=raw`），按 `#卦名：正文` 解析出 64 条。用一次性脚本（放 scratchpad，不入库）做繁转简；再逐条对照 ctext《周易》各卦「象曰」，人工核定异体字（保留「无」「遯」等通行写法），写入 JSON 数组。
- [ ] **Step 4: 实现读取模块**：校验长度为 64、每条非空；`getDaxiang(n)` 越界抛错；导出 `DAXIANG_SOURCE`（底本与参照链接、责任说明，写法同 `zhouyi-corpus.ts`）。
- [ ] **Step 5: 运行通过并提交**：`feat(sanyi): 补《大象传》64 条语料`；勾选 2B.2。

---

## Chunk 3: 解法生成（2B.3）

### Task 4: summary.ts 的解法 Schema、提示词、核对与修补

**Files:** Modify `src/sanyi/summary.ts`、`src/sanyi/mock-summary.ts`；Test `tests/sanyi-summary.test.ts`

- [ ] **Step 1: 改测试（先红）**
  - `input` 增加 `anchor: { title: "《象传》· 地天泰", lines: ["天地交，泰；后以财成天地之道，辅相天地之宜，以左右民。"] }`。
  - `good` 去掉 `advice`，增加
    `remedy: { principle: "顺势而为，先把能做的准备做足。", steps: [{ action: "面试前把作品集再打磨一遍", basis: "三家都认为时机还没完全到", timing: "面试前一周" }, { action: "结果出来前别放弃其他机会", basis: "用神力量不足，结果未明" }], avoid: ["不要急着催问结果"] }`。
  - 提示词测试加：`"心法依据（《象传》· 地天泰）"`、`"天地交，泰"`；系统提示含 `"remedy"`、`"开光"`（作为禁止项写明）、`"不给颜色、方位"`。
  - 新测试「解法禁用词」：`steps[0].action = "佩戴开光貔貅化解"` → `checkSummary` 报错匹配 `/开光/`。
  - 新测试「心法原文剔除」：`proseErrors` 设为遇到「后以财成」就报错；`principle` 写「后以财成天地之道，凡事先顺势。」→ `checkSummary` 无错；而 `explanation` 里出现「后以财成」之外的编造仍按原核对报错。
  - 修补测试：含禁用词的步骤与不符盘面的步骤被删；步骤全删时用模板 `{ action: "对照下方三家依据，择其稳妥者先行", basis: "三家断语" }`；避忌全删时用「不要据此做重大财务或医疗决定」；心法白话被删时问事用「按上方原文之意，守正而行」，八字用「按三家取用之意，扬长避短」。
  - 运行器 Schema 提示测试照旧；mock 三类型测试照旧通过（mock 带 remedy）。
- [ ] **Step 2: 运行确认失败**：`node --import tsx --test tests/sanyi-summary.test.ts`
- [ ] **Step 3: 实现**
  ```ts
  export interface RemedyStep { action: string; basis: string; timing?: string }
  export interface Remedy { principle: string; steps: RemedyStep[]; avoid: string[] }
  export interface SummaryAnchor { title: string; lines: string[] }
  // PlainSummary：remedy?: Remedy（新），advice?: string[]（仅旧存档）
  // SummaryInput：anchor: SummaryAnchor
  // SUMMARY_SCHEMA.required: ["conclusion", "agreement", "explanation", "remedy"]
  //   remedy: { principle ≤60, steps 2–3 × { action ≤40, basis ≤50, timing? ≤30 }, avoid 1–2 × ≤40 }
  export const REMEDY_FORBIDDEN = /开光|法器|符咒|符箓|护身符|转运|化煞|吉祥物|摆件|放生|捐款|供奉|烧香|幸运色|幸运数字|吉位/u;
  // stripAnchor(text, anchor)：把原文按「，；。」切成短句（≥2 字），在 text 中删去后再交给 proseErrors
  // sentenceErrors(text) = [...input.proseErrors(stripAnchor(text)), ...forbidden(text)]
  // checkSummary 与 repairSummary 都只经由 sentenceErrors 判句
  ```
  - 系统提示把「advice 写 2 至 4 条建议」换成解法说明：principle 用一句白话讲心法依据教人怎么处事（不要照抄原文）；steps 2 至 3 步，action 做什么、basis 依据的盘面要点或三家说法、timing 什么时候做（没有就省略）；avoid 1 至 2 条别做什么；不给颜色、方位、数字、佩戴之类的趋避，不推荐开光物、法器、符咒、护身符、吉祥物、摆件，不涉及放生、捐款、供奉、烧香。
  - `buildSummaryPrompt` 在盘面要点之前加 `心法依据（${anchor.title}）：` 与各行。
  - `summaryTexts` 纳入 remedy 全部文字与旧 advice。
  - mock 输出加 remedy（不含干支），删除 advice。
- [ ] **Step 4: 运行通过**。

### Task 5: 编排、存档与输出上限

**Files:** Modify `src/sanyi/store.ts`、`src/sanyi/reading-service.ts`、`src/sanyi/bazi-reading-service.ts`、`src/frontend/server.ts`；Test `tests/sanyi-summary-service.test.ts`、`tests/sanyi-rehearsal.test.ts`、`scripts/rehearse-demo.ts`

- [ ] **Step 1: 改测试（先红）**
  - 问事：`reading.summary.anchor.title` 等于 `` `《象传》· ${本卦名}` ``，`lines[0]` 等于 `getDaxiang(本卦文王序)`；`summary.output.remedy.steps.length >= 2`。
  - 八字：运势 `anchor.title === "三家取用"`，`lines` 含三家名与「调候：」行；命理同样有 remedy。
  - 排练：`conclusions` 旁加 `remedies: { question: number; fortune: number }`（步骤数），测试断言大于 0。
- [ ] **Step 2: 运行确认失败**。
- [ ] **Step 3: 实现**
  - `SummaryState.anchor?: { title: string; lines: string[] }`。
  - 问事 `summaryInput`：`anchor = { title: \`《象传》· ${five.primary.name}\`, lines: [getDaxiang(five.primary.kingWenNumber)] }`。
  - 八字 `summaryInput`：`lines = schools.map((s) => \`${s.name}：${s.useGod}\`)` 再加 `` `调候：${tiaohou.useStems.join("、")}（《穷通宝鉴》）` ``，`title = "三家取用"`。
  - 两处 `writeSummary` 写回时：`{ ...summaryState(...), anchor: input.anchor }`。
  - `server.ts` 问事 provider `maxTokens: 4_096`。
- [ ] **Step 4: 运行通过**：summary-service、rehearsal、bazi-reading-service、api 测试。
- [ ] **Step 5: 提交**：`feat(sanyi): 解法——总述同次生成心法、怎么做、别做什么，原文由程序给出`；勾选 2B.3；同步设计文档 22.3 中 `summary.classic` 的写法为 `summary.anchor: { title, lines }`。

---

## Chunk 4: 结果页解法面板（2B.4）

### Task 6: RemedyPanel 与页面接入

**Files:** Create `web/components/RemedyPanel.tsx`；Modify `web/components/PlainSummaryPanel.tsx`、`web/pages/Reading.tsx`、`web/pages/BaziReading.tsx`、`web/styles/components.css`、`scripts/font-charset.ts`；Test `tests/frontend-plain-summary.test.ts`

- [ ] **Step 1: 改测试（先红）**
  - fixture `output` 去掉 advice、加 remedy；`summary` 加 `anchor`。
  - 「解法面板」：渲染含「解法」「心法」、anchor 标题与原文、principle、每步 action、「依据：」「时机：」、「别做什么」及避忌；没有 remedy（旧存档或未完成）时返回空串。
  - 「旧存档」：`output` 只有 advice 无 remedy 时，`PlainSummaryPanel` 仍显示「建议」；新存档不显示「建议」。
  - 布局：两个结果页源码中 `<RemedyPanel` 位于 `<PlainSummaryPanel` 之后、「看三家依据」之前。
- [ ] **Step 2: 运行确认失败**：`node --import tsx --test tests/frontend-plain-summary.test.ts`
- [ ] **Step 3: 实现**
  ```tsx
  /** 白话总述之后的解法：心法（原文或三家取用）、怎么做、别做什么。 */
  export function RemedyPanel(props: { reading: AnyPublicReading }) {
    const summary = props.reading.summary;
    const remedy = summary?.status === "done" ? summary.output?.remedy : undefined;
    if (!summary || !remedy) return null;
    return (
      <section aria-label="解法" className="panel remedy">
        <header className="panel-head"><h2>解法</h2></header>
        <div className="remedy-heart">
          <h3>心法</h3>
          {summary.anchor ? (
            <blockquote><cite>{summary.anchor.title}</cite>
              {summary.anchor.lines.map((line) => <p key={line}>{line}</p>)}</blockquote>
          ) : null}
          <p className="remedy-principle">{remedy.principle}</p>
        </div>
        <div className="remedy-steps"><h3>怎么做</h3><ol>{remedy.steps.map((step) => (
          <li key={step.action}><b>{step.action}</b><span>依据：{step.basis}</span>
            {step.timing ? <span>时机：{step.timing}</span> : null}</li>))}</ol></div>
        <div className="remedy-avoid"><h3>别做什么</h3>
          <ul>{remedy.avoid.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </section>
    );
  }
  ```
  - `PlainSummaryPanel`：`{output.advice ? <div className="summary-advice">…</div> : null}`。
  - 两个结果页：`<PlainSummaryPanel …/>` 之后紧接 `<RemedyPanel reading={reading} />`。
  - CSS：`.remedy` 三段纵排；`blockquote` 用 `var(--dynamic)` 楷体、左侧金线；步骤里 `span` 换行显示为次要色；窄屏不溢出。
  - 字体：`FIXED_COPY` 加 `"解法"`，运行 `node --import tsx scripts/font-charset.ts` 与项目既有的子集化命令重建 `mashanzheng-subset.woff2` 与 sha256。
- [ ] **Step 4: 运行通过**，再跑全量、类型、构建、秘密扫描。
- [ ] **Step 5: 提交**：`feat(web): 结果页解法面板，旧存档照旧显示建议`；勾选 2B.4。

---

## Chunk 5: 冒烟、走查与验收（2B.5–2B.6）

### Task 7: 真实模型冒烟与截图

- [ ] **Step 1:** 用 `output/real-question-smoke.ts` 跑 2–3 卦问事、`output/real-bazi-smoke.ts` 跑运势与命理各 1–2 卦，检查：总述 done；remedy 步骤 2–3、依据贴合盘面；无禁用词；无颜色方位之类；删去处数。
- [ ] **Step 2:** 用临时截图服务（`output/summary-shot-server.ts`，端口 4179）与 `scratchpad/cdp-shot.mjs`，在 1320 与 390 宽度下看问事、运势、命理结果页，以及首页生辰行（未填时间提示）。
- [ ] **Step 3:** 重启 4173 服务；全量检查通过后提交，勾选 2B.5，向用户汇报并请验收（2B.6）。
