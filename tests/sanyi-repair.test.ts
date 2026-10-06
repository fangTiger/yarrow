// tests/sanyi-repair.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { auditOutput } from "../src/sanyi/audit.js";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { repairBazi, repairQuestion, splitSentences } from "../src/sanyi/repair.js";
import { checkVerdictConsistency, type QuestionSchoolOutput } from "../src/sanyi/schema.js";
import { selectBaziFacts } from "../src/sanyi/schools/bazi-shared.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { baseOutput, facts } from "./helpers/sample-question.js";

test("按句号、问号、叹号、分号与换行切句，保留标点", () => {
  assert.deepEqual(splitSentences("甲。乙！丙？丁；戊\n己"), ["甲。", "乙！", "丙？", "丁；", "戊\n", "己"]);
  assert.deepEqual(splitSentences(""), []);
});

test("问事删错留对：删不符的句子与引证，直断删空用吉凶几成代替，把握夹回合法范围", () => {
  // 样例盘面二爻为寅木官鬼，盘面没有午火官鬼。
  const bad: QuestionSchoolOutput = {
    ...baseOutput,
    verdict: "凶",
    confidenceTenths: 6,
    headline: "午火官鬼临身",
    reason: "寅木官鬼旬空。午火官鬼发动，事难成。",
    sections: [
      { title: "用神", text: "二爻寅木官鬼旬空，用神无力。又见午火官鬼，更忌。" },
      { title: "世应", text: "午火官鬼克世。" },
      { title: "动变", text: "初爻动。" },
    ],
    evidence: [{ ref: "line:2", claim: "寅木官鬼旬空" }, { ref: "line:3", claim: "三爻午火官鬼" }],
  };
  assert.equal(auditOutput(bad, facts).ok, false);
  const { output, removed, adjusted } = repairQuestion(bad, facts);
  assert.equal(output.confidenceTenths, 4);
  assert.equal(output.headline, "凶，约4成");
  assert.equal(output.reason, "寅木官鬼旬空。");
  assert.deepEqual(output.sections.map((section) => section.title), ["用神", "动变"]);
  assert.equal(output.sections[0]?.text, "二爻寅木官鬼旬空，用神无力。");
  assert.deepEqual(output.evidence, [{ ref: "line:2", claim: "寅木官鬼旬空" }]);
  assert.equal(removed, 5);
  assert.equal(adjusted, 1);
  assert.deepEqual(auditOutput(output, facts).errors, []);
  assert.deepEqual(checkVerdictConsistency(output), []);
});

test("问事输出本就合格时原样返回，不计删改", () => {
  const { output, removed, adjusted } = repairQuestion(baseOutput, facts);
  assert.deepEqual(output, baseOutput);
  assert.equal(removed, 0);
  assert.equal(adjusted, 0);
});

test("问事详断全删空时保留一段说明，理由删空时给出说明", () => {
  const bad: QuestionSchoolOutput = {
    ...baseOutput,
    reason: "午火官鬼发动。",
    sections: [
      { title: "甲", text: "午火官鬼。" },
      { title: "乙", text: "午火官鬼。" },
      { title: "丙", text: "午火官鬼。" },
    ],
  };
  const { output } = repairQuestion(bad, facts);
  assert.equal(output.sections.length, 1);
  assert.match(output.sections[0]?.text ?? "", /已删去/);
  assert.match(output.reason, /已删去/);
  assert.deepEqual(auditOutput(output, facts).errors, []);
});

test("运势删错留对：删不符正文、短评与引证，缺年不补，锚年对齐总断，把握夹回", () => {
  const input = sampleBazi("fortune");
  const schoolFacts = selectBaziFacts("shenxiaozhan", input);
  const good = mockBaziSchoolOutput("shenxiaozhan", schoolFacts, "fortune");
  const bad = {
    ...good,
    verdict: "吉" as const,
    confidenceTenths: 3,
    reason: `${good.reason}原局壬水藏于辰未。`,
    years: good.years
      .filter((item) => item.year !== 2029)
      .map((item) => {
        if (item.year === 2031) {
          return { ...item, note: "子午冲" };
        }
        if (item.year === 2026) {
          return { ...item, verdict: "大吉" as const, confidenceTenths: 9 };
        }
        return item;
      }),
    evidence: [...good.evidence, { ref: "pillar:year", claim: "申辰拱水" }],
  };
  assert.equal(auditBaziOutput(bad, schoolFacts).ok, false);
  const { output, removed, adjusted } = repairBazi(bad, schoolFacts, input.chart, "year");
  assert.ok("years" in output);
  assert.equal(output.confidenceTenths, 6);
  assert.doesNotMatch(output.reason, /壬水藏于辰未/);
  assert.equal(output.years.some((item) => item.year === 2029), false);
  assert.equal(output.years.find((item) => item.year === 2031)?.note, "");
  const anchor = output.years.find((item) => item.year === 2026);
  assert.deepEqual([anchor?.verdict, anchor?.confidenceTenths], ["吉", 6]);
  assert.equal(output.evidence.length, good.evidence.length);
  assert.equal(removed, 3);
  assert.ok(adjusted >= 2);
  assert.deepEqual(auditBaziOutput(output, schoolFacts).errors, []);
});

test("缺时柱而正文没说明限制时，在理由前补一句说明", () => {
  const input = sampleBazi("destiny", false);
  const schoolFacts = selectBaziFacts("rentieqiao", input);
  const good = mockBaziSchoolOutput("rentieqiao", schoolFacts, "destiny");
  const silent = {
    ...good,
    reason: "日主得令。",
    sections: good.sections.map((section) => ({ ...section, text: section.text.replace(/缺时柱|时辰未知/gu, "") })),
    headline: good.headline.replace(/缺时柱|时辰未知/gu, ""),
    advice: good.advice.map((item) => item.replace(/缺时柱|时辰未知/gu, "")),
  };
  const { output } = repairBazi(silent, schoolFacts, input.chart, "year");
  assert.match(output.reason, /^缺时柱，判断存在限制。/);
  assert.deepEqual(auditBaziOutput(output, schoolFacts).errors, []);
});
