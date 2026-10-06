// tests/sanyi-fortune-context.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import lunarPkg from "lunar-javascript";
import { resolveFortuneContext, periodFacts } from "../src/sanyi/fortune-context.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
function at(text: string, horizon = "year" as Parameters<typeof resolveFortuneContext>[0], sect: 1 | 2 = 1) {
  return resolveFortuneContext(horizon, () => new Date(text + "+08:00"), sect);
}
test("立春交接与五种范围锚年，公历跨年仍为旧立春年", () => {
  const term = lunarPkg.Solar.fromYmd(2026, 7, 1).getLunar().getJieQiTable()["立春"]!;
  const ms = Date.parse(term.toYmdHms().replace(" ", "T") + "+08:00");
  assert.equal(resolveFortuneContext("year", () => new Date(ms - 1_000), 1).anchorYear, 2025);
  assert.equal(resolveFortuneContext("year", () => new Date(ms), 1).anchorYear, 2026);
  for (const horizon of ["today", "month", "year"] as const) {
    assert.equal(at("2026-01-01T00:00:00", horizon).anchorYear, 2025);
    assert.equal(at("2026-10-06T21:00:00", horizon).anchorYear, 2026);
  }
  assert.equal(at("2026-01-01T00:00:00", "next-year").anchorYear, 2026);
  assert.equal(at("2026-10-06T21:00:00", "next-year").anchorYear, 2027);
  assert.equal(at("2026-10-06T21:00:00", "year:2030").anchorYear, 2030);
});
test("交节前后当前流月改变，与农历初一无关", () => {
  const term = lunarPkg.Solar.fromYmd(2026, 7, 1).getLunar().getJieQiTable()["寒露"]!;
  const ms = Date.parse(term.toYmdHms().replace(" ", "T") + "+08:00");
  const before = resolveFortuneContext("month", () => new Date(ms - 1_000), 1);
  const after = resolveFortuneContext("month", () => new Date(ms), 1);
  assert.equal(before.ganZhi, "丁酉");
  assert.equal(after.ganZhi, "戊戌");
});
test("流日按 sect 在 23 点或零点交接", () => {
  const before = at("2026-10-06T22:59:59", "today");
  const after = at("2026-10-06T23:00:00", "today");
  assert.notEqual(before.ganZhi, after.ganZhi);
  assert.equal(at("2026-10-06T23:00:00", "today", 2).ganZhi, before.ganZhi);
  assert.equal(at("2026-10-07T00:00:00", "today", 2).ganZhi, after.ganZhi);
});
test("流日事实含日干十神与原局关系，不混入大运", () => {
  const input = sampleBazi();
  const context = { ...at("2026-10-06T21:00:00", "today"), ganZhi: "壬子" };
  const fact = periodFacts(context, input.chart).get("period:day")!;
  assert.ok(fact.tokens.has("壬子"));
  assert.ok(fact.tokens.has("食神"));
  assert.ok(fact.tokens.has("子午冲"));
  const month = periodFacts(at("2026-10-06T21:00:00", "month"), input.chart).get("period:month")!;
  assert.ok(month.tokens.has("丁酉"));
});
