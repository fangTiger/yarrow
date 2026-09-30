import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAblationPredictorInput,
  counterfactualLines,
  pairedPermutationPValue,
  randomHexagramLines,
  renderAblationReport,
  runAblationExperiment,
  serializeAblationReport,
  type FrozenReplaySource,
} from "../src/replay/ablation.js";

const source: FrozenReplaySource = {
  sourceReport: "reports/source.json",
  sampleCount: 4,
  rounds: Array.from({ length: 4 }, (_unused, index) => ({
    replayId: index + 1,
    cutoff: {
      blockNumber: 100n + BigInt(index) * 8n,
      blockHash: `0x${(index + 1).toString(16).padStart(64, "0")}` as `0x${string}`,
      totalSupply: 1_000_000n + BigInt(index),
    },
    proposition: {
      statement: `同一标准问题 ${index + 1}`,
      cutoffBlock: 100n + BigInt(index) * 8n,
      resolutionBlock: 106n + BigInt(index) * 8n,
      threshold: 1_000_000n + BigInt(index),
      calibration: { suitable: true, threshold: 1_000_000n + BigInt(index), thresholdDelta: 0n, sampleCount: 8, yesCount: 4, empiricalBaseRateBps: 5_000, historyStartBlock: 1n, historyEndBlock: 8n, horizonBlocks: 1n },
    },
    hexagram: {
      lines: [6, 7, 8, 9, 7, 8],
      primaryKingWenNumber: 1,
      derivedKingWenNumber: 2,
    },
    outcome: index % 2 === 0,
  })),
};

test("无卦象输入不含六爻、卦号或可反推卦象的截止块哈希", () => {
  const input = buildAblationPredictorInput({
    condition: "none",
    round: source.rounds[0]!,
    divinerKey: "takashima",
    performance: { sampleCount: 0, correctCount: 0, totalBrier: 0n, bankrollUsdc6: 3_000_000n },
  });
  const serialized = JSON.stringify(input, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value);

  assert.doesNotMatch(serialized, /hexagram|lines|KingWen|blockHash/i);
  assert.match(serialized, /同一标准问题 1/);
});

test("随机卦象只由固定实验种子和 replayId 派生，同问题不同卦象使用互补六爻", () => {
  assert.deepEqual(randomHexagramLines(7), randomHexagramLines(7));
  assert.notDeepEqual(randomHexagramLines(7), randomHexagramLines(8));
  assert.deepEqual(counterfactualLines([6, 7, 8, 9, 7, 8]), [9, 8, 7, 6, 8, 7]);
});

test("四组共享同一批轮次、命题和结果，并分别输出总体统计", () => {
  const report = runAblationExperiment(source, "2026-09-05T00:00:00.000Z", 5_042_002, 999);

  assert.deepEqual(Object.keys(report.groups), ["actual", "none", "random", "counterfactual"]);
  for (const group of Object.values(report.groups)) {
    assert.equal(group.roundCount, 4);
    assert.equal(group.summary.sampleCount, 12);
    assert.deepEqual(group.rounds.map((round) => round.replayId), [1, 2, 3, 4]);
    assert.deepEqual(group.rounds.map((round) => round.outcome), [true, false, true, false]);
    assert.equal(group.summary.empiricalBaseRateBps, 5_000);
    assert.equal(group.summary.constantBaselineBrier, 0.25);
    assert.equal(typeof group.summary.brierSkillScore, "number");
    assert.equal(typeof group.summary.brierVsConstantPValue, "number");
  }
  assert.equal(report.comparisons.length, 3);
  assert.equal(report.pairedHexagramSensitivity.pairCount, 12);
});

test("配对置换检验对零差异返回一，对一致方向的大效应返回小概率", () => {
  assert.equal(pairedPermutationPValue([0, 0, 0], 999, 1), 1);
  assert.equal(pairedPermutationPValue(Array.from({ length: 20 }, () => 1), 9_999, 2) < 0.01, true);
});

test("消融报告披露四组数字、检验方法和 mock 限制", () => {
  const report = runAblationExperiment(source, "2026-09-05T00:00:00.000Z", 5_042_002, 999);
  const json = serializeAblationReport(report);
  const markdown = renderAblationReport(report);

  assert.match(json, /"condition": "none"/);
  assert.match(markdown, /无卦象/);
  assert.match(markdown, /随机卦象/);
  assert.match(markdown, /同问题不同卦象/);
  assert.match(markdown, /配对置换检验/);
  assert.match(markdown, /Holm/);
  assert.match(markdown, /基础概率.*YES 占比/);
  assert.match(markdown, /BSS/);
  assert.match(markdown, /极端基础概率.*命中率.*误导/);
  assert.match(markdown, /不能推断真实模型/);
  assert.match(markdown, /不是直接复制既有主回放概率/);
});
