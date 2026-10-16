import { keepAlive } from "../background.js";
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
import { extractUnits, type TranslationUnit, type TranslationUnitKey } from "./units.js";

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
  return parts.every((state) => state.status === "done" || state.status === "failed"
    || state.status === "rejected")
    && summary !== undefined
    && summary.status !== "writing";
}

function isUnitTerminal(reading: StoredReading, unit: TranslationUnit): boolean {
  if (unit.key === "summary") {
    return reading.summary?.status === "done" || reading.summary?.status === "failed";
  }
  if (reading.kind === "question") {
    const state = reading.schools[unit.key as keyof typeof reading.schools];
    return state?.status === "done" || state?.status === "failed" || state?.status === "rejected";
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
  private readonly unitStarts = new Map<string, Promise<void>>();
  private readonly unitClaims = new Set<string>();
  private readonly unitJobs = new Map<string, { sourceHash: string; promise: Promise<void> }>();
  private readonly preparationQueues = new Map<string, Promise<unknown>>();
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

  /** 英文下单的单个解读单元到终态后立即旁路翻译；任何失败都只记日志。 */
  async startUnit(id: string, unitKey: TranslationUnitKey): Promise<void> {
    try {
      const requestKey = `${id}:${unitKey}`;
      const existing = this.unitStarts.get(requestKey);
      if (existing) {
        await existing;
        return await this.startUnit(id, unitKey);
      }
      let start: Promise<void>;
      const work = this.startUnitRequest(id, unitKey).catch(async (error: unknown) => {
        await this.logSafely(error instanceof TranslationBudgetError
          ? "英文翻译单元额度已用完"
          : "英文翻译单元启动失败", { readingId: id, unit: unitKey });
      });
      start = work.finally(() => {
        if (this.unitStarts.get(requestKey) === start) this.unitStarts.delete(requestKey);
      });
      this.unitStarts.set(requestKey, start);
      keepAlive(start);
      await start;
    } catch (error) {
      await this.logSafely(error instanceof TranslationBudgetError
        ? "英文翻译单元额度已用完"
        : "英文翻译单元启动失败", { readingId: id, unit: unitKey });
    }
  }

  private async startTrigger(id: string): Promise<StoredTranslation> {
    let prepared: Awaited<ReturnType<TranslationService["prepare"]>>;
    let claim: { document: StoredTranslation; claimed: TranslationUnit[] } | undefined;
    do {
      prepared = await this.prepare(id, undefined, (reading) => isTerminal(reading));
      if (!prepared) throw new NotReadyError();
      claim = await this.claimPreparedUnits(id, prepared.units);
    } while (!claim);
    const claimed = claim.claimed;
    const job = this.process(id, prepared.units).finally(() => this.releaseClaims(id, claimed));
    this.readingJobs.set(id, job);
    keepAlive(job);
    void job.catch(async () => {
      await this.deps.logger.write("英文翻译后台任务异常", { readingId: id });
    }).finally(() => {
      if (this.readingJobs.get(id) === job) this.readingJobs.delete(id);
    });
    return claim.document;
  }

  private async run(id: string): Promise<StoredTranslation> {
    let prepared: Awaited<ReturnType<TranslationService["prepare"]>>;
    let claim: { document: StoredTranslation; claimed: TranslationUnit[] } | undefined;
    do {
      prepared = await this.prepare(id, undefined, (reading) => isTerminal(reading));
      if (!prepared) throw new NotReadyError();
      claim = await this.claimPreparedUnits(id, prepared.units);
    } while (!claim);
    const claimed = claim.claimed;
    try {
      return await this.process(id, prepared.units);
    } finally {
      this.releaseClaims(id, claimed);
    }
  }

  private async startUnitRequest(id: string, unitKey: TranslationUnitKey): Promise<void> {
    let prepared: Awaited<ReturnType<TranslationService["prepare"]>>;
    let claim: { document: StoredTranslation; claimed: TranslationUnit[] } | undefined;
    do {
      prepared = await this.prepare(id, [unitKey], (reading, units) => (
        reading.translateTo === "en" && units.length === 1 && isUnitTerminal(reading, units[0]!)
      ));
      if (!prepared) return;
      claim = await this.claimPreparedUnits(id, prepared.units);
    } while (!claim);
    const unit = prepared.units[0]!;
    const claimed = claim.claimed;
    if (claimed.length === 0) return;
    const job = this.runUnit(id, unit).finally(() => this.releaseClaims(id, claimed));
    keepAlive(job);
    void job.catch(async () => {
      await this.logSafely("英文翻译单元后台任务异常", { readingId: id, unit: unit.key });
    });
  }

  private async claimPreparedUnits(
    id: string,
    units: readonly TranslationUnit[],
  ): Promise<{ document: StoredTranslation; claimed: TranslationUnit[] } | undefined> {
    const document = await this.translationStore.read(id) ?? { lang: "en", units: {} };
    // 最后一次 await 后同步核对、认领并扣预算，避免新原文已落盘却仍拿旧快照占额度。
    const reading = await this.deps.store.read<StoredReading>(id);
    const keys = new Set(units.map((unit) => unit.key));
    const current = extractUnits(reading).filter((unit) => keys.has(unit.key));
    const expectedHashes = units.map((unit) => `${unit.key}:${sourceHash(unit)}`).join("|");
    const currentHashes = current.map((unit) => `${unit.key}:${sourceHash(unit)}`).join("|");
    if (expectedHashes !== currentHashes) return undefined;
    const claimed = this.claimTranslatableUnits(id, document, units);
    try {
      this.reserveBudget(claimed.length);
    } catch (error) {
      this.releaseClaims(id, claimed);
      throw error;
    }
    return { document, claimed };
  }

  private async prepare(
    id: string,
    unitKeys: readonly TranslationUnitKey[] | undefined,
    eligible: (reading: StoredReading, units: readonly TranslationUnit[]) => boolean,
  ): Promise<{ document: StoredTranslation; units: TranslationUnit[] } | undefined> {
    const keys = unitKeys ? new Set<TranslationUnitKey>(unitKeys) : undefined;
    const select = (reading: StoredReading) => (
      extractUnits(reading).filter((unit) => !keys || keys.has(unit.key))
    );
    while (true) {
      // 同一解读的「重读当前原文 + 原子准备译文」按调用顺序执行，旧通知不能越过新通知写回。
      const previous = this.preparationQueues.get(id) ?? Promise.resolve();
      const task = previous.catch(() => undefined).then(async () => {
        const reading = await this.deps.store.read<StoredReading>(id);
        const units = select(reading);
        if (!eligible(reading, units)) return undefined;
        const now = this.clock().getTime();
        const document = await this.translationStore.update(id, (stored) => {
          const next: StoredTranslation = { ...stored, units: { ...stored.units } };
          for (const unit of units) {
            const hash = sourceHash(unit);
            const state = stored.units[unit.key];
            next.units[unit.key] = state?.sourceHash === hash
              ? state
              : { status: "pending", sourceHash: hash, attempts: 0, failures: 0 };
            const current = next.units[unit.key]!;
            if (unit.entries.length === 0 && current.status !== "done") {
              next.units[unit.key] = { ...current, status: "done", texts: [], failures: 0 };
            } else if (current.cooldownUntil && Date.parse(current.cooldownUntil) <= now) {
              const { cooldownUntil: _cooldown, ...rest } = current;
              next.units[unit.key] = rest;
            }
          }
          return next;
        });
        return { document, units };
      });
      this.preparationQueues.set(id, task);
      let prepared: Awaited<typeof task>;
      try {
        prepared = await task;
      } finally {
        if (this.preparationQueues.get(id) === task) this.preparationQueues.delete(id);
      }
      if (!prepared) return undefined;
      // 准备期间原文若再次变化，先循环到最新版，再允许预算和 provider 调用。
      const currentReading = await this.deps.store.read<StoredReading>(id);
      const currentUnits = select(currentReading);
      if (!eligible(currentReading, currentUnits)) return undefined;
      const preparedHashes = prepared.units.map((unit) => `${unit.key}:${sourceHash(unit)}`).join("|");
      const currentHashes = currentUnits.map((unit) => `${unit.key}:${sourceHash(unit)}`).join("|");
      if (preparedHashes === currentHashes) return prepared;
    }
  }

  private claimTranslatableUnits(
    id: string,
    document: StoredTranslation,
    units: readonly TranslationUnit[],
  ): TranslationUnit[] {
    const now = this.clock().getTime();
    const claimed = units.filter((unit) => {
      const state = document.units[unit.key]!;
      const requestKey = this.unitRequestKey(id, unit);
      const running = this.unitJobs.get(this.unitWorkKey(id, unit));
      return unit.entries.length > 0
        && state.status !== "done"
        && (!state.cooldownUntil || Date.parse(state.cooldownUntil) <= now)
        && !this.unitClaims.has(requestKey)
        && running?.sourceHash !== state.sourceHash;
    });
    for (const unit of claimed) this.unitClaims.add(this.unitRequestKey(id, unit));
    return claimed;
  }

  private releaseClaims(id: string, units: readonly TranslationUnit[]): void {
    for (const unit of units) this.unitClaims.delete(this.unitRequestKey(id, unit));
  }

  private unitWorkKey(id: string, unit: TranslationUnit): string {
    return `${id}:${unit.key}`;
  }

  private unitRequestKey(id: string, unit: TranslationUnit): string {
    return `${this.unitWorkKey(id, unit)}:${sourceHash(unit)}`;
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
    const key = this.unitWorkKey(id, unit);
    const hash = sourceHash(unit);
    const existing = this.unitJobs.get(key);
    if (existing?.sourceHash === hash) return existing.promise;
    const job = (async () => {
      if (existing) {
        try {
          await existing.promise;
        } catch {
          // 前一版原文的任务失败，也要继续处理最新原文。
        }
      }
      await this.translateUnit(id, unit);
    })();
    const record = { sourceHash: hash, promise: job };
    this.unitJobs.set(key, record);
    try {
      await job;
    } finally {
      if (this.unitJobs.get(key) === record) this.unitJobs.delete(key);
    }
  }

  private async translateUnit(id: string, unit: TranslationUnit): Promise<void> {
    const before = await this.translationStore.read(id);
    const state = before?.units[unit.key];
    if (!state || state.status === "done" || unit.entries.length === 0) return;
    if (state.sourceHash !== sourceHash(unit)) return;
    if (state.cooldownUntil && Date.parse(state.cooldownUntil) > this.clock().getTime()) return;
    if (!await this.setStateForHash(id, unit.key, state.sourceHash, {
      ...state, status: "writing",
    })) return;
    let attempts = state.attempts;
    try {
      const initial = await this.generate(unit, false);
      attempts += 1;
      let texts = Array.isArray(initial.texts)
        ? initial.texts.slice(0, unit.entries.length)
        : [];
      let checked = checkTranslation(unit, { texts });
      if (checked.acceptable && checked.warnings.length > 0) {
        if (!await this.hashStillCurrent(id, unit)) return;
        const stored = await this.setStateForHash(id, unit.key, state.sourceHash, {
          status: "done", sourceHash: state.sourceHash, texts,
          attempts, failures: 0, warnings: checked.warnings.slice(0, 20),
        });
        if (!stored) return;
        await this.logSafely("英文翻译单元先采用含警告译文", {
          readingId: id, unit: unit.key, warnings: checked.warnings.length,
        });
        const improvement = this.improveSoftWarnings(id, unit, state.sourceHash, texts, attempts, checked);
        keepAlive(improvement);
        void improvement.catch(async () => {
          await this.logSafely("英文翻译单元后台补译异常", { readingId: id, unit: unit.key });
        });
        return;
      }
      if (!checked.ok) {
        const repairUnit: TranslationUnit = {
          ...unit,
          entries: checked.invalidIndexes.map((index) => unit.entries[index]!),
        };
        const repair = await this.generate(repairUnit, true);
        attempts += 1;
        const repairChecked = checkTranslation(repairUnit, repair);
        // 逐条采用：补译后的某条没有硬性问题，就替换原译文。
        checked.invalidIndexes.forEach((originalIndex, repairIndex) => {
          const candidate = Array.isArray(repair.texts) ? repair.texts[repairIndex] : undefined;
          if (typeof candidate === "string" && !repairChecked.hardIndexes.includes(repairIndex)) {
            texts[originalIndex] = candidate;
          }
        });
        checked = checkTranslation(unit, { texts });
      }
      if (!checked.acceptable) {
        // 偶发漏翻（如残留「旺盛」）时整单元再译一次，仍不合格才判失败。
        const again = await this.generate(unit, false);
        attempts += 1;
        const retried = Array.isArray(again.texts) ? again.texts.slice(0, unit.entries.length) : [];
        const retriedCheck = checkTranslation(unit, { texts: retried });
        if (retriedCheck.acceptable) {
          texts = retried;
          checked = retriedCheck;
        }
      }
      if (!checked.acceptable) {
        await this.failUnit(id, unit, state, attempts, checked.hardErrors.join("；"));
        return;
      }
      if (!await this.hashStillCurrent(id, unit)) return;
      const stored = await this.setStateForHash(id, unit.key, state.sourceHash, {
        status: "done", sourceHash: state.sourceHash, texts,
        attempts, failures: 0,
        ...(checked.warnings.length ? { warnings: checked.warnings.slice(0, 20) } : {}),
      });
      if (!stored) return;
      await this.deps.logger.write("英文翻译单元完成", { readingId: id, unit: unit.key, attempts });
    } catch (error) {
      await this.failUnit(id, unit, state, attempts + 1,
        error instanceof Error ? error.name : "TranslationError");
    }
  }

  private async improveSoftWarnings(
    id: string,
    unit: TranslationUnit,
    expectedHash: string,
    originalTexts: string[],
    attempts: number,
    originalCheck: ReturnType<typeof checkTranslation>,
  ): Promise<void> {
    const indexes = originalCheck.invalidIndexes;
    if (indexes.length === 0) return;
    const repairUnit: TranslationUnit = {
      ...unit,
      entries: indexes.map((index) => unit.entries[index]!),
    };
    const repair = await this.generate(repairUnit, true);
    const candidates = Array.isArray(repair.texts) ? repair.texts : [];
    const improved = [...originalTexts];
    let replacements = 0;
    indexes.forEach((originalIndex, repairIndex) => {
      const candidate = candidates[repairIndex];
      if (typeof candidate !== "string") return;
      const entry = unit.entries[originalIndex]!;
      const singleUnit = { ...unit, entries: [entry] };
      const before = checkTranslation(singleUnit, { texts: [originalTexts[originalIndex]] });
      const after = checkTranslation(singleUnit, { texts: [candidate] });
      if (after.acceptable && after.warnings.length < before.warnings.length) {
        improved[originalIndex] = candidate;
        replacements += 1;
      }
    });
    if (!await this.hashStillCurrent(id, unit)) return;
    const checked = checkTranslation(unit, { texts: improved });
    await this.translationStore.update(id, (document) => {
      const current = document.units[unit.key];
      if (!current || current.sourceHash !== expectedHash || current.status !== "done") return document;
      return { ...document, units: { ...document.units, [unit.key]: {
        status: "done", sourceHash: expectedHash, texts: improved,
        attempts: attempts + 1, failures: 0,
        ...(checked.warnings.length ? { warnings: checked.warnings.slice(0, 20) } : {}),
      } } };
    });
    await this.logSafely("英文翻译单元后台补译完成", {
      readingId: id, unit: unit.key, replacements,
    });
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
      await this.translationStore.update(id, (document) => {
        const state = document.units[unit.key];
        if (state && state.sourceHash !== sourceHash(unit)) return document;
        return { ...document, units: { ...document.units, [unit.key]: {
          status: "pending", sourceHash: sourceHash(current), attempts: 0, failures: 0,
        } } };
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
    const stored = await this.setStateForHash(id, unit.key, previous.sourceHash, {
      status: "failed", sourceHash: previous.sourceHash, attempts, failures, error,
      ...(cooldownUntil ? { cooldownUntil } : {}),
    });
    if (!stored) return;
    await this.deps.logger.write("英文翻译单元失败", {
      readingId: id, unit: unit.key, failures,
    });
  }

  private async setStateForHash(
    id: string,
    key: TranslationUnit["key"],
    expectedHash: string,
    state: StoredTranslationUnit,
  ): Promise<boolean> {
    const updated = await this.translationStore.update(id, (document) => {
      if (document.units[key]?.sourceHash !== expectedHash) return document;
      return { ...document, units: { ...document.units, [key]: state } };
    });
    const current = updated.units[key];
    return current?.sourceHash === expectedHash && current.status === state.status;
  }

  private async logSafely(
    message: string,
    fields: Readonly<Record<string, string | number | boolean>>,
  ): Promise<void> {
    try {
      await this.deps.logger.write(message, fields);
    } catch {
      // 旁路日志失败不得影响解读或翻译状态。
    }
  }
}
