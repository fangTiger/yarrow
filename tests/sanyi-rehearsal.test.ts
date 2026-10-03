// tests/sanyi-rehearsal.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { runRehearsal } from "../scripts/rehearse-demo.js";
test("mock 排练完成六掷与三家落笔", async () => {
  const summary = await runRehearsal();
  assert.equal(summary.status, "done");
  assert.equal(summary.lines.length, 6);
  assert.deepEqual(summary.schools.map((item) => item.status), ["done", "done", "done"]);
  assert.equal(summary.schools.map((item) => item.name).join("、"), "程颐、京房、邵雍");
  assert.equal(Number.isFinite(summary.consensusTenths), true);
});
