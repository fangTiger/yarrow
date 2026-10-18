import { HEXAGRAMS_EN } from "../../src/sanyi/i18n/glossary.js";

/** G1 与 G2 共用的静态卦页路径规则。 */
export function hexagramPath(kingWenNumber: number): string {
  const item = HEXAGRAMS_EN[kingWenNumber - 1];
  if (!item) throw new Error(`未知文王序：${kingWenNumber}`);
  const slug = item.pinyin.normalize("NFD").replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return `/hexagram/${kingWenNumber}-${slug}/`;
}
