import { ZHOUYI_CORPUS } from "../../agent/zhouyi-corpus.js";
import { findZhouyiEnglishReferences } from "../../agent/zhouyi-en.js";
import {
  BRANCHES_EN, ELEMENTS_EN, GLOSSARY_VERSION, HEXAGRAMS_EN, SIX_RELATIVES_EN,
  SIX_SPIRITS_EN, STEMS_EN, TEN_GODS_EN, TERMS_EN, TRIGRAMS_EN, VERDICTS_EN,
} from "../i18n/glossary.js";
import type { TranslationUnit } from "./units.js";

export const PROMPT_VERSION = 2;

export interface GlossaryRequirement {
  source: string;
  english: string;
  display: string;
  /** 只有两字以上的专业术语强制使用规定译名；单字（五行、八卦、干支）、六亲与吉凶在日常用词里
   * 太常见（金钱、孩子、平安、兄弟），只作提示词参考，不强制。 */
  enforced: boolean;
}

function pair(source: string, english: string, display = english, enforced = false): GlossaryRequirement {
  return { source, english, display, enforced: enforced && [...source].length >= 2 };
}

const GLOSSARY: readonly GlossaryRequirement[] = [
  ...Object.entries(ELEMENTS_EN).map(([source, english]) => pair(source, english)),
  ...Object.entries(TRIGRAMS_EN).map(([source, value]) => (
    pair(source, value.pinyin, `${value.pinyin} (${value.image})`)
  )),
  ...ZHOUYI_CORPUS.map((value, index) => {
    const english = HEXAGRAMS_EN[index]!;
    return pair(value.name, english.pinyin, `${english.pinyin} · ${english.title}`, true);
  }),
  ...Object.entries(STEMS_EN).map(([source, english]) => pair(source, english)),
  ...Object.entries(BRANCHES_EN).map(([source, value]) => (
    pair(source, value.pinyin, `${value.pinyin} (${value.animal})`)
  )),
  ...Object.entries(TEN_GODS_EN).map(([source, english]) => pair(source, english, english, true)),
  ...Object.entries(SIX_RELATIVES_EN).map(([source, english]) => pair(source, english)),
  ...Object.entries(SIX_SPIRITS_EN).map(([source, english]) => pair(source, english, english, true)),
  ...Object.entries(VERDICTS_EN).map(([source, english]) => pair(source, english)),
  ...Object.entries(TERMS_EN).map(([source, value]) => (
    pair(source, value.pinyin, `${value.pinyin} (${value.gloss})`, true)
  )),
];

/** 较长词优先；同一原词以 TERMS_EN 的专门写法覆盖通用分类。 */
export function glossaryRequirements(
  text: string,
  ignoredHan: readonly string[] = [],
): GlossaryRequirement[] {
  const sourceText = ignoredHan
    .filter((item) => [...item].length > 1)
    .sort((a, b) => b.length - a.length)
    .reduce((rest, item) => rest.split(item).join(""), text);
  const bySource = new Map<string, GlossaryRequirement>();
  for (const item of GLOSSARY) {
    if (sourceText.includes(item.source)) bySource.set(item.source, item);
  }
  return [...bySource.values()].sort((a, b) => b.source.length - a.source.length);
}

export const TRANSLATION_SYSTEM_PROMPT = `你是三易的中译英译者。
只翻译给出的正文，不补充事实，不输出中文解释。
必须保留阿拉伯数字与四位年份，并使用随附术语和古文固定译文；专业术语首次出现时写「拼音（释义）」，之后可只写拼音；单字五行、八卦、干支在日常用语里按词义自然翻译。
名字及白名单汉字可原样保留并附拼音；其余译文不得含汉字。
输出必须严格符合 JSON Schema，texts 与输入逐项对应。`;

export function buildTranslationPrompt(unit: TranslationUnit): string {
  const text = unit.entries.map((entry) => entry.text).join("\n");
  const glossary = glossaryRequirements(text, unit.allowedHan).map(({ source, display }) => ({
    source, english: display,
  }));
  const classics = unit.entries.flatMap((entry, index) => (
    findZhouyiEnglishReferences(entry.text).map((reference) => ({
      index, chinese: reference.chinese, english: reference.english,
    }))
  ));
  return [
    `提示词版本：${PROMPT_VERSION}；术语表版本：${GLOSSARY_VERSION}`,
    `允许保留的汉字：${JSON.stringify(unit.allowedHan)}`,
    `相关术语：${JSON.stringify(glossary)}`,
    `古文固定译文：${JSON.stringify(classics)}`,
    `待翻译清单：${JSON.stringify(unit.entries)}`,
    "仅输出与待翻译清单等长的 texts 数组。",
  ].join("\n");
}
