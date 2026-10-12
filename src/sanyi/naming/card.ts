import { CLASSIC_LINES, isNegativeChar, type ClassicLine } from "./classics.js";
import { toneHints } from "./audit.js";
import { ELEMENT_VIRTUES } from "./favorable.js";
import { charInfo, ELEMENTS, type Element } from "./lexicon.js";
import { nameWorthyChars } from "./pool.js";

export type CharBasisCode =
  | "radical-wood" | "radical-fire" | "radical-earth" | "radical-metal"
  | "radical-water" | "radical-jade" | "radical-grass" | "radical-bamboo"
  | "radical-sun" | "radical-mountain" | "radical-stone" | "radical-other"
  | "sound-labial" | "sound-lingual" | "sound-dental" | "sound-molar"
  | "sound-guttural" | "sound-other" | "modern-meaning";

export type CharRelationCode = "missing" | "favorable" | "industry" | "neutral";

export interface CharAnalysisData {
  char: string;
  wuxing: Element | null;
  basisCode: CharBasisCode;
  relationCode: CharRelationCode;
}

export type NameHint =
  | { code: "same-tone"; params: Record<string, never> }
  | { code: "same-initial" | "same-final"; params: { surname: string; char: string } }
  | { code: "rare-char"; params: { char: string } }
  | { code: "polyphonic"; params: { char: string; readings: string } };

const RADICAL_CODES: Readonly<Record<string, CharBasisCode>> = {
  木: "radical-wood", 火: "radical-fire", 土: "radical-earth", 金: "radical-metal",
  水: "radical-water", 玉: "radical-jade", 艸: "radical-grass", 竹: "radical-bamboo",
  日: "radical-sun", 山: "radical-mountain", 石: "radical-stone",
};

const SOUND_CODES: Readonly<Record<string, CharBasisCode>> = {
  唇音: "sound-labial", 舌音: "sound-lingual", 齿音: "sound-dental",
  牙音: "sound-molar", 喉音: "sound-guttural",
};

function basisCode(value: string): CharBasisCode {
  const [kind, detail = ""] = value.split("·");
  if (kind === "部首") return RADICAL_CODES[detail] ?? "radical-other";
  if (kind === "读音") return SOUND_CODES[detail] ?? "sound-other";
  return "modern-meaning";
}

export function charAnalysisData(char: string, context: {
  target: "person" | "business";
  favorable: readonly Element[] | null;
  missing: readonly Element[];
  favorableSource: "missing" | "tiaohou" | "industry" | "model";
}): CharAnalysisData {
  const info = charInfo(char);
  if (!info) return { char, wuxing: null, basisCode: "modern-meaning", relationCode: "neutral" };
  let relationCode: CharRelationCode = "neutral";
  if (context.missing.includes(info.wuxing)) relationCode = "missing";
  else if (context.favorable?.includes(info.wuxing)) {
    relationCode = context.target === "business" && context.favorableSource === "industry"
      ? "industry" : "favorable";
  }
  return { char, wuxing: info.wuxing, basisCode: basisCode(info.wuxingBasis), relationCode };
}

const BOOK_ORDER = ["诗经", "楚辞", "唐诗三百首", "宋词三百首", "周易", "论语"] as const;
const bookRank = new Map<string, number>(BOOK_ORDER.map((book, index) => [book, index]));
const nameWorthySet = new Set(nameWorthyChars().map(({ char }) => char));

function imageryScore(line: ClassicLine): number {
  const chars = [...line.text];
  return chars.filter((char) => nameWorthySet.has(char)).length / Math.max(chars.length, 1);
}

/** 意蕴内涵优先整句：去掉标点后不少于 7 字；短句（如「近清明」）意象分再高也排在后面。 */
function isFullLine(line: ClassicLine): boolean {
  return [...line.text.replace(/[，、：；,]/gu, "")].length >= 7;
}

function compareEchoLines(left: ClassicLine, right: ClassicLine): number {
  return Number(isFullLine(right)) - Number(isFullLine(left))
    || imageryScore(right) - imageryScore(left)
    || (bookRank.get(left.book) ?? BOOK_ORDER.length) - (bookRank.get(right.book) ?? BOOK_ORDER.length)
    || left.id.localeCompare(right.id);
}

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

function echoCatalog(lines: readonly ClassicLine[]) {
  const usable = lines
    .filter((line) => ![...line.text].some(isNegativeChar) && !/[《》]/u.test(line.text))
    .sort(compareEchoLines);
  return { usable, byChar: indexLines(usable) };
}

const productionEchoCatalog = echoCatalog(CLASSIC_LINES);
const corpusLinesByChar = indexLines(CLASSIC_LINES);

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

/** 公开视图使用的音律提示；由 code 与参数交给前端双语模板。 */
export function nameHintCodes(surname: string | undefined, given: string): NameHint[] {
  const hints: NameHint[] = [];
  if (surname && allSameTone(`${surname}${given}`)) {
    hints.push({ code: "same-tone", params: {} });
  }
  const surnameChar = [...(surname ?? "")].at(-1);
  const givenChar = [...given][0];
  const surnameInfo = surnameChar ? charInfo(surnameChar) : undefined;
  const firstInfo = givenChar ? charInfo(givenChar) : undefined;
  if (surnameChar && givenChar && surnameInfo && firstInfo) {
    if (surnameInfo.initial && surnameInfo.initial === firstInfo.initial) {
      hints.push({ code: "same-initial", params: { surname: surnameChar, char: givenChar } });
    }
    if (surnameInfo.final && surnameInfo.final === firstInfo.final) {
      hints.push({ code: "same-final", params: { surname: surnameChar, char: givenChar } });
    }
  }
  const unique = [...new Set([...given])];
  for (const char of unique) {
    if (charInfo(char)?.level === 3) hints.push({ code: "rare-char", params: { char } });
  }
  for (const char of unique) {
    const info = charInfo(char);
    if (info?.polyphonic) {
      hints.push({ code: "polyphonic", params: { char, readings: info.readings.join(", ") } });
    }
  }
  return hints;
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

export function echoLines(
  given: string,
  excludeId?: string,
  sourceLines?: readonly ClassicLine[],
): ClassicLine[] {
  const catalog = sourceLines ? echoCatalog(sourceLines) : productionEchoCatalog;
  const chars = [...new Set([...given])];
  const result: ClassicLine[] = [];
  const selected = new Set<string>(excludeId ? [excludeId] : []);
  const add = (line: ClassicLine | undefined) => {
    if (!line || selected.has(line.id) || result.length >= 3) return;
    result.push(line);
    selected.add(line.id);
  };
  add(catalog.usable.find((line) => (
    !selected.has(line.id) && chars.every((char) => line.text.includes(char))
  )));
  for (const char of chars) {
    add(catalog.byChar.get(char)?.find((line) => !selected.has(line.id)));
  }
  return result;
}
