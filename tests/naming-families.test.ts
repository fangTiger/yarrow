import assert from "node:assert/strict";
import test from "node:test";
import { validateStructuredOutput } from "../src/agent/provider.js";
import type { ClassicLine } from "../src/sanyi/naming/classics.js";
import { NAMING_FAMILIES, type NamingContext } from "../src/sanyi/naming/families.js";
import {
  NAMING_FAMILY_SCHEMA,
  NAMING_SUMMARY_SCHEMA,
  type NamingFamilyOutput,
  type NamingSummaryOutput,
} from "../src/sanyi/naming/schema.js";

const candidates: ClassicLine[] = Array.from({ length: 60 }, (_, index) => ({
  id: `source-${String(index + 1).padStart(2, "0")}`,
  book: index === 0 ? "诗经" : index === 1 ? "唐诗三百首" : "楚辞",
  title: index === 0 ? "周南·关雎" : index === 1 ? "杜甫《春望》" : `篇目${index + 1}`,
  text: index === 0 ? "关关雎鸠，在河之洲" : index === 1 ? "江流天地外" : `清和雅正天地玄黄${index + 1}`,
}));

const person: NamingContext = {
  target: "person",
  surname: "张",
  gender: "female",
  length: 2,
  question: "温和有书卷气",
  favorable: ["火", "水"],
  favorableSource: "tiaohou",
  favorableNote: "调候取丙、癸",
  candidates,
};

const business: NamingContext = {
  target: "business",
  gender: "any",
  length: 2,
  question: "卖手工皂，朴素自然",
  favorable: null,
  favorableSource: "model",
  favorableNote: "行业未匹配，由五行补益家自选",
  candidates,
};

const familyOutput: NamingFamilyOutput = {
  note: "兼顾字义与读音。",
  names: ["明泽", "清宁", "知夏"].map((given) => ({
    given,
    meaning: "温润明朗",
    why: "读写自然",
    chars: [...given].map((char) => ({ char, gloss: "名字里的好寓意" })),
  })),
};

test("三家 Schema 限定项目数、字数、枚举与多余字段", () => {
  assert.doesNotThrow(() => validateStructuredOutput(NAMING_FAMILY_SCHEMA, familyOutput));
  const invalid: unknown[] = [
    { ...familyOutput, names: familyOutput.names.slice(0, 2) },
    { ...familyOutput, names: familyOutput.names.map((name, index) => (
      index === 0 ? { ...name, given: "天地玄黄宇" } : name
    )) },
    { ...familyOutput, names: familyOutput.names.map((name, index) => (
      index === 0 ? { ...name, meaning: "甲".repeat(51) } : name
    )) },
    { ...familyOutput, names: familyOutput.names.map((name, index) => (
      index === 0 ? { ...name, why: "甲".repeat(51) } : name
    )) },
    { ...familyOutput, names: familyOutput.names.map((name, index) => (
      index === 0 ? { ...name, chars: [] } : name
    )) },
    { ...familyOutput, names: familyOutput.names.map((name, index) => (
      index === 0 ? { ...name, chars: [{ char: "明", gloss: "甲".repeat(13) }] } : name
    )) },
    { ...familyOutput, note: "甲".repeat(81) },
    { ...familyOutput, element: "风" },
    { ...familyOutput, extra: true },
    { ...familyOutput, names: familyOutput.names.map((name, index) => (
      index === 0 ? { ...name, extra: true } : name
    )) },
  ];
  for (const value of invalid) {
    assert.throws(() => validateStructuredOutput(NAMING_FAMILY_SCHEMA, value));
  }
});

test("合参 Schema 限定推荐、总述、提示与多余字段", () => {
  const output: NamingSummaryOutput = {
    picks: [{ given: "明泽", reason: "五行与字义兼顾" }, { given: "清宁", reason: "音义温和" }],
    overview: "三家各有侧重，均重视读写与寓意。",
    tips: ["念出全名听听是否顺口", "问问家人方言里有无不雅谐音"],
  };
  assert.doesNotThrow(() => validateStructuredOutput(NAMING_SUMMARY_SCHEMA, output));
  assert.throws(() => validateStructuredOutput(NAMING_SUMMARY_SCHEMA, {
    ...output, picks: [{ given: "明泽", reason: "理由" }],
  }));
  assert.throws(() => validateStructuredOutput(NAMING_SUMMARY_SCHEMA, { ...output, extra: true }));
});

test("三家用户提示词写明对象、期望与严格输出要求", () => {
  for (const family of NAMING_FAMILIES) {
    const personPrompt = family.buildUserPrompt(person);
    assert.match(personPrompt, /人名 · 姓张 · 双名 · 性别女/);
    assert.match(personPrompt, /期望原文：温和有书卷气/);
    assert.match(personPrompt, /输出必须严格符合给定 JSON Schema/);
    const businessPrompt = family.buildUserPrompt(business);
    assert.match(businessPrompt, /商号 · 字号 2 字/);
    assert.match(businessPrompt, /期望原文：卖手工皂，朴素自然/);
  }
});

test("五行家按喜用五行分组排出宜入名字池，每组不超过 150 字", () => {
  const family = NAMING_FAMILIES.find(({ key }) => key === "wuxing");
  assert.ok(family);
  const prompt = family.buildUserPrompt(person);
  assert.match(prompt, /喜用五行：火、水/);
  assert.match(prompt, /喜用来源：调候取丙、癸/);
  assert.match(prompt, /喜用用字（按诗文常用度排序，靠前的更常用）：/);
  const groups = prompt.split("\n").filter((line) => /^(木|火|土|金|水)：/u.test(line));
  assert.deepEqual(groups.map((line) => line[0]), ["火", "水"]);
  assert.ok(groups.every((line) => line.slice(2).split("、").length <= 150));
  assert.ok(groups.flatMap((line) => line.slice(2).split("、")).length <= 300);
  const selfSelected = family.buildUserPrompt(business);
  assert.match(selfSelected, /结合行业与期望自选一个五行/);
  assert.match(selfSelected, /element/);
});

test("五行家对异常的多喜用输入仍将用字总数限制在 300", () => {
  const family = NAMING_FAMILIES.find(({ key }) => key === "wuxing");
  assert.ok(family);
  const prompt = family.buildUserPrompt({ ...person, favorable: ["木", "火", "水"] });
  const groups = prompt.split("\n").filter((line) => /^(木|火|土|金|水)：/u.test(line));
  assert.deepEqual(groups.map((line) => line[0]), ["木", "火"]);
  assert.ok(groups.flatMap((line) => line.slice(2).split("、")).length <= 300);
});

test("诗文家逐行排出 60 条候选并要求 sourceId 填编号", () => {
  const family = NAMING_FAMILIES.find(({ key }) => key === "shiwen");
  assert.ok(family);
  const prompt = family.buildUserPrompt(person);
  const rows = prompt.split("\n").filter((line) => /^S\d{2}｜/u.test(line));
  assert.equal(rows.length, 60);
  assert.equal(rows[0], "S01｜诗经 · 周南·关雎｜关关雎鸠，在河之洲");
  assert.equal(rows[1], "S02｜唐诗三百首 · 杜甫《春望》｜江流天地外");
  assert.match(prompt, /格式为「编号｜书名 · 题名｜原句」/);
  assert.doesNotMatch(rows.join("\n"), /《(?:诗经|楚辞|论语|周易|唐诗三百首|宋词三百首)/u);
  assert.match(prompt, /sourceId.*S01/);
});

test("音义家列出人名姓氏的拼音与声调", () => {
  const family = NAMING_FAMILIES.find(({ key }) => key === "yinyi");
  assert.ok(family);
  assert.match(family.buildUserPrompt(person), /姓氏读音：张 zhāng（1 声）/);
});

test("三家系统提示词完整写明规则且通过文化守卫", () => {
  assert.deepEqual(NAMING_FAMILIES.map(({ name, seal }) => [name, seal]), [
    ["五行补益", "五"], ["诗文出处", "诗"], ["音形字义", "音"],
  ]);
  for (const { systemPrompt } of NAMING_FAMILIES) {
    for (const phrase of [
      "不用五格、三才、数理", "开光", "法器", "符咒", "转运",
      "按性别取字", "不限", "中性", "谐音不雅", "生僻字",
      "行政区划", "行业词", "组织形式词", "逐字字义", "不要照抄字典古义",
      "可用起名字", "表外字", "不宜入名",
    ]) {
      assert.ok(systemPrompt.includes(phrase), phrase);
    }
    assert.doesNotMatch(systemPrompt, /易者|押钱|赔付|封存|[\u3040-\u30ff]|・/u);
  }
});
