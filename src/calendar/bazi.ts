// src/calendar/bazi.ts
import lunarPkg from "lunar-javascript";
import { assertCivilTime, type CivilTime } from "./solar-time.js";
export type PillarKey = "year" | "month" | "day" | "time";
export interface BaziPillar {
  key: PillarKey;
  label: string;
  ganZhi: string;
  stem: string;
  branch: string;
  stemGod: string;
  hidden: readonly {
    stem: string;
    god: string;
    qi: "main" | "middle" | "residual";
  }[];
  diShi: string;
  naYin: string;
}
export interface LuckCycle {
  index: number;
  ganZhi: string;
  stemGod: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
}
export interface AnnualLuck {
  year: number;
  ganZhi: string;
  age: number;
  stemGod: string;
  currentLuck: LuckCycle | null;
  months: readonly {
    index: number;
    monthInChinese: string;
    ganZhi: string;
    stemGod: string;
  }[];
}
export interface LiuNianEntry {
  year: number;
  ganZhi: string;
  stem: string;
  branch: string;
  age: number;
  stemGod: string;
  hidden: BaziPillar["hidden"];
  luck: LuckCycle | null;
  luckLabel: "起运前" | "时辰未知" | null;
  luckChange: {
    date: string;
    from: string | null;
    to: string;
  } | null;
}
export interface BaziChart {
  sect: 1 | 2;
  dayBoundary: "23:00" | "00:00";
  timeKnown: boolean;
  dayMaster: string;
  pillars: {
    year: BaziPillar;
    month: BaziPillar;
    day: BaziPillar;
    time: BaziPillar | null;
  };
  taiYuan: string;
  mingGong: string | null;
  shenGong: string | null;
  luck: {
    approximate: boolean;
    direction: "forward" | "backward";
    start: {
      years: number;
      months: number;
      days: number;
      solarDate: string;
    };
    cycles: readonly LuckCycle[];
  } | null;
  annual: AnnualLuck | null;
  birthLiChunYear: number;
  liunian: {
    anchorYear: number;
    years: LiuNianEntry[];
  };
  warnings: readonly string[];
}
export interface BaziInput {
  /** 日柱、时柱采用的当地标准时；旧路径仍是项目校正后的北京时间。 */
  corrected: CivilTime;
  /** 海外路径的北京钟面 A；提供时由它决定年月、胎元、大运与起运。 */
  yearMonth?: CivilTime;
  gender: "male" | "female";
  sect: 1 | 2;
  timeKnown: boolean;
  targetYear: number;
}
function godFor(dayStem: string, stem: string): string {
  const god = lunarPkg.LunarUtil.SHI_SHEN[dayStem + stem];
  if (!god) {
    throw new Error("十神映射缺失，拒绝输出命盘");
  }
  return god;
}
function pillar(key: PillarKey, label: string, ganZhi: string, stemGod: string,
  stems: readonly string[], gods: readonly string[], diShi: string, naYin: string): BaziPillar {
  if (ganZhi.length !== 2 || stems.length !== gods.length) {
    throw new Error("四柱或藏干十神不一致，拒绝输出命盘");
  }
  const ranks = ["main", "middle", "residual"] as const;
  const hidden = stems.map((stem, index) => {
    const god = gods[index];
    const qi = ranks[index];
    if (!god || !qi) {
      throw new Error("藏干十神或气序缺失，拒绝输出命盘");
    }
    return { stem, god, qi };
  });
  return { key, label, ganZhi, stem: ganZhi.slice(0, 1), branch: ganZhi.slice(1),
    stemGod, hidden, diShi, naYin };
}

type ExtendedLunarUtil = typeof lunarPkg.LunarUtil & {
  GAN: string[];
  ZHI: string[];
  MONTH_ZHI: string[];
  CHANG_SHENG: string[];
  CHANG_SHENG_OFFSET: Record<string, number>;
  NAYIN: Record<string, string>;
};

function derivedPillar(key: PillarKey, label: string, ganZhi: string, dayStem: string): BaziPillar {
  const util = lunarPkg.LunarUtil as ExtendedLunarUtil;
  const branch = ganZhi.slice(1);
  const stems = util.ZHI_HIDE_GAN[branch];
  const naYin = util.NAYIN[ganZhi];
  const dayIndex = util.GAN.indexOf(dayStem) - 1;
  const branchIndex = util.ZHI.indexOf(branch) - 1;
  const offset = util.CHANG_SHENG_OFFSET[dayStem];
  if (!stems || !naYin || dayIndex < 0 || branchIndex < 0 || offset === undefined) {
    throw new Error("LunarUtil 四柱表缺失");
  }
  const diShiIndex = (offset + (dayIndex % 2 === 0 ? branchIndex : -branchIndex) + 24) % 12;
  return pillar(key, label, ganZhi, godFor(dayStem, ganZhi.slice(0, 1)), stems,
    stems.map((stem) => godFor(dayStem, stem)), util.CHANG_SHENG[diShiIndex]!, naYin);
}

/** 年月来自 A、时支来自 B 时，按 LunarUtil 同一套表重算命宫与身宫。 */
function hybridGong(yearGan: string, monthZhi: string, timeZhi: string): {
  mingGong: string;
  shenGong: string;
} {
  const util = lunarPkg.LunarUtil as ExtendedLunarUtil;
  const yearGanIndex = util.GAN.indexOf(yearGan) - 1;
  const monthZhiIndex = util.MONTH_ZHI.indexOf(monthZhi);
  const mingTimeIndex = util.MONTH_ZHI.indexOf(timeZhi);
  const shenTimeIndex = util.ZHI.indexOf(timeZhi);
  if (yearGanIndex < 0 || monthZhiIndex < 0 || mingTimeIndex < 0 || shenTimeIndex < 0) {
    throw new Error("LunarUtil 命身宫表缺失");
  }
  const ganZhi = (offset: number) => {
    let ganIndex = (yearGanIndex + 1) * 2 + offset;
    while (ganIndex > 10) ganIndex -= 10;
    const stem = util.GAN[ganIndex];
    const branch = util.MONTH_ZHI[offset];
    if (!stem || !branch) throw new Error("LunarUtil 命身宫索引缺失");
    return stem + branch;
  };
  const mingSum = monthZhiIndex + mingTimeIndex;
  const mingOffset = (mingSum >= 14 ? 26 : 14) - mingSum;
  let shenOffset = monthZhiIndex + shenTimeIndex;
  if (shenOffset > 12) shenOffset -= 12;
  return { mingGong: ganZhi(mingOffset), shenGong: ganZhi(shenOffset) };
}
function independentAnnual(year: number, birthYear: number, dayStem: string): AnnualLuck {
  const stems = "甲乙丙丁戊己庚辛壬癸";
  const branches = "寅卯辰巳午未申酉戌亥子丑";
  const names = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
  // 七月一定在该标签年的立春之后；不以公历元旦替代立春年。
  const eight = lunarPkg.Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getEightChar();
  const ganZhi = eight.getYear();
  const offset = (stems.indexOf(ganZhi.slice(0, 1)) % 5 * 2 + 2) % 10;
  const months = Array.from({ length: 12 }, (_, index) => {
    const stem = stems[(offset + index) % 10];
    const branch = branches[index];
    const monthInChinese = names[index];
    if (!stem || !branch || !monthInChinese) {
      throw new Error("流月映射缺失");
    }
    return { index: index + 1, monthInChinese, ganZhi: stem + branch, stemGod: godFor(dayStem, stem) };
  });
  return { year, ganZhi, age: year - birthYear + 1, stemGod: godFor(dayStem, ganZhi.slice(0, 1)),
    currentLuck: null, months };
}
export function buildBaziChart(input: BaziInput): BaziChart {
  assertCivilTime(input.corrected);
  if (input.yearMonth) assertCivilTime(input.yearMonth);
  if (input.sect !== 1 && input.sect !== 2) {
    throw new Error("换日口径须为 1 或 2");
  }
  if (input.gender !== "male" && input.gender !== "female") {
    throw new Error("性别须为男或女");
  }
  if (!Number.isInteger(input.targetYear) || input.targetYear < 1900 || input.targetYear > 2099) {
    throw new Error("所问年份仅支持 1900–2099 年");
  }
  const birth = input.timeKnown ? input.corrected : { ...input.corrected, hour: 12, minute: 0, second: 0 };
  const yearMonthBirth = input.yearMonth
    ? (input.timeKnown ? input.yearMonth : { ...input.yearMonth, hour: 12, minute: 0, second: 0 })
    : birth;
  const eight = lunarPkg.Solar.fromYmdHms(birth.year, birth.month, birth.day, birth.hour,
    birth.minute, birth.second).getLunar().getEightChar();
  eight.setSect(input.sect);
  const yearMonthEight = input.yearMonth
    ? lunarPkg.Solar.fromYmdHms(yearMonthBirth.year, yearMonthBirth.month, yearMonthBirth.day,
      yearMonthBirth.hour, yearMonthBirth.minute, yearMonthBirth.second).getLunar().getEightChar()
    : eight;
  yearMonthEight.setSect(input.sect);
  const sameYearMonth = yearMonthEight.getYear() === eight.getYear()
    && yearMonthEight.getMonth() === eight.getMonth();
  const year = !input.yearMonth || sameYearMonth
    ? pillar("year", "年柱", eight.getYear(), eight.getYearShiShenGan(),
      eight.getYearHideGan(), eight.getYearShiShenZhi(), eight.getYearDiShi(), eight.getYearNaYin())
    : derivedPillar("year", "年柱", yearMonthEight.getYear(), eight.getDay().slice(0, 1));
  const month = !input.yearMonth || sameYearMonth
    ? pillar("month", "月柱", eight.getMonth(), eight.getMonthShiShenGan(),
      eight.getMonthHideGan(), eight.getMonthShiShenZhi(), eight.getMonthDiShi(), eight.getMonthNaYin())
    : derivedPillar("month", "月柱", yearMonthEight.getMonth(), eight.getDay().slice(0, 1));
  const day = pillar("day", "日柱", eight.getDay(), "日主", eight.getDayHideGan(),
    eight.getDayShiShenZhi(), eight.getDayDiShi(), eight.getDayNaYin());
  const time = input.timeKnown ? pillar("time", "时柱", eight.getTime(), eight.getTimeShiShenGan(),
    eight.getTimeHideGan(), eight.getTimeShiShenZhi(), eight.getTimeDiShi(), eight.getTimeNaYin()) : null;
  const midyear = lunarPkg.Solar.fromYmd(yearMonthBirth.year, 7, 1).getLunar().getEightChar().getYear();
  const birthLiChunYear = yearMonthEight.getYear() === midyear
    ? yearMonthBirth.year : yearMonthBirth.year - 1;
  const jie = input.timeKnown ? null
    : lunarPkg.Solar.fromYmd(yearMonthBirth.year, yearMonthBirth.month, yearMonthBirth.day)
      .getLunar().getCurrentJie();
  const warnings: string[] = [];
  if (!input.timeKnown) {
    if (jie) {
      warnings.push(`出生当日交节（${jie.getName()}），年/月柱与大运需补时辰确认`);
    } else {
      warnings.push("时辰未知，起运按当日正午估算，交运日期可能前后相差约两个月");
    }
  }
  const yun = jie ? null : yearMonthEight.getYun(input.gender === "male" ? 1 : 0);
  const all = yun?.getDaYun(22) ?? [];
  const convert = (value: (typeof all)[number]): LuckCycle => ({
    index: value.getIndex(), ganZhi: value.getGanZhi(),
    stemGod: godFor(day.stem, value.getGanZhi().slice(0, 1)),
    startAge: value.getStartAge(), endAge: value.getEndAge(),
    startYear: value.getStartYear(), endYear: value.getEndYear(),
  });
  const luck: BaziChart["luck"] = yun ? {
    approximate: !input.timeKnown,
    direction: yun.isForward() ? "forward" : "backward",
    start: { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay(),
      solarDate: yun.getStartSolar().toYmd() },
    cycles: all.filter((value) => value.getIndex() > 0).slice(0, 8).map(convert),
  } : null;
  function entry(target: number): LiuNianEntry {
    const current = all.find((v) => v.getStartYear() <= target && target <= v.getEndYear());
    const raw = current?.getLiuNian().find((v) => v.getYear() === target);
    const independent = independentAnnual(target, yearMonthBirth.year, day.stem);
    const ganZhi = raw?.getGanZhi() ?? independent.ganZhi;
    const branch = ganZhi.slice(1);
    const ranks = ["main", "middle", "residual"] as const;
    const stems = lunarPkg.LunarUtil.ZHI_HIDE_GAN[branch];
    if (!stems) {
      throw new Error("流年藏干缺失");
    }
    const hidden = stems.map((stem, i) => {
      const qi = ranks[i];
      if (!qi) {
        throw new Error("流年藏干气序缺失");
      }
      return { stem, god: godFor(day.stem, stem), qi };
    });
    const cycle = current && current.getIndex() > 0 ? convert(current) : null;
    const previous = cycle ? all.find((v) => v.getIndex() === cycle.index - 1) : null;
    let luckLabel: LiuNianEntry["luckLabel"] = null;
    if (!yun) {
      luckLabel = "时辰未知";
    } else if (!cycle) {
      luckLabel = "起运前";
    }
    return {
      year: target, ganZhi, stem: ganZhi.slice(0, 1), branch,
      age: raw?.getAge() ?? independent.age, stemGod: godFor(day.stem, ganZhi.slice(0, 1)),
      hidden, luck: cycle, luckLabel,
      luckChange: cycle && yun && cycle.startYear === target ? {
        date: yun.getStartSolar().nextYear((cycle.index - 1) * 10).toYmd(),
        from: previous && previous.getIndex() > 0 ? previous.getGanZhi() : null,
        to: cycle.ganZhi,
      } : null,
    };
  }
  const years = Array.from({ length: 10 }, (_, i) => input.targetYear - 3 + i)
    .filter((y) => y >= birthLiChunYear && y <= 2099).map(entry);
  let annual: AnnualLuck | null = input.targetYear < birthLiChunYear
    ? null : independentAnnual(input.targetYear, yearMonthBirth.year, day.stem);
  if (annual) {
    const selected = entry(input.targetYear);
    annual = { ...annual, age: selected.age, currentLuck: selected.luck };
  }
  const gong = input.timeKnown && input.yearMonth && !sameYearMonth
    ? hybridGong(year.stem, month.branch, time!.branch)
    : null;
  return {
    sect: input.sect, dayBoundary: input.sect === 1 ? "23:00" : "00:00",
    timeKnown: input.timeKnown, dayMaster: day.stem, pillars: { year, month, day, time },
    taiYuan: yearMonthEight.getTaiYuan(),
    mingGong: input.timeKnown ? gong?.mingGong ?? eight.getMingGong() : null,
    shenGong: input.timeKnown ? gong?.shenGong ?? eight.getShenGong() : null, luck, annual, warnings,
    birthLiChunYear, liunian: { anchorYear: input.targetYear, years },
  };
}
