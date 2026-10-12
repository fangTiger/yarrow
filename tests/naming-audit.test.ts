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
    chars: [...given].map((char) => ({
      char, gloss: `${char}在名字里的好意`, sense: "用作名字意指温润明朗",
    })),
    tags: ["温和", "好学", "明朗"],
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
  const short = namingName("明泽", {
    chars: [{ char: "明", gloss: "明亮", sense: "用作名字意指明朗" }],
  });
  assert.match(auditFamily("wuxing", output(short), context).join("\n"), /chars.*逐字一致/);
  const wrong = namingName("明泽", {
    chars: [
      { char: "明", gloss: "明亮", sense: "用作名字意指明朗" },
      { char: "河", gloss: "河流", sense: "用作名字意指宽广" },
    ],
  });
  assert.match(auditFamily("wuxing", output(wrong), context).join("\n"), /chars.*逐字一致/);
});

test("sense 与 tags 核对禁用词、消极字及长度", () => {
  const bad = namingName("明泽", {
    chars: [
      { char: "明", gloss: "明亮", sense: "用作名字意指开光转运" },
      { char: "泽", gloss: "恩泽", sense: "甲".repeat(31) },
    ],
    tags: ["哀愁", "好", "过分冗长词", "开光"],
  });
  const errors = auditFamily("wuxing", output(bad), context).join("\n");
  assert.match(errors, /sense.*禁用词|禁用词.*sense/u);
  assert.match(errors, /sense.*1 至 30 字/u);
  assert.match(errors, /tags.*消极字/u);
  assert.match(errors, /tags.*2 至 4 字/u);
});

test("修补时 sense 先用模型逐字字义兜底，不给字典首义套「用作名字意指」，并按名字五行兜底 tags", () => {
  const bad = namingName("明泽", {
    chars: [
      { char: "明", gloss: "明亮", sense: "开光" },
      { char: "泽", gloss: "恩泽", sense: "" },
    ],
    tags: ["哀愁", "坏"],
  });
  const repaired = repairFamily("wuxing", output(bad), context).output.names[0];
  assert.ok(repaired);
  assert.deepEqual(repaired.chars.map(({ sense }) => sense), ["取「明亮」之意", "取「恩泽」之意"]);
  // 逐字字义也不合格时，用字典释义原文，不加前缀。
  const both = namingName("明泽", {
    chars: [
      { char: "明", gloss: "", sense: "" },
      { char: "泽", gloss: "", sense: "" },
    ],
  });
  const plain = repairFamily("wuxing", output(both), context).output.names[0];
  assert.ok(plain?.chars.every(({ sense }) => !sense.startsWith("用作名字意指") && [...sense].length <= 30));
  assert.ok(repaired.tags.length >= 3);
  assert.ok(repaired.tags.includes("聪慧") || repaired.tags.includes("灵动"));
  assert.deepEqual(auditFamily("wuxing", output(repaired), context), []);
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

test("核对拒绝对外文案中的内部候选编号，修补时改写为所引原句", () => {
  const leaked = output(namingName("河洲", {
    sourceId: "S01",
    meaning: "取 S01 原句的水岸意象",
    why: "取S01中河、洲二字",
  }));
  leaked.note = "依 S01 原句取名";
  assert.match(auditFamily("shiwen", leaked, context).join("\n"), /候选编号.*重写/u);
  const repaired = repairFamily("shiwen", leaked, context).output;
  assert.doesNotMatch([
    repaired.note,
    ...repaired.names.flatMap((name) => [name.meaning, name.why]),
  ].join("\n"), /S\d{2}/u);
  assert.match(repaired.note, /所引原句/u);
  assert.match(repaired.names[0]?.meaning ?? "", /所引原句/u);
  assert.match(repaired.names[0]?.why ?? "", /所引原句/u);
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
  const malformed = namingName("清宁", {
    chars: [{ char: "清", gloss: "清澈", sense: "用作名字意指清澈" }],
  });
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
  assert.match(toneHints("张", "乐清").join("\n"), /「乐」是多音字（lè、yuè），请确认读音/);
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

test("合参有至少两个无全同声调提示的名字时拒绝带提示的推荐", () => {
  const output = {
    picks: [
      { given: "清淑", reason: "与张姓音调协调" },
      { given: "明泽", reason: "五行与字义兼顾" },
    ],
    overview: "三家各有侧重。",
    tips: ["念出全名听听是否顺口", "上户口前查一查重名"],
  };
  const options = { target: "person" as const, sameToneNames: ["清淑"] };
  assert.match(
    auditNamingSummary(output, ["清淑", "明泽", "河洲"], options).join("\n"),
    /清淑.*姓名声调全同.*不应优先推荐/u,
  );
  assert.doesNotMatch(
    auditNamingSummary(output, ["清淑", "明泽"], options).join("\n"),
    /不应优先推荐/u,
  );
});

test("合参挑选提示须符合人名或商号对象", () => {
  const base = {
    picks: [{ given: "明泽", reason: "五行与字义兼顾" }, { given: "河洲", reason: "出处清楚" }],
    overview: "三家各有侧重。",
    tips: ["念出全名听听是否顺口", "问问家人方言里有无不雅谐音"],
  };
  assert.match(auditNamingSummary({
    ...base, tips: ["念出全名听听是否顺口", "可查重名与商标"],
  }, ["明泽", "河洲"], { target: "person" }).join("\n"), /人名.*商标/u);
  assert.match(auditNamingSummary({
    ...base, tips: ["念出字号听听是否顺口", "注册前查重名与户口"],
  }, ["明泽", "河洲"], { target: "business" }).join("\n"), /商号.*重名|户口/u);
});

test("合参修补跳过全同声调名字，并替换对象不符的挑选提示", () => {
  const bad = {
    picks: [
      { given: "清淑", reason: "合张姓音调" },
      { given: "云舒", reason: "不在清单" },
    ],
    overview: "三家各有侧重。",
    tips: ["念出全名听听是否顺口", "可查重名与商标"],
  };
  const families = {
    wuxing: ["清淑", "明泽"],
    shiwen: ["清淑", "河洲"],
    yinyi: ["清淑", "知涵"],
  };
  const repaired = repairNamingSummary(bad, families, "person", ["清淑"]);
  assert.deepEqual(repaired.output.picks, [
    { given: "明泽", reason: "五行补益首选" },
    { given: "河洲", reason: "诗文出处首选" },
    { given: "知涵", reason: "音形字义首选" },
  ]);
  assert.deepEqual(repaired.output.tips, [
    "念出全名听听是否顺口",
    "问问家人方言里有无不雅谐音",
    "上户口前查一查重名",
  ]);
});

test("只有一家落笔时仍可从该家其它无提示名字补足推荐", () => {
  const repaired = repairNamingSummary({
    picks: [
      { given: "明泽", reason: "五行与字义兼顾" },
      { given: "云舒", reason: "不在清单" },
    ],
    overview: "此家提供三个合格名字。",
    tips: ["念出全名听听是否顺口", "上户口前查一查重名"],
  }, { wuxing: ["明泽", "知涵", "河洲"] }, "person");
  assert.deepEqual(repaired.output.picks.map(({ given }) => given), ["明泽", "知涵"]);
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
