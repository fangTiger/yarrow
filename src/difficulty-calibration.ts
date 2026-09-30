export interface HistoricalValuePair {
  startBlock: bigint;
  endBlock: bigint;
  startValue: bigint;
  endValue: bigint;
}

export interface ThresholdCalibrationInput {
  cutoffBlock: bigint;
  currentValue: bigint;
  horizonBlocks: bigint;
  history: readonly HistoricalValuePair[];
  minimumBaseRateBps: number;
  maximumBaseRateBps: number;
}

export interface SuitableThresholdCalibration {
  suitable: true;
  threshold: bigint;
  thresholdDelta: bigint;
  sampleCount: number;
  yesCount: number;
  empiricalBaseRateBps: number;
  historyStartBlock: bigint;
  historyEndBlock: bigint;
  horizonBlocks: bigint;
}

export interface UnsuitableThresholdCalibration {
  suitable: false;
  reason: string;
  sampleCount: number;
  closestBaseRateBps: number;
}

export type ThresholdCalibration = SuitableThresholdCalibration | UnsuitableThresholdCalibration;

function requireBaseRateRange(minimum: number, maximum: number): void {
  if (
    !Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)
    || minimum < 0 || maximum > 10_000 || minimum > maximum
  ) {
    throw new Error("经验基础概率区间必须是有效基点范围");
  }
}

function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(0)}%`;
}

/**
 * 对严格大于型谓词使用同跨度历史增量校准绝对阈值。
 * 候选按「距 50% 最近、再按阈值增量升序」确定，保证跨进程可复现。
 */
export function calibrateThreshold(input: ThresholdCalibrationInput): ThresholdCalibration {
  requireBaseRateRange(input.minimumBaseRateBps, input.maximumBaseRateBps);
  if (input.currentValue < 0n) throw new Error("当前值不得为负");
  if (input.horizonBlocks <= 0n) throw new Error("预测跨度必须为正");
  if (input.history.length === 0) throw new Error("难度校准至少需要一个历史配对");

  for (const pair of input.history) {
    if (pair.startBlock >= pair.endBlock || pair.endBlock - pair.startBlock !== input.horizonBlocks) {
      throw new Error("难度校准历史配对的区块跨度不一致");
    }
    if (pair.endBlock >= input.cutoffBlock) {
      throw new Error(`检测到前视偏差：校准历史结算块 ${pair.endBlock} 未严格早于截止块 ${input.cutoffBlock}`);
    }
  }

  const deltas = input.history.map((pair) => pair.endValue - pair.startValue);
  const unique = [...new Set(deltas.map(String))].map(BigInt).sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const candidates = [unique[0]! - 1n, ...unique].filter((delta) => input.currentValue + delta >= 0n);
  const ranked = candidates.map((thresholdDelta) => {
    const yesCount = deltas.filter((delta) => delta > thresholdDelta).length;
    const empiricalBaseRateBps = Math.round(yesCount * 10_000 / deltas.length);
    return { thresholdDelta, yesCount, empiricalBaseRateBps };
  }).sort((left, right) => {
    const distance = Math.abs(left.empiricalBaseRateBps - 5_000) - Math.abs(right.empiricalBaseRateBps - 5_000);
    if (distance !== 0) return distance;
    return left.thresholdDelta < right.thresholdDelta ? -1 : left.thresholdDelta > right.thresholdDelta ? 1 : 0;
  });
  const closest = ranked[0];
  if (!closest) throw new Error("当前值下没有可编码的非负绝对阈值");
  const selected = ranked.find((candidate) =>
    candidate.empiricalBaseRateBps >= input.minimumBaseRateBps
    && candidate.empiricalBaseRateBps <= input.maximumBaseRateBps);
  if (!selected) {
    return {
      suitable: false,
      reason: `历史增量存在大量并列值，任何阈值都无法把经验基础概率校准到 ${formatPercent(input.minimumBaseRateBps)}–${formatPercent(input.maximumBaseRateBps)}`,
      sampleCount: input.history.length,
      closestBaseRateBps: closest.empiricalBaseRateBps,
    };
  }

  return {
    suitable: true,
    threshold: input.currentValue + selected.thresholdDelta,
    thresholdDelta: selected.thresholdDelta,
    sampleCount: input.history.length,
    yesCount: selected.yesCount,
    empiricalBaseRateBps: selected.empiricalBaseRateBps,
    historyStartBlock: input.history.reduce((minimum, pair) => pair.startBlock < minimum ? pair.startBlock : minimum, input.history[0]!.startBlock),
    historyEndBlock: input.history.reduce((maximum, pair) => pair.endBlock > maximum ? pair.endBlock : maximum, input.history[0]!.endBlock),
    horizonBlocks: input.horizonBlocks,
  };
}
