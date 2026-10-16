import { findZhouyiEnglishReferences } from "../../agent/zhouyi-en.js";
import type { FactTable } from "../facts.js";
import { glossaryRequirements } from "../translation/prompt.js";

export const ENGLISH_OUTPUT_CONVENTIONS = `Write for an international reader who does not know Chinese, using plain English.
When a specialist term first appears, write it as “pinyin (English gloss)”; later mentions may use the English name alone. Use only the supplied glossary translations and fixed classical translations. Never translate a classical passage yourself.
Every evidence[].claim must be written in Chinese, cite a supplied fact ID, and use Chinese chart terms. Evidence is only for programmatic checking and is not displayed.
Every other output field must contain no Chinese characters.
For health questions, recommend seeking qualified medical care. Do not give medical, legal, or investment conclusions. Do not mention betting, wagers, gambling, or compensation.
Output must strictly follow the provided JSON Schema.`;

export function appendEnglishReferenceMaterials(
  basePrompt: string,
  factText: string,
  classicText: string,
): string {
  const glossary = glossaryRequirements(factText).map(({ source, display }) => ({
    chinese: source,
    english: display,
  }));
  const classics = findZhouyiEnglishReferences(classicText).map(({ chinese, english }) => ({
    chinese,
    english,
  }));
  return [
    basePrompt,
    "",
    `本盘术语英文对照：${JSON.stringify(glossary)}`,
    `古文英译：${JSON.stringify(classics)}`,
  ].join("\n");
}

export function appendQuestionEnglishMaterials(
  basePrompt: string,
  facts: FactTable,
  originalTexts: readonly string[],
): string {
  return appendEnglishReferenceMaterials(
    basePrompt,
    [...facts.values()].map((fact) => fact.label).join("\n"),
    originalTexts.join("\n"),
  );
}
