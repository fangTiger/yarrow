// web/lib/reading-state.ts
import type { PublicReading } from "./api.js";

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

export function shouldPollReading(reading: PublicReading): boolean {
  if (reading.status === "charting" || reading.status === "writing") {
    return true;
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
