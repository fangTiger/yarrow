import { getDaxiang } from "../../agent/daxiang-corpus.js";
import { getHexagramText } from "../../agent/zhouyi-corpus.js";
import rawClassics from "./classics.json" with { type: "json" };
import { charInfo, isNameChar } from "./lexicon.js";

export interface ClassicLine {
  id: string;
  book: string;
  title: string;
  text: string;
}

export interface CandidateOptions {
  seed: string;
  length: 1 | 2 | 3 | 4;
  count: number;
  prefer: readonly string[];
}

interface RawClassic {
  book: string;
  title: string;
  lines: string[];
}

const BOOK_CODES: Readonly<Record<string, string>> = {
  诗经: "sj",
  楚辞: "cc",
  论语: "ly",
  唐诗三百首: "ts",
  宋词三百首: "sc",
};
const BOOK_QUOTAS = [
  ["诗经", 14],
  ["楚辞", 12],
  ["唐诗三百首", 10],
  ["宋词三百首", 10],
  ["周易", 7],
  ["论语", 7],
] as const;
const BOOK_ORDER = BOOK_QUOTAS.map(([book]) => book);
const NEGATIVE = /[死亡病泣哀悲愁怨恨哭泪别孤寂苦凄惨伤恸残断衰枯憔悴叹忧惆怅萧啼寡鳏丧殇坟墓骨血兵戈杀]/u;
const REVIEW_NEGATIVE = /[烽战征戍虏敌胡囚狱乱逃魂魄冢鬼妖刑罚贼寇]/u;

/** 消极字：候选诗句与宜入名字池共用，单字判断。 */
export function isNegativeChar(char: string): boolean {
  return NEGATIVE.test(char) || REVIEW_NEGATIVE.test(char);
}
const SPLIT_PATTERN = /[。！？!?；;]+/u;
const REMOVE_PATTERN = /[“”‘’「」『』\s]/gu;

function splitText(text: string): string[] {
  return text.replace(/（[^）]*）|\([^)]*\)/gu, "").replace(REMOVE_PATTERN, "")
    .split(SPLIT_PATTERN).map((part) => part.replace(/^[，、：:,.]+|[，、：:,.]+$/gu, ""))
    .filter(Boolean);
}

function sourceLines(): ClassicLine[] {
  const bookIndexes = new Map<string, number>();
  const lines: ClassicLine[] = [];
  for (const classic of rawClassics as RawClassic[]) {
    const piece = (bookIndexes.get(classic.book) ?? 0) + 1;
    bookIndexes.set(classic.book, piece);
    const code = BOOK_CODES[classic.book];
    if (!code) throw new Error(`未知诗文书名：${classic.book}`);
    classic.lines.forEach((text, lineIndex) => lines.push({
      id: `${code}-${String(piece).padStart(4, "0")}-${String(lineIndex + 1).padStart(2, "0")}`,
      book: classic.book,
      title: classic.title,
      text,
    }));
  }
  return lines;
}

function shortHexagramName(name: string): string {
  const special = name.match(/^([乾坤坎离震艮巽兑])为/u);
  return special?.[1] ?? [...name].at(-1)!;
}

function zhouyiLines(): ClassicLine[] {
  const lines: ClassicLine[] = [];
  for (let number = 1; number <= 64; number += 1) {
    const hexagram = getHexagramText(number);
    const name = shortHexagramName(hexagram.name);
    const entries = [
      { title: `${name}·卦辞`, text: hexagram.judgement },
      ...hexagram.lines.map((line) => ({ title: `${name}·${line.label}`, text: line.text })),
      ...hexagram.extras.map((line) => ({ title: `${name}·${line.label}`, text: line.text })),
      { title: `${name}·大象`, text: getDaxiang(number) },
    ];
    let lineNumber = 0;
    for (const entry of entries) {
      for (const text of splitText(entry.text)) {
        lineNumber += 1;
        lines.push({
          id: `zy-${String(number).padStart(4, "0")}-${String(lineNumber).padStart(2, "0")}`,
          book: "周易",
          title: entry.title,
          text,
        });
      }
    }
  }
  return lines;
}

export const CLASSIC_LINES: readonly ClassicLine[] = [...sourceLines(), ...zhouyiLines()];

const linesById = new Map(CLASSIC_LINES.map((line) => [line.id, line]));

export function lineById(id: string): ClassicLine | undefined {
  return linesById.get(id);
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function randomFrom(seed: string): () => number {
  let state = fnv1a(seed) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function shuffled<T>(values: readonly T[], seed: string): T[] {
  const result = [...values];
  const random = randomFrom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function eligible(line: ClassicLine, length: number): boolean {
  const chars = [...line.text];
  return chars.length >= 4 && chars.length <= 24
    && !NEGATIVE.test(line.text)
    && !REVIEW_NEGATIVE.test(line.text)
    && !line.text.includes("单于")
    && !/[《》]/u.test(line.text)
    && chars.filter(isNameChar).length >= length
    && chars.every((char) => charInfo(char)?.blocked !== true);
}

function quotasFor(count: number): Map<string, number> {
  const quotas = new Map<string, number>();
  let assigned = 0;
  for (const [book, quota] of BOOK_QUOTAS) {
    const scaled = Math.floor(quota * count / 60);
    quotas.set(book, scaled);
    assigned += scaled;
  }
  for (let index = 0; assigned < count; index = (index + 1) % BOOK_ORDER.length) {
    const book = BOOK_ORDER[index]!;
    quotas.set(book, (quotas.get(book) ?? 0) + 1);
    assigned += 1;
  }
  return quotas;
}

export function pickCandidates(options: CandidateOptions): ClassicLine[] {
  if (!Number.isInteger(options.count) || options.count < 0) {
    throw new Error("候选句数量必须是非负整数");
  }
  const pool = CLASSIC_LINES.filter((line) => eligible(line, options.length));
  const quotas = quotasFor(options.count);
  const counts = new Map<string, number>(BOOK_ORDER.map((book) => [book, 0]));
  const preferred = shuffled(
    pool.filter((line) => options.prefer.some((char) => isNameChar(char) && line.text.includes(char))),
    `${options.seed}:prefer`,
  );
  const result: ClassicLine[] = [];
  const selected = new Set<string>();
  for (const line of preferred) {
    if (result.length >= Math.min(20, options.count)) break;
    if ((counts.get(line.book) ?? 0) >= (quotas.get(line.book) ?? 0)) continue;
    result.push(line);
    selected.add(line.id);
    counts.set(line.book, (counts.get(line.book) ?? 0) + 1);
  }
  const groups = new Map(BOOK_ORDER.map((book) => [
    book,
    shuffled(pool.filter((line) => line.book === book && !selected.has(line.id)),
      `${options.seed}:${book}`),
  ]));
  const positions = new Map<string, number>(BOOK_ORDER.map((book) => [book, 0]));
  while (result.length < options.count) {
    let added = false;
    for (const book of BOOK_ORDER) {
      if ((counts.get(book) ?? 0) >= (quotas.get(book) ?? 0)) continue;
      const position = positions.get(book) ?? 0;
      const line = groups.get(book)?.[position];
      if (!line) continue;
      positions.set(book, position + 1);
      result.push(line);
      selected.add(line.id);
      counts.set(book, (counts.get(book) ?? 0) + 1);
      added = true;
    }
    if (!added) break;
  }
  // 某书不足时，按既定书序用其它书的剩余句子补足。
  for (const book of BOOK_ORDER) {
    while (result.length < options.count) {
      const position = positions.get(book) ?? 0;
      const line = groups.get(book)?.[position];
      if (!line) break;
      positions.set(book, position + 1);
      result.push(line);
    }
  }
  return result;
}
