// src/calendar/bazi-relations.ts
import type { BaziChart, LuckCycle } from "./bazi.js";
export type Scope = "natal" | "luck" | "year";
export interface RelationNode {
  id: string;
  label: string;
  type: "stem" | "branch";
  value: string;
  scope: Scope;
}
export interface BaziRelation {
  id: string;
  kind: string;
  label: string;
  nodeIds: string[];
  scope: Scope;
}
export interface Shensha {
  name: string;
  nodeId: string;
  basis: string;
}
const stemPairs = { 合: "甲己 乙庚 丙辛 丁壬 戊癸", 冲: "甲庚 乙辛 丙壬 丁癸" };
const branchPairs = {
  合: "子丑 寅亥 卯戌 辰酉 巳申 午未", 冲: "子午 丑未 寅申 卯酉 辰戌 巳亥",
  害: "子未 丑午 寅巳 卯辰 申亥 酉戌", 破: "子酉 午卯 巳申 寅亥 辰丑 戌未",
  刑: "寅巳 巳申 申寅 丑戌 戌未 未丑 子卯", 自刑: "辰辰 午午 酉酉 亥亥",
};
const combinations = [["申子辰", "水"], ["亥卯未", "木"], ["寅午戌", "火"], ["巳酉丑", "金"]] as const;
const meetings = [["寅卯辰", "木"], ["巳午未", "火"], ["申酉戌", "金"], ["亥子丑", "水"]] as const;
function scopeOf(nodes: RelationNode[]): Scope {
  if (nodes.some((n) => n.scope === "year")) {
    return "year";
  }
  if (nodes.some((n) => n.scope === "luck")) {
    return "luck";
  }
  return "natal";
}
export function makeNodes(chart: BaziChart, luck: LuckCycle | null, ganZhi: string | null): RelationNode[] {
  const nodes: RelationNode[] = [];
  function add(id: string, label: string, gz: string, scope: Scope): void {
    for (const type of ["stem", "branch"] as const) {
      nodes.push({ id: `${id}.${type}`, label: `${label}${type === "stem" ? "干" : "支"}`,
        value: gz.charAt(type === "stem" ? 0 : 1), type, scope });
    }
  }
  for (const p of Object.values(chart.pillars)) {
    if (p) {
      add(`natal.${p.key}`, p.label, p.ganZhi, "natal");
    }
  }
  if (luck) {
    add("luck", "大运", luck.ganZhi, "luck");
  }
  if (ganZhi) {
    add("year", "流年", ganZhi, "year");
  }
  return nodes;
}
export function findRelations(nodes: RelationNode[]): BaziRelation[] {
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length) {
    throw new Error("关系节点编号重复");
  }
  const result: BaziRelation[] = [];
  const full: BaziRelation[] = [];
  function add(kind: string, members: RelationNode[], label: string): void {
    const nodeIds = members.map((n) => n.id);
    result.push({ id: `${kind}:${nodeIds.join(":")}`, kind, label, nodeIds, scope: scopeOf(members) });
  }
  for (const [kind, groups] of [["三合", combinations], ["三会", meetings]] as const) {
    for (const [group, element] of groups) {
      // 每字仅选一个节点：优先原局、再运、再年。原局成局不因重复字另列。
      const members = [...group].map((b) => nodes.find((n) => n.type === "branch" && n.value === b));
      if (members.every((n): n is RelationNode => n !== undefined)) {
        add(kind, members, `${group}${kind}${element}`);
        if (kind === "三合") {
          full.push(result[result.length - 1]!);
        }
      }
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (!a) {
      continue;
    }
    for (const b of nodes.slice(i + 1)) {
      if (a.type !== b.type) {
        continue;
      }
      const pair = a.value + b.value;
      const reverse = b.value + a.value;
      for (const [kind, pairs] of Object.entries(a.type === "stem" ? stemPairs : branchPairs)) {
        // 标签采用关系表的原对顺序，与节点遍历顺序无关。
        const canonical = pairs.split(" ").find((p) => p === pair || p === reverse);
        if (canonical) {
          add(kind, [a, b], canonical + kind);
        }
      }
      if (a.type !== "branch" || a.value === b.value) {
        continue;
      }
      for (const [group, element] of combinations) {
        if (!group.includes(a.value) || !group.includes(b.value)) {
          continue;
        }
        // 只省略已列三合中同范围的成员对；原局半合不能被运年成局吞掉。
        const covered = full.some((relation) => {
          return relation.label === `${group}三合${element}`
            && relation.scope === scopeOf([a, b])
            && relation.nodeIds.includes(a.id) && relation.nodeIds.includes(b.id);
        });
        if (covered) {
          continue;
        }
        const kind = a.value === group.charAt(1) || b.value === group.charAt(1) ? "半合" : "拱";
        const orderedPair = [...group].filter((value) => value === a.value || value === b.value).join("");
        add(kind, [a, b], `${orderedPair}${kind}${element}`);
      }
    }
  }
  return result;
}
// 出处：《三命通会》论神煞诸篇。仅按指定基准查表，不推导吉凶。
const stemRules = {
  天乙贵人: ["丑未", "子申", "亥酉", "亥酉", "丑未", "子申", "丑未", "寅午", "巳卯", "巳卯"],
  文昌: ["巳", "午", "申", "酉", "申", "酉", "亥", "子", "寅", "卯"],
  禄神: ["寅", "卯", "巳", "午", "巳", "午", "申", "酉", "亥", "子"],
  // 阴干羊刃古说有分歧，产品只取阳干，阴干留空。
  羊刃: ["卯", "", "午", "", "午", "", "酉", "", "子", ""],
};
const branchRules = { 桃花: "酉卯午子", 驿马: "寅申亥巳", 华盖: "辰戌丑未" };
export function findShensha(chart: BaziChart, nodes: RelationNode[]): Shensha[] {
  const result: Shensha[] = [];
  function collect(name: string, targets: string, basis: string): void {
    for (const node of nodes) {
      if (node.type === "branch" && targets.includes(node.value)) {
        result.push({ name, nodeId: node.id, basis });
      }
    }
  }
  for (const [name, values] of Object.entries(stemRules)) {
    const keys = name === "天乙贵人" || name === "文昌" ? ["day", "year"] as const : ["day"] as const;
    for (const key of keys) {
      const stem = chart.pillars[key].stem;
      collect(name, values["甲乙丙丁戊己庚辛壬癸".indexOf(stem)] ?? "", `${key === "day" ? "日" : "年"}干${stem}`);
    }
  }
  for (const [name, values] of Object.entries(branchRules)) {
    for (const key of ["year", "day"] as const) {
      const branch = chart.pillars[key].branch;
      const i = ["申子辰", "寅午戌", "巳酉丑", "亥卯未"].findIndex((g) => g.includes(branch));
      collect(name, values.charAt(i), `${key === "day" ? "日" : "年"}支${branch}`);
    }
  }
  return result;
}
export interface ElementCount {
  element: "木" | "火" | "土" | "金" | "水";
  stem: number;
  main: number;
  middle: number;
  residual: number;
  total: number;
}
export function countElements(chart: BaziChart): ElementCount[] {
  const pillars = Object.values(chart.pillars).filter((p) => p !== null);
  const mapping = { 木: "甲乙", 火: "丙丁", 土: "戊己", 金: "庚辛", 水: "壬癸" } as const;
  return (Object.keys(mapping) as (keyof typeof mapping)[]).map((element) => {
    const chars = mapping[element];
    const stem = pillars.filter((p) => chars.includes(p.stem)).length;
    const hidden = pillars.flatMap((p) => p.hidden).filter((h) => chars.includes(h.stem));
    const main = hidden.filter((h) => h.qi === "main").length;
    const middle = hidden.filter((h) => h.qi === "middle").length;
    const residual = hidden.filter((h) => h.qi === "residual").length;
    return { element, stem, main, middle, residual, total: stem + main + middle + residual };
  });
}
export interface BaziAnalysis {
  nodes: RelationNode[];
  relations: BaziRelation[];
  shensha: Shensha[];
  elements: ElementCount[];
  years: {
    year: number;
    nodes: RelationNode[];
    relations: BaziRelation[];
    shensha: Shensha[];
  }[];
}
export function analyzeBazi(chart: BaziChart): BaziAnalysis {
  const nodes = makeNodes(chart, chart.annual?.currentLuck ?? null, chart.annual?.ganZhi ?? null);
  return {
    nodes, relations: findRelations(nodes), shensha: findShensha(chart, nodes),
    elements: countElements(chart),
    years: chart.liunian.years.map((year) => {
      const nodes = makeNodes(chart, year.luck, year.ganZhi);
      return { year: year.year, nodes, relations: findRelations(nodes), shensha: findShensha(chart, nodes) };
    }),
  };
}
// 供 B4 复用关系表的通行标签词表，不另写关系推导规则。
export function baziRelationWords(): string[] {
  const words: string[] = [];
  for (const table of [stemPairs, branchPairs]) {
    for (const [kind, pairs] of Object.entries(table)) {
      words.push(...pairs.split(" ").map((pair) => pair + kind));
    }
  }
  for (const [group, element] of combinations) {
    words.push(`${group}三合${element}`);
    for (const [left, right] of [[0, 1], [0, 2], [1, 2]] as const) {
      const kind = left === 1 || right === 1 ? "半合" : "拱";
      words.push(`${group.charAt(left)}${group.charAt(right)}${kind}${element}`);
    }
  }
  for (const [group, element] of meetings) {
    words.push(`${group}三会${element}`);
  }
  return words;
}
