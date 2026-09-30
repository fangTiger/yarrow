import type { Address, PublicClient } from "viem";

import type { DivinerHistory, DivinerHistoryEntry } from "./diviners.js";

const SCORE_BOOK_ABI = [
  {
    type: "function",
    name: "getStats",
    stateMutability: "view",
    inputs: [{ name: "diviner", type: "address" }],
    outputs: [{
      name: "stats",
      type: "tuple",
      components: [
        { name: "sampleCount", type: "uint64" },
        { name: "correctCount", type: "uint64" },
        { name: "unresolvedCount", type: "uint64" },
        { name: "totalBrier", type: "uint256" },
      ],
    }],
  },
  {
    type: "function",
    name: "historyCount",
    stateMutability: "view",
    inputs: [{ name: "diviner", type: "address" }],
    outputs: [{ name: "count", type: "uint256" }],
  },
  {
    type: "function",
    name: "getHistory",
    stateMutability: "view",
    inputs: [{ name: "diviner", type: "address" }, { name: "index", type: "uint256" }],
    outputs: [{
      name: "entry",
      type: "tuple",
      components: [
        { name: "predictionId", type: "uint256" },
        { name: "roundId", type: "uint256" },
        { name: "probabilityBps", type: "uint16" },
        { name: "brier", type: "uint256" },
        { name: "outcome", type: "bool" },
        { name: "correct", type: "bool" },
        { name: "unresolved", type: "bool" },
      ],
    }],
  },
] as const;

interface StatsResult {
  sampleCount: bigint;
  correctCount: bigint;
  unresolvedCount: bigint;
  totalBrier: bigint;
}

interface HistoryResult {
  probabilityBps: number;
  brier: bigint;
  outcome: boolean;
  unresolved: boolean;
}

function safeNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} 超出 JavaScript 安全整数范围`);
  return Number(value);
}

/** 从 ScoreBook 读取该易者自己的累计指标和最近记录，供概率自我校准。 */
export async function readDivinerHistory(
  client: PublicClient,
  scoreBook: Address,
  diviner: Address,
  recentLimit = 5,
): Promise<DivinerHistory> {
  if (!Number.isInteger(recentLimit) || recentLimit < 0) throw new Error("历史记录上限必须是非负整数");
  const [stats, count] = await Promise.all([
    client.readContract({ address: scoreBook, abi: SCORE_BOOK_ABI, functionName: "getStats", args: [diviner] }) as Promise<StatsResult>,
    client.readContract({ address: scoreBook, abi: SCORE_BOOK_ABI, functionName: "historyCount", args: [diviner] }) as Promise<bigint>,
  ]);
  const start = count > BigInt(recentLimit) ? count - BigInt(recentLimit) : 0n;
  const reads: Array<Promise<HistoryResult>> = [];
  for (let index = start; index < count; index += 1n) {
    reads.push(client.readContract({
      address: scoreBook,
      abi: SCORE_BOOK_ABI,
      functionName: "getHistory",
      args: [diviner, index],
    }) as Promise<HistoryResult>);
  }
  const recentRaw = await Promise.all(reads);
  const recent: DivinerHistoryEntry[] = recentRaw.map((entry) => ({
    probabilityBps: entry.probabilityBps,
    outcome: entry.unresolved ? null : entry.outcome,
    brier: Number(entry.brier) / 100_000_000,
    unresolved: entry.unresolved,
  }));
  const sampleCount = safeNumber(stats.sampleCount, "样本数");
  return {
    sampleCount,
    correctCount: safeNumber(stats.correctCount, "正确数"),
    unresolvedCount: safeNumber(stats.unresolvedCount, "未决数"),
    averageBrier: sampleCount === 0 ? 0 : Number(stats.totalBrier) / 100_000_000 / sampleCount,
    recent,
  };
}

export { SCORE_BOOK_ABI };
