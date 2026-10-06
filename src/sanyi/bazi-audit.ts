// src/sanyi/bazi-audit.ts
import { baziRelationWords } from "../calendar/bazi-relations.js";
import lunarPkg from "lunar-javascript";
import { tokenizeClaim } from "./audit.js";
import { isNatalFact } from "./bazi-facts.js";
import type { BaziSchoolOutput } from "./bazi-schema.js";
import type { FactTable } from "./facts.js";
const aliases = new Map<string, string>();
for (const word of baziRelationWords()) {
  aliases.set(word, word);
  if (!word.includes("三合") && !word.includes("三会")) {
    aliases.set(word.charAt(1) + word.charAt(0) + word.slice(2), word);
  }
  // 行文常把半合、拱合简称「巳酉合金」「申辰合水」，按同局同五行归一，五行不符的不放行。
  const partial = word.match(/^(.)(.)(?:半合|拱)(.)$/u);
  if (partial) {
    const [, left, right, element] = partial;
    aliases.set(`${left}${right}合${element}`, word);
    aliases.set(`${right}${left}合${element}`, word);
  }
}
const EXTRA_WORDS = [
  ...aliases.keys(), "比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印", "日主",
  "天乙贵人", "文昌", "桃花", "驿马", "华盖", "羊刃", "禄神",
  ...[..."甲乙丙丁戊己庚辛壬癸"].flatMap((stem, index) => {
    return [..."春夏秋冬"].map((season) => `三${season}${stem}${"木木火火土土金金水水".charAt(index)}`);
  }),
];
// 常用词整体参与最长匹配，但不作为干支事实核对；干支术语仍保留。
const NON_GANZHI_WORDS = new Set([
  "未透干", "未透", "未见", "未得", "未成", "未能", "未必", "未有", "未曾", "尚未", "并未", "从未", "未来", "未免",
  "子女", "孩子", "儿子", "女子", "男子", "君子", "日子", "样子", "房子", "妻子", "子孙",
  "自己", "知己", "己见", "异己",
  "辛苦", "辛劳", "辛勤", "艰辛",
  "申请", "申报", "申明", "重申",
  "中午", "上午", "下午", "午后", "正午",
  "生辰", "时辰", "良辰", "辰光",
  "人丁", "园丁", "丁点",
  "甲方", "指甲", "盔甲", "乙方", "小丑", "丑陋", "卯足",
]);
const RELATION_PHRASE = new RegExp(
  "[子丑寅卯辰巳午未申酉戌亥]{3}(?:三合|三会)[金木水火土]"
  + "|[子丑寅卯辰巳午未申酉戌亥]{2}(?:半合|拱)[金木水火土]"
  + "|[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{2}(?:自刑|合|冲|害|破|刑)",
  "gu",
);
function words(text: string): string[] {
  // 语法上像关系的词也作为整体候选，避免不存在的关系拆成合法单字后过关。
  // 分词仍由 1A 的最长匹配循环完成；有效关系再按通行标签归一化。
  const candidates = [...text.matchAll(RELATION_PHRASE)].map((match) => match[0]);
  const vocabulary = new Set([...EXTRA_WORDS, ...candidates]);
  return tokenizeClaim(text, [...vocabulary, ...NON_GANZHI_WORDS]).filter((word) => {
    if (NON_GANZHI_WORDS.has(word)) {
      return false;
    }
    // 八字核对干支、十神、关系等完整词，不把问事的“体、用、相”等单字当成事实。
    return vocabulary.has(word) || /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]$/u.test(word)
      || /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(word);
  }).map((word) => aliases.get(word) ?? word);
}
function union(facts: FactTable): Set<string> {
  return new Set([...facts.values()].flatMap((fact) => [...fact.tokens]));
}
function hiddenStemErrors(text: string): string[] {
  const stems = "[甲乙丙丁戊己庚辛壬癸]";
  const branches = "[子丑寅卯辰巳午未申酉戌亥]";
  const stemItem = `${stems}[金木水火土]?(?:比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印)?`;
  // 只解析紧邻连接词的干支与明确列举，不跨越自由正文或逗号寻找天干。
  const branchFirst = new RegExp(`(${branches}+)(?:[中内]藏?|藏)(${stemItem}(?:[、与和及]?${stemItem})*)`, "gu");
  // 复用普通词表，避免将“藏辰未透”里的“未透”算作第二个地支。
  const branchItem = `(?!(?:${[...NON_GANZHI_WORDS].join("|")}))${branches}`;
  const stemFirst = new RegExp(`(${stems})[金木水火土]?藏(?:于)?((?:${branchItem})+)(?:[中内])?`, "gu");
  const errors = new Set<string>();
  function check(branchList: string, stemList: string): void {
    for (const branch of branchList) {
      for (const stem of stemList.match(new RegExp(stems, "gu")) ?? []) {
        if (!lunarPkg.LunarUtil.ZHI_HIDE_GAN[branch]?.includes(stem)) {
          errors.add(`${branch}中不藏${stem}`);
        }
      }
    }
  }
  for (const match of text.matchAll(branchFirst)) {
    check(match[1]!, match[2]!);
  }
  for (const match of text.matchAll(stemFirst)) {
    check(match[2]!, match[1]!);
  }
  return [...errors];
}
export function auditBaziOutput(output: BaziSchoolOutput, facts: FactTable): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  // 引证与正文共享该家当前事实，窗口其它年份不能为跨柱断语背书。
  const currentFacts = new Map([...facts].filter(([id]) => !/^year:\d{4}$/u.test(id)));
  const currentTokens = union(currentFacts);
  function check(text: string, allowed: ReadonlySet<string>, label: string): void {
    for (const error of hiddenStemErrors(text)) {
      errors.push(`${label} ${error}`);
    }
    for (const word of words(text)) {
      if (!allowed.has(word)) {
        errors.push(`${label} 不支持关键词：${word}`);
      }
    }
  }
  for (const evidence of output.evidence) {
    const fact = facts.get(evidence.ref);
    if (!fact) {
      errors.push("事实编号不存在，请使用所供事实表中的 ref");
      continue;
    }
    const keywords = words(evidence.claim);
    // 所引事实本身没有可核对词（如五行计数只有金木水火土）时无从锚定，只做全盘存在核对。
    const anchorable = words([...fact.tokens].join(" ")).length > 0;
    if (anchorable && keywords.length > 0 && !keywords.some((word) => fact.tokens.has(word))) {
      errors.push(`${evidence.ref} 引证与所引事实无关`);
    }
    check(evidence.claim, new Set([...currentTokens, ...fact.tokens]), evidence.ref);
  }
  // 正文只能用原局、运和锚年；窗口其它年份不会为总断虚构关系背书。
  const prose = [output.useGod, output.headline, output.reason,
    ...output.sections.flatMap((section) => [section.title, section.text]), ...output.advice];
  if ("timing" in output && output.timing) {
    prose.push(output.timing.window, output.timing.condition);
  }
  check(prose.join("\n"), currentTokens, "正文");
  // 同名干支可能属于合法大运，缺时柱时仍拒绝将其归给时柱、命宫或身宫。
  if (facts.has("chart:limit") && /(?:时柱|命宫|身宫)[^。；\n]{0,8}[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/u
    .test(prose.join("\n"))) {
    errors.push("缺时柱，不得引用时柱、命宫或身宫干支");
  }
  if (facts.has("chart:limit") && !/缺时柱|时辰未知/u.test(prose.join("\n"))) {
    errors.push("缺时柱时须说明判断限制");
  }
  if ("years" in output) {
    const natal = new Map([...facts].filter(([id, fact]) => isNatalFact(id, fact.label)));
    for (const item of output.years) {
      const year = facts.get(`year:${item.year}`);
      if (!year) {
        errors.push(`${item.year} 年事实不存在`);
        continue;
      }
      const allowed = new Set([...union(natal), ...year.tokens]);
      check(item.note, allowed, `${item.year} 年短评`);
    }
  }
  return { ok: errors.length === 0, errors };
}
