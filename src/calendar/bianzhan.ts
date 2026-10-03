// src/calendar/bianzhan.ts
import { getHexagramText, type ZhouyiLineText } from "../agent/zhouyi-corpus.js";
import { deriveFiveHexagrams } from "../oracle/liuyao-chart.js";

export interface OracleSelection {
  rule: string;
  primary: ZhouyiLineText;
  secondary: readonly ZhouyiLineText[];
}
const judgement = (label: string, text: string): ZhouyiLineText => ({ label, text });

export function selectPrimaryOracleText(lines: readonly number[]): OracleSelection {
  const five = deriveFiveHexagrams(lines);
  const primary = getHexagramText(five.primary.kingWenNumber);
  const derived = getHexagramText(five.derived.kingWenNumber);
  const moving = lines
    .map((value, index) => value === 6 || value === 9 ? index : -1)
    .filter((index) => index >= 0);
  const still = lines.map((_, index) => index).filter((index) => !moving.includes(index));
  if (moving.length === 0) {
    return {
      rule: "本卦卦辞",
      primary: judgement("卦辞", primary.judgement),
      secondary: [],
    };
  }
  if (moving.length === 1) {
    return { rule: "本卦爻辞", primary: primary.lines[moving[0]!]!, secondary: [] };
  }
  if (moving.length === 2) {
    return {
      rule: "本卦两爻辞",
      primary: primary.lines[moving[1]!]!,
      secondary: [primary.lines[moving[0]!]!],
    };
  }
  if (moving.length === 3) return {
    rule: "本卦与之卦卦辞",
    primary: judgement("卦辞", primary.judgement),
    secondary: [judgement("之卦卦辞", derived.judgement)],
  };
  if (moving.length === 4) {
    return {
      rule: "之卦两不动爻辞",
      primary: derived.lines[still[0]!]!,
      secondary: [derived.lines[still[1]!]!],
    };
  }
  if (moving.length === 5) {
    return { rule: "之卦不动爻辞", primary: derived.lines[still[0]!]!, secondary: [] };
  }
  const special = primary.kingWenNumber === 1 ? "用九" : primary.kingWenNumber === 2 ? "用六" : null;
  if (!special) {
    return {
      rule: "之卦卦辞",
      primary: judgement("之卦卦辞", derived.judgement),
      secondary: [],
    };
  }
  const extra = primary.extras.find((item) => item.label === special);
  if (!extra) throw new Error(`${primary.name}语料缺少${special}`);
  return { rule: special, primary: extra, secondary: [] };
}
