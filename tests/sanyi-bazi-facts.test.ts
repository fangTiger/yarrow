// tests/sanyi-bazi-facts.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { analyzeBazi } from "../src/calendar/bazi-relations.js";
test("四柱、藏干、神煞、大运、锚年、调候与五行编号完整", () => {
  const input = sampleBazi();
  for (const id of ["pillar:year", "pillar:month", "pillar:day", "pillar:time",
    "hidden:year", "hidden:month", "hidden:day", "hidden:time", "luck:current",
    "luck:3", "year:anchor", "tiaohou", "elements"]) {
    assert.ok(input.facts.has(id), id);
  }
  assert.ok([...input.facts.keys()].some((id) => id.startsWith("relation:")));
  assert.ok([...input.facts.keys()].some((id) => id.startsWith("shensha:")));
  assert.deepEqual([...input.facts.get("tiaohou")!.tokens], ["壬", "戊", "丙", "三夏庚金"]);
  assert.ok(!input.facts.get("tiaohou")!.label.includes(input.tiaohou.quote));
});
test("2023 至 2032 每年事实含该年干支、十神、藏干、大运及已核验关系", () => {
  const input = sampleBazi();
  const expected = ["午卯破", "甲庚冲", "乙庚合", "丙辛合", "丁癸冲",
    "申辰拱水", "巳酉半合金", "辰戌冲", "巳亥冲", "子午冲"];
  const analysis = analyzeBazi(input.chart);
  for (const [index, year] of input.chart.liunian.years.entries()) {
    const fact = input.facts.get(`year:${year.year}`);
    assert.ok(fact);
    for (const token of [year.ganZhi, year.stemGod, year.luck!.ganZhi, expected[index]!]) {
      assert.ok(fact.tokens.has(token), `${fact.id}：${token}`);
    }
    for (const hidden of year.hidden) {
      assert.ok(fact.tokens.has(hidden.stem) && fact.tokens.has(hidden.god));
    }
    for (const shensha of analysis.years[index]!.shensha) {
      assert.ok(fact.tokens.has(shensha.name));
    }
  }
});
test("缺时柱无时柱、时藏干、命宫身宫事实及含时柱节点的关系", () => {
  const input = sampleBazi("fortune", false);
  for (const id of ["pillar:time", "hidden:time", "palace:ming", "palace:shen"]) {
    assert.ok(!input.facts.has(id));
  }
  assert.ok([...input.facts.values()].every((fact) => !fact.label.includes("natal.time")));
  assert.ok([...input.facts.values()].filter((fact) => fact.id.startsWith("pillar:")
    || fact.id.startsWith("hidden:")).every((fact) => !fact.tokens.has("癸未")));
  assert.ok(input.facts.get("luck:2")?.tokens.has("癸未"));
});
