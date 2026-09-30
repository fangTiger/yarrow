import assert from "node:assert/strict";
import test from "node:test";

import { findMaxHistoryDistance } from "../src/history-window.js";

const hash = `0x${"12".repeat(32)}` as const;
const zeroHash = `0x${"00".repeat(32)}` as const;

test("边界有效时直接确认完整窗口", async () => {
  const calls: number[] = [];
  const result = await findMaxHistoryDistance(8191, async (distance) => {
    calls.push(distance);
    return hash;
  });

  assert.deepEqual(result, { maxCheckedDistance: 8191, maxValidDistance: 8191, firstInvalidDistance: null });
  assert.deepEqual(calls, [8191]);
});

test("边界无效时用二分找到最大的非零距离", async () => {
  let calls = 0;
  const result = await findMaxHistoryDistance(8191, async (distance) => {
    calls += 1;
    return distance <= 8000 ? hash : zeroHash;
  });

  assert.deepEqual(result, { maxCheckedDistance: 8191, maxValidDistance: 8000, firstInvalidDistance: 8001 });
  assert.ok(calls < 20, `二分调用次数过多：${calls}`);
});

test("距离一也无效时明确返回无有效历史", async () => {
  const result = await findMaxHistoryDistance(100, async () => zeroHash);
  assert.deepEqual(result, { maxCheckedDistance: 100, maxValidDistance: null, firstInvalidDistance: 1 });
});

