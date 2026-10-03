// tests/meihua.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { deriveMeihua } from "../src/calendar/meihua.js";

const SAMPLE = BigInt(Date.UTC(2026, 8, 30, 12, 15) / 1_000);
test("地天泰初爻独动：乾用坤体、体生用、变卦地风升且变卦克体", () => {
  const result = deriveMeihua([9, 7, 7, 8, 8, 8], SAMPLE);
  assert.deepEqual(result.body, { position: "upper", name: "坤", element: "土", strength: "休" });
  assert.deepEqual(result.use, { position: "lower", name: "乾", element: "金" });
  assert.equal(result.bodyUseRelation, "体生用");
  assert.equal(result.mutual.name, "雷泽归妹");
  assert.deepEqual(result.changed, {
    name: "地风升",
    changedUse: { name: "巽", element: "木" },
    relationToBody: "变卦克体",
  });
});
test("无动爻取下卦为用", () => {
  assert.equal(deriveMeihua([7, 7, 7, 8, 8, 8], SAMPLE).use.position, "lower");
});
test("上下都有动爻时多者为用，相同取下卦", () => {
  assert.equal(deriveMeihua([9, 9, 7, 6, 8, 8], SAMPLE).use.position, "lower");
  assert.equal(deriveMeihua([9, 7, 7, 6, 6, 8], SAMPLE).use.position, "upper");
  assert.equal(deriveMeihua([9, 7, 7, 6, 8, 8], SAMPLE).use.position, "lower");
});
