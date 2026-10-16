import type { StoredTranslation, StoredTranslationUnit } from "../../src/sanyi/translation/store.js";
import type { AnyPublicReading } from "./api.js";
import { isNativeEnglishKind } from "../../src/sanyi/native-english.js";

/** 四类英文下单都直接写英文。 */
export function isNativeEnglishReading(reading: AnyPublicReading): boolean {
  return isNativeEnglishKind(reading.kind, reading.lang);
}

/** 是否需要旁路翻译；原生英文解读和中文界面都不进入翻译请求、轮询或面板。 */
export function usesTranslationPipeline(
  reading: AnyPublicReading,
  lang: "zh" | "en",
): boolean {
  return lang === "en" && !isNativeEnglishReading(reading);
}

/** 按界面语言选择结果正文；原生英文保留服务端返回对象。 */
export function readingForLanguage<T extends AnyPublicReading>(
  reading: T,
  lang: "zh" | "en",
): T {
  return usesTranslationPipeline(reading, lang) ? applyReadingTranslation(reading) : reading;
}

export type TranslationViewState =
  | { kind: "pending" | "writing" | "done" }
  | { kind: "failed"; failedUnits: string[] };

export function translationViewState(
  translation: StoredTranslation | undefined,
  reading?: AnyPublicReading,
): TranslationViewState {
  const entries = translation ? Object.entries(translation.units) : [];
  if (entries.length === 0) return { kind: "pending" };
  if (reading) {
    const terminalKeys = terminalUnitKeys(reading);
    if (terminalKeys.some((key) => !translation?.units[key])) return { kind: "pending" };
  }
  if (entries.some(([, unit]) => unit.status === "writing")) return { kind: "writing" };
  if (entries.some(([, unit]) => unit.status === "pending")) return { kind: "pending" };
  const failedUnits = entries.filter(([, unit]) => unit.status === "failed").map(([key]) => key);
  return failedUnits.length > 0 ? { kind: "failed", failedUnits } : { kind: "done" };
}

function terminalUnitKeys(reading: AnyPublicReading): string[] {
  const terminal = (status: string) => status === "done" || status === "failed" || status === "rejected";
  const keys: string[] = [];
  if (reading.summary && terminal(reading.summary.status)) keys.push("summary");
  const states = reading.kind === "naming" ? reading.families : reading.schools;
  for (const [key, state] of Object.entries(states)) {
    if (terminal(state.status)) keys.push(key);
  }
  return keys;
}

type MutableRecord = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setPath(root: MutableRecord, path: string, value: string): void {
  const parts = path.split(".");
  let current: unknown = root;
  for (const part of parts.slice(0, -1)) {
    if (!current || typeof current !== "object") return;
    current = Array.isArray(current)
      ? current[Number(part)]
      : (current as MutableRecord)[part];
  }
  const last = parts.at(-1);
  if (!last || !current || typeof current !== "object") return;
  if (Array.isArray(current)) current[Number(last)] = value;
  else (current as MutableRecord)[last] = value;
}

function add(paths: string[], path: string, value: unknown): void {
  if (typeof value === "string" && value.trim() !== "") paths.push(path);
}

function plainSummaryPaths(reading: MutableRecord): string[] {
  const paths: string[] = [];
  const summary = reading.summary as MutableRecord | undefined;
  const output = summary?.output as MutableRecord | undefined;
  if (!output || typeof output.conclusion !== "string") return paths;
  add(paths, "summary.output.conclusion", output.conclusion);
  add(paths, "summary.output.agreement", output.agreement);
  add(paths, "summary.output.difference", output.difference);
  (output.explanation as unknown[] | undefined)?.forEach((text, index) => (
    add(paths, `summary.output.explanation.${index}`, text)
  ));
  (output.advice as unknown[] | undefined)?.forEach((text, index) => (
    add(paths, `summary.output.advice.${index}`, text)
  ));
  const remedy = output.remedy as MutableRecord | undefined;
  if (remedy) {
    add(paths, "summary.output.remedy.principle", remedy.principle);
    (remedy.plan as MutableRecord[] | undefined)?.forEach((step, index) => {
      add(paths, `summary.output.remedy.plan.${index}.action`, step.action);
      add(paths, `summary.output.remedy.plan.${index}.basis`, step.basis);
      add(paths, `summary.output.remedy.plan.${index}.timing`, step.timing);
    });
    (remedy.avoid as unknown[] | undefined)?.forEach((text, index) => (
      add(paths, `summary.output.remedy.avoid.${index}`, text)
    ));
  }
  const portrait = output.portrait as MutableRecord | undefined;
  if (portrait) {
    (portrait.traits as unknown[] | undefined)?.forEach((text, index) => (
      add(paths, `summary.output.portrait.traits.${index}`, text)
    ));
    (portrait.strengths as unknown[] | undefined)?.forEach((text, index) => (
      add(paths, `summary.output.portrait.strengths.${index}`, text)
    ));
    (portrait.blindSpots as unknown[] | undefined)?.forEach((text, index) => (
      add(paths, `summary.output.portrait.blindSpots.${index}`, text)
    ));
    add(paths, "summary.output.portrait.summary", portrait.summary);
  }
  const watch = output.watch as MutableRecord | undefined;
  if (watch) {
    add(paths, "summary.output.watch.window", watch.window);
    add(paths, "summary.output.watch.condition", watch.condition);
  }
  add(paths, "summary.output.outlook", output.outlook);
  return paths;
}

function questionSchoolPaths(reading: MutableRecord, key: string): string[] {
  const paths: string[] = [];
  const schools = (reading.schools ?? {}) as MutableRecord;
  const output = ((schools[key] as MutableRecord | undefined)?.output) as MutableRecord | undefined;
  if (!output) return paths;
  const prefix = `schools.${key}.output`;
  add(paths, `${prefix}.headline`, output.headline);
  add(paths, `${prefix}.reason`, output.reason);
  (output.sections as MutableRecord[]).forEach((section, index) => {
    add(paths, `${prefix}.sections.${index}.title`, section.title);
    add(paths, `${prefix}.sections.${index}.text`, section.text);
  });
  const timing = output.timing as MutableRecord | undefined;
  if (timing) {
    add(paths, `${prefix}.timing.window`, timing.window);
    add(paths, `${prefix}.timing.condition`, timing.condition);
  }
  (output.advice as unknown[]).forEach((text, index) => add(paths, `${prefix}.advice.${index}`, text));
  return paths;
}

function baziSchoolPaths(reading: MutableRecord, key: string): string[] {
  const paths: string[] = [];
  const schools = (reading.schools ?? {}) as MutableRecord;
  const output = ((schools[key] as MutableRecord | undefined)?.output) as MutableRecord | undefined;
  if (!output) return paths;
  const prefix = `schools.${key}.output`;
  add(paths, `${prefix}.useGod`, output.useGod);
  add(paths, `${prefix}.headline`, output.headline);
  add(paths, `${prefix}.reason`, output.reason);
  (output.sections as MutableRecord[]).forEach((section, index) => (
    add(paths, `${prefix}.sections.${index}.text`, section.text)
  ));
  const timing = output.timing as MutableRecord | undefined;
  if (timing) {
    add(paths, `${prefix}.timing.window`, timing.window);
    add(paths, `${prefix}.timing.condition`, timing.condition);
  }
  (output.advice as unknown[]).forEach((text, index) => add(paths, `${prefix}.advice.${index}`, text));
  (output.years as MutableRecord[] | undefined)?.forEach((year, index) => (
    add(paths, `${prefix}.years.${index}.note`, year.note)
  ));
  (output.periods as MutableRecord[] | undefined)?.forEach((period, index) => (
    add(paths, `${prefix}.periods.${index}.note`, period.note)
  ));
  return paths;
}

function namingPaths(reading: MutableRecord, key: string): string[] {
  const paths: string[] = [];
  const families = (reading.families ?? {}) as MutableRecord;
  const output = ((families[key] as MutableRecord | undefined)?.output) as MutableRecord | undefined;
  if (!output) return paths;
  const prefix = `families.${key}.output`;
  add(paths, `${prefix}.note`, output.note);
  (output.names as MutableRecord[]).forEach((name, nameIndex) => {
    const namePrefix = `${prefix}.names.${nameIndex}`;
    add(paths, `${namePrefix}.meaning`, name.meaning);
    add(paths, `${namePrefix}.why`, name.why);
    (name.chars as MutableRecord[]).forEach((character, charIndex) => {
      add(paths, `${namePrefix}.chars.${charIndex}.meaning`, character.meaning);
      add(paths, `${namePrefix}.chars.${charIndex}.sense`, character.sense);
    });
    (name.tags as unknown[]).forEach((tag, tagIndex) => (
      add(paths, `${namePrefix}.tags.${tagIndex}`, tag)
    ));
    (name.echoes as MutableRecord[] | undefined)?.forEach((line, echoIndex) => (
      add(paths, `${namePrefix}.echoes.${echoIndex}.text`, line.text)
    ));
    if (key === "shiwen") {
      add(paths, `${namePrefix}.source.text`, (name.source as MutableRecord | undefined)?.text);
    }
  });
  return paths;
}

function namingSummaryPaths(reading: MutableRecord): string[] {
  const paths: string[] = [];
  const basis = reading.basis as MutableRecord;
  add(paths, "basis.favorableNote", basis.favorableNote);
  const output = ((reading.summary as MutableRecord | undefined)?.output) as MutableRecord | undefined;
  if (!output) return paths;
  (output.picks as MutableRecord[]).forEach((pick, index) => (
    add(paths, `summary.output.picks.${index}.reason`, pick.reason)
  ));
  add(paths, "summary.output.overview", output.overview);
  (output.tips as unknown[]).forEach((text, index) => add(paths, `summary.output.tips.${index}`, text));
  return paths;
}

function unitPaths(reading: MutableRecord): Record<string, string[]> {
  if (reading.kind === "question") return {
    summary: plainSummaryPaths(reading),
    chengyi: questionSchoolPaths(reading, "chengyi"),
    jingfang: questionSchoolPaths(reading, "jingfang"),
    shaoyong: questionSchoolPaths(reading, "shaoyong"),
  };
  if (reading.kind === "naming") return {
    summary: namingSummaryPaths(reading),
    wuxing: namingPaths(reading, "wuxing"),
    shiwen: namingPaths(reading, "shiwen"),
    yinyi: namingPaths(reading, "yinyi"),
  };
  return {
    summary: plainSummaryPaths(reading),
    shenxiaozhan: baziSchoolPaths(reading, "shenxiaozhan"),
    yuchuntai: baziSchoolPaths(reading, "yuchuntai"),
    rentieqiao: baziSchoolPaths(reading, "rentieqiao"),
  };
}

function applyUnit(root: MutableRecord, unit: StoredTranslationUnit | undefined, paths: string[]): boolean {
  if (unit?.status !== "done" || !unit.texts) return false;
  // 译文按位置对应路径：条数不符（如旧译文早于翻译范围调整）时整单元按未译处理，绝不把中文带到英文页。
  if (unit.texts.length !== paths.length) return false;
  paths.forEach((path, index) => {
    const text = unit.texts?.[index];
    if (text !== undefined) setPath(root, path, text);
  });
  return true;
}

function stateForUnit(root: MutableRecord, key: string): MutableRecord | undefined {
  if (key === "summary") return root.summary as MutableRecord | undefined;
  const group = root.kind === "naming" ? root.families : root.schools;
  return (group as MutableRecord | undefined)?.[key] as MutableRecord | undefined;
}

function maskTerminalUnit(root: MutableRecord, key: string, paths: string[]): void {
  const state = stateForUnit(root, key);
  if (!state || !["done", "failed", "rejected"].includes(String(state.status))) return;
  // 个别路径（如起名的 favorableNote）不在 output 内，也必须显式清空。
  paths.forEach((path) => setPath(root, path, ""));
  if (state.output !== undefined) {
    delete state.output;
    state.status = "writing";
    state.translationPending = true;
  }
}

/** 生成英文专用视图；已终态但未译好的正文只显示英文占位，绝不回退中文。 */
export function applyReadingTranslation<T extends AnyPublicReading>(reading: T): T {
  const translation = reading.translation;
  const translated = clone(reading) as unknown as MutableRecord;
  const paths = unitPaths(reading as unknown as MutableRecord);
  Object.entries(paths).forEach(([key, unitPathsForKey]) => {
    if (!applyUnit(translated, translation?.units[key], unitPathsForKey)) {
      maskTerminalUnit(translated, key, unitPathsForKey);
    }
  });
  return translated as unknown as T;
}
