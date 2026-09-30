import { mkdir, open } from "node:fs/promises";
import path from "node:path";

import type { Address } from "viem";

import { canonicalJson, hashText } from "./audit.js";

export interface AgentRunScope {
  chainId: number;
  predictionBook: Address;
}

export interface RunJournalEvent {
  type: "provider-attempt" | "proposition-output" | "proposition-compiled" | "diviner-output" | "prediction-submitted";
  payload: Record<string, unknown>;
}

export interface ClaimedAgentRun {
  readonly path: string;
  record(event: RunJournalEvent): Promise<void>;
}

export interface AgentRunJournal {
  claim(scope: AgentRunScope, roundId: bigint): Promise<ClaimedAgentRun>;
}

function line(value: unknown): string {
  return `${canonicalJson(value)}\n`;
}

/**
 * 按 chainId + PredictionBook + roundId 原子占用审计文件。
 * 进程崩溃后也会闭锁该轮：可用性让位于“不重跑择优”。
 */
export class FileAgentRunJournal implements AgentRunJournal {
  constructor(private readonly directory: string) {
    if (!directory.trim()) throw new Error("审计记录目录不能为空");
  }

  async claim(scope: AgentRunScope, roundId: bigint): Promise<ClaimedAgentRun> {
    if (!Number.isSafeInteger(scope.chainId) || scope.chainId <= 0) throw new Error("chainId 必须是正安全整数");
    if (roundId < 0n) throw new Error("roundId 不能为负数");
    await mkdir(this.directory, { recursive: true });
    const runKey = `${scope.chainId}:${scope.predictionBook.toLowerCase()}:${roundId}`;
    const filePath = path.join(this.directory, `${hashText(runKey).slice(2)}.jsonl`);
    let handle;
    try {
      handle = await open(filePath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`轮次 ${roundId} 的持久审计记录已存在，禁止重跑择优`, { cause: error });
      }
      throw error;
    }
    try {
      await handle.writeFile(line({
        type: "round-claimed",
        payload: { chainId: scope.chainId, predictionBook: scope.predictionBook, roundId },
      }), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    let pending = Promise.resolve();
    return {
      path: filePath,
      record: async (event) => {
        pending = pending.then(async () => {
          const appendHandle = await open(filePath, "a", 0o600);
          try {
            await appendHandle.writeFile(line(event), "utf8");
            await appendHandle.sync();
          } finally {
            await appendHandle.close();
          }
        });
        await pending;
      },
    };
  }
}
