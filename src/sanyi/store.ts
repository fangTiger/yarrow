// src/sanyi/store.ts
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
  castTime?: string;
  lines?: readonly number[];
  chart?: LiuyaoChart;
  meihua?: MeihuaResult;
  bianzhan?: OracleSelection;
  almanac?: AlmanacResult;
  qimen?: QimenResult;
}

export interface BaziSchoolState {
  status: "pending" | "writing" | "done" | "failed";
  output?: import("./bazi-schema.js").BaziSchoolOutput;
  attempts: number;
  retries: number;
  error?: string;
  /** 删错留对时删去的处数（不保存被删原文）。 */
  removed?: number;
  /** 删错留对时校正的吉凶把握处数。 */
  adjusted?: number;
}
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
}

export interface NamingFamilyState {
  status: "pending" | "writing" | "done" | "failed";
  output?: import("./naming/schema.js").NamingFamilyOutput;
  attempts: number;
  retries: number;
  error?: string;
  /** 删错留对时删去的名字数（不保存被删原文）。 */
  removed?: number;
}

export interface NamingSummaryState {
  status: "writing" | "done" | "failed";
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
}

export type StoredReading = StoredQuestionReading | StoredBaziReading | StoredNamingReading;

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

  constructor(private readonly root = "data") {}

  private readingPath(id: string): string {
    if (!isReadingId(id)) {
      throw new Error("reading id 无效");
    }
    return join(this.root, "readings", `${id}.json`);
  }

  async read<T extends StoredReading = StoredQuestionReading>(id: string): Promise<T> {
    const text = await readFile(this.readingPath(id), "utf8");
    return JSON.parse(text) as T;
  }

  /** 列出全部存档 id，供服务重启后续掷未完成的卦。 */
  async listIds(): Promise<string[]> {
    try {
      const names = await readdir(join(this.root, "readings"));
      return names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).filter(isReadingId);
    } catch {
      return [];
    }
  }

  async write(reading: StoredReading): Promise<void> {
    const directory = join(this.root, "readings");
    await mkdir(directory, { recursive: true });
    const target = this.readingPath(reading.id);
    const temporary = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(temporary, `${JSON.stringify(reading, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }

  async update<T extends StoredReading = StoredQuestionReading>(
    id: string,
    change: (reading: T) => T,
  ): Promise<T> {
    let result: T | undefined;
    const previous = this.queues.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      result = change(await this.read<T>(id));
      await this.write(result);
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
    const directory = join(this.root, "payment-claims");
    await mkdir(directory, { recursive: true });
    const digest = createHash("sha256").update(claimKey).digest("hex");
    const path = join(directory, `${digest}.json`);
    try {
      const handle = await open(path, "wx");
      try {
        await handle.writeFile(JSON.stringify({ readingId }), "utf8");
      } finally {
        await handle.close();
      }
      return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      const stored = JSON.parse(await readFile(path, "utf8")) as {
        readingId: string;
      };
      return stored.readingId;
    }
  }
}
