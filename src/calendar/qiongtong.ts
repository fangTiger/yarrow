// src/calendar/qiongtong.ts
import { readFileSync } from "node:fs";
export interface QiongtongEntry {
  dayStem: string;
  monthBranch: string;
  monthName: string;
  useStems: string[];
  section: string;
  quote: string;
}
export function validateQiongtong(value: unknown): QiongtongEntry[] {
  if (!Array.isArray(value) || value.length !== 120) {
    throw new Error("调候表必须有 120 条");
  }
  const seen = new Set<string>();
  const stems = "甲乙丙丁戊己庚辛壬癸";
  const branches = "寅卯辰巳午未申酉戌亥子丑";
  const names = ["正月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月"];
  for (const row of value) {
    if (!row || typeof row !== "object") {
      throw new Error("调候条目不合法");
    }
    const { dayStem, monthBranch, monthName, useStems, section, quote } = row;
    const index = typeof monthBranch === "string" ? branches.indexOf(monthBranch) : -1;
    if (typeof dayStem !== "string" || dayStem.length !== 1 || !stems.includes(dayStem)
      || typeof monthBranch !== "string" || monthBranch.length !== 1 || index < 0
      || monthName !== names[index] || typeof section !== "string" || typeof quote !== "string"
      || !quote || !Array.isArray(useStems) || !useStems.length
      || new Set(useStems).size !== useStems.length
      || !useStems.every((s: unknown) => typeof s === "string" && s.length === 1
        && stems.includes(s) && quote.includes(s))) {
      throw new Error("调候字段或用干不合法");
    }
    const season = "春夏秋冬".charAt(Math.floor(index / 3));
    const element = "木木火火土土金金水水".charAt(stems.indexOf(dayStem));
    if (section !== `三${season}${dayStem}${element}`) {
      throw new Error("调候章节不合法");
    }
    const key = dayStem + monthBranch;
    if (seen.has(key)) {
      throw new Error("调候条目重复");
    }
    seen.add(key);
  }
  return value as QiongtongEntry[];
}
export function readQiongtong(): QiongtongEntry[] {
  const text = readFileSync(new URL("./data/qiongtong.json", import.meta.url), "utf8");
  return validateQiongtong(JSON.parse(text));
}
export function lookupQiongtong(dayStem: string, monthBranch: string): QiongtongEntry {
  const row = readQiongtong().find((r) => r.dayStem === dayStem && r.monthBranch === monthBranch);
  if (!row) {
    throw new Error("调候日干或月令不合法");
  }
  return row;
}
