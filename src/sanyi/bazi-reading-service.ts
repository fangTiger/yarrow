// src/sanyi/bazi-reading-service.ts
import { keepAlive } from "./background.js";
import { almanacAt } from "../calendar/almanac.js";
import { analyzeBazi } from "../calendar/bazi-relations.js";
import { lookupQiongtong } from "../calendar/qiongtong.js";
import type { StructuredOutputProvider } from "../agent/provider.js";
import { buildBirthChart } from "./birth-chart.js";
import { buildBaziFacts } from "./bazi-facts.js";
import { withDestinyLuckRelations } from "./schools/bazi-shared.js";
import { derivedChart, periodConsensus, yearConsensus } from "./bazi-public.js";
import { auditBaziSummaryProse } from "./bazi-audit.js";
import {
  averageConfidence, runSummaryWithRetry, summaryState, type SummaryInput, type SummarySchool,
} from "./summary.js";
import { runBaziSchool } from "./bazi-school-runner.js";
import { resolveFortuneContext, periodFacts } from "./fortune-context.js";
import type { FortuneHorizon } from "./classify.js";
import type { SanyiFeeProof, SanyiFeeVerifier } from "./fee.js";
import type { SanyiLogger } from "./log.js";
import { incrementMetricSafely, NOOP_METRICS, type MetricsRecorder } from "./metrics.js";
import { LimitExceededError, PaymentAlreadyUsedError, StateConflictError } from "./reading-service.js";
import { SanyiInputError } from "./http-errors.js";
import { BAZI_SCHOOLS } from "./schools/bazi-index.js";
import type { BaziSchool, BaziSchoolInput, BaziSchoolKey } from "./schools/bazi-shared.js";
import { ReadingStore, newReadingId, type BaziSchoolState, type StoredBaziReading,
  type PeriodFeedbackVote, type StoredReading } from "./store.js";
interface Dependencies {
  store: ReadingStore;
  provider: StructuredOutputProvider;
  feeVerifier: SanyiFeeVerifier;
  logger: SanyiLogger;
  metrics?: MetricsRecorder;
  clock: () => Date;
  /** 解读单元进入终态后的旁路通知；失败不得影响解读流程。 */
  onUnitSettled?: (id: string, unitKey: BaziSchoolKey | "summary") => void | Promise<void>;
}
function schools(startedAt: string, previous?: StoredBaziReading["schools"]): StoredBaziReading["schools"] {
  function state(key: BaziSchoolKey): BaziSchoolState {
    return { status: "writing", startedAt, attempts: previous?.[key].attempts ?? 0,
      retries: previous?.[key].retries ?? 0 };
  }
  return { shenxiaozhan: state("shenxiaozhan"), yuchuntai: state("yuchuntai"),
    rentieqiao: state("rentieqiao") };
}
function chartFrom(birth: unknown, sect: 1 | 2, targetYear: number) {
  try {
    const result = buildBirthChart(birth, sect, targetYear);
    return { chart: derivedChart(result.chart), correction: result.correction };
  } catch {
    // 校验或底层错误可能包含输入，不把异常原文传播到日志或存档。
    throw new SanyiInputError("生辰格式或排盘口径无效，请检查填写内容");
  }
}
function assertFeedbackTarget(
  reading: StoredReading,
  periodIndex: number,
  currentYear: number,
): asserts reading is StoredBaziReading & { kind: "destiny" } {
  if (reading.kind !== "destiny") {
    throw new SanyiInputError("此接口只适用于命理");
  }
  if (!Number.isInteger(periodIndex)) {
    throw new SanyiInputError("大运编号须为整数");
  }
  const cycle = reading.chart.luck?.cycles.find((item) => item.index === periodIndex);
  if (!cycle) {
    throw new SanyiInputError("大运编号不存在");
  }
  if (cycle.startYear > currentYear) {
    throw new SanyiInputError("尚未开始的大运不可标注");
  }
}
function beijingYear(now: Date): number {
  // 大运是否开始按产品统一的北京时间民用年份判断，不依赖宿主机器时区。
  return new Date(now.getTime() + 8 * 3_600_000).getUTCFullYear();
}
export class BaziReadingService {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly background = new Map<string, Promise<void>>();
  private readonly metrics: MetricsRecorder;
  constructor(private readonly deps: Dependencies) {
    this.metrics = deps.metrics ?? NOOP_METRICS;
  }
  async create(input: {
    kind: "destiny" | "fortune";
    question: string;
    birth: unknown;
    sect: 1 | 2;
    horizon: FortuneHorizon;
    feeProof: SanyiFeeProof;
    translateTo?: "en";
    lang?: "en";
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
      changes: 0, status: "writing", schools: schools(now.toISOString()),
      ...(input.translateTo ? { translateTo: input.translateTo } : {}),
      ...(input.lang === "en" ? { lang: "en" as const } : {}) };
    await this.deps.store.write(reading);
    await incrementMetricSafely(this.metrics, this.deps.logger, `reading_created:${input.kind}`);
    this.start(id, input.kind, () => this.runAll(reading, true), true);
    return reading;
  }
  async readAny(id: string): Promise<StoredReading> {
    return this.deps.store.readRecovering<StoredReading>(id, this.deps.clock());
  }
  async getReading(id: string): Promise<StoredBaziReading> {
    const reading = await this.deps.store.readRecovering<StoredReading>(id, this.deps.clock());
    if (reading.kind !== "destiny" && reading.kind !== "fortune") {
      throw new StateConflictError("此接口只适用于命理或运势");
    }
    return reading;
  }
  async setPeriodFeedback(
    id: string,
    periodIndex: number,
    vote: PeriodFeedbackVote | null,
  ): Promise<StoredBaziReading> {
    return this.lock(id, async () => {
      const now = this.deps.clock();
      const current = await this.deps.store.readRecovering<StoredReading>(id, now);
      const currentYear = beijingYear(now);
      assertFeedbackTarget(current, periodIndex, currentYear);
      if (vote !== null && vote !== "accurate" && vote !== "inaccurate") {
        throw new SanyiInputError("标注值无效");
      }
      return this.deps.store.update<StoredBaziReading>(id, (reading) => {
        assertFeedbackTarget(reading, periodIndex, currentYear);
        const periods = { ...reading.feedback?.periods };
        if (vote === null) {
          delete periods[String(periodIndex)];
        } else {
          periods[String(periodIndex)] = { vote, at: now.toISOString() };
        }
        return { ...reading, feedback: { periods } };
      });
    });
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
      const startedAt = this.deps.clock().toISOString();
      const updated = await this.deps.store.update<StoredBaziReading>(id, (latest) => {
        if (latest.changes >= 2) {
          throw new LimitExceededError("换日切换次数已用尽");
        }
        const latestWriting = Object.values(latest.schools)
          .some((state) => state.status === "writing");
        if (latest.status !== "done" || latestWriting) {
          throw new StateConflictError("三家尚未全部落笔，请稍后切换换日口径");
        }
        if (latest.changes !== current.changes || latest.chart.sect !== current.chart.sect) {
          throw new StateConflictError("换日口径已更新，请刷新后重试");
        }
        return { ...latest, chart, correction, context,
          analysis: analyzeBazi(chart),
          tiaohou: lookupQiongtong(chart.dayMaster, chart.pillars.month.branch),
          changes: latest.changes + 1, status: "writing",
          schools: schools(startedAt, latest.schools) };
      });
      this.start(id, updated.kind, () => this.runAll(updated, false));
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
      const startedAt = this.deps.clock().toISOString();
      const updated = await this.deps.store.update<StoredBaziReading>(id, (reading) => ({ ...reading,
        status: "writing", schools: { ...reading.schools,
          [key]: { status: "writing", startedAt,
            attempts: state.attempts, retries: state.retries + 1 } } }));
      this.start(id, updated.kind, async () => {
        await this.runOne(updated, school);
        await this.writeSummary(id, true);
        await this.finish(id, false);
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
    await this.notifyUnitSettled(reading.id, school.key);
  }
  private async runAll(reading: StoredBaziReading, countTerminal: boolean): Promise<void> {
    await Promise.all(BAZI_SCHOOLS.map((school) => this.runOne(reading, school)));
    // 三家落笔后写白话总述，写完才算这一卦完成。
    await this.writeSummary(reading.id, false);
    await this.finish(reading.id, countTerminal);
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
      const startedAt = this.deps.clock().toISOString();
      const updated = await this.deps.store.update<StoredBaziReading>(id, (reading) => ({
        ...reading,
        summary: { ...summary, status: "writing" as const, startedAt,
          retries: summary.retries + 1 },
      }));
      this.start(id, current.kind, () => this.writeSummary(id, true));
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
      await this.notifyUnitSettled(id, "summary");
      return;
    }
    const basis = input.schools.length;
    const startedAt = this.deps.clock().toISOString();
    await this.deps.store.update<StoredBaziReading>(id, (current) => ({
      ...current,
      summary: {
        status: "writing" as const, startedAt, basis,
        attempts: previous?.attempts ?? 0,
        retries: preserveRetries ? previous?.retries ?? 0 : 0,
      },
    }));
    const result = await runSummaryWithRetry({ provider: this.deps.provider }, input);
    await this.deps.store.update<StoredBaziReading>(id, (current) => ({
      ...current,
      summary: { ...summaryState(current.summary, result, basis, true), anchor: input.anchor },
    }));
    await this.notifyUnitSettled(id, "summary");
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
    const baseFacts = buildBaziFacts(chart, reading.analysis, reading.tiaohou);
    const facts = reading.kind === "destiny" ? withDestinyLuckRelations(chart, baseFacts) : baseFacts;
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
    } else {
      const periods = periodConsensus(reading).flatMap((item): string[] => {
        if (!item) {
          return [];
        }
        const cycle = reading.chart.luck?.cycles.find((value) => value.index === item.index);
        if (!cycle) {
          return [];
        }
        return [`第${cycle.index}步 ${cycle.ganZhi} ${cycle.startAge}–${cycle.endAge}岁 `
          + `${item.average.toFixed(1)}成`];
      });
      if (periods.length > 0) {
        input.periodConsensus = periods.join("；");
      }
    }
    return input;
  }
  private async finish(id: string, countTerminal: boolean): Promise<void> {
    const token = newReadingId();
    const reading = await this.deps.store.update<StoredBaziReading>(id, (current) => ({
      ...current,
      status: "done",
      ...(countTerminal ? {
        terminalMetric: current.terminalMetric ?? { outcome: "done", token },
      } : {}),
    }));
    try {
      await this.deps.logger.write("八字三家落笔完成", { readingId: id });
    } catch {
      // 完成日志失败不能把已完成结果改写为失败。
    }
    if (countTerminal && reading.terminalMetric?.token === token) {
      await incrementMetricSafely(this.metrics, this.deps.logger, `reading_done:${reading.kind}`);
    }
  }
  private start(
    id: string,
    kind: StoredBaziReading["kind"],
    operation: () => Promise<void>,
    countTerminalFailure = false,
  ): void {
    const task = operation().catch(async () => {
      const token = newReadingId();
      let failed: StoredBaziReading | undefined;
      try {
        failed = await this.deps.store.update<StoredBaziReading>(id, (reading) => ({
          ...reading,
          status: "failed",
          ...(countTerminalFailure ? {
            terminalMetric: reading.terminalMetric ?? { outcome: "failed", token },
          } : {}),
        }));
        await this.deps.logger.write("八字编排失败", { readingId: id });
      } catch {
        // 存储和日志异常不得产生未处理拒绝，也不得回显生辰。
      }
      if (countTerminalFailure && failed?.terminalMetric?.token === token) {
        await incrementMetricSafely(this.metrics, this.deps.logger, `reading_failed:${kind}`);
      }
    });
    this.background.set(id, task);
    keepAlive(task);
    void task.then(() => {
      if (this.background.get(id) === task) {
        this.background.delete(id);
      }
    });
  }
  private async notifyUnitSettled(id: string, unitKey: BaziSchoolKey | "summary"): Promise<void> {
    if (!this.deps.onUnitSettled) return;
    try {
      await this.deps.onUnitSettled(id, unitKey);
    } catch {
      try {
        await this.deps.logger.write("英文翻译通知失败", { readingId: id, unit: unitKey });
      } catch {
        // 旁路通知与日志均不得影响中文解读。
      }
    }
  }
}
