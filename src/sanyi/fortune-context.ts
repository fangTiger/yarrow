// src/sanyi/fortune-context.ts
import lunarPkg from "lunar-javascript";
import type { BaziChart } from "../calendar/bazi.js";
import { findRelations, makeNodes } from "../calendar/bazi-relations.js";
import type { FortuneHorizon } from "./classify.js";
import type { FactTable } from "./facts.js";
export interface FortuneContext {
  horizon: FortuneHorizon;
  anchorYear: number;
  label: string;
  ganZhi: string | null;
}
export function resolveFortuneContext(
  horizon: FortuneHorizon,
  clock: () => Date,
  sect: 1 | 2,
): FortuneContext {
  const now = clock();
  if (!Number.isFinite(now.getTime()) || (sect !== 1 && sect !== 2)) {
    throw new Error("提问时刻或换日口径无效");
  }
  const local = new Date(now.getTime() + 8 * 3_600_000);
  const civilYear = local.getUTCFullYear();
  const eight = lunarPkg.Solar.fromYmdHms(civilYear, local.getUTCMonth() + 1,
    local.getUTCDate(), local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds())
    .getLunar().getEightChar();
  eight.setSect(sect);
  const table = lunarPkg.Solar.fromYmd(civilYear, 7, 1).getLunar().getJieQiTable();
  const lichun = table["立春"];
  if (!lichun) {
    throw new Error("节气表缺少立春");
  }
  const boundary = Date.parse(lichun.toYmdHms().replace(" ", "T") + "+08:00");
  let anchorYear = civilYear;
  if (now.getTime() < boundary) {
    anchorYear -= 1;
  }
  if (horizon === "next-year") {
    anchorYear += 1;
  }
  if (horizon.startsWith("year:")) {
    if (!/^year:(19|20)\d{2}$/.test(horizon)) {
      throw new Error("指定年份无效");
    }
    anchorYear = Number(horizon.slice(5));
  }
  if (anchorYear < 1900 || anchorYear > 2099) {
    throw new Error("所问立春年超出支持范围");
  }
  let ganZhi: string | null = null;
  let label = `${anchorYear} 立春年`;
  if (horizon === "today") {
    ganZhi = eight.getDay();
    label = `今日 ${local.toISOString().slice(0, 10)} ${ganZhi}（北京时间）`;
  }
  if (horizon === "month") {
    ganZhi = eight.getMonth();
    label = `当前节气月 ${ganZhi}（北京时间）`;
  }
  return { horizon, anchorYear, label, ganZhi };
}
export function periodFacts(context: FortuneContext, chart: BaziChart): FactTable {
  const facts: FactTable = new Map();
  if (!context.ganZhi) {
    return facts;
  }
  const gz = context.ganZhi;
  const stem = gz.charAt(0);
  const branch = gz.charAt(1);
  const god = lunarPkg.LunarUtil.SHI_SHEN[chart.dayMaster + stem];
  if (!god) {
    throw new Error("流日或流月十神缺失");
  }
  const nodes = makeNodes(chart, null, gz);
  const relations = findRelations(nodes).filter((relation) => {
    return relation.nodeIds.some((id) => id.startsWith("year."));
  });
  const tokens = [gz, stem, branch, god, ...relations.map((relation) => relation.label)];
  const id = context.horizon === "today" ? "period:day" : "period:month";
  facts.set(id, { id, label: `${context.label} ${tokens.join(" ")}`, tokens: new Set(tokens) });
  return facts;
}
