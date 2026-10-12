import assert from "node:assert/strict";
import test from "node:test";
import { extractUnits } from "../src/sanyi/translation/units.js";
import { buildTranslationPrompt } from "../src/sanyi/translation/prompt.js";

const summary = {
  status: "done" as const,
  basis: 3,
  attempts: 1,
  retries: 0,
  output: {
    tone: "顺" as const,
    conclusion: "2026 年整体偏顺",
    agreement: "三家都认为先稳后进",
    difference: "应期看法略有不同",
    explanation: ["用神得力", "动爻提示先等待"],
    remedy: {
      principle: "天行健，君子以自强不息。",
      plan: [{ action: "先完成准备", basis: "乾卦初九潜龙勿用", timing: "3 月后" }],
      avoid: ["不要仓促决定"],
    },
    watch: { window: "2026 年 3 月", condition: "准备完成" },
    outlook: "十年走势先升后稳",
  },
};

function questionReading() {
  const output = {
    verdict: "吉" as const,
    confidenceTenths: 7,
    headline: "可以推进",
    reason: "世爻得月建相助",
    sections: [{ title: "眼下", text: "先准备 2 项材料" }],
    timing: { window: "2026 年 3 月", condition: "材料齐备" },
    advice: ["先小范围试行"],
    evidence: [{ ref: "e1", claim: "内部依据不翻译" }],
  };
  return {
    id: "abcdefghijklmnopqrstuvwxyz",
    kind: "question" as const,
    status: "done" as const,
    schools: {
      chengyi: { status: "done" as const, output, attempts: 1, retries: 0 },
      jingfang: { status: "done" as const, output, attempts: 1, retries: 0 },
      shaoyong: { status: "done" as const, output, attempts: 1, retries: 0 },
    },
    summary,
  };
}

test("问事抽取总述与三家四个单元，并排除结论码与证据", () => {
  const units = extractUnits(questionReading() as never);
  assert.deepEqual(units.map((unit) => unit.key), ["summary", "chengyi", "jingfang", "shaoyong"]);
  const paths = units[1]!.entries.map((entry) => entry.path);
  assert.deepEqual(paths, [
    "schools.chengyi.output.headline",
    "schools.chengyi.output.reason",
    "schools.chengyi.output.sections.0.title",
    "schools.chengyi.output.sections.0.text",
    "schools.chengyi.output.timing.window",
    "schools.chengyi.output.timing.condition",
    "schools.chengyi.output.advice.0",
  ]);
  assert.equal(paths.some((path) => path.includes("evidence") || path.includes("verdict")), false);
  assert.ok(units[0]!.entries.some((entry) => entry.path.endsWith("remedy.plan.0.basis")));
});

test("八字只抽取设计表指定正文，逐年短评归所在家", () => {
  const output = {
    useGod: "以木为用神",
    headline: "事业稳中有升",
    reason: "日主得助",
    sections: [{ title: "事业", text: "2026 年宜稳步推进" }],
    timing: { window: "春季", condition: "木旺" },
    advice: ["先打基础"],
    evidence: [{ ref: "b1", claim: "不翻" }],
    verdict: "吉" as const,
    confidenceTenths: 7,
    years: [{ year: 2026, verdict: "吉" as const, confidenceTenths: 7, note: "机会增加" }],
  };
  const reading = {
    id: "abcdefghijklmnopqrstuvwxyz", kind: "fortune", status: "done",
    schools: Object.fromEntries(["shenxiaozhan", "yuchuntai", "rentieqiao"].map((key) => (
      [key, { status: "done", output, attempts: 1, retries: 0 }]
    ))),
    summary,
  };
  const units = extractUnits(reading as never);
  assert.deepEqual(units.map((unit) => unit.key), [
    "summary", "shenxiaozhan", "yuchuntai", "rentieqiao",
  ]);
  assert.deepEqual(units[1]!.entries.map((entry) => entry.path), [
    "schools.shenxiaozhan.output.useGod",
    "schools.shenxiaozhan.output.headline",
    "schools.shenxiaozhan.output.reason",
    "schools.shenxiaozhan.output.sections.0.text",
    "schools.shenxiaozhan.output.advice.0",
    "schools.shenxiaozhan.output.years.0.note",
  ]);
});

test("起名抽取合参与三家正文，名字本身不翻译", () => {
  const outputFor = (given: string) => ({
    note: "补木兼顾音律",
    element: "木",
    names: [{
      given, meaning: "清朗平和", why: "符合期望", sourceId: "S01",
      chars: [
        { char: "清", gloss: "清澈", sense: "清朗" },
        { char: "和", gloss: "和顺", sense: "温和" },
      ],
      tags: ["清朗", "温和", "好读"],
    }],
  });
  const familyNames = { wuxing: "清和", shiwen: "明远", yinyi: "知行" } as const;
  const reading = {
    id: "abcdefghijklmnopqrstuvwxyz", kind: "naming", status: "done", target: "person",
    surname: "林", candidateIds: [], basis: { favorableNote: "喜木，可取生发之意" },
    families: Object.fromEntries(Object.entries(familyNames).map(([key, given]) => (
      [key, { status: "done", output: outputFor(given), attempts: 1, retries: 0 }]
    ))),
    summary: {
      status: "done", basis: 3, attempts: 1, retries: 0,
      output: {
        picks: [{ given: "清和", reason: "三家意见一致" }],
        overview: "整体清雅", tips: ["留意读音", "核对证件"],
      },
    },
  };
  const units = extractUnits(reading as never);
  assert.deepEqual(units.map((unit) => unit.key), ["summary", "wuxing", "shiwen", "yinyi"]);
  assert.deepEqual(units[0]!.entries.map((entry) => entry.path), [
    "basis.favorableNote",
    "summary.output.picks.0.reason",
    "summary.output.overview",
    "summary.output.tips.0",
    "summary.output.tips.1",
  ]);
  const paths = units[1]!.entries.map((entry) => entry.path);
  assert.ok(paths.includes("families.wuxing.output.names.0.meaning"));
  assert.ok(paths.includes("families.wuxing.output.names.0.chars.0.gloss"));
  assert.equal(paths.some((path) => path.endsWith("given") || path.endsWith("char")), false);
  assert.ok(units[1]!.allowedHan.includes("清和"));
  assert.ok(units[1]!.allowedHan.includes("林清和"));
  assert.ok(units[1]!.allowedHan.includes("清"));
  assert.equal(units[1]!.allowedHan.includes("明远"), false);
  assert.ok(units[2]!.allowedHan.includes("明远"));
});

test("提示词只附本单元命中的术语与古文固定译文", () => {
  const unit = extractUnits(questionReading() as never)[0]!;
  const prompt = buildTranslationPrompt(unit);
  assert.match(prompt, /Yong Shen/);
  assert.match(prompt, /A hidden dragon does not act\./);
  assert.match(prompt, /The movement of heaven is vigorous/);
  assert.doesNotMatch(prompt, /Receptive Earth/);
});
