import assert from "node:assert/strict";
import test from "node:test";
import {
  auditFamily,
  auditNamingSummary,
  repairFamily,
  repairNamingSummary,
  toneHints,
} from "../src/sanyi/naming/audit.js";
import type { NamingContext, NamingFamilyOutput, NamingName } from "../src/sanyi/naming/schema.js";

const context: NamingContext = {
  target: "person",
  surname: "张",
  gender: "female",
  length: 2,
  question: "温和有书卷气",
  favorable: ["火", "水"],
  favorableSource: "tiaohou",
  favorableNote: "调候取丙、癸",
  candidates: [{ id: "sj-0001-01", book: "诗经", title: "周南·关雎", text: "关关雎鸠，在河之洲" }],
};

function namingName(given: string, extra: Partial<NamingName> = {}): NamingName {
  return {
    given,
    meaning: "寓意温润明朗",
    why: "读写自然",
    chars: [...given].map((char) => ({ char, gloss: `${char}在名字里的好意` })),
    ...extra,
  };
}

function output(...names: NamingName[]): NamingFamilyOutput {
  return { note: "兼顾名字的读音与寓意。", names };
}

test("通用核对报告字数、表外或不宜入名字、重复与禁用词", () => {
  assert.match(auditFamily("wuxing", output(namingName("明")), context).join("\n"), /应为 2 字/);
  assert.match(auditFamily("wuxing", output(namingName("明死")), context).join("\n"), /死.*不宜入名/);
  assert.match(auditFamily("wuxing", output(namingName("明𪚥")), context).join("\n"),
    /𪚥.*不在通用规范汉字表/);
  assert.match(auditFamily("wuxing", output(
    namingName("明泽"), namingName("明泽"), namingName("知夏"),
  ), context).join("\n"), /明泽.*重复/);
  assert.match(auditFamily("wuxing", {
    ...output(namingName("明泽")), note: "按五格取名，另配开光物。",
  }, context).join("\n"), /五格|开光/);
});

test("chars 须与 given 逐字一致", () => {
  const short = namingName("明泽", { chars: [{ char: "明", gloss: "明亮" }] });
  assert.match(auditFamily("wuxing", output(short), context).join("\n"), /chars.*逐字一致/);
  const wrong = namingName("明泽", {
    chars: [{ char: "明", gloss: "明亮" }, { char: "河", gloss: "河流" }],
  });
  assert.match(auditFamily("wuxing", output(wrong), context).join("\n"), /chars.*逐字一致/);
});

test("五行家每名至少一字属喜用，商号自选时必须声明 element", () => {
  assert.match(auditFamily("wuxing", output(namingName("林森")), context).join("\n"),
    /林森.*无一字属喜用（火、水）/);
  assert.deepEqual(auditFamily("wuxing", output(namingName("明泽")), context), []);
  const { surname: _surname, ...withoutSurname } = context;
  const business: NamingContext = {
    ...withoutSurname, target: "business", gender: "any",
    favorable: null, favorableSource: "model",
  };
  assert.match(auditFamily("wuxing", output(namingName("明泽")), business).join("\n"), /element/);
  assert.deepEqual(auditFamily("wuxing", { ...output(namingName("林森")), element: "木" }, business), []);
});

test("诗文家核对候选编号及每个取名字", () => {
  assert.match(auditFamily("shiwen", output(namingName("河洲")), context).join("\n"), /sourceId/);
  assert.match(auditFamily("shiwen", output(namingName("河洲", { sourceId: "S99" })), context)
    .join("\n"), /S99.*不在候选/);
  assert.deepEqual(auditFamily("shiwen", output(namingName("河洲", { sourceId: "S01" })), context), []);
  assert.match(auditFamily("shiwen", output(namingName("河清", { sourceId: "S01" })), context)
    .join("\n"), /清.*不在所引诗句中/);
});

test("音义家禁止全名同调，叠字除外", () => {
  assert.match(auditFamily("yinyi", output(namingName("思清")), context).join("\n"),
    /思清.*姓名声调全同/);
  assert.deepEqual(auditFamily("yinyi", output(namingName("思远")), context), []);
  assert.deepEqual(auditFamily("yinyi", output(namingName("依依")), context), []);
  const single: NamingContext = { ...context, length: 1 };
  assert.match(auditFamily("yinyi", output(namingName("思")), single).join("\n"),
    /思.*姓名声调全同/);
});

test("三次不过后的修补保留合格名，仅 chars 不合格时用字库释义补齐", () => {
  const malformed = namingName("清宁", { chars: [{ char: "清", gloss: "清澈" }] });
  const repaired = repairFamily("wuxing", output(
    namingName("明泽"), namingName("林森"), malformed,
  ), context);
  assert.equal(repaired.removed, 1);
  assert.deepEqual(repaired.output.names.map(({ given }) => given), ["明泽", "清宁"]);
  assert.deepEqual(repaired.output.names[1]?.chars.map(({ char }) => char), ["清", "宁"]);
  assert.ok(repaired.output.names[1]?.chars.every(({ gloss }) => [...gloss].length <= 12));
  assert.deepEqual(auditFamily("wuxing", repaired.output, context), []);
  const empty = repairFamily("wuxing", output(
    namingName("林森"), namingName("松柏"), namingName("荣杰"),
  ), context);
  assert.deepEqual(empty.output.names, []);
  assert.equal(empty.removed, 3);
});

test("音律提示覆盖同调、相邻同声韵、生僻字与多音字", () => {
  assert.match(toneHints("张", "思清").join("\n"), /姓名声调全同/);
  assert.match(toneHints("张", "思").join("\n"), /姓名声调全同/);
  assert.match(toneHints("张", "章泽").join("\n"), /同声母|同韵母/);
  assert.match(toneHints("张", "明亍").join("\n"), /亍.*较生僻/);
  assert.match(toneHints("张", "乐清").join("\n"), /「乐」是多音字（le、yue），请确认读音/);
});

test("合参核对只准推荐合格名字且不可重复", () => {
  const base = {
    picks: [{ given: "明泽", reason: "五行与字义兼顾" }, { given: "清宁", reason: "音义温和" }],
    overview: "三家都重视寓意，各有侧重。",
    tips: ["念出全名听听是否顺口", "问问家人方言里有无不雅谐音"],
  };
  assert.deepEqual(auditNamingSummary(base, ["明泽", "清宁"]), []);
  assert.match(auditNamingSummary({
    ...base, picks: [{ given: "明泽", reason: "好" }, { given: "云舒", reason: "好" }],
  }, ["明泽", "清宁"]).join("\n"), /云舒.*不在合格名字中/);
  assert.match(auditNamingSummary({
    ...base, picks: [{ given: "明泽", reason: "好" }, { given: "明泽", reason: "好" }],
  }, ["明泽", "清宁"]).join("\n"), /明泽.*重复/);
});

test("合参修补去尽推荐时取各家首选，并按对象补固定提示", () => {
  const bad = {
    picks: [{ given: "云舒", reason: "开光后更好" }, { given: "山高", reason: "五格大吉" }],
    overview: "可配法器转运。",
    tips: ["看五格数理", "购买开光物"],
  };
  const families = { wuxing: ["明泽", "知夏"], shiwen: ["河洲"], yinyi: ["清宁"] };
  const person = repairNamingSummary(bad, families, "person");
  assert.equal(person.removed, 2);
  assert.deepEqual(person.output.picks, [
    { given: "明泽", reason: "五行补益首选" },
    { given: "河洲", reason: "诗文出处首选" },
    { given: "清宁", reason: "音形字义首选" },
  ]);
  assert.deepEqual(person.output.tips, [
    "念出全名听听是否顺口",
    "问问家人方言里有无不雅谐音",
    "上户口前查一查重名",
  ]);
  const business = repairNamingSummary(bad, families, "business");
  assert.equal(business.output.tips[2], "注册前查询商标与工商登记");
  assert.deepEqual(auditNamingSummary(person.output, ["明泽", "河洲", "清宁"]), []);
});

test("合格名字仅因推荐理由违规被删后，仍可作为各家首选兜底", () => {
  const bad = {
    picks: [{ given: "明泽", reason: "配开光物" }, { given: "河洲", reason: "按五格数理" }],
    overview: "三家各有侧重。",
    tips: ["念出全名听听是否顺口", "问问家人方言里有无不雅谐音"],
  };
  const repaired = repairNamingSummary(bad, {
    wuxing: ["明泽"], shiwen: ["河洲"], yinyi: ["清宁"],
  }, "person");
  assert.deepEqual(repaired.output.picks.map(({ given }) => given), ["明泽", "河洲", "清宁"]);
});

test("三家首选重名时，各家改取首个尚未推荐的合格名字", () => {
  const bad = {
    picks: [{ given: "云舒", reason: "不在清单" }, { given: "山高", reason: "不在清单" }],
    overview: "三家各有侧重。",
    tips: ["念出全名听听是否顺口", "问问家人方言里有无不雅谐音"],
  };
  const repaired = repairNamingSummary(bad, {
    wuxing: ["明泽", "清宁"],
    shiwen: ["明泽", "河洲"],
    yinyi: ["明泽", "知涵"],
  }, "person");
  assert.deepEqual(repaired.output.picks.map(({ given }) => given), ["明泽", "河洲", "知涵"]);
});
