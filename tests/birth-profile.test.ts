// tests/birth-profile.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import lunarPkg from "lunar-javascript";
import { correctBirthTime } from "../src/calendar/solar-time.js";
import { readCities } from "../src/calendar/cities.js";
import { normalizeBirthProfile } from "../src/sanyi/birth-profile.js";

const base = {
  calendar: "solar", year: 1990, month: 5, day: 15,
  time: { hour: 15, minute: 30 }, gender: "male", isLeapMonth: false,
};

test("城市表 34 条、34 省级行政区、名称唯一且坐标合法", () => {
  const cities = readCities();
  assert.equal(cities.length, 34);
  assert.equal(new Set(cities.map((city) => city.name)).size, 34);
  assert.equal(new Set(cities.map((city) => city.province)).size, 34);
  for (const city of cities) {
    assert.ok(city.longitude >= 73 && city.longitude <= 135);
    assert.ok(city.latitude >= 0 && city.latitude <= 54);
    assert.ok(Math.abs(city.longitude * 100 - Math.round(city.longitude * 100)) < 1e-8);
  }
  for (const province of ["香港", "澳门", "台湾", "新疆", "西藏"]) {
    assert.ok(cities.some((city) => city.province === province));
  }
});

test("公历、缺时辰、性别与城市经度", () => {
  const birth = normalizeBirthProfile(base);
  assert.equal(birth.civil.hour, 15);
  assert.equal(birth.timeKnown, true);
  assert.equal(birth.longitude, null);
  const missing = normalizeBirthProfile({ ...base, time: null, gender: "female" });
  assert.equal(missing.timeKnown, false);
  assert.equal(missing.gender, "female");
  assert.equal(missing.civil.hour, 12);
  const city = readCities()[0];
  assert.ok(city);
  assert.equal(normalizeBirthProfile({ ...base, city: city.name }).longitude, city.longitude);
  assert.equal(normalizeBirthProfile({ ...base, longitude: 87.6 }).longitude, 87.6);
});

test("非法日期、时间、性别、经度与重复地点输入抛中文错误", () => {
  for (const patch of [
    { month: 2, day: 30 }, { year: 1899 }, { time: { hour: 24, minute: 0 } },
    { time: { hour: 15, minute: 60 } }, { gender: "unknown" }, { longitude: 136 },
    { longitude: Number.NaN }, { city: "不存在的城市" }, { calendar: "other" },
    { city: "北京", longitude: 120 }, { isLeapMonth: true }, { time: undefined },
  ]) {
    assert.throws(() => normalizeBirthProfile({ ...base, ...patch }), /[\u4e00-\u9fff]/);
  }
  assert.throws(() => normalizeBirthProfile(null), /生辰/);
});

test("农历有效闰月转换与不存在的闰月拒绝", () => {
  let year = 2000;
  while (year <= 2098 && lunarPkg.LunarYear.fromYear(year).getLeapMonth() === 0) {
    year += 1;
  }
  const leap = lunarPkg.LunarYear.fromYear(year).getLeapMonth();
  assert.ok(leap > 0);
  const converted = normalizeBirthProfile({
    ...base, calendar: "lunar", year, month: leap, day: 1, isLeapMonth: true,
  });
  const expected = lunarPkg.Lunar.fromYmd(year, -leap, 1).getSolar();
  assert.deepEqual(
    [converted.civil.year, converted.civil.month, converted.civil.day],
    [expected.getYear(), expected.getMonth(), expected.getDay()],
  );
  const wrong = leap === 1 ? 2 : 1;
  assert.throws(() => normalizeBirthProfile({
    ...base, calendar: "lunar", year, month: wrong, day: 1, isLeapMonth: true,
  }), /闰月不存在/);
  const month = lunarPkg.LunarMonth.fromYm(year, -leap);
  assert.ok(month);
  assert.throws(() => normalizeBirthProfile({
    ...base, calendar: "lunar", year, month: leap,
    day: month.getDayCount() + 1, isLeapMonth: true,
  }), /农历日期/);
});

test("城市决定大陆夏令时选项并贯通校正调用", () => {
  for (const city of ["香港", "澳门", "台北", "北京", undefined]) {
    const birth = normalizeBirthProfile({ ...base, year: 1988, month: 7, day: 1,
      time: { hour: 8, minute: 30 }, ...(city === undefined ? {} : { city }) });
    assert.equal(birth.mainlandDst, city === "北京" || city === undefined);
    const corrected = correctBirthTime(birth.civil, birth.timeKnown, birth.longitude,
      { mainlandDst: birth.mainlandDst, birthplace: birth.birthplace });
    assert.equal(corrected.steps[0]?.deltaMinutes, birth.mainlandDst ? -60 : 0);
    if (!birth.mainlandDst) assert.match(corrected.steps[0]?.description ?? "", new RegExp(`出生地为${city}`));
  }
  assert.equal(normalizeBirthProfile({ ...base, longitude: 120 }).mainlandDst, true);
});
