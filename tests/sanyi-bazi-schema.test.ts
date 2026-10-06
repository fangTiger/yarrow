// tests/sanyi-bazi-schema.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { validateStructuredOutput } from "../src/agent/provider.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA, checkBaziConsistency,
  type DestinySchoolOutput, type FortuneSchoolOutput, } from "../src/sanyi/bazi-schema.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
function fortune(): FortuneSchoolOutput {
  return mockBaziSchoolOutput("shenxiaozhan", sampleBazi().facts, "fortune");
}
test("命理拒绝吉凶、把握、逐年字段，五分项标题顺序固定", () => {
  const output = mockBaziSchoolOutput("shenxiaozhan", sampleBazi("destiny").facts, "destiny");
  assert.doesNotThrow(() => validateStructuredOutput<DestinySchoolOutput>(DESTINY_SCHOOL_SCHEMA, output));
  for (const patch of [{ verdict: "吉" }, { confidenceTenths: 6 }, { years: [] }]) {
    assert.throws(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, { ...output, ...patch }));
  }
  const sections = [...output.sections].reverse();
  assert.throws(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, { ...output, sections }));
});
test("运势必填逐年列表，短评不得超过十六字", () => {
  const output = fortune();
  assert.doesNotThrow(() => validateStructuredOutput(FORTUNE_SCHOOL_SCHEMA, output));
  const { years, ...missing } = output;
  assert.throws(() => validateStructuredOutput(FORTUNE_SCHOOL_SCHEMA, missing));
  assert.throws(() => validateStructuredOutput(FORTUNE_SCHOOL_SCHEMA, {
    ...output, years: years.map((item) => ({ ...item, note: "甲".repeat(17) })),
  }));
});
test("年份缺漏、多出、乱序都失败", () => {
  const input = sampleBazi();
  const output = fortune();
  const variants = [
    output.years.filter((item) => item.year !== 2029),
    [...output.years, { ...output.years[0]!, year: 2033 }],
    [...output.years].reverse(),
  ];
  for (const years of variants) {
    assert.match(checkBaziConsistency({ ...output, years }, input.chart, "year").join("；"), /年份序列/);
  }
});
test("整年锚项与总断一致，今天本月不要求一致", () => {
  const input = sampleBazi();
  const output = { ...fortune(), verdict: "凶" as const, confidenceTenths: 4 };
  output.years = output.years.map((item) => ({ ...item, verdict: "平", confidenceTenths: 5 }));
  for (const horizon of ["year", "next-year", "year:2026"] as const) {
    assert.match(checkBaziConsistency(output, input.chart, horizon).join("；"), /锚年/);
  }
  for (const horizon of ["today", "month"] as const) {
    assert.deepEqual(checkBaziConsistency(output, input.chart, horizon), []);
  }
});
test("总断和每一项复用问事自洽规则，裁剪窗口仍精确覆盖", () => {
  const input = sampleBazi();
  const output = fortune();
  assert.match(checkBaziConsistency({ ...output, verdict: "吉", confidenceTenths: 4 }, input.chart,
    "month").join("；"), /六成/);
  const years = output.years.map((item) => ({ ...item, verdict: "凶" as const, confidenceTenths: 7 }));
  assert.match(checkBaziConsistency({ ...output, years }, input.chart, "month").join("；"), /2029.*四成/);
  const chart = { ...input.chart, liunian: { ...input.chart.liunian,
    years: input.chart.liunian.years.slice(3) } };
  assert.deepEqual(checkBaziConsistency({ ...output, years: output.years.slice(3) }, chart, "year"), []);
});
