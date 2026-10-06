// src/sanyi/audit.ts
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
const COMBINATION = new RegExp(
  "([子丑寅卯辰巳午未申酉戌亥])"+
  "([金木水火土])"+
  "(父母|子孙|官鬼|妻财|兄弟)",
  "g",
);

export function tokenizeClaim(text: string, extraWords: readonly string[] = []): string[] {
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

export function auditOutput(
  output: QuestionSchoolOutput,
  facts: FactTable,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const evidence of output.evidence) {
    const fact = facts.get(evidence.ref);
    if (!fact) {
      errors.push(`事实编号不存在：${evidence.ref}`);
      continue;
    }
    for (const token of tokenizeClaim(evidence.claim)) {
      if (!fact.tokens.has(token)) {
        errors.push(`${evidence.ref} 不支持关键词：${token}`);
      }
    }
  }
  const lineTokens = [...facts]
    .filter(([id]) => id.startsWith("line:"))
    .map(([, fact]) => fact.tokens);
  const prose = [
    output.headline,
    output.reason,
    ...output.sections.map((section) => section.text),
  ].join("\n");
  for (const match of prose.matchAll(COMBINATION)) {
    const tokens = match.slice(1);
    if (!lineTokens.some((set) => tokens.every((token) => set.has(token)))) {
      errors.push(`正文出现不存在的盘面组合：${match[0]}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
