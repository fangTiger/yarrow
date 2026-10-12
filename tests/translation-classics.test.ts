import assert from "node:assert/strict";
import test from "node:test";
import {
  findZhouyiEnglishReferences,
  getZhouyiEnglish,
  getZhouyiLineEnglish,
  ZHOUYI_ENGLISH,
} from "../src/agent/zhouyi-en.js";

test("离线古文译表完整对应 64 卦、384 爻与用九用六", () => {
  assert.equal(ZHOUYI_ENGLISH.length, 64);
  assert.equal(ZHOUYI_ENGLISH.flatMap((hexagram) => hexagram.lines).length, 384);
  assert.equal(ZHOUYI_ENGLISH.flatMap((hexagram) => hexagram.extras).length, 2);
  assert.equal(getZhouyiEnglish(1).lines[0], "A hidden dragon does not act.");
  assert.equal(getZhouyiEnglish(2).extras[0], "Favorable for eternal steadfastness.");
  assert.equal(getZhouyiLineEnglish(1, 1), "A hidden dragon does not act.");
  assert.throws(() => getZhouyiLineEnglish(1, 7), /未知爻位/);
});

test("重复古文按正文卦名消歧，不附带别卦译文", () => {
  const references = findZhouyiEnglishReferences("乾卦卦辞说元亨利贞。 ");
  assert.deepEqual(references.map((item) => item.kingWen), [1]);
});

test("按正文查询爻辞与大象固定译文且不误带别卦", () => {
  const text = "乾卦初九潜龙勿用；天行健，君子以自强不息。";
  const references = findZhouyiEnglishReferences(text);
  assert.ok(references.some((item) => item.english === "A hidden dragon does not act."));
  assert.ok(references.some((item) => item.english.startsWith("The movement of heaven is vigorous")));
  assert.equal(references.some((item) => item.kingWen === 2), false);
});
