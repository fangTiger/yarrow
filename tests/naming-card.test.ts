import assert from "node:assert/strict";
import test from "node:test";
import { isNegativeChar, type ClassicLine } from "../src/sanyi/naming/classics.js";
import {
  charAnalysisData,
  charAnalysis,
  echoLines,
  nameHintCodes,
  nameScores,
  nameSupplements,
} from "../src/sanyi/naming/card.js";
import { publicNamingReading } from "../src/sanyi/naming/public.js";
import { namingBirth, namingFixture, namingProof } from "./helpers/naming-service.js";

test("好听分按姓名或商号声调、音律提示、多音字与三级字扣分", () => {
  assert.equal(nameScores({
    target: "person", surname: "张", given: "章昌", favorable: ["金"], missing: [],
  }).sound, 66);
  assert.equal(nameScores({
    target: "business", given: "章昌", favorable: ["金"], missing: [],
  }).sound, 84);
  assert.equal(nameScores({
    target: "business", given: "和燚", favorable: ["火"], missing: [],
  }).sound, 84);
});

test("字形分按简体笔画、等级与笔画差扣分", () => {
  assert.equal(nameScores({
    target: "business", given: "鑫亍", favorable: ["金"], missing: [],
  }).form, 72);
});

test("八字五行分按补益字比例与所缺五行加分，无补益时为 80", () => {
  assert.equal(nameScores({
    target: "person", surname: "张", given: "瑶明", favorable: ["金"], missing: ["金"],
  }).wuxing, 86);
  assert.equal(nameScores({
    target: "person", surname: "张", given: "瑶明", favorable: ["金", "火"], missing: ["金"],
  }).wuxing, 98);
  assert.equal(nameScores({
    target: "business", given: "瑶明", favorable: null, missing: [],
  }).wuxing, 80);
});

test("诗文意蕴按出处核验、全字同句、逐字频次、任一出现分五档", () => {
  const common = { target: "person" as const, surname: "张", favorable: ["金"] as const, missing: [] };
  assert.equal(nameScores({ ...common, given: "鑫燚", sourceVerified: true }).poetry, 96);
  assert.equal(nameScores({ ...common, given: "明月" }).poetry, 92);
  assert.equal(nameScores({ ...common, given: "书雅" }).poetry, 92);
  assert.equal(nameScores({ ...common, given: "瑶雅" }).poetry, 84);
  assert.equal(nameScores({ ...common, given: "书鑫" }).poetry, 76);
  assert.equal(nameScores({ ...common, given: "鑫燚" }).poetry, 70);
});

test("四项分下限为 60，综合分为四项平均后四舍五入", () => {
  const scores = nameScores({
    target: "person", surname: "张", given: "亍亍亍亍", favorable: ["木"], missing: [],
  });
  assert.ok([scores.sound, scores.form, scores.wuxing, scores.poetry]
    .every((score) => score >= 60));
  assert.equal(scores.overall,
    Math.round((scores.sound + scores.form + scores.wuxing + scores.poetry) / 4));
});

test("补益标记和用字分析分别覆盖缺、补、行业与只写寓意", () => {
  assert.deepEqual(nameSupplements("瑶明", ["金", "火"]), [
    { element: "火", chars: ["明"] },
    { element: "金", chars: ["瑶"] },
  ]);
  assert.equal(charAnalysis("瑶", {
    target: "person", favorable: ["金"], missing: ["金"], favorableSource: "missing",
  }), "「瑶」五行属金（部首·玉），补八字所缺之金；金主义，寓意果断重义、坚毅有守。");
  assert.match(charAnalysis("明", {
    target: "person", favorable: ["火"], missing: ["金"], favorableSource: "missing",
  }), /合所补之火/u);
  assert.match(charAnalysis("明", {
    target: "business", favorable: ["火"], missing: [], favorableSource: "industry",
  }), /合行业之火/u);
  assert.doesNotMatch(charAnalysis("嘉", {
    target: "person", favorable: ["金"], missing: ["金"], favorableSource: "missing",
  }), /补八字|合所补|合行业/u);
});

test("用字分析公开结构只含字、五行、依据码与关系码", () => {
  assert.deepEqual(charAnalysisData("瑶", {
    target: "person", favorable: ["金"], missing: ["金"], favorableSource: "missing",
  }), { char: "瑶", wuxing: "金", basisCode: "radical-jade", relationCode: "missing" });
  assert.deepEqual(charAnalysisData("明", {
    target: "business", favorable: ["火"], missing: [], favorableSource: "industry",
  }), { char: "明", wuxing: "火", basisCode: "radical-sun", relationCode: "industry" });
  assert.equal(charAnalysisData("嘉", {
    target: "person", favorable: ["金"], missing: ["金"], favorableSource: "missing",
  }).relationCode, "neutral");
});

test("音律提示公开为 code 与参数，不公开固定中文句子", () => {
  assert.deepEqual(nameHintCodes("张", "章泽"), [
    { code: "same-initial", params: { surname: "张", char: "章" } },
    { code: "same-final", params: { surname: "张", char: "章" } },
  ]);
  assert.deepEqual(nameHintCodes("张", "乐亍"), [
    { code: "rare-char", params: { char: "亍" } },
    { code: "polyphonic", params: { char: "乐", readings: "lè, yuè" } },
  ]);
});

test("意蕴内涵至多三句，先取含全部字的一句并稳定过滤和排除出处", () => {
  const lines = echoLines("明月");
  assert.ok(lines.length <= 3);
  assert.equal(lines[0]?.id, "sc-0034-03");
  assert.ok([..."明月"].every((char) => lines[0]?.text.includes(char)));
  assert.ok(lines.every((line) => ![...line.text].some(isNegativeChar) && !/[《》]/u.test(line.text)));
  const excluded = echoLines("明月", "sc-0034-03");
  assert.ok(excluded.every(({ id }) => id !== "sc-0034-03"));
  assert.deepEqual(echoLines("明月").map(({ id }) => id), lines.map(({ id }) => id));
});

test("意蕴内涵优先选意象分高的句子，同分按书序与编号稳定排序", () => {
  const corpus: ClassicLine[] = [
    { id: "sj-test-01", book: "诗经", title: "低分", text: "书灵的了不无有所是此彼尔汝" },
    { id: "ly-test-02", book: "论语", title: "高分三", text: "书清淑诗灵明月" },
    { id: "ts-test-02", book: "唐诗三百首", title: "高分二", text: "书清淑诗灵明月" },
    { id: "ts-test-01", book: "唐诗三百首", title: "高分一", text: "书清淑诗灵明月" },
  ];
  const ids = echoLines("书灵", undefined, corpus).map(({ id }) => id);
  assert.deepEqual(ids, ["ts-test-01", "ts-test-02", "ly-test-02"]);
  assert.deepEqual(echoLines("书灵", undefined, corpus).map(({ id }) => id), ids);
});

test("公开视图附评分、补益、分析、回响与姓氏字块，并兼容旧存档", async () => {
  const f = await namingFixture();
  try {
    const created = await f.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    const stored = await f.naming.getReading(created.id);
    const view = publicNamingReading(stored);
    const name = view.families.wuxing.output?.names[0];
    assert.ok(name);
    assert.equal(typeof name.scores.overall, "number");
    assert.ok(Array.isArray(name.supplements));
    assert.equal(name.analysis.length, [...name.given].length);
    assert.ok(name.analysis.every((item) => (
      Object.keys(item).sort().join(",") === "basisCode,char,relationCode,wuxing"
      && typeof item.char === "string"
      && typeof item.basisCode === "string"
      && typeof item.relationCode === "string"
    )));
    assert.ok(name.hints.every((hint) => (
      Object.keys(hint).sort().join(",") === "code,params"
      && typeof hint.code === "string"
      && typeof hint.params === "object"
    )));
    assert.ok(name.echoes.length <= 3);
    assert.ok(name.chars.every((item) => typeof item.sense === "string"));
    assert.equal(name.surnameChars?.length, 1);

    delete stored.basis.counts;
    delete stored.basis.missing;
    for (const family of Object.values(stored.families)) {
      if (!family.output) continue;
      for (const oldName of family.output.names) {
        delete (oldName as { tags?: string[] }).tags;
        for (const item of oldName.chars) delete (item as { sense?: string }).sense;
      }
    }
    assert.doesNotThrow(() => publicNamingReading(stored));
  } finally {
    await f.close();
  }
});

test("意蕴内涵优先 7 字以上的整句，短句意象分再高也排在后面", () => {
  const corpus = [
    { id: "sc-0001-01", book: "宋词三百首", title: "甲", text: "近清明" },
    { id: "ts-0001-01", book: "唐诗三百首", title: "乙", text: "明月松间照，清泉石上流" },
  ];
  assert.equal(echoLines("清", undefined, corpus)[0]?.id, "ts-0001-01");
  // 只有短句时仍可入选。
  assert.equal(echoLines("清", undefined, corpus.slice(0, 1))[0]?.id, "sc-0001-01");
});
