import type { JsonSchema } from "../../agent/schemas.js";

/** 问事英文输出与中文字段完全相同，只放宽英文所需的字符上限。 */
export const QUESTION_SCHOOL_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "confidenceTenths", "headline", "reason", "sections", "advice", "evidence"],
  properties: {
    verdict: { type: "string", enum: ["大吉", "吉", "平", "凶", "大凶"] },
    confidenceTenths: { type: "integer", minimum: 1, maximum: 9 },
    headline: { type: "string", minLength: 1, maxLength: 90 },
    reason: { type: "string", minLength: 1, maxLength: 240 },
    sections: {
      type: "array", minItems: 3, maxItems: 5,
      items: {
        type: "object", additionalProperties: false, required: ["title", "text"],
        properties: {
          title: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
        },
      },
    },
    timing: {
      type: "object", additionalProperties: false, required: ["window", "condition"],
      properties: {
        window: { type: "string", minLength: 1 },
        condition: { type: "string", minLength: 1 },
      },
    },
    advice: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 1 } },
    evidence: {
      type: "array", minItems: 1,
      items: {
        type: "object", additionalProperties: false, required: ["ref", "claim"],
        properties: {
          ref: { type: "string", minLength: 1 },
          claim: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const satisfies JsonSchema;

/** 总述英文输出与中文字段完全相同，长度约为中文上限的四倍。 */
export const SUMMARY_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["conclusion", "agreement", "explanation", "remedy"],
  properties: {
    tone: { type: "string", enum: ["顺", "中", "不顺"] },
    conclusion: { type: "string", minLength: 1, maxLength: 160 },
    agreement: { type: "string", minLength: 1, maxLength: 600 },
    difference: { type: "string", minLength: 1, maxLength: 600 },
    explanation: {
      type: "array", minItems: 2, maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 800 },
    },
    remedy: {
      type: "object", additionalProperties: false, required: ["principle", "plan", "avoid"],
      properties: {
        principle: { type: "string", minLength: 1, maxLength: 240 },
        plan: {
          type: "array", minItems: 2, maxItems: 3,
          items: {
            type: "object", additionalProperties: false, required: ["action", "basis"],
            properties: {
              action: { type: "string", minLength: 1, maxLength: 160 },
              basis: { type: "string", minLength: 1, maxLength: 200 },
              timing: { type: "string", minLength: 1, maxLength: 120 },
            },
          },
        },
        avoid: { type: "array", minItems: 1, maxItems: 2,
          items: { type: "string", minLength: 1, maxLength: 160 } },
      },
    },
    portrait: {
      type: "object", additionalProperties: false,
      required: ["traits", "strengths", "blindSpots", "summary"],
      properties: {
        traits: { type: "array", minItems: 3, maxItems: 5,
          items: { type: "string", minLength: 1, maxLength: 28 } },
        strengths: { type: "array", minItems: 2, maxItems: 2,
          items: { type: "string", minLength: 1, maxLength: 160 } },
        blindSpots: { type: "array", minItems: 2, maxItems: 2,
          items: { type: "string", minLength: 1, maxLength: 160 } },
        summary: { type: "string", minLength: 1, maxLength: 240 },
      },
    },
    watch: {
      type: "object", additionalProperties: false, required: ["window", "condition"],
      properties: {
        window: { type: "string", minLength: 1, maxLength: 240 },
        condition: { type: "string", minLength: 1, maxLength: 320 },
      },
    },
    outlook: { type: "string", minLength: 1, maxLength: 320 },
  },
} as const satisfies JsonSchema;
