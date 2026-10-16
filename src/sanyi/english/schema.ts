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

/** 命理英文分项标题；结构与中文五分项一一对应。 */
export const DESTINY_TITLES_EN = [
  "Character", "Career", "Wealth", "Relationships", "Health",
] as const;

const baziUseGodEn = { type: "string", minLength: 1, maxLength: 120 } as const;
const baziSectionEn = QUESTION_SCHOOL_SCHEMA_EN.properties.sections.items;

/** 命理英文输出字段与必填项不变，只放宽英文长度。 */
export const DESTINY_SCHOOL_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["useGod", "headline", "reason", "sections", "advice", "evidence", "periods"],
  properties: {
    useGod: baziUseGodEn,
    headline: QUESTION_SCHOOL_SCHEMA_EN.properties.headline,
    reason: QUESTION_SCHOOL_SCHEMA_EN.properties.reason,
    advice: QUESTION_SCHOOL_SCHEMA_EN.properties.advice,
    evidence: QUESTION_SCHOOL_SCHEMA_EN.properties.evidence,
    sections: {
      type: "array", minItems: 5, maxItems: 5, additionalItems: false,
      items: DESTINY_TITLES_EN.map((title) => ({
        ...baziSectionEn,
        properties: {
          ...baziSectionEn.properties,
          title: { type: "string", const: title },
        },
      })),
    },
    periods: {
      type: "array", maxItems: 12,
      items: {
        type: "object", additionalProperties: false,
        required: ["index", "verdict", "confidenceTenths", "note"],
        properties: {
          index: { type: "integer", minimum: 1, maximum: 12 },
          verdict: QUESTION_SCHOOL_SCHEMA_EN.properties.verdict,
          confidenceTenths: QUESTION_SCHOOL_SCHEMA_EN.properties.confidenceTenths,
          note: { type: "string", minLength: 1, maxLength: 120 },
        },
      },
    },
  },
} as const satisfies JsonSchema;

/** 运势英文输出字段与必填项不变，只放宽英文长度。 */
export const FORTUNE_SCHOOL_SCHEMA_EN = {
  ...QUESTION_SCHOOL_SCHEMA_EN,
  required: [...QUESTION_SCHOOL_SCHEMA_EN.required, "useGod", "years"],
  properties: {
    ...QUESTION_SCHOOL_SCHEMA_EN.properties,
    useGod: baziUseGodEn,
    years: {
      type: "array", minItems: 1, maxItems: 10,
      items: {
        type: "object", additionalProperties: false,
        required: ["year", "verdict", "confidenceTenths", "note"],
        properties: {
          year: { type: "integer", minimum: 1900, maximum: 2099 },
          verdict: QUESTION_SCHOOL_SCHEMA_EN.properties.verdict,
          confidenceTenths: QUESTION_SCHOOL_SCHEMA_EN.properties.confidenceTenths,
          note: { type: "string", minLength: 1, maxLength: 100 },
        },
      },
    },
  },
} as const satisfies JsonSchema;
