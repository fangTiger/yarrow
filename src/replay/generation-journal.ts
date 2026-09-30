import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";

import { hashJson, hashText } from "../agent/audit.js";
import {
  validateStructuredOutput,
  type ProviderAttemptAudit,
  type ProviderUsage,
  type StructuredOutputProvider,
  type StructuredOutputRequest,
} from "../agent/provider.js";

export interface GenerationJournalEntry extends ProviderAttemptAudit {
  schemaVersion: "1.0";
  recordedAt: string;
  key: string;
  modelId: string;
  providerConfigHash: `0x${string}`;
  requestHash: `0x${string}`;
}

function parseEntry(line: string, lineNumber: number): GenerationJournalEntry {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch (error) {
    throw new Error(`生成审计日志第 ${lineNumber} 行不是合法 JSON`, { cause: error });
  }
  if (!value || typeof value !== "object") throw new Error(`生成审计日志第 ${lineNumber} 行不是对象`);
  const entry = value as GenerationJournalEntry;
  if (entry.schemaVersion !== "1.0" || typeof entry.key !== "string" || !Number.isSafeInteger(entry.attempt)) {
    throw new Error(`生成审计日志第 ${lineNumber} 行字段无效`);
  }
  if (entry.rawOutput !== undefined) {
    if (!entry.rawOutputHash || hashText(entry.rawOutput) !== entry.rawOutputHash) {
      throw new Error(`生成审计日志第 ${lineNumber} 行原始输出哈希不一致`);
    }
  }
  if (entry.result === "valid" && (entry.rawOutput === undefined || !entry.rawOutputHash)) {
    throw new Error(`生成审计日志第 ${lineNumber} 行的合法输出缺少原文或哈希`);
  }
  return entry;
}

export class FileGenerationJournal {
  private readonly entries: GenerationJournalEntry[] = [];
  private readonly firstValidByKey = new Map<string, GenerationJournalEntry>();
  private writeQueue = Promise.resolve();

  private constructor(readonly filePath: string) {}

  static async open(filePath: string): Promise<FileGenerationJournal> {
    const journal = new FileGenerationJournal(filePath);
    try {
      const content = await readFile(filePath, "utf8");
      const lines = content.split("\n").filter((line) => line.length > 0);
      lines.forEach((line, index) => journal.accept(parseEntry(line, index + 1)));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    return journal;
  }

  private accept(entry: GenerationJournalEntry): void {
    if (this.firstValidByKey.has(entry.key)) {
      throw new Error(`任务 ${entry.key} 已有合法输出，审计日志禁止追加生成结果`);
    }
    this.entries.push(entry);
    if (entry.result === "valid") this.firstValidByKey.set(entry.key, entry);
  }

  attemptCount(key: string): number {
    return this.entries.filter((entry) => entry.key === key).length;
  }

  validOutput<T>(
    key: string,
    schema: StructuredOutputRequest["schema"],
    expected: { modelId: string; providerConfigHash: `0x${string}`; requestHash: `0x${string}` },
  ): T | undefined {
    const entry = this.firstValidByKey.get(key);
    if (!entry?.rawOutput) return undefined;
    if (
      entry.modelId !== expected.modelId
      || entry.providerConfigHash !== expected.providerConfigHash
      || entry.requestHash !== expected.requestHash
    ) {
      throw new Error(`任务 ${key} 的请求哈希不一致，拒绝复用或再次生成合法输出`);
    }
    return validateStructuredOutput<T>(schema, JSON.parse(entry.rawOutput));
  }

  allEntries(): readonly GenerationJournalEntry[] {
    return [...this.entries];
  }

  usageTotals(): ProviderUsage {
    return this.entries.reduce<ProviderUsage>((total, entry) => ({
      promptTokens: total.promptTokens + (entry.usage?.promptTokens ?? 0),
      completionTokens: total.completionTokens + (entry.usage?.completionTokens ?? 0),
      promptCacheHitTokens: total.promptCacheHitTokens + (entry.usage?.promptCacheHitTokens ?? 0),
      promptCacheMissTokens: total.promptCacheMissTokens + (entry.usage?.promptCacheMissTokens ?? 0),
    }), { promptTokens: 0, completionTokens: 0, promptCacheHitTokens: 0, promptCacheMissTokens: 0 });
  }

  async recordAttempt(
    key: string,
    audit: ProviderAttemptAudit,
    provider: Pick<StructuredOutputProvider, "modelId" | "providerConfigHash"> = {
      modelId: "未指定",
      providerConfigHash: `0x${"00".repeat(32)}`,
    },
    requestHash: `0x${string}` = `0x${"00".repeat(32)}`,
  ): Promise<void> {
    if (audit.rawOutput !== undefined && (!audit.rawOutputHash || hashText(audit.rawOutput) !== audit.rawOutputHash)) {
      throw new Error(`任务 ${key} 第 ${audit.attempt} 次尝试的原始输出哈希不一致`);
    }
    if (audit.result === "valid" && (audit.rawOutput === undefined || !audit.rawOutputHash)) {
      throw new Error(`任务 ${key} 的合法输出缺少原文或哈希`);
    }
    const entry: GenerationJournalEntry = {
      schemaVersion: "1.0",
      recordedAt: new Date().toISOString(),
      key,
      modelId: provider.modelId,
      providerConfigHash: provider.providerConfigHash,
      requestHash,
      ...audit,
    };
    const pending = this.writeQueue.then(async () => {
      this.accept(entry);
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const handle = await open(this.filePath, "a");
      try {
        await handle.appendFile(`${JSON.stringify(entry)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
    });
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }
}

export class ResumableStructuredGenerator {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly provider: StructuredOutputProvider,
    private readonly journal: FileGenerationJournal,
  ) {}

  async generate<T>(key: string, request: Omit<StructuredOutputRequest, "recordAttempt">): Promise<T> {
    const requestHash = hashJson(request);
    const recovered = this.journal.validOutput<T>(key, request.schema, {
      modelId: this.provider.modelId,
      providerConfigHash: this.provider.providerConfigHash,
      requestHash,
    });
    if (recovered !== undefined) return recovered;
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const offset = this.journal.attemptCount(key);
    const pending = this.provider.generateStructured<T>({
      ...request,
      recordAttempt: async (audit) => {
        await this.journal.recordAttempt(
          key,
          { ...audit, attempt: offset + audit.attempt },
          this.provider,
          requestHash,
        );
      },
    }).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, pending);
    return pending;
  }
}
