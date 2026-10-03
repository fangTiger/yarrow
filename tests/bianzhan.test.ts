// tests/bianzhan.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { selectPrimaryOracleText } from "../src/calendar/bianzhan.js";

const cases: ReadonlyArray<{
  lines: readonly number[];
  kind: string;
  primary: string;
  secondary: readonly string[];
}> = [
  { lines: [7, 7, 7, 8, 8, 8], kind: "本卦卦辞", primary: "卦辞", secondary: [] },
  { lines: [9, 7, 7, 8, 8, 8], kind: "本卦爻辞", primary: "初九", secondary: [] },
  { lines: [7, 9, 7, 8, 9, 8], kind: "本卦两爻辞", primary: "九五", secondary: ["九二"] },
  {
    lines: [9, 9, 9, 8, 8, 8],
    kind: "本卦与之卦卦辞",
    primary: "卦辞",
    secondary: ["之卦卦辞"],
  },
  { lines: [9, 9, 9, 8, 8, 9], kind: "之卦两不动爻辞", primary: "六四", secondary: ["六五"] },
  { lines: [9, 9, 9, 7, 9, 9], kind: "之卦不动爻辞", primary: "九四", secondary: [] },
];
for (const item of cases) {
  test(`${item.lines.filter((value) => value === 6 || value === 9).length} 个动爻`, () => {
    const result = selectPrimaryOracleText(item.lines);
    assert.equal(result.rule, item.kind);
    assert.equal(result.primary.label, item.primary);
    assert.ok(result.primary.text.length > 0);
    assert.deepEqual(result.secondary.map((value) => value.label), item.secondary);
    result.secondary.forEach((value) => assert.ok(value.text.length > 0));
  });
}
test("乾六爻皆动用九，坤六爻皆动用六，其余用之卦卦辞", () => {
  assert.equal(selectPrimaryOracleText([9, 9, 9, 9, 9, 9]).primary.label, "用九");
  assert.equal(selectPrimaryOracleText([6, 6, 6, 6, 6, 6]).primary.label, "用六");
  assert.equal(selectPrimaryOracleText([9, 6, 9, 6, 9, 6]).primary.label, "之卦卦辞");
});
