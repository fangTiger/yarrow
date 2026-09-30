import assert from "node:assert/strict";
import test from "node:test";

import type { Address, Hex, PublicClient } from "viem";

import { ArcReplaySource } from "../src/replay/arc-source.js";
import { DeterministicReplayMock } from "../src/replay/mock-provider.js";
import type { ReplayPredictionInput } from "../src/replay/engine.js";

test("Arc 数据源为区块与 totalSupply 使用同一个显式历史 block tag 并缓存重复读取", async () => {
  const blockReads: bigint[] = [];
  const stateReads: bigint[] = [];
  const client = {
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => {
      blockReads.push(blockNumber);
      return { number: blockNumber, hash: `0x${blockNumber.toString(16).padStart(64, "0")}` as Hex, timestamp: 1_000n + blockNumber };
    },
    readContract: async ({ blockNumber }: { blockNumber: bigint }) => {
      stateReads.push(blockNumber);
      return 10_000n + blockNumber;
    },
  } as unknown as PublicClient;
  const source = new ArcReplaySource(client, `0x${"36".repeat(20)}` as Address);

  const snapshot = await source.readCutoffSnapshot(100n, 2);
  await source.readResolution(100n);

  assert.deepEqual(snapshot.history.map((item) => item.blockNumber), [98n, 99n]);
  assert.equal(snapshot.cutoff.totalSupply, 10_100n);
  assert.deepEqual(blockReads.sort((left, right) => left < right ? -1 : left > right ? 1 : 0), [98n, 99n, 100n]);
  assert.deepEqual(stateReads.sort((left, right) => left < right ? -1 : left > right ? 1 : 0), [98n, 99n, 100n]);
});

test("Arc 历史只读请求遇到瞬时限流时按上限重试，成功值仍绑定原 block tag", async () => {
  let blockAttempts = 0;
  let supplyAttempts = 0;
  const client = {
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => {
      blockAttempts += 1;
      if (blockAttempts === 1) throw new Error("rate limit exceeded");
      return { number: blockNumber, hash: `0x${blockNumber.toString(16).padStart(64, "0")}` as Hex, timestamp: 1_000n };
    },
    readContract: async ({ blockNumber }: { blockNumber: bigint }) => {
      supplyAttempts += 1;
      if (supplyAttempts === 1) throw new Error("Request exceeds defined limit");
      assert.equal(blockNumber, 100n);
      return 123n;
    },
  } as unknown as PublicClient;
  const source = new ArcReplaySource(client, `0x${"36".repeat(20)}` as Address, {
    maxAttempts: 3,
    retryDelayMilliseconds: 0,
  });

  const block = await source.readResolution(100n);

  assert.equal(block.totalSupply, 123n);
  assert.equal(blockAttempts, 2);
  assert.equal(supplyAttempts, 2);
});

test("Arc 批量历史读取限制公共 RPC 并发请求数", async () => {
  let activeRequests = 0;
  let peakRequests = 0;
  const trackRequest = async <T>(value: T): Promise<T> => {
    activeRequests += 1;
    peakRequests = Math.max(peakRequests, activeRequests);
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeRequests -= 1;
    return value;
  };
  const client = {
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => trackRequest({
      number: blockNumber,
      hash: `0x${blockNumber.toString(16).padStart(64, "0")}` as Hex,
      timestamp: 1_000n + blockNumber,
    }),
    readContract: async ({ blockNumber }: { blockNumber: bigint }) => trackRequest(10_000n + blockNumber),
  } as unknown as PublicClient;
  const source = new ArcReplaySource(client, `0x${"36".repeat(20)}` as Address, {
    maxConcurrentRequests: 3,
  });

  await source.readCalibrationHistory(1_000n, 6n, 8, 8n);

  assert.equal(peakRequests <= 3, true, `公共 RPC 峰值并发为 ${peakRequests}`);
});

test("难度校准配对的最晚结算块严格早于本轮截止块且跨度固定", async () => {
  const client = {
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({
      number: blockNumber,
      hash: `0x${blockNumber.toString(16).padStart(64, "0")}` as Hex,
      timestamp: 1_000n + blockNumber,
    }),
    readContract: async ({ blockNumber }: { blockNumber: bigint }) => 10_000n + blockNumber,
  } as unknown as PublicClient;
  const source = new ArcReplaySource(client, `0x${"36".repeat(20)}` as Address);

  const history = await source.readCalibrationHistory(1_000n, 6n, 4, 8n);

  assert.deepEqual(history.map((pair) => [pair.startBlock, pair.endBlock]), [
    [969n, 975n],
    [977n, 983n],
    [985n, 991n],
    [993n, 999n],
  ]);
  assert.equal(history.every((pair) => pair.endBlock < 1_000n), true);
});

test("确定性 replay mock 对相同截止输入稳定，且不接收下注参数", async () => {
  const predictor = new DeterministicReplayMock();
  const proposition = Object.freeze({
    predicateId: `0x${"12".repeat(32)}` as Hex,
    statement: "标准问题",
    cutoffBlock: 100n,
    resolutionBlock: 110n,
    threshold: 10_000n,
    calibration: { suitable: true as const, threshold: 10_000n, thresholdDelta: 0n, sampleCount: 8, yesCount: 4, empiricalBaseRateBps: 5_000, historyStartBlock: 1n, historyEndBlock: 99n, horizonBlocks: 10n },
  });
  const input: ReplayPredictionInput = {
    roundIndex: 0,
    divinerKey: "takashima",
    cutoff: { blockNumber: 100n, blockHash: `0x${"34".repeat(32)}`, timestamp: 1_000n, totalSupply: 10_000n },
    history: [{ blockNumber: 99n, blockHash: `0x${"33".repeat(32)}`, timestamp: 999n, totalSupply: 9_999n }],
    hexagram: { lines: [7, 8, 7, 8, 7, 8], primaryKingWenNumber: 64, derivedKingWenNumber: 64, changingLinePositions: [] },
    proposition,
    performance: { sampleCount: 0, correctCount: 0, totalBrier: 0n, bankrollUsdc6: 1_000_000n },
  };

  const first = await predictor.predict(input);
  const second = await predictor.predict(input);

  assert.deepEqual(first, second);
  assert.equal(first.probabilityBps >= 100 && first.probabilityBps <= 9_900, true);
  assert.equal("multiplier" in first, false);
  assert.equal("stake" in first, false);
});
