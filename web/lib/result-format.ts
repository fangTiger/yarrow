import {
  BRANCHES_EN,
  ELEMENTS_EN,
  HEXAGRAMS_EN,
  SCHOOLS_EN,
  SIX_RELATIVES_EN,
  SIX_SPIRITS_EN,
  STEMS_EN,
  SUBJECTS_EN,
  TEN_GODS_EN,
  TERMS_EN,
  TRIGRAMS_EN,
  VERDICTS_EN,
} from "../../src/sanyi/i18n/glossary.js";

export function elementEn(value: string): string {
  return ELEMENTS_EN[value as keyof typeof ELEMENTS_EN] ?? value;
}

export function trigramEn(value: string): string {
  const item = TRIGRAMS_EN[value as keyof typeof TRIGRAMS_EN];
  return item ? `${item.pinyin} (${item.image})` : value;
}

export function hexagramEn(kingWenNumber: number): string {
  const item = HEXAGRAMS_EN[kingWenNumber - 1];
  return item ? `${item.pinyin} · ${item.title}` : `Hexagram ${kingWenNumber}`;
}

export function stemBranchEn(value: string | null | undefined): string {
  if (!value) return "—";
  return [...value].map((char) => {
    if (char in STEMS_EN) return STEMS_EN[char as keyof typeof STEMS_EN];
    if (char in BRANCHES_EN) return BRANCHES_EN[char as keyof typeof BRANCHES_EN].pinyin;
    return /[\p{Script=Han}]/u.test(char) ? "" : char;
  }).filter(Boolean).join(" ");
}

export function tenGodEn(value: string | null | undefined): string {
  if (!value) return "—";
  return TEN_GODS_EN[value as keyof typeof TEN_GODS_EN] ?? value;
}

export function relativeEn(value: string): string {
  return SIX_RELATIVES_EN[value as keyof typeof SIX_RELATIVES_EN] ?? value;
}

export function spiritEn(value: string): string {
  return SIX_SPIRITS_EN[value as keyof typeof SIX_SPIRITS_EN] ?? value;
}

export function verdictEn(value: string): string {
  return VERDICTS_EN[value as keyof typeof VERDICTS_EN] ?? value;
}

export function subjectEn(value: string): string {
  return SUBJECTS_EN[value as keyof typeof SUBJECTS_EN] ?? "Other";
}

export function schoolEn(value: string): { name: string; school: string } {
  return SCHOOLS_EN[value as keyof typeof SCHOOLS_EN] ?? { name: value, school: "" };
}

export function termEn(value: string): string {
  const item = TERMS_EN[value as keyof typeof TERMS_EN];
  return item ? `${item.pinyin} (${item.gloss})` : value;
}

export function confidenceEn(value: number): string {
  return `about ${Number.isInteger(value) ? value : value.toFixed(1)} in 10`;
}

const STRENGTH_EN: Readonly<Record<string, string>> = {
  旺: "Prosperous", 相: "Supported", 休: "Resting", 囚: "Confined", 死: "Dormant",
};

export function strengthEn(value: string): string {
  return STRENGTH_EN[value] ?? value;
}

/** 合冲刑害的种类：成对关系只写动作，成局关系前面带出所化五行。 */
const RELATION_KINDS_EN: Readonly<Record<string, string>> = {
  合: "combine", 冲: "clash", 害: "harm", 破: "break", 刑: "punishment", 自刑: "self-punishment",
  三合: "three harmony", 三会: "seasonal union", 半合: "half harmony", 拱: "arch",
};

interface RelationLike {
  kind: string;
  label: string;
  nodeIds: readonly string[];
}

/** 关系标签去掉成员后的部分，如「三会火」→「Fire seasonal union」。 */
export function relationKindEn(relation: RelationLike): string {
  const kind = RELATION_KINDS_EN[relation.kind] ?? relation.kind;
  const element = relation.label.slice(relation.nodeIds.length + relation.kind.length);
  return element ? `${elementEn(element)} ${kind}` : kind;
}

/** 合冲刑害英译：成员写拼音、以连接号相接，如「巳午未三会火」→「Si–Wu–Wei Fire seasonal union」。 */
export function relationEn(relation: RelationLike): string {
  const members = [...relation.label.slice(0, relation.nodeIds.length)].map(stemBranchEn).join("–");
  return `${members} ${relationKindEn(relation)}`;
}
