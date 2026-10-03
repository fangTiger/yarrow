// src/calendar/meihua.ts
import {
  deriveFiveHexagrams, deriveSolarMonth, FIVE_ELEMENT_GENERATES, FIVE_ELEMENT_OVERCOMES, strengthFor,
  type FiveElement, type PalaceName, type StrengthState,
} from "../oracle/liuyao-chart.js";

type Position = "upper" | "lower";
type Relation = "比和" | "体生用" | "用生体" | "体克用" | "用克体";
const CHANGED_RELATION: Record<Relation, string> = {
  比和: "变卦与体比和",
  体生用: "体生变卦",
  用生体: "变卦生体",
  体克用: "体克变卦",
  用克体: "变卦克体",
};
const TRIGRAMS: Record<number, { name: PalaceName; element: FiveElement }> = {
  0: { name: "坤", element: "土" },
  1: { name: "震", element: "木" },
  2: { name: "坎", element: "水" },
  3: { name: "兑", element: "金" },
  4: { name: "艮", element: "土" },
  5: { name: "离", element: "火" },
  6: { name: "巽", element: "木" },
  7: { name: "乾", element: "金" },
};
function trigram(lines: readonly boolean[]) {
  const number = lines.reduce((sum, yang, index) => sum + (yang ? 1 << index : 0), 0);
  return TRIGRAMS[number]!;
}
function relation(body: FiveElement, use: FiveElement): Relation {
  if (body === use) return "比和";
  if (FIVE_ELEMENT_GENERATES[body] === use) return "体生用";
  if (FIVE_ELEMENT_GENERATES[use] === body) return "用生体";
  return FIVE_ELEMENT_OVERCOMES[body] === use ? "体克用" : "用克体";
}
export interface MeihuaResult {
  body: { position: Position; name: PalaceName; element: FiveElement; strength: StrengthState };
  use: { position: Position; name: PalaceName; element: FiveElement };
  bodyUseRelation: Relation;
  mutual: { name: string; lower: PalaceName; upper: PalaceName };
  changed: { name: string; changedUse: { name: PalaceName; element: FiveElement }; relationToBody: string };
  rule: string;
}
export function deriveMeihua(lines: readonly number[], timestamp: bigint): MeihuaResult {
  const five = deriveFiveHexagrams(lines);
  const lowerMoves = lines.slice(0, 3).filter((value) => value === 6 || value === 9).length;
  const upperMoves = lines.slice(3).filter((value) => value === 6 || value === 9).length;
  const usePosition: Position = upperMoves > lowerMoves ? "upper" : "lower";
  const bodyPosition: Position = usePosition === "lower" ? "upper" : "lower";
  const lower = trigram(five.primary.yangLines.slice(0, 3));
  const upper = trigram(five.primary.yangLines.slice(3));
  const changedLower = trigram(five.derived.yangLines.slice(0, 3));
  const changedUpper = trigram(five.derived.yangLines.slice(3));
  const body = bodyPosition === "lower" ? lower : upper;
  const use = usePosition === "lower" ? lower : upper;
  const changedUse = usePosition === "lower" ? changedLower : changedUpper;
  const month = deriveSolarMonth(timestamp);
  return {
    body: { position: bodyPosition, ...body, strength: strengthFor(month.element, body.element) },
    use: { position: usePosition, ...use },
    bodyUseRelation: relation(body.element, use.element),
    mutual: {
      name: five.mutual.name,
      lower: trigram(five.primary.yangLines.slice(1, 4)).name,
      upper: trigram(five.primary.yangLines.slice(2, 5)).name,
    },
    changed: {
      name: five.derived.name,
      changedUse,
      relationToBody: CHANGED_RELATION[relation(body.element, changedUse.element)],
    },
    rule: "按本站体用取法；本站不采集外应",
  };
}
