// src/sanyi/audit.ts
import { ZHOUYI_CORPUS } from "../agent/zhouyi-corpus.js";
import { deriveMeihua } from "../calendar/meihua.js";
import { NON_GANZHI_WORDS } from "./common-words.js";
import type { FactTable } from "./facts.js";
import type { QuestionSchoolOutput } from "./schema.js";

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const CYCLE = Array.from({ length: 60 }, (_, index) => {
  return `${STEMS[index % 10]}${BRANCHES[index % 12]}`;
});
const WORDS = [
  "回头生", "回头克",
  "父母", "子孙", "官鬼", "妻财", "兄弟",
  "青龙", "朱雀", "勾陈", "螣蛇", "白虎", "玄武",
  "旬空", "月破", "日破", "暗动", "进神", "退神",
  "用神", "原神", "忌神", "仇神",
  ...CYCLE,
  ...STEMS,
  ...BRANCHES,
  ..."金木水火土旺相休囚死世应伏动体用",
].sort((left, right) => right.length - left.length);
const QUESTION_WORDS = [
  ...ZHOUYI_CORPUS.map((hexagram) => hexagram.name),
  // 从既有体用算法读取八卦名与五行，避免维护第二份对照表。
  ...Array.from({ length: 8 }, (_, index) => {
    const lines = Array.from({ length: 6 }, (_, position) => ((index >> (position % 3)) & 1) ? 7 : 8);
    const { body } = deriveMeihua(lines, 1791288000n);
    return [body.name, `${body.name}${body.element}`];
  }).flat(),
  "日辰", "月建",
];
const COMBINATION = new RegExp(
  "([子丑寅卯辰巳午未申酉戌亥])"+
  "([金木水火土])"+
  "(父母|子孙|官鬼|妻财|兄弟)",
  "g",
);

export function tokenizeGanzhiClaim(text: string, extraWords: readonly string[] = []): string[] {
  const words = [...new Set([...WORDS, ...extraWords])].sort((left, right) => right.length - left.length);
  const tokens: string[] = [];
  for (let index = 0; index < text.length;) {
    const token = words.find((candidate) => text.startsWith(candidate, index));
    if (token) {
      tokens.push(token);
      index += token.length;
    } else {
      index += 1;
    }
  }
  return tokens;
}

export function tokenizeClaim(text: string, extraWords: readonly string[] = []): string[] {
  return tokenizeGanzhiClaim(text, [...QUESTION_WORDS, ...extraWords]);
}

const QUESTION_COMMON_WORDS = new Set([
  ...[...NON_GANZHI_WORDS].filter((word) => word !== "子孙"),
  "未明", "未定",
]);
const REF_ALIASES: Record<string, string> = {
  本卦: "hexagram:primary",
  之卦: "hexagram:derived",
  变卦: "hexagram:derived",
  互卦: "hexagram:mutual",
  错卦: "hexagram:opposite",
  综卦: "hexagram:reversed",
  主占之辞: "main-text",
  主占: "main-text",
  月建: "month",
  日辰: "day",
  体用: "body-use",
};

function resolveRef(ref: string, facts: FactTable): string {
  const trimmed = ref.trim();
  if (facts.has(trimmed)) {
    return trimmed;
  }
  // 先保留含冒号的完整事实编号，再剥离附抄的标签。
  for (const id of facts.keys()) {
    if (trimmed.startsWith(id) && /^[：:\s]/u.test(trimmed.slice(id.length))) {
      return id;
    }
  }
  const prefix = trimmed.split(/[：:\s]/u)[0]!;
  const alias = REF_ALIASES[prefix];
  if (alias) {
    return alias;
  }
  const line = prefix.match(/^([1-6一二三四五六初上])爻$/u);
  if (line) {
    const position = "一二三四五六".indexOf(line[1]!) + 1;
    return `line:${line[1] === "初" ? 1 : line[1] === "上" ? 6 : position || line[1]}`;
  }
  return prefix;
}

function stripOriginals(text: string, originals: readonly string[]): string {
  // 只移除服务端原文正文中连续四字以上的逐字片段，不信任模型声明的引文。
  const sources = originals.map((original) => original.slice(original.indexOf("：") + 1));
  let result = "";
  for (let index = 0; index < text.length;) {
    let length = 0;
    for (const source of sources) {
      for (let start = 0; start < source.length; start += 1) {
        let matched = 0;
        while (index + matched < text.length && source[start + matched] === text[index + matched]) {
          matched += 1;
        }
        length = Math.max(length, matched);
      }
    }
    if (length >= 4) {
      result += " ";
      index += length;
    } else {
      result += text[index];
      index += 1;
    }
  }
  return result;
}

function questionWords(text: string): string[] {
  return tokenizeClaim(text, [...QUESTION_COMMON_WORDS]).filter((word) => !QUESTION_COMMON_WORDS.has(word));
}

export function auditOutput(
  output: QuestionSchoolOutput,
  facts: FactTable,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const allTokens = new Set([...facts.values()].flatMap((fact) => [...fact.tokens]));
  const lineTokens = [...facts]
    .filter(([id]) => id.startsWith("line:"))
    .map(([, fact]) => fact.tokens);
  const originals = facts.originalTexts ?? [];
  for (const evidence of output.evidence) {
    const ref = resolveRef(evidence.ref, facts);
    const fact = facts.get(ref);
    if (!fact) {
      errors.push(`事实编号不存在：${evidence.ref}`);
      continue;
    }
    const claim = stripOriginals(evidence.claim, originals);
    const keywords = questionWords(claim);
    const anchorable = questionWords([...fact.tokens].join(" ")).length > 0;
    if (anchorable && keywords.length > 0 && !keywords.some((word) => fact.tokens.has(word))) {
      errors.push(`${evidence.ref} 引证与所引事实无关`);
    }
    for (const token of keywords) {
      if (!allTokens.has(token)) {
        errors.push(`${evidence.ref} 不支持关键词：${token}`);
      }
    }
    // 明确归属于所引爻的组合及状态仍须属实，不能借其它爻为错误爻位背书。
    if (ref.startsWith("line:")) {
      for (const match of claim.matchAll(COMBINATION)) {
        if (!match.slice(1).every((token) => fact.tokens.has(token))) {
          errors.push(`${evidence.ref} 不支持盘面组合：${match[0]}`);
        }
      }
      if ([...claim.matchAll(COMBINATION)].length > 0) {
        for (const token of keywords.filter((word) => ["旬空", "月破", "日破", "动", "暗动"].includes(word))) {
          if (!fact.tokens.has(token)) {
            errors.push(`${evidence.ref} 不支持关键词：${token}`);
          }
        }
      }
    } else {
      // 引用月建、卦名等非爻事实时，顺带写出的「地支五行六亲」组合也必须真实存在于某一爻。
      for (const match of claim.matchAll(COMBINATION)) {
        const tokens = match.slice(1);
        if (!lineTokens.some((set) => tokens.every((token) => set.has(token)))) {
          errors.push(`${evidence.ref} 不支持盘面组合：${match[0]}`);
        }
      }
    }
  }
  const prose = stripOriginals([
    output.headline,
    output.reason,
    ...output.sections.map((section) => section.text),
  ].join("\n"), originals);
  for (const match of prose.matchAll(COMBINATION)) {
    const tokens = match.slice(1);
    if (!lineTokens.some((set) => tokens.every((token) => set.has(token)))) {
      errors.push(`正文出现不存在的盘面组合：${match[0]}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
