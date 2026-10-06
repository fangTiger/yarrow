// web/lib/reading-state.ts
import type { AnyPublicReading, PublicReading } from "./api.js";

export type ReadingStage = "awaiting-throws" | "charting" | "writing" | "done" | "failed";
type Schools = PublicReading["schools"];

export function readingStage(reading: PublicReading): ReadingStage {
  if (reading.status === "awaiting-throws") {
    return "awaiting-throws";
  }
  if (reading.status === "charting") {
    return "charting";
  }
  if (reading.status === "failed") {
    return "failed";
  }
  const states = Object.values(reading.schools).map((school) => school.status);
  if (states.some((status) => status === "pending" || status === "writing")) {
    return "writing";
  }
  return reading.status === "done" ? "done" : "writing";
}

export function shouldPollReading(reading: AnyPublicReading): boolean {
  if (reading.status === "charting" || reading.status === "writing") {
    return true;
  }
  // 自动起卦期间轮询存档逐爻显示；暂停时等用户点「继续起卦」。
  if (reading.status === "awaiting-throws") {
    return !(reading.kind === "question" && reading.castPaused === true);
  }
  return Object.values(reading.schools).some((school) => {
    return school.status === "pending" || school.status === "writing";
  });
}

export function consensusTenths(schools: Schools): number | undefined {
  const values = Object.values(schools).flatMap((school) => {
    return school.status === "done" && school.output
      ? [school.output.confidenceTenths]
      : [];
  });
  if (!values.length) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 删错留对后在卡片上给出的说明；没有删改时返回 null。 */
export function repairNote(state: { removed?: number; adjusted?: number }): string | null {
  const parts: string[] = [];
  if (state.removed && state.removed > 0) {
    parts.push(`已删去 ${state.removed} 处与盘面不符的内容`);
  }
  if (state.adjusted && state.adjusted > 0) {
    parts.push("几成已按吉凶等级校正");
  }
  return parts.length > 0 ? parts.join("；") : null;
}
