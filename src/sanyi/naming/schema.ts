import type { JsonSchema } from "../../agent/schemas.js";
import type { ClassicLine } from "./classics.js";
import type { Element } from "./lexicon.js";

export type NamingFamilyKey = "wuxing" | "shiwen" | "yinyi";

export interface NamingName {
  given: string;
  meaning: string;
  why: string;
  sourceId?: string;
  /** 逐字字义：该字在这个名字里取的意思，顺序与 given 一致，gloss 不超过 12 字。 */
  chars: { char: string; gloss: string; sense: string }[];
  tags: string[];
}

export interface NamingFamilyOutput {
  note: string;
  element?: Element;
  names: NamingName[];
}

export interface NamingSummaryOutput {
  picks: { given: string; reason: string }[];
  overview: string;
  tips: string[];
}

export interface NamingContext {
  target: "person" | "business";
  surname?: string;
  gender: "male" | "female" | "any";
  length: 1 | 2 | 3 | 4;
  question: string;
  favorable: Element[] | null;
  favorableSource: "missing" | "tiaohou" | "industry" | "model";
  favorableNote: string;
  candidates: ClassicLine[];
  /** 缺省中文；英文仍保留 given 与 chars[].char 为汉字。 */
  language?: "zh" | "en";
}

const charMeaningSchema = {
  type: "object",
  additionalProperties: false,
  required: ["char", "gloss", "sense"],
  properties: {
    char: { type: "string", minLength: 1, maxLength: 1 },
    gloss: { type: "string", minLength: 1, maxLength: 12 },
    sense: { type: "string", minLength: 1, maxLength: 30 },
  },
} as const;

const nameSchema = {
  type: "object",
  additionalProperties: false,
  required: ["given", "meaning", "why", "chars", "tags"],
  properties: {
    given: { type: "string", minLength: 1, maxLength: 4 },
    meaning: { type: "string", minLength: 1, maxLength: 50 },
    why: { type: "string", minLength: 1, maxLength: 50 },
    sourceId: { type: "string", minLength: 1, maxLength: 12 },
    chars: { type: "array", minItems: 1, maxItems: 4, items: charMeaningSchema },
    tags: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", minLength: 2, maxLength: 4 },
    },
  },
} as const;

export const NAMING_FAMILY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["note", "names"],
  properties: {
    note: { type: "string", minLength: 1, maxLength: 80 },
    element: { type: "string", enum: ["木", "火", "土", "金", "水"] },
    names: { type: "array", minItems: 3, maxItems: 3, items: nameSchema },
  },
} as const satisfies JsonSchema;

export const NAMING_SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks", "overview", "tips"],
  properties: {
    picks: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["given", "reason"],
        properties: {
          given: { type: "string", minLength: 1, maxLength: 4 },
          reason: { type: "string", minLength: 1, maxLength: 60 },
        },
      },
    },
    overview: { type: "string", minLength: 1, maxLength: 150 },
    tips: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 40 },
    },
  },
} as const satisfies JsonSchema;

const charMeaningSchemaEn = {
  type: "object",
  additionalProperties: false,
  required: ["char", "gloss", "sense"],
  properties: {
    char: { type: "string", minLength: 1, maxLength: 1 },
    gloss: { type: "string", minLength: 1, maxLength: 48 },
    sense: { type: "string", minLength: 1, maxLength: 120 },
  },
} as const;

const nameSchemaEn = {
  type: "object",
  additionalProperties: false,
  required: ["given", "meaning", "why", "chars", "tags"],
  properties: {
    given: { type: "string", minLength: 1, maxLength: 4 },
    meaning: { type: "string", minLength: 1, maxLength: 200 },
    why: { type: "string", minLength: 1, maxLength: 240 },
    sourceId: { type: "string", minLength: 1, maxLength: 12 },
    chars: { type: "array", minItems: 1, maxItems: 4, items: charMeaningSchemaEn },
    tags: {
      type: "array", minItems: 3, maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 24 },
    },
  },
} as const;

/** 起名单家英文 Schema：字段不变，展示文案长度按英文口径放宽。 */
export const NAMING_FAMILY_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["note", "names"],
  properties: {
    note: { type: "string", minLength: 1, maxLength: 320 },
    element: { type: "string", enum: ["木", "火", "土", "金", "水"] },
    names: { type: "array", minItems: 3, maxItems: 3, items: nameSchemaEn },
  },
} as const satisfies JsonSchema;

/** 起名合参英文 Schema：字段不变，展示文案长度按英文口径放宽。 */
export const NAMING_SUMMARY_SCHEMA_EN = {
  type: "object",
  additionalProperties: false,
  required: ["picks", "overview", "tips"],
  properties: {
    picks: {
      type: "array", minItems: 2, maxItems: 3,
      items: {
        type: "object", additionalProperties: false, required: ["given", "reason"],
        properties: {
          given: { type: "string", minLength: 1, maxLength: 4 },
          reason: { type: "string", minLength: 1, maxLength: 240 },
        },
      },
    },
    overview: { type: "string", minLength: 1, maxLength: 600 },
    tips: {
      type: "array", minItems: 2, maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 160 },
    },
  },
} as const satisfies JsonSchema;
