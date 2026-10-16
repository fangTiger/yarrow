import { findZhouyiEnglishReferences } from "../../agent/zhouyi-en.js";
import type { FactTable } from "../facts.js";
import {
  BRANCHES_EN,
  ELEMENTS_EN,
  SIX_RELATIVES_EN,
  STEMS_EN,
  TEN_GODS_EN,
} from "../i18n/glossary.js";

const HAN = /\p{Script=Han}/gu;

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** 英文展示字段不得出现白名单以外的汉字。 */
export function englishBodyErrors(
  texts: readonly string[],
  allowedHan: readonly string[] = [],
): string[] {
  const cleaned = allowedHan
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .reduce((text, allowed) => text.replaceAll(allowed, ""), texts.join("\n"));
  const found = [...new Set(cleaned.match(HAN) ?? [])];
  return found.length === 0
    ? []
    : [`英文正文不得出现白名单外汉字：${found.join("、")}`];
}

const ENGLISH_FORBIDDEN = new RegExp([
  "\\bamulets?\\b",
  "\\btalismans?\\b",
  "\\bconsecrat[a-z]*\\b",
  "\\blucky\\s+colou?rs?\\b",
  "\\blucky\\s+numbers?\\b",
  "\\bincense\\b",
  "\\bofferings?\\b",
  "\\britual\\s+objects?\\b",
  "\\bfeng\\s+shui\\s+items?\\b",
  "\\bmascots?\\b",
  "\\b(?:lucky|auspicious|favourable|favorable)\\s+(?:directions?|positions?)\\b",
  "\\bwearable\\s+objects?\\b",
  "\\bornaments?\\b",
  "\\breleas(?:e|es|ed|ing)\\s+animals?\\b",
  "\\bdonat(?:e|es|ed|ing|ions?)\\b",
  "\\bward(?:s|ed|ing)?\\s+off\\s+(?:evil|misfortune|bad\\s+luck)\\b",
  "\\b(?:change|turn|improve)(?:s|d|ing)?\\s+(?:your\\s+)?luck\\b",
  "\\bgambl[a-z]*\\b",
  "\\bbets?\\b",
  "\\bwager(?:ed|ing|s)?\\b",
  "\\bcompensat[a-z]*\\b",
].join("|"), "giu");

/** 英文正文中的民俗趋避、投注与补偿类禁用词。 */
export function englishForbiddenErrors(text: string): string[] {
  const matches = [...new Set(text.match(ENGLISH_FORBIDDEN) ?? [])];
  return matches.length === 0
    ? []
    : [`英文正文不得出现禁用词：${matches.join("、")}`];
}

const BRANCH_BY_EN = new Map<string, string>(
  Object.entries(BRANCHES_EN).map(([zh, value]) => [value.pinyin, zh]),
);
const ELEMENT_BY_EN = new Map<string, string>(
  Object.entries(ELEMENTS_EN).map(([zh, en]) => [en.toLowerCase(), zh]),
);
const TEN_GOD_BY_EN = new Map<string, string>(
  Object.entries(TEN_GODS_EN).map(([zh, en]) => [en, zh]),
);
const RELATIVE_BY_EN = new Map<string, string>();
for (const [zh, en] of Object.entries(SIX_RELATIVES_EN)) {
  RELATIVE_BY_EN.set(en.toLowerCase(), zh);
  if (en.endsWith("s")) RELATIVE_BY_EN.set(en.slice(0, -1).toLowerCase(), zh);
  else RELATIVE_BY_EN.set(`${en.toLowerCase()}s`, zh);
}

const STEMS_ZH = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES_ZH = "子丑寅卯辰巳午未申酉戌亥";
const GANZHI_BY_EN = new Map<string, string>(Array.from({ length: 60 }, (_, index) => {
  const stem = STEMS_ZH[index % 10]!;
  const branch = BRANCHES_ZH[index % 12]!;
  return [`${STEMS_EN[stem as keyof typeof STEMS_EN]} ${
    BRANCHES_EN[branch as keyof typeof BRANCHES_EN].pinyin}`, `${stem}${branch}`];
}));
const BRANCH_PATTERN = [...BRANCH_BY_EN.keys()].map(escaped).join("|");
const ELEMENT_PATTERN = [...new Set(Object.values(ELEMENTS_EN))].map(escaped).join("|");
const RELATIVE_PATTERN = [...new Set([
  ...Object.values(SIX_RELATIVES_EN),
  ...Object.values(SIX_RELATIVES_EN).map((value) => value.endsWith("s") ? value.slice(0, -1) : `${value}s`),
])].map(escaped).join("|");
const TEN_GOD_PATTERN = [...TEN_GOD_BY_EN.keys()].sort((a, b) => b.length - a.length)
  .map(escaped).join("|");

const GANZHI_PAIR = new RegExp(
  `\\b(${[...GANZHI_BY_EN.keys()].sort((a, b) => b.length - a.length).map(escaped).join("|")})\\b`,
  "gu",
);
const TEN_GOD = new RegExp(`\\b(${TEN_GOD_PATTERN})\\b`, "gu");
const QUESTION_COMBINATION = new RegExp(
  `\\b(${BRANCH_PATTERN})\\s+(${ELEMENT_PATTERN})\\s+(${RELATIVE_PATTERN})\\b`,
  "giu",
);

function allTokens(facts: FactTable): Set<string> {
  return new Set([...facts.values()].flatMap((fact) => [...fact.tokens]));
}

function lineTokenSets(facts: FactTable): ReadonlySet<string>[] {
  return [...facts].filter(([id]) => id.startsWith("line:"))
    .map(([, fact]) => fact.tokens);
}

function stripEnglishClassics(text: string, facts: FactTable): string {
  const originals = facts.originalTexts ?? [];
  const translations = originals.flatMap((original) => (
    findZhouyiEnglishReferences(original).map((reference) => reference.english)
  )).sort((left, right) => right.length - left.length);
  return translations.reduce((rest, translation) => rest.replaceAll(translation, ""), text);
}

/**
 * 英文正文盘面核对：只识别首字母大写的干支双音节、区分大小写的十神，
 * 以及大小写与单复数宽容的「地支 + 五行 + 六亲」组合。
 */
export function auditQuestionEnglishProse(text: string, facts: FactTable): string[] {
  const errors: string[] = [];
  const tokens = allTokens(facts);
  const lines = lineTokenSets(facts);
  const prose = stripEnglishClassics(text, facts);
  for (const match of prose.matchAll(GANZHI_PAIR)) {
    const chinese = GANZHI_BY_EN.get(match[1]!)!;
    if (!tokens.has(chinese)) errors.push(`英文正文出现不存在的干支：${match[0]}`);
  }
  for (const match of prose.matchAll(TEN_GOD)) {
    const chinese = TEN_GOD_BY_EN.get(match[1]!)!;
    if (!tokens.has(chinese)) errors.push(`英文正文出现不存在的十神：${match[0]}`);
  }
  for (const match of prose.matchAll(QUESTION_COMBINATION)) {
    const branch = BRANCH_BY_EN.get(`${match[1]![0]!.toUpperCase()}${match[1]!.slice(1).toLowerCase()}`);
    const element = ELEMENT_BY_EN.get(match[2]!.toLowerCase());
    const relative = RELATIVE_BY_EN.get(match[3]!.toLowerCase());
    if (!branch || !element || !relative
      || !lines.some((line) => [branch, element, relative].every((token) => line.has(token)))) {
      errors.push(`英文正文出现不存在的盘面组合：${match[0]}`);
    }
  }
  return errors;
}
