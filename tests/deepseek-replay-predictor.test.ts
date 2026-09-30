import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { hashText } from "../src/agent/audit.js";
import type { StructuredOutputProvider, StructuredOutputRequest } from "../src/agent/provider.js";
import { DeepSeekReplayPredictor } from "../src/replay/deepseek-predictor.js";
import { FileGenerationJournal, ResumableStructuredGenerator } from "../src/replay/generation-journal.js";
import type { ReplayPredictionInput } from "../src/replay/engine.js";

const baseInput: ReplayPredictionInput = {
  roundIndex: 0,
  divinerKey: "takashima",
  cutoff: {
    blockNumber: 100n,
    blockHash: `0x${"01".repeat(32)}`,
    timestamp: 1_000n,
    totalSupply: 20n,
  },
  history: [],
  hexagram: {
    lines: [6, 7, 8, 9, 7, 8],
    primaryKingWenNumber: 47,
    derivedKingWenNumber: 60,
    changingLinePositions: [1, 4],
  },
  proposition: {
    predicateId: `0x${"02".repeat(32)}`,
    statement: "固定命题",
    cutoffBlock: 100n,
    resolutionBlock: 106n,
    threshold: 20n,
    calibration: { suitable: true, threshold: 20n, thresholdDelta: 0n, sampleCount: 8, yesCount: 4, empiricalBaseRateBps: 5_000, historyStartBlock: 1n, historyEndBlock: 99n, horizonBlocks: 6n },
  },
  performance: { sampleCount: 0, correctCount: 0, totalBrier: 0n, bankrollUsdc6: 3_000_000n },
};

test("四组提示只改变卦象暴露，无卦象组不泄漏六爻、卦号或块哈希", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yijing-replay-predictor-"));
  const requests: StructuredOutputRequest[] = [];
  const raw = JSON.stringify({ direction: "YES", probabilityBps: 5_100, reasoning: "简短理由" });
  const provider: StructuredOutputProvider = {
    modelId: "deepseek-v4-flash",
    providerConfig: { model: "deepseek-v4-flash" },
    providerConfigHash: `0x${"03".repeat(32)}`,
    generateStructured: async <T>(request: StructuredOutputRequest) => {
      requests.push(request);
      await request.recordAttempt?.({ attempt: 1, result: "valid", rawOutput: raw, rawOutputHash: hashText(raw) });
      return JSON.parse(raw) as T;
    },
  };
  const journal = await FileGenerationJournal.open(path.join(directory, "attempts.jsonl"));
  const predictor = new DeepSeekReplayPredictor(new ResumableStructuredGenerator(provider, journal));

  await predictor.predict(baseInput);
  await predictor.predictAblation("none", {
    roundIndex: 0,
    divinerKey: "wuxing",
    proposition: baseInput.proposition,
    performance: baseInput.performance,
  });

  assert.match(requests[0]!.userPrompt, /六爻/);
  assert.match(requests[0]!.userPrompt, /卦辞/);
  assert.match(requests[0]!.userPrompt, /历史回测基础概率=50\.00%/);
  assert.match(requests[0]!.userPrompt, /历史窗口=1–99/);
  assert.doesNotMatch(requests[1]!.userPrompt, /六爻|卦辞|爻辞|本卦|之卦|blockHash|0x0101/);
  assert.match(requests[1]!.userPrompt, /固定命题/);
  assert.doesNotMatch(requests[0]!.userPrompt, /有真实卦象|消融|对照组/);
  assert.match(journal.allEntries()[0]!.key, /deepseek-replay-v3/);
});

test("主回放的实际卦象输出可直接作为 actual 消融组，不会重复生成", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yijing-replay-predictor-"));
  let calls = 0;
  const raw = JSON.stringify({ direction: "NO", probabilityBps: 4_900, reasoning: "首个合法输出" });
  const provider: StructuredOutputProvider = {
    modelId: "deepseek-v4-flash",
    providerConfig: { model: "deepseek-v4-flash" },
    providerConfigHash: `0x${"04".repeat(32)}`,
    generateStructured: async <T>(request: StructuredOutputRequest) => {
      calls += 1;
      await request.recordAttempt?.({ attempt: 1, result: "valid", rawOutput: raw, rawOutputHash: hashText(raw) });
      return JSON.parse(raw) as T;
    },
  };
  const journal = await FileGenerationJournal.open(path.join(directory, "attempts.jsonl"));
  const predictor = new DeepSeekReplayPredictor(new ResumableStructuredGenerator(provider, journal));

  const main = await predictor.predict(baseInput);
  const actual = await predictor.predictAblation("actual", {
    roundIndex: 0,
    divinerKey: "takashima",
    proposition: baseInput.proposition,
    performance: baseInput.performance,
    hexagram: { lines: baseInput.hexagram.lines },
  });

  assert.deepEqual(actual, main);
  assert.equal(calls, 1);
});
