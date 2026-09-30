import { keccak256, stringToHex, type Hex } from "viem";

import type { DivinerKey } from "../agent/diviners.js";
import {
  calibrateThreshold,
  type HistoricalValuePair,
  type SuitableThresholdCalibration,
} from "../difficulty-calibration.js";
import {
  constantPredictionLoss,
  pairedPermutationPValue,
  summarizeBrierSkill,
  summarizeOutcomeBaseline,
  type OutcomeBaseline,
} from "../scoring.js";

export interface ReplayBlock {
  blockNumber: bigint;
  blockHash: Hex;
  timestamp: bigint;
  totalSupply: bigint;
}

export interface CutoffSnapshot {
  cutoff: ReplayBlock;
  history: readonly ReplayBlock[];
}

export interface ReplaySource {
  readCutoffSnapshot(cutoffBlock: bigint, lookbackBlocks: number): Promise<CutoffSnapshot>;
  readCalibrationHistory(
    cutoffBlock: bigint,
    horizonBlocks: bigint,
    sampleCount: number,
    stepBlocks: bigint,
  ): Promise<readonly HistoricalValuePair[]>;
  readResolution(resolutionBlock: bigint): Promise<ReplayBlock>;
}

export interface ReplayProposition {
  predicateId: Hex;
  statement: string;
  cutoffBlock: bigint;
  resolutionBlock: bigint;
  threshold: bigint;
  calibration: SuitableThresholdCalibration;
}

export interface ReplayPerformance {
  sampleCount: number;
  correctCount: number;
  totalBrier: bigint;
  bankrollUsdc6: bigint;
}

export interface ReplayHexagram {
  lines: readonly number[];
  primaryKingWenNumber: number;
  derivedKingWenNumber: number;
  changingLinePositions: readonly number[];
}

export interface ReplayPredictionInput {
  roundIndex: number;
  divinerKey: DivinerKey;
  cutoff: ReplayBlock;
  history: readonly ReplayBlock[];
  hexagram: ReplayHexagram;
  proposition: Readonly<ReplayProposition>;
  performance: Readonly<ReplayPerformance>;
}

export interface ReplayPredictionOutput {
  probabilityBps: number;
  reasoning: string;
}

export interface ReplayPredictor {
  readonly modelId: string;
  predict(input: ReplayPredictionInput): Promise<ReplayPredictionOutput>;
}

export interface RiskDecisionInput {
  bankrollUsdc6: bigint;
  feeUsdc6: bigint;
  sampleCount: number;
  totalBrier: bigint;
  maxRiskBps: number;
  mMin: number;
  mMax: number;
}

export interface RiskDecision {
  kellyBps: number;
  multiplier: number;
  reservedUsdc6: bigint;
}

export interface ReplayPredictionRecord extends ReplayPredictionOutput {
  divinerKey: DivinerKey;
  direction: "YES" | "NO";
  multiplier: number;
  reservedUsdc6: bigint;
  settlementDeltaUsdc6: bigint;
  bankrollBeforeUsdc6: bigint;
  bankrollAfterUsdc6: bigint;
  brier: bigint;
  correct: boolean;
}

export interface ReplayRound {
  replayId: number;
  backtested: true;
  cutoff: ReplayBlock;
  resolution: ReplayBlock;
  proposition: Readonly<ReplayProposition>;
  hexagram: ReplayHexagram;
  outcome: boolean;
  predictions: readonly ReplayPredictionRecord[];
}

export interface ReplaySummary {
  sampleCount: number;
  correctCount: number;
  averageBrier: number;
  brierSkillScore: number | null;
  brierVsConstantPValue: number | null;
  wilson95: { lowerBps: number; upperBps: number };
  finalBankrollUsdc6: bigint;
}

export interface ReplayRun {
  backtested: true;
  modelId: string;
  sampleCount: number;
  candidateCount: number;
  skippedCandidateCount: number;
  outcomeBaseline: OutcomeBaseline;
  rounds: readonly ReplayRound[];
  summaries: Readonly<Record<DivinerKey, ReplaySummary>>;
}

export interface WalkForwardReplayOptions {
  source: ReplaySource;
  predictor: ReplayPredictor;
  divinerKeys: readonly DivinerKey[];
  sampleCount: number;
  startBlock: bigint;
  blockStep: bigint;
  resolutionHorizon: bigint;
  lookbackBlocks: number;
  feeUsdc6: bigint;
  initialBankrollUsdc6: bigint;
  maxRiskBps: number;
  mMin: number;
  mMax: number;
  difficultyCalibration: {
    sampleCount: number;
    stepBlocks: bigint;
    minimumBaseRateBps: number;
    maximumBaseRateBps: number;
  };
  onRoundComplete?: (completedRounds: number, totalRounds: number, round: ReplayRound) => void | Promise<void>;
  permutationRuns?: number;
}

const BRIER_SCALE = 100_000_000n;
const BPS = 10_000n;
const PREDICATE_ID = keccak256(stringToHex("REPLAY_USDC_SUPPLY_INCREASE"));
const KING_WEN = Buffer.from(
  "021807130f242e0b103328363e37202208031d3c273f30052d112f3a1f311c2b171b04293416121a23154026381e320e142a3b3d352539090c19060a210d2c01",
  "hex",
);

function requirePositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name}必须是正整数`);
}

function deriveHexagram(blockHash: Hex): ReplayHexagram {
  const bits = BigInt(blockHash);
  const lines: number[] = [];
  const changingLinePositions: number[] = [];
  let primaryIndex = 0;
  let derivedIndex = 0;
  for (let index = 0; index < 6; index += 1) {
    const coins = Number((bits >> BigInt(index * 3)) & 7n);
    const heads = (coins & 1) + ((coins >> 1) & 1) + ((coins >> 2) & 1);
    const line = 6 + heads;
    lines.push(line);
    const primaryYang = line === 7 || line === 9;
    const moving = line === 6 || line === 9;
    if (primaryYang) primaryIndex |= 1 << index;
    if (primaryYang !== moving) derivedIndex |= 1 << index;
    if (moving) changingLinePositions.push(index + 1);
  }
  return {
    lines,
    primaryKingWenNumber: KING_WEN[primaryIndex]!,
    derivedKingWenNumber: KING_WEN[derivedIndex]!,
    changingLinePositions,
  };
}

export function deterministicRiskDecision(input: RiskDecisionInput): RiskDecision {
  if (input.feeUsdc6 <= 0n || input.bankrollUsdc6 < 0n) throw new Error("bankroll 与卦金参数无效");
  requirePositiveSafeInteger(input.mMin, "最低倍率");
  requirePositiveSafeInteger(input.mMax, "最高倍率");
  if (input.mMin > input.mMax) throw new Error("最低倍率不得超过最高倍率");
  if (!Number.isSafeInteger(input.sampleCount) || input.sampleCount < 0) throw new Error("样本数无效");
  if (!Number.isSafeInteger(input.maxRiskBps) || input.maxRiskBps <= 0 || input.maxRiskBps > 10_000) {
    throw new Error("最大风险比例必须位于 1 至 10000 基点");
  }

  const maximumBrier = BigInt(input.sampleCount) * BRIER_SCALE;
  if (input.totalBrier < 0n || input.totalBrier > maximumBrier) throw new Error("Brier 历史无效");
  const successCredit = maximumBrier - input.totalBrier;
  const denominator = BigInt(input.sampleCount + 2) * BRIER_SCALE;
  const twiceSuccess = 2n * (BRIER_SCALE + successCredit);
  const kellyBps = twiceSuccess <= denominator ? 0 : Number((twiceSuccess - denominator) * BPS / denominator);
  const kellyMultiplier = kellyBps === 0
    ? input.mMin
    : Number(input.bankrollUsdc6 * BigInt(kellyBps) / (input.feeUsdc6 * BPS));
  const riskCap = Number(
    input.bankrollUsdc6 * BigInt(input.maxRiskBps) / (3n * input.feeUsdc6 * BPS),
  );
  if (riskCap < input.mMin) return { kellyBps, multiplier: 0, reservedUsdc6: 0n };
  const multiplier = Math.min(input.mMax, Math.max(input.mMin, kellyMultiplier), riskCap);
  return { kellyBps, multiplier, reservedUsdc6: 3n * BigInt(multiplier) * input.feeUsdc6 };
}

export function settlementDeltaUsdc6(
  feeUsdc6: bigint,
  multiplier: number,
  probabilityBps: number,
  outcome: boolean,
): bigint {
  if (multiplier === 0) return 0n;
  const distance = BigInt(outcome ? 10_000 - probabilityBps : probabilityBps);
  return BigInt(multiplier) * feeUsdc6 * (BRIER_SCALE - 4n * distance * distance) / BRIER_SCALE;
}

export function wilson95(correctCount: number, sampleCount: number): { lowerBps: number; upperBps: number } {
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 0 || !Number.isSafeInteger(correctCount)
    || correctCount < 0 || correctCount > sampleCount) throw new Error("Wilson 样本参数无效");
  if (sampleCount === 0) return { lowerBps: 0, upperBps: 10_000 };
  const z = 1.96;
  const p = correctCount / sampleCount;
  const denominator = 1 + z * z / sampleCount;
  const center = (p + z * z / (2 * sampleCount)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / sampleCount + z * z / (4 * sampleCount * sampleCount)) / denominator;
  return {
    lowerBps: Math.max(0, Math.floor((center - half) * 10_000)),
    upperBps: Math.min(10_000, Math.floor((center + half) * 10_000)),
  };
}

function validateSnapshot(snapshot: CutoffSnapshot, expectedCutoff: bigint): void {
  if (snapshot.cutoff.blockNumber !== expectedCutoff) throw new Error("截止块快照与请求块不一致");
  for (const observation of snapshot.history) {
    if (observation.blockNumber > expectedCutoff || observation.timestamp > snapshot.cutoff.timestamp) {
      throw new Error(`检测到前视偏差：预测窗口含截止块 ${expectedCutoff} 之后的数据`);
    }
  }
}

export class WalkForwardReplayEngine {
  constructor(private readonly options: WalkForwardReplayOptions) {
    requirePositiveSafeInteger(options.sampleCount, "回放样本数");
    requirePositiveSafeInteger(options.lookbackBlocks, "回看块数");
    requirePositiveSafeInteger(options.difficultyCalibration.sampleCount, "难度校准样本数");
    if (options.difficultyCalibration.stepBlocks <= 0n) throw new Error("难度校准步长必须为正");
    if (options.blockStep <= 0n || options.resolutionHorizon <= 0n) throw new Error("区块步长与结算距离必须为正");
    if (options.blockStep < options.resolutionHorizon) throw new Error("区块步长不得小于结算距离，避免轮次历史重叠");
    if (options.divinerKeys.length !== 3 || new Set(options.divinerKeys).size !== 3) {
      throw new Error("回放必须恰有三位不同易者");
    }
  }

  async run(): Promise<ReplayRun> {
    const performance = Object.fromEntries(this.options.divinerKeys.map((key) => [key, {
      sampleCount: 0,
      correctCount: 0,
      totalBrier: 0n,
      bankrollUsdc6: this.options.initialBankrollUsdc6,
    }])) as Record<DivinerKey, ReplayPerformance>;
    const rounds: ReplayRound[] = [];
    const maximumCandidateCount = this.options.sampleCount * 2;
    let candidateIndex = 0;
    let lastUnsuitableReason = "";

    while (rounds.length < this.options.sampleCount) {
      if (candidateIndex >= maximumCandidateCount) {
        throw new Error(
          `检查 ${candidateIndex} 个候选截止点后仅得到 ${rounds.length} 个合格回合；最后一次不适合用于测量：${lastUnsuitableReason}`,
        );
      }
      const roundIndex = rounds.length;
      const cutoffBlock = this.options.startBlock + BigInt(candidateIndex) * this.options.blockStep;
      candidateIndex += 1;
      const resolutionBlock = cutoffBlock + this.options.resolutionHorizon;
      const snapshot = await this.options.source.readCutoffSnapshot(cutoffBlock, this.options.lookbackBlocks);
      validateSnapshot(snapshot, cutoffBlock);
      const calibrationHistory = await this.options.source.readCalibrationHistory(
        cutoffBlock,
        this.options.resolutionHorizon,
        this.options.difficultyCalibration.sampleCount,
        this.options.difficultyCalibration.stepBlocks,
      );
      const calibration = calibrateThreshold({
        cutoffBlock,
        currentValue: snapshot.cutoff.totalSupply,
        horizonBlocks: this.options.resolutionHorizon,
        history: calibrationHistory,
        minimumBaseRateBps: this.options.difficultyCalibration.minimumBaseRateBps,
        maximumBaseRateBps: this.options.difficultyCalibration.maximumBaseRateBps,
      });
      if (!calibration.suitable) {
        lastUnsuitableReason = `${calibration.reason}；最接近基础概率=${calibration.closestBaseRateBps} 基点`;
        continue;
      }
      const proposition = Object.freeze({
        predicateId: PREDICATE_ID,
        statement: `Arc Testnet 的 USDC 总量在块 ${resolutionBlock} 是否严格高于校准阈值 ${calibration.threshold}？`,
        cutoffBlock,
        resolutionBlock,
        threshold: calibration.threshold,
        calibration,
      });
      const hexagram = deriveHexagram(snapshot.cutoff.blockHash);
      const pending = await Promise.all(this.options.divinerKeys.map(async (divinerKey) => {
        const prior = performance[divinerKey];
        const output = await this.options.predictor.predict({
          roundIndex,
          divinerKey,
          cutoff: snapshot.cutoff,
          history: snapshot.history,
          hexagram,
          proposition,
          performance: Object.freeze({ ...prior }),
        });
        if (!Number.isSafeInteger(output.probabilityBps) || output.probabilityBps < 100 || output.probabilityBps > 9_900) {
          throw new Error(`${divinerKey} 的回放概率超出 100 至 9900 基点`);
        }
        return {
          ...output,
          divinerKey,
          direction: output.probabilityBps >= 5_000 ? "YES" : "NO",
          risk: deterministicRiskDecision({
            bankrollUsdc6: prior.bankrollUsdc6,
            feeUsdc6: this.options.feeUsdc6,
            sampleCount: prior.sampleCount,
            totalBrier: prior.totalBrier,
            maxRiskBps: this.options.maxRiskBps,
            mMin: this.options.mMin,
            mMax: this.options.mMax,
          }),
          bankrollBeforeUsdc6: prior.bankrollUsdc6,
        } satisfies ReplayPredictionOutput & {
          divinerKey: DivinerKey;
          direction: "YES" | "NO";
          risk: RiskDecision;
          bankrollBeforeUsdc6: bigint;
        };
      }));

      const resolution = await this.options.source.readResolution(resolutionBlock);
      if (resolution.blockNumber !== resolutionBlock || resolution.timestamp <= snapshot.cutoff.timestamp) {
        throw new Error(
          `结算块或真实时间戳不满足因果顺序：cutoff=${snapshot.cutoff.blockNumber}/${snapshot.cutoff.timestamp}，resolution=${resolution.blockNumber}/${resolution.timestamp}`,
        );
      }
      const outcome = resolution.totalSupply > proposition.threshold;
      const predictions: ReplayPredictionRecord[] = pending.map((prediction) => {
        const distance = BigInt(outcome ? 10_000 - prediction.probabilityBps : prediction.probabilityBps);
        const brier = distance * distance;
        const correct = (prediction.direction === "YES") === outcome;
        const delta = settlementDeltaUsdc6(
          this.options.feeUsdc6,
          prediction.risk.multiplier,
          prediction.probabilityBps,
          outcome,
        );
        const after = prediction.bankrollBeforeUsdc6 + delta;
        const current = performance[prediction.divinerKey];
        current.sampleCount += 1;
        if (correct) current.correctCount += 1;
        current.totalBrier += brier;
        current.bankrollUsdc6 = after;
        return {
          divinerKey: prediction.divinerKey,
          probabilityBps: prediction.probabilityBps,
          reasoning: prediction.reasoning,
          direction: prediction.direction,
          multiplier: prediction.risk.multiplier,
          reservedUsdc6: prediction.risk.reservedUsdc6,
          settlementDeltaUsdc6: delta,
          bankrollBeforeUsdc6: prediction.bankrollBeforeUsdc6,
          bankrollAfterUsdc6: after,
          brier,
          correct,
        };
      });
      rounds.push({ replayId: roundIndex + 1, backtested: true, cutoff: snapshot.cutoff, resolution, proposition, hexagram, outcome, predictions });
      await this.options.onRoundComplete?.(roundIndex + 1, this.options.sampleCount, rounds.at(-1)!);
    }

    const outcomes = rounds.map((round) => round.outcome);
    const outcomeBaseline = summarizeOutcomeBaseline(outcomes);
    const summaries = Object.fromEntries(this.options.divinerKeys.map((key, keyIndex) => {
      const stats = performance[key];
      const averageBrier = Number(stats.totalBrier / BigInt(stats.sampleCount)) / Number(BRIER_SCALE);
      const skill = summarizeBrierSkill(outcomes, averageBrier);
      const brierDifferences = rounds.map((round) => {
        const prediction = round.predictions.find((item) => item.divinerKey === key)!;
        return constantPredictionLoss(round.outcome, outcomeBaseline.empiricalBaseRate)
          - Number(prediction.brier) / Number(BRIER_SCALE);
      });
      return [key, {
        sampleCount: stats.sampleCount,
        correctCount: stats.correctCount,
        averageBrier,
        brierSkillScore: skill.brierSkillScore,
        brierVsConstantPValue: skill.brierSkillScore === null
          ? null
          : pairedPermutationPValue(brierDifferences, this.options.permutationRuns ?? 99_999, 401 + keyIndex),
        wilson95: wilson95(stats.correctCount, stats.sampleCount),
        finalBankrollUsdc6: stats.bankrollUsdc6,
      }];
    })) as Record<DivinerKey, ReplaySummary>;
    return {
      backtested: true,
      modelId: this.options.predictor.modelId,
      sampleCount: rounds.length,
      candidateCount: candidateIndex,
      skippedCandidateCount: candidateIndex - rounds.length,
      outcomeBaseline,
      rounds,
      summaries,
    };
  }
}
