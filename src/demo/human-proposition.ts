import { encodeAbiParameters, keccak256, stringToHex, type Hex } from "viem";

import type { DemoProposition, DemoResolution } from "./service.js";

export const ATTESTED_OUTCOME_PREDICATE_ID = keccak256(stringToHex("ATTESTED_OUTCOME"));
export const ATTESTED_OUTCOME_SCHEMA_HASH = keccak256(stringToHex("abi.encode(bytes32 requestHash,uint256 agentId)"));

export interface HumanWitnessInput {
  querentOutcome?: boolean | null;
  counterpartyOutcome?: boolean | null;
}

/** 人层冲突、缺席或拒绝判断都必须成为未决，不得猜测事实。 */
export function resolveHumanWitnesses(input: HumanWitnessInput): { outcome: boolean | null; unresolved: boolean } {
  if (typeof input.querentOutcome !== "boolean") return { outcome: null, unresolved: true };
  if (typeof input.counterpartyOutcome === "boolean" && input.counterpartyOutcome !== input.querentOutcome) {
    return { outcome: null, unresolved: true };
  }
  return { outcome: input.querentOutcome, unresolved: false };
}

export function humanRequestHash(input: { roundId: string; question: string }): Hex {
  return keccak256(stringToHex(`yijing-human-attestation-v1/${input.roundId}/${input.question.trim()}`));
}

/** 命题明文保持用户原话；resolver 参数只承载标准人层案件标识。 */
export function buildAttestedHumanProposition(input: {
  question: string;
  requestHash: Hex;
  agentId: bigint;
  cutoffBlock: bigint;
  deadlineBlock: bigint;
  horizon: "short" | "long";
}): DemoProposition {
  const resolution: DemoResolution = {
    tier: "human",
    method: "attested",
    witness: "querent",
    horizon: input.horizon,
    status: "awaiting-witness",
  };
  return {
    statement: input.question.trim(),
    predicateId: ATTESTED_OUTCOME_PREDICATE_ID,
    params: encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }],
      [input.requestHash, input.agentId],
    ),
    deadlineBlock: input.deadlineBlock.toString(),
    calibration: {
      method: "human-attestation-no-statistical-calibration",
      sampleCount: 0,
      yesCount: 0,
      empiricalBaseRateBps: 0,
      historyStartBlock: input.cutoffBlock.toString(),
      historyEndBlock: input.cutoffBlock.toString(),
      horizonBlocks: (input.deadlineBlock - input.cutoffBlock).toString(),
    },
    resolution,
  };
}
