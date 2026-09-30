import assert from "node:assert/strict";
import test from "node:test";

import type { ReplayRun } from "../src/replay/engine.js";
import { renderReplayReport, serializeReplayRun } from "../src/replay/report.js";

const run: ReplayRun = {
  backtested: true,
  modelId: "deterministic-replay-mock-v1",
  sampleCount: 1,
  candidateCount: 1,
  skippedCandidateCount: 0,
  outcomeBaseline: {
    sampleCount: 1,
    yesCount: 1,
    empiricalBaseRate: 1,
    empiricalBaseRateBps: 10_000,
    constantBaselineBrier: 0,
  },
  summaries: {
    takashima: { sampleCount: 1, correctCount: 1, averageBrier: 0.16, brierSkillScore: null, brierVsConstantPValue: null, wilson95: { lowerBps: 2_065, upperBps: 10_000 }, finalBankrollUsdc6: 1_003_600n },
    wuxing: { sampleCount: 1, correctCount: 0, averageBrier: 0.36, brierSkillScore: null, brierVsConstantPValue: null, wilson95: { lowerBps: 0, upperBps: 7_934 }, finalBankrollUsdc6: 995_600n },
    meihua: { sampleCount: 1, correctCount: 1, averageBrier: 0.16, brierSkillScore: null, brierVsConstantPValue: null, wilson95: { lowerBps: 2_065, upperBps: 10_000 }, finalBankrollUsdc6: 1_003_600n },
  },
  rounds: [{
    replayId: 1,
    backtested: true,
    cutoff: { blockNumber: 100n, blockHash: `0x${"01".repeat(32)}`, timestamp: 1_788_000_000n, totalSupply: 100n },
    resolution: { blockNumber: 110n, blockHash: `0x${"02".repeat(32)}`, timestamp: 1_788_000_005n, totalSupply: 101n },
    proposition: {
      predicateId: `0x${"03".repeat(32)}`,
      statement: "标准化问题",
      cutoffBlock: 100n,
      resolutionBlock: 110n,
      threshold: 100n,
      calibration: { suitable: true, threshold: 100n, thresholdDelta: 0n, sampleCount: 8, yesCount: 4, empiricalBaseRateBps: 5_000, historyStartBlock: 1n, historyEndBlock: 99n, horizonBlocks: 10n },
    },
    hexagram: { lines: [7, 7, 7, 7, 7, 7], primaryKingWenNumber: 1, derivedKingWenNumber: 1, changingLinePositions: [] },
    outcome: true,
    predictions: [
      { divinerKey: "takashima", probabilityBps: 6_000, reasoning: "mock", direction: "YES", multiplier: 1, reservedUsdc6: 30_000n, settlementDeltaUsdc6: 3_600n, bankrollBeforeUsdc6: 1_000_000n, bankrollAfterUsdc6: 1_003_600n, brier: 16_000_000n, correct: true },
      { divinerKey: "wuxing", probabilityBps: 4_000, reasoning: "mock", direction: "NO", multiplier: 1, reservedUsdc6: 30_000n, settlementDeltaUsdc6: -4_400n, bankrollBeforeUsdc6: 1_000_000n, bankrollAfterUsdc6: 995_600n, brier: 36_000_000n, correct: false },
      { divinerKey: "meihua", probabilityBps: 6_000, reasoning: "mock", direction: "YES", multiplier: 1, reservedUsdc6: 30_000n, settlementDeltaUsdc6: 3_600n, bankrollBeforeUsdc6: 1_000_000n, bankrollAfterUsdc6: 1_003_600n, brier: 16_000_000n, correct: true },
    ],
  }],
};

test("回放报告强制披露 backtested、基础概率、Brier、BSS、Wilson 与胜率警告", () => {
  const markdown = renderReplayReport(run, { generatedAt: "2026-09-05T00:00:00.000Z", chainId: 5_042_002 });
  assert.match(markdown, /backtested/);
  assert.match(markdown, /非现场历史/);
  assert.match(markdown, /不能证明易经有预测力/);
  assert.match(markdown, /样本量 n/);
  assert.match(markdown, /Wilson 95%/);
  assert.match(markdown, /平均 Brier/);
  assert.match(markdown, /实际基础概率.*YES 占比/);
  assert.match(markdown, /常数预测参照 Brier/);
  assert.match(markdown, /BSS/);
  assert.match(markdown, /极端基础概率.*命中率.*误导/);
  assert.match(markdown, /检验 p/);
  assert.match(markdown, /\| 1 \| backtested \|/);
});

test("JSON 顶层和逐轮标记 backtested 且 bigint 精确序列化为十进制字符串", () => {
  const parsed = JSON.parse(serializeReplayRun(run, { generatedAt: "2026-09-05T00:00:00.000Z", chainId: 5_042_002 })) as {
    backtested: boolean;
    outcomeBaseline: { empiricalBaseRateBps: number };
    rounds: Array<{ backtested: boolean; cutoff: { blockNumber: string } }>;
  };
  assert.equal(parsed.backtested, true);
  assert.equal(parsed.rounds[0]!.backtested, true);
  assert.equal(parsed.rounds[0]!.cutoff.blockNumber, "100");
  assert.equal(parsed.outcomeBaseline.empiricalBaseRateBps, 10_000);
});

test("报告披露仅按截止前难度证据跳过的不平衡候选", () => {
  const markdown = renderReplayReport(
    { ...run, candidateCount: 2, skippedCandidateCount: 1 },
    { generatedAt: "2026-09-05T00:00:00.000Z", chainId: 5_042_002 },
  );

  assert.match(markdown, /候选截止点：2；因不满足既定难度范围跳过：1/);
  assert.match(markdown, /跳过判定只使用对应截止块之前的历史/);
});
