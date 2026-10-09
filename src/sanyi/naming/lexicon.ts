import rawLexicon from "./lexicon.json" with { type: "json" };

export type Element = "木" | "火" | "土" | "金" | "水";

export const ELEMENTS: readonly Element[] = ["木", "火", "土", "金", "水"];

export interface CharInfo {
  char: string;
  pinyin: string;
  tone: 1 | 2 | 3 | 4 | 5;
  initial: string;
  final: string;
  trad: string;
  kangxi: number;
  strokes: number;
  level: 1 | 2 | 3;
  wuxing: Element;
  wuxingBasis: string;
  meaning: string;
  blocked: boolean;
  readings: string[];
  polyphonic: boolean;
}

type RawRow = readonly [
  string, number, string, string, string, number, number, number,
  string, string, string, number, string[], boolean,
];

const raw = rawLexicon as Record<string, RawRow | readonly string[]>;
const chars = Object.keys(raw).filter((char) => char !== "_fields");
let cache: Map<string, CharInfo> | undefined;

export const LEXICON_SIZE = chars.length;

function allChars(): Map<string, CharInfo> {
  if (cache) return cache;
  cache = new Map(chars.map((char) => {
    const row = raw[char] as RawRow;
    const info: CharInfo = {
      char,
      pinyin: row[0],
      tone: row[1] as CharInfo["tone"],
      initial: row[2],
      final: row[3],
      trad: row[4],
      kangxi: row[5],
      strokes: row[6],
      level: row[7] as CharInfo["level"],
      wuxing: row[8] as Element,
      wuxingBasis: row[9],
      meaning: row[10],
      blocked: row[11] === 1,
      readings: row[12],
      polyphonic: row[13],
    };
    return [char, info];
  }));
  return cache;
}

export function charInfo(char: string): CharInfo | undefined {
  if ([...char].length !== 1) return undefined;
  return allChars().get(char);
}

export function isNameChar(char: string): boolean {
  const info = charInfo(char);
  return info !== undefined && !info.blocked;
}

export function isSurname(value: string): boolean {
  const valueChars = [...value];
  return valueChars.length >= 1 && valueChars.length <= 2
    && valueChars.every((char) => charInfo(char) !== undefined);
}

export function nameChars(filter?: (info: CharInfo) => boolean): CharInfo[] {
  const available = [...allChars().values()].filter((info) => !info.blocked);
  return filter ? available.filter(filter) : available;
}
