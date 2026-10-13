// src/sanyi/bazi-schema.ts
import type { JsonSchema } from "../agent/schemas.js";
import type { BaziChart } from "../calendar/bazi.js";
import type { FortuneHorizon } from "./classify.js";
import { chineseBodyErrors } from "./language-guard.js";
import { QUESTION_SCHOOL_SCHEMA, checkVerdictConsistency, type QuestionSchoolOutput,
  type Verdict } from "./schema.js";
export interface DestinySchoolOutput {
  useGod: string;
  headline: string;
  reason: string;
  sections: QuestionSchoolOutput["sections"];
  advice: readonly string[];
  evidence: QuestionSchoolOutput["evidence"];
  /** 旧存档没有逐运断语，读取时按缺失处理。 */
  periods?: DestinyPeriodOutput[];
}
export interface DestinyPeriodOutput {
  index: number;
  verdict: Verdict;
  confidenceTenths: number;
  note: string;
}
export interface FortuneYearOutput {
  year: number;
  verdict: Verdict;
  confidenceTenths: number;
  note: string;
}
export interface FortuneSchoolOutput extends QuestionSchoolOutput {
  useGod: string;
  years: FortuneYearOutput[];
}
export type BaziSchoolOutput = DestinySchoolOutput | FortuneSchoolOutput;
export const DESTINY_TITLES = ["性格", "事业", "财运", "感情", "健康"] as const;
const properties = QUESTION_SCHOOL_SCHEMA.properties;
// 用神只写一句取用，推理放在理由与详断；过长会让三家用神对照与解法心法难读。
const useGod = { type: "string", minLength: 1, maxLength: 40 } as const;
const section = properties.sections.items;
// Ajv 默认使用 draft-07：元组 items 按位置限定五个标题，避免仅凭数量通过。
export const DESTINY_SCHOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["useGod", "headline", "reason", "sections", "advice", "evidence", "periods"],
  properties: {
    useGod, headline: properties.headline, reason: properties.reason,
    advice: properties.advice, evidence: properties.evidence,
    sections: {
      type: "array", minItems: 5, maxItems: 5, additionalItems: false,
      items: DESTINY_TITLES.map((title) => ({
        ...section, properties: { ...section.properties, title: { type: "string", const: title } },
      })),
    },
    periods: {
      type: "array", maxItems: 12,
      items: {
        type: "object", additionalProperties: false,
        required: ["index", "verdict", "confidenceTenths", "note"],
        properties: {
          index: { type: "integer", minimum: 1, maximum: 12 },
          verdict: properties.verdict, confidenceTenths: properties.confidenceTenths,
          note: { type: "string", minLength: 1, maxLength: 24 },
        },
      },
    },
  },
} as const satisfies JsonSchema;
export const FORTUNE_SCHOOL_SCHEMA = {
  ...QUESTION_SCHOOL_SCHEMA,
  required: [...QUESTION_SCHOOL_SCHEMA.required, "useGod", "years"],
  properties: {
    ...properties, useGod,
    years: {
      type: "array", minItems: 1, maxItems: 10,
      items: {
        type: "object", additionalProperties: false,
        required: ["year", "verdict", "confidenceTenths", "note"],
        properties: {
          year: { type: "integer", minimum: 1900, maximum: 2099 },
          verdict: properties.verdict, confidenceTenths: properties.confidenceTenths,
          note: { type: "string", minLength: 1, maxLength: 24 },
        },
      },
    },
  },
} as const satisfies JsonSchema;

export function baziLanguageErrors(output: BaziSchoolOutput): string[] {
  return chineseBodyErrors([
    output.useGod, output.headline, output.reason,
    ...output.sections.flatMap((section) => [section.title, section.text]),
    ...output.advice,
    ...("timing" in output && output.timing ? [output.timing.window, output.timing.condition] : []),
    ...("years" in output ? output.years.map((year) => year.note) : []),
    ...("periods" in output ? output.periods?.map((period) => period.note) ?? [] : []),
  ]);
}

export function checkBaziConsistency(output: BaziSchoolOutput, chart: BaziChart,
  horizon: FortuneHorizon): string[] {
  const errors = baziLanguageErrors(output);
  if (!("years" in output)) {
    const periods = output.periods ?? [];
    for (const item of periods) {
      errors.push(...checkVerdictConsistency(item).map((error) => `第 ${item.index} 步大运：${error}`));
    }
    const expected = chart.luck?.cycles.map((item) => item.index) ?? [];
    const actual = periods.map((item) => item.index);
    if (expected.length !== actual.length
      || expected.some((index, position) => actual[position] !== index)) {
      errors.push("逐运大运编号序列必须与命盘大运完全一致，按顺序且不多不少；"
        + "盘面无大运时须为空");
    }
    return errors;
  }
  errors.push(...checkVerdictConsistency(output));
  for (const item of output.years) {
    errors.push(...checkVerdictConsistency(item).map((error) => `${item.year} 年：${error}`));
  }
  const expected = chart.liunian.years.map((item) => item.year);
  const actual = output.years.map((item) => item.year);
  if (expected.length !== actual.length || expected.some((year, index) => actual[index] !== year)
    || actual.some((year, index) => index > 0 && year <= actual[index - 1]!)) {
    errors.push("逐年年份序列必须与命盘窗口完全一致，升序且不多不少");
  }
  // 锚年已由 B5 按立春年和 horizon 解析；本月、今天的总断可与全年不同。
  if (horizon === "year" || horizon === "next-year" || horizon.startsWith("year:")) {
    const anchor = output.years.find((item) => item.year === chart.liunian.anchorYear);
    if (!anchor || anchor.verdict !== output.verdict || anchor.confidenceTenths !== output.confidenceTenths) {
      errors.push("锚年逐年断语的吉凶与把握必须和整年总断相同");
    }
  }
  return errors;
}
