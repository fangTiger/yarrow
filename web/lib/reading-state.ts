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
  // 单家重试、改事项或换日之后，总述会重写；写作中继续轮询。
  if (reading.summary?.status === "writing") {
    return true;
  }
  // 自动起卦期间轮询存档逐爻显示；暂停时等用户点「继续起卦」。
  if (reading.status === "awaiting-throws") {
    return !(reading.kind === "question" && reading.castPaused === true);
  }
  const states = reading.kind === "naming" ? Object.values(reading.families) : Object.values(reading.schools);
  return states.some((school) => {
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

export type SummaryStatus =
  | { kind: "progress"; text: string }
  | { kind: "done" }
  | { kind: "failed"; text: string; canRetry: boolean }
  | { kind: "none" };

/** 白话总述面板的状态：起卦、排盘、三家落笔进度、写总述、完成或未生成；旧存档没有总述时为 none。 */
export function summaryStatus(reading: AnyPublicReading): SummaryStatus {
  if (reading.status === "awaiting-throws") {
    return { kind: "progress", text: "起卦中" };
  }
  if (reading.status === "charting") {
    return { kind: "progress", text: "排盘中" };
  }
  const summary = reading.summary;
  if (summary?.status === "writing") {
    return { kind: "progress", text: "正在写白话总述" };
  }
  const states = (reading.kind === "naming" ? Object.values(reading.families) : Object.values(reading.schools))
    .map((school) => school.status);
  const finished = states.filter((status) => status !== "pending" && status !== "writing").length;
  if (finished < states.length) {
    return { kind: "progress", text: `三家落笔中（${finished}/${states.length}）` };
  }
  if (!summary) {
    return { kind: "none" };
  }
  if (summary.status === "done") {
    return { kind: "done" };
  }
  const canRetry = summary.basis > 0 && summary.retries < 2 && reading.status === "done";
  return { kind: "failed", text: summary.basis > 0 ? "白话总述暂未生成" : summary.error ?? "白话总述暂未生成", canRetry };
}
