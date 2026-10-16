export type ReadingKind = "question" | "destiny" | "fortune" | "naming";

/** 四类解读均已具备原生英文生成与核对。 */
export const NATIVE_ENGLISH_KINDS: ReadonlySet<ReadingKind> = new Set([
  "question", "destiny", "fortune", "naming",
]);

export function isNativeEnglishKind(kind: ReadingKind, lang: "en" | undefined): boolean {
  return lang === "en" && NATIVE_ENGLISH_KINDS.has(kind);
}
