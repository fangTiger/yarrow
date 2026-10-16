// src/sanyi/schema.ts
import type { JsonSchema } from "../agent/schemas.js";
import { chineseBodyErrors } from "./language-guard.js";
import { englishBodyErrors } from "./english/audit.js";
export type Verdict = "大吉" | "吉" | "平" | "凶" | "大凶";
export interface QuestionSchoolOutput {
  verdict: Verdict;
  confidenceTenths: number;
  headline: string;
  reason: string;
  sections: ReadonlyArray<{ title: string; text: string }>;
  timing?: { window: string; condition: string };
  advice: readonly string[];
  evidence: ReadonlyArray<{ ref: string; claim: string }>;
}
export const QUESTION_SCHOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "confidenceTenths", "headline", "reason", "sections", "advice", "evidence"],
  properties: {
    verdict: { type: "string", enum: ["大吉", "吉", "平", "凶", "大凶"] },
    confidenceTenths: { type: "integer", minimum: 1, maximum: 9 },
    headline: { type: "string", minLength: 1, maxLength: 16 },
    reason: { type: "string", minLength: 1, maxLength: 60 },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text"],
        properties: {
          title: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
        },
      },
    },
    timing: {
      type: "object",
      additionalProperties: false,
      required: ["window", "condition"],
      properties: {
        window: { type: "string", minLength: 1 },
        condition: { type: "string", minLength: 1 },
      },
    },
    advice: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 1 } },
    evidence: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "claim"],
        properties: {
          ref: { type: "string", minLength: 1 },
          claim: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const satisfies JsonSchema;

export function questionLanguageErrors(
  output: Partial<Pick<QuestionSchoolOutput, "headline" | "reason" | "sections" | "timing" | "advice">>,
  language: "zh" | "en" = "zh",
  allowedHan: readonly string[] = [],
): string[] {
  if (output.headline === undefined) return [];
  const texts = [
    output.headline,
    output.reason ?? "",
    ...(output.sections ?? []).flatMap((section) => [section.title, section.text]),
    ...(output.timing ? [output.timing.window, output.timing.condition] : []),
    ...(output.advice ?? []),
  ];
  return language === "en" ? englishBodyErrors(texts, allowedHan) : chineseBodyErrors(texts);
}

export function checkVerdictConsistency(
  output: Pick<QuestionSchoolOutput, "verdict" | "confidenceTenths">
    & Partial<Pick<QuestionSchoolOutput, "headline" | "reason" | "sections" | "timing" | "advice">>,
  language: "zh" | "en" = "zh",
  allowedHan: readonly string[] = [],
): string[] {
  const errors = questionLanguageErrors(output, language, allowedHan);
  const { verdict, confidenceTenths } = output;
  if ((verdict === "大吉" || verdict === "吉") && confidenceTenths < 6) {
    errors.push(`${verdict}对应的把握不得低于六成`);
  }
  if (verdict === "平" && (confidenceTenths < 4 || confidenceTenths > 6)) {
    errors.push("平对应的把握必须为四至六成");
  }
  if ((verdict === "凶" || verdict === "大凶") && confidenceTenths > 4) {
    errors.push(`${verdict}对应的把握不得高于四成`);
  }
  return errors;
}
