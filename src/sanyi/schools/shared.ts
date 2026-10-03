// src/sanyi/schools/shared.ts
import type { FactTable } from "../facts.js";

export interface SchoolInput {
  question: string;
  facts: FactTable;
  originalTexts: readonly string[];
}

export interface QuestionSchool {
  key: "chengyi" | "jingfang" | "shaoyong";
  name: string;
  school: string;
  systemPrompt: string;
  buildUserPrompt(input: SchoolInput): string;
}

export function buildSchoolPrompt(
  input: SchoolInput,
  allowed: readonly string[],
  mainFirst = false,
): string {
  const facts = [...input.facts.values()].filter((fact) => {
    return allowed.some((prefix) => {
      return fact.id === prefix || fact.id.startsWith(prefix);
    });
  });
  const originals = mainFirst
    ? [...input.originalTexts].sort((left) => left.startsWith("主占") ? -1 : 1)
    : input.originalTexts;
  return [
    `问题：${input.question}`,
    "可用事实编号：",
    ...facts.map((fact) => `${fact.id}：${fact.label}`),
    "可直接引用的原文：",
    ...originals,
  ].join("\n");
}
