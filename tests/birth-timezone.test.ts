import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  birthTimeBasis,
  localToInstant,
  standardOffset,
  type CivilTime,
} from "../src/calendar/birth-instant.js";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { correctBirthTime } from "../src/calendar/solar-time.js";
import { buildBirthChart } from "../src/sanyi/birth-chart.js";
import { BirthFields } from "../web/components/BirthFields.js";
import {
  EMPTY_BIRTH,
  fromBirthInput,
  loadBirthProfile,
  toBirthInput,
} from "../web/lib/birth-profile.js";

const overseas = [
  {
    label: "纽约夏令时",
    timeZone: "America/New_York",
    civil: { year: 1995, month: 7, day: 4, hour: 10, minute: 30, second: 0 },
    // 10:30 EDT（UTC-4）→ 14:30 UTC → 北京 22:30；纽约标准偏移 UTC-5 → B 为 09:30。
    utc: "1995-07-04T14:30:00.000Z",
    beijing: { year: 1995, month: 7, day: 4, hour: 22, minute: 30, second: 0 },
    standard: { year: 1995, month: 7, day: 4, hour: 9, minute: 30, second: 0 },
    // A、B 都在乙亥年壬午月；四柱整组取 B：乙亥 壬午 丙申 癸巳。
    pillars: ["乙亥", "壬午", "丙申", "癸巳"],
  },
  {
    label: "纽约冬令时",
    timeZone: "America/New_York",
    civil: { year: 1995, month: 1, day: 15, hour: 8, minute: 0, second: 0 },
    // 08:00 EST（UTC-5）→ 13:00 UTC → 北京 21:00；当地标准时仍为 08:00。
    utc: "1995-01-15T13:00:00.000Z",
    beijing: { year: 1995, month: 1, day: 15, hour: 21, minute: 0, second: 0 },
    standard: { year: 1995, month: 1, day: 15, hour: 8, minute: 0, second: 0 },
    // A、B 都在甲戌年丁丑月；四柱整组取 B：甲戌 丁丑 丙午 壬辰。
    pillars: ["甲戌", "丁丑", "丙午", "壬辰"],
  },
  {
    label: "伦敦夏令时",
    timeZone: "Europe/London",
    civil: { year: 1990, month: 6, day: 1, hour: 14, minute: 0, second: 0 },
    // 14:00 BST（UTC+1）→ 13:00 UTC → 北京标准时（UTC+8）21:00；B 为 13:00。
    utc: "1990-06-01T13:00:00.000Z",
    beijing: { year: 1990, month: 6, day: 1, hour: 21, minute: 0, second: 0 },
    standard: { year: 1990, month: 6, day: 1, hour: 13, minute: 0, second: 0 },
    // A、B 都在庚午年辛巳月；四柱整组取 B：庚午 辛巳 丁酉 丁未。
    pillars: ["庚午", "辛巳", "丁酉", "丁未"],
  },
  {
    label: "悉尼夏令时",
    timeZone: "Australia/Sydney",
    civil: { year: 2000, month: 12, day: 25, hour: 6, minute: 0, second: 0 },
    // 06:00 AEDT（UTC+11）→ 前日 19:00 UTC → 北京 03:00；标准偏移 UTC+10 → B 为 05:00。
    utc: "2000-12-24T19:00:00.000Z",
    beijing: { year: 2000, month: 12, day: 25, hour: 3, minute: 0, second: 0 },
    standard: { year: 2000, month: 12, day: 25, hour: 5, minute: 0, second: 0 },
    // A、B 都在庚辰年戊子月；四柱整组取 B：庚辰 戊子 丁巳 癸卯。
    pillars: ["庚辰", "戊子", "丁巳", "癸卯"],
  },
  {
    label: "加德满都跨北京子时",
    timeZone: "Asia/Kathmandu",
    civil: { year: 1998, month: 3, day: 21, hour: 23, minute: 40, second: 0 },
    // 23:40 NPT（UTC+5:45）→ 17:55 UTC → 北京次日 01:55；无夏令时，B 仍为 23:40。
    utc: "1998-03-21T17:55:00.000Z",
    beijing: { year: 1998, month: 3, day: 22, hour: 1, minute: 55, second: 0 },
    standard: { year: 1998, month: 3, day: 21, hour: 23, minute: 40, second: 0 },
    // A、B 都在戊寅年乙卯月；日、时按 B：戊辰 壬子，故四柱为戊寅 乙卯 戊辰 壬子。
    pillars: ["戊寅", "乙卯", "戊辰", "壬子"],
  },
] as const;

test("Intl 反推海外出生 instant、北京钟面 A 与当地标准时 B", () => {
  for (const fixture of overseas) {
    const basis = birthTimeBasis(fixture.civil, fixture.timeZone);
    assert.equal(new Date(basis.epochMilliseconds).toISOString(), fixture.utc, fixture.label);
    assert.deepEqual(basis.beijing, fixture.beijing, fixture.label);
    assert.deepEqual(basis.localStandard, fixture.standard, fixture.label);
    assert.equal(basis.disambiguation, "exact", fixture.label);
    const result = buildBirthChart({
      calendar: "solar", ...fixture.civil, isLeapMonth: false,
      time: { hour: fixture.civil.hour, minute: fixture.civil.minute },
      gender: "male", timeZone: fixture.timeZone,
    }, 1, 2026);
    assert.deepEqual(Object.values(result.chart.pillars).map((pillar) => pillar?.ganZhi),
      fixture.pillars, fixture.label);
    assert.equal(result.correction.timeZone, fixture.timeZone, fixture.label);
    assert.equal(result.correction.localStandard,
      `${String(fixture.standard.hour).padStart(2, "0")}:${String(fixture.standard.minute).padStart(2, "0")}`);
  }
});

test("标准偏移取一月与七月较小值，支持 45 分钟偏移", () => {
  assert.equal(standardOffset("America/New_York", 1995), -300);
  assert.equal(standardOffset("Europe/London", 1990), 0);
  assert.equal(standardOffset("Australia/Sydney", 2000), 600);
  assert.equal(standardOffset("Asia/Kathmandu", 1998), 345);
});

test("跳跃与重复时段都识别并取较早 instant", () => {
  // 纽约 2021-03-14 02:30 不存在；候选 06:30Z（按 -4）和 07:30Z（按 -5），取较早 06:30Z。
  const skipped = localToInstant(
    { year: 2021, month: 3, day: 14, hour: 2, minute: 30, second: 0 },
    "America/New_York",
  );
  assert.equal(skipped.disambiguation, "skipped");
  assert.equal(new Date(skipped.epochMilliseconds).toISOString(), "2021-03-14T06:30:00.000Z");
  // 纽约 2021-11-07 01:30 出现两次：05:30Z（EDT）与 06:30Z（EST），取较早 05:30Z。
  const ambiguous = localToInstant(
    { year: 2021, month: 11, day: 7, hour: 1, minute: 30, second: 0 },
    "America/New_York",
  );
  assert.equal(ambiguous.disambiguation, "ambiguous");
  assert.equal(new Date(ambiguous.epochMilliseconds).toISOString(), "2021-11-07T05:30:00.000Z");
  const mixed = buildBirthChart({
    calendar: "solar", year: 2021, month: 11, day: 7, isLeapMonth: false,
    time: { hour: 1, minute: 30 }, gender: "male", timeZone: "America/New_York",
  }, 1, 2026);
  // A 为 2021-11-07 13:30（已交立冬，己亥月），B 为 2021-11-07 00:30（戊戌月）；
  // 年月取 A，日时取 B，得到 辛丑 己亥 己未 甲子。
  assert.deepEqual(Object.values(mixed.chart.pillars).map((pillar) => pillar?.ganZhi),
    ["辛丑", "己亥", "己未", "甲子"]);
  assert.deepEqual([
    mixed.chart.pillars.year.stemGod,
    mixed.chart.pillars.month.stemGod,
    mixed.chart.pillars.time?.stemGod,
  ], ["食神", "比肩", "正官"]);
  // 辛年、亥月与子时按 LunarUtil 命身宫表重组；不能沿用 A 或 B 任一整盘的宫位。
  assert.equal(mixed.chart.mingGong, "甲午");
  assert.equal(mixed.chart.shenGong, "庚子");
  assert.equal(mixed.chart.taiYuan, "庚寅");
  // 起运取 A：出生后十日交运；若误用 B 会变成 9 年 10 月 10 日。
  assert.deepEqual(mixed.chart.luck?.start,
    { years: 0, months: 0, days: 10, solarDate: "2021-11-17" });
  assert.equal(mixed.correction.disambiguation, "ambiguous");
});

test("缺省与 Asia/Shanghai 完整结果逐字节不变，非法 IANA 时区拒绝", () => {
  const base = {
    calendar: "solar" as const, year: 1990, month: 5, day: 15, isLeapMonth: false,
    time: { hour: 15, minute: 30 }, gender: "male" as const,
  };
  assert.equal(JSON.stringify(buildBirthChart(base, 1, 2026)),
    JSON.stringify(buildBirthChart({ ...base, timeZone: "Asia/Shanghai" }, 1, 2026)));
  assert.throws(() => localToInstant({
    year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0,
  }, "Mars/Olympus"), /时区/u);
});

test("200 个海外样本在 A、B 年月相同时，混合命盘四柱逐字段等于 B 直排", () => {
  const zones = ["America/New_York", "Europe/London", "Australia/Sydney", "Asia/Kathmandu"];
  let seed = 0x5a17_2026;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  let compared = 0;
  for (let attempt = 0; compared < 200 && attempt < 2_000; attempt += 1) {
    const civil: CivilTime = {
      year: 1950 + Math.floor(random() * 150),
      month: 1 + Math.floor(random() * 12),
      day: 1 + Math.floor(random() * 27),
      hour: Math.floor(random() * 24),
      minute: Math.floor(random() * 60),
      second: 0,
    };
    const zone = zones[Math.floor(random() * zones.length)]!;
    const basis = birthTimeBasis(civil, zone);
    const beijing = correctBirthTime(basis.beijing, true, null,
      { mainlandDst: true, birthplace: null }).effective;
    const direct = buildBaziChart({
      corrected: basis.localStandard, gender: "male", sect: 1, timeKnown: true, targetYear: 2026,
    });
    const a = buildBaziChart({
      corrected: beijing, gender: "male", sect: 1, timeKnown: true, targetYear: 2026,
    });
    if (a.pillars.year.ganZhi !== direct.pillars.year.ganZhi
      || a.pillars.month.ganZhi !== direct.pillars.month.ganZhi) continue;
    const mixed = buildBaziChart({
      corrected: basis.localStandard, yearMonth: beijing,
      gender: "male", sect: 1, timeKnown: true, targetYear: 2026,
    });
    assert.deepEqual(mixed.pillars, direct.pillars, `${zone} ${JSON.stringify(civil)}`);
    compared += 1;
  }
  assert.equal(compared, 200);
});

test("前端新生辰默认浏览器时区，旧本机档案回退上海，并渲染时区选择", () => {
  assert.equal(EMPTY_BIRTH.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai");
  const old = {
    calendar: "solar" as const, year: 1990, month: 5, day: 15, isLeapMonth: false,
    time: { hour: 15, minute: 30 }, gender: "male" as const,
  };
  const storage = { getItem: () => JSON.stringify(old), setItem: () => {} };
  assert.equal(loadBirthProfile(storage)?.timeZone, "Asia/Shanghai");
  const values = fromBirthInput({ ...old, timeZone: "America/New_York" });
  assert.equal(toBirthInput(values).timeZone, "America/New_York");
  const html = renderToStaticMarkup(createElement(BirthFields, {
    values, problem: null, onChange: () => {},
  }));
  assert.match(html, /出生地时区/u);
  assert.match(html, /America\/New_York/u);
  assert.match(html, /其他/u);
});

test("节气用的 A 固定为北京标准时（UTC+8），不受 tzdb 中国 1940 年代夏令时影响", async () => {
  const { birthTimeBasis } = await import("../src/calendar/birth-instant.js");
  // 1945-06-01 伦敦为双重夏令时（UTC+2）：14:00 → 12:00 UTC → 北京标准时 20:00。
  // tzdb 的 Asia/Shanghai 在 1945 年为 UTC+9，若借道它会得到 21:00。
  const basis = birthTimeBasis({ year: 1945, month: 6, day: 1, hour: 14, minute: 0, second: 0 }, "Europe/London");
  assert.equal(basis.beijing.hour, 20);
  assert.equal(basis.beijing.day, 1);
  // 1988 年（中国夏令时期间）同样按 UTC+8：纽约 1988-07-01 08:00 EDT → 12:00 UTC → 北京 20:00。
  const late = birthTimeBasis({ year: 1988, month: 7, day: 1, hour: 8, minute: 0, second: 0 }, "America/New_York");
  assert.equal(late.beijing.hour, 20);
});
