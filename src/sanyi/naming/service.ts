import { buildBaziChart } from "../../calendar/bazi.js";
import { analyzeBazi } from "../../calendar/bazi-relations.js";
import { lookupQiongtong } from "../../calendar/qiongtong.js";
import { correctBirthTime } from "../../calendar/solar-time.js";
import type { StructuredOutputProvider } from "../../agent/provider.js";
import { normalizeBirthProfile } from "../birth-profile.js";
import { derivedChart } from "../bazi-public.js";
import type { SanyiFeeProof, SanyiFeeVerifier } from "../fee.js";
import { SanyiInputError } from "../http-errors.js";
import type { SanyiLogger } from "../log.js";
import {
  LimitExceededError,
  PaymentAlreadyUsedError,
  StateConflictError,
} from "../reading-service.js";
import {
  ReadingStore,
  newReadingId,
  type NamingFamilyState,
  type NamingSummaryState,
  type StoredNamingReading,
  type StoredReading,
} from "../store.js";
import { lineById, pickCandidates } from "./classics.js";
import { NAMING_FAMILIES } from "./families.js";
import { eightCharCounts, industryElement, supplementElements } from "./favorable.js";
import { isNameChar, isSurname } from "./lexicon.js";
import {
  runNamingFamilyWithRetry,
  runNamingSummaryWithRetry,
  type NamingFamily,
} from "./runner.js";
import type { NamingContext, NamingFamilyKey, NamingFamilyOutput } from "./schema.js";

interface Dependencies {
  store: ReadingStore;
  provider: StructuredOutputProvider;
  feeVerifier: SanyiFeeVerifier;
  logger: SanyiLogger;
  clock: () => Date;
}

export interface NamingCreateInput {
  target: "person" | "business";
  question: string;
  surname?: string;
  gender: "male" | "female" | "any";
  length: 1 | 2 | 3 | 4;
  unborn: boolean;
  birth?: unknown;
  feeProof: SanyiFeeProof;
}

function initialFamilies(): StoredNamingReading["families"] {
  const state = (): NamingFamilyState => ({ status: "writing", attempts: 0, retries: 0 });
  return { wuxing: state(), shiwen: state(), yinyi: state() };
}

function validateInput(input: NamingCreateInput): void {
  if (input.target !== "person" && input.target !== "business") {
    throw new SanyiInputError("起名对象无效");
  }
  if (!(["male", "female", "any"] as const).includes(input.gender)) {
    throw new SanyiInputError("性别无效");
  }
  if (typeof input.question !== "string" || [...input.question].length > 280) {
    throw new SanyiInputError("起名期望须为 0–280 个字符");
  }
  if (typeof input.unborn !== "boolean") {
    throw new SanyiInputError("未出生标记无效");
  }
  if (input.target === "person") {
    if (!input.surname) throw new SanyiInputError("请先填写姓氏");
    if (!isSurname(input.surname)) throw new SanyiInputError("这个姓暂不支持，请联系我们");
    if (input.length !== 1 && input.length !== 2) {
      throw new SanyiInputError("人名须选择单名或双名");
    }
    if (input.birth === undefined || input.birth === null) {
      throw new SanyiInputError("请先填写生辰");
    }
  } else {
    if (input.length !== 2 && input.length !== 3 && input.length !== 4) {
      throw new SanyiInputError("商号字数须为 2–4 字");
    }
    if ([...input.question.trim()].length < 2) {
      throw new SanyiInputError("商号行业与期望至少填写 2 个字符");
    }
    if (input.unborn) throw new SanyiInputError("商号不支持未出生标记");
  }
}

function birthFor(input: NamingCreateInput): unknown {
  if (!input.birth || typeof input.birth !== "object" || Array.isArray(input.birth)) {
    return input.birth;
  }
  const birth = input.birth as Record<string, unknown>;
  if (input.target === "person") {
    return {
      ...birth,
      gender: input.gender === "any" ? "male" : input.gender,
      ...(input.unborn ? { time: null } : {}),
    };
  }
  return birth;
}

function chartBasis(input: NamingCreateInput, targetYear: number): Pick<
  StoredNamingReading["basis"], "pillars" | "elements" | "tiaohou" | "counts"
> {
  if (input.birth === undefined || input.birth === null) {
    return { pillars: null, elements: [], tiaohou: null };
  }
  try {
    const profile = normalizeBirthProfile(birthFor(input));
    const corrected = correctBirthTime(profile.civil, profile.timeKnown, profile.longitude,
      { mainlandDst: profile.mainlandDst, birthplace: profile.birthplace });
    const chart = derivedChart(buildBaziChart({
      corrected: corrected.effective,
      gender: input.gender === "any" ? "male" : profile.gender,
      timeKnown: profile.timeKnown,
      sect: 1,
      targetYear,
    }));
    const tiaohou = lookupQiongtong(chart.dayMaster, chart.pillars.month.branch);
    const pillars = {
        year: chart.pillars.year.ganZhi,
        month: chart.pillars.month.ganZhi,
        day: chart.pillars.day.ganZhi,
        time: chart.pillars.time?.ganZhi ?? null,
      };
    return {
      pillars,
      elements: analyzeBazi(chart).elements,
      tiaohou,
      counts: eightCharCounts(pillars),
    };
  } catch {
    throw new SanyiInputError("生辰格式或排盘口径无效，请检查填写内容");
  }
}

function favorableBasis(
  question: string,
  basis: Pick<StoredNamingReading["basis"], "tiaohou" | "counts">,
): Pick<
  StoredNamingReading["basis"],
  "favorable" | "favorableSource" | "favorableNote" | "missing"
> {
  if (basis.tiaohou && basis.counts) {
    return supplementElements({ counts: basis.counts, tiaohou: basis.tiaohou.useStems });
  }
  const industry = industryElement(question);
  return industry
    ? {
      favorable: [industry.element],
      favorableSource: "industry",
      favorableNote: `按行业：${industry.keyword} → ${industry.element}`,
    }
    : {
      favorable: null,
      favorableSource: "model",
      favorableNote: "行业未匹配，由五行补益家自选",
    };
}

function favorableNote(reading: StoredNamingReading): string {
  if (reading.basis.favorableSource === "missing") {
    return reading.basis.missing?.length
      ? `八字缺${reading.basis.missing.join("、")}，宜补${reading.basis.favorable?.join("、") ?? ""}`
      : "按八字所缺五行补益";
  }
  if (reading.basis.favorableSource === "tiaohou") {
    return `调候取${reading.basis.tiaohou?.useStems.join("、") ?? ""}`;
  }
  if (reading.basis.favorableSource === "industry") {
    const industry = industryElement(reading.question);
    return industry ? `按行业：${industry.keyword} → ${industry.element}` : "按行业确定五行";
  }
  return "行业未匹配，由五行补益家自选";
}

export class NamingReadingService {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly background = new Map<string, Promise<void>>();

  constructor(private readonly deps: Dependencies) {}

  async create(input: NamingCreateInput): Promise<StoredNamingReading> {
    validateInput(input);
    // 付款核验先于排盘；格式校验不生成命盘。
    const receipt = await this.deps.feeVerifier.verify(input.feeProof);
    if (receipt.feeUsdc6 !== "50000") {
      throw new SanyiInputError("卦金付款凭证金额不完整");
    }
    const now = this.deps.clock();
    const chart = chartBasis(input, now.getFullYear());
    const favorable = favorableBasis(input.question, chart);
    const id = newReadingId();
    const existing = await this.deps.store.claimPayment(receipt.transactionHash.toLowerCase(), id);
    if (existing) throw new PaymentAlreadyUsedError(existing);
    const candidates = pickCandidates({
      seed: id,
      length: input.length,
      count: 60,
      prefer: [...input.question].filter(isNameChar),
    });
    const reading: StoredNamingReading = {
      id,
      kind: "naming",
      createdAt: now.toISOString(),
      target: input.target,
      question: input.question,
      ...(input.target === "person" && input.surname ? { surname: input.surname } : {}),
      gender: input.gender,
      length: input.length,
      unborn: input.unborn,
      payment: {
        payer: receipt.payer,
        recipient: receipt.recipient,
        transactionHash: receipt.transactionHash,
        feeUsdc6: receipt.feeUsdc6,
      },
      status: "writing",
      basis: { ...chart, ...favorable, unborn: input.unborn },
      candidateIds: candidates.map(({ id: candidateId }) => candidateId),
      families: initialFamilies(),
    };
    await this.deps.store.write(reading);
    this.start(id, () => this.runAll(reading));
    return reading;
  }

  async readAny(id: string): Promise<StoredReading> {
    return this.deps.store.read<StoredReading>(id);
  }

  async getReading(id: string): Promise<StoredNamingReading> {
    const reading = await this.deps.store.read<StoredReading>(id);
    if (reading.kind !== "naming") {
      throw new StateConflictError("此接口只适用于起名");
    }
    return reading;
  }

  async whenSettled(id: string): Promise<void> {
    await (this.background.get(id) ?? Promise.resolve());
  }

  private async lock<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const result = previous.catch(() => {}).then(action);
    const tail = result.then(() => {}, () => {});
    this.queues.set(id, tail);
    try {
      return await result;
    } finally {
      if (this.queues.get(id) === tail) this.queues.delete(id);
    }
  }

  private context(reading: StoredNamingReading): NamingContext {
    return {
      target: reading.target,
      ...(reading.surname ? { surname: reading.surname } : {}),
      gender: reading.gender,
      length: reading.length,
      question: reading.question,
      favorable: reading.basis.favorable,
      favorableSource: reading.basis.favorableSource,
      favorableNote: reading.basis.favorableNote ?? favorableNote(reading),
      candidates: reading.candidateIds.flatMap((id) => {
        const line = lineById(id);
        return line ? [line] : [];
      }),
    };
  }

  private async runOne(reading: StoredNamingReading, family: NamingFamily): Promise<void> {
    const result = await runNamingFamilyWithRetry(
      { provider: this.deps.provider },
      { family, ctx: this.context(reading) },
    );
    await this.deps.store.update<StoredNamingReading>(reading.id, (current) => {
      const previous = current.families[family.key];
      const state: NamingFamilyState = {
        status: result.status,
        attempts: previous.attempts + result.calls,
        retries: previous.retries,
      };
      if (result.status === "done") {
        state.output = result.output;
        if (result.removed > 0) state.removed = result.removed;
      } else {
        state.error = "此家起名失败，可免费重试";
      }
      return { ...current, families: { ...current.families, [family.key]: state } };
    });
  }

  private async runAll(reading: StoredNamingReading): Promise<void> {
    await Promise.all(NAMING_FAMILIES.map((family) => this.runOne(reading, family)));
    await this.writeSummary(reading.id, false);
    await this.finish(reading.id);
  }

  async retryFamily(id: string, key: NamingFamilyKey): Promise<StoredNamingReading> {
    return this.lock(id, async () => {
      const current = await this.getReading(id);
      const state = current.families[key];
      if (!state || state.status !== "failed" || current.status !== "done") {
        throw new StateConflictError("此家当前状态不可重试");
      }
      if (state.retries >= 2) throw new LimitExceededError("此家重试次数已用尽");
      const family = NAMING_FAMILIES.find((item) => item.key === key);
      if (!family) throw new SanyiInputError("三家键无效");
      const updated = await this.deps.store.update<StoredNamingReading>(id, (reading) => ({
        ...reading,
        status: "writing",
        families: {
          ...reading.families,
          [key]: { status: "writing", attempts: state.attempts, retries: state.retries + 1 },
        },
      }));
      this.start(id, async () => {
        await this.runOne(updated, family);
        await this.writeSummary(id, true);
        await this.finish(id);
      });
      return updated;
    });
  }

  private summaryFamilies(reading: StoredNamingReading): Partial<
    Record<NamingFamilyKey, NamingFamilyOutput>
  > {
    const outputs: Partial<Record<NamingFamilyKey, NamingFamilyOutput>> = {};
    for (const family of NAMING_FAMILIES) {
      const state = reading.families[family.key];
      if (state.status === "done" && state.output) outputs[family.key] = state.output;
    }
    return outputs;
  }

  private async writeSummary(id: string, preserveRetries: boolean): Promise<void> {
    const reading = await this.getReading(id);
    const families = this.summaryFamilies(reading);
    const basis = Object.keys(families).length;
    const previous = reading.summary;
    if (basis === 0) {
      await this.deps.store.update<StoredNamingReading>(id, (current) => ({
        ...current,
        summary: {
          status: "failed", basis: 0, attempts: previous?.attempts ?? 0,
          retries: previous?.retries ?? 0, error: "三家均未落笔，暂无合参",
        },
      }));
      return;
    }
    await this.deps.store.update<StoredNamingReading>(id, (current) => ({
      ...current,
      summary: {
        status: "writing",
        basis,
        attempts: previous?.attempts ?? 0,
        retries: preserveRetries ? previous?.retries ?? 0 : 0,
      },
    }));
    const result = await runNamingSummaryWithRetry(
      { provider: this.deps.provider },
      reading.target === "person"
        ? {
          target: "person", surname: reading.surname ?? "", families,
          favorable: reading.basis.favorable, missing: reading.basis.missing ?? [],
        }
        : {
          target: "business", families,
          favorable: reading.basis.favorable, missing: reading.basis.missing ?? [],
        },
    );
    await this.deps.store.update<StoredNamingReading>(id, (current) => {
      const before = current.summary;
      const state: NamingSummaryState = {
        status: result.status,
        basis,
        attempts: (before?.attempts ?? 0) + result.calls,
        retries: before?.retries ?? 0,
      };
      if (result.status === "done") {
        state.output = result.output;
        if (result.removed > 0) state.removed = result.removed;
      } else {
        state.error = "三家合参暂未生成，可免费重试";
      }
      return { ...current, summary: state };
    });
  }

  async retrySummary(id: string): Promise<StoredNamingReading> {
    return this.lock(id, async () => {
      const current = await this.getReading(id);
      const summary = current.summary;
      if (!summary || summary.status !== "failed" || current.status !== "done") {
        throw new StateConflictError("三家合参当前不可重试");
      }
      if (summary.retries >= 2) throw new LimitExceededError("三家合参重试次数已用尽");
      const updated = await this.deps.store.update<StoredNamingReading>(id, (reading) => ({
        ...reading,
        summary: { ...summary, status: "writing", retries: summary.retries + 1 },
      }));
      this.start(id, () => this.writeSummary(id, true));
      return updated;
    });
  }

  private async finish(id: string): Promise<void> {
    await this.deps.store.update<StoredNamingReading>(id, (reading) => ({ ...reading, status: "done" }));
    await this.deps.logger.write("起名三家落笔完成", { readingId: id });
  }

  private start(id: string, operation: () => Promise<void>): void {
    const task = operation().catch(async () => {
      try {
        await this.deps.store.update<StoredNamingReading>(id, (reading) => ({
          ...reading, status: "failed",
        }));
        await this.deps.logger.write("起名编排失败", { readingId: id });
      } catch {
        // 存储与日志异常不得造成未处理拒绝，也不得回显生辰。
      }
    });
    this.background.set(id, task);
    void task.then(() => {
      if (this.background.get(id) === task) this.background.delete(id);
    });
  }
}
