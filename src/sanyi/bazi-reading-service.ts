// src/sanyi/bazi-reading-service.ts
import { almanacAt } from "../calendar/almanac.js";
import { buildBaziChart } from "../calendar/bazi.js";
import { analyzeBazi } from "../calendar/bazi-relations.js";
import { lookupQiongtong } from "../calendar/qiongtong.js";
import { correctBirthTime } from "../calendar/solar-time.js";
import type { StructuredOutputProvider } from "../agent/provider.js";
import { normalizeBirthProfile } from "./birth-profile.js";
import { buildBaziFacts } from "./bazi-facts.js";
import { derivedChart } from "./bazi-public.js";
import { runBaziSchool } from "./bazi-school-runner.js";
import { resolveFortuneContext, periodFacts } from "./fortune-context.js";
import type { FortuneHorizon } from "./classify.js";
import type { SanyiFeeProof, SanyiFeeVerifier } from "./fee.js";
import type { SanyiLogger } from "./log.js";
import { LimitExceededError, PaymentAlreadyUsedError, StateConflictError } from "./reading-service.js";
import { SanyiInputError } from "./http-errors.js";
import { BAZI_SCHOOLS } from "./schools/bazi-index.js";
import type { BaziSchool, BaziSchoolInput, BaziSchoolKey } from "./schools/bazi-shared.js";
import { ReadingStore, newReadingId, type BaziSchoolState, type StoredBaziReading,
  type StoredReading } from "./store.js";
interface Dependencies {
  store: ReadingStore;
  provider: StructuredOutputProvider;
  feeVerifier: SanyiFeeVerifier;
  logger: SanyiLogger;
  clock: () => Date;
}
function schools(previous?: StoredBaziReading["schools"]): StoredBaziReading["schools"] {
  function state(key: BaziSchoolKey): BaziSchoolState {
    return { status: "writing", attempts: previous?.[key].attempts ?? 0,
      retries: previous?.[key].retries ?? 0 };
  }
  return { shenxiaozhan: state("shenxiaozhan"), yuchuntai: state("yuchuntai"),
    rentieqiao: state("rentieqiao") };
}
function chartFrom(birth: unknown, sect: 1 | 2, targetYear: number) {
  try {
    const profile = normalizeBirthProfile(birth);
    const corrected = correctBirthTime(profile.civil, profile.timeKnown, profile.longitude,
      { mainlandDst: profile.mainlandDst, birthplace: profile.birthplace });
    const chart = derivedChart(buildBaziChart({ corrected: corrected.effective, gender: profile.gender,
      timeKnown: profile.timeKnown, sect, targetYear }));
    let dst: StoredBaziReading["correction"]["dst"] = "not-applied";
    if (!profile.mainlandDst) {
      dst = "skipped-region";
    } else if (corrected.steps.some((step) => step.kind === "dst" && step.applied)) {
      dst = "applied";
    }
    const solar = corrected.steps.some((step) => step.kind === "solar" && step.applied)
      ? "applied" as const : "not-applied" as const;
    return { chart, correction: { dst, solar, timeKnown: profile.timeKnown, sect } };
  } catch {
    // 校验或底层错误可能包含输入，不把异常原文传播到日志或存档。
    throw new SanyiInputError("生辰格式或排盘口径无效，请检查填写内容");
  }
}
export class BaziReadingService {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly background = new Map<string, Promise<void>>();
  constructor(private readonly deps: Dependencies) {}
  async create(input: {
    kind: "destiny" | "fortune";
    question: string;
    birth: unknown;
    sect: 1 | 2;
    horizon: FortuneHorizon;
    feeProof: SanyiFeeProof;
  }): Promise<StoredBaziReading> {
    // 付款核验先于排盘；API 仅先做请求格式校验，不生成命盘。
    const receipt = await this.deps.feeVerifier.verify(input.feeProof);
    if (receipt.feeUsdc6 !== "50000") {
      throw new SanyiInputError("卦金付款凭证金额不完整");
    }
    const now = this.deps.clock();
    const context = resolveFortuneContext(input.horizon, () => now, input.sect);
    const { chart, correction } = chartFrom(input.birth, input.sect, context.anchorYear);
    const id = newReadingId();
    const existing = await this.deps.store.claimPayment(receipt.transactionHash.toLowerCase(), id);
    if (existing) {
      throw new PaymentAlreadyUsedError(existing);
    }
    const reading: StoredBaziReading = { id, kind: input.kind, question: input.question,
      createdAt: now.toISOString(), payment: { payer: receipt.payer, recipient: receipt.recipient,
        transactionHash: receipt.transactionHash, feeUsdc6: receipt.feeUsdc6 },
      chart, correction, context, analysis: analyzeBazi(chart),
      tiaohou: lookupQiongtong(chart.dayMaster, chart.pillars.month.branch),
      almanac: almanacAt(BigInt(Math.floor(now.getTime() / 1_000))),
      changes: 0, status: "writing", schools: schools() };
    await this.deps.store.write(reading);
    this.start(id, () => this.runAll(reading));
    return reading;
  }
  async readAny(id: string): Promise<StoredReading> {
    return this.deps.store.read<StoredReading>(id);
  }
  async getReading(id: string): Promise<StoredBaziReading> {
    const reading = await this.deps.store.read<StoredReading>(id);
    if (reading.kind === "question") {
      throw new StateConflictError("此接口只适用于命理或运势");
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
      if (this.queues.get(id) === tail) {
        this.queues.delete(id);
      }
    }
  }
  async changeDayBoundary(id: string, birth: unknown, sect: 1 | 2): Promise<StoredBaziReading> {
    return this.lock(id, async () => {
      const current = await this.getReading(id);
      if (current.changes >= 2) {
        throw new LimitExceededError("换日切换次数已用尽");
      }
      const writing = Object.values(current.schools).some((state) => state.status === "writing");
      if (current.status !== "done" || writing) {
        throw new StateConflictError("三家尚未全部落笔，请稍后切换换日口径");
      }
      if (sect === current.chart.sect || (sect !== 1 && sect !== 2)) {
        throw new SanyiInputError("请选择另一种换日口径");
      }
      const original = chartFrom(birth, current.chart.sect, current.context.anchorYear).chart;
      const signature = (chart: typeof original) => {
        return { pillars: Object.values(chart.pillars).map((pillar) => pillar?.ganZhi ?? null),
          luck: chart.luck === null ? null : { direction: chart.luck.direction, start: chart.luck.start } };
      };
      if (JSON.stringify(signature(original)) !== JSON.stringify(signature(current.chart))) {
        throw new SanyiInputError("生辰与本卦命盘不符");
      }
      const { chart, correction } = chartFrom(birth, sect, current.context.anchorYear);
      // 所问时刻保持创建时刻，today 的流日按新 sect 重算，不漂移到切换当天。
      const context = resolveFortuneContext(current.context.horizon, () => new Date(current.createdAt), sect);
      const updated: StoredBaziReading = { ...current, chart, correction, context,
        analysis: analyzeBazi(chart), tiaohou: lookupQiongtong(chart.dayMaster, chart.pillars.month.branch),
        changes: current.changes + 1, status: "writing", schools: schools(current.schools) };
      await this.deps.store.write(updated);
      this.start(id, () => this.runAll(updated));
      return updated;
    });
  }
  async retrySchool(id: string, key: BaziSchoolKey): Promise<StoredBaziReading> {
    return this.lock(id, async () => {
      const current = await this.getReading(id);
      const state = current.schools[key];
      if (!state || state.status !== "failed" || current.status !== "done") {
        throw new StateConflictError("此家当前状态不可重试");
      }
      if (state.retries >= 2) {
        throw new LimitExceededError("此家重试次数已用尽");
      }
      const school = BAZI_SCHOOLS.find((item) => item.key === key);
      if (!school) {
        throw new SanyiInputError("三家键无效");
      }
      const updated = await this.deps.store.update<StoredBaziReading>(id, (reading) => ({ ...reading,
        status: "writing", schools: { ...reading.schools,
          [key]: { status: "writing", attempts: state.attempts, retries: state.retries + 1 } } }));
      this.start(id, async () => {
        await this.runOne(updated, school);
        await this.finish(id);
      });
      return updated;
    });
  }
  private input(reading: StoredBaziReading, school: BaziSchool): BaziSchoolInput & { school: BaziSchool } {
    return { school, kind: reading.kind, question: reading.question, horizon: reading.context.horizon,
      chart: reading.chart, facts: buildBaziFacts(reading.chart, reading.analysis, reading.tiaohou),
      tiaohou: reading.tiaohou,
      period: { label: reading.context.label, facts: periodFacts(reading.context, reading.chart) } };
  }
  private async runOne(reading: StoredBaziReading, school: BaziSchool): Promise<void> {
    const result = await runBaziSchool({ provider: this.deps.provider }, this.input(reading, school));
    await this.deps.store.update<StoredBaziReading>(reading.id, (current) => {
      const old = current.schools[school.key];
      const state: BaziSchoolState = { status: result.status,
        attempts: old.attempts + result.calls, retries: old.retries };
      if (result.status === "done") {
        state.output = result.output;
      } else {
        // 错误详情可能含模型回显；落盘只用固定中文说明。
        state.error = "此家解读失败，可免费重试";
      }
      return { ...current, schools: { ...current.schools, [school.key]: state } };
    });
  }
  private async runAll(reading: StoredBaziReading): Promise<void> {
    await Promise.all(BAZI_SCHOOLS.map((school) => this.runOne(reading, school)));
    await this.finish(reading.id);
  }
  private async finish(id: string): Promise<void> {
    await this.deps.store.update<StoredBaziReading>(id, (reading) => ({ ...reading, status: "done" }));
    await this.deps.logger.write("八字三家落笔完成", { readingId: id });
  }
  private start(id: string, operation: () => Promise<void>): void {
    const task = operation().catch(async () => {
      try {
        await this.deps.store.update<StoredBaziReading>(id, (reading) => ({ ...reading, status: "failed" }));
        await this.deps.logger.write("八字编排失败", { readingId: id });
      } catch {
        // 存储和日志异常不得产生未处理拒绝，也不得回显生辰。
      }
    });
    this.background.set(id, task);
    void task.then(() => {
      if (this.background.get(id) === task) {
        this.background.delete(id);
      }
    });
  }
}
