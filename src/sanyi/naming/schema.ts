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
  chars: { char: string; gloss: string }[];
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
  favorableSource: "tiaohou" | "industry" | "model";
  favorableNote: string;
  candidates: ClassicLine[];
}

const charMeaningSchema = {
  type: "object",
  additionalProperties: false,
  required: ["char", "gloss"],
  properties: {
    char: { type: "string", minLength: 1, maxLength: 1 },
    gloss: { type: "string", minLength: 1, maxLength: 12 },
  },
} as const;

const nameSchema = {
  type: "object",
  additionalProperties: false,
  required: ["given", "meaning", "why", "chars"],
  properties: {
    given: { type: "string", minLength: 1, maxLength: 4 },
    meaning: { type: "string", minLength: 1, maxLength: 50 },
    why: { type: "string", minLength: 1, maxLength: 50 },
    sourceId: { type: "string", minLength: 1, maxLength: 12 },
    chars: { type: "array", minItems: 1, maxItems: 4, items: charMeaningSchema },
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
