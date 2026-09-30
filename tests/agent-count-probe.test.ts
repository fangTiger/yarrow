import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateThresholdManipulation,
  findHighWatermark,
  sampleContinuity,
} from "../src/agent-count-probe.js";

test("链下二分以最后存在 id 加一恢复零基 agent 计数", async () => {
  const exists = async (id: bigint) => id < 13n;
  const result = await findHighWatermark(exists, 8n, 32n);
  assert.deepEqual(result, {
    highWatermark: 12n,
    firstMissing: 13n,
    count: 13n,
    ownerOfCalls: 7,
  });
});

test("二分边界不成立时明确拒绝而不是猜测", async () => {
  await assert.rejects(findHighWatermark(async (id) => id < 13n, 13n, 32n), /已知存在下界/);
  await assert.rejects(findHighWatermark(async () => true, 8n, 32n), /已知缺失上界/);
});

test("连续性抽样包含首尾且报告全部探测 id", async () => {
  const result = await sampleContinuity(async (id) => id !== 105n, 100n, 110n, 6);
  assert.deepEqual(result.sampledIds, [100n, 102n, 104n, 106n, 108n, 110n]);
  assert.deepEqual(result.missingIds, []);

  const full = await sampleContinuity(async (id) => id !== 105n, 100n, 110n, 11);
  assert.deepEqual(full.missingIds, [105n]);
});

test("操纵成本按跨过严格阈值所需注册数、gas 与当前速率计算", () => {
  assert.deepEqual(estimateThresholdManipulation({
    currentCount: 100n,
    threshold: 104n,
    registerGas: 200_000n,
    gasPriceWei: 20_000_000_000n,
    observedRegistrations: 50n,
    observedSeconds: 100,
  }), {
    requiredRegistrations: 5n,
    gas: 1_000_000n,
    costWei: 20_000_000_000_000_000n,
    projectedSecondsAtObservedRate: 10,
  });
});
