// tests/frontend-birth-profile.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_BIRTH, fromBirthInput, loadBirthProfile, toBirthInput, useBirthProfile } from "../web/lib/birth-profile.js";
import { needsBirth, isMissingBirth, entryHorizon } from "../web/lib/birth-entry.js";
import { ApiError } from "../web/lib/api.js";
test("表单与输入互转，非法日期与不存在闰月就地拒绝", () => {
    const birth = toBirthInput(EMPTY_BIRTH);
    assert.deepEqual(toBirthInput(fromBirthInput(birth)), birth);
    assert.throws(() => toBirthInput({ ...EMPTY_BIRTH, month: "2", day: "30" }), /日期/);
    assert.throws(() => toBirthInput({ ...EMPTY_BIRTH, calendar: "lunar", year: "2023", month: "3", isLeapMonth: true }), /闰月不存在/);
    const leap = toBirthInput({ ...EMPTY_BIRTH, calendar: "lunar", year: "2023", month: "2", day: "1", isLeapMonth: true, unknownTime: true });
    assert.equal(leap.time, null);
    assert.deepEqual(toBirthInput(fromBirthInput(leap)), leap);
});
test("存储读写抛错仍返回本次生辰；临时输入不改本人", () => {
    const birth = toBirthInput(EMPTY_BIRTH);
    const broken = { getItem: () => { throw new Error("不可用"); }, setItem: () => { throw new Error("不可用"); } };
    assert.equal(loadBirthProfile(broken), null);
    assert.deepEqual(useBirthProfile(birth, true, broken), birth);
    let saved = "";
    const storage = { getItem: () => saved || null, setItem: (_key: string, value: string) => { saved = value; } };
    useBirthProfile(birth, true, storage);
    assert.deepEqual(loadBirthProfile(storage), birth);
    const temporary = { ...birth, gender: "female" as const };
    assert.deepEqual(useBirthProfile(temporary, false, storage), temporary);
    assert.deepEqual(loadBirthProfile(storage), birth);
});
test("付款前命理运势缺档案走表单；400 补问同一路径", () => {
    assert.equal(needsBirth("destiny", null), true);
    assert.equal(needsBirth("fortune", null), true);
    assert.equal(needsBirth("question", null), false);
    assert.equal(needsBirth("fortune", toBirthInput(EMPTY_BIRTH)), false);
    assert.equal(isMissingBirth(new ApiError("请先填写生辰", 400)), true);
    assert.equal(isMissingBirth(new ApiError("请先填写生辰", 503)), false);
});
test("自动识别明年与指定年份不会被今年覆盖", () => {
    assert.equal(entryHorizon("next-year"), "next-year");
    assert.equal(entryHorizon("year:2027"), "custom");
    assert.equal(entryHorizon(undefined), "year");
});
