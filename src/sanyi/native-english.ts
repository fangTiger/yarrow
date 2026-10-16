export type ReadingKind = "question" | "destiny" | "fortune" | "naming";

/** N1 只有问事已具备原生英文；N2 在同一开关中加入其余类型。 */
export const NATIVE_ENGLISH_KINDS: ReadonlySet<ReadingKind> = new Set(["question"]);

export function isNativeEnglishKind(kind: ReadingKind, lang: "en" | undefined): boolean {
  return lang === "en" && NATIVE_ENGLISH_KINDS.has(kind);
}
