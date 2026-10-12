import {
  assertCivilTime,
  civilFromMillis,
  civilMillis,
  type CivilTime,
} from "./solar-time.js";
export type { CivilTime } from "./solar-time.js";

export type TimeDisambiguation = "exact" | "ambiguous" | "skipped";

export interface LocalInstant {
  epochMilliseconds: number;
  offsetMinutes: number;
  disambiguation: TimeDisambiguation;
}

export interface BirthTimeBasis extends LocalInstant {
  standardOffsetMinutes: number;
  beijing: CivilTime;
  localStandard: CivilTime;
}

/** 节气交接时刻按北京标准时（UTC+8）给出。 */
const BEIJING_OFFSET_MINUTES = 480;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  let value: Intl.DateTimeFormat;
  try {
    value = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error(`出生地时区「${timeZone}」不是有效的 IANA 时区`);
  }
  formatters.set(timeZone, value);
  return value;
}

/** 把绝对时刻格式化为指定时区的钟面时间；只依赖运行时自带的 Intl。 */
export function civilInTimeZone(epochMilliseconds: number, timeZone: string): CivilTime {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(epochMilliseconds))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const civil = {
    year: values.year!, month: values.month!, day: values.day!,
    hour: values.hour!, minute: values.minute!, second: values.second!,
  };
  return civil;
}

function offsetAt(epochMilliseconds: number, timeZone: string): number {
  const wholeSecond = Math.trunc(epochMilliseconds / 1_000) * 1_000;
  return (civilMillis(civilInTimeZone(wholeSecond, timeZone)) - wholeSecond) / 60_000;
}

function sameCivil(left: CivilTime, right: CivilTime): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day
    && left.hour === right.hour && left.minute === right.minute && left.second === right.second;
}

/**
 * 把当地钟面反推为绝对时刻。先按 formatToParts 得到的偏移迭代两次，再用过渡
 * 前后的候选偏移核对钟面；重复与跳跃时段都按产品口径选择较早的绝对时刻。
 */
export function localToInstant(civil: CivilTime, timeZone: string): LocalInstant {
  assertCivilTime(civil);
  formatter(timeZone);
  const target = civilMillis(civil);
  let estimate = target;
  for (let pass = 0; pass < 2; pass += 1) {
    estimate = target - offsetAt(estimate, timeZone) * 60_000;
  }
  const offsets = new Set<number>();
  offsets.add(offsetAt(estimate, timeZone));
  // 前后 36 小时足以跨过民用时区过渡；六小时取样可同时发现过渡两侧的偏移。
  for (let hours = -36; hours <= 36; hours += 6) {
    offsets.add(offsetAt(estimate + hours * 3_600_000, timeZone));
  }
  const candidates = [...offsets]
    .map((offset) => ({ epochMilliseconds: target - offset * 60_000, offset }))
    .sort((left, right) => left.epochMilliseconds - right.epochMilliseconds);
  const exact = candidates.filter((candidate) => (
    sameCivil(civilInTimeZone(candidate.epochMilliseconds, timeZone), civil)
  ));
  const selected = exact[0] ?? candidates[0];
  if (!selected) throw new Error("出生地时区无法换算");
  return {
    epochMilliseconds: selected.epochMilliseconds,
    offsetMinutes: offsetAt(selected.epochMilliseconds, timeZone),
    disambiguation: exact.length > 1 ? "ambiguous" : exact.length === 0 ? "skipped" : "exact",
  };
}

/** 当地标准偏移：取当年一月一日与七月一日偏移中较小者，以去掉夏令时。 */
export function standardOffset(timeZone: string, year: number): number {
  formatter(timeZone);
  return Math.min(
    offsetAt(Date.UTC(year, 0, 1, 12, 0, 0), timeZone),
    offsetAt(Date.UTC(year, 6, 1, 12, 0, 0), timeZone),
  );
}

/** 同时给出节气用的北京标准时 A 与日时柱用的当地标准时 B。 */
export function birthTimeBasis(civil: CivilTime, timeZone: string): BirthTimeBasis {
  const resolved = localToInstant(civil, timeZone);
  const standardOffsetMinutes = standardOffset(timeZone, civil.year);
  return {
    ...resolved,
    standardOffsetMinutes,
    // A 固定为北京标准时 UTC+8：不借道 tzdb 的 Asia/Shanghai，免得 1940 年代与 1986–1991 年的
    // 中国夏令时、1901 年前的地方平时混进节气判断。
    beijing: civilFromMillis(resolved.epochMilliseconds + BEIJING_OFFSET_MINUTES * 60_000),
    localStandard: civilFromMillis(resolved.epochMilliseconds + standardOffsetMinutes * 60_000),
  };
}
