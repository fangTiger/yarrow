// src/sanyi/facts.ts
import type { FiveHexagrams, LiuyaoChart } from "../oracle/liuyao-chart.js";
import type { MeihuaResult } from "../calendar/meihua.js";
import type { OracleSelection } from "../calendar/bianzhan.js";
export interface Fact { id: string; label: string; tokens: ReadonlySet<string> }
export type FactTable = Map<string, Fact>;
type TokenValue = string | null | undefined | false;

function words(values: readonly TokenValue[]): Set<string> {
  return new Set(
    values.filter((value): value is string => typeof value === "string" && value.length > 0),
  );
}

function stemOf(stemBranch: string): string {
  return stemBranch.slice(0, 1);
}

export function buildQuestionFacts(
  chart: LiuyaoChart,
  five: FiveHexagrams,
  meihua: MeihuaResult,
  main: OracleSelection,
): FactTable {
  const facts: FactTable = new Map();
  for (const row of chart.rows) {
    const tokens = words([
      row.primary.stemBranch,
      stemOf(row.primary.stemBranch),
      row.primary.branch,
      row.primary.element,
      row.primary.relation,
      row.sixSpirit,
      row.marker,
      row.primary.strength,
      row.primary.isVoid && "旬空",
      row.primary.isMonthBroken && "月破",
      row.isDayBroken && "日破",
      row.isHiddenMoving && "暗动",
      row.changing && "动",
      row.changing && row.changed.stemBranch,
      row.changing && stemOf(row.changed.stemBranch),
      row.changing && row.changed.branch,
      row.changing && row.changed.element,
      row.changing && row.changed.relation,
      row.returnEffect,
      row.advanceRetreat,
      row.hidden && "伏",
      row.hidden?.stemBranch,
      row.hidden && stemOf(row.hidden.stemBranch),
      row.hidden?.stemBranch.slice(1),
      row.hidden?.element,
      row.hidden?.relation,
    ]);
    const id = `line:${row.position}`;
    facts.set(id, { id, label: `${row.position}爻：${[...tokens].join(" ")}`, tokens });
  }
  const add = (id: string, label: string, tokens: readonly string[]): void => {
    facts.set(id, { id, label, tokens: new Set(tokens) });
  };
  add("month", `月建${chart.month.branch}`, [chart.month.branch, chart.month.element, "月建"]);
  add(
    "day",
    `日辰${chart.day.ganzhi}，旬空${chart.day.voidBranches.join("")}`,
    [chart.day.ganzhi, chart.day.stem, chart.day.branch, ...chart.day.voidBranches, "旬空"],
  );
  if (chart.focus) {
    add("use-god", `用神${chart.focus.useGod}`, [
      "用神",
      chart.focus.useGod,
      "原神",
      chart.focus.originalGod,
      "忌神",
      chart.focus.tabooGod,
      "仇神",
      chart.focus.enemyGod,
    ]);
  }
  add("body-use", `${meihua.body.name}为体，${meihua.use.name}为用`, [
    "体",
    meihua.body.name,
    meihua.body.element,
    "用",
    meihua.use.name,
    meihua.use.element,
    meihua.bodyUseRelation,
  ]);
  const keys = ["primary", "derived", "mutual", "opposite", "reversed"] as const;
  for (const key of keys) {
    add(`hexagram:${key}`, five[key].name, [five[key].name]);
  }
  add("main-text", `${main.primary.label}：${main.primary.text}`, [main.primary.label]);
  return facts;
}
