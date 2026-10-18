import { encodePacked, keccak256, type Hex } from "viem";
import { throwFromHash } from "./coins.js";
import type { DocumentBackend } from "./storage.js";

const BEIJING_OFFSET_SECONDS = 8 * 3_600;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export interface DailyHexagramBlock {
  number: bigint;
  hash: Hex | null;
  timestamp: bigint;
}

export interface DailyHexagramBlockClient {
  getBlock(input: { blockNumber: bigint } | { blockTag: "latest" }): Promise<DailyHexagramBlock>;
}

export interface DailyHexagram {
  date: string;
  block: { number: string; hash: Hex; timestamp: string };
  lines: readonly number[];
  chainId: number;
}

export interface DailyHexagramServiceOptions {
  backend: DocumentBackend;
  client: DailyHexagramBlockClient;
  chainId: number;
  clock?: () => Date;
}

export class DailyHexagramUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("未能取得今日卦所需的 Arc 区块", options);
    this.name = "DailyHexagramUnavailableError";
  }
}

/** 给定时刻所属的北京时间民用日期。 */
export function beijingDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error("日期无效");
  return new Date(now.getTime() + BEIJING_OFFSET_SECONDS * 1_000).toISOString().slice(0, 10);
}

/** 北京零点换算为 Unix 秒，即同一日期 UTC 前一日 16:00。 */
export function beijingMidnightTimestamp(date: string): bigint {
  if (!DATE_PATTERN.test(date)) throw new Error("北京日期必须为 YYYY-MM-DD");
  const utcMidnight = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(utcMidnight) || new Date(utcMidnight).toISOString().slice(0, 10) !== date) {
    throw new Error("北京日期无效");
  }
  return BigInt(Math.floor(utcMidnight / 1_000) - BEIJING_OFFSET_SECONDS);
}

/** 每日公式：哈希最低三位沿用六掷铜钱换算。 */
export function deriveDailyLines(blockHash: Hex, date: string): readonly number[] {
  if (!DATE_PATTERN.test(date)) throw new Error("北京日期必须为 YYYY-MM-DD");
  return Array.from({ length: 6 }, (_, offset) => {
    const index = offset + 1;
    const hash = keccak256(encodePacked(
      ["string", "bytes32", "string", "uint8"],
      ["sanyi-daily-v1", blockHash, date, index],
    ));
    return throwFromHash(hash, index).value;
  });
}

function validBlock(block: DailyHexagramBlock): DailyHexagramBlock {
  if (block.number < 0n || block.timestamp < 0n) throw new Error("Arc 区块字段无效");
  return block;
}

/**
 * 先用近期样本估计平均出块时间和目标高度，再在估计区间内二分；
 * 若估计区间未夹住目标则指数扩展，不从创世块开始顺序扫描。
 */
export async function findFirstBlockAtOrAfter(
  client: DailyHexagramBlockClient,
  targetTimestamp: bigint,
): Promise<DailyHexagramBlock | null> {
  try {
    const latest = validBlock(await client.getBlock({ blockTag: "latest" }));
    if (latest.timestamp < targetTimestamp) return null;
    if (latest.number === 0n) return latest;

    const sampleDistance = latest.number < 50n ? latest.number : 50n;
    const sample = validBlock(await client.getBlock({ blockNumber: latest.number - sampleDistance }));
    const elapsed = latest.timestamp > sample.timestamp ? latest.timestamp - sample.timestamp : sampleDistance;
    const average = elapsed / sampleDistance || 1n;
    const blocksBack = (latest.timestamp - targetTimestamp + average - 1n) / average;
    const estimate = latest.number > blocksBack ? latest.number - blocksBack : 0n;

    let span = 64n;
    let lowerNumber = estimate > span ? estimate - span : 0n;
    let upperNumber = estimate + span < latest.number ? estimate + span : latest.number;
    let lower = validBlock(await client.getBlock({ blockNumber: lowerNumber }));
    let upper = upperNumber === latest.number
      ? latest
      : validBlock(await client.getBlock({ blockNumber: upperNumber }));

    while (lower.timestamp >= targetTimestamp && lowerNumber > 0n) {
      upperNumber = lowerNumber;
      upper = lower;
      span *= 2n;
      lowerNumber = lowerNumber > span ? lowerNumber - span : 0n;
      lower = validBlock(await client.getBlock({ blockNumber: lowerNumber }));
    }
    while (upper.timestamp < targetTimestamp && upperNumber < latest.number) {
      lowerNumber = upperNumber;
      lower = upper;
      span *= 2n;
      upperNumber = upperNumber + span < latest.number ? upperNumber + span : latest.number;
      upper = upperNumber === latest.number
        ? latest
        : validBlock(await client.getBlock({ blockNumber: upperNumber }));
    }

    if (lowerNumber === 0n && lower.timestamp >= targetTimestamp) return lower;
    while (upperNumber - lowerNumber > 1n) {
      const middleNumber = (lowerNumber + upperNumber) / 2n;
      const middle = validBlock(await client.getBlock({ blockNumber: middleNumber }));
      if (middle.timestamp >= targetTimestamp) {
        upperNumber = middleNumber;
        upper = middle;
      } else {
        lowerNumber = middleNumber;
        lower = middle;
      }
    }
    return upper;
  } catch (error) {
    if (error instanceof DailyHexagramUnavailableError) throw error;
    throw new DailyHexagramUnavailableError({ cause: error });
  }
}

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function parseDailyHexagram(raw: string): DailyHexagram {
  const value = JSON.parse(raw) as Partial<DailyHexagram>;
  const block = value.block;
  if (!value.date || !DATE_PATTERN.test(value.date)
    || !block || !/^\d+$/u.test(block.number ?? "")
    || !/^0x[0-9a-fA-F]{64}$/u.test(block.hash ?? "")
    || !/^\d+$/u.test(block.timestamp ?? "")
    || !Array.isArray(value.lines) || value.lines.length !== 6
    || value.lines.some((line) => ![6, 7, 8, 9].includes(line))
    || !Number.isSafeInteger(value.chainId) || (value.chainId ?? 0) <= 0) {
    throw new Error("每日一卦缓存格式无效");
  }
  return value as DailyHexagram;
}

/** 按北京日期读取或生成每日一卦；同一进程的并发请求共享一项计算。 */
export class DailyHexagramService {
  private readonly clock: () => Date;
  private readonly pending = new Map<string, Promise<DailyHexagram>>();

  constructor(private readonly options: DailyHexagramServiceOptions) {
    this.clock = options.clock ?? (() => new Date());
  }

  async get(): Promise<DailyHexagram> {
    return this.forDate(beijingDate(this.clock()));
  }

  private key(date: string): string {
    return `daily-hexagram/${date}`;
  }

  private async read(date: string): Promise<DailyHexagram | undefined> {
    try {
      return parseDailyHexagram(await this.options.backend.get(this.key(date)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private async forDate(date: string): Promise<DailyHexagram> {
    const cached = await this.read(date);
    if (cached) return cached;
    const active = this.pending.get(date);
    if (active) return active;
    const task = this.create(date);
    this.pending.set(date, task);
    try {
      return await task;
    } finally {
      if (this.pending.get(date) === task) this.pending.delete(date);
    }
  }

  private async create(date: string): Promise<DailyHexagram> {
    const block = await findFirstBlockAtOrAfter(
      this.options.client,
      beijingMidnightTimestamp(date),
    );
    // 极端情况下北京时间已换日但链尚未出块，继续返回前一天已确定的卦。
    if (!block) return this.forDate(previousDate(date));
    if (!block.hash) throw new DailyHexagramUnavailableError({ cause: new Error("Arc 区块缺少哈希") });
    const value: DailyHexagram = {
      date,
      block: {
        number: block.number.toString(),
        hash: block.hash,
        timestamp: block.timestamp.toString(),
      },
      lines: deriveDailyLines(block.hash, date),
      chainId: this.options.chainId,
    };
    const text = JSON.stringify(value);
    if (await this.options.backend.setIfAbsent(this.key(date), text)) return value;
    const winner = await this.read(date);
    if (!winner) throw new Error(`每日一卦缓存竞争后缺失：${date}`);
    return winner;
  }
}
