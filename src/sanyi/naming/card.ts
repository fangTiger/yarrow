import { CLASSIC_LINES, isNegativeChar, type ClassicLine } from "./classics.js";
import { toneHints } from "./audit.js";
import { ELEMENT_VIRTUES } from "./favorable.js";
import { charInfo, ELEMENTS, type Element } from "./lexicon.js";

const BOOK_ORDER = ["诗经", "楚辞", "唐诗三百首", "宋词三百首", "周易", "论语"] as const;
const bookRank = new Map<string, number>(BOOK_ORDER.map((book, index) => [book, index]));
const usableLines = CLASSIC_LINES
  .filter((line) => ![...line.text].some(isNegativeChar) && !/[《》]/u.test(line.text))
  .sort((left, right) => (
    (bookRank.get(left.book) ?? BOOK_ORDER.length) - (bookRank.get(right.book) ?? BOOK_ORDER.length)
    || left.id.localeCompare(right.id)
  ));
function indexLines(lines: readonly ClassicLine[]): Map<string, ClassicLine[]> {
  const index = new Map<string, ClassicLine[]>();
  for (const line of lines) {
    for (const char of new Set([...line.text])) {
      const indexed = index.get(char) ?? [];
      indexed.push(line);
      index.set(char, indexed);
    }
  }
  return index;
}
const corpusLinesByChar = indexLines(CLASSIC_LINES);
const echoLinesByChar = indexLines(usableLines);

export interface NameScoreInput {
  target: "person" | "business";
  surname?: string;
  given: string;
  favorable: readonly Element[] | null;
  missing: readonly Element[];
  sourceVerified?: boolean;
}

export interface NameScores {
  overall: number;
  sound: number;
  form: number;
  wuxing: number;
  poetry: number;
}

function atLeast60(value: number): number {
  return Math.max(60, value);
}

function allSameTone(value: string): boolean {
  const chars = [...value];
  const tones = chars.map((char) => charInfo(char)?.tone);
  return chars.length > 1 && tones.every(Boolean) && tones.every((tone) => tone === tones[0]);
}

function soundScore(input: NameScoreInput): number {
  const givenChars = [...input.given];
  const repeated = givenChars.length > 1 && new Set(givenChars).size === 1;
  let score = 96;
  if (input.target === "person" && allSameTone(`${input.surname ?? ""}${input.given}`) && !repeated) {
    score -= 18;
  }
  if (input.target === "business" && givenChars.length >= 2 && !repeated
      && allSameTone(input.given)) {
    score -= 12;
  }
  const hints = toneHints(input.target === "person" ? input.surname : undefined, input.given);
  score -= hints.filter((hint) => /同声母|同韵母/u.test(hint)).length * 6;
  for (const char of givenChars) {
    const info = charInfo(char);
    if (info?.polyphonic) score -= 4;
    if (info?.level === 3) score -= 8;
  }
  return atLeast60(score);
}

function formScore(given: string): number {
  const infos = [...given].flatMap((char) => {
    const info = charInfo(char);
    return info ? [info] : [];
  });
  let score = 96;
  for (const info of infos) {
    if (info.strokes > 20) score -= 10;
    else if (info.strokes > 16) score -= 6;
    if (info.level === 2) score -= 2;
    if (info.level === 3) score -= 8;
  }
  const strokes = infos.map(({ strokes }) => strokes);
  if (strokes.length > 0 && Math.max(...strokes) - Math.min(...strokes) > 12) score -= 4;
  return atLeast60(score);
}

function wuxingScore(input: NameScoreInput): number {
  if (!input.favorable || input.favorable.length === 0) return 80;
  const chars = [...input.given];
  const favorable = new Set(input.favorable);
  const matched = chars.filter((char) => {
    const element = charInfo(char)?.wuxing;
    return element !== undefined && favorable.has(element);
  }).length;
  let score = 70 + Math.round(25 * matched / Math.max(chars.length, 1));
  const missing = new Set(input.missing);
  if (chars.some((char) => {
    const element = charInfo(char)?.wuxing;
    return element !== undefined && missing.has(element);
  })) score += 3;
  return Math.min(98, atLeast60(score));
}

function poetryScore(given: string, sourceVerified: boolean): number {
  if (sourceVerified) return 96;
  const chars = [...new Set([...given])];
  if (corpusLinesByChar.get(chars[0] ?? "")?.some((line) => (
    chars.every((char) => line.text.includes(char))
  ))) return 92;
  const counts = chars.map((char) => corpusLinesByChar.get(char)?.length ?? 0);
  if (counts.length > 0 && counts.every((count) => count >= 5)) return 84;
  if (counts.some((count) => count > 0)) return 76;
  return 70;
}

export function nameScores(input: NameScoreInput): NameScores {
  const sound = soundScore(input);
  const form = formScore(input.given);
  const wuxing = wuxingScore(input);
  const poetry = atLeast60(poetryScore(input.given, input.sourceVerified === true));
  return { overall: Math.round((sound + form + wuxing + poetry) / 4), sound, form, wuxing, poetry };
}

export interface NameSupplement {
  element: Element;
  chars: string[];
}

export function nameSupplements(
  given: string,
  favorable: readonly Element[] | null,
): NameSupplement[] {
  const wanted = new Set(favorable ?? []);
  return ELEMENTS.flatMap((element) => {
    if (!wanted.has(element)) return [];
    const chars = [...given].filter((char) => charInfo(char)?.wuxing === element);
    return chars.length > 0 ? [{ element, chars }] : [];
  });
}

export function charAnalysis(char: string, context: {
  target: "person" | "business";
  favorable: readonly Element[] | null;
  missing: readonly Element[];
  favorableSource: "missing" | "tiaohou" | "industry" | "model";
}): string {
  const info = charInfo(char);
  if (!info) return `「${char}」按其现代正面字义取意。`;
  let relation = "";
  if (context.missing.includes(info.wuxing)) {
    relation = `，补八字所缺之${info.wuxing}`;
  } else if (context.favorable?.includes(info.wuxing)) {
    relation = context.target === "business" && context.favorableSource === "industry"
      ? `，合行业之${info.wuxing}`
      : `，合所补之${info.wuxing}`;
  }
  const virtue = ELEMENT_VIRTUES[info.wuxing].replace("：", "，寓意");
  return `「${char}」五行属${info.wuxing}（${info.wuxingBasis}）${relation}；${virtue}。`;
}

export function echoLines(given: string, excludeId?: string): ClassicLine[] {
  const chars = [...new Set([...given])];
  const result: ClassicLine[] = [];
  const selected = new Set<string>(excludeId ? [excludeId] : []);
  const add = (line: ClassicLine | undefined) => {
    if (!line || selected.has(line.id) || result.length >= 3) return;
    result.push(line);
    selected.add(line.id);
  };
  add(usableLines.find((line) => (
    !selected.has(line.id) && chars.every((char) => line.text.includes(char))
  )));
  for (const char of chars) {
    add(echoLinesByChar.get(char)?.find((line) => !selected.has(line.id)));
  }
  return result;
}
