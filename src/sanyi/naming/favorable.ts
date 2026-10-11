import { ELEMENTS, type Element } from "./lexicon.js";

export type ElementCounts = Record<Element, number>;

export const ELEMENT_VIRTUES: Readonly<Record<Element, string>> = {
  木: "木主仁：仁爱上进、生机勃勃",
  火: "火主礼：热情有礼、开朗明快",
  土: "土主信：诚信稳重、宽厚包容",
  金: "金主义：果断重义、坚毅有守",
  水: "水主智：聪慧灵动、善思通达",
};

const STEM_ELEMENTS: Readonly<Record<string, Element>> = {
  甲: "木", 乙: "木",
  丙: "火", 丁: "火",
  戊: "土", 己: "土",
  庚: "金", 辛: "金",
  壬: "水", 癸: "水",
};

const BRANCH_ELEMENTS: Readonly<Record<string, Element>> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木",
  辰: "土", 巳: "火", 午: "火", 未: "土",
  申: "金", 酉: "金", 戌: "土", 亥: "水",
};

const INDUSTRIES: ReadonlyArray<{ element: Element; keywords: readonly string[] }> = [
  { element: "火", keywords: ["餐饮", "火锅", "烧烤", "咖啡", "烘焙", "灯具", "能源", "传媒"] },
  { element: "水", keywords: ["茶", "饮品", "酒", "水产", "物流", "旅游", "清洁"] },
  {
    element: "木",
    keywords: ["教育", "书店", "出版", "文化", "花艺", "园林", "家具", "服装", "中医药"],
  },
  { element: "金", keywords: ["金融", "科技", "软件", "汽车", "五金", "珠宝", "机械"] },
  { element: "土", keywords: ["地产", "建筑", "农业", "陶瓷", "仓储", "家政", "物业"] },
];

const INDUSTRY_KEYWORDS = INDUSTRIES.flatMap(({ element, keywords }) => (
  keywords.map((keyword) => ({ element, keyword }))
)).sort((left, right) => [...right.keyword].length - [...left.keyword].length);

export function stemElement(stem: string): Element {
  const element = STEM_ELEMENTS[stem];
  if (!element) {
    throw new Error(`未知天干：${stem}`);
  }
  return element;
}

export function favorableFromTiaohou(stems: readonly string[]): Element[] {
  const result: Element[] = [];
  for (const stem of stems) {
    const element = stemElement(stem);
    if (!result.includes(element)) {
      result.push(element);
    }
    if (result.length === 2) {
      break;
    }
  }
  return result;
}

export function eightCharCounts(pillars: {
  year: string;
  month: string;
  day: string;
  time: string | null;
}): ElementCounts {
  const counts: ElementCounts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pillar of [pillars.year, pillars.month, pillars.day, pillars.time]) {
    if (!pillar) continue;
    const stem = pillar.charAt(0);
    const branch = pillar.charAt(1);
    const stemValue = STEM_ELEMENTS[stem];
    const branchValue = BRANCH_ELEMENTS[branch];
    if (!stemValue || !branchValue) throw new Error(`未知干支：${pillar}`);
    counts[stemValue] += 1;
    counts[branchValue] += 1;
  }
  return counts;
}

function distinctTiaohou(stems: readonly string[]): Array<{ stem: string; element: Element }> {
  const seen = new Set<Element>();
  return stems.flatMap((stem) => {
    const element = stemElement(stem);
    if (seen.has(element)) return [];
    seen.add(element);
    return [{ stem, element }];
  });
}

export function supplementElements(input: {
  counts: ElementCounts;
  tiaohou: readonly string[];
}): {
  favorable: Element[];
  favorableSource: "missing" | "tiaohou";
  missing: Element[];
  favorableNote: string;
} {
  const missing = ELEMENTS.filter((element) => input.counts[element] === 0);
  const tiaohou = distinctTiaohou(input.tiaohou);
  if (missing.length === 0) {
    const selected = tiaohou.slice(0, 2);
    const favorable = selected.map(({ element }) => element);
    return {
      favorable,
      favorableSource: "tiaohou",
      missing,
      favorableNote: `八字五行俱全，按调候取${selected.map(({ stem }) => stem).join("、")}，宜补${favorable.join("、")}`,
    };
  }
  const favoredMissing = missing.filter((element) => tiaohou.some((item) => item.element === element));
  const otherMissing = missing.filter((element) => !favoredMissing.includes(element));
  const favorable = [...favoredMissing, ...otherMissing].slice(0, 2);
  let favorableNote = `八字缺${missing.join("、")}，宜补${missing.slice(0, 2).join("、")}`;
  if (missing.length === 1) {
    const extra = tiaohou.find(({ element }) => element !== missing[0]);
    if (extra) {
      favorable.push(extra.element);
      favorableNote += `；调候喜${extra.element}，兼补${extra.element}`;
    }
  }
  return { favorable, favorableSource: "missing", missing, favorableNote };
}

export function industryElement(text: string): { element: Element; keyword: string } | null {
  const found = INDUSTRY_KEYWORDS.find(({ keyword }) => text.includes(keyword));
  return found ? { element: found.element, keyword: found.keyword } : null;
}
