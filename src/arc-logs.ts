export const ARC_RPC_CONCURRENCY_LIMIT = 4;

/**
 * Arc 实测 25,000 块可查、30,000 块触发区间上限；高频日志还受单次 20,000 条结果上限约束。
 * 默认 9,000 块为区间上限保留充足余量，结果量上限则由下方自动二分继续收窄。
 */
export const ARC_LOG_SCAN_BLOCK_WINDOW = 9_000n;

export interface LogBlockRange {
  fromBlock: bigint;
  toBlock: bigint;
}

interface HistoricalLogPosition {
  blockNumber: bigint | null;
  logIndex: number | null;
}

export interface LogWindowScanInput<T extends HistoricalLogPosition> {
  fromBlock: bigint;
  toBlock: bigint;
  windowSize?: bigint;
  fetchLogs: (range: LogBlockRange) => Promise<readonly T[]>;
}

function logLimitErrorText(error: unknown, seen = new Set<object>()): string {
  if (typeof error === "string") return error;
  if (typeof error !== "object" || error === null || seen.has(error)) return "";
  seen.add(error);
  const record = error as Record<string, unknown>;
  const ownText = [record.message, record.shortMessage, record.details]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return `${ownText} ${logLimitErrorText(record.cause, seen)}`;
}

function isLogLimitError(error: unknown): boolean {
  const message = logLimitErrorText(error);
  return /query exceeds.*max(?:imum)? results/i.test(message)
    || /query returned more than.*results/i.test(message)
    || /response size exceeded/i.test(message)
    || /requested range too large/i.test(message)
    || /block range.*(?:too large|exceed)/i.test(message)
    || /request exceeds/i.test(message);
}

async function mapWithLimit<T, R>(
  items: readonly T[],
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(ARC_RPC_CONCURRENCY_LIMIT, items.length) },
    () => worker(),
  ));
  return results;
}

async function fetchRangeWithBisection<T extends HistoricalLogPosition>(
  range: LogBlockRange,
  fetchLogs: LogWindowScanInput<T>["fetchLogs"],
): Promise<readonly T[]> {
  try {
    return await fetchLogs(range);
  } catch (error) {
    if (!isLogLimitError(error) || range.fromBlock === range.toBlock) throw error;
    const midpoint = (range.fromBlock + range.toBlock) / 2n;
    const left = await fetchRangeWithBisection(
      { fromBlock: range.fromBlock, toBlock: midpoint },
      fetchLogs,
    );
    const right = await fetchRangeWithBisection(
      { fromBlock: midpoint + 1n, toBlock: range.toBlock },
      fetchLogs,
    );
    return [...left, ...right];
  }
}

function sortAndDedupeLogs<T extends HistoricalLogPosition>(logs: readonly T[]): T[] {
  for (const log of logs) {
    if (log.blockNumber === null || log.logIndex === null) {
      throw new Error("历史事件缺少块高或 logIndex，无法安全排序去重");
    }
  }
  const sorted = [...logs].sort((left, right) => {
    const blockOrder = left.blockNumber! < right.blockNumber!
      ? -1
      : left.blockNumber! > right.blockNumber!
        ? 1
        : 0;
    return blockOrder || left.logIndex! - right.logIndex!;
  });
  const unique: T[] = [];
  let previousKey: string | null = null;
  for (const log of sorted) {
    const key = `${log.blockNumber}:${log.logIndex}`;
    if (key === previousKey) continue;
    unique.push(log);
    previousKey = key;
  }
  return unique;
}

/** 按不重叠闭区间扫描历史事件，并在 Arc 返回范围或结果量上限错误时自动二分。 */
export async function scanLogsInBlockWindows<T extends HistoricalLogPosition>(
  input: LogWindowScanInput<T>,
): Promise<T[]> {
  const windowSize = input.windowSize ?? ARC_LOG_SCAN_BLOCK_WINDOW;
  if (windowSize <= 0n) throw new Error("事件扫描窗口必须为正数");
  if (input.fromBlock > input.toBlock) return [];

  const ranges: LogBlockRange[] = [];
  for (let fromBlock = input.fromBlock; fromBlock <= input.toBlock; fromBlock += windowSize) {
    const candidateEnd = fromBlock + windowSize - 1n;
    ranges.push({
      fromBlock,
      toBlock: candidateEnd < input.toBlock ? candidateEnd : input.toBlock,
    });
  }
  const chunks = await mapWithLimit(ranges, (range) => fetchRangeWithBisection(range, input.fetchLogs));
  return sortAndDedupeLogs(chunks.flat());
}
