import assert from "node:assert/strict";
import test from "node:test";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { analyzeBazi } from "../src/calendar/bazi-relations.js";
import { lookupQiongtong } from "../src/calendar/qiongtong.js";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
import { buildBaziFacts } from "../src/sanyi/bazi-facts.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { selectBaziFacts, type BaziSchoolKey } from "../src/sanyi/schools/bazi-shared.js";
import { sampleBazi } from "./helpers/sample-bazi.js";

const examples: [BaziSchoolKey, string, string][] = [
  ["shenxiaozhan", "structure:month", "月令本气丙火七杀未透干"],
  ["shenxiaozhan", "structure:roots", "日主庚通根月柱，月柱藏干透出庚"],
  ["shenxiaozhan", "hidden:day", "日支辰藏戊偏印、乙正财、癸伤官"],
  ["shenxiaozhan", "structure:month", "月令本气七杀未透"],
  ["shenxiaozhan", "year:anchor", "丙午七杀、午午自刑、丙辛合"],
  ["yuchuntai", "tiaohou", "三夏庚金，用干壬、戊、丙"],
  ["yuchuntai", "tiaohou", "四月庚金，先壬次戊，丙火佐之"],
  ["yuchuntai", "hidden:month", "巳藏丙火七杀与戊土偏印"],
  ["yuchuntai", "pillar:month", "月柱辛巳，劫财透干"],
  ["yuchuntai", "hidden:time", "时支未藏乙木正财"],
  ["yuchuntai", "hidden:day", "辰中戊偏印癸伤官"],
  ["rentieqiao", "pillar:month", "月柱辛巳，劫财透干，支藏丙火七杀"],
  ["rentieqiao", "structure:roots", "日主同五行通根月柱，身有根"],
  ["rentieqiao", "pillar:time", "时柱癸未，伤官透干，支藏丁火正官"],
  ["rentieqiao", "hidden:month", "巳中藏丙为七杀"],
  ["rentieqiao", "structure:roots", "日主庚金通根月柱"],
  ["rentieqiao", "elements", "金三土二火三，日主偏强，官杀略旺"],
];
for (const [key, ref, claim] of examples) {
  test(`真实模型引证通过：${key} ${ref} ${claim}`, () => {
    const kind = ref === "year:anchor" ? "fortune" : "destiny";
    const facts = selectBaziFacts(key, sampleBazi(kind));
    const output = mockBaziSchoolOutput(key, facts, kind);
    const result = auditBaziOutput({ ...output, evidence: [{ ref, claim }] }, facts);
    assert.deepEqual(result.errors, []);
  });
}

test("原局四柱不含易误分字时，日常词正文仍通过", () => {
  const forbidden = /[己子未辛申午辰丁甲]/u;
  let found: ReturnType<typeof buildBaziChart> | undefined;
  search: for (const year of [1980, 1982, 1988, 1992, 2000]) {
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= 28; day += 1) {
        const chart = buildBaziChart({ corrected: { year, month, day, hour: 10, minute: 0, second: 0 },
          gender: "male", sect: 1, timeKnown: true, targetYear: 2026 });
        if (Object.values(chart.pillars).every((pillar) => pillar && !forbidden.test(pillar.ganZhi))) {
          found = chart;
          break search;
        }
      }
    }
  }
  assert.ok(found, "应找到四柱不含指定干支字的命盘");
  assert.ok(Object.values(found.pillars).every((pillar) => pillar && !forbidden.test(pillar.ganZhi)));
  const input = sampleBazi("destiny");
  input.chart = found;
  input.facts = buildBaziFacts(found, analyzeBazi(found), lookupQiongtong(found.dayMaster, found.pillars.month.branch));
  const facts = selectBaziFacts("yuchuntai", input);
  const output = mockBaziSchoolOutput("yuchuntai", facts, "destiny");
  // 删除部分事实关键词，让每个易误分字都不能由背景事实意外放行。
  for (const fact of facts.values()) {
    fact.tokens = new Set([...fact.tokens].filter((token) => !forbidden.test(token)));
  }
  const result = auditBaziOutput({ ...output, useGod: "审慎", evidence: [], periods: [],
    reason: "自己照顾子女，未来仍需辛苦，申请下午办理，生辰、人丁与甲方资料备齐" }, facts);
  assert.deepEqual(result.errors, []);
});

test("有锚定的跨柱关键词通过，无锚定仍拒绝", () => {
  const facts = selectBaziFacts("rentieqiao", sampleBazi("destiny"));
  const output = mockBaziSchoolOutput("rentieqiao", facts, "destiny");
  const result = auditBaziOutput({ ...output, evidence: [{ ref: "pillar:year", claim: "申辰拱水" }] }, facts);
  assert.ok(result.errors.includes("pillar:year 引证与所引事实无关"));
  assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "pillar:month", claim: "月柱壬子" }] }, facts).ok, false);
  assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "pillar:year", claim: "宜审慎" }] }, facts).ok, true);
});

test("「巳酉合金」等简称按半合或拱合核对，年份不符仍拒绝", () => {
  const input = sampleBazi();
  const facts = selectBaziFacts("shenxiaozhan", input);
  const output = mockBaziSchoolOutput("shenxiaozhan", facts, "fortune");
  function withNote(year: number, note: string) {
    return { ...output, years: output.years.map((item) => item.year === year ? { ...item, note } : item) };
  }
  // 2029 己酉：巳酉半合金；2028 戊申：申辰拱水；2032 壬子：子辰半合水
  assert.deepEqual(auditBaziOutput(withNote(2029, "己土生身，巳酉合金助身"), facts).errors, []);
  assert.deepEqual(auditBaziOutput(withNote(2028, "申辰合水，印比帮身"), facts).errors, []);
  assert.deepEqual(auditBaziOutput(withNote(2032, "子辰合水泄身"), facts).errors, []);
  // 2024 甲辰仍在甲申运，原局、运、年都没有酉，不存在巳酉半合金（2031 在乙酉运，运支酉与月支巳可成）
  assert.equal(auditBaziOutput(withNote(2024, "巳酉合金助身"), facts).ok, false);
  // 五行与局不符的简称不放行
  assert.equal(auditBaziOutput(withNote(2029, "巳酉合水"), facts).ok, false);
});

test("跨事实引证不能借用其它年份或其它家事实", () => {
  const input = sampleBazi();
  for (const key of ["shenxiaozhan", "yuchuntai"] as const) {
    const facts = selectBaziFacts(key, input);
    const output = mockBaziSchoolOutput(key, facts, "fortune");
    assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "pillar:year", claim: "庚午子午冲" }] }, facts).ok, false);
    assert.equal(auditBaziOutput({ ...output, reason: "子午冲" }, facts).ok, false);
    if (key === "yuchuntai") {
      assert.equal(auditBaziOutput({ ...output, evidence: [{ ref: "pillar:year", claim: "庚午午午自刑" }] }, facts).ok, false);
    }
    const years = output.years.map((item) => item.year === 2031 ? { ...item, note: "子午冲" } : item);
    assert.equal(auditBaziOutput({ ...output, years }, facts).ok, false);
  }
});

test("事实关键词补齐但编号与标签含义保持", () => {
  const input = sampleBazi();
  for (const pillar of Object.values(input.chart.pillars)) {
    assert.ok(pillar);
    const hidden = input.facts.get(`hidden:${pillar.key}`);
    assert.ok(hidden?.tokens.has(pillar.branch));
    assert.ok(hidden?.tokens.has(pillar.ganZhi));
    assert.ok(input.facts.get("structure:roots")?.tokens.has(pillar.branch));
  }
  assert.ok(input.facts.get("structure:roots")?.tokens.has("日主"));
  assert.ok(input.facts.get("structure:month")?.tokens.has(input.chart.pillars.month.branch));
});
