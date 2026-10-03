// src/calendar/almanac.ts
import lunarPkg from "lunar-javascript";
import { deriveSexagenaryDay, deriveSolarMonth } from "../oracle/liuyao-chart.js";

export interface AlmanacResult {
  timestamp: string;
  solar: { timezone: "UTC+8"; text: string };
  lunar: { date: string; timeBranch: string; moonPhase: string };
  pillars: readonly [string, string, string, string];
  naYin: readonly [string, string, string, string];
  solarTerms: {
    current: string;
    hou: string;
    wuHou: string;
    previousAt: string;
    next: string;
    nextAt: string;
  };
  cycle: { monthBranch: string; day: string; xun: string; voidBranches: readonly [string, string] };
  month: ReturnType<typeof deriveSolarMonth>;
  dayOfficers: { officer: string; deity: string; path: string };
  mansion: { name: string; palace: string; guardian: string };
  clash: { description: string; direction: string };
  almanac: {
    nineStar: string; joy: string; wealth: string; fortune: string;
    suitable: readonly string[]; avoid: readonly string[]; pengZu: readonly [string, string];
  };
}

// 逐一对照传统写法：壁宿獝→貐、胃宿彘→雉，其余 26 宿与传统一致。
const MANSION_ANIMAL_FIX: Record<string, string> = { 獝: "貐", 彘: "雉" };

const pad = (value: number): string => String(value).padStart(2, "0");

function utc8Parts(timestamp: bigint): [number, number, number, number, number, number] {
  if (timestamp < 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("历法时间戳必须是安全的非负整数秒");
  }
  const date = new Date((Number(timestamp) + 8 * 3_600) * 1_000);
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
}

function formatSolar(value: { toYmdHms(): string }): string {
  return value.toYmdHms();
}

export function almanacAt(timestamp: bigint): AlmanacResult {
  const [year, month, day, hour, minute, second] = utc8Parts(timestamp);
  const lunar = lunarPkg.Solar.fromYmdHms(year, month, day, hour, minute, second).getLunar();
  const eight = lunar.getEightChar();
  eight.setSect(2);
  const previous = lunar.getPrevJieQi();
  const next = lunar.getNextJieQi();
  const liuyaoDay = deriveSexagenaryDay(timestamp);
  const liuyaoMonth = deriveSolarMonth(timestamp);
  const result: AlmanacResult = {
    timestamp: timestamp.toString(),
    solar: {
      timezone: "UTC+8",
      text: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    },
    lunar: { date: lunar.toString(), timeBranch: lunar.getTimeZhi(), moonPhase: lunar.getYueXiang() },
    pillars: [eight.getYear(), eight.getMonth(), eight.getDay(), eight.getTime()],
    naYin: [eight.getYearNaYin(), eight.getMonthNaYin(), eight.getDayNaYin(), eight.getTimeNaYin()],
    solarTerms: {
      current: previous.getName(), hou: lunar.getHou(), wuHou: lunar.getWuHou(),
      previousAt: formatSolar(previous.getSolar()),
      next: next.getName(),
      nextAt: formatSolar(next.getSolar()),
    },
    cycle: {
      monthBranch: eight.getMonth().slice(1), day: eight.getDay(), xun: lunar.getDayXun(),
      voidBranches: lunar.getDayXunKong().split("") as [string, string],
    },
    month: liuyaoMonth,
    dayOfficers: {
      officer: lunar.getZhiXing(),
      deity: lunar.getDayTianShen(),
      path: lunar.getDayTianShenType(),
    },
    mansion: {
      name: `${lunar.getXiu()}${lunar.getZheng()}${
        MANSION_ANIMAL_FIX[lunar.getAnimal()] ?? lunar.getAnimal()
      }`,
      palace: lunar.getGong(),
      guardian: lunar.getShou(),
    },
    clash: { description: lunar.getDayChongDesc(), direction: lunar.getDaySha() },
    almanac: {
      nineStar: lunar.getDayNineStar().toString(), joy: lunar.getDayPositionXiDesc(),
      wealth: lunar.getDayPositionCaiDesc(), fortune: lunar.getDayPositionFuDesc(),
      suitable: lunar.getDayYi(),
      avoid: lunar.getDayJi(),
      pengZu: [lunar.getPengZuGan(), lunar.getPengZuZhi()],
    },
  };
  assertCalendarConsistent(result, liuyaoDay.ganzhi);
  return result;
}

export function assertCalendarConsistent(
  result: AlmanacResult,
  expectedDay = deriveSexagenaryDay(BigInt(result.timestamp)).ganzhi,
): void {
  if (result.cycle.day !== expectedDay) {
    throw new Error(`历法不一致：黄历日干支${result.cycle.day}，六爻日干支${expectedDay}`);
  }
  // NOAA 近似算法在交节窗口内只给“近交节”提示；日干支仍须严格互校。
  if (!result.month.boundaryUncertain && result.cycle.monthBranch !== result.month.branch) {
    throw new Error(`历法不一致：黄历月建${result.cycle.monthBranch}，六爻月建${result.month.branch}`);
  }
}
