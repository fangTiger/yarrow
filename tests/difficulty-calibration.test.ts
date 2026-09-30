import assert from "node:assert/strict";
import test from "node:test";

import {
  calibrateThreshold,
  type HistoricalValuePair,
} from "../src/difficulty-calibration.js";

function pairs(deltas: readonly bigint[], cutoffBlock = 1_000n): HistoricalValuePair[] {
  return deltas.map((delta, index) => {
    const startBlock = 100n + BigInt(index * 10);
    return {
      startBlock,
      endBlock: startBlock + 6n,
      startValue: 1_000n,
      endValue: 1_000n + delta,
    };
  }).filter((pair) => pair.endBlock < cutoffBlock);
}

test("用截止块之前的同跨度历史增量反解最接近 50% 的严格阈值", () => {
  const result = calibrateThreshold({
    cutoffBlock: 1_000n,
    currentValue: 10_000n,
    horizonBlocks: 6n,
    history: pairs([-8n, -5n, -3n, -1n, 2n, 4n, 7n, 9n]),
    minimumBaseRateBps: 3_500,
    maximumBaseRateBps: 6_500,
  });

  assert.equal(result.suitable, true);
  if (!result.suitable) return;
  assert.equal(result.thresholdDelta, -1n);
  assert.equal(result.threshold, 9_999n);
  assert.equal(result.yesCount, 4);
  assert.equal(result.empiricalBaseRateBps, 5_000);
  assert.equal(result.sampleCount, 8);
  assert.equal(result.historyEndBlock < 1_000n, true);
});

test("大量同值使任何严格阈值都无法进入 35%–65% 时明确判为不适合测量", () => {
  const result = calibrateThreshold({
    cutoffBlock: 1_000n,
    currentValue: 10_000n,
    horizonBlocks: 6n,
    history: pairs([0n, 0n, 0n, 0n, 0n, 0n, 0n, 1n, 1n, 1n]),
    minimumBaseRateBps: 3_500,
    maximumBaseRateBps: 6_500,
  });

  assert.equal(result.suitable, false);
  if (result.suitable) return;
  assert.match(result.reason, /任何阈值.*35%–65%/);
  assert.equal(result.closestBaseRateBps, 3_000);
});

test("校准窗口一旦含本轮截止块或之后的信息就拒绝", () => {
  assert.throws(() => calibrateThreshold({
    cutoffBlock: 106n,
    currentValue: 10_000n,
    horizonBlocks: 6n,
    history: [{ startBlock: 100n, endBlock: 106n, startValue: 1_000n, endValue: 1_001n }],
    minimumBaseRateBps: 3_500,
    maximumBaseRateBps: 6_500,
  }), /前视偏差/);
});
