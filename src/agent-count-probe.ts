export type ExistenceReader = (agentId: bigint) => Promise<boolean>;

export interface HighWatermarkResult {
  highWatermark: bigint;
  firstMissing: bigint;
  count: bigint;
  ownerOfCalls: number;
}

export async function findHighWatermark(
  exists: ExistenceReader,
  knownExisting: bigint,
  knownMissing: bigint,
): Promise<HighWatermarkResult> {
  if (knownExisting < 0n || knownMissing <= knownExisting) throw new Error("二分边界无效");
  let ownerOfCalls = 0;
  ownerOfCalls += 1;
  if (!(await exists(knownExisting))) throw new Error("已知存在下界实际不存在，拒绝二分");
  ownerOfCalls += 1;
  if (await exists(knownMissing)) throw new Error("已知缺失上界实际存在，拒绝二分");

  let low = knownExisting;
  let high = knownMissing;
  while (high - low > 1n) {
    const middle = (low + high) >> 1n;
    ownerOfCalls += 1;
    if (await exists(middle)) low = middle;
    else high = middle;
  }
  return { highWatermark: low, firstMissing: high, count: low + 1n, ownerOfCalls };
}

export interface ContinuitySample {
  sampledIds: bigint[];
  missingIds: bigint[];
}

export async function sampleContinuity(
  exists: ExistenceReader,
  startId: bigint,
  endId: bigint,
  sampleCount: number,
): Promise<ContinuitySample> {
  if (startId < 0n || endId < startId) throw new Error("连续性区间无效");
  const available = endId - startId + 1n;
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 2 || BigInt(sampleCount) > available) {
    throw new Error("连续性样本数必须至少为 2 且不超过区间 id 数");
  }
  const span = endId - startId;
  const sampledIds = Array.from({ length: sampleCount }, (_unused, index) =>
    startId + span * BigInt(index) / BigInt(sampleCount - 1)
  );
  const present = await Promise.all(sampledIds.map(exists));
  return {
    sampledIds,
    missingIds: sampledIds.filter((_id, index) => !present[index]),
  };
}

export interface ThresholdManipulationInput {
  currentCount: bigint;
  threshold: bigint;
  registerGas: bigint;
  gasPriceWei: bigint;
  observedRegistrations: bigint;
  observedSeconds: number;
}

export interface ThresholdManipulationEstimate {
  requiredRegistrations: bigint;
  gas: bigint;
  costWei: bigint;
  projectedSecondsAtObservedRate: number | null;
}

export function estimateThresholdManipulation(input: ThresholdManipulationInput): ThresholdManipulationEstimate {
  if (input.currentCount < 0n || input.threshold < 0n || input.registerGas < 0n || input.gasPriceWei < 0n) {
    throw new Error("操纵成本输入不得为负");
  }
  if (input.observedRegistrations < 0n || !Number.isFinite(input.observedSeconds) || input.observedSeconds <= 0) {
    throw new Error("注册速率观察参数无效");
  }
  const requiredRegistrations = input.currentCount > input.threshold
    ? 0n
    : input.threshold + 1n - input.currentCount;
  const gas = requiredRegistrations * input.registerGas;
  return {
    requiredRegistrations,
    gas,
    costWei: gas * input.gasPriceWei,
    projectedSecondsAtObservedRate: input.observedRegistrations === 0n
      ? null
      : Number(requiredRegistrations) * input.observedSeconds / Number(input.observedRegistrations),
  };
}
