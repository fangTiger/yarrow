import rawCorpus from "./zhouyi-corpus.json" with { type: "json" };

export interface ZhouyiLineText {
  label: string;
  text: string;
}

export interface ZhouyiHexagramText {
  kingWenNumber: number;
  name: string;
  judgement: string;
  lines: readonly ZhouyiLineText[];
  extras: readonly ZhouyiLineText[];
}

interface RawHexagramText {
  gua_ci: string;
  yao: Record<string, string>;
}

/**
 * 文本来源：Johnson-Jia/liuyao-divination 的 data/zhouyi.json。
 * 上游声明卦辞与爻辞为公共领域原文，仓库代码使用 MIT 许可证；另以维基文库《周易》作版本参照。
 * 来源并不替代校勘：异体字、断句、注音与版本差异的最终准确性责任由本项目维护者承担。
 */
export const ZHOUYI_CORPUS_SOURCE = {
  data: "https://github.com/Johnson-Jia/liuyao-divination/blob/main/data/zhouyi.json",
  reference: "https://zh.wikisource.org/zh/周易",
  responsibility: "发布前须由项目方逐条校勘；当前文本含上游注音与断句，不声称是唯一权威版本。",
} as const;

const KING_WEN_NAMES = [
  "乾为天", "坤为地", "水雷屯", "山水蒙", "水天需", "天水讼", "地水师", "水地比",
  "风天小畜", "天泽履", "地天泰", "天地否", "天火同人", "火天大有", "地山谦", "雷地豫",
  "泽雷随", "山风蛊", "地泽临", "风地观", "火雷噬嗑", "山火贲", "山地剥", "地雷复",
  "天雷无妄", "山天大畜", "山雷颐", "泽风大过", "坎为水", "离为火", "泽山咸", "雷风恒",
  "天山遁", "雷天大壮", "火地晋", "地火明夷", "风火家人", "火泽睽", "水山蹇", "雷水解",
  "山泽损", "风雷益", "泽天夬", "天风姤", "泽地萃", "地风升", "泽水困", "水风井",
  "泽火革", "火风鼎", "震为雷", "艮为山", "风山渐", "雷泽归妹", "雷火丰", "火山旅",
  "巽为风", "兑为泽", "风水涣", "水泽节", "风泽中孚", "雷山小过", "水火既济", "火水未济",
] as const;

const source = rawCorpus as Record<string, RawHexagramText>;

export const ZHOUYI_CORPUS: readonly ZhouyiHexagramText[] = KING_WEN_NAMES.map((name, index) => {
  const entry = source[name];
  if (!entry) throw new Error(`周易语料缺少第 ${index + 1} 卦 ${name}`);
  const allLines = Object.entries(entry.yao).map(([label, text]) => ({ label, text }));
  if (allLines.length < 6) throw new Error(`周易语料 ${name} 的爻辞不足六条`);
  const positionLabels = [/^初[六九]$/, /^[六九]二$/, /^[六九]三$/, /^[六九]四$/, /^[六九]五$/, /^上[六九]$/];
  allLines.slice(0, 6).forEach((line, lineIndex) => {
    if (!positionLabels[lineIndex]!.test(line.label)) throw new Error(`周易语料 ${name} 第 ${lineIndex + 1} 爻标签错位`);
  });
  return {
    kingWenNumber: index + 1,
    name,
    judgement: entry.gua_ci,
    lines: allLines.slice(0, 6),
    extras: allLines.slice(6),
  };
});

export function getHexagramText(kingWenNumber: number): ZhouyiHexagramText {
  if (!Number.isInteger(kingWenNumber) || kingWenNumber < 1 || kingWenNumber > 64) {
    throw new Error(`未知文王序：${kingWenNumber}`);
  }
  return ZHOUYI_CORPUS[kingWenNumber - 1]!;
}
