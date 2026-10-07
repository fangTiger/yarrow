// tests/frontend-birth-profile.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_BIRTH, LUNAR_DAYS, LUNAR_MONTHS, birthProblem, birthSummary, fromBirthInput, loadBirthProfile,
  saveBirthProfile, solarDateValue, toBirthInput, withSolarDate, type BirthFormValues,
} from "../web/lib/birth-profile.js";
import { isMissingBirth, entryHorizon } from "../web/lib/birth-entry.js";
import { ApiError } from "../web/lib/api.js";

const filled: BirthFormValues = {
  ...EMPTY_BIRTH, year: "1990", month: "5", day: "15", time: "15:30", gender: "male",
};

test("空白生辰默认无效，逐项给出中文原因，不预填样例生日", () => {
  assert.deepEqual(
    [EMPTY_BIRTH.year, EMPTY_BIRTH.month, EMPTY_BIRTH.day, EMPTY_BIRTH.time, EMPTY_BIRTH.gender],
    ["", "", "", "", ""],
  );
  assert.match(birthProblem(EMPTY_BIRTH) ?? "", /出生日期/);
  // 出生时间选填：空着即时辰不详，按三柱排盘。
  assert.equal(birthProblem({ ...filled, time: "" }), null);
  assert.equal(toBirthInput({ ...filled, time: "" }).time, null);
  assert.match(birthProblem({ ...filled, time: "25" }) ?? "", /出生时间/);
  assert.match(birthProblem({ ...filled, gender: "" }) ?? "", /性别/);
  assert.equal(birthProblem(filled), null);
});

test("只收生辰八字：转换结果不含城市与经度，旧档案读出时丢弃这两项", () => {
  const birth = toBirthInput(filled);
  assert.equal("city" in birth, false);
  assert.equal("longitude" in birth, false);
  assert.deepEqual(toBirthInput(fromBirthInput(birth)), birth);
  let saved = JSON.stringify({ ...birth, city: "北京" });
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  const loaded = loadBirthProfile(storage);
  assert.ok(loaded);
  assert.equal("city" in loaded, false);
  assert.equal("longitude" in loaded, false);
});

test("非法日期与不存在闰月就地拒绝，合法闰月与未填时间可用", () => {
  assert.match(birthProblem({ ...filled, month: "2", day: "30" }) ?? "", /日期/);
  assert.match(birthProblem({
    ...filled, calendar: "lunar", year: "2023", month: "3", day: "1", isLeapMonth: true,
  }) ?? "", /闰月不存在/);
  const leap = toBirthInput({
    ...filled, calendar: "lunar", year: "2023", month: "2", day: "1", isLeapMonth: true, time: "",
  });
  assert.equal(leap.time, null);
  assert.deepEqual(toBirthInput(fromBirthInput(leap)), leap);
});

test("公历日期框与年月日互转；农历月日用中文名", () => {
  assert.equal(solarDateValue(filled), "1990-05-15");
  assert.equal(solarDateValue(EMPTY_BIRTH), "");
  const next = withSolarDate(EMPTY_BIRTH, "2000-11-03");
  assert.deepEqual([next.year, next.month, next.day], ["2000", "11", "3"]);
  assert.deepEqual([withSolarDate(filled, "").year, withSolarDate(filled, "").day], ["", ""]);
  assert.equal(LUNAR_MONTHS.length, 12);
  assert.equal(LUNAR_MONTHS[0], "正月");
  assert.equal(LUNAR_MONTHS[11], "腊月");
  assert.equal(LUNAR_DAYS.length, 30);
  assert.equal(LUNAR_DAYS[0], "初一");
  assert.equal(LUNAR_DAYS[29], "三十");
});

test("摘要只含历法、日期、时辰与性别", () => {
  assert.equal(birthSummary(toBirthInput(filled)), "公历 1990-05-15 15:30 · 男");
  assert.equal(birthSummary(toBirthInput({ ...filled, time: "", gender: "female" })),
    "公历 1990-05-15 未填时间 · 女");
});

test("存储读写抛错仍返回本次生辰；合法生辰自动保存并可读回", () => {
  const birth = toBirthInput(filled);
  const broken = {
    getItem: () => { throw new Error("不可用"); },
    setItem: () => { throw new Error("不可用"); },
  };
  assert.equal(loadBirthProfile(broken), null);
  assert.deepEqual(saveBirthProfile(birth, broken), birth);
  let saved = "";
  const storage = { getItem: () => saved || null, setItem: (_key: string, value: string) => { saved = value; } };
  saveBirthProfile(birth, storage);
  assert.deepEqual(loadBirthProfile(storage), birth);
  const other = toBirthInput({ ...filled, time: "", gender: "female" });
  saveBirthProfile(other, storage);
  assert.deepEqual(loadBirthProfile(storage), other);
});

test("400 请先填写生辰可识别；自动识别的明年与指定年份保留", () => {
  assert.equal(isMissingBirth(new ApiError("请先填写生辰", 400)), true);
  assert.equal(isMissingBirth(new ApiError("请先填写生辰", 503)), false);
  assert.equal(entryHorizon("next-year"), "next-year");
  assert.equal(entryHorizon("year:2027"), "year:2027");
  assert.equal(entryHorizon(undefined), "year");
});
