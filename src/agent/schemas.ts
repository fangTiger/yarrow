export type JsonSchema = Record<string, unknown>;

export interface PropositionSelectionOutput {
  predicateId: `0x${string}`;
  params: `0x${string}`;
  reasoning: string;
}

export interface DivinerOutput {
  direction: "YES" | "NO";
  probabilityBps: number;
  reasoning: string;
}

export const PROPOSITION_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["predicateId", "params", "reasoning"],
  properties: {
    predicateId: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
    params: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
    reasoning: { type: "string", minLength: 1 },
  },
} as const satisfies JsonSchema;

export const PREDICTION_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["direction", "probabilityBps", "reasoning"],
  properties: {
    direction: { type: "string", enum: ["YES", "NO"] },
    probabilityBps: { type: "integer", minimum: 100, maximum: 9_900 },
    reasoning: { type: "string", minLength: 1 },
  },
  allOf: [
    {
      if: { properties: { probabilityBps: { type: "integer", minimum: 5_001 } }, required: ["probabilityBps"] },
      then: { properties: { direction: { type: "string", const: "YES" } }, required: ["direction"] },
    },
    {
      if: { properties: { probabilityBps: { type: "integer", maximum: 4_999 } }, required: ["probabilityBps"] },
      then: { properties: { direction: { type: "string", const: "NO" } }, required: ["direction"] },
    },
  ],
} as const satisfies JsonSchema;
