import type { Address, PublicClient } from "viem";

import type { CutoffSnapshot, ReplayBlock, ReplaySource } from "./engine.js";
import type { HistoricalValuePair } from "../difficulty-calibration.js";

const TOTAL_SUPPLY_ABI = [{
  type: "function",
  name: "totalSupply",
  stateMutability: "view",
  inputs: [],
  outputs: [{ name: "", type: "uint256" }],
}] as const;

export interface ArcReplaySourceOptions {
  maxAttempts?: number;
  retryDelayMilliseconds?: number;
  maxConcurrentRequests?: number;
}

/** 所有状态查询都显式绑定同一历史 block tag，禁止把当前状态误当作历史状态。 */
export class ArcReplaySource implements ReplaySource {
  private readonly cache = new Map<bigint, Promise<ReplayBlock>>();
  private activeRequests = 0;
  private readonly requestWaiters: Array<() => void> = [];

  constructor(
    private readonly publicClient: PublicClient,
    private readonly usdcAddress: Address,
    private readonly options: ArcReplaySourceOptions = {},
  ) {
    const maxConcurrentRequests = options.maxConcurrentRequests ?? 4;
    if (!Number.isSafeInteger(maxConcurrentRequests) || maxConcurrentRequests <= 0) {
      throw new Error("RPC 最大并发数必须是正整数");
    }
  }

  private async withRequestSlot<T>(operation: () => Promise<T>): Promise<T> {
    const maxConcurrentRequests = this.options.maxConcurrentRequests ?? 4;
    if (this.activeRequests >= maxConcurrentRequests) {
      await new Promise<void>((resolve) => this.requestWaiters.push(resolve));
    }
    this.activeRequests += 1;
    try {
      return await operation();
    } finally {
      this.activeRequests -= 1;
      this.requestWaiters.shift()?.();
    }
  }

  private async retry<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = this.options.maxAttempts ?? 6;
    const baseDelay = this.options.retryDelayMilliseconds ?? 500;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.withRequestSlot(operation);
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts && baseDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, baseDelay * 2 ** (attempt - 1)));
        }
      }
    }
    throw lastError;
  }

  async readCutoffSnapshot(cutoffBlock: bigint, lookbackBlocks: number): Promise<CutoffSnapshot> {
    if (!Number.isSafeInteger(lookbackBlocks) || lookbackBlocks <= 0) throw new Error("回看块数必须是正整数");
    if (cutoffBlock < BigInt(lookbackBlocks)) throw new Error("截止块不足以覆盖回看窗口");
    const historyBlocks = Array.from(
      { length: lookbackBlocks },
      (_unused, index) => cutoffBlock - BigInt(lookbackBlocks - index),
    );
    const [cutoff, ...history] = await Promise.all([
      this.readBlock(cutoffBlock),
      ...historyBlocks.map((blockNumber) => this.readBlock(blockNumber)),
    ]);
    return { cutoff, history };
  }

  readResolution(resolutionBlock: bigint): Promise<ReplayBlock> {
    return this.readBlock(resolutionBlock);
  }

  async readCalibrationHistory(
    cutoffBlock: bigint,
    horizonBlocks: bigint,
    sampleCount: number,
    stepBlocks: bigint,
  ): Promise<readonly HistoricalValuePair[]> {
    if (horizonBlocks <= 0n || stepBlocks <= 0n) throw new Error("难度校准跨度与步长必须为正");
    if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) throw new Error("难度校准样本数必须为正整数");
    const latestStartBlock = cutoffBlock - 1n - horizonBlocks;
    const oldestStartBlock = latestStartBlock - BigInt(sampleCount - 1) * stepBlocks;
    if (oldestStartBlock < 0n) throw new Error("截止块不足以覆盖难度校准窗口");
    return Promise.all(Array.from({ length: sampleCount }, async (_unused, index) => {
      const startBlock = oldestStartBlock + BigInt(index) * stepBlocks;
      const endBlock = startBlock + horizonBlocks;
      const [start, end] = await Promise.all([this.readBlock(startBlock), this.readBlock(endBlock)]);
      return {
        startBlock,
        endBlock,
        startValue: start.totalSupply,
        endValue: end.totalSupply,
      };
    }));
  }

  private readBlock(blockNumber: bigint): Promise<ReplayBlock> {
    const cached = this.cache.get(blockNumber);
    if (cached) return cached;
    const pending = Promise.all([
      this.retry(() => this.publicClient.getBlock({ blockNumber, includeTransactions: false })),
      this.retry(() => this.publicClient.readContract({
        address: this.usdcAddress,
        abi: TOTAL_SUPPLY_ABI,
        functionName: "totalSupply",
        blockNumber,
      })),
    ]).then(([block, totalSupply]) => {
      if (block.number !== blockNumber || !block.hash) throw new Error(`历史块 ${blockNumber} 缺少确定哈希`);
      return { blockNumber, blockHash: block.hash, timestamp: block.timestamp, totalSupply };
    }).catch((error: unknown) => {
      this.cache.delete(blockNumber);
      throw error;
    });
    this.cache.set(blockNumber, pending);
    return pending;
  }
}

export { TOTAL_SUPPLY_ABI };
