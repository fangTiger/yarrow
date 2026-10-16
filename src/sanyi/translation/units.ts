import { lineById } from "../naming/classics.js";
import { echoLines } from "../naming/card.js";
import { allowedNamingHan } from "../naming/audit.js";
import type { StoredReading } from "../store.js";

export type TranslationUnitKey =
  | "summary"
  | "chengyi" | "jingfang" | "shaoyong"
  | "shenxiaozhan" | "yuchuntai" | "rentieqiao"
  | "wuxing" | "shiwen" | "yinyi";

export interface TranslationEntry {
  path: string;
  text: string;
}

export interface TranslationUnit {
  key: TranslationUnitKey;
  kind: StoredReading["kind"];
  entries: TranslationEntry[];
  /** 译文中可原样出现的汉字，仅限本单元关联的姓名。 */
  allowedHan: string[];
}

function add(entries: TranslationEntry[], path: string, value: unknown): void {
  if (typeof value === "string" && value.trim() !== "") entries.push({ path, text: value });
}

function plainSummaryEntries(summary: StoredReading["summary"]): TranslationEntry[] {
  const entries: TranslationEntry[] = [];
  const output = summary?.output;
  if (!output || !("conclusion" in output)) return entries;
  add(entries, "summary.output.conclusion", output.conclusion);
  add(entries, "summary.output.agreement", output.agreement);
  add(entries, "summary.output.difference", output.difference);
  output.explanation.forEach((text, index) => add(entries, `summary.output.explanation.${index}`, text));
  output.advice?.forEach((text, index) => add(entries, `summary.output.advice.${index}`, text));
  if (output.remedy) {
    add(entries, "summary.output.remedy.principle", output.remedy.principle);
    output.remedy.plan.forEach((step, index) => {
      add(entries, `summary.output.remedy.plan.${index}.action`, step.action);
      add(entries, `summary.output.remedy.plan.${index}.basis`, step.basis);
      add(entries, `summary.output.remedy.plan.${index}.timing`, step.timing);
    });
    output.remedy.avoid.forEach((text, index) => (
      add(entries, `summary.output.remedy.avoid.${index}`, text)
    ));
  }
  if (output.portrait) {
    output.portrait.traits.forEach((text, index) => (
      add(entries, `summary.output.portrait.traits.${index}`, text)
    ));
    output.portrait.strengths.forEach((text, index) => (
      add(entries, `summary.output.portrait.strengths.${index}`, text)
    ));
    output.portrait.blindSpots.forEach((text, index) => (
      add(entries, `summary.output.portrait.blindSpots.${index}`, text)
    ));
    add(entries, "summary.output.portrait.summary", output.portrait.summary);
  }
  if (output.watch) {
    add(entries, "summary.output.watch.window", output.watch.window);
    add(entries, "summary.output.watch.condition", output.watch.condition);
  }
  add(entries, "summary.output.outlook", output.outlook);
  return entries;
}

function questionUnits(reading: Extract<StoredReading, { kind: "question" }>): TranslationUnit[] {
  const makeSchool = (key: "chengyi" | "jingfang" | "shaoyong"): TranslationUnit => {
    const output = reading.schools[key].output;
    const entries: TranslationEntry[] = [];
    if (output) {
      const prefix = `schools.${key}.output`;
      add(entries, `${prefix}.headline`, output.headline);
      add(entries, `${prefix}.reason`, output.reason);
      output.sections.forEach((section, index) => {
        add(entries, `${prefix}.sections.${index}.title`, section.title);
        add(entries, `${prefix}.sections.${index}.text`, section.text);
      });
      if (output.timing) {
        add(entries, `${prefix}.timing.window`, output.timing.window);
        add(entries, `${prefix}.timing.condition`, output.timing.condition);
      }
      output.advice.forEach((text, index) => add(entries, `${prefix}.advice.${index}`, text));
    }
    return { key, kind: reading.kind, entries, allowedHan: [] };
  };
  return [
    { key: "summary", kind: reading.kind, entries: plainSummaryEntries(reading.summary), allowedHan: [] },
    makeSchool("chengyi"), makeSchool("jingfang"), makeSchool("shaoyong"),
  ];
}

function baziUnits(reading: Extract<StoredReading, { kind: "destiny" | "fortune" }>): TranslationUnit[] {
  const makeSchool = (key: "shenxiaozhan" | "yuchuntai" | "rentieqiao"): TranslationUnit => {
    const output = reading.schools[key].output;
    const entries: TranslationEntry[] = [];
    if (output) {
      const prefix = `schools.${key}.output`;
      add(entries, `${prefix}.useGod`, output.useGod);
      add(entries, `${prefix}.headline`, output.headline);
      add(entries, `${prefix}.reason`, output.reason);
      output.sections.forEach((section, index) => (
        add(entries, `${prefix}.sections.${index}.text`, section.text)
      ));
      if ("timing" in output && output.timing) {
        add(entries, `${prefix}.timing.window`, output.timing.window);
        add(entries, `${prefix}.timing.condition`, output.timing.condition);
      }
      output.advice.forEach((text, index) => add(entries, `${prefix}.advice.${index}`, text));
      if ("years" in output) {
        output.years.forEach((year, index) => add(entries, `${prefix}.years.${index}.note`, year.note));
      }
      if ("periods" in output) {
        output.periods?.forEach((period, index) => (
          add(entries, `${prefix}.periods.${index}.note`, period.note)
        ));
      }
    }
    return { key, kind: reading.kind, entries, allowedHan: [] };
  };
  return [
    { key: "summary", kind: reading.kind, entries: plainSummaryEntries(reading.summary), allowedHan: [] },
    makeSchool("shenxiaozhan"), makeSchool("yuchuntai"), makeSchool("rentieqiao"),
  ];
}

function namingUnits(reading: Extract<StoredReading, { kind: "naming" }>): TranslationUnit[] {
  const summaryAllowedHan = allowedNamingHan(reading.surname, Object.values(reading.families).flatMap(
    (state) => state.output?.names ?? [],
  ));
  const summaryEntries: TranslationEntry[] = [];
  add(summaryEntries, "basis.favorableNote", reading.basis.favorableNote);
  const summary = reading.summary?.output;
  if (summary) {
    summary.picks.forEach((pick, index) => (
      add(summaryEntries, `summary.output.picks.${index}.reason`, pick.reason)
    ));
    add(summaryEntries, "summary.output.overview", summary.overview);
    summary.tips.forEach((text, index) => add(summaryEntries, `summary.output.tips.${index}`, text));
  }
  const makeFamily = (key: "wuxing" | "shiwen" | "yinyi"): TranslationUnit => {
    const entries: TranslationEntry[] = [];
    const output = reading.families[key].output;
    if (output) {
      const prefix = `families.${key}.output`;
      add(entries, `${prefix}.note`, output.note);
      output.names.forEach((name, nameIndex) => {
        const namePrefix = `${prefix}.names.${nameIndex}`;
        add(entries, `${namePrefix}.meaning`, name.meaning);
        add(entries, `${namePrefix}.why`, name.why);
        name.chars.forEach((character, charIndex) => {
          add(entries, `${namePrefix}.chars.${charIndex}.gloss`, character.gloss);
          add(entries, `${namePrefix}.chars.${charIndex}.sense`, character.sense);
        });
        name.tags.forEach((tag, tagIndex) => add(entries, `${namePrefix}.tags.${tagIndex}`, tag));
        const sourceIndex = name.sourceId?.match(/^S(\d{2})$/u)?.[1];
        const sourceCandidateId = sourceIndex
          ? reading.candidateIds[Number(sourceIndex) - 1]
          : undefined;
        echoLines(name.given, sourceCandidateId).forEach((line, echoIndex) => (
          add(entries, `${namePrefix}.echoes.${echoIndex}.text`, line.text)
        ));
        if (key === "shiwen") {
          const sourceId = sourceIndex ? reading.candidateIds[Number(sourceIndex) - 1] : undefined;
          const source = sourceId ? lineById(sourceId) : undefined;
          add(entries, `${namePrefix}.source.text`, source?.text);
        }
      });
    }
    return {
      key,
      kind: reading.kind,
      entries,
      allowedHan: allowedNamingHan(reading.surname, output?.names ?? []),
    };
  };
  return [
    { key: "summary", kind: reading.kind, entries: summaryEntries, allowedHan: summaryAllowedHan },
    makeFamily("wuxing"), makeFamily("shiwen"), makeFamily("yinyi"),
  ];
}

/** 严格按设计第 6 节抽出四个有序翻译单元。 */
export function extractUnits(reading: StoredReading): TranslationUnit[] {
  if (reading.kind === "question") return questionUnits(reading);
  if (reading.kind === "naming") return namingUnits(reading);
  return baziUnits(reading);
}
