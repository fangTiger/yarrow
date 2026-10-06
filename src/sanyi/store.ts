// src/sanyi/store.ts
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
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
}

export interface StoredReading {
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
  castTime?: string;
  lines?: readonly number[];
  chart?: LiuyaoChart;
  meihua?: MeihuaResult;
  bianzhan?: OracleSelection;
  almanac?: AlmanacResult;
  qimen?: QimenResult;
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

  constructor(private readonly root = "data") {}

  private readingPath(id: string): string {
    if (!isReadingId(id)) {
      throw new Error("reading id 无效");
    }
    return join(this.root, "readings", `${id}.json`);
  }

  async read(id: string): Promise<StoredReading> {
    const text = await readFile(this.readingPath(id), "utf8");
    return JSON.parse(text) as StoredReading;
  }

  async write(reading: StoredReading): Promise<void> {
    const directory = join(this.root, "readings");
    await mkdir(directory, { recursive: true });
    const target = this.readingPath(reading.id);
    const temporary = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(temporary, `${JSON.stringify(reading, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }

  async update(
    id: string,
    change: (reading: StoredReading) => StoredReading,
  ): Promise<StoredReading> {
    let result: StoredReading | undefined;
    const previous = this.queues.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      result = change(await this.read(id));
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
