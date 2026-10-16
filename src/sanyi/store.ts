// src/sanyi/store.ts
import { createHash, randomBytes } from "node:crypto";
import { FileBackend, updateDocument, type DocumentBackend } from "./storage.js";
import type { Address, Hex } from "viem";
import type { LiuyaoChart } from "../oracle/liuyao-chart.js";
import type { AlmanacResult } from "../calendar/almanac.js";
import type { OracleSelection } from "../calendar/bianzhan.js";
import type { MeihuaResult } from "../calendar/meihua.js";
import type { QimenResult } from "../calendar/qimen.js";
import type { QuestionSubjectKey } from "../oracle/question-classifier.js";
import type { QuestionSchoolOutput } from "./schema.js";
import type { QuestionSchoolKey } from "./schools/index.js";
import type { RecordedThrow } from "./throws.js";

export interface SchoolState {
  status: "pending" | "writing" | "done" | "failed" | "rejected";
  /** 本次落笔开始时刻；旧存档没有此字段，不参与中断恢复。 */
  startedAt?: string;
  output?: QuestionSchoolOutput;
  attempts: number;
  retries: number;
  error?: string;
  /** 删错留对时删去的处数（不保存被删原文）。 */
  removed?: number;
  /** 删错留对时校正的吉凶把握处数。 */
  adjusted?: number;
}

/** 白话总述的存档状态。 */
export interface SummaryState {
  status: "writing" | "done" | "failed";
  /** 本次落笔开始时刻；旧存档没有此字段，不参与中断恢复。 */
  startedAt?: string;
  output?: import("./summary.js").PlainSummary;
  /** 依据几家断语写成。 */
  basis: number;
  attempts: number;
  retries: number;
  error?: string;
  removed?: number;
  adjusted?: number;
  /** 解法的心法依据（问事为《大象传》原文，八字为三家取用），由系统给出，随存档公开。 */
  anchor?: import("./summary.js").SummaryAnchor;
}

/** 结果首次进入终态时的持久化声明，只供服务端做指标幂等。 */
export interface TerminalMetricClaim {
  outcome: "done" | "failed";
  token: string;
}

export interface StoredQuestionReading {
  id: string;
  kind: "question";
  createdAt: string;
  question: string;
  subject: {
    suggestedKey: QuestionSubjectKey;
    finalKey: QuestionSubjectKey;
    overridden: boolean;
    changes: number;
  };
  payment: {
    payer: Address;
    recipient: Address;
    transactionHash: Hex;
    feeUsdc6: string;
  };
  throws: readonly RecordedThrow[];
  schools: Record<QuestionSchoolKey, SchoolState>;
  status: "awaiting-throws" | "charting" | "writing" | "done" | "failed";
  error?: string;
  /** 付款所在区块号；第一掷取其后的新区块。 */
  castAfterBlock?: string;
  summary?: SummaryState;
  /** Arc 长时间无响应时暂停自动起卦，等待用户「继续起卦」。 */
  castPaused?: boolean;
  /** 创建、续掷或恢复起卦的最近进展时刻，仅供中断恢复。 */
  castProgressAt?: string;
  castTime?: string;
  lines?: readonly number[];
  chart?: LiuyaoChart;
  meihua?: MeihuaResult;
  bianzhan?: OracleSelection;
  almanac?: AlmanacResult;
  qimen?: QimenResult;
  terminalMetric?: TerminalMetricClaim;
  /** 英文下单才保存；缺省即中文。 */
  lang?: "en";
  /** 兼容旧英文订单的翻译意图；新订单改用 lang。 */
  translateTo?: "en";
}

export interface BaziSchoolState {
  status: "pending" | "writing" | "done" | "failed";
  /** 本次落笔开始时刻；旧存档没有此字段，不参与中断恢复。 */
  startedAt?: string;
  output?: import("./bazi-schema.js").BaziSchoolOutput;
  attempts: number;
  retries: number;
  error?: string;
  /** 删错留对时删去的处数（不保存被删原文）。 */
  removed?: number;
  /** 删错留对时校正的吉凶把握处数。 */
  adjusted?: number;
}
export type PeriodFeedbackVote = "accurate" | "inaccurate";
export interface StoredBaziReading {
  id: string;
  kind: "destiny" | "fortune";
  createdAt: string;
  question: string;
  payment: StoredQuestionReading["payment"];
  status: "writing" | "done" | "failed";
  chart: import("../calendar/bazi.js").BaziChart;
  analysis: import("../calendar/bazi-relations.js").BaziAnalysis;
  tiaohou: import("../calendar/qiongtong.js").QiongtongEntry;
  correction: {
    dst: "applied" | "not-applied" | "skipped-region";
    solar: "applied" | "not-applied";
    timeKnown: boolean;
    sect: 1 | 2;
    timeZone?: string;
    localStandard?: string;
    disambiguation?: import("../calendar/birth-instant.js").TimeDisambiguation;
  };
  context: import("./fortune-context.js").FortuneContext;
  almanac: AlmanacResult;
  changes: number;
  schools: Record<import("./schools/bazi-shared.js").BaziSchoolKey, BaziSchoolState>;
  summary?: SummaryState;
  feedback?: {
    periods: Record<string, { vote: PeriodFeedbackVote; at: string }>;
  };
  terminalMetric?: TerminalMetricClaim;
  /** 英文下单才保存；缺省即中文。 */
  lang?: "en";
  /** 兼容旧英文订单的翻译意图；新订单改用 lang。 */
  translateTo?: "en";
}

export interface NamingFamilyState {
  status: "pending" | "writing" | "done" | "failed";
  /** 本次落笔开始时刻；旧存档没有此字段，不参与中断恢复。 */
  startedAt?: string;
  output?: import("./naming/schema.js").NamingFamilyOutput;
  attempts: number;
  retries: number;
  error?: string;
  /** 删错留对时删去的名字数（不保存被删原文）。 */
  removed?: number;
}

export interface NamingSummaryState {
  status: "writing" | "done" | "failed";
  /** 本次落笔开始时刻；旧存档没有此字段，不参与中断恢复。 */
  startedAt?: string;
  output?: import("./naming/schema.js").NamingSummaryOutput;
  basis: number;
  attempts: number;
  retries: number;
  error?: string;
  removed?: number;
}

export interface StoredNamingReading {
  id: string;
  kind: "naming";
  createdAt: string;
  target: "person" | "business";
  question: string;
  surname?: string;
  gender: "male" | "female" | "any";
  length: 1 | 2 | 3 | 4;
  unborn: boolean;
  payment: StoredQuestionReading["payment"];
  status: "writing" | "done" | "failed";
  basis: {
    pillars: { year: string; month: string; day: string; time: string | null } | null;
    elements: import("../calendar/bazi-relations.js").ElementCount[];
    tiaohou: import("../calendar/qiongtong.js").QiongtongEntry | null;
    favorable: import("./naming/lexicon.js").Element[] | null;
    favorableSource: "missing" | "tiaohou" | "industry" | "model";
    /** 旧存档可能没有此字段，公开页按 favorableSource 回退通用说明。 */
    favorableNote?: string;
    /** 天干与地支本气计数；旧存档没有此字段。 */
    counts?: import("./naming/favorable.js").ElementCounts;
    /** 本气计数为零的五行；旧存档没有此字段。 */
    missing?: import("./naming/lexicon.js").Element[];
    unborn: boolean;
  };
  /** 诗文候选只存稳定编号，重试时从入库语料还原。 */
  candidateIds: string[];
  families: Record<import("./naming/schema.js").NamingFamilyKey, NamingFamilyState>;
  summary?: NamingSummaryState;
  terminalMetric?: TerminalMetricClaim;
  /** 英文下单才保存；缺省即中文。 */
  lang?: "en";
  /** 兼容旧英文订单的翻译意图；新订单改用 lang。 */
  translateTo?: "en";
}

export type StoredReading = StoredQuestionReading | StoredBaziReading | StoredNamingReading;

// Vercel 单次函数最长 300 秒；多留 30 秒给落盘与轮询传播后再判定中断。
export const WRITING_INTERRUPTION_TIMEOUT_MS = 330_000;
// 自动起卦两分钟没有创建后的首掷或后续新掷，视为后台任务已失去进展。
export const CAST_PROGRESS_TIMEOUT_MS = 120_000;
export const WRITING_INTERRUPTION_ERROR = "落笔中断，请重试";

type InterruptibleState = SchoolState | SummaryState | BaziSchoolState
  | NamingFamilyState | NamingSummaryState;

interface RecoveryTargets {
  schools: Readonly<Record<string, string>>;
  summary?: string;
  cast?: {
    progressAt: string;
    throwsLength: number;
    explicitProgressAt?: string;
  };
}

function isOlderThan(value: string | undefined, now: number, threshold: number): value is string {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && now - timestamp > threshold;
}

function castingProgressAt(reading: StoredQuestionReading): string | undefined {
  if (reading.castProgressAt) return reading.castProgressAt;
  const lastThrow = reading.throws.at(-1);
  if (!lastThrow) return reading.createdAt;
  const seconds = Number(lastThrow.blockTimestamp);
  if (!Number.isFinite(seconds)) return undefined;
  const timestamp = new Date(seconds * 1_000);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined;
}

function recoveryTargets(reading: StoredReading, now: number): RecoveryTargets {
  const states = reading.kind === "naming" ? reading.families : reading.schools;
  const schools: Record<string, string> = {};
  for (const [key, state] of Object.entries(states)) {
    if (state.status === "writing"
      && isOlderThan(state.startedAt, now, WRITING_INTERRUPTION_TIMEOUT_MS)) {
      schools[key] = state.startedAt;
    }
  }
  const summary = reading.summary?.status === "writing"
    && isOlderThan(reading.summary.startedAt, now, WRITING_INTERRUPTION_TIMEOUT_MS)
    ? reading.summary.startedAt
    : undefined;
  const progressAt = reading.kind === "question" ? castingProgressAt(reading) : undefined;
  const cast = reading.kind === "question"
    && reading.status === "awaiting-throws"
    && !reading.castPaused
    && isOlderThan(progressAt, now, CAST_PROGRESS_TIMEOUT_MS)
    ? {
        progressAt,
        throwsLength: reading.throws.length,
        ...(reading.castProgressAt ? { explicitProgressAt: reading.castProgressAt } : {}),
      }
    : undefined;
  return {
    schools,
    ...(summary ? { summary } : {}),
    ...(cast ? { cast } : {}),
  };
}

function hasRecoveryTarget(targets: RecoveryTargets): boolean {
  return Object.keys(targets.schools).length > 0
    || targets.summary !== undefined
    || targets.cast !== undefined;
}

function interruptedState<T extends InterruptibleState>(state: T, startedAt: string): T {
  if (state.status !== "writing" || state.startedAt !== startedAt) return state;
  const { startedAt: _startedAt, output: _output, ...rest } = state;
  return { ...rest, status: "failed", error: WRITING_INTERRUPTION_ERROR } as T;
}

function hasWritingState(reading: StoredReading): boolean {
  const states = reading.kind === "naming" ? reading.families : reading.schools;
  return Object.values(states).some((state) => state.status === "writing")
    || reading.summary?.status === "writing";
}

function recoverReading(reading: StoredReading, targets: RecoveryTargets): StoredReading {
  let changed = false;
  function recoverStates<T>(states: T): T {
    const nextStates = { ...states };
    for (const [key, startedAt] of Object.entries(targets.schools)) {
      const state = (states as Record<string, InterruptibleState>)[key];
      if (!state || state.status !== "writing" || state.startedAt !== startedAt) continue;
      (nextStates as Record<string, InterruptibleState>)[key] = interruptedState(state, startedAt);
      changed = true;
    }
    return nextStates;
  }
  let next: StoredReading;
  if (reading.kind === "naming") {
    next = { ...reading, families: recoverStates(reading.families) };
  } else if (reading.kind === "question") {
    next = { ...reading, schools: recoverStates(reading.schools) };
  } else {
    next = { ...reading, schools: recoverStates(reading.schools) };
  }

  if (targets.summary) {
    if (next.kind === "naming" && next.summary?.status === "writing"
      && next.summary.startedAt === targets.summary) {
      next = { ...next, summary: interruptedState(next.summary, targets.summary) };
      changed = true;
    } else if (next.kind !== "naming" && next.summary?.status === "writing"
      && next.summary.startedAt === targets.summary) {
      next = { ...next, summary: interruptedState(next.summary, targets.summary) };
      changed = true;
    }
  }
  if (targets.cast && next.kind === "question"
    && next.status === "awaiting-throws" && !next.castPaused
    && next.throws.length === targets.cast.throwsLength
    && next.castProgressAt === targets.cast.explicitProgressAt
    && castingProgressAt(next) === targets.cast.progressAt) {
    next = { ...next, castPaused: true };
    changed = true;
  }
  if (!changed) return reading;
  if (next.status === "writing" && !hasWritingState(next)) {
    // 八字与起名的既有重试接口要求整卦已结束；所有活动落笔均已停下时开放重试。
    next = { ...next, status: "done" };
  }
  return next;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export function newReadingId(bytes = randomBytes(16)): string {
  let buffer = 0;
  let bitCount = 0;
  let result = "";
  for (const byte of bytes) {
    buffer = buffer * 256 + byte;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      const divisor = 2 ** bitCount;
      const index = Math.floor(buffer / divisor) & 31;
      result += ALPHABET[index];
      buffer %= divisor;
    }
  }
  if (bitCount > 0) {
    result += ALPHABET[(buffer << (5 - bitCount)) & 31];
  }
  return result;
}

export function isReadingId(value: string): boolean {
  return /^[a-z2-7]{26}$/.test(value);
}

export class ReadingStore {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly backend: DocumentBackend;

  /** 传目录则用本地文件存储；传后端则用该后端（如 Upstash Redis）。 */
  constructor(storage: string | DocumentBackend = "data") {
    this.backend = typeof storage === "string" ? new FileBackend(storage) : storage;
  }

  private readingKey(id: string): string {
    if (!isReadingId(id)) {
      throw new Error("reading id 无效");
    }
    return `readings/${id}`;
  }

  async read<T extends StoredReading = StoredQuestionReading>(id: string): Promise<T> {
    const text = await this.backend.get(this.readingKey(id));
    return JSON.parse(text) as T;
  }

  /** 读取并用原子比较写回恢复平台中断的落笔或起卦状态。 */
  async readRecovering<T extends StoredReading = StoredQuestionReading>(
    id: string,
    now: Date,
  ): Promise<T> {
    const reading = await this.read<T>(id);
    const targets = recoveryTargets(reading, now.getTime());
    if (!hasRecoveryTarget(targets)) return reading;
    return this.update<T>(id, (current) => recoverReading(current, targets) as T);
  }

  /** 列出全部存档 id，供服务重启后续掷未完成的卦。 */
  async listIds(): Promise<string[]> {
    return (await this.backend.list("readings")).filter(isReadingId);
  }

  async write(reading: StoredReading): Promise<void> {
    await this.backend.set(this.readingKey(reading.id), serializeReading(reading));
  }

  async update<T extends StoredReading = StoredQuestionReading>(
    id: string,
    change: (reading: T) => T,
  ): Promise<T> {
    let result: T | undefined;
    const key = this.readingKey(id);
    const previous = this.queues.get(id) ?? Promise.resolve();
    // 同一实例内排队；跨实例由比较后写入兜底，冲突时重读重试。
    const next = previous.catch(() => {}).then(async () => {
      result = await updateDocument<T>(this.backend, key, async () => {
        const raw = await this.backend.get(key);
        return { raw, value: JSON.parse(raw) as T };
      }, (current) => change(current as T), serializeReading);
    });
    this.queues.set(id, next);
    try {
      await next;
    } finally {
      if (this.queues.get(id) === next) {
        this.queues.delete(id);
      }
    }
    if (!result) {
      throw new Error("存档更新未产生结果");
    }
    return result;
  }

  async claimPayment(claimKey: string, readingId: string): Promise<string | null> {
    const digest = createHash("sha256").update(claimKey).digest("hex");
    const key = `payment-claims/${digest}`;
    if (await this.backend.setIfAbsent(key, JSON.stringify({ readingId }))) {
      return null;
    }
    const stored = JSON.parse(await this.backend.get(key)) as {
      readingId: string;
    };
    return stored.readingId;
  }
}

function serializeReading(reading: StoredReading): string {
  return `${JSON.stringify(reading, null, 2)}\n`;
}
