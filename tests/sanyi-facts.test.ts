// tests/sanyi-facts.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { facts } from "./helpers/sample-question.js";

test("事实表覆盖盘面编号并锁定已核验爻位", () => {
  assert.deepEqual(
    [...facts.keys()].slice(0, 3),
    ["line:1", "line:2", "line:3"],
  );
  assert.equal(facts.get("line:1")?.tokens.has("甲子"), true);
  assert.equal(facts.get("line:1")?.tokens.has("妻财"), true);
  assert.equal(facts.get("line:1")?.tokens.has("辛丑"), true);
  assert.equal(facts.get("line:1")?.tokens.has("回头克"), true);
  assert.equal(facts.get("line:2")?.tokens.has("旬空"), true);
  assert.equal(facts.get("line:2")?.tokens.has("伏"), true);
  for (const id of [
    "month",
    "day",
    "use-god",
    "body-use",
    "hexagram:primary",
    "hexagram:derived",
    "hexagram:mutual",
    "hexagram:opposite",
    "hexagram:reversed",
    "main-text",
  ]) {
    assert.equal(facts.has(id), true, `缺少事实：${id}`);
  }
});
