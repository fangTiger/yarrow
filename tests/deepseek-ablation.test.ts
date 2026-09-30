import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { hashText } from "../src/agent/audit.js";
import type { StructuredOutputProvider, StructuredOutputRequest } from "../src/agent/provider.js";
import { runDeepSeekAblationExperiment } from "../src/replay/deepseek-ablation.js";
import { DeepSeekReplayPredictor } from "../src/replay/deepseek-predictor.js";
import { FileGenerationJournal, ResumableStructuredGenerator } from "../src/replay/generation-journal.js";
import { buildAblationPredictorInput, type FrozenReplaySource } from "../src/replay/ablation.js";

test("真实 provider 的四组消融共享冻结轮次，并按轮次配对统计", async () => {
  const source: FrozenReplaySource = {
    sourceReport: "reports/deepseek-main.json",
    sampleCount: 4,
    rounds: Array.from({ length: 4 }, (_unused, index) => ({
      replayId: index + 1,
      cutoff: {
        blockNumber: 100n + BigInt(index * 8),
        blockHash: `0x${(index + 1).toString(16).padStart(64, "0")}`,
        totalSupply: 1_000n,
      },
      proposition: {
        statement: `冻结命题 ${index + 1}`,
        cutoffBlock: 100n + BigInt(index * 8),
        resolutionBlock: 106n + BigInt(index * 8),
        threshold: 1_000n,
        calibration: { suitable: true, threshold: 1_000n, thresholdDelta: 0n, sampleCount: 8, yesCount: 4, empiricalBaseRateBps: 5_000, historyStartBlock: 1n, historyEndBlock: 8n, horizonBlocks: 1n },
      },
      hexagram: { lines: [6, 7, 8, 9, 7, 8], primaryKingWenNumber: 47, derivedKingWenNumber: 60 },
      outcome: index % 2 === 0,
    })),
  };
  let calls = 0;
  const provider: StructuredOutputProvider = {
    modelId: "deepseek-v4-flash",
    providerConfig: { model: "deepseek-v4-flash" },
    providerConfigHash: `0x${"05".repeat(32)}`,
    generateStructured: async <T>(request: StructuredOutputRequest) => {
      calls += 1;
      const probabilityBps = calls % 2 === 0 ? 4_900 : 5_100;
      const raw = JSON.stringify({
        direction: probabilityBps >= 5_000 ? "YES" : "NO",
        probabilityBps,
        reasoning: "固定测试输出",
      });
      await request.recordAttempt?.({ attempt: 1, result: "valid", rawOutput: raw, rawOutputHash: hashText(raw) });
      return JSON.parse(raw) as T;
    },
  };
  const directory = await mkdtemp(path.join(tmpdir(), "yijing-deepseek-ablation-"));
  const journal = await FileGenerationJournal.open(path.join(directory, "attempts.jsonl"));
  const predictor = new DeepSeekReplayPredictor(new ResumableStructuredGenerator(provider, journal));

  const report = await runDeepSeekAblationExperiment({
    source,
    predictor,
    generatedAt: "2026-09-05T04:00:00.000Z",
    chainId: 5_042_002,
    providerConfigHash: provider.providerConfigHash,
    permutationRuns: 999,
  });

  assert.deepEqual(Object.keys(report.groups), ["actual", "none", "random", "counterfactual"]);
  assert.equal(report.provider.kind, "deepseek");
  assert.equal(report.design.pairedRounds, 4);
  assert.equal(report.design.predictionsPerGroup, 12);
  assert.equal(report.comparisons.length, 3);
  assert.equal(report.groups.actual.summary.empiricalBaseRateBps, 5_000);
  assert.equal(typeof report.groups.actual.summary.brierSkillScore, "number");
  assert.equal(calls, 48);
});

test("actual 恢复哈希不一致时必须在任何付费对照请求前停止", async () => {
  const source: FrozenReplaySource = {
    sourceReport: "reports/deepseek-main.json",
    sampleCount: 1,
    rounds: [{
      replayId: 1,
      cutoff: {
        blockNumber: 100n,
        blockHash: `0x${"01".repeat(32)}`,
        totalSupply: 1_000n,
      },
      proposition: {
        statement: "冻结命题",
        cutoffBlock: 100n,
        resolutionBlock: 106n,
        threshold: 1_000n,
        calibration: { suitable: true, threshold: 1_000n, thresholdDelta: 0n, sampleCount: 8, yesCount: 4, empiricalBaseRateBps: 5_000, historyStartBlock: 1n, historyEndBlock: 8n, horizonBlocks: 1n },
      },
      hexagram: { lines: [6, 7, 8, 9, 7, 8], primaryKingWenNumber: 47, derivedKingWenNumber: 60 },
      outcome: true,
    }],
  };
  let calls = 0;
  const provider: StructuredOutputProvider = {
    modelId: "deepseek-v4-flash",
    providerConfig: { model: "deepseek-v4-flash" },
    providerConfigHash: `0x${"05".repeat(32)}`,
    generateStructured: async <T>(request: StructuredOutputRequest) => {
      calls += 1;
      const raw = JSON.stringify({ direction: "YES", probabilityBps: 5_100, reasoning: "固定测试输出" });
      await request.recordAttempt?.({ attempt: 1, result: "valid", rawOutput: raw, rawOutputHash: hashText(raw) });
      return JSON.parse(raw) as T;
    },
  };
  const directory = await mkdtemp(path.join(tmpdir(), "yijing-deepseek-ablation-preflight-"));
  const journal = await FileGenerationJournal.open(path.join(directory, "attempts.jsonl"));
  const predictor = new DeepSeekReplayPredictor(new ResumableStructuredGenerator(provider, journal));

  for (const divinerKey of ["takashima", "wuxing", "meihua"] as const) {
    await predictor.predictAblation("actual", buildAblationPredictorInput({
      condition: "actual",
      round: source.rounds[0]!,
      divinerKey,
      performance: { sampleCount: 0, correctCount: 0, totalBrier: 0n, bankrollUsdc6: 3_000_000n },
    }));
  }
  assert.equal(calls, 3);
  calls = 0;

  const changedSource: FrozenReplaySource = {
    ...source,
    rounds: [{
      ...source.rounds[0]!,
      proposition: { ...source.rounds[0]!.proposition, statement: "被篡改的冻结命题" },
    }],
  };
  await assert.rejects(
    runDeepSeekAblationExperiment({
      source: changedSource,
      predictor,
      generatedAt: "2026-09-05T04:00:00.000Z",
      chainId: 5_042_002,
      providerConfigHash: provider.providerConfigHash,
      permutationRuns: 99,
    }),
    /请求哈希不一致/,
  );
  assert.equal(calls, 0);
});
