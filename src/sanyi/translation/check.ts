import { findZhouyiEnglishReferences } from "../../agent/zhouyi-en.js";
import { glossaryRequirements } from "./prompt.js";
import type { TranslationUnit } from "./units.js";

export interface TranslationOutput {
  texts: string[];
}

export interface TranslationCheck {
  ok: boolean;
  invalidIndexes: number[];
  errors: string[];
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
  const errors: string[] = [];
  const invalid = new Set<number>();
  if (texts.length !== unit.entries.length) {
    errors.push(`译文条数应为 ${unit.entries.length}，实际为 ${texts.length}`);
    for (let index = texts.length; index < unit.entries.length; index += 1) invalid.add(index);
  }
  unit.entries.forEach((entry, index) => {
    const translated = texts[index];
    if (typeof translated !== "string" || translated.trim() === "") {
      errors.push(`${entry.path} 缺少译文`);
      invalid.add(index);
      return;
    }
    const han = unexpectedHan(translated, unit.allowedHan);
    if (han.length > 0) {
      errors.push(`${entry.path} 含非白名单汉字：${han.join("")}`);
      invalid.add(index);
    }
    const numbers = entry.text.match(/\d+/gu) ?? [];
    for (const token of new Set(numbers)) {
      if (exactNumberCount(translated, token) < exactNumberCount(entry.text, token)) {
        errors.push(`${entry.path} 未保留数字 ${token}`);
        invalid.add(index);
      }
    }
    const lower = translated.toLowerCase();
    for (const term of glossaryRequirements(entry.text, unit.allowedHan)) {
      // 只查强制术语；写出拼音或完整译名即可，不分大小写。
      if (!term.enforced) continue;
      if (!lower.includes(term.english.toLowerCase()) && !lower.includes(term.display.toLowerCase())) {
        errors.push(`${entry.path} 术语「${term.source}」须使用 ${term.display}`);
        invalid.add(index);
      }
    }
    for (const reference of findZhouyiEnglishReferences(entry.text)) {
      if (!translated.includes(reference.english)) {
        errors.push(`${entry.path} 古文须使用固定译文：${reference.english}`);
        invalid.add(index);
      }
    }
  });
  return { ok: errors.length === 0, invalidIndexes: [...invalid].sort((a, b) => a - b), errors };
}
