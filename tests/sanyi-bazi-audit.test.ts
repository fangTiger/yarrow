// tests/sanyi-bazi-audit.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
test("2031 子午冲失败，2032 同词通过，包括倒序", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  for (const note of ["子午冲", "午子冲"]) {
    const wrong = { ...output, years: output.years.map((item) => {
        return item.year === 2031 ? { ...item, note } : item;
      }) };
    assert.match(auditBaziOutput(wrong, input.facts).errors.join("；"), /2031.*子午冲/);
    const right = { ...output, years: output.years.map((item) => {
        return item.year === 2032 ? { ...item, note } : item;
      }) };
    assert.equal(auditBaziOutput(right, input.facts).ok, true);
  }
});
test("庚甲冲在锚年正文通过，2031 短评失败", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.equal(auditBaziOutput({ ...output, reason: "庚甲冲宜审慎" }, input.facts).ok, true);
  const years = output.years.map((item) => {
    return item.year === 2031 ? { ...item, note: "庚甲冲" } : item;
  });
  assert.match(auditBaziOutput({ ...output, years }, input.facts).errors.join("；"), /2031.*甲庚冲/);
});
test("未知引用、所引事实不含的词、虚构关系都失败", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "missing", claim: "庚午" }] },
    input.facts).ok, false);
  assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "pillar:day", claim: "甲申" }] },
    input.facts).ok, false);
  // 两个字各自存在不代表该关系存在；必须整体匹配关系词。
  assert.equal(auditBaziOutput({ ...output, advice: ["子午冲"] }, input.facts).ok, false);
  assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "year:anchor", claim: "庚甲冲" }] },
    input.facts).ok, true);
});
test("缺时柱正文引用时柱干支失败，未说明限制也失败", () => {
  const input = sampleBazi("fortune", false);
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.equal(auditBaziOutput(output, input.facts).ok, true);
  assert.equal(auditBaziOutput({ ...output, headline: "时柱癸未" }, input.facts).ok, false);
  assert.equal(auditBaziOutput({ ...output, reason: "依事实判断" }, input.facts).ok, false);
});
test("正文各字段及每年短评扫描十神与关系完整词", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  const patches = [
    { headline: "寅申冲" }, { reason: "寅申冲" }, { useGod: "寅申冲" },
    { sections: output.sections.map((item) => ({ ...item, text: "寅申冲" })) },
    { timing: { window: "寅申冲", condition: "条件齐备" } },
  ];
  for (const patch of patches) {
    assert.equal(auditBaziOutput({ ...output, ...patch }, input.facts).ok, false);
  }
});

test("不存在的关系不能拆成两个合法单字蒙混通过", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  for (const reason of ["庚辛合", "巳午半合火", "午辰冲"]) {
    assert.equal(auditBaziOutput({ ...output, reason }, input.facts).ok, false);
  }
});

test("普通判断用语不被问事单字词表误判成盘面事实", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.equal(auditBaziOutput({ ...output, reason: "用神取正印，相神须看救应" }, input.facts).ok, true);
});
