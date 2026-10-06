// tests/solar-time.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  DST_RANGES,
  civilFromMillis,
  civilMillis,
  correctBirthTime,
  daylightSavingAt,
  equationOfTimeMinutes,
  type CivilTime,
} from "../src/calendar/solar-time.js";

const ranges = [
  [1986, 5, 4, 9, 14],
  [1987, 4, 12, 9, 13],
  [1988, 4, 17, 9, 11],
  [1989, 4, 16, 9, 17],
  [1990, 4, 15, 9, 16],
  [1991, 4, 14, 9, 15],
] as const;

function at(year: number, month: number, day: number, hour: number, minute = 0): CivilTime {
  return { year, month, day, hour, minute, second: 0 };
}

test("六年显式表及钟表边界，重复时段选夏令时", () => {
  assert.equal(DST_RANGES.length, 6);
  for (const [year, sm, sd, em, ed] of ranges) {
    const start = at(year, sm, sd, 2);
    const end = at(year, em, ed, 2);
    const before = civilFromMillis(civilMillis(start) - 60_000);
    assert.equal(daylightSavingAt(before).active, false);
    assert.equal(daylightSavingAt(start).active, true);
    assert.equal(daylightSavingAt(at(year, em, ed, 0, 59)).repeated, false);
    for (const minute of [0, 30, 59]) {
      const result = daylightSavingAt(at(year, em, ed, 1, minute));
      assert.equal(result.active, true);
      assert.equal(result.repeated, true);
    }
    assert.equal(daylightSavingAt(end).active, false);
    assert.equal(daylightSavingAt(at(year, em, ed, 2, 1)).active, false);
    const corrected = correctBirthTime(at(year, em, ed, 1, 30), true, null);
    assert.equal(corrected.effective.hour, 0);
    assert.match(corrected.steps[0]?.description ?? "", /重复时段，按夏令时计/);
  }
  assert.equal(daylightSavingAt(at(1985, 7, 1, 12)).active, false);
  assert.equal(daylightSavingAt(at(1992, 7, 1, 12)).active, false);
});

test("Intl Asia/Shanghai 在真实 UTC 转换瞬间与六年表逐年互校", () => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  function offsetMinutes(instant: number): number {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
    const local = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    return (local - instant) / 60_000;
  }
  for (const [year, sm, sd, em, ed] of ranges) {
    const row = DST_RANGES.find((item) => item.year === year);
    assert.ok(row);
    assert.deepEqual(row.start, at(year, sm, sd, 2));
    assert.deepEqual(row.end, at(year, em, ed, 2));
    const startUtc = civilMillis(row.start) - 8 * 3_600_000;
    const endUtc = civilMillis(row.end) - 9 * 3_600_000;
    assert.equal(offsetMinutes(startUtc - 60_000), 480);
    assert.equal(offsetMinutes(startUtc), 540);
    assert.equal(offsetMinutes(endUtc - 60_000), 540);
    assert.equal(offsetMinutes(endUtc), 480);
    for (let instant = startUtc + 86_400_000; instant < endUtc; instant += 86_400_000) {
      assert.equal(offsetMinutes(instant), 540);
    }
  }
});

test("真太阳时规格：87.6 度使巳时变辰时", () => {
  const original = at(2000, 11, 3, 9, 10);
  const result = correctBirthTime(original, true, 87.6);
  const minutes = result.effective.hour * 60 + result.effective.minute;
  assert.ok(minutes >= 7 * 60 + 14 && minutes <= 7 * 60 + 20);
  assert.equal(Math.floor((result.effective.hour + 1) / 2) % 12, 4);
  assert.ok(Math.abs(result.longitudeMinutes + 129.6) < 1e-9);
  assert.ok(result.equationMinutes >= 15 && result.equationMinutes <= 17);
  assert.equal(result.steps[0]?.kind, "dst");
  assert.equal(result.steps[1]?.kind, "solar");
});

test("先夏令时再太阳时、跨日期运算、未填经度与缺时辰", () => {
  const original = at(1990, 5, 15, 15, 30);
  const result = correctBirthTime(original, true, 87.6);
  const standard = at(1990, 5, 15, 14, 30);
  assert.deepEqual(result.steps[0]?.after, standard);
  assert.deepEqual(result.steps[1]?.before, standard);
  const eot = equationOfTimeMinutes(standard);
  const expected = civilFromMillis(civilMillis(standard) + Math.round((-129.6 + eot) * 60_000));
  assert.deepEqual(result.effective, expected);
  assert.deepEqual(correctBirthTime(original, true, null).effective, standard);
  const crossed = correctBirthTime(at(2000, 11, 3, 0, 10), true, 73);
  assert.equal(crossed.effective.day, 2);
  const missing = correctBirthTime(at(1990, 5, 15, 12), false, 87.6);
  assert.equal(missing.timeKnown, false);
  assert.ok(missing.steps.every((step) => !step.applied && step.before === null && step.after === null));
  assert.equal(missing.effective.hour, 12);
  assert.throws(() => correctBirthTime(original, true, 136), /经度/);
});

 test("港澳台不套大陆夏令时，未填地点提示补填", () => {
  const civil = at(1988, 7, 1, 8, 30);
  const hk = correctBirthTime(civil, true, null, { mainlandDst: false, birthplace: "香港" });
  assert.equal(hk.effective.hour, 8);
  assert.equal(hk.steps[0]?.applied, false);
  assert.match(hk.steps[0]?.description ?? "", /出生地为香港，未按中国大陆夏令时校正/);
  assert.match(hk.steps[0]?.description ?? "", /当地历史夏令时请按出生记录自行核对/);
  const bj = correctBirthTime(civil, true, null, { mainlandDst: true, birthplace: "北京" });
  assert.equal(bj.effective.hour, 7);
  assert.equal(bj.steps[0]?.applied, true);
  const empty = correctBirthTime(civil, true, null);
  assert.equal(empty.effective.hour, 7);
  // 不收出生地后，不再提示用户去填写出生地；只说明按大陆夏令时校正、未作真太阳时校正。
  assert.doesNotMatch(empty.steps[0]?.description ?? "", /填写出生地/);
  assert.match(empty.steps[0]?.description ?? "", /按中国大陆夏令时/);
  assert.equal(empty.steps[1]?.description, "未作真太阳时校正");
});
