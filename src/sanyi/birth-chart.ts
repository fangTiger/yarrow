import { birthTimeBasis, type TimeDisambiguation } from "../calendar/birth-instant.js";
import { buildBaziChart, type BaziChart } from "../calendar/bazi.js";
import { correctBirthTime } from "../calendar/solar-time.js";
import { normalizeBirthProfile } from "./birth-profile.js";

export interface BirthCorrectionSummary {
  dst: "applied" | "not-applied" | "skipped-region";
  solar: "applied" | "not-applied";
  timeKnown: boolean;
  sect: 1 | 2;
  /** 仅海外新路径存储；中国旧路径省略，确保既有结果逐字节不变。 */
  timeZone?: string;
  localStandard?: string;
  disambiguation?: TimeDisambiguation;
}

function timeText(value: {
  hour: number;
  minute: number;
}): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(value.hour)}:${pad(value.minute)}`;
}

/** 生辰统一入口：中国沿用旧校正；海外采用 A（北京钟面）/B（当地标准时）
 * 拆分。 */
export function buildBirthChart(
  birth: unknown,
  sect: 1 | 2,
  targetYear: number,
): { chart: BaziChart; correction: BirthCorrectionSummary } {
  const profile = normalizeBirthProfile(birth);
  if (profile.timeZone === "Asia/Shanghai") {
    const corrected = correctBirthTime(profile.civil, profile.timeKnown, profile.longitude,
      { mainlandDst: profile.mainlandDst, birthplace: profile.birthplace });
    const chart = buildBaziChart({ corrected: corrected.effective, gender: profile.gender,
      timeKnown: profile.timeKnown, sect, targetYear });
    let dst: BirthCorrectionSummary["dst"] = "not-applied";
    if (!profile.mainlandDst) {
      dst = "skipped-region";
    } else if (corrected.steps.some((step) => step.kind === "dst" && step.applied)) {
      dst = "applied";
    }
    const solar = corrected.steps.some((step) => step.kind === "solar" && step.applied)
      ? "applied" as const : "not-applied" as const;
    return { chart, correction: { dst, solar, timeKnown: profile.timeKnown, sect } };
  }
  const basis = birthTimeBasis(profile.civil, profile.timeZone);
  // A 已是北京标准时（UTC+8），直接交给年柱、月柱与起运；不再套任何夏令时校正。
  const chart = buildBaziChart({
    corrected: basis.localStandard,
    yearMonth: basis.beijing,
    gender: profile.gender,
    timeKnown: profile.timeKnown,
    sect,
    targetYear,
  });
  return {
    chart,
    correction: {
      dst: basis.offsetMinutes === basis.standardOffsetMinutes ? "not-applied" : "applied",
      solar: "not-applied",
      timeKnown: profile.timeKnown,
      sect,
      timeZone: profile.timeZone,
      localStandard: timeText(basis.localStandard),
      disambiguation: basis.disambiguation,
    },
  };
}
