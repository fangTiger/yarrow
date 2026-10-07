// web/lib/birth-profile.ts
import { normalizeBirthProfile, type BirthProfileInput } from "../../src/sanyi/birth-profile.js";
export type { BirthProfileInput };

/** 首页内嵌生辰行的表单值：只收生辰八字所需的日期、时间（选填）与性别，不收出生地。 */
export interface BirthFormValues {
  calendar: "solar" | "lunar";
  year: string;
  month: string;
  day: string;
  isLeapMonth: boolean;
  /** 出生时间，选填；空串表示时辰不详，按年月日三柱排盘。 */
  time: string;
  gender: "male" | "female" | "";
}

/** 新用户从空白开始，不预填任何样例生日，避免误用。 */
export const EMPTY_BIRTH: BirthFormValues = {
  calendar: "solar", year: "", month: "", day: "", isLeapMonth: false,
  time: "", gender: "",
};

export const LUNAR_MONTHS = [
  "正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月",
] as const;

export const LUNAR_DAYS = Array.from({ length: 30 }, (_, index) => {
  const day = index + 1;
  const digits = "一二三四五六七八九十";
  if (day <= 10) {
    return `初${digits.charAt(day - 1)}`;
  }
  if (day < 20) {
    return `十${digits.charAt(day - 11)}`;
  }
  if (day === 20) {
    return "二十";
  }
  if (day < 30) {
    return `廿${digits.charAt(day - 21)}`;
  }
  return "三十";
});

/** 表单值转为服务端生辰输入；不合法时抛出中文原因。 */
export function toBirthInput(values: BirthFormValues): BirthProfileInput {
  if (!values.year.trim() || !values.month.trim() || !values.day.trim()) {
    throw new Error("请填写出生日期");
  }
  const time = values.time.trim();
  if (time !== "" && !/^\d{1,2}:\d{2}$/.test(time)) {
    throw new Error("出生时间格式不对，也可以留空");
  }
  if (values.gender === "") {
    throw new Error("请选择性别（用于排大运顺逆）");
  }
  const parts = time.split(":");
  const input: BirthProfileInput = {
    calendar: values.calendar,
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    isLeapMonth: values.calendar === "lunar" && values.isLeapMonth,
    time: time === "" ? null : { hour: Number(parts[0]), minute: Number(parts[1]) },
    gender: values.gender,
  };
  normalizeBirthProfile(input);
  return input;
}

/** 生辰是否可用：可用返回 null，否则返回第一条中文原因。 */
export function birthProblem(values: BirthFormValues): string | null {
  try {
    toBirthInput(values);
    return null;
  } catch (caught) {
    return caught instanceof Error ? caught.message : "请核对生辰";
  }
}

/** 服务端输入转回表单值；旧档案里的城市与经度在此丢弃。 */
export function fromBirthInput(input: BirthProfileInput): BirthFormValues {
  return {
    calendar: input.calendar,
    year: String(input.year),
    month: String(input.month),
    day: String(input.day),
    isLeapMonth: input.isLeapMonth,
    time: input.time ? `${pad(input.time.hour)}:${pad(input.time.minute)}` : "",
    gender: input.gender,
  };
}

/** 公历日期框的值（YYYY-MM-DD），年月日不全时为空串。 */
export function solarDateValue(values: BirthFormValues): string {
  if (!values.year || !values.month || !values.day) {
    return "";
  }
  return `${values.year.padStart(4, "0")}-${pad(Number(values.month))}-${pad(Number(values.day))}`;
}

/** 由公历日期框的值回填年月日；清空日期框时年月日一起清空。 */
export function withSolarDate(values: BirthFormValues, value: string): BirthFormValues {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { ...values, year: "", month: "", day: "" };
  }
  return { ...values, year: match[1]!, month: String(Number(match[2])), day: String(Number(match[3])) };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const KEY = "sanyi.birth.self.v1";
export type BirthStorage = Pick<Storage, "getItem" | "setItem">;

export function loadBirthProfile(storage?: BirthStorage): BirthProfileInput | null {
  try {
    const target = storage ?? globalThis.localStorage;
    const value = JSON.parse(target.getItem(KEY) ?? "null") as BirthProfileInput | null;
    if (!value) {
      return null;
    }
    normalizeBirthProfile(value);
    return toBirthInput(fromBirthInput(value));
  } catch {
    return null;
  }
}

/** 合法生辰直接存入本机，下次自动带出；存储不可用时静默跳过，不影响本次排盘。 */
export function saveBirthProfile(input: BirthProfileInput, storage?: BirthStorage): BirthProfileInput {
  normalizeBirthProfile(input);
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(KEY, JSON.stringify(input));
  } catch {
    // 保存失败不影响本次排盘。
  }
  return input;
}

export function birthSummary(input: BirthProfileInput): string {
  const time = input.time ? `${pad(input.time.hour)}:${pad(input.time.minute)}` : "未填时间";
  const leap = input.isLeapMonth ? "闰" : "";
  const calendar = input.calendar === "solar" ? "公历" : "农历";
  const gender = input.gender === "male" ? "男" : "女";
  return `${calendar} ${input.year}-${leap}${pad(input.month)}-${pad(input.day)} ${time} · ${gender}`;
}
