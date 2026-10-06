// tests/bazi.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import lunarPkg from "lunar-javascript";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { correctBirthTime, type CivilTime } from "../src/calendar/solar-time.js";

const clock: CivilTime = { year: 1990, month: 5, day: 15, hour: 15, minute: 30, second: 0 };
const corrected = correctBirthTime(clock, true, null).effective;
const input = { corrected, gender: "male" as const, sect: 1 as const, timeKnown: true, targetYear: 2026 };

test("校正后命例逐字段锁定四柱、十神、藏干、长生、纳音与三宫", () => {
  const chart = buildBaziChart(input);
  const pillars = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.time];
  assert.deepEqual(pillars.map((p) => p?.ganZhi), ["庚午", "辛巳", "庚辰", "癸未"]);
  assert.deepEqual(pillars.map((p) => p?.stemGod), ["比肩", "劫财", "日主", "伤官"]);
  assert.deepEqual(pillars.map((p) => p?.hidden.map((h) => `${h.stem}${h.god}`)), [
    ["丁正官", "己正印"], ["丙七杀", "庚比肩", "戊偏印"],
    ["戊偏印", "乙正财", "癸伤官"], ["己正印", "丁正官", "乙正财"],
  ]);
  assert.deepEqual(pillars.map((p) => p?.diShi), ["沐浴", "长生", "养", "冠带"]);
  assert.deepEqual(pillars.map((p) => p?.naYin), ["路旁土", "白蜡金", "白蜡金", "杨柳木"]);
  assert.equal(chart.taiYuan, "壬申");
  assert.equal(chart.mingGong, "辛巳");
  assert.equal(chart.shenGong, "己丑");
  assert.equal(chart.sect, 1);
  assert.equal(chart.dayBoundary, "23:00");
  assert.equal(chart.dayMaster, "庚");
  const raw = buildBaziChart({ ...input, corrected: clock });
  assert.equal(raw.pillars.time?.ganZhi, "甲申");
  assert.equal(chart.pillars.time?.ganZhi, "癸未");
});

test("已核验起运、八步大运、2026 流年及完整流月", () => {
  const chart = buildBaziChart(input);
  assert.ok(chart.luck);
  assert.equal(chart.luck.direction, "forward");
  assert.deepEqual(chart.luck.start, { years: 7, months: 2, days: 20, solarDate: "1997-08-04" });
  assert.deepEqual(chart.luck.cycles.map((d) => d.ganZhi), [
    "壬午", "癸未", "甲申", "乙酉", "丙戌", "丁亥", "戊子", "己丑",
  ]);
  assert.deepEqual(chart.luck.cycles[0], {
    index: 1, ganZhi: "壬午", stemGod: "食神", startAge: 8, endAge: 17,
    startYear: 1997, endYear: 2006,
  });
  assert.deepEqual(chart.luck.cycles[2], {
    index: 3, ganZhi: "甲申", stemGod: "偏财", startAge: 28, endAge: 37,
    startYear: 2017, endYear: 2026,
  });
  assert.equal(chart.luck.cycles[3]?.startYear, 2027);
  assert.equal(chart.luck.cycles[3]?.endYear, 2036);
  assert.equal(chart.annual?.ganZhi, "丙午");
  assert.equal(chart.annual?.age, 37);
  assert.equal(chart.annual?.currentLuck?.ganZhi, "甲申");
  const eight = lunarPkg.Solar.fromYmdHms(1990, 5, 15, 14, 30, 0).getLunar().getEightChar();
  eight.setSect(1);
  const current = eight.getYun(1).getDaYun().find((d) => d.getStartYear() <= 2026 && d.getEndYear() >= 2026);
  assert.ok(current);
  const year = current.getLiuNian().find((n) => n.getYear() === 2026);
  assert.ok(year);
  assert.equal(chart.annual?.months.length, 12);
  assert.deepEqual(chart.annual?.months.map((m) => [m.monthInChinese, m.ganZhi]),
    year.getLiuYue().map((m) => [m.getMonthInChinese(), m.getGanZhi()]));
});

test("阳男阴女顺行、阴男阳女逆行，以现场六十甲子方向断言", () => {
  const stems = "甲乙丙丁戊己庚辛壬癸";
  const branches = "子丑寅卯辰巳午未申酉戌亥";
  const cycle = Array.from({ length: 60 }, (_, i) => `${stems[i % 10]}${branches[i % 12]}`);
  for (const [year, gender, sign] of [
    [1990, "male", 1], [1991, "female", 1],
    [1991, "male", -1], [1990, "female", -1],
  ] as const) {
    const chart = buildBaziChart({ ...input, corrected: { ...corrected, year }, gender });
    const parity = stems.indexOf(chart.pillars.year.stem) % 2;
    assert.equal(parity, year === 1990 ? 0 : 1);
    assert.equal(chart.luck?.direction, sign === 1 ? "forward" : "backward");
    const monthIndex = cycle.indexOf(chart.pillars.month.ganZhi);
    assert.ok(monthIndex >= 0);
    assert.ok(chart.luck);
    for (const luck of chart.luck.cycles) {
      assert.equal(luck.ganZhi, cycle[(monthIndex + sign * luck.index + 60) % 60]);
    }
  }
});

test("缺时辰正午估运，交节日暂停大运", () => {
  const chart = buildBaziChart({ ...input, timeKnown: false });
  assert.equal(chart.pillars.time, null);
  assert.equal(chart.mingGong, null);
  assert.equal(chart.shenGong, null);
  assert.equal(chart.luck?.approximate, true);
  assert.equal(chart.luck?.cycles[0]?.ganZhi, "壬午");
  assert.ok(chart.liunian.years.every((y) => y.luck));
  assert.doesNotMatch(chart.warnings.join("；"), /交节日年\/月柱待确认/);
  const jie = buildBaziChart({ ...input, timeKnown: false, corrected: { ...corrected, day: 6 } });
  assert.equal(jie.luck, null);
  assert.equal(jie.warnings.length, 1);
  assert.doesNotMatch(jie.warnings.join("；"), /交节日年\/月柱待确认/);
  assert.match(jie.warnings.join("；"), /出生当日交节（立夏）/);
  assert.equal(chart.taiYuan, "壬申");
  assert.ok(chart.annual?.currentLuck);
  assert.equal(chart.annual?.ganZhi, "丙午");
  assert.equal(chart.annual?.months.length, 12);
  assert.match(chart.warnings.join("；"), /时辰未知/);
  assert.equal(buildBaziChart({ ...input, targetYear: 1989 }).annual, null);
});

test("23:30 两种日界日柱不同，时柱遵守库的共同晚子时口径", () => {
  const birth = { ...clock, year: 2000, month: 11, day: 3, hour: 23 };
  const first = buildBaziChart({ ...input, corrected: birth, sect: 1 });
  const second = buildBaziChart({ ...input, corrected: birth, sect: 2 });
  assert.notEqual(first.pillars.day.ganZhi, second.pillars.day.ganZhi);
  assert.equal(first.pillars.time?.ganZhi, second.pillars.time?.ganZhi);
  assert.equal(second.dayBoundary, "00:00");
  const e = lunarPkg.Solar.fromYmdHms(2000, 11, 3, 23, 30, 0).getLunar().getEightChar();
  e.setSect(1);
  assert.equal(first.pillars.day.ganZhi, e.getDay());
  e.setSect(2);
  assert.equal(second.pillars.day.ganZhi, e.getDay());
  assert.throws(() => buildBaziChart({ ...input, targetYear: 2100 }), /年份/);
  assert.throws(() => buildBaziChart({ ...input, sect: 3 as 1 }), /换日/);
});

 test("十年窗口锁定已核验事实与交运日期", () => {
  const years = buildBaziChart(input).liunian.years;
  const gz = ["癸卯", "甲辰", "乙巳", "丙午", "丁未", "戊申", "己酉", "庚戌", "辛亥", "壬子"];
  const gods = ["伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印", "比肩", "劫财", "食神"];
  years.forEach((y, i) => {
    assert.equal(y.year, 2023 + i);
    assert.equal(y.ganZhi, gz[i]);
    assert.equal(y.stem, gz[i]?.slice(0, 1));
    assert.equal(y.branch, gz[i]?.slice(1));
    assert.equal(y.age, 34 + i);
    assert.equal(y.stemGod, gods[i]);
    assert.equal(y.luck?.ganZhi, i < 4 ? "甲申" : "乙酉");
    const ranks = ["main", "middle", "residual"];
    assert.deepEqual(y.hidden, lunarPkg.LunarUtil.ZHI_HIDE_GAN[y.branch]?.map((stem, j) => ({
      stem, god: lunarPkg.LunarUtil.SHI_SHEN["庚" + stem], qi: ranks[j],
    })));
    assert.deepEqual(y.luckChange, y.year === 2027
      ? { date: "2027-08-04", from: "甲申", to: "乙酉" } : null);
  });
  assert.deepEqual(buildBaziChart({ ...input, targetYear: 2027 }).liunian.years.map((y) => y.year),
    Array.from({ length: 10 }, (_, i) => 2024 + i));
  assert.equal(lunarPkg.Solar.fromYmd(2000, 2, 29).nextYear(10).toYmd(), "2010-02-28");
});
 test("出生立春年裁剪、起运前与上限", () => {
  const recent = buildBaziChart({ ...input, corrected: { ...corrected, year: 2024, day: 1 },
    targetYear: 2025 });
  assert.equal(recent.liunian.years[0]?.year, 2024);
  assert.equal(recent.liunian.years[0]?.luckLabel, "起运前");
  const before = buildBaziChart({ ...input, corrected: { ...corrected, month: 1, day: 20 },
    targetYear: 1990 });
  assert.equal(before.pillars.year.ganZhi, "己巳");
  assert.equal(before.liunian.years[0]?.year, 1989);
  assert.ok(buildBaziChart({ ...input, corrected: { ...corrected, month: 1, day: 20 },
    targetYear: 1989 }).annual);
  const end = buildBaziChart({ ...input, targetYear: 2099 });
  assert.equal(end.liunian.years.at(-1)?.year, 2099);
  assert.equal(end.liunian.years.length, 4);
});
