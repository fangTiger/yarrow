// web/lib/birth-profile.ts
import { normalizeBirthProfile, type BirthProfileInput } from "../../src/sanyi/birth-profile.js";
export type { BirthProfileInput };
export interface BirthFormValues {
    calendar: "solar" | "lunar";
    year: string;
    month: string;
    day: string;
    isLeapMonth: boolean;
    time: string;
    unknownTime: boolean;
    gender: "male" | "female";
    placeMode: "city" | "longitude";
    city: string;
    longitude: string;
}
export const EMPTY_BIRTH: BirthFormValues = {
    calendar: "solar", year: "1990", month: "5", day: "15", isLeapMonth: false,
    time: "15:30", unknownTime: false, gender: "male", placeMode: "city", city: "", longitude: "",
};
export function toBirthInput(values: BirthFormValues): BirthProfileInput {
    const parts = values.time.split(":");
    const input: BirthProfileInput = {
        calendar: values.calendar, year: Number(values.year), month: Number(values.month), day: Number(values.day),
        isLeapMonth: values.calendar === "lunar" && values.isLeapMonth,
        time: values.unknownTime ? null : { hour: Number(parts[0]), minute: Number(parts[1]) }, gender: values.gender,
    };
    if (values.placeMode === "city" && values.city) {
        input.city = values.city;
    }
    if (values.placeMode === "longitude" && values.longitude.trim()) {
        input.longitude = Number(values.longitude);
    }
    normalizeBirthProfile(input);
    return input;
}
export function fromBirthInput(input: BirthProfileInput): BirthFormValues {
    return {
        calendar: input.calendar, year: String(input.year), month: String(input.month), day: String(input.day),
        isLeapMonth: input.isLeapMonth, time: input.time ? `${pad(input.time.hour)}:${pad(input.time.minute)}` : "",
        unknownTime: input.time === null, gender: input.gender,
        placeMode: input.longitude === undefined ? "city" : "longitude", city: input.city ?? "",
        longitude: input.longitude === undefined ? "" : String(input.longitude),
    };
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
    }
    catch {
        return null;
    }
}
export function useBirthProfile(input: BirthProfileInput, remember: boolean, storage?: BirthStorage): BirthProfileInput {
    normalizeBirthProfile(input);
    if (remember) {
        try {
            const target = storage ?? globalThis.localStorage;
            target.setItem(KEY, JSON.stringify(input));
        }
        catch {
            // 记住失败不影响本次排盘。
        }
    }
    return input;
}
export function birthSummary(input: BirthProfileInput): string {
    const time = input.time ? `${pad(input.time.hour)}:${pad(input.time.minute)}` : "不知道时辰";
    let place = input.city ?? "未填出生地";
    if (input.longitude !== undefined) {
        place = `经度 ${input.longitude}°`;
    }
    const leap = input.isLeapMonth ? "闰" : "";
    return `${input.calendar === "solar" ? "公历" : "农历"} ${input.year}-${leap}${pad(input.month)}-${pad(input.day)} ${time} · ${input.gender === "male" ? "男" : "女"} · ${place}`;
}
