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

test("mock 排练追加十年运势与免费换日，只有两笔付款", async () => {
  const summary = await runRehearsal();
  assert.deepEqual(summary.bazi.pillars, ["庚午", "辛巳", "庚辰", "癸未"]);
  assert.deepEqual(summary.bazi.window, [2023, 2032]);
  assert.deepEqual(summary.bazi.schools, ["done", "done", "done"]);
  assert.equal(summary.bazi.years, 10);
  assert.equal(summary.bazi.sectAfterSwitch, 2);
  assert.equal(summary.bazi.changes, 1);
  assert.equal(summary.payments, 2);
});
