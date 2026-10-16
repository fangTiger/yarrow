import { findZhouyiEnglishReferences } from "../../agent/zhouyi-en.js";
import type { FactTable } from "../facts.js";
import { isNatalFact } from "../bazi-facts.js";
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

// 干支对允许空格、连字符或短破折号相连（模型常写 Ding Si，也常写 Ding-Si）。
const GANZHI_PAIR = new RegExp(
  `\\b(${[...GANZHI_BY_EN.keys()].sort((a, b) => b.length - a.length)
    .map((pair) => escaped(pair).replace(" ", "[ \\u2010-\\u2013-]")).join("|")})\\b`,
  "gu",
);
function ganzhiOf(matched: string): string {
  return GANZHI_BY_EN.get(matched.replace(/[\u2010-\u2013-]/u, " "))!;
}
const TEN_GOD = new RegExp(`\\b(${TEN_GOD_PATTERN})\\b`, "gu");
const QUESTION_COMBINATION = new RegExp(
  `\\b(${BRANCH_PATTERN})\\s+(${ELEMENT_PATTERN})\\s+(${RELATIVE_PATTERN})\\b`,
  "giu",
);

function allTokens(facts: FactTable): Set<string> {
  return new Set([...facts.values()].flatMap((fact) => [...fact.tokens]));
}

function auditEnglishTerms(
  text: string,
  allowed: ReadonlySet<string>,
  label: string,
): string[] {
  const errors: string[] = [];
  for (const match of text.matchAll(GANZHI_PAIR)) {
    const chinese = ganzhiOf(match[1]!);
    if (!allowed.has(chinese)) errors.push(`${label}出现不存在的干支：${match[0]}`);
  }
  for (const match of text.matchAll(TEN_GOD)) {
    const chinese = TEN_GOD_BY_EN.get(match[1]!)!;
    if (!allowed.has(chinese)) errors.push(`${label}出现不存在的十神：${match[0]}`);
  }
  return errors;
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
  const tokens = allTokens(facts);
  const lines = lineTokenSets(facts);
  const prose = stripEnglishClassics(text, facts);
  const errors = auditEnglishTerms(prose, tokens, "英文正文");
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

function union(facts: FactTable): Set<string> {
  return new Set([...facts.values()].flatMap((fact) => [...fact.tokens]));
}

/** 与中文八字 currentTokens 一致：正文不把逐年窗口里的其它年份当作当前事实。 */
function baziCurrentTokens(facts: FactTable): Set<string> {
  return union(new Map([...facts].filter(([id]) => !/^year:\d{4}$/u.test(id))));
}

function natalTokens(facts: FactTable): Set<string> {
  return union(new Map([...facts].filter(([id, fact]) => isNatalFact(id, fact.label))));
}

function missingHourAttributionErrors(text: string, facts: FactTable, label: string): string[] {
  if (!facts.has("chart:limit")) return [];
  const attribution = /\b(?:hour pillar|life palace|body palace)\b/iu;
  return text.split(/[.!?;\n]/u).flatMap((sentence) => (
    attribution.test(sentence) && [...sentence.matchAll(GANZHI_PAIR)].length > 0
      ? [`${label}缺时柱，不得把干支归给 hour pillar、Life Palace 或 Body Palace`]
      : []
  ));
}

/** 英文八字正文：干支拼音对与十神英译映回中文 token 后，按当前事实核对。 */
export function auditBaziEnglishProse(text: string, facts: FactTable): string[] {
  return [
    ...auditEnglishTerms(text, baziCurrentTokens(facts), "英文正文"),
    ...missingHourAttributionErrors(text, facts, "英文正文"),
  ];
}

/** 英文八字总述可综合逐运或逐年窗口，因此术语范围对应中文 union。 */
export function auditBaziEnglishSummaryProse(text: string, facts: FactTable): string[] {
  return [
    ...auditEnglishTerms(text, union(facts), "英文总述"),
    ...missingHourAttributionErrors(text, facts, "英文总述"),
  ];
}

/** 英文逐年短评只认该年事实与原局事实。 */
export function auditBaziEnglishYearNote(
  item: { year: number; note: string },
  facts: FactTable,
): string[] {
  const year = facts.get(`year:${item.year}`);
  if (!year) return [`${item.year} 年事实不存在`];
  return [
    ...auditEnglishTerms(
      item.note,
      new Set([...natalTokens(facts), ...year.tokens]),
      `${item.year} 年英文短评`,
    ),
    ...missingHourAttributionErrors(item.note, facts, `${item.year} 年英文短评`),
  ];
}

/** 英文逐运短评只认该步大运事实与原局事实。 */
export function auditBaziEnglishPeriodNote(
  item: { index: number; note: string },
  facts: FactTable,
): string[] {
  const period = facts.get(`luck:${item.index}`);
  if (!period) return [`第 ${item.index} 步大运事实不存在`];
  return [
    ...auditEnglishTerms(
      item.note,
      new Set([...natalTokens(facts), ...period.tokens]),
      `第 ${item.index} 步大运英文短评`,
    ),
    ...missingHourAttributionErrors(item.note, facts, `第 ${item.index} 步大运英文短评`),
  ];
}

/** 缺时柱时，英文正文必须明确说明出生时刻未知所带来的判断限制。 */
export function baziEnglishHourLimitErrors(text: string, facts: FactTable): string[] {
  if (!facts.has("chart:limit")) return [];
  const subject = /\b(?:birth hour|hour pillar|time of birth)\b/iu.test(text);
  const unavailable = /\b(?:unknown|missing|unavailable|not\s+(?:known|provided|recorded|available)|without|absence|lacks?|lacking|no)\b/iu
    .test(text);
  const limitation = /\b(?:limit(?:s|ed|ing|ations?)?|uncertain(?:ty)?|cannot|can't|can\s+not|incomplete|less\s+(?:precise|certain|complete)|reduces?\s+(?:precision|certainty)|lower\s+confidence|constrain(?:s|ed|t)?)\b/iu
    .test(text);
  return subject && unavailable && limitation
    ? []
    : ["缺时柱时英文正文须提及 birth hour、hour pillar 或 time of birth，并说明其未知且判断受限"];
}
