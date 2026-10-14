// src/sanyi/bazi-public.ts
import type { BaziChart } from "../calendar/bazi.js";
import type { BaziSchoolState, StoredBaziReading } from "./store.js";
import type { DestinySchoolOutput, FortuneSchoolOutput } from "./bazi-schema.js";
export interface YearConsensus {
  year: number;
  average: number;
  min: number;
  max: number;
  count: number;
}
export interface PeriodConsensus {
  index: number;
  average: number;
  min: number;
  max: number;
  count: number;
}
export function derivedChart(chart: BaziChart): BaziChart {
  // 显式列举允许存档的派生字段，不复制请求、校正过程或出生地点。
  return { sect: chart.sect, dayBoundary: chart.dayBoundary, timeKnown: chart.timeKnown,
    dayMaster: chart.dayMaster, pillars: chart.pillars, taiYuan: chart.taiYuan,
    mingGong: chart.mingGong, shenGong: chart.shenGong, luck: chart.luck, annual: chart.annual,
    birthLiChunYear: chart.birthLiChunYear, liunian: chart.liunian,
    // 请求期警示可能包含节气时刻；公开只给固定、不可逆的缺时柱说明。
    warnings: chart.timeKnown ? [] : [chart.luck === null
      ? "时辰未知且出生当日交节，年/月柱与大运需补时辰确认"
      : "时辰未知，缺时柱，起运按正午估算仅供参考"] };
}
function doneOutputs(reading: StoredBaziReading): FortuneSchoolOutput[] {
  return Object.values(reading.schools).flatMap((state) => {
    if (state.status === "done" && state.output && "years" in state.output) {
      return [state.output];
    }
    return [];
  });
}
export function yearConsensus(reading: StoredBaziReading): (YearConsensus | null)[] {
  const outputs = doneOutputs(reading);
  return reading.chart.liunian.years.map(({ year }) => {
    const values = outputs.flatMap((output) => {
      const entry = output.years.find((item) => item.year === year);
      return entry ? [entry.confidenceTenths] : [];
    });
    if (values.length === 0) {
      return null;
    }
    const average = Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
    return { year, average, min: Math.min(...values), max: Math.max(...values), count: values.length };
  });
}
function donePeriodOutputs(reading: StoredBaziReading): DestinySchoolOutput[] {
  return Object.values(reading.schools).flatMap((state) => {
    if (state.status === "done" && state.output && !("years" in state.output)
      && state.output.periods) {
      return [state.output];
    }
    return [];
  });
}
export function periodConsensus(reading: StoredBaziReading): (PeriodConsensus | null)[] {
  const outputs = donePeriodOutputs(reading);
  return (reading.chart.luck?.cycles ?? []).map(({ index }) => {
    const values = outputs.flatMap((output) => {
      const entry = output.periods?.find((item) => item.index === index);
      return entry ? [entry.confidenceTenths] : [];
    });
    if (values.length === 0) {
      return null;
    }
    const average = Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
    return { index, average, min: Math.min(...values), max: Math.max(...values), count: values.length };
  });
}
function visibleSchool(state: BaziSchoolState): Omit<BaziSchoolState, "attempts" | "startedAt"> {
  const { attempts: _attempts, startedAt: _startedAt, ...visible } = state;
  return visible;
}
function common(reading: StoredBaziReading) {
  const summary = reading.summary ? (() => {
    const { startedAt: _startedAt, ...visible } = reading.summary!;
    return visible;
  })() : undefined;
  return { id: reading.id, createdAt: reading.createdAt, question: reading.question,
    status: reading.status, payment: { firstHash: reading.payment.transactionHash },
    chart: derivedChart(reading.chart), analysis: reading.analysis, tiaohou: reading.tiaohou,
    correction: reading.correction, context: reading.context, almanac: reading.almanac,
    changes: reading.changes, schools: {
      shenxiaozhan: visibleSchool(reading.schools.shenxiaozhan),
      yuchuntai: visibleSchool(reading.schools.yuchuntai),
      rentieqiao: visibleSchool(reading.schools.rentieqiao),
    }, ...(summary ? { summary } : {}) };
}
export function publicBaziReading(reading: StoredBaziReading) {
  const value = common(reading);
  if (reading.kind === "destiny") {
    return { ...value, kind: "destiny" as const, periods: periodConsensus(reading) };
  }
  const outputs = doneOutputs(reading);
  let consensusTenths: number | null = null;
  if (outputs.length > 0) {
    consensusTenths = outputs.reduce((sum, output) => sum + output.confidenceTenths, 0) / outputs.length;
  }
  return { ...value, kind: "fortune" as const, consensusTenths, years: yearConsensus(reading) };
}
export type PublicBaziReading = ReturnType<typeof publicBaziReading>;
