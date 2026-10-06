// src/calendar/solar-time.ts
export interface CivilTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}
export interface CorrectionStep {
  kind: "dst" | "solar";
  applied: boolean;
  before: CivilTime | null;
  deltaMinutes: number;
  after: CivilTime | null;
  description: string;
}
export interface CorrectedBirthTime {
  effective: CivilTime;
  timeKnown: boolean;
  longitudeMinutes: number;
  equationMinutes: number;
  steps: readonly CorrectionStep[];
}

export function civilMillis(value: CivilTime): number {
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
}
export function civilFromMillis(value: number): CivilTime {
  const date = new Date(value);
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
  };
}
export function assertCivilTime(value: CivilTime): void {
  if (Object.values(value).some((part) => !Number.isInteger(part))) {
    throw new Error("出生日期与时间必须为整数");
  }
  if (value.year < 1900 || value.year > 2099) {
    throw new Error("出生年份仅支持 1900–2099 年");
  }
  const actual = civilFromMillis(civilMillis(value));
  if (Object.keys(value).some((key) => value[key as keyof CivilTime] !== actual[key as keyof CivilTime])) {
    throw new Error("出生日期或时间不合法");
  }
}
export function assertLongitude(value: number): void {
  if (!Number.isFinite(value) || value < 73 || value > 135) {
    throw new Error("经度须在 73°–135° 之间");
  }
}

const dates = [
  [1986, 5, 4, 9, 14], [1987, 4, 12, 9, 13], [1988, 4, 17, 9, 11],
  [1989, 4, 16, 9, 17], [1990, 4, 15, 9, 16], [1991, 4, 14, 9, 15],
] as const;
// 来源：本任务经 Asia/Shanghai 系统时区数据库核验的六年表。
export const DST_RANGES = dates.map(([year, sm, sd, em, ed]) => ({
  year,
  start: { year, month: sm, day: sd, hour: 2, minute: 0, second: 0 },
  end: { year, month: em, day: ed, hour: 2, minute: 0, second: 0 },
}));

export function daylightSavingAt(value: CivilTime): {
  active: boolean;
  repeated: boolean;
  skipped: boolean;
} {
  const row = DST_RANGES.find((item) => item.year === value.year);
  if (!row) {
    return { active: false, repeated: false, skipped: false };
  }
  const current = civilMillis(value);
  const start = civilMillis(row.start);
  const end = civilMillis(row.end);
  return {
    active: current >= start && current < end,
    repeated: current >= end - 3_600_000 && current < end,
    skipped: current >= start && current < start + 3_600_000,
  };
}

// 来源：NOAA Solar Calculator 的 calcEquationOfTime，采用完整儒略日而非表格近似。
export function equationOfTimeMinutes(standard: CivilTime): number {
  const utc = civilMillis(standard) - 8 * 3_600_000;
  const jd = utc / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525;
  const rad = Math.PI / 180;
  const l0 = (280.46646 + t * (36_000.76983 + t * 0.0003032)) * rad;
  const m = (357.52911 + t * (35_999.05029 - t * 0.0001537)) * rad;
  const e = 0.016708634 - t * (0.000042037 + t * 0.0000001267);
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const mean = 23 + (26 + seconds / 60) / 60;
  const obliquity = (mean + 0.00256 * Math.cos((125.04 - 1934.136 * t) * rad)) * rad;
  const y = Math.tan(obliquity / 2) ** 2;
  const equation = y * Math.sin(2 * l0) - 2 * e * Math.sin(m)
    + 4 * e * y * Math.sin(m) * Math.cos(2 * l0)
    - 0.5 * y * y * Math.sin(4 * l0) - 1.25 * e * e * Math.sin(2 * m);
  return 4 * equation / rad;
}

export function correctBirthTime(
  original: CivilTime,
  timeKnown: boolean,
  longitude: number | null,
  options = { mainlandDst: true, birthplace: null as string | null },
): CorrectedBirthTime {
  assertCivilTime(original);
  if (longitude !== null) {
    assertLongitude(longitude);
  }
  if (!timeKnown) {
    const steps: CorrectionStep[] = ["dst", "solar"].map((kind) => ({
      kind: kind as CorrectionStep["kind"], applied: false, before: null, after: null,
      deltaMinutes: 0, description: "时辰未知，未校正；三柱以当日正午为代表",
    }));
    return {
      effective: { ...original, hour: 12, minute: 0, second: 0 }, timeKnown,
      longitudeMinutes: 0, equationMinutes: 0, steps,
    };
  }
  const dst = options.mainlandDst
    ? daylightSavingAt(original)
    : { active: false, repeated: false, skipped: false };
  const delta = dst.active ? -60 : 0;
  const standard = civilFromMillis(civilMillis(original) + delta * 60_000);
  const longitudeMinutes = longitude === null ? 0 : (longitude - 120) * 4;
  const equationMinutes = longitude === null ? 0 : equationOfTimeMinutes(standard);
  const solarDelta = longitudeMinutes + equationMinutes;
  const effective = civilFromMillis(civilMillis(standard) + Math.round(solarDelta * 60_000));
  assertCivilTime(effective);
  const descriptions = [dst.active ? "已按夏令时减 1 小时" : "不在中国夏令时区间，未校正"];
  if (!options.mainlandDst) {
    descriptions.splice(0, 1,
      `出生地为${options.birthplace}，未按中国大陆夏令时校正；当地历史夏令时请按出生记录自行核对`);
  } else if (options.birthplace === null && longitude === null && dst.active) {
    // 产品不收出生地，统一按中国大陆夏令时口径说明。
    descriptions.push("按中国大陆夏令时");
  }
  if (dst.repeated) {
    descriptions.push("重复时段，按夏令时计");
  }
  if (dst.skipped) {
    descriptions.push("钟表跳跃时段，按夏令时边界计，请核对出生记录");
  }
  return {
    effective, timeKnown, longitudeMinutes, equationMinutes,
    steps: [
      {
        kind: "dst", applied: dst.active, before: { ...original }, deltaMinutes: delta,
        after: standard, description: descriptions.join("；"),
      },
      {
        kind: "solar", applied: longitude !== null, before: standard,
        deltaMinutes: solarDelta, after: effective,
        description: longitude === null
          ? "未作真太阳时校正"
          : `经度差 ${longitudeMinutes.toFixed(2)} 分钟；均时差 ${equationMinutes.toFixed(2)} 分钟`,
      },
    ],
  };
}
