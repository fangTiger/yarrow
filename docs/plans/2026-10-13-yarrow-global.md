# Yarrow 面向海外 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> 本计划由 codex（gpt-5.6-sol）分批执行（G0–G4），Claude 每批审查、测试、提交。

**Goal:** 让外国用户能看懂、能付款、能用英文读完结果；海外出生的八字排对。

**Architecture:**
- 生辰加 IANA 时区，海外时区按 A/B 拆分排盘；
- 前端加字典式 i18n（Context + useT），首页改版；
- 服务端对已完成的中文结果按单元翻译，译文存旁路文件，随 GET 下发；
- 确定性内容走术语表，古文走离线译表。

**Tech Stack:** TypeScript strict、React 18、esbuild、Node test runner + tsx、Intl（时区）、DeepSeek 结构化输出、Ajv。

**依据：** `docs/plans/2026-10-13-yarrow-global-design.md`（简称「设计」）；OpenSpec `openspec/changes/yarrow-global/`。

## 通用约定（每批都适用）

- TDD：先写测试 → 运行确认失败 → 实现 → 运行确认通过。
- 风格同现有代码：ESM、`.js` 后缀导入、行宽 ≤110、注释与日志用中文。
- 命令：
  - 单测 `node --import tsx --test tests/<file>.test.ts`；
  - 全量 `node --import tsx --test "tests/*.test.ts"`；
  - 类型 `./node_modules/.bin/tsc --noEmit`；
  - 构建与秘密扫描按 `package.json` 的实际命令，用 node 直接运行。
- 不联网、不写 git、不安装依赖。沙箱内监听端口的测试失败（EPERM）如实列出。
- 既有测试的期望只在本设计必然改变时调整，并在报告中逐条列出。
- 文化守卫：不出现日文假名与「・」，不出现易者、押钱、赔付、封存，不出现五格术语。
- 浏览器包不得引入字库、诗文语料与服务端模块；只允许类型导入，以及纯数据的术语表。

---

## G0：出生时区与语言守卫

**Files：**
- Modify：`src/sanyi/birth-profile.ts`、`src/calendar/solar-time.ts`、`src/calendar/bazi.ts`（或新增 `src/calendar/birth-instant.ts`）、`src/sanyi/bazi-public.ts`（校正摘要）、`src/sanyi/naming/service.ts`；
- Modify：三家、总述、起名提示词与核对：`src/sanyi/schools/*`、`src/sanyi/summary.ts`、`src/sanyi/naming/families.ts`，以及相应核对文件；
- Modify：`web/lib/birth-profile.ts`、`web/components/BirthFields.tsx`（出生地时区选择，默认浏览器时区）；
- Test：`tests/birth-timezone.test.ts`、`tests/language-guard.test.ts`，并补充相关既有测试。

**要点：**
- [ ] `BirthProfileInput.timeZone?: string`：缺省或 `Asia/Shanghai` 时走现有路径，结果逐字节不变。现有中国夹具全部保持原样，这是硬性验收条件。
- [ ] 其他时区：
  - `localToInstant(civil, tz)`：用 Intl.formatToParts 反推偏移，迭代两次；识别重复与跳跃时段，取较早者并返回 `ambiguous` 或 `skipped` 标注；
  - `standardOffset(tz, year)`：取当年 1 月 1 日与 7 月 1 日两个偏移中较小的；
  - A = instant 换算的北京钟面时间，B = 当地标准时；
  - 年月相同时用 B 的整组八字；不同时年月取 A，并按 LunarUtil 表重算十神、命宫、身宫；
  - 胎元、大运、起运一律按 A。
- [ ] 校正摘要：增加 `timeZone` 与 `localStandard`，如「按出生地时区 America/New_York，换算为当地标准时 09:30」。分享视图同样不显示原始生辰。
- [ ] 前端：
  - 生辰行加「出生地时区」下拉：常用 30 个时区，外加「其他」可输入 IANA 名；
  - 默认取浏览器时区；
  - 本机保存的旧生辰没有时区时显示为 Asia/Shanghai。
- [ ] 夹具（手工换算的期望值写在测试注释里）：
  - America/New_York：1995-07-04 10:30（夏令时）与 1995-01-15 08:00；
  - Europe/London：1990-06-01 14:00；
  - Australia/Sydney：2000-12-25 06:00；
  - Asia/Kathmandu：1998-03-21 23:40（+5:45，跨子时）；
  - 一个跳跃时段与一个重复时段。
- [ ] 属性测试：随机取 200 个海外时刻，当 A、B 年月相同时，拼出的八字与 lunar-javascript 直接计算 B 的结果逐字段相等。
- [ ] 语言守卫：
  - 提示词加「问题可能是英文，请仍用中文作答」；
  - 核对：正文汉字占比低于 50% 判为不合格，错误信息写明「请用中文作答」。

## G1：语言切换与首页链路

**Files：**
- Create：`web/i18n/zh.ts`、`web/i18n/en.ts`、`web/lib/i18n.tsx`（LangProvider、useT、detectLang、I18nError、zhT）、`web/components/LangToggle.tsx`、`tests/helpers/render-in.ts`；
- Modify：`web/main.tsx`、`web/pages/Home.tsx`、`QuestionForm.tsx`、`BirthFields.tsx`、`NamingFields.tsx`、`KindOptions.tsx`、`SubjectSelect.tsx`、`HorizonChips.tsx`、`PaymentButton.tsx`、`HistoryMenu.tsx`、钱包相关组件、`web/lib/*` 中首页链路用到的纯函数、`web/wagmi.ts`、`web/index.html`、`web/styles/tokens.css`、`scripts/font-charset.ts`；
- Modify：`src/sanyi/http-errors.ts` 与 `src/sanyi/api.ts`（付款、生辰、输入校验类错误加 `code`）、前端错误映射；
- Test：`tests/frontend-i18n.test.ts`，以及首页相关既有测试（formHarness 补 `useContext`）。

**要点：**
- [ ] 字典与占位符一致性测试；英文值除白名单外不含汉字。
- [ ] Context 默认 zh；`main.tsx` 里检测语言，读写 localStorage 失败时降级。
- [ ] 首页链路全部文案迁移，两种语言都要有渲染测试。
- [ ] 钱包状态引导（设计 5.7）：没有钱包、网络不对、余额为 0 三种状态；手机深链；付款详情折叠。
- [ ] 字体变量：`html:lang(en)` 下改写；字符表改为从 zh.ts 读取，并重建字符表。字体子集由主管联网重建。
- [ ] RainbowKit 的 locale 随语言；index.html 的 lang、title、description；测试同步更新。

## G2：服务端翻译

**Files：**
- Create：`src/sanyi/translation/{units.ts,prompt.ts,check.ts,service.ts,store.ts}`、`src/sanyi/i18n/glossary.ts`（服务端与浏览器共用的纯数据，带 `GLOSSARY_VERSION`）；
- Modify：`src/sanyi/api.ts`、`src/frontend/server.ts`（新增 `POST /api/readings/:id/translate`；`GET` 支持 `?lang=en` 附带译文）、`src/sanyi/mock-provider.ts`（mock 翻译）；
- Test：`tests/translation-*.test.ts`。

**要点：**
- [ ] `extractUnits(reading)`：按设计第 6 节的字段归属，问事、八字、起名各抽出总述与三家，共 4 个单元；每单元是有序的 `{ path, text }` 列表。
- [ ] 提示词：
  - 附术语表中与本单元相关的词条；
  - 附本单元正文引用到的离线古文译文；
  - 输出 `{ texts: string[] }`，与输入一一对应。
- [ ] `checkTranslation`：
  - 条数一致；
  - 不含汉字（白名单除外）；
  - 原文中的阿拉伯数字与四位年份在译文中保留；
  - 原文出现的术语表词，译文须含其规定译名。
  - 只补译缺项与错项一次。
- [ ] 存储：
  - 写入 `data/translations/<id>.en.json`，格式为 `{ units: { [unitKey]: { status, sourceHash, texts?, attempts, failures, cooldownUntil? } } }`；
  - `sourceHash` = sha256(单元原文 + PROMPT_VERSION + GLOSSARY_VERSION)。
- [ ] 终态判断：单元对应部分为 done 或 failed，且总述不在 writing。否则 POST 返回 409 与「not-ready」，前端稍后重试。
- [ ] 并发：
  - 进程内用 Map 按 `id:unitKey` 去重；
  - 全局信号量，默认 3；
  - 同一单元连续失败 3 次后冷却 10 分钟；
  - 每日单元数熔断，额度来自 `TRANSLATION_DAILY_UNITS`，默认 500。
- [ ] 离线古文译表 `src/agent/zhouyi-en.json`：由主管生成，本批只实现加载、校验（条数齐全）与按卦和爻查询接口；数据文件未就绪时用占位并让测试跳过数据断言。
- [ ] mock 翻译：用确定性的英文占位，保证各类测试可跑。

## G3：结果页英文化

**Files：**
- Modify：`web/pages/Reading.tsx`、`BaziReading.tsx`、`NamingReading.tsx` 及其组件（PlainSummaryPanel、RemedyPanel、SchoolCards、BaziSchools、NameCard、WuxingPanel、WuxingDiagram、六爻与八字盘相关组件）、`web/lib/reading-state.ts`、`web/lib/api.ts`；
- Modify：`src/sanyi/naming/public.ts`（输出用字分析的结构化字段：char、wuxing、basisCode、relationCode）、`src/sanyi/naming/card.ts`；
- Test：`tests/frontend-*-en.test.ts`。

**要点：**
- [ ] 结果页文案全部迁入字典。
- [ ] 英文模式：
  - 自动请求翻译，单元未就绪时显示「Translating…」并先显示中文；失败给免费重试；
  - 术语表负责卦名、五行、干支、十神、六亲、吉凶、事项；
  - 古文显示原文与离线译文，标注「Translation by Yarrow」；
  - evidence 隐藏；神煞、纳音、黄历、奇门折叠为「Traditional chart (Chinese)」。
- [ ] 起名：用字分析、五德、提示改用英文模板（依据结构化字段与提示码）；名字保留汉字与拼音。
- [ ] 中文模式的渲染结果不变。

## G4：八卦首页与示例

**Files：**
- Modify：`web/components/Luopan.tsx`（卦位固定、外圈旋转、双语标签、reduced-motion）、`web/pages/Home.tsx`、`KindOptions.tsx`（类型卡与示例问题）、`SubjectSelect.tsx`（英文必选）、`NamingFields.tsx`（姓氏选择器）；
- Create：`web/pages/SampleReading.tsx`（只读）、`web/lib/surnames.ts`（100 个常见姓：拼音、英文字义）、`web/samples/*.json`（主管生成）；
- Test：`tests/frontend-home-en.test.ts`、`tests/frontend-sample.test.ts`。

**要点：**
- [ ] 八卦卦位测试：离上、坎下、震左、兑右等八个方位逐一断言；外圈装饰环单独旋转；reduced-motion 下静止。
- [ ] 英文模式下类型与事项手选，关键词只做预选；识别不到事项时不默认；感情事项的说明。
- [ ] 示例路由只读：没有重试、改事项、换日按钮；BaziReading 传 `birth={null}`；有「示例」横幅；数据文件缺失时显示「示例准备中」。
- [ ] 姓氏选择器：100 个姓都通过 `isSurname`（测试里由服务端字库校验）；拼音、英文字义、首字母筛选；仍可输入汉字。
- [ ] 免责声明与等待说明，中英各一。
