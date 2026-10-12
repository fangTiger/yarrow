import { findZhouyiEnglishReferences } from "../../agent/zhouyi-en.js";
import { glossaryRequirements } from "./prompt.js";
import type { TranslationUnit } from "./units.js";

export interface TranslationOutput {
  texts: string[];
}

export interface TranslationCheck {
  /** 全部合格（含软性）。 */
  ok: boolean;
  /** 没有硬性问题即可采用；软性问题记为警告。 */
  acceptable: boolean;
  invalidIndexes: number[];
  /** 有硬性问题的条目下标。 */
  hardIndexes: number[];
  errors: string[];
  hardErrors: string[];
  warnings: string[];
}

function exactNumberCount(text: string, token: string): number {
  const pattern = new RegExp(`(?<!\\d)${token}(?!\\d)`, "gu");
  return text.match(pattern)?.length ?? 0;
}

function unexpectedHan(text: string, allowed: readonly string[]): string[] {
  let rest = text;
  for (const item of [...allowed].sort((a, b) => b.length - a.length)) {
    rest = rest.split(item).join("");
  }
  return [...new Set(rest.match(/\p{Script=Han}/gu) ?? [])];
}

/** 四项确定性核对；invalidIndexes 可直接作为一次补译的最小输入。 */
export function checkTranslation(unit: TranslationUnit, output: unknown): TranslationCheck {
  const texts = output && typeof output === "object" && !Array.isArray(output)
    && Array.isArray((output as { texts?: unknown }).texts)
    ? (output as { texts: unknown[] }).texts
    : [];
  // 硬性：条数、缺译、汉字、四位年份——不满足就不能给用户看。
  // 软性：其他数字、术语、古文一致性——先补译一次，仍不满足也采用，记为警告。
  const hardErrors: string[] = [];
  const warnings: string[] = [];
  const invalid = new Set<number>();
  const hard = new Set<number>();
  const fail = (index: number, message: string, isHard: boolean) => {
    (isHard ? hardErrors : warnings).push(message);
    invalid.add(index);
    if (isHard) hard.add(index);
  };
  if (texts.length !== unit.entries.length) {
    hardErrors.push(`译文条数应为 ${unit.entries.length}，实际为 ${texts.length}`);
    for (let index = texts.length; index < unit.entries.length; index += 1) {
      invalid.add(index);
      hard.add(index);
    }
  }
  unit.entries.forEach((entry, index) => {
    const translated = texts[index];
    if (typeof translated !== "string" || translated.trim() === "") {
      fail(index, `${entry.path} 缺少译文`, true);
      return;
    }
    const han = unexpectedHan(translated, unit.allowedHan);
    if (han.length > 0) fail(index, `${entry.path} 含非白名单汉字：${han.join("")}`, true);
    const numbers = entry.text.match(/\d+/gu) ?? [];
    for (const token of new Set(numbers)) {
      if (exactNumberCount(translated, token) >= exactNumberCount(entry.text, token)) continue;
      // 「4 成」译成「40%」也算保留。
      const tenths = new RegExp(`(?<!\\d)${token}\\s*成`, "u").test(entry.text)
        && exactNumberCount(translated, `${token}0`) > 0;
      if (tenths) continue;
      fail(index, `${entry.path} 未保留数字 ${token}`, /^\d{4}$/u.test(token));
    }
    const lower = translated.toLowerCase();
    for (const term of glossaryRequirements(entry.text, unit.allowedHan)) {
      // 只查强制术语；写出拼音、完整译名或英文释义之一即可，不分大小写。
      if (!term.enforced) continue;
      const accepted = [term.english, term.display, ...(term.alternatives ?? [])];
      if (!accepted.some((item) => lower.includes(item.toLowerCase()))) {
        fail(index, `${entry.path} 术语「${term.source}」宜用 ${term.display}`, false);
      }
    }
    for (const reference of findZhouyiEnglishReferences(entry.text)) {
      if (!translated.includes(reference.english)) {
        fail(index, `${entry.path} 古文宜用固定译文：${reference.english}`, false);
      }
    }
  });
  const errors = [...hardErrors, ...warnings];
  return {
    ok: errors.length === 0,
    acceptable: hardErrors.length === 0,
    invalidIndexes: [...invalid].sort((a, b) => a - b),
    hardIndexes: [...hard].sort((a, b) => a - b),
    errors, hardErrors, warnings,
  };
}
