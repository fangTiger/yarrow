// src/sanyi/bazi-facts.ts
import lunarPkg from "lunar-javascript";
import type { BaziChart, BaziPillar, LiuNianEntry, LuckCycle } from "../calendar/bazi.js";
import type { BaziAnalysis } from "../calendar/bazi-relations.js";
import type { QiongtongEntry } from "../calendar/qiongtong.js";
import type { FactTable } from "./facts.js";
function hiddenTokens(hidden: BaziPillar["hidden"]): string[] {
  return hidden.flatMap((item) => [item.stem, item.god]);
}
function luckTokens(luck: LuckCycle): string[] {
  return [luck.ganZhi, luck.ganZhi.charAt(0), luck.ganZhi.charAt(1), luck.stemGod];
}
function yearTokens(year: LiuNianEntry): string[] {
  const tokens = [year.ganZhi, year.stem, year.branch, year.stemGod, ...hiddenTokens(year.hidden)];
  if (year.luck) {
    tokens.push(...luckTokens(year.luck));
  }
  return tokens;
}
function scopedTokens(analysis: Pick<BaziAnalysis, "relations" | "shensha" | "nodes">): string[] {
  return [...analysis.relations.map((relation) => relation.label),
    ...analysis.shensha.map((item) => item.name)];
}
export function buildBaziFacts(chart: BaziChart, analysis: BaziAnalysis, tiaohou: QiongtongEntry): FactTable {
  const facts: FactTable = new Map();
  function add(id: string, label: string, tokens: readonly string[]): void {
    facts.set(id, { id, label, tokens: new Set(tokens) });
  }
  const pillars = Object.values(chart.pillars).filter((pillar) => pillar !== null);
  for (const pillar of pillars) {
    add(`pillar:${pillar.key}`, `${pillar.label} ${pillar.ganZhi} ${pillar.stemGod}`, [
      pillar.ganZhi, pillar.stem, pillar.branch, pillar.stemGod,
    ]);
    const tokens = hiddenTokens(pillar.hidden);
    add(`hidden:${pillar.key}`, `${pillar.label}藏干 ${tokens.join(" ")}`, tokens);
  }
  // 固定排序编号，保证同一派生命盘多次构建时 ref 可复算；label 保留范围和节点供隔离审查。
  const relations = [...analysis.relations].sort((left, right) => left.id.localeCompare(right.id, "en"));
  for (const [index, relation] of relations.entries()) {
    add(`relation:${index + 1}`,
      `${relation.scope} ${relation.nodeIds.join(",")} ${relation.label}`, [relation.label]);
  }
  const shensha = [...analysis.shensha].sort((left, right) => {
    const leftKey = `${left.nodeId}:${left.name}:${left.basis}`;
    const rightKey = `${right.nodeId}:${right.name}:${right.basis}`;
    return leftKey.localeCompare(rightKey, "en");
  });
  for (const [index, item] of shensha.entries()) {
    add(`shensha:${index + 1}`, `${item.nodeId} ${item.name} 依据${item.basis}`, [item.name]);
  }
  for (const luck of chart.luck?.cycles ?? []) {
    add(`luck:${luck.index}`, `大运 ${luck.ganZhi} ${luck.startYear}–${luck.endYear}`, luckTokens(luck));
  }
  const current = chart.annual?.currentLuck;
  if (current) {
    add("luck:current", `当前大运 ${current.ganZhi}`, luckTokens(current));
  }
  for (const year of chart.liunian.years) {
    const detail = analysis.years.find((item) => item.year === year.year);
    if (!detail) {
      throw new Error(`缺少 ${year.year} 年的关系分析`);
    }
    const tokens = [...yearTokens(year), ...scopedTokens(detail)];
    const label = `${year.year} 年 ${tokens.join(" ")}`;
    add(`year:${year.year}`, label, tokens);
    if (year.year === chart.liunian.anchorYear) {
      add("year:anchor", label, tokens);
    }
  }
  const year = chart.liunian.anchorYear;
  const terms = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露",
    "寒露", "立冬", "大雪", "小寒", "立春"];
  const dates = new Map<string, string>();
  for (const civilYear of [year, year + 1]) {
    const table = lunarPkg.Solar.fromYmd(civilYear, 7, 1).getLunar().getJieQiTable();
    for (const [name, solar] of Object.entries(table)) {
      dates.set(`${solar.getYear()}:${name}`, solar.toYmdHms());
    }
  }
  const names = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月",
    "九月", "十月", "冬月", "腊月"];
  for (const month of chart.annual?.months ?? []) {
    const index = month.index - 1;
    const startYear = index === 11 ? year + 1 : year;
    const endYear = index >= 10 ? year + 1 : year;
    const start = dates.get(`${startYear}:${terms[index]}`);
    const end = dates.get(`${endYear}:${terms[index + 1]}`);
    let range = "";
    if (start && end) {
      range = ` 节气月[${start}, ${end}) 北京时间`;
    }
    add(`liuyue:${month.index}`, `${names[index]} ${month.ganZhi} ${month.stemGod}${range}`,
      [month.ganZhi, month.ganZhi.charAt(0), month.ganZhi.charAt(1), month.stemGod]);
  }
  add("tiaohou", `${tiaohou.section} 用干${tiaohou.useStems.join("、")}`, [...tiaohou.useStems,
    tiaohou.section]);
  add("elements", analysis.elements.map((item) => {
    return `${item.element} 天干${item.stem} 本气${item.main} 中气${item.middle} 余气${item.residual}`;
  }).join("；"), analysis.elements.map((item) => item.element));
  const stems = pillars.map((pillar) => pillar.stem);
  const monthMain = chart.pillars.month.hidden[0];
  if (monthMain) {
    const exposed = stems.includes(monthMain.stem) ? "已透干" : "未透干";
    add("structure:month", `月令本气 ${monthMain.stem} ${monthMain.god} ${exposed}`, [monthMain.stem,
      monthMain.god]);
  }
  const roots = pillars.map((pillar) => {
    const exposed = pillar.hidden.filter((item) => stems.includes(item.stem)).map((item) => item.stem);
    return `${pillar.label}藏干透出 ${exposed.join("、") || "无"}`;
  });
  const sameElement = "甲乙 丙丁 戊己 庚辛 壬癸".split(" ").find((pair) => pair.includes(chart.dayMaster));
  const rootPillars = pillars.filter((pillar) => {
    return pillar.hidden.some((item) => sameElement?.includes(item.stem));
  });
  add("structure:roots", [...roots, `日主同五行通根 ${rootPillars.map((pillar) => pillar.label).join("、") || "无"}`]
    .join("；"), [...stems, ...pillars.flatMap((pillar) => hiddenTokens(pillar.hidden))]);
  // 限制也使用事实编号，方便请求级 mock 和核对器共同识别缺时柱。
  if (!chart.pillars.time) {
    add("chart:limit", "时辰未知，缺时柱，判断存在限制", []);
  }
  return facts;
}
export function isNatalFact(id: string, label: string): boolean {
  return id.startsWith("pillar:") || id.startsWith("hidden:") || id === "tiaohou"
    || (id.startsWith("relation:") && label.startsWith("natal "));
}
