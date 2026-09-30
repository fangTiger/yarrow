import assert from "node:assert/strict";
import test from "node:test";

import type { Hex } from "viem";
import type { HistoricalValuePair } from "../src/difficulty-calibration.js";

import {
  WalkForwardReplayEngine,
  deterministicRiskDecision,
  wilson95,
  type ReplayBlock,
  type ReplayPredictionInput,
  type ReplayPredictor,
  type ReplaySource,
} from "../src/replay/engine.js";

const hashFor = (blockNumber: bigint): Hex => `0x${blockNumber.toString(16).padStart(64, "0")}`;

class RecordingSource implements ReplaySource {
  readonly events: string[] = [];

  block(blockNumber: bigint): ReplayBlock {
    return {
      blockNumber,
      blockHash: hashFor(blockNumber),
      timestamp: 1_788_000_000n + blockNumber,
      totalSupply: 314_000_000_000_000_000n + blockNumber,
    };
  }

  async readCutoffSnapshot(cutoffBlock: bigint, lookbackBlocks: number) {
    this.events.push(`snapshot:${cutoffBlock}`);
    return {
      cutoff: this.block(cutoffBlock),
      history: Array.from({ length: lookbackBlocks }, (_unused, index) =>
        this.block(cutoffBlock - BigInt(lookbackBlocks - index))),
    };
  }

  async readResolution(resolutionBlock: bigint) {
    this.events.push(`resolve:${resolutionBlock}`);
    return this.block(resolutionBlock);
  }

  async readCalibrationHistory(cutoffBlock: bigint, horizonBlocks: bigint, sampleCount: number, stepBlocks: bigint): Promise<HistoricalValuePair[]> {
    this.events.push(`calibrate:${cutoffBlock}`);
    const latestStart = cutoffBlock - 1n - horizonBlocks;
    return Array.from({ length: sampleCount }, (_unused, index) => {
      const startBlock = latestStart - BigInt(sampleCount - 1 - index) * stepBlocks;
      const start = this.block(startBlock);
      const end = this.block(startBlock + horizonBlocks);
      const rank = BigInt(index - Math.floor(sampleCount / 2));
      return { ...start, startBlock, endBlock: end.blockNumber, startValue: start.totalSupply, endValue: start.totalSupply + rank };
    });
  }
}

test("每轮三位易者完成预测后才读取未来结算块，且输入不含未来事实", async () => {
  const source = new RecordingSource();
  const inputs: ReplayPredictionInput[] = [];
  const predictor: ReplayPredictor = {
    modelId: "deterministic-replay-mock-v1",
    predict: async (input) => {
      source.events.push(`predict:${input.divinerKey}`);
      inputs.push(input);
      const serialized = JSON.stringify(input, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value);
      assert.doesNotMatch(serialized, /outcome|resolutionTimestamp|futureSupply/);
      assert.equal(serialized.includes((314_000_000_000_000_000n + 110n).toString()), false);
      return { probabilityBps: input.divinerKey === "wuxing" ? 4_000 : 6_000, reasoning: "仅使用截止块上下文" };
    },
  };
  const engine = new WalkForwardReplayEngine({
    source,
    predictor,
    divinerKeys: ["takashima", "wuxing", "meihua"],
    sampleCount: 2,
    startBlock: 100n,
    blockStep: 20n,
    resolutionHorizon: 10n,
    lookbackBlocks: 2,
    feeUsdc6: 10_000n,
    initialBankrollUsdc6: 1_000_000n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
    difficultyCalibration: { sampleCount: 8, stepBlocks: 20n, minimumBaseRateBps: 3_500, maximumBaseRateBps: 6_500 },
  });

  const run = await engine.run();

  assert.deepEqual(source.events.slice(0, 6), [
    "snapshot:100",
    "calibrate:100",
    "predict:takashima",
    "predict:wuxing",
    "predict:meihua",
    "resolve:110",
  ]);
  assert.equal(run.backtested, true);
  assert.equal(run.rounds.length, 2);
  assert.equal(run.rounds.every((round) => round.backtested && round.predictions.length === 3), true);
  assert.equal(inputs[0]!.proposition, inputs[1]!.proposition);
  assert.equal(inputs[1]!.proposition, inputs[2]!.proposition);
  assert.equal(Object.isFrozen(inputs[0]!.proposition), true);
  assert.equal(inputs.every((input) => input.cutoff.blockNumber >= input.history.at(-1)!.blockNumber), true);
  assert.equal(run.rounds.every((round) => round.proposition.calibration.empiricalBaseRateBps >= 3_500), true);
  assert.equal(run.rounds.every((round) => round.proposition.calibration.empiricalBaseRateBps <= 6_500), true);
  assert.equal(run.outcomeBaseline.yesCount, 2);
  assert.equal(run.outcomeBaseline.empiricalBaseRateBps, 10_000);
  assert.equal(run.summaries.takashima.brierSkillScore, null);
});

test("同一轮三位易者并发生成，但下一轮仍等待本轮结算与表现更新", async () => {
  const source = new RecordingSource();
  let started = 0;
  let release!: () => void;
  let rejectBarrier!: (error: Error) => void;
  const allStarted = new Promise<void>((resolve, reject) => {
    release = resolve;
    rejectBarrier = reject;
  });
  const timer = setTimeout(() => rejectBarrier(new Error("三位易者没有并发启动")), 100);
  const predictor: ReplayPredictor = {
    modelId: "并发测试",
    predict: async () => {
      started += 1;
      if (started === 3) release();
      await allStarted;
      return { probabilityBps: 5_100, reasoning: "并发生成测试" };
    },
  };
  const engine = new WalkForwardReplayEngine({
    source,
    predictor,
    divinerKeys: ["takashima", "wuxing", "meihua"],
    sampleCount: 1,
    startBlock: 100n,
    blockStep: 20n,
    resolutionHorizon: 10n,
    lookbackBlocks: 1,
    feeUsdc6: 10_000n,
    initialBankrollUsdc6: 1_000_000n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
    difficultyCalibration: { sampleCount: 8, stepBlocks: 20n, minimumBaseRateBps: 3_500, maximumBaseRateBps: 6_500 },
  });

  try {
    const run = await engine.run();
    assert.equal(started, 3);
    assert.equal(run.rounds[0]!.predictions.length, 3);
  } finally {
    clearTimeout(timer);
  }
});

test("数据源若把截止块之后的观察混入预测窗口，引擎必须在调用易者前拒绝", async () => {
  let predictorCalls = 0;
  const source: ReplaySource = {
    readCutoffSnapshot: async (cutoffBlock) => ({
      cutoff: { blockNumber: cutoffBlock, blockHash: hashFor(cutoffBlock), timestamp: 1_000n, totalSupply: 10n },
      history: [{ blockNumber: cutoffBlock + 1n, blockHash: hashFor(cutoffBlock + 1n), timestamp: 1_001n, totalSupply: 11n }],
    }),
    readResolution: async (blockNumber) => ({
      blockNumber,
      blockHash: hashFor(blockNumber),
      timestamp: 1_010n,
      totalSupply: 12n,
    }),
    readCalibrationHistory: async () => [],
  };
  const predictor: ReplayPredictor = {
    modelId: "不会执行",
    predict: async () => {
      predictorCalls += 1;
      return { probabilityBps: 5_000, reasoning: "不应执行" };
    },
  };
  const engine = new WalkForwardReplayEngine({
    source,
    predictor,
    divinerKeys: ["takashima", "wuxing", "meihua"],
    sampleCount: 1,
    startBlock: 100n,
    blockStep: 20n,
    resolutionHorizon: 10n,
    lookbackBlocks: 1,
    feeUsdc6: 10_000n,
    initialBankrollUsdc6: 1_000_000n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
    difficultyCalibration: { sampleCount: 8, stepBlocks: 20n, minimumBaseRateBps: 3_500, maximumBaseRateBps: 6_500 },
  });

  await assert.rejects(engine.run(), /前视偏差/);
  assert.equal(predictorCalls, 0);
});

test("历史增量过于单调时在付费预测前剔除该谓词", async () => {
  let predictorCalls = 0;
  const source = new RecordingSource();
  source.readCalibrationHistory = async (cutoffBlock, horizonBlocks) => Array.from({ length: 10 }, (_unused, index) => ({
    startBlock: cutoffBlock - 100n + BigInt(index),
    endBlock: cutoffBlock - 100n + BigInt(index) + horizonBlocks,
    startValue: 1_000n,
    endValue: index < 7 ? 1_000n : 1_001n,
  }));
  const predictor: ReplayPredictor = {
    modelId: "不应执行",
    predict: async () => {
      predictorCalls += 1;
      return { probabilityBps: 5_000, reasoning: "不应执行" };
    },
  };
  const engine = new WalkForwardReplayEngine({
    source,
    predictor,
    divinerKeys: ["takashima", "wuxing", "meihua"],
    sampleCount: 1,
    startBlock: 1_000n,
    blockStep: 20n,
    resolutionHorizon: 6n,
    lookbackBlocks: 1,
    feeUsdc6: 10_000n,
    initialBankrollUsdc6: 1_000_000n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
    difficultyCalibration: { sampleCount: 10, stepBlocks: 8n, minimumBaseRateBps: 3_500, maximumBaseRateBps: 6_500 },
  });

  await assert.rejects(engine.run(), /不适合用于测量/);
  assert.equal(predictorCalls, 0);
});

test("候选截止点不平衡时只按截止前证据跳过，并继续收满合格回合", async () => {
  const source = new RecordingSource();
  const balancedHistory = source.readCalibrationHistory.bind(source);
  source.readCalibrationHistory = async (cutoffBlock, horizonBlocks, sampleCount, stepBlocks) => {
    if (cutoffBlock !== 100n) return balancedHistory(cutoffBlock, horizonBlocks, sampleCount, stepBlocks);
    const latestStart = cutoffBlock - 1n - horizonBlocks;
    return Array.from({ length: sampleCount }, (_unused, index) => ({
      startBlock: latestStart - BigInt(sampleCount - 1 - index) * stepBlocks,
      endBlock: latestStart - BigInt(sampleCount - 1 - index) * stepBlocks + horizonBlocks,
      startValue: 1_000n,
      endValue: 1_000n,
    }));
  };
  let predictorCalls = 0;
  const predictor: ReplayPredictor = {
    modelId: "跳过测试",
    predict: async () => {
      predictorCalls += 1;
      return { probabilityBps: 5_100, reasoning: "只预测合格候选" };
    },
  };
  const engine = new WalkForwardReplayEngine({
    source,
    predictor,
    divinerKeys: ["takashima", "wuxing", "meihua"],
    sampleCount: 1,
    startBlock: 100n,
    blockStep: 20n,
    resolutionHorizon: 10n,
    lookbackBlocks: 1,
    feeUsdc6: 10_000n,
    initialBankrollUsdc6: 1_000_000n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
    difficultyCalibration: { sampleCount: 8, stepBlocks: 20n, minimumBaseRateBps: 3_500, maximumBaseRateBps: 6_500 },
  });

  const run = await engine.run();

  assert.equal(run.sampleCount, 1);
  assert.equal(run.candidateCount, 2);
  assert.equal(run.skippedCandidateCount, 1);
  assert.equal(run.rounds[0]!.cutoff.blockNumber, 120n);
  assert.equal(run.rounds[0]!.replayId, 1);
  assert.equal(predictorCalls, 3);
});

test("bankroll 风险与更新完全由确定性 Beta 后验、风险上限和评分公式决定", () => {
  const first = deterministicRiskDecision({
    bankrollUsdc6: 1_000_000n,
    feeUsdc6: 10_000n,
    sampleCount: 0,
    totalBrier: 0n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
  });
  assert.deepEqual(first, { kellyBps: 0, multiplier: 1, reservedUsdc6: 30_000n });

  const constrained = deterministicRiskDecision({
    bankrollUsdc6: 100_000n,
    feeUsdc6: 10_000n,
    sampleCount: 100,
    totalBrier: 0n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
  });
  assert.equal(constrained.multiplier, 0);
  assert.equal(constrained.reservedUsdc6, 0n);
});

test("Wilson 95% 区间随样本量一起输出", () => {
  const interval = wilson95(18, 30);
  assert.equal(interval.lowerBps >= 4_200 && interval.lowerBps <= 4_300, true);
  assert.equal(interval.upperBps >= 7_500 && interval.upperBps <= 7_600, true);
});
