// src/sanyi/original-texts.ts
import { getHexagramText } from "../agent/zhouyi-corpus.js";
import type { OracleSelection } from "../calendar/bianzhan.js";
import type { FiveHexagrams } from "../oracle/liuyao-chart.js";

function hexagramTexts(
  role: "本卦" | "之卦",
  figure: FiveHexagrams["primary"],
): string[] {
  const text = getHexagramText(figure.kingWenNumber);
  return [
    `${role} ${text.name} 卦辞：${text.judgement}`,
    ...text.lines.map((line) => {
      return `${role} ${text.name} ${line.label}：${line.text}`;
    }),
    ...text.extras.map((line) => {
      return `${role} ${text.name} ${line.label}：${line.text}`;
    }),
  ];
}

export function buildOriginalTexts(
  five: FiveHexagrams,
  selection: OracleSelection,
): string[] {
  return [
    ...hexagramTexts("本卦", five.primary),
    ...hexagramTexts("之卦", five.derived),
    `主占之辞 ${selection.primary.label}：${selection.primary.text}`,
    ...selection.secondary.map((item) => {
      return `辅占之辞 ${item.label}：${item.text}`;
    }),
  ];
}
