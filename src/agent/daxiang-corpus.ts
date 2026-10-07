// src/agent/daxiang-corpus.ts
import rawCorpus from "./daxiang-corpus.json" with { type: "json" };

/**
 * 《大象传》64 条，按文王卦序排列，用作解法的「心法」原文（设计文档 22.4）。
 * 底本为维基文库《周易/大象》（公版），以 OpenCC 繁转简；
 * 再与维基文库 64 个单卦页中的「象曰」逐条对照：异文只在标点与异体字（眾/衆、恒/恆、於/于），
 * 唯剥卦单卦页作「山附地上」，此处从通行本作「山附于地」。
 * ctext 网页拒绝抓取、接口需订阅，未作为对照来源。
 */
export const DAXIANG_SOURCE = {
  data: "https://zh.wikisource.org/wiki/周易/大象",
  reference: "https://zh.wikisource.org/wiki/周易",
  responsibility: "异体字、断句与版本差异的最终准确性责任由本项目维护者承担。",
} as const;

function validate(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length !== 64) {
    throw new Error("《大象传》语料必须有 64 条");
  }
  return value.map((text, index) => {
    if (typeof text !== "string" || !text.includes("以")) {
      throw new Error(`《大象传》第 ${index + 1} 条不合格`);
    }
    return text;
  });
}

export const DAXIANG: readonly string[] = validate(rawCorpus);

/** 按文王卦序取《大象传》原文。 */
export function getDaxiang(kingWenNumber: number): string {
  if (!Number.isInteger(kingWenNumber) || kingWenNumber < 1 || kingWenNumber > 64) {
    throw new Error(`未知文王序：${kingWenNumber}`);
  }
  return DAXIANG[kingWenNumber - 1]!;
}
