import { createHash } from "node:crypto";
import type { JsonSchema } from "../../agent/schemas.js";
import type { StructuredOutputProvider } from "../../agent/provider.js";
import type { SanyiLogger } from "../log.js";
import { GLOSSARY_VERSION } from "../i18n/glossary.js";
import type { ReadingStore, StoredReading } from "../store.js";
import { checkTranslation, type TranslationOutput } from "./check.js";
import {
  buildTranslationPrompt,
  PROMPT_VERSION,
  TRANSLATION_SYSTEM_PROMPT,
} from "./prompt.js";
import {
  TranslationStore,
  type StoredTranslation,
  type StoredTranslationUnit,
} from "./store.js";
import { extractUnits, type TranslationUnit } from "./units.js";

const TRANSLATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["texts"],
  properties: {
    texts: { type: "array", items: { type: "string", minLength: 1 } },
  },
} as const satisfies JsonSchema;

export class TranslationHttpError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotReadyError extends TranslationHttpError {
  constructor() { super("中文解读尚未全部到达终态，请稍后重试", 409, "not-ready"); }
}

export class TranslationBudgetError extends TranslationHttpError {
  constructor() { super("今日翻译额度已用完，请稍后重试", 429, "translation-budget"); }
}

class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async use<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

export interface TranslationServiceDependencies {
  store: ReadingStore;
  translationStore?: TranslationStore;
  provider: StructuredOutputProvider;
  logger: SanyiLogger;
  clock?: () => Date;
  concurrency?: number;
  dailyUnits?: number;
}

export function sourceHash(unit: TranslationUnit): string {
  const source = JSON.stringify({
    entries: unit.entries.map(({ path, text }) => ({ path, text })),
    promptVersion: PROMPT_VERSION,
    glossaryVersion: GLOSSARY_VERSION,
  });
  return createHash("sha256").update(source).digest("hex");
}

function isTerminal(reading: StoredReading): boolean {
  const parts = reading.kind === "naming" ? Object.values(reading.families) : Object.values(reading.schools);
  const summary = reading.summary;
  return parts.every((state) => state.status === "done" || state.status === "failed")
    && summary !== undefined
    && summary.status !== "writing";
}

function isUnitTerminal(reading: StoredReading, unit: TranslationUnit): boolean {
  if (unit.key === "summary") {
    return reading.summary?.status === "done" || reading.summary?.status === "failed";
  }
  if (reading.kind === "question") {
    const state = reading.schools[unit.key as keyof typeof reading.schools];
    return state?.status === "done" || state?.status === "failed";
  }
  if (reading.kind === "naming") {
    const state = reading.families[unit.key as keyof typeof reading.families];
    return state?.status === "done" || state?.status === "failed";
  }
  const state = reading.schools[unit.key as keyof typeof reading.schools];
  return state?.status === "done" || state?.status === "failed";
}

function dailyLimit(value: number | undefined): number {
  if (value !== undefined) return Math.max(0, Math.floor(value));
  const configured = Number(process.env.TRANSLATION_DAILY_UNITS ?? "500");
  return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : 500;
}

export class TranslationService {
  private readonly translationStore: TranslationStore;
  private readonly clock: () => Date;
  private readonly semaphore: Semaphore;
  private readonly maximumDailyUnits: number;
  private readonly readingJobs = new Map<string, Promise<StoredTranslation>>();
  private readonly triggerStarts = new Map<string, Promise<StoredTranslation>>();
  private readonly unitJobs = new Map<string, Promise<void>>();
  private budgetDate = "";
  private budgetUsed = 0;

  constructor(private readonly deps: TranslationServiceDependencies) {
    this.translationStore = deps.translationStore ?? new TranslationStore();
    this.clock = deps.clock ?? (() => new Date());
    this.semaphore = new Semaphore(Math.max(1, Math.floor(deps.concurrency ?? 3)));
    this.maximumDailyUnits = dailyLimit(deps.dailyUnits);
  }

  async read(id: string): Promise<StoredTranslation | undefined> {
    const stored = await this.translationStore.read(id);
    if (!stored) return undefined;
    const reading = await this.deps.store.read<StoredReading>(id);
    const visible: StoredTranslation = { lang: "en", units: { ...stored.units } };
    for (const unit of extractUnits(reading)) {
      const state = stored.units[unit.key];
      const hash = sourceHash(unit);
      if (!state || state.sourceHash !== hash || !isUnitTerminal(reading, unit)) {
        visible.units[unit.key] = {
          status: "pending", sourceHash: hash, attempts: 0, failures: 0,
        };
      }
    }
    return visible;
  }

  /** 等待本次可翻译单元完成；API 使用 trigger 只触发、不等待。 */
  async translate(id: string): Promise<StoredTranslation> {
    const existing = this.readingJobs.get(id);
    if (existing) return existing;
    const job = this.run(id);
    this.readingJobs.set(id, job);
    try {
      return await job;
    } finally {
      if (this.readingJobs.get(id) === job) this.readingJobs.delete(id);
    }
  }

  async trigger(id: string): Promise<StoredTranslation> {
    const existing = this.readingJobs.get(id);
    if (existing) return await this.translationStore.read(id) ?? { lang: "en", units: {} };
    const starting = this.triggerStarts.get(id);
    if (starting) return starting;
    const start = this.startTrigger(id);
    this.triggerStarts.set(id, start);
    try {
      return await start;
    } finally {
      if (this.triggerStarts.get(id) === start) this.triggerStarts.delete(id);
    }
  }

  private async startTrigger(id: string): Promise<StoredTranslation> {
    const reading = await this.deps.store.read<StoredReading>(id);
    if (!isTerminal(reading)) throw new NotReadyError();
    const units = extractUnits(reading);
    const prepared = await this.prepare(id, units);
    const count = this.translatableCount(prepared, units);
    this.reserveBudget(count);
    const job = this.process(id, units);
    this.readingJobs.set(id, job);
    void job.catch(async () => {
      await this.deps.logger.write("英文翻译后台任务异常", { readingId: id });
    }).finally(() => {
      if (this.readingJobs.get(id) === job) this.readingJobs.delete(id);
    });
    return prepared;
  }

  private async run(id: string): Promise<StoredTranslation> {
    const reading = await this.deps.store.read<StoredReading>(id);
    if (!isTerminal(reading)) throw new NotReadyError();
    const units = extractUnits(reading);
    const prepared = await this.prepare(id, units);
    this.reserveBudget(this.translatableCount(prepared, units));
    return this.process(id, units);
  }

  private async prepare(id: string, units: readonly TranslationUnit[]): Promise<StoredTranslation> {
    const previous = await this.translationStore.read(id) ?? { lang: "en" as const, units: {} };
    const now = this.clock().getTime();
    const next: StoredTranslation = { lang: "en", units: { ...previous.units } };
    for (const unit of units) {
      const hash = sourceHash(unit);
      const state = previous.units[unit.key];
      if (state?.sourceHash === hash) {
        next.units[unit.key] = state;
      } else {
        next.units[unit.key] = { status: "pending", sourceHash: hash, attempts: 0, failures: 0 };
      }
      const current = next.units[unit.key]!;
      if (unit.entries.length === 0 && current.status !== "done") {
        next.units[unit.key] = { ...current, status: "done", texts: [], failures: 0 };
      } else if (current.cooldownUntil && Date.parse(current.cooldownUntil) <= now) {
        const { cooldownUntil: _cooldown, ...rest } = current;
        next.units[unit.key] = rest;
      }
    }
    await this.translationStore.write(id, next);
    return next;
  }

  private translatableCount(document: StoredTranslation, units: readonly TranslationUnit[]): number {
    const now = this.clock().getTime();
    return units.filter((unit) => {
      const state = document.units[unit.key]!;
      return unit.entries.length > 0
        && state.status !== "done"
        && (!state.cooldownUntil || Date.parse(state.cooldownUntil) <= now);
    }).length;
  }

  private reserveBudget(count: number): void {
    if (count === 0) return;
    const today = this.clock().toISOString().slice(0, 10);
    if (today !== this.budgetDate) {
      this.budgetDate = today;
      this.budgetUsed = 0;
    }
    if (this.budgetUsed + count > this.maximumDailyUnits) throw new TranslationBudgetError();
    this.budgetUsed += count;
  }

  private async process(id: string, units: readonly TranslationUnit[]): Promise<StoredTranslation> {
    const summary = units.find((unit) => unit.key === "summary");
    if (summary) await this.runUnit(id, summary);
    await Promise.all(units.filter((unit) => unit.key !== "summary").map((unit) => this.runUnit(id, unit)));
    return await this.translationStore.read(id) ?? { lang: "en", units: {} };
  }

  private async runUnit(id: string, unit: TranslationUnit): Promise<void> {
    const key = `${id}:${unit.key}`;
    const existing = this.unitJobs.get(key);
    if (existing) return existing;
    const job = this.translateUnit(id, unit);
    this.unitJobs.set(key, job);
    try {
      await job;
    } finally {
      if (this.unitJobs.get(key) === job) this.unitJobs.delete(key);
    }
  }

  private async translateUnit(id: string, unit: TranslationUnit): Promise<void> {
    const before = await this.translationStore.read(id);
    const state = before?.units[unit.key];
    if (!state || state.status === "done" || unit.entries.length === 0) return;
    if (state.cooldownUntil && Date.parse(state.cooldownUntil) > this.clock().getTime()) return;
    await this.setState(id, unit.key, { ...state, status: "writing" });
    let attempts = state.attempts;
    try {
      const initial = await this.generate(unit, false);
      attempts += 1;
      let texts = Array.isArray(initial.texts)
        ? initial.texts.slice(0, unit.entries.length)
        : [];
      let checked = checkTranslation(unit, { texts });
      if (!checked.ok) {
        const repairUnit: TranslationUnit = {
          ...unit,
          entries: checked.invalidIndexes.map((index) => unit.entries[index]!),
        };
        const repair = await this.generate(repairUnit, true);
        attempts += 1;
        if (checkTranslation(repairUnit, repair).ok) {
          checked.invalidIndexes.forEach((originalIndex, repairIndex) => {
            texts[originalIndex] = repair.texts[repairIndex]!;
          });
        }
        checked = checkTranslation(unit, { texts });
      }
      if (!checked.ok) {
        await this.failUnit(id, unit, state, attempts, checked.errors.join("；"));
        return;
      }
      if (!await this.hashStillCurrent(id, unit)) return;
      await this.setState(id, unit.key, {
        status: "done", sourceHash: state.sourceHash, texts,
        attempts, failures: 0,
      });
      await this.deps.logger.write("英文翻译单元完成", { readingId: id, unit: unit.key, attempts });
    } catch (error) {
      await this.failUnit(id, unit, state, attempts + 1,
        error instanceof Error ? error.name : "TranslationError");
    }
  }

  private generate(unit: TranslationUnit, repair: boolean): Promise<TranslationOutput> {
    return this.semaphore.use(() => this.deps.provider.generateStructured<TranslationOutput>({
      taskId: `sanyi/translate/${unit.kind}/${unit.key}${repair ? "/repair" : ""}`,
      systemPrompt: TRANSLATION_SYSTEM_PROMPT,
      cacheSystemPrompt: true,
      userPrompt: buildTranslationPrompt(unit),
      schema: TRANSLATION_SCHEMA,
      effort: "medium",
    }));
  }

  private async hashStillCurrent(id: string, unit: TranslationUnit): Promise<boolean> {
    const reading = await this.deps.store.read<StoredReading>(id);
    const current = extractUnits(reading).find((item) => item.key === unit.key);
    if (current && sourceHash(current) === sourceHash(unit)) return true;
    if (current) {
      await this.setState(id, unit.key, {
        status: "pending", sourceHash: sourceHash(current), attempts: 0, failures: 0,
      });
    }
    return false;
  }

  private async failUnit(
    id: string,
    unit: TranslationUnit,
    previous: StoredTranslationUnit,
    attempts: number,
    error: string,
  ): Promise<void> {
    if (!await this.hashStillCurrent(id, unit)) return;
    const failures = previous.failures + 1;
    const cooldownUntil = failures >= 3
      ? new Date(this.clock().getTime() + 10 * 60_000).toISOString()
      : undefined;
    await this.setState(id, unit.key, {
      status: "failed", sourceHash: previous.sourceHash, attempts, failures, error,
      ...(cooldownUntil ? { cooldownUntil } : {}),
    });
    await this.deps.logger.write("英文翻译单元失败", {
      readingId: id, unit: unit.key, failures,
    });
  }

  private async setState(
    id: string,
    key: TranslationUnit["key"],
    state: StoredTranslationUnit,
  ): Promise<void> {
    await this.translationStore.update(id, (document) => ({
      ...document,
      units: { ...document.units, [key]: state },
    }));
  }
}
