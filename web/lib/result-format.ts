import {
  BRANCHES_EN,
  ELEMENTS_EN,
  HEXAGRAMS_EN,
  SCHOOLS_EN,
  SIX_RELATIVES_EN,
  SIX_SPIRITS_EN,
  STEMS_EN,
  SUBJECTS_EN,
  TEN_GODS_EN,
  TERMS_EN,
  TRIGRAMS_EN,
  VERDICTS_EN,
} from "../../src/sanyi/i18n/glossary.js";

export function elementEn(value: string): string {
  return ELEMENTS_EN[value as keyof typeof ELEMENTS_EN] ?? value;
}

export function trigramEn(value: string): string {
  const item = TRIGRAMS_EN[value as keyof typeof TRIGRAMS_EN];
  return item ? `${item.pinyin} (${item.image})` : value;
}

export function hexagramEn(kingWenNumber: number): string {
  const item = HEXAGRAMS_EN[kingWenNumber - 1];
  return item ? `${item.pinyin} · ${item.title}` : `Hexagram ${kingWenNumber}`;
}

export function stemBranchEn(value: string | null | undefined): string {
  if (!value) return "—";
  return [...value].map((char) => {
    if (char in STEMS_EN) return STEMS_EN[char as keyof typeof STEMS_EN];
    if (char in BRANCHES_EN) return BRANCHES_EN[char as keyof typeof BRANCHES_EN].pinyin;
    return /[\p{Script=Han}]/u.test(char) ? "" : char;
  }).filter(Boolean).join(" ");
}

export function tenGodEn(value: string | null | undefined): string {
  if (!value) return "—";
  return TEN_GODS_EN[value as keyof typeof TEN_GODS_EN] ?? value;
}

export function relativeEn(value: string): string {
  return SIX_RELATIVES_EN[value as keyof typeof SIX_RELATIVES_EN] ?? value;
}

export function spiritEn(value: string): string {
  return SIX_SPIRITS_EN[value as keyof typeof SIX_SPIRITS_EN] ?? value;
}

export function verdictEn(value: string): string {
  return VERDICTS_EN[value as keyof typeof VERDICTS_EN] ?? value;
}

export function subjectEn(value: string): string {
  return SUBJECTS_EN[value as keyof typeof SUBJECTS_EN] ?? "Other";
}

export function schoolEn(value: string): { name: string; school: string } {
  return SCHOOLS_EN[value as keyof typeof SCHOOLS_EN] ?? { name: value, school: "" };
}

export function termEn(value: string): string {
  const item = TERMS_EN[value as keyof typeof TERMS_EN];
  return item ? `${item.pinyin} (${item.gloss})` : value;
}

export function confidenceEn(value: number): string {
  return `about ${Number.isInteger(value) ? value : value.toFixed(1)} in 10`;
}

const STRENGTH_EN: Readonly<Record<string, string>> = {
  旺: "Prosperous", 相: "Supported", 休: "Resting", 囚: "Confined", 死: "Dormant",
};

export function strengthEn(value: string): string {
  return STRENGTH_EN[value] ?? value;
}
