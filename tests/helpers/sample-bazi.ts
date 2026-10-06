// tests/helpers/sample-bazi.ts
import { buildBaziChart } from "../../src/calendar/bazi.js";
import { analyzeBazi } from "../../src/calendar/bazi-relations.js";
import { lookupQiongtong } from "../../src/calendar/qiongtong.js";
import { buildBaziFacts } from "../../src/sanyi/bazi-facts.js";
import type { BaziSchoolInput } from "../../src/sanyi/schools/bazi-shared.js";
import type { FortuneHorizon } from "../../src/sanyi/classify.js";
export function sampleBazi(kind: "destiny" | "fortune" = "fortune", timeKnown = true,
  horizon: FortuneHorizon = "year"): BaziSchoolInput {
  const chart = buildBaziChart({
    corrected: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0 },
    gender: "male", sect: 1, timeKnown, targetYear: 2026,
  });
  const analysis = analyzeBazi(chart);
  const tiaohou = lookupQiongtong(chart.dayMaster, chart.pillars.month.branch);
  return {
    kind, horizon, chart, tiaohou,
    question: kind === "fortune" ? "今年运势如何" : "我适合做什么",
    facts: buildBaziFacts(chart, analysis, tiaohou),
    period: { label: "2026 年", facts: new Map() },
  };
}
