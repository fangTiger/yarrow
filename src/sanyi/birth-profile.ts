// src/sanyi/birth-profile.ts
import lunarPkg from "lunar-javascript";
import { readCities } from "../calendar/cities.js";
import { assertCivilTime, assertLongitude, type CivilTime } from "../calendar/solar-time.js";

export interface BirthProfileInput {
  calendar: "solar" | "lunar";
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  time: { hour: number; minute: number } | null;
  gender: "male" | "female";
  city?: string;
  longitude?: number;
}
export interface NormalizedBirthProfile {
  civil: CivilTime;
  timeKnown: boolean;
  gender: "male" | "female";
  longitude: number | null;
  mainlandDst: boolean;
  birthplace: string | null;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("生辰必须为对象");
  }
  return value as Record<string, unknown>;
}
function integer(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}须为 ${min}–${max} 的整数`);
  }
  return value;
}

export function normalizeBirthProfile(input: unknown): NormalizedBirthProfile {
  const body = record(input);
  const calendar = body.calendar;
  if (calendar !== "solar" && calendar !== "lunar") {
    throw new Error("历法须为公历或农历");
  }
  const gender = body.gender;
  if (gender !== "male" && gender !== "female") {
    throw new Error("性别须为男或女，用于确定大运顺逆");
  }
  if (typeof body.isLeapMonth !== "boolean") {
    throw new Error("须明确是否闰月");
  }
  if (calendar === "solar" && body.isLeapMonth) {
    throw new Error("公历不能选择农历闰月");
  }
  let year = integer(body.year, "出生年份", 1900, 2099);
  let month = integer(body.month, "出生月份", 1, 12);
  let day = integer(body.day, "出生日期", 1, 31);
  const timeKnown = body.time !== null;
  const time = timeKnown ? record(body.time) : null;
  const hour = time ? integer(time.hour, "小时", 0, 23) : 12;
  const minute = time ? integer(time.minute, "分钟", 0, 59) : 0;
  if (calendar === "lunar") {
    try {
      if (body.isLeapMonth && lunarPkg.LunarYear.fromYear(year).getLeapMonth() !== month) {
        throw new Error("所选农历闰月不存在");
      }
      const signedMonth = body.isLeapMonth ? -month : month;
      const lunarMonth = lunarPkg.LunarMonth.fromYm(year, signedMonth);
      if (!lunarMonth || day > lunarMonth.getDayCount()) {
        throw new Error("农历日期不合法");
      }
      const solar = lunarPkg.Lunar.fromYmd(year, signedMonth, day).getSolar();
      year = solar.getYear();
      month = solar.getMonth();
      day = solar.getDay();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      throw new Error(/[\u4e00-\u9fff]/.test(message) ? message : "农历日期不合法");
    }
  }
  const civil = { year, month, day, hour, minute, second: 0 };
  assertCivilTime(civil);
  let longitude: number | null = null;
  if (body.city !== undefined && body.longitude !== undefined) {
    throw new Error("出生城市与手填经度只能选择一种");
  }
  if (body.city !== undefined) {
    const city = readCities().find((item) => item.name === body.city);
    if (!city) {
      throw new Error("出生城市不在内置城市表中");
    }
    longitude = city.longitude;
  }
  if (body.longitude !== undefined) {
    if (typeof body.longitude !== "number") {
      throw new Error("经度须为数字");
    }
    assertLongitude(body.longitude);
    longitude = body.longitude;
  }
  return { civil, timeKnown, gender, longitude,
    mainlandDst: !["香港", "澳门", "台北"].includes(String(body.city)),
    birthplace: typeof body.city === "string" ? body.city : null };
}
