// src/sanyi/bazi-audit.ts
import { baziRelationWords } from "../calendar/bazi-relations.js";
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
  return tokenizeClaim(text, [...vocabulary]).filter((word) => {
    // 八字核对干支、十神、关系等完整词，不把问事的“体、用、相”等单字当成事实。
    return vocabulary.has(word) || /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]$/u.test(word)
      || /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(word);
  }).map((word) => aliases.get(word) ?? word);
}
function union(facts: FactTable): Set<string> {
  return new Set([...facts.values()].flatMap((fact) => [...fact.tokens]));
}
export function auditBaziOutput(output: BaziSchoolOutput, facts: FactTable): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  function check(text: string, allowed: ReadonlySet<string>, label: string): void {
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
    check(evidence.claim, fact.tokens, evidence.ref);
  }
  // 正文只能用原局、运和锚年；窗口其它年份不会为总断虚构关系背书。
  const currentFacts = new Map([...facts].filter(([id]) => !/^year:\d{4}$/u.test(id)));
  const prose = [output.useGod, output.headline, output.reason,
    ...output.sections.flatMap((section) => [section.title, section.text]), ...output.advice];
  if ("timing" in output && output.timing) {
    prose.push(output.timing.window, output.timing.condition);
  }
  check(prose.join("\n"), union(currentFacts), "正文");
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
