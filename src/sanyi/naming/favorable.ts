import type { Element } from "./lexicon.js";

const STEM_ELEMENTS: Readonly<Record<string, Element>> = {
  甲: "木", 乙: "木",
  丙: "火", 丁: "火",
  戊: "土", 己: "土",
  庚: "金", 辛: "金",
  壬: "水", 癸: "水",
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

export function industryElement(text: string): { element: Element; keyword: string } | null {
  const found = INDUSTRY_KEYWORDS.find(({ keyword }) => text.includes(keyword));
  return found ? { element: found.element, keyword: found.keyword } : null;
}
