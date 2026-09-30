import assert from "node:assert/strict";
import test from "node:test";
import { decodeAbiParameters } from "viem";

import {
  ATTESTED_OUTCOME_PREDICATE_ID,
  buildAttestedHumanProposition,
  resolveHumanWitnesses,
} from "../src/demo/human-proposition.js";

const REQUEST_HASH = `0x${"cd".repeat(32)}` as const;

test("人层命题保留原问题且编码既有 AttestedResolver 参数", () => {
  const proposition = buildAttestedHumanProposition({
    question: "今天之内会不会收到那条消息",
    requestHash: REQUEST_HASH,
    agentId: 891_440n,
    cutoffBlock: 100n,
    deadlineBlock: 180n,
    horizon: "short",
  });

  assert.equal(proposition.statement, "今天之内会不会收到那条消息");
  assert.equal(proposition.predicateId, ATTESTED_OUTCOME_PREDICATE_ID);
  assert.doesNotMatch(JSON.stringify(proposition), /USDC|总量|agent 计数/i);
  assert.deepEqual(
    decodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], proposition.params),
    [REQUEST_HASH, 891_440n],
  );
  assert.deepEqual(proposition.resolution, {
    tier: "human",
    method: "attested",
    witness: "querent",
    horizon: "short",
    status: "awaiting-witness",
  });
});

test("双方见证冲突或缺席时只能进入未决之卦", () => {
  assert.deepEqual(resolveHumanWitnesses({ querentOutcome: true, counterpartyOutcome: true }), {
    outcome: true,
    unresolved: false,
  });
  assert.deepEqual(resolveHumanWitnesses({ querentOutcome: false }), {
    outcome: false,
    unresolved: false,
  });
  assert.deepEqual(resolveHumanWitnesses({ querentOutcome: true, counterpartyOutcome: false }), {
    outcome: null,
    unresolved: true,
  });
  assert.deepEqual(resolveHumanWitnesses({}), { outcome: null, unresolved: true });
});
