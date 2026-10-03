// tests/almanac.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import lunarPkg from "lunar-javascript";

test("lunar-javascript 的 CommonJS 默认导入暴露 Solar", () => {
  assert.equal(typeof lunarPkg.Solar.fromYmdHms, "function");
  const lunar = lunarPkg.Solar.fromYmdHms(2026, 9, 30, 20, 15, 0).getLunar();
  assert.equal(lunar.toString(), "二〇二六年八月二十");
});

// tests/almanac.test.ts（保留 Task 1 测试，再加入）
import { almanacAt, assertCalendarConsistent } from "../src/calendar/almanac.js";

const SAMPLE = BigInt(Date.UTC(2026, 8, 30, 12, 15, 0) / 1_000);

test("时空栏和黄历逐字段符合已核验样例", () => {
  const result = almanacAt(SAMPLE);
  assert.deepEqual(result.solar, { timezone: "UTC+8", text: "2026-09-30 20:15:00" });
  assert.deepEqual(result.lunar, {
    date: "二〇二六年八月二十",
    timeBranch: "戌",
    moonPhase: "更待",
  });
  assert.deepEqual(result.pillars, ["丙午", "丁酉", "丁未", "庚戌"]);
  assert.deepEqual(result.naYin, ["天河水", "山下火", "天河水", "钗钏金"]);
  assert.deepEqual(result.solarTerms, {
    current: "秋分", hou: "秋分 二候", wuHou: "蛰虫坯户",
    previousAt: "2026-09-23 08:05:14", next: "寒露", nextAt: "2026-10-08 14:29:17",
  });
  assert.deepEqual(result.cycle, {
    monthBranch: "酉",
    day: "丁未",
    xun: "甲辰",
    voidBranches: ["寅", "卯"],
  });
  assert.deepEqual(result.dayOfficers, { officer: "开", deity: "天德", path: "黄道" });
  assert.deepEqual(result.mansion, { name: "壁水貐", palace: "北", guardian: "玄武" });
  assert.deepEqual(result.clash, { description: "(辛丑)牛", direction: "西" });
  assert.equal(result.almanac.nineStar, "五黄土玉衡");
  assert.equal(result.almanac.joy, "正南");
  assert.equal(result.almanac.wealth, "西南");
  assert.equal(result.almanac.fortune, "东南");
  assert.deepEqual(
    result.almanac.suitable.slice(0, 6),
    ["祭祀", "解除", "结网", "畋猎", "取渔", "会亲友"],
  );
  assert.deepEqual(
    result.almanac.avoid.slice(0, 6),
    ["开市", "祈福", "动土", "破土", "入殓", "安葬"],
  );
  assert.equal(result.almanac.suitable.length, 11);
  assert.equal(result.almanac.avoid.length, 7);
  assert.deepEqual(result.almanac.pengZu, ["丁不剃头头必生疮", "未不服药毒气入肠"]);
  assert.doesNotThrow(() => assertCalendarConsistent(result));
});

test("二十八宿只规范 lunar-javascript 的獝为貐", () => {
  assert.equal(almanacAt(SAMPLE).mansion.name, "壁水貐");
});

test("2020—2030 固定种子抽样 500 个时刻均通过双源互校", () => {
  let state = 0x51_41_4e_59;
  const start = Date.UTC(2020, 0, 1) / 1_000;
  const span = Date.UTC(2031, 0, 1) / 1_000 - start;
  for (let index = 0; index < 500; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const result = almanacAt(BigInt(Math.floor(start + (state / 2 ** 32) * span)));
    assert.doesNotThrow(() => assertCalendarConsistent(result));
  }
});

test("寒露交节前后只保留近交节提示，不误报月建不一致", () => {
  const boundary = Date.UTC(2026, 9, 8, 6, 29, 17) / 1_000;
  for (const offset of [-60, 60]) {
    const timestamp = BigInt(boundary + offset);
    assert.doesNotThrow(() => almanacAt(timestamp));
    assert.equal(almanacAt(timestamp).month.boundaryUncertain, true);
  }
});

test("距寒露约两小时继续执行月建比较", () => {
  const result = almanacAt(BigInt(Date.UTC(2026, 9, 8, 8, 29, 17) / 1_000));
  assert.equal(result.month.boundaryUncertain, false);
  assert.equal(result.cycle.monthBranch, result.month.branch);
  assert.doesNotThrow(() => assertCalendarConsistent(result));
});

test("一致性错误拒绝返回可能错误的盘", () => {
  const result = almanacAt(SAMPLE);
  assert.throws(
    () => assertCalendarConsistent({ ...result, cycle: { ...result.cycle, day: "戊申" } }),
    /历法不一致：黄历日干支戊申，六爻日干支丁未/,
  );
});
