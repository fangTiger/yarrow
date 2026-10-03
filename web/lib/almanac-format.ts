import type { AlmanacResult } from "../../src/calendar/almanac.js";

export function formatClash(value: AlmanacResult["clash"]): string {
  const clash = value.description.replace(/^\(([^)]+)\)(.+)$/u, "$2（$1）");
  return `冲${clash}煞${value.direction}`;
}
