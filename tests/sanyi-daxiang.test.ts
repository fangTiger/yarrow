// tests/sanyi-daxiang.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { DAXIANG, getDaxiang } from "../src/agent/daxiang-corpus.js";

test("《大象传》64 条齐全，按文王卦序", () => {
  assert.equal(DAXIANG.length, 64);
  for (const text of DAXIANG) {
    assert.match(text, /以/u);
    assert.match(text, /。$/u);
  }
  assert.equal(getDaxiang(1), "天行健，君子以自强不息。");
  assert.equal(getDaxiang(2), "地势坤，君子以厚德载物。");
  assert.equal(getDaxiang(11), "天地交，泰；后以财成天地之道，辅相天地之宜，以左右民。");
  assert.equal(getDaxiang(58), "丽泽，兑；君子以朋友讲习。");
  assert.equal(getDaxiang(63), "水在火上，既济；君子以思患而豫防之。");
  assert.equal(getDaxiang(64), "火在水上，未济；君子以慎辨物居方。");
  assert.throws(() => getDaxiang(0));
  assert.throws(() => getDaxiang(65));
});

test("已转为简体，不残留常见繁体字", () => {
  assert.doesNotMatch(DAXIANG.join(""), /[強載經綸雲於與違師親諸萬國誥歷樂過澤說險習嚮蒞眾後]/u);
});
