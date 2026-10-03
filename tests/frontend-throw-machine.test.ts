// tests/frontend-throw-machine.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  initialThrowState,
  reduceThrow,
  type ThrowMachineState,
} from "../web/lib/throw-machine.js";
import type { RecordedThrow } from "../src/sanyi/throws.js";

const result: RecordedThrow = {
  index: 1,
  coins: [1, 0, 0] as const,
  backs: 1,
  value: 7,
  name: "单" as const,
  moving: false,
  blockNumber: "8",
  blockHash: `0x${"ab".repeat(32)}` as `0x${string}`,
  blockTimestamp: "1790770501",
};

test("按住、松开、落钱与记录依次推进", () => {
  let state: ThrowMachineState = initialThrowState([]);
  state = reduceThrow(state, { type: "press" });
  assert.equal(state.phase, "shaking");
  state = reduceThrow(state, { type: "release" });
  assert.equal(state.phase, "landing");
  state = reduceThrow(state, { type: "resolved", result });
  assert.equal(state.phase, "recorded");
  assert.equal(state.throws.length, 1);
  state = reduceThrow(state, { type: "ready" });
  assert.equal(state.phase, "idle");
  assert.equal(state.nextIndex, 2);
});

test("第六掷后完成，完成态不能再摇", () => {
  const previous = Array.from({ length: 5 }, (_, index) => ({
    ...result,
    index: index + 1,
  }));
  let state = reduceThrow(initialThrowState(previous), { type: "press" });
  state = reduceThrow(state, { type: "release" });
  state = reduceThrow(state, { type: "resolved", result: { ...result, index: 6 } });
  assert.equal(state.phase, "complete");
  assert.equal(reduceThrow(state, { type: "press" }), state);
});

test("Arc 不可用时暂停并从原掷序恢复", () => {
  let state = reduceThrow(initialThrowState([result]), { type: "press" });
  state = reduceThrow(state, { type: "release" });
  state = reduceThrow(state, { type: "pause", message: "未能取得天时" });
  assert.equal(state.phase, "paused");
  assert.equal(state.nextIndex, 2);
  state = reduceThrow(state, { type: "resume" });
  assert.equal(state.phase, "idle");
  assert.equal(state.throws.length, 1);
});

test("过期响应与非法转换不改状态", () => {
  const state = initialThrowState([]);
  assert.equal(reduceThrow(state, { type: "release" }), state);
  const landing = reduceThrow(reduceThrow(state, { type: "press" }), { type: "release" });
  assert.equal(reduceThrow(landing, { type: "resolved", result: { ...result, index: 2 } }), landing);
});
