export type LineValue = 6 | 7 | 8 | 9;

export interface LineView {
  position: number;
  value: LineValue;
  changing: boolean;
  primaryYang: boolean;
  derivedYang: boolean;
}

interface ReplayPredictionLike {
  divinerKey: string;
  multiplier: number;
  bankrollBeforeUsdc6: string;
  bankrollAfterUsdc6: string;
}

interface ReplayRoundLike {
  replayId: number;
  predictions: readonly ReplayPredictionLike[];
}

export interface BankrollPoint {
  replayId: number;
  bankrollUsdc: number;
  multiplier: number;
}

export interface GraveSnapshot {
  key: string;
  name: string;
  address: string;
  agentId: string | null;
  vaultAddress: string;
  vaultState: "SEALED";
  vaultAssetsUsdc6: string;
  historyCount: number;
  lastLiveEntry: {
    roundId: string;
    probabilityBps: number;
    brier: number;
    unresolved: boolean;
    primary: { number: number; name: string };
    derived: { number: number; name: string };
  };
  contracts: {
    divinationRegistry: string;
    predictionBook: string;
    scoreBook: string;
  };
}

export type GraveCandidate = Omit<GraveSnapshot, "vaultState" | "lastLiveEntry"> & {
  vaultState: "ACTIVE" | "SEALED";
  lastLiveEntry: GraveSnapshot["lastLiveEntry"] | null;
};

function isLineValue(value: number): value is LineValue {
  return value === 6 || value === 7 || value === 8 || value === 9;
}

/**
 * 合约中的 lines 从初爻到上爻排列；视觉上仍按传统把上爻画在最上方。
 */
export function createLineViews(lines: readonly number[]): LineView[] {
  if (lines.length !== 6 || !lines.every(isLineValue)) {
    throw new Error("六爻必须恰好包含六个 6/7/8/9 数值");
  }

  return lines
    .map((value, index) => {
      const primaryYang = value === 7 || value === 9;
      const changing = value === 6 || value === 9;
      return {
        position: index + 1,
        value,
        changing,
        primaryYang,
        derivedYang: changing ? !primaryYang : primaryYang,
      };
    })
    .reverse();
}

function usdc6ToNumber(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`无效的六位精度 USDC：${value}`);
  return Number(BigInt(value)) / 1_000_000;
}

/**
 * 曲线不重新估算倍率；逐点采用确定性回放报告已经记录的余额与倍率。
 */
export function buildBankrollSeries(rounds: readonly unknown[]): Record<string, BankrollPoint[]> {
  const series: Record<string, BankrollPoint[]> = {};

  for (const candidate of rounds) {
    const round = candidate as ReplayRoundLike;
    if (!Number.isInteger(round.replayId) || !Array.isArray(round.predictions)) {
      throw new Error("回放轮次结构无效");
    }

    for (const prediction of round.predictions) {
      const points = (series[prediction.divinerKey] ??= []);
      if (points.length === 0) {
        points.push({
          replayId: 0,
          bankrollUsdc: usdc6ToNumber(prediction.bankrollBeforeUsdc6),
          multiplier: prediction.multiplier,
        });
      }
      points.push({
        replayId: round.replayId,
        bankrollUsdc: usdc6ToNumber(prediction.bankrollAfterUsdc6),
        multiplier: prediction.multiplier,
      });
    }
  }

  return series;
}

export function interpretBacktestSignal(
  brierSkillScore: number | null,
  brierVsConstantPValue: number | null,
): "no-discernible-signal" | "inconclusive" {
  if (brierSkillScore === null || brierVsConstantPValue === null) return "inconclusive";
  return brierSkillScore <= 0 || brierVsConstantPValue >= 0.05
    ? "no-discernible-signal"
    : "inconclusive";
}

export function formatUsdc6(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 1_000_000n;
  const fraction = (absolute % 1_000_000n).toString().padStart(6, "0");
  return `${negative ? "−" : ""}${whole}.${fraction}`;
}

/** 墓碑必须同时有链上 SEALED 状态与至少一条可定位到卦象的现场历史。 */
export function buildVerifiedGrave(candidate: GraveCandidate): GraveSnapshot | null {
  if (candidate.vaultState !== "SEALED" || candidate.historyCount <= 0 || candidate.lastLiveEntry === null) {
    return null;
  }
  return { ...candidate, vaultState: "SEALED", lastLiveEntry: candidate.lastLiveEntry };
}
