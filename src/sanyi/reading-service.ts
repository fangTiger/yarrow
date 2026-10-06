// src/sanyi/reading-service.ts
import { almanacAt } from "../calendar/almanac.js";
import { selectPrimaryOracleText } from "../calendar/bianzhan.js";
import { deriveMeihua } from "../calendar/meihua.js";
import { qimenAt } from "../calendar/qimen.js";
import { QUESTION_SUBJECTS } from "../oracle/question-classifier.js";
import type { QuestionSubjectKey } from "../oracle/question-classifier.js";
import type { SanyiFeeProof, SanyiFeeVerifier } from "./fee.js";
import { buildLiuyaoChart, deriveFiveHexagrams } from "../oracle/liuyao-chart.js";
import type { QuestionBlockSource } from "../oracle/question-oracle.js";
import type { StructuredOutputProvider } from "../agent/provider.js";
import { classifyQuestion, normalizeQuestion } from "./classify.js";
import { buildQuestionFacts, type FactTable } from "./facts.js";
import type { SanyiLogger } from "./log.js";
import { buildOriginalTexts } from "./original-texts.js";
import { runSchool, type SchoolRunResult } from "./school-runner.js";
import { QUESTION_SCHOOLS, type QuestionSchoolKey } from "./schools/index.js";
import type { QuestionSchool } from "./schools/shared.js";
import {
  ReadingStore,
  newReadingId,
  type SchoolState,
  type StoredReading,
} from "./store.js";
import {
  assertNextThrow,
  deriveThrow,
  waitForBlockAfter,
  type RecordedThrow,
} from "./throws.js";

type WaitOptions = NonNullable<Parameters<typeof waitForBlockAfter>[2]>;

interface CalendarDependencies {
  almanacAt: typeof almanacAt;
  qimenAt: typeof qimenAt;
}

export interface ReadingServiceDependencies {
  feeVerifier: SanyiFeeVerifier;
  blockSource: QuestionBlockSource;
  provider: StructuredOutputProvider;
  store: ReadingStore;
  logger: SanyiLogger;
  clock?: () => Date;
  waitOptions?: WaitOptions;
  calendar?: CalendarDependencies;
}

interface RebuiltContext {
  facts: FactTable;
  originalTexts: readonly string[];
  chart: ReturnType<typeof buildLiuyaoChart>;
}

export class PaymentAlreadyUsedError extends Error {
  constructor(readonly readingId: string) {
    super(`付款凭证已用于 reading：${readingId}`);
    this.name = "PaymentAlreadyUsedError";
  }
}

export class LimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitExceededError";
  }
}

export class StateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateConflictError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function subjectOption(key: QuestionSubjectKey) {
  const option = QUESTION_SUBJECTS.find((item) => item.key === key);
  if (!option) {
    throw new Error("事项类型无效");
  }
  return option;
}

function initialSchools(): StoredReading["schools"] {
  return {
    chengyi: { status: "pending", attempts: 0, retries: 0 },
    jingfang: { status: "pending", attempts: 0, retries: 0 },
    shaoyong: { status: "pending", attempts: 0, retries: 0 },
  };
}

export class ReadingService {
  private readonly clock: () => Date;
  private readonly calendar: CalendarDependencies;
  private readonly waitOptions: WaitOptions;
  private readonly readingQueues = new Map<string, Promise<void>>();
  private readonly background = new Map<string, Promise<void>>();

  constructor(private readonly deps: ReadingServiceDependencies) {
    this.clock = deps.clock ?? (() => new Date());
    this.calendar = deps.calendar ?? { almanacAt, qimenAt };
    this.waitOptions = deps.waitOptions ?? {};
  }

  async createQuestionReading(input: {
    question: string;
    subjectKey?: QuestionSubjectKey;
    feeProof: SanyiFeeProof;
  }): Promise<StoredReading> {
    const classification = classifyQuestion(input.question);
    if (classification.kind !== "question" || !classification.subject) {
      throw new Error("此服务只接受问事问题");
    }
    const question = normalizeQuestion(input.question);
    const suggested = classification.subject;
    const selected = subjectOption(input.subjectKey ?? suggested.key);
    const receipt = await this.deps.feeVerifier.verify(input.feeProof);
    if (receipt.feeUsdc6 !== "50000") {
      throw new Error("卦金付款凭证金额不完整");
    }
    const id = newReadingId();
    const existing = await this.deps.store.claimPayment(
      receipt.transactionHash.toLowerCase(),
      id,
    );
    if (existing) {
      throw new PaymentAlreadyUsedError(existing);
    }
    const reading: StoredReading = {
      id,
      kind: "question",
      createdAt: this.clock().toISOString(),
      question,
      subject: {
        suggestedKey: suggested.key,
        finalKey: selected.key,
        overridden: selected.key !== suggested.key,
        changes: 0,
      },
      payment: {
        payer: receipt.payer,
        recipient: receipt.recipient,
        transactionHash: receipt.transactionHash,
        feeUsdc6: receipt.feeUsdc6,
      },
      throws: [],
      schools: initialSchools(),
      status: "awaiting-throws",
    };
    await this.deps.store.write(reading);
    return reading;
  }

  async throwCoin(id: string, index: number): Promise<RecordedThrow> {
    return this.withReadingLock(id, async () => {
      const reading = await this.deps.store.read(id);
      const recorded = reading.throws.find((item) => item.index === index);
      if (recorded) {
        return recorded;
      }
      assertNextThrow(reading.throws, index);
      const previous = reading.throws.at(-1);
      const block = await waitForBlockAfter(
        this.deps.blockSource,
        previous ? BigInt(previous.blockNumber) : 0n,
        this.waitOptions,
      );
      const result = deriveThrow({
        paymentTxHash: reading.payment.transactionHash,
        blockHash: block.hash,
        question: reading.question,
        index,
      });
      const next: RecordedThrow = {
        ...result,
        blockNumber: block.number.toString(),
        blockHash: block.hash,
        blockTimestamp: block.timestamp.toString(),
      };
      await this.deps.store.update(id, (current) => ({
        ...current,
        throws: [...current.throws, next],
      }));
      if (index === 6) {
        this.startBackground(id, this.finalize(id));
      }
      return next;
    });
  }

  async retrySchool(id: string, key: QuestionSchoolKey): Promise<StoredReading> {
    return this.withReadingLock(id, async () => {
      const reading = await this.deps.store.read(id);
      const state = reading.schools[key];
      if (state.status !== "failed" && state.status !== "rejected") {
        throw new StateConflictError("此家当前状态不可重试");
      }
      if (state.retries >= 2) {
        throw new LimitExceededError("此家重试次数已用尽");
      }
      const updated = await this.deps.store.update(id, (current) => ({
        ...current,
        schools: {
          ...current.schools,
          [key]: {
            status: "writing",
            attempts: current.schools[key].attempts,
            retries: current.schools[key].retries + 1,
          },
        },
      }));
      this.startBackground(id, this.rerunSchool(id, key));
      return updated;
    });
  }

  async changeSubject(
    id: string,
    subjectKey: QuestionSubjectKey,
  ): Promise<StoredReading> {
    return this.withReadingLock(id, async () => {
      const reading = await this.deps.store.read(id);
      if (reading.status !== "done") {
        throw new StateConflictError("三家尚未全部落笔，请稍后再改事项");
      }
      if (reading.schools.jingfang.status === "writing") {
        throw new StateConflictError("京房正在落笔，请稍后再改事项");
      }
      if (!reading.lines || !reading.castTime) {
        throw new StateConflictError("尚未完成排盘，不能修改事项");
      }
      if (reading.subject.changes >= 3) {
        throw new LimitExceededError("事项修改次数已用尽");
      }
      subjectOption(subjectKey);
      const changed: StoredReading = {
        ...reading,
        subject: {
          ...reading.subject,
          finalKey: subjectKey,
          overridden: subjectKey !== reading.subject.suggestedKey,
          changes: reading.subject.changes + 1,
        },
      };
      const context = this.rebuildContext(changed);
      const updated = await this.deps.store.update(id, (current) => ({
        ...current,
        subject: changed.subject,
        chart: context.chart,
        schools: {
          ...current.schools,
          jingfang: {
            status: "writing",
            attempts: current.schools.jingfang.attempts,
            retries: current.schools.jingfang.retries,
          },
        },
      }));
      this.startBackground(id, this.rerunSchool(id, "jingfang"));
      return updated;
    });
  }

  async getReading(id: string): Promise<StoredReading> {
    return this.deps.store.read(id);
  }

  async whenSettled(id: string): Promise<void> {
    await (this.background.get(id) ?? Promise.resolve());
  }

  private async withReadingLock<T>(
    id: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const previous = this.readingQueues.get(id) ?? Promise.resolve();
    const result = previous.catch(() => {}).then(action);
    const tail = result.then(
      () => {},
      () => {},
    );
    this.readingQueues.set(id, tail);
    try {
      return await result;
    } finally {
      if (this.readingQueues.get(id) === tail) {
        this.readingQueues.delete(id);
      }
    }
  }

  private startBackground(id: string, task: Promise<void>): void {
    const current = task.catch(async (error: unknown) => {
      await this.failReading(id, error);
    });
    const previous = this.background.get(id) ?? Promise.resolve();
    const combined = Promise.all([previous, current]).then(() => {});
    this.background.set(id, combined);
    void combined.finally(() => {
      if (this.background.get(id) === combined) {
        this.background.delete(id);
      }
    });
  }

  private async finalize(id: string): Promise<void> {
    const reading = await this.deps.store.update(id, (current) => ({
      ...current,
      status: "charting",
    }));
    const first = reading.throws[0];
    if (!first || reading.throws.length !== 6) {
      throw new Error("六掷记录不完整");
    }
    const lines = reading.throws.map((item) => item.value);
    const castTime = first.blockTimestamp;
    const basis: StoredReading = { ...reading, lines, castTime };
    const context = this.rebuildContext(basis);
    const timestamp = BigInt(castTime);
    const meihua = deriveMeihua(lines, timestamp);
    const bianzhan = selectPrimaryOracleText(lines);
    const almanac = this.calendar.almanacAt(timestamp);
    const qimen = this.calendar.qimenAt(timestamp);
    await this.deps.store.update(id, (current) => ({
      ...current,
      lines,
      castTime,
      chart: context.chart,
      meihua,
      bianzhan,
      almanac,
      qimen,
      status: "writing",
      schools: {
        chengyi: { ...current.schools.chengyi, status: "writing" },
        jingfang: { ...current.schools.jingfang, status: "writing" },
        shaoyong: { ...current.schools.shaoyong, status: "writing" },
      },
    }));
    await Promise.all(QUESTION_SCHOOLS.map(async (school) => {
      await this.runAndStore(id, school, context, false);
    }));
    await this.deps.store.update(id, (current) => ({
      ...current,
      status: "done",
    }));
  }

  private rebuildContext(reading: StoredReading): RebuiltContext {
    if (!reading.lines || !reading.castTime) {
      throw new Error("存档缺少排盘材料");
    }
    const subject = subjectOption(reading.subject.finalKey);
    const timestamp = BigInt(reading.castTime);
    const chart = buildLiuyaoChart({
      lines: reading.lines,
      timestamp,
      focus: {
        subjectKey: subject.key,
        subjectLabel: subject.label,
        useGod: subject.useGod,
        overridden: reading.subject.overridden,
      },
    });
    const five = deriveFiveHexagrams(reading.lines);
    const meihua = deriveMeihua(reading.lines, timestamp);
    const bianzhan = selectPrimaryOracleText(reading.lines);
    return {
      chart,
      facts: buildQuestionFacts(chart, five, meihua, bianzhan),
      originalTexts: buildOriginalTexts(five, bianzhan),
    };
  }

  private async rerunSchool(
    id: string,
    key: QuestionSchoolKey,
  ): Promise<void> {
    const reading = await this.deps.store.read(id);
    const context = this.rebuildContext(reading);
    const school = QUESTION_SCHOOLS.find((item) => item.key === key);
    if (!school) {
      throw new Error("三家键无效");
    }
    await this.runAndStore(id, school, context, true);
  }

  private async runAndStore(
    id: string,
    school: QuestionSchool,
    context: RebuiltContext,
    preserveRetries: boolean,
  ): Promise<void> {
    const reading = await this.deps.store.read(id);
    const result = await runSchool(
      { provider: this.deps.provider },
      {
        school,
        question: reading.question,
        facts: context.facts,
        originalTexts: context.originalTexts,
      },
    );
    await this.deps.store.update(id, (current) => ({
      ...current,
      schools: {
        ...current.schools,
        [school.key]: this.schoolState(
          current.schools[school.key],
          result,
          preserveRetries,
        ),
      },
    }));
  }

  private schoolState(
    previous: SchoolState,
    result: SchoolRunResult,
    preserveRetries: boolean,
  ): SchoolState {
    const retries = preserveRetries ? previous.retries : 0;
    if (result.status === "done") {
      return {
        status: "done",
        output: result.output,
        attempts: previous.attempts + result.calls,
        retries,
      };
    }
    return {
      status: result.status,
      error: result.error,
      attempts: previous.attempts + result.calls,
      retries,
    };
  }

  private async failReading(id: string, error: unknown): Promise<void> {
    const message = `排盘失败：${errorMessage(error)}`;
    try {
      await this.deps.store.update(id, (current) => ({
        ...current,
        status: "failed",
        error: message,
      }));
    } catch {
      // 存档本身不可写时仍须继续尝试记录日志。
    }
    try {
      await this.deps.logger.write("问事排盘失败", {
        readingId: id,
        error: message,
      });
    } catch {
      // 日志失败不能产生未处理拒绝。
    }
  }
}
