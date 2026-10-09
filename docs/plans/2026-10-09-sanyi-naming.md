# 三易起名 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> 本计划由 codex（gpt-5.6-sol，用户指定）分四批执行，Claude 每批审查、测试、提交。

**Goal:** 开放「起名」：人名与商号，三家（五行补益、诗文出处、音形字义）各给 3 个名字，另给三家合参，逐字附拼音、五行、康熙笔画与释义，出处可核验。

**Architecture:** 离线 Python 构建字库与诗文语料（产物 JSON 入库），运行时由 `src/sanyi/naming/` 加载。`NamingReadingService` 仿照 `BaziReadingService`：付款 → 排盘与喜用 → 三家并行 → 合参。模型输出经确定性核对，不过则带错误重写，三次后删错留对。前端增加起名表单与结果页。

**Tech Stack:** TypeScript（strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes）、React 18、Node test runner + tsx、Ajv、Python（`.venv-tools`，opencc-python-reimplemented 已装）、Unihan、新华字典数据（MIT）、chinese-poetry（MIT）。

**依据：** `docs/plans/2026-10-09-sanyi-naming-design.md`（以下简称「设计」）；OpenSpec `openspec/changes/sanyi-naming/`。

---

## 通用约定（每批都适用）

- 代码风格同现有 `src/sanyi/`：ESM、`.js` 后缀导入、行宽 ≤110、注释与日志用中文、标识符用英文。
- TDD：先写测试 → 运行确认失败 → 实现 → 运行确认通过。
- 命令：
  - 单测 `node --import tsx --test tests/<file>.test.ts`；
  - 全量 `node --import tsx --test "tests/*.test.ts"`；
  - 类型 `./node_modules/.bin/tsc --noEmit`；
  - Python 用 `.venv-tools/bin/python`。
- 不要运行 `npm install` / `pip install`，不要写 git（主管提交），不联网。原始数据已在 `tools/naming/raw/`：
  - `Unihan_*.txt`；
  - `xinhua-word.json`；
  - `shijing.json`、`chuci.json`、`lunyu.json`、`唐诗三百首.json`、`宋词三百首.json`。
- 文化守卫：起名相关文案、提示词不得出现日文假名，也不得出现「易者、押钱、赔付、封存」等禁词（见现有 `tests/` 中的文化守卫测试）。

## 文件结构

| 文件 | 职责 |
|---|---|
| `tools/naming/build_lexicon.py` | 读 Unihan 与新华字典，产出 `src/sanyi/naming/lexicon.json` |
| `tools/naming/build_classics.py` | 读 chinese-poetry 五个文件，切句，产出 `src/sanyi/naming/classics.json` |
| `tools/naming/blocked.txt` | 不宜入名字表（每行一字，`#` 注释分类） |
| `src/sanyi/naming/SOURCES.md` | 数据来源、版本日期、许可、构建命令 |
| `src/sanyi/naming/lexicon.ts` | 加载字库：`charInfo(c)`、`isNameChar(c)`、`isSurname(s)`、`ELEMENTS` |
| `src/sanyi/naming/classics.ts` | 加载语料并入《周易》：`CLASSIC_LINES`、`pickCandidates(...)` |
| `src/sanyi/naming/favorable.ts` | 喜用五行：调候换算、行业表 |
| `src/sanyi/naming/schema.ts` | 三家与合参的输出类型、JSON Schema |
| `src/sanyi/naming/families.ts` | 三家定义与提示词组装 |
| `src/sanyi/naming/audit.ts` | 核对：通用、分家、合参；音律提示 |
| `src/sanyi/naming/runner.ts` | 单家运行器与合参运行器（三次调用 + 修补 + 自动再试） |
| `src/sanyi/naming/mock.ts` | 确定性 mock 输出（解析提示词中的用字表与候选句） |
| `src/sanyi/naming/service.ts` | `NamingReadingService` |
| `src/sanyi/naming/public.ts` | 公开视图：逐字信息、音律提示、出处回填 |
| 修改 `src/sanyi/store.ts` | `StoredNamingReading` 并入 `StoredReading` |
| 修改 `src/sanyi/classify.ts` | 起名可用，识别 `target` |
| 修改 `src/sanyi/api.ts`、`src/frontend/server.ts` | 起名创建、读取、重试分派；服务装配 |
| 修改 `src/sanyi/mock-provider.ts` | 路由 `sanyi/naming/*` 任务到 mock |
| 修改 `scripts/rehearse-demo.ts` | 排练增加人名、商号各一卦 |
| `web/components/NamingFields.tsx` | 起名表单：人名 / 商号 |
| 修改 `web/components/KindOptions.tsx`、`web/lib/home-entry.ts`、`web/components/QuestionForm.tsx`、`web/components/BirthFields.tsx`、`web/components/PaymentButton.tsx` | 四个类型、起名表单接入与付款请求体 |
| `web/pages/NamingReading.tsx`、`web/components/NameCard.tsx` | 起名结果页 |
| 修改 `web/pages/Reading.tsx` | 按 `kind === "naming"` 分派到起名结果页 |
| 修改 `web/styles/components.css`、`scripts/font-charset.ts`、`web/fonts/*` | 样式与字体子集 |

---

## Chunk N1：字库与诗文语料（第 1 批）

### Task 1：构建字库

**Files:** Create `tools/naming/build_lexicon.py`、`tools/naming/blocked.txt`、`src/sanyi/naming/lexicon.json`（构建产物）、`src/sanyi/naming/lexicon.ts`、`src/sanyi/naming/SOURCES.md`；Test `tests/naming-lexicon.test.ts`

- [ ] **Step 1：写测试（先红）** `tests/naming-lexicon.test.ts`：
  - `LEXICON_SIZE === 8105`；一级 3500、二级 3000、三级 1605 个。
  - 样例（按设计第 4 节）：
    - 泽：`zé`、tone 2、`trad` 澤、kangxi 17、水、依据「部首·水」；
    - 瑾：kangxi 16、金、「部首·玉」；
    - 涵：kangxi 12、水；
    - 林：kangxi 8、木；
    - 明：kangxi 8、火、「部首·日」；
    - 安：五行按读音，零声母属土，依据「读音·喉音」；
    - 思：s 齿音属金；
    - 雨：水、「部首·雨」；
    - 峰：土、「部首·山」；
    - 鑫：金。
  - `charInfo("死")?.blocked === true`，`isNameChar("死") === false`；`isNameChar("泽") === true`。
  - `isSurname("欧阳") === true`，`isSurname("张") === true`，`isSurname("Ab") === false`，`isSurname("张王李") === false`。
  - 释义非空的字至少占 90%，每条不超过 24 字、不含「～」。
- [ ] **Step 2：运行确认失败。**
- [ ] **Step 3：实现构建脚本** `tools/naming/build_lexicon.py`：
  - 解析 `Unihan_OtherMappings.txt` 的 `kTGH`（`2013:NNNN`，序号 1–8105）定收字与等级（≤3500 为 1，≤6500 为 2，其余为 3）。
  - `Unihan_Readings.txt`：`kMandarin` 取第一个读音；由声调符号得 tone，无调号记 5；拆出声母与韵母（声母表 b p m f d t n l g k h j q x zh ch sh r z c s y w，零声母为空串）。
  - `Unihan_Variants.txt`：`kTraditionalVariant` 取第一个，没有则为本字。
  - `Unihan_IRGSources.txt`：`kRSUnicode`（取第一个，形如 `85.13`，部首号可能带 `'`，去掉 `'` 取整数）与 `kTotalStrokes`（取第一个）。
  - 康熙笔画 = 部首本字笔画 + 余画。部首本字笔画：按康熙部首号取部首字，再取该字的 `kTotalStrokes`。部首号到字的映射写在脚本里（214 部首，可用 Unicode Kangxi Radicals 区 U+2F00–U+2FD5 的兼容分解，或直接写 214 个字的表）。余画取繁体字 `kRSUnicode` 的小数部分。
  - 五行按设计第 4 节两步规则；依据写作 `部首·水`（部首名用部首本字）或 `读音·唇音|舌音|齿音|牙音|喉音`。
  - 释义：从 `xinhua-word.json` 中按 `word` 取 `explanation`，找第一个「⒈」到其后第一个「。」之间的文字，去掉「～」及其前后标点；没有「⒈」时，取本字带调拼音行之后的第一句；截断到 24 字以内（在逗号处截断）；取不到为空串。
  - `blocked`：读 `tools/naming/blocked.txt`。约 150 字，按设计第 4 节五类整理，每类以 `# 分类名` 起头。
  - 输出 `src/sanyi/naming/lexicon.json`：对象，以字为键；值为数组 `[pinyin, tone, initial, final, trad, kangxi, strokes, level, wuxing, wuxingBasis, meaning, blocked(0/1)]`，用紧凑数组减小体积；顶层另有 `"_fields"` 记录字段顺序。
- [ ] **Step 4：实现加载模块** `src/sanyi/naming/lexicon.ts`：
  ```ts
  export type Element = "木" | "火" | "土" | "金" | "水";
  export const ELEMENTS: readonly Element[];
  export interface CharInfo { char: string; pinyin: string; tone: 1|2|3|4|5; initial: string; final: string;
    trad: string; kangxi: number; strokes: number; level: 1|2|3; wuxing: Element; wuxingBasis: string;
    meaning: string; blocked: boolean }
  export const LEXICON_SIZE: number;
  export function charInfo(char: string): CharInfo | undefined;
  export function isNameChar(char: string): boolean;     // 在字表内且未 blocked
  export function isSurname(value: string): boolean;     // 1–2 个字且都在字表内
  export function nameChars(filter?: (info: CharInfo) => boolean): CharInfo[]; // 可用起名字
  ```
  JSON 用 `import raw from "./lexicon.json" with { type: "json" }` 加载（同 `zhouyi-corpus.ts`），首次调用时展开并缓存。
- [ ] **Step 5：写 `SOURCES.md`**（中文）：
  - Unihan：版本取 `Unihan_Readings.txt` 文件头日期，Unicode License v3；
  - 新华字典数据：pwxcoo/chinese-xinhua，MIT；
  - chinese-poetry：MIT；
  - 构建命令；
  - 五行规则。
- [ ] **Step 6：运行构建与测试通过**：`.venv-tools/bin/python tools/naming/build_lexicon.py` 后跑单测。
- 第 1 批审查修订（已执行）：
  - 释义优先取新华数据 `more` 字段中英文方括号前的义项，避免粘着例词；
  - 字库增加 `polyphonic` 与 `readings`（多音字）；
  - 候选诗句的消极字扩充，并按书分配名额：诗经 14、楚辞 12、唐诗 10、宋词 10、周易 7、论语 7，`prefer` 至多 20 句；
  - 题名中的日文中点「・」统一为「·」。

### Task 2：构建诗文语料

**Files:** Create `tools/naming/build_classics.py`、`src/sanyi/naming/classics.json`（产物）、`src/sanyi/naming/classics.ts`；Test `tests/naming-classics.test.ts`

- [ ] **Step 1：写测试（先红）**：
  - 书名集合恰为 诗经、楚辞、论语、周易、唐诗三百首、宋词三百首；
  - 能检索到 `{ book: "诗经", title: "周南·关雎", text: "关关雎鸠，在河之洲" }`（句末标点去掉）；
  - 唐诗为简体，例如含「西陆蝉声唱，南冠客思侵」；
  - 《周易》含「天行健，君子以自强不息」（题名「乾·大象」）与「潜龙勿用」（题名「乾·初九」）；
  - 每句 `id` 唯一且稳定（形如 `sj-0001-03`，书码加篇序加句序）；
  - `pickCandidates({ seed: "abc", length: 2, count: 60, prefer: ["清"] })`：
    - 返回 60 句，两次调用结果相同；
    - 每句至少含 2 个可用起名字；
    - 不含 blocked 字与消极字（死、亡、泣、哀、悲、愁、怨、恨、病、哭）；
    - 句长 4–24 字；
    - 至少覆盖 4 部书；
    - 优先字「清」所在句至少占 5 句（若语料中够）。
- [ ] **Step 2：运行确认失败。**
- [ ] **Step 3：实现** `tools/naming/build_classics.py`：
  - 题名：诗经 `section·title`；楚辞 `title`；论语 `chapter`；唐诗 `作者《题》`（OpenCC t2s 转简，作者与题目也转）；宋词 `作者《rhythmic》`。
  - 切句：拼接段落后按「。！？；」切分，去掉引号「“”‘’「」『』」、空白与括号注音；保留「，」；去掉句末标点；空句丢弃。
  - 产物 `classics.json`：`[{ book, title, lines: string[] }]`，篇序按源文件顺序。
- [ ] **Step 4：实现** `src/sanyi/naming/classics.ts`：
  - 加载 JSON；
  - 并入《周易》：`getHexagramText(n)` 的卦辞，题名 `卦名·卦辞`，卦名取 `name` 的末字或标准简称；爻辞，题名 `卦名·初九` 等；`getDaxiang(n)`，题名 `卦名·大象`。同样切句。
  - 导出 `ClassicLine { id; book; title; text }`、`CLASSIC_LINES`、`lineById(id)`、`pickCandidates({ seed, length, count, prefer })`。
  - 抽取：
    - 以 `seed` 做确定性洗牌（如 FNV-1a 加 xorshift）；
    - 先放含 `prefer` 字的句子（至多 count 的一半）；
    - 再按书轮流抽，保证均衡。
- [ ] **Step 5：运行构建与测试通过。**
- [ ] **批末**：全量测试、类型检查通过；报告产物体积（lexicon.json、classics.json 各多少 KB）。

---

## Chunk N2：喜用、三家与合参（第 2 批）

### Task 3：喜用五行

**Files:** Create `src/sanyi/naming/favorable.ts`；Test `tests/naming-favorable.test.ts`

- [ ] **Step 1：写测试（先红）**：
  - `stemElement("丙") === "火"`；
  - `favorableFromTiaohou(["丙", "癸", "丙"])` 为 `["火", "水"]`，最多两个、去重保序；
  - `industryElement("社区咖啡馆，想要温暖安静")` 为 `{ element: "火", keyword: "咖啡" }`；
  - `industryElement("做个软件工作室")` 为金；
  - `industryElement("卖手工皂")` 为 `null`；
  - 关键词表按设计第 3 节，长词优先匹配。
- [ ] **Step 2–4：实现并通过。** 导出：
  ```ts
  export function stemElement(stem: string): Element;
  export function favorableFromTiaohou(stems: readonly string[]): Element[];
  export function industryElement(text: string): { element: Element; keyword: string } | null;
  ```

### Task 4：三家 Schema、上下文与提示词

**Files:** Create `src/sanyi/naming/schema.ts`、`src/sanyi/naming/families.ts`；Test `tests/naming-families.test.ts`

- [ ] **Step 1：写测试（先红）**：
  - Schema 校验：`names` 恰好 3 项；`given` 长度 1–4；`meaning`、`why` ≤50；`chars` 1–4 项、`gloss` 1–12 字；`note` ≤80；`element` 只能取五行之一；不允许多余字段。
  - 提示词：三家用户提示词都含：
    - 起名对象行（如「人名 · 姓张 · 双名 · 性别女」「商号 · 字号 2 字」）；
    - 期望原文；
    - 「输出必须严格符合给定 JSON Schema」。
  - 五行家提示词另含：
    - 「喜用五行：火、水」及来源说明；
    - 「喜用用字」行，列出一级字中属喜用五行、可入名的字，用顿号分隔；
    - 商号自选五行时，改为五行与行业对应的说明，要求填写 `element`。
  - 诗文家提示词含 60 行候选，格式 `S01｜《诗经·周南·关雎》关关雎鸠，在河之洲`，并要求 `sourceId` 填编号。
  - 音义家提示词含姓的拼音与声调（人名）。
  - 三家系统提示词都含：不用五格、三才、数理；不出现开光、法器、符咒、转运等；人名按性别取字（不限取中性）；避免谐音不雅；商号不含行政区划、行业词与组织形式词。
  - 不含禁词：易者、押钱、赔付、封存，以及日文假名。
- [ ] **Step 2–4：实现并通过。** 导出：
  ```ts
  export type NamingFamilyKey = "wuxing" | "shiwen" | "yinyi";
  export interface NamingName {
    given: string; meaning: string; why: string; sourceId?: string;
    /** 逐字字义：该字在这个名字里取的意思，顺序与 given 一致，gloss ≤12 字 */
    chars: { char: string; gloss: string }[];
  }
  export interface NamingFamilyOutput { note: string; element?: Element; names: NamingName[] }
  export interface NamingSummaryOutput {
    picks: { given: string; reason: string }[]; overview: string; tips: string[];
  }
  export const NAMING_FAMILY_SCHEMA: JsonSchema;
  export const NAMING_SUMMARY_SCHEMA: JsonSchema;
  export interface NamingContext {
    target: "person" | "business";
    surname?: string;
    gender: "male" | "female" | "any";
    length: 1 | 2 | 3 | 4;
    question: string;
    favorable: Element[] | null;          // null：商号自选五行
    favorableSource: "tiaohou" | "industry" | "model";
    favorableNote: string;                // 如「调候取丙、癸」「行业：咖啡 → 火」
    candidates: ClassicLine[];            // 诗文家候选
  }
  export const NAMING_FAMILIES: ReadonlyArray<{
    key: NamingFamilyKey; name: string; seal: string; systemPrompt: string;
    buildUserPrompt(ctx: NamingContext): string;
  }>;
  ```
  - 家名与印：五行补益（五）、诗文出处（诗）、音形字义（音）。
  - 喜用用字表：用 `nameChars` 过滤一级、未 blocked、`wuxing` 属喜用的字；人名去掉明显偏女或偏男的字不在此处处理，交给提示词。

### Task 5：核对、修补、音律提示

**Files:** Create `src/sanyi/naming/audit.ts`；Test `tests/naming-audit.test.ts`

- [ ] **Step 1：写测试（先红）**。用固定上下文（姓张、双名、女、喜用火水、候选含 `S01` 关关雎鸠，在河之洲）：
  - 通用：
    - 字数不符报「应为 2 字」；
    - 表外字或 blocked 字报「不宜入名」或「不在通用规范汉字表」；
    - 三个名字重复报错；
    - 文案含「五格」「开光」报禁用词；
    - `chars` 与 `given` 逐字不一致（字数或字不同）报错。
  - 五行家：
    - 「林森」（都属木）报「无一字属喜用（火、水）」；
    - 「明泽」通过；
    - 商号自选五行缺 `element` 时报错；
    - 有 `element` 时按它判断。
  - 诗文家：
    - 缺 `sourceId` 报错；
    - 编号不在候选内报错；
    - 「河洲」引 S01 通过；
    - 「河清」引 S01 报「清」不在所引诗句中。
  - 音义家：
    - 姓张（1 声）加「思清」（1 声、1 声）报「姓名声调全同」；
    - 「思远」通过；
    - 叠字「依依」不受此限。
  - `repairFamily`：保留合格名字，返回 `removed` 个数；全不合格时返回 `names: []`。名字本身合格、只有 `chars` 不合格时不删名字，用字库 `meaning`（截到第一个「；」、≤12 字）补齐 `gloss`。
  - `toneHints("张", "思清")` 含「姓名声调全同」；`toneHints("张", "章泽")` 含「同声母」或「同韵母」提示；含三级字时提示「较生僻」；含多音字时提示「「乐」是多音字（le、yue），请确认读音」。
  - 合参核对：
    - `picks` 不在合格名字中报错；
    - `picks` 重复报错；
    - 修补后为空时，取各家首个合格名字，理由写「某家首选」；
    - `tips` 不合格时用固定三条，人名与商号各一套，见设计第 7 节。
- [ ] **Step 2–4：实现并通过。** 导出：
  ```ts
  export const NAMING_FORBIDDEN: RegExp;
  export function auditFamily(key: NamingFamilyKey, output: NamingFamilyOutput, ctx: NamingContext): string[];
  export function repairFamily(key: NamingFamilyKey, output: NamingFamilyOutput, ctx: NamingContext):
    { output: NamingFamilyOutput; removed: number };
  export function toneHints(surname: string | undefined, given: string): string[];
  export function auditNamingSummary(output: NamingSummaryOutput, valid: readonly string[]): string[];
  export function repairNamingSummary(output: NamingSummaryOutput, families: Partial<Record<NamingFamilyKey,
    string[]>>, target: "person" | "business"): { output: NamingSummaryOutput; removed: number };
  ```
  错误信息用中文，并写明是哪个名字，便于模型重写。

### Task 6：运行器与 mock

**Files:** Create `src/sanyi/naming/runner.ts`、`src/sanyi/naming/mock.ts`；Modify `src/sanyi/mock-provider.ts`；Test `tests/naming-runner.test.ts`

- [ ] **Step 1：写测试（先红）**：仿照 `tests/sanyi-summary.test.ts` 的 `Fake` provider：
  - 一次通过：calls 1，removed 0；
  - 第一次不合格（错误含「无一字属喜用」）→ 第二次合格：calls 2，且第二次 `userPrompt` 含上次的错误说明；
  - 三次都有一个名字不合格：status done，`names` 剩 2 个，removed 1；
  - Schema 错误（StructuredOutputError）也进入重写，提示用现有 `schemaHints`；
  - 非 Schema 的调用错误：status failed；`WithRetry` 版本会再试一次；
  - `taskId` 为 `sanyi/naming/<key>`，合参为 `sanyi/naming/summary`；
  - `MockSchoolsProvider` 对三家与合参都能给出一次通过核对的输出，覆盖人名双名、人名单名、性别不限、商号 2 字、商号自选五行。
- [ ] **Step 2–4：实现并通过。**
  - 运行器沿用 `bazi-school-runner.ts` 的结构：最多三次调用、`validateStructuredOutput`、`schemaHints`、最后合格输出修补。
  - 提示词里的 effort 用 `"medium"`，`cacheSystemPrompt: true`。
  - mock 从提示词解析「喜用用字」行、候选句行与姓的声调，确定性挑字，保证通过 `auditFamily`；合参 mock 解析提示词中的名字清单，取前两个。
- [ ] **批末**：全量测试、类型检查通过。

---

## Chunk N3：服务、存档与接口（第 3 批）

### Task 7：存档类型与服务

**Files:** Modify `src/sanyi/store.ts`；Create `src/sanyi/naming/service.ts`；Test `tests/naming-service.test.ts`、`tests/helpers/naming-service.ts`

- [ ] **Step 1：写测试（先红）**。用 mock provider、mock 付款、固定时钟 `2026-10-09T21:00:00+08:00` 的夹具：
  - 人名（张、双名、女、1990-05-15 15:30）：
    - status 依次 writing → done；
    - 三家 done，各 3 个名字；
    - summary done，`picks` 2–3 个；
    - `basis.favorableSource === "tiaohou"`，`favorable` 为调候换算结果，`pillars` 为四柱干支（时柱有值）。
  - 未出生：`unborn: true`、gender any、只填预产期：时柱为 null（三柱），`basis.unborn` 标记为真。
  - 商号（咖啡馆、2 字、无店主生辰）：
    - `favorableSource === "industry"`，喜用为火；
    - 无四柱；
    - 名字无姓。
  - 商号（「卖手工皂」、3 字）：`favorableSource === "model"`，五行家输出带 `element`。
  - 商号带店主生辰：按调候。
  - 单家失败：mock 让 `sanyi/naming/shiwen` 一直失败：
    - 该家 failed，其余照常；
    - 合参依据两家；
    - `retryFamily(id, "shiwen")` 在 mock 恢复后成功，并重写合参；
    - 重试至多 2 次，超出抛 `LimitExceededError`。
  - 合参失败后 `retrySummary` 可免费重试至多 2 次。
  - 同一笔付款重复使用抛 `PaymentAlreadyUsedError`。
  - 人名缺姓氏、姓氏不在字表、缺生辰时抛 `SanyiInputError`。
  - 存档 JSON 不含原始出生日期与时间串（仿照 `tests/sanyi-bazi-privacy.test.ts`，日志用固定时钟）。
- [ ] **Step 2–4：实现并通过。**
  - `StoredNamingReading`（见设计第 8 节），并入 `StoredReading` 联合类型。
  - 服务：
    - `create`：付款核验在排盘之前，与八字相同；
    - `getReading`、`readAny`、`whenSettled`、`retryFamily`、`retrySummary`；
    - 队列、后台任务与锁仿照 `BaziReadingService`。
  - 排盘：抽出 `bazi-reading-service.ts` 里的 `chartFrom` 逻辑复用，或在起名服务里调用相同的 `normalizeBirthProfile`、`correctBirthTime`、`buildBaziChart`、`derivedChart`。
    - 性别 any 时按男命计算；
    - 未出生时 `time` 为 null；
    - `targetYear` 用当年；
    - 调候用 `lookupQiongtong`，五行分布用 `analyzeBazi(chart).elements`。
  - 诗文候选：`pickCandidates({ seed: id, length, count: 60, prefer: 期望中出现的可用字 })`，存入存档（只存候选编号数组 `candidateIds`），运行时由 `lineById` 还原。
  - 三家并行；每家调用出错时自动再试一次（`WithRetry`）；三家结束后写合参，合参写完才 done。
  - 日志用中文，不记录生辰。

### Task 8：公开视图、分类、接口与装配

**Files:** Create `src/sanyi/naming/public.ts`；Modify `src/sanyi/classify.ts`、`src/sanyi/api.ts`、`src/frontend/server.ts`、`scripts/rehearse-demo.ts`；Test `tests/naming-api.test.ts`，并更新受影响的既有测试（分类、接口、排练）

- [ ] **Step 1：写测试（先红）**：
  - 分类：
    - 「给孩子起个名字」为 `kind: "naming"`、`supported: true`、`target: "person"`、`needsBirth: true`；
    - 「给我的咖啡馆起个名字」为 `target: "business"`、`needsBirth: false`。
    - 原有「起名即将开放」的测试改为新行为。
  - 公开视图：
    - 每个名字有 `full`（人名为姓加名，商号即字号）、`pinyin`（逐字带调，空格分隔）；
    - `chars[]` 含 `char/pinyin/tone/wuxing/wuxingBasis/kangxi/meaning/level/polyphonic`，其中 `meaning` 取模型的 `gloss`，没有时用字库释义；
    - `hints[]`；
    - 诗文家名字有 `source: { book, title, text }`；
    - 合参 `picks` 补上 `full`、`pinyin` 与所出家名。
  - 接口：
    - `createReading({ kind: "naming", target: "person", surname: "张", gender: "female", length: 2, birth, question: "", feeProof })` 返回 naming 公开视图；
    - 商号 `question` 少于 2 字返回 400；
    - 人名 `question` 可以为空；
    - `getReading` 读出 naming；
    - `retrySchool(id, "shiwen")` 与 `retrySummary(id)` 分派到起名服务。
  - 服务端路由不变（`/api/readings`、`/api/readings/:id`、`/schools/:key/retry`、`/summary/retry`），在 `tests/frontend-server.test.ts` 的同类测试里补起名用例（若该文件按路由逐项测试）。
  - 排练：`runRehearsal()` 增加 `naming: { person: string[]; business: string[] }`，即合参推荐的全名，断言非空。
- [ ] **Step 2–4：实现并通过。**
  - `createSanyiApi` 的 options 增加 `naming?: NamingReadingService`；
  - `body.kind === "naming"` 时，先于问题分类处理：问题可空，长度 0–280；
  - 校验各字段：target、surname、gender、length（人名 1–2、商号 2–4）、unborn；birth 人名必填、商号可选；
  - `server.ts` 装配起名服务，provider 与八字相同（8192、90 秒）。
- [ ] **批末**：全量测试、类型检查、`npm run frontend:build` 通过（前端暂未接入也应能构建）。

---

## Chunk N4：前端（第 4 批）

### Task 9：首页起名入口与表单

**Files:** Create `web/components/NamingFields.tsx`；Modify `web/lib/home-entry.ts`、`web/components/KindOptions.tsx`、`web/components/QuestionForm.tsx`、`web/components/BirthFields.tsx`、`web/components/PaymentButton.tsx`（以及请求体类型所在文件）、`web/components/HistoryMenu.tsx`（类型标签）；Test `tests/frontend-naming-entry.test.ts`，并更新 `tests/frontend-home-entry.test.ts`、`tests/frontend-home-parts.test.ts` 中受影响的断言

- [ ] **Step 1：写测试（先红）**：
  - 类型选项：`KIND_OPTIONS` 为四项，第四项「起名」；渲染出 4 个 `role="radio"`。
  - 分类结果 `kind: "naming"` 不再是未开放，`autoHint` 给「已自动识别为起名 · 人名」或「· 商号」。
  - `NamingFields`：
    - 人名模式渲染：姓氏输入框（`aria-label="姓氏"`）、单名或双名分段、生辰行、期望占位文字；
    - 商号模式渲染：字号字数 2、3、4 分段，「加上店主生辰（选填，用于五行补益）」折叠，以及「字号请自行查询商标与工商登记是否可用」；
    - 两种模式都不出现「五格」与日文假名。
  - `BirthFields` 起名模式（`mode="naming"`）：
    - 有「还没出生（按预产期）」勾选；
    - 勾选后日期标签为「预产期」、不显示时间框、性别多「不限」；
    - 默认模式下这些都不出现，既有生辰测试保持通过。
  - 可用条件（纯函数 `namingGate`）：
    - 人名：姓氏须为 1–2 个汉字（`/^[一-鿿]{1,2}$/`），生辰有效（未出生时只需日期与性别，性别可为不限）；
    - 商号：行业与期望至少 2 字；店主生辰要么不填，要么有效。
  - 起名生辰不覆盖本人档案：`QuestionForm.tsx` 源码中，起名模式用独立状态，不调用 `saveBirthProfile`。用源码断言加纯函数测试。
  - 付款请求体：起名时带 `kind: "naming"`、`target`、`surname`、`gender`、`length`、`unborn`、`birth`。性别为不限时，`birth.gender` 填 `"male"`，仅用于排盘。抽成纯函数 `namingRequest(...)` 测试。
- [ ] **Step 2–4：实现并通过。**
  - 问题框在起名模式下的占位文字：
    - 人名：「对名字的期望（选填）：如温和有书卷气、第二个字用『子』字辈」；
    - 商号：「做什么生意、想要什么感觉？例：社区咖啡馆，想要温暖安静」。
  - 人名模式下问题框可空（不受「至少 4 字」限制）。
  - 卦历浮层把 `naming` 显示为「起名」。

### Task 10：起名结果页

**Files:** Create `web/pages/NamingReading.tsx`、`web/components/NameCard.tsx`；Modify `web/pages/Reading.tsx`、`web/lib/reading-state.ts`（轮询与进度）、`web/styles/components.css`、`scripts/font-charset.ts`、`web/fonts/mashanzheng-chars.txt`、`web/fonts/mashanzheng-subset.woff2`、`web/fonts/mashanzheng-subset.sha256`；Test `tests/frontend-naming-reading.test.ts`

- [ ] **Step 1：写测试（先红）**，用手写的公开视图夹具：
  - 页面依次出现：「起名 · 人名（张姓 · 双名 · 女）」、期望原文、「三家合参」（推荐名的全名与理由、`overview`、`tips`）、三家面板（印章「五」「诗」「音」与家名）、9 张名字卡、「起名依据」折叠、页脚说明（五行判定规则；不用五格数理；查重名）。
  - 名字卡：
    - 全名与拼音；
    - 逐字行，含字、拼音、五行与依据、康熙笔画、释义，三级字标「较生僻」；
    - 寓意与理由；
    - 诗文家的出处为「诗经 · 周南·关雎」，原句中所用的字用 `<b>` 加重；
    - 音律提示。
  - 商号页：标题「起名 · 商号（2 字）」，没有姓；页脚为「注册前查询商标与工商登记」。
  - 未出生：起名依据注明「按预产期，时辰不详」。
  - 进度：
    - 三家写作中显示「三家起名中（n/3）」；
    - 合参写作中显示「正在写三家合参」；
    - 单家失败显示免费重试按钮（「免费重试（还可 N 次）」）。
  - `shouldPollReading` 对起名：任一家或合参为 writing 时轮询，全部结束后停止。
  - `Reading.tsx` 对 `kind === "naming"` 渲染 `NamingReading`。
- [ ] **Step 2–4：实现并通过。**
  - 样式沿用水墨夜：
    - 名字用 `var(--dynamic)` 楷体，桌面 28px、手机 24px；
    - 名字卡在桌面三列（每家一行三张）、手机单列；
    - 逐字信息用小表格，窄屏可横向滚动但页面主体不得横向溢出。
  - 字体：`FIXED_COPY` 加「起名、人名、商号、三家合参、五行补益、诗文出处、音形字义、起名依据、五、诗、音」。然后运行：
    1. `node --import tsx scripts/font-charset.ts`；
    2. `.venv-tools/bin/python scripts/subset-sanyi-font.py`；
    3. 重算 `web/fonts/mashanzheng-subset.sha256`，即 woff2 的 sha256 十六进制。
- [ ] **批末**：全量测试、类型检查、`npm run frontend:build`、`npm run frontend:secrets` 通过。若 npm 因缓存权限报错，改用 `node` 直接运行对应脚本，见 `package.json`。

---

## Chunk N5：验收（主管执行）

- [ ] 真实模型冒烟，用 `output/` 下的临时脚本：
  - 人名：张、双名、女、1990-05-15 15:30；
  - 未出生：李、双名、不限、预产期 2027-03-01；
  - 商号：社区咖啡馆、2 字；
  - 商号：卖手工皂、3 字。
- [ ] 检查要点：三家 done；名字合规；诗文出处可核；合参推荐在九个名字内；无禁用词；耗时。
- [ ] 截图走查：在 1320 与 390 宽度下看首页起名表单（人名、商号、未出生）和三种结果页。
- [ ] OpenSpec 任务勾选；向用户汇报。
