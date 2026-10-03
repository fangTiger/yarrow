// tests/qimen.test.ts
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("kinqimen 标准答案不少于 40 个且字段完整", async () => {
  const files = (await readdir("tests/fixtures/qimen")).filter((name) => name.endsWith(".json"));
  assert.ok(files.length >= 40);
  for (const file of files) {
    const fixture = JSON.parse(
      await readFile(`tests/fixtures/qimen/${file}`, "utf8"),
    ) as Record<string, unknown>;
    assert.deepEqual(Object.keys(fixture), [
      "localTime", "method", "dayPillar", "hourPillar", "solarTerm", "layout", "xunHead",
      "chiefStem", "chiefStar", "chiefStarPalace", "chiefDoor",
      "chiefDoorPalace", "dayVoid", "hourVoid", "horse", "palaces",
    ]);
  }
});

// tests/qimen.test.ts（保留 Task 3 测试，再加入）
import { qimenAt } from "../src/calendar/qimen.js";

test("TS 实现与全部 kinqimen fixtures 逐字段一致", async () => {
  const files = (await readdir("tests/fixtures/qimen"))
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const file of files) {
    const expected = JSON.parse(await readFile(`tests/fixtures/qimen/${file}`, "utf8"));
    const timestamp = BigInt(Date.parse(`${expected.localTime.replace(" ", "T")}+08:00`) / 1_000);
    assert.deepEqual(qimenAt(timestamp), expected, file);
  }
});

test("2026-09-30 20:15 人工核验字段不受 fixture 生成器错误遮蔽", () => {
  const result = qimenAt(BigInt(Date.UTC(2026, 8, 30, 12, 15) / 1_000));
  assert.equal(result.dayPillar, "丁未");
  assert.equal(result.hourPillar, "庚戌");
  assert.equal(result.layout, "阴遁四局下元");
  assert.equal(result.chiefStem, "壬");
  assert.equal(result.chiefStar, "天英");
  assert.equal(result.chiefStarPalace, "坤二");
  assert.equal(result.chiefDoor, "景门");
  assert.equal(result.chiefDoorPalace, "震三");
  assert.deepEqual([result.dayVoid, result.hourVoid, result.horse], ["寅卯", "寅卯", "申"]);
  assert.deepEqual(result.palaces["巽四"], {
    heavenStem: "己",
    earthStem: "戊",
    star: "天冲",
    door: "死门",
    god: "太阴",
  });
  assert.equal(result.palaces["兑七"].god, "九天");
});

test("奇门在 23 点按子时换日", () => {
  const result = qimenAt(BigInt(Date.UTC(2026, 6, 23, 15, 0) / 1_000));
  assert.equal(result.dayPillar, "己亥");
  assert.equal(result.layout, "阴遁一局中元");
});
