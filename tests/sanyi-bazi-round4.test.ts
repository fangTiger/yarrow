// tests/sanyi-bazi-round4.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import { selectBaziFacts } from "../src/sanyi/schools/bazi-shared.js";
test("锚年五月甲午、六月乙未、十月己亥及节气日期进入三家事实表", () => {
  const input = sampleBazi();
  for (const school of BAZI_SCHOOLS) {
    const facts = selectBaziFacts(school.key, input);
    for (const [index, gz] of [[5, "甲午"], [6, "乙未"], [10, "己亥"]] as const) {
      assert.ok(facts.get(`liuyue:${index}`)?.tokens.has(gz));
      assert.match(facts.get(`liuyue:${index}`)!.label, /2026-\d{2}-\d{2}/);
    }
  }
});
test("正文 timing 可写五月甲午，五月甲子无任何可用事实仍拒绝", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune");
  assert.ok(![...input.facts].filter(([id]) => !/^year:\d{4}$/.test(id))
    .some(([, fact]) => fact.tokens.has("甲子")));
  const timing = { window: "五月甲午", condition: "核实条件后行动" };
  assert.equal(auditBaziOutput({ ...output, timing }, input.facts).ok, true);
  assert.equal(auditBaziOutput({ ...output, timing: { ...timing, window: "五月甲子" } }, input.facts).ok, false);
  const years = output.years.map((item) => {
    if (item.year === 2031) {
      return { ...item, note: "甲午宜留意" };
    }
    return item;
  });
  assert.equal(auditBaziOutput({ ...output, years }, input.facts).ok, false);
});
test("余春台看到全部四柱藏干，时干癸水通过，午未合失败", () => {
  const input = sampleBazi();
  const facts = selectBaziFacts("yuchuntai", input);
  for (const key of ["year", "month", "day", "time"]) {
    assert.ok(facts.has(`pillar:${key}`));
    assert.ok(facts.has(`hidden:${key}`));
  }
  assert.ok(![...facts.keys()].some((id) => /^(relation|shensha|structure):/.test(id)));
  const output = mockBaziSchoolOutput("yuchuntai", facts, "fortune");
  assert.equal(auditBaziOutput({ ...output, reason: "时干癸水可借" }, facts).ok, true);
  assert.equal(auditBaziOutput({ ...output, reason: "午未合" }, facts).ok, false);
});
test("三家提示词明确正文与逐年短评分工", () => {
  for (const school of BAZI_SCHOOLS) {
    assert.match(school.systemPrompt, /正文与 timing 只谈所问时间范围/);
    assert.match(school.systemPrompt, /其它年份的干支、关系只写在对应年份的短评中/);
  }
});
