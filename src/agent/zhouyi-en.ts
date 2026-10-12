import rawEnglish from "./zhouyi-en.json" with { type: "json" };
import { DAXIANG } from "./daxiang-corpus.js";
import { ZHOUYI_CORPUS } from "./zhouyi-corpus.js";

export interface ZhouyiEnglishHexagram {
  kingWen: number;
  name: string;
  judgement: string;
  image: string;
  lines: readonly string[];
  extras: readonly string[];
}

export interface ZhouyiEnglishReference {
  kingWen: number;
  kind: "judgement" | "image" | "line" | "extra";
  index?: number;
  chinese: string;
  english: string;
}

interface RawEnglish {
  hexagrams?: unknown;
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`周易英译 ${label} 缺失`);
  }
  return value;
}

function stringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`周易英译 ${label} 不是数组`);
  return value.map((item, index) => stringField(item, `${label}[${index}]`));
}

function validate(value: unknown): readonly ZhouyiEnglishHexagram[] {
  const hexagrams = (value as RawEnglish | null)?.hexagrams;
  if (!Array.isArray(hexagrams) || hexagrams.length !== 64) {
    throw new Error("周易英译必须恰有 64 卦");
  }
  return hexagrams.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`周易英译第 ${index + 1} 卦格式错误`);
    }
    const row = item as Record<string, unknown>;
    if (row.kingWen !== index + 1) throw new Error(`周易英译第 ${index + 1} 卦序号错位`);
    const lines = stringArray(row.lines, `第 ${index + 1} 卦爻辞`);
    const extras = stringArray(row.extras, `第 ${index + 1} 卦附加爻辞`);
    if (lines.length !== 6) throw new Error(`周易英译第 ${index + 1} 卦必须有 6 爻`);
    if (extras.length !== ZHOUYI_CORPUS[index]!.extras.length) {
      throw new Error(`周易英译第 ${index + 1} 卦附加爻辞条数不一致`);
    }
    return {
      kingWen: index + 1,
      name: stringField(row.name, `第 ${index + 1} 卦名`),
      judgement: stringField(row.judgement, `第 ${index + 1} 卦卦辞`),
      image: stringField(row.image, `第 ${index + 1} 卦大象`),
      lines,
      extras,
    };
  });
}

export const ZHOUYI_ENGLISH = validate(rawEnglish);

export function getZhouyiEnglish(kingWen: number): ZhouyiEnglishHexagram {
  if (!Number.isInteger(kingWen) || kingWen < 1 || kingWen > 64) {
    throw new Error(`未知文王序：${kingWen}`);
  }
  return ZHOUYI_ENGLISH[kingWen - 1]!;
}

/** 按文王序和自下而上的爻位（1—6）取固定英译。 */
export function getZhouyiLineEnglish(kingWen: number, line: number): string {
  if (!Number.isInteger(line) || line < 1 || line > 6) {
    throw new Error(`未知爻位：${line}`);
  }
  return getZhouyiEnglish(kingWen).lines[line - 1]!;
}

function normalizedChinese(value: string): string {
  return value.replace(/（[^）]*）|\([^)]*\)/gu, "").replace(/[^\p{Script=Han}0-9]/gu, "");
}

function mentioned(text: string, source: string): boolean {
  const needle = normalizedChinese(source);
  return needle.length >= 4 && normalizedChinese(text).includes(needle);
}

function shortHexagramName(name: string): string {
  if (name[1] === "为") return name[0]!;
  return name.replace(/^[天地雷风水火山泽]{2}/u, "");
}

/** 找出正文逐字引用到的卦辞、大象、爻辞。
 * 返回值直接用于提示词与确定性核对。 */
export function findZhouyiEnglishReferences(text: string): ZhouyiEnglishReference[] {
  const found: ZhouyiEnglishReference[] = [];
  const explicit = new Set<number>();
  ZHOUYI_CORPUS.forEach((hexagram, index) => {
    const short = shortHexagramName(hexagram.name);
    if (text.includes(hexagram.name) || text.includes(`${short}卦`)) explicit.add(index);
  });
  const seenChinese = new Set<string>();
  const include = (hexagramIndex: number, chinese: string): boolean => {
    if (explicit.size > 0 && !explicit.has(hexagramIndex)) return false;
    if (!mentioned(text, chinese)) return false;
    const normalized = normalizedChinese(chinese);
    if (seenChinese.has(normalized)) return false;
    seenChinese.add(normalized);
    return true;
  };
  for (let hexagramIndex = 0; hexagramIndex < ZHOUYI_CORPUS.length; hexagramIndex += 1) {
    const chinese = ZHOUYI_CORPUS[hexagramIndex]!;
    const english = ZHOUYI_ENGLISH[hexagramIndex]!;
    if (include(hexagramIndex, chinese.judgement)) {
      found.push({ kingWen: english.kingWen, kind: "judgement",
        chinese: chinese.judgement, english: english.judgement });
    }
    if (include(hexagramIndex, DAXIANG[hexagramIndex]!)) {
      found.push({ kingWen: english.kingWen, kind: "image",
        chinese: DAXIANG[hexagramIndex]!, english: english.image });
    }
    chinese.lines.forEach((line, index) => {
      if (include(hexagramIndex, line.text)) {
        found.push({ kingWen: english.kingWen, kind: "line", index,
          chinese: line.text, english: english.lines[index]! });
      }
    });
    chinese.extras.forEach((line, index) => {
      if (include(hexagramIndex, line.text)) {
        found.push({ kingWen: english.kingWen, kind: "extra", index,
          chinese: line.text, english: english.extras[index]! });
      }
    });
  }
  return found;
}
