// src/sanyi/bazi-audit.ts
import { NON_GANZHI_WORDS } from "./common-words.js";
import { baziRelationWords } from "../calendar/bazi-relations.js";
import lunarPkg from "lunar-javascript";
import { tokenizeGanzhiClaim as tokenizeClaim } from "./audit.js";
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
function textErrors(text: string, allowed: ReadonlySet<string>, label: string): string[] {
  const errors: string[] = [];
  for (const error of hiddenStemErrors(text)) {
    errors.push(`${label} ${error}`);
  }
  for (const word of words(text)) {
    if (!allowed.has(word)) {
      errors.push(`${label} 不支持关键词：${word}`);
    }
  }
  return errors;
}

/** 引证与正文共享该家当前事实；窗口其它年份不能为跨柱断语背书。 */
function currentTokens(facts: FactTable): Set<string> {
  return union(new Map([...facts].filter(([id]) => !/^year:\d{4}$/u.test(id))));
}

/** 核对一条引证：编号存在、可锚定时至少一词属于所引事实、其余关键词属于当前事实、藏干归属正确。 */
export function auditBaziEvidence(evidence: { ref: string; claim: string }, facts: FactTable): string[] {
  const fact = facts.get(evidence.ref);
  if (!fact) {
    return ["事实编号不存在，请使用所供事实表中的 ref"];
  }
  const errors: string[] = [];
  const keywords = words(evidence.claim);
  // 所引事实本身没有可核对词（如五行计数只有金木水火土）时无从锚定，只做全盘存在核对。
  const anchorable = words([...fact.tokens].join(" ")).length > 0;
  if (anchorable && keywords.length > 0 && !keywords.some((word) => fact.tokens.has(word))) {
    errors.push(`${evidence.ref} 引证与所引事实无关`);
  }
  const allowed = new Set([...currentTokens(facts), ...fact.tokens]);
  errors.push(...textErrors(evidence.claim, allowed, evidence.ref));
  return errors;
}

/** 核对一段正文：关键词只认原局、运与锚年事实；缺时柱时不得把干支归给时柱、命宫或身宫。 */
export function auditBaziProse(text: string, facts: FactTable): string[] {
  const errors = textErrors(text, currentTokens(facts), "正文");
  // 同名干支可能属于合法大运，缺时柱时仍拒绝将其归给时柱、命宫或身宫。
  if (facts.has("chart:limit") && /(?:时柱|命宫|身宫)[^。；\n]{0,8}[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/u
    .test(text)) {
    errors.push("缺时柱，不得引用时柱、命宫或身宫干支");
  }
  return errors;
}

/** 核对一年短评：只认该年流年事实与原局事实。 */
export function auditBaziNote(item: { year: number; note: string }, facts: FactTable): string[] {
  const year = facts.get(`year:${item.year}`);
  if (!year) {
    return [`${item.year} 年事实不存在`];
  }
  const natal = new Map([...facts].filter(([id, fact]) => isNatalFact(id, fact.label)));
  return textErrors(item.note, new Set([...union(natal), ...year.tokens]), `${item.year} 年短评`);
}

/** 各家正文（直断、理由、详断、建议、应期）汇成一段，供核对与修补共用。 */
export function baziProse(output: BaziSchoolOutput): string[] {
  const prose = [output.useGod, output.headline, output.reason,
    ...output.sections.flatMap((section) => [section.title, section.text]), ...output.advice];
  if ("timing" in output && output.timing) {
    prose.push(output.timing.window, output.timing.condition);
  }
  return prose;
}

export function auditBaziOutput(output: BaziSchoolOutput, facts: FactTable): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  for (const evidence of output.evidence) {
    errors.push(...auditBaziEvidence(evidence, facts));
  }
  const prose = baziProse(output).join("\n");
  errors.push(...auditBaziProse(prose, facts));
  if (facts.has("chart:limit") && !/缺时柱|时辰未知/u.test(prose)) {
    errors.push("缺时柱时须说明判断限制");
  }
  if ("years" in output) {
    for (const item of output.years) {
      errors.push(...auditBaziNote(item, facts));
    }
  }
  return { ok: errors.length === 0, errors };
}
