// tests/qiongtong.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readQiongtong, lookupQiongtong, validateQiongtong } from "../src/calendar/qiongtong.js";
const sourceUrl = new URL("../tools/bazi/reference/qiongtong-wikisource.txt", import.meta.url);
const source = readFileSync(sourceUrl, "utf8");
test("120 条无缺无重，原文逐字出自对应日干季节章节", () => {
  const rows = readQiongtong();
  assert.equal(rows.length, 120);
  assert.equal(new Set(rows.map((r) => r.dayStem + r.monthBranch)).size, 120);
  for (const stem of "甲乙丙丁戊己庚辛壬癸") {
    for (const branch of "寅卯辰巳午未申酉戌亥子丑") {
      assert.ok(lookupQiongtong(stem, branch));
    }
  }
  for (const row of rows) {
    const start = source.indexOf(`=== ${row.section} ===`);
    assert.ok(start >= 0);
    const end = source.indexOf("===", start + `=== ${row.section} ===`.length);
    const section = source.slice(start + `=== ${row.section} ===`.length, end < 0 ? undefined : end);
    assert.ok(section.includes(row.quote), `${row.dayStem}${row.monthBranch} 摘句不在章节内`);
    assert.equal(row.section.charAt(2), row.dayStem);
    const seasons = { 春: "寅卯辰", 夏: "巳午未", 秋: "申酉戌", 冬: "亥子丑" };
    assert.ok(seasons[row.section.charAt(1) as keyof typeof seasons]?.includes(row.monthBranch));
    assert.ok(row.useStems.length > 0);
    assert.equal(new Set(row.useStems).size, row.useStems.length);
    assert.ok(row.useStems.every((s) => s.length === 1 && "甲乙丙丁戊己庚辛壬癸".includes(s)));
    assert.ok(row.useStems.every((s) => row.quote.includes(s)));
  }
});
test("已核验庚巳与甲寅抽样及非法条目拒绝", () => {
  const geng = lookupQiongtong("庚", "巳");
  assert.deepEqual(geng.useStems, ["壬", "戊", "丙"]);
  assert.equal(geng.section, "三夏庚金");
  assert.ok(geng.quote.includes("但先壬水") && geng.quote.includes("次取戊土，丙火佐之"));
  const jia = lookupQiongtong("甲", "寅");
  assert.ok(jia.useStems.includes("丙") && jia.useStems.includes("癸"));
  assert.ok(jia.quote.includes("得丙癸逢"));
  assert.throws(() => lookupQiongtong("甲", "错"), /调候/);
  assert.throws(() => validateQiongtong([]), /120/);
  assert.throws(() => validateQiongtong([...readQiongtong().slice(1), readQiongtong()[1]]), /重复/);
  assert.throws(() => validateQiongtong(readQiongtong().map((r, i) => i ? r : { ...r,
    useStems: ["错"] })), /调候/);
});
test("酌用参酌不收，并用照收", () => {
  assert.deepEqual(lookupQiongtong("乙", "巳").useStems, ["癸", "庚", "辛"]);
  assert.deepEqual(lookupQiongtong("戊", "午").useStems, ["壬", "甲"]);
  assert.deepEqual(lookupQiongtong("癸", "午").useStems, ["庚", "辛", "壬"]);
});
