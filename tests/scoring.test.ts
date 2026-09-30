import assert from "node:assert/strict";
import test from "node:test";

import {
  pairedPermutationPValue,
  summarizeBrierSkill,
} from "../src/scoring.js";

test("经验基础概率 5% 的常数参照 Brier 为 0.0475，模型 Brier 0.18 的 BSS 为负", () => {
  const outcomes = [true, ...Array.from({ length: 19 }, () => false)];
  const score = summarizeBrierSkill(outcomes, 0.18);

  assert.equal(score.yesCount, 1);
  assert.equal(score.empiricalBaseRateBps, 500);
  assert.ok(Math.abs(score.constantBaselineBrier - 0.0475) < 1e-12);
  assert.ok(score.brierSkillScore !== null);
  assert.ok(Math.abs(score.brierSkillScore! - (-2.789473684210526)) < 1e-12);
});

test("全 YES 或全 NO 时常数参照损失为零，BSS 明确不可定义", () => {
  for (const outcomes of [[true, true], [false, false]]) {
    const score = summarizeBrierSkill(outcomes, 0.1);
    assert.equal(score.constantBaselineBrier, 0);
    assert.equal(score.brierSkillScore, null);
  }
});

test("配对置换检验可复现，零差异返回一", () => {
  assert.equal(pairedPermutationPValue([0, 0, 0], 999, 7), 1);
  assert.equal(
    pairedPermutationPValue([0.1, 0.2, 0.1, 0.2], 999, 7),
    pairedPermutationPValue([0.1, 0.2, 0.1, 0.2], 999, 7),
  );
});
