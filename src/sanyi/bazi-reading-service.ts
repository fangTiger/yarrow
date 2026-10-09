// src/sanyi/bazi-reading-service.ts
import { almanacAt } from "../calendar/almanac.js";
import { buildBaziChart } from "../calendar/bazi.js";
import { analyzeBazi } from "../calendar/bazi-relations.js";
import { lookupQiongtong } from "../calendar/qiongtong.js";
import { correctBirthTime } from "../calendar/solar-time.js";
import type { StructuredOutputProvider } from "../agent/provider.js";
import { normalizeBirthProfile } from "./birth-profile.js";
import { buildBaziFacts } from "./bazi-facts.js";
import { derivedChart, yearConsensus } from "./bazi-public.js";
import { auditBaziSummaryProse } from "./bazi-audit.js";
import {
  averageConfidence, runSummaryWithRetry, summaryState, type SummaryInput, type SummarySchool,
} from "./summary.js";
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
    if (reading.kind !== "destiny" && reading.kind !== "fortune") {
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
        await this.writeSummary(id, true);
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
    let result = await runBaziSchool({ provider: this.deps.provider }, this.input(reading, school));
    if (result.status === "failed") {
      // 模型调用偶发失败（超时、网络）时后台自动再试一次，不占用户的免费重试次数。
      const again = await runBaziSchool({ provider: this.deps.provider }, this.input(reading, school));
      result = { ...again, calls: again.calls + result.calls };
    }
    await this.deps.store.update<StoredBaziReading>(reading.id, (current) => {
      const old = current.schools[school.key];
      const state: BaziSchoolState = { status: result.status,
        attempts: old.attempts + result.calls, retries: old.retries };
      if (result.status === "done") {
        state.output = result.output;
        if (result.removed > 0) {
          state.removed = result.removed;
        }
        if (result.adjusted > 0) {
          state.adjusted = result.adjusted;
        }
      } else {
        // 错误详情可能含模型回显；落盘只用固定中文说明。
        state.error = "此家解读失败，可免费重试";
      }
      return { ...current, schools: { ...current.schools, [school.key]: state } };
    });
  }
  private async runAll(reading: StoredBaziReading): Promise<void> {
    await Promise.all(BAZI_SCHOOLS.map((school) => this.runOne(reading, school)));
    // 三家落笔后写白话总述，写完才算这一卦完成。
    await this.writeSummary(reading.id, false);
    await this.finish(reading.id);
  }

  /** 白话总述暂未生成时免费重试，至多两次。 */
  async retrySummary(id: string): Promise<StoredBaziReading> {
    return this.lock(id, async () => {
      const current = await this.getReading(id);
      const summary = current.summary;
      if (!summary || summary.status !== "failed" || current.status !== "done") {
        throw new StateConflictError("白话总述当前不可重试");
      }
      if (summary.retries >= 2) {
        throw new LimitExceededError("白话总述重试次数已用尽");
      }
      const updated = await this.deps.store.update<StoredBaziReading>(id, (reading) => ({
        ...reading,
        summary: { ...summary, status: "writing" as const, retries: summary.retries + 1 },
      }));
      this.start(id, () => this.writeSummary(id, true));
      return updated;
    });
  }

  /** 依据已落笔各家写白话总述；没有一家落笔时记为未生成。 */
  private async writeSummary(id: string, preserveRetries: boolean): Promise<void> {
    const reading = await this.getReading(id);
    const input = this.summaryInput(reading);
    const previous = reading.summary;
    if (!input) {
      await this.deps.store.update<StoredBaziReading>(id, (current) => ({
        ...current,
        summary: {
          status: "failed" as const, basis: 0, error: "三家均未落笔，暂无白话总述",
          attempts: previous?.attempts ?? 0, retries: previous?.retries ?? 0,
        },
      }));
      return;
    }
    const basis = input.schools.length;
    await this.deps.store.update<StoredBaziReading>(id, (current) => ({
      ...current,
      summary: {
        status: "writing" as const, basis,
        attempts: previous?.attempts ?? 0,
        retries: preserveRetries ? previous?.retries ?? 0 : 0,
      },
    }));
    const result = await runSummaryWithRetry({ provider: this.deps.provider }, input);
    await this.deps.store.update<StoredBaziReading>(id, (current) => ({
      ...current,
      summary: { ...summaryState(current.summary, result, basis, true), anchor: input.anchor },
    }));
  }

  private summaryInput(reading: StoredBaziReading): SummaryInput | null {
    const schools: SummarySchool[] = [];
    const values: number[] = [];
    for (const school of BAZI_SCHOOLS) {
      const state = reading.schools[school.key];
      if (state.status !== "done" || !state.output) {
        continue;
      }
      const output = state.output;
      const item: SummarySchool = {
        name: school.name, school: school.school, useGod: output.useGod,
        headline: output.headline, reason: output.reason, sections: output.sections, advice: output.advice,
      };
      if ("verdict" in output) {
        values.push(output.confidenceTenths);
        item.verdict = output.verdict;
        item.confidenceTenths = output.confidenceTenths;
        if (output.timing) {
          item.timing = output.timing;
        }
      }
      schools.push(item);
    }
    if (schools.length === 0) {
      return null;
    }
    const chart = reading.chart;
    const facts = buildBaziFacts(chart, reading.analysis, reading.tiaohou);
    const pillars = [chart.pillars.year, chart.pillars.month, chart.pillars.day, chart.pillars.time]
      .map((pillar) => pillar?.ganZhi ?? "缺").join(" ");
    const points = [
      `四柱：${pillars}（日主${chart.dayMaster}）`,
      `调候：${reading.tiaohou.section}，用神${reading.tiaohou.useStems.join("、")}`,
    ];
    const anchor = chart.liunian.years.find((item) => item.year === chart.liunian.anchorYear);
    if (anchor) {
      points.push(`所问之年：${anchor.year} ${anchor.ganZhi}，大运${anchor.luck?.ganZhi ?? "起运前"}`);
    }
    const input: SummaryInput = {
      kind: reading.kind,
      question: reading.question,
      consensus: reading.kind === "fortune" ? averageConfidence(values) : null,
      chartPoints: points,
      schools,
      // 解法心法依据：三家各自取用与《穷通宝鉴》调候取用。
      anchor: {
        title: "三家取用",
        lines: [
          ...schools.map((item) => `${item.name}：${item.useGod ?? ""}`),
          `调候：${reading.tiaohou.useStems.join("、")}（《穷通宝鉴》）`,
        ],
      },
      proseErrors: (text) => auditBaziSummaryProse(text, facts),
    };
    if (reading.kind === "fortune") {
      input.horizonLabel = reading.context.label;
      input.yearConsensus = yearConsensus(reading)
        .map((item) => (item ? `${item.year} ${item.average.toFixed(1)}成` : null))
        .filter((item): item is string => item !== null)
        .join(" · ");
    }
    return input;
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
