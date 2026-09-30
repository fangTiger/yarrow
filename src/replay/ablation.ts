import { encodePacked, keccak256, stringToHex, type Hex } from "viem";

import type { DivinerKey } from "../agent/diviners.js";
import type { SuitableThresholdCalibration } from "../difficulty-calibration.js";
import { constantPredictionLoss, summarizeBrierSkill } from "../scoring.js";
import { deterministicRiskDecision, settlementDeltaUsdc6, wilson95 } from "./engine.js";

export type AblationCondition = "actual" | "none" | "random" | "counterfactual";

export interface FrozenReplayRound {
  replayId: number;
  cutoff: { blockNumber: bigint; blockHash: Hex; totalSupply: bigint };
  proposition: {
    statement: string;
    cutoffBlock: bigint;
    resolutionBlock: bigint;
    threshold: bigint;
    calibration: SuitableThresholdCalibration;
  };
  hexagram: { lines: readonly number[]; primaryKingWenNumber: number; derivedKingWenNumber: number };
  outcome: boolean;
}

export interface FrozenReplaySource {
  sourceReport: string;
  sampleCount: number;
  rounds: readonly FrozenReplayRound[];
}

export interface AblationPerformance {
  sampleCount: number;
  correctCount: number;
  totalBrier: bigint;
  bankrollUsdc6: bigint;
}

export interface AblationPredictorInput {
  roundIndex: number;
  divinerKey: DivinerKey;
  proposition: Readonly<FrozenReplayRound["proposition"]>;
  performance: Readonly<AblationPerformance>;
  hexagram?: { lines: readonly number[] };
}

export interface AblationPrediction {
  divinerKey: DivinerKey;
  probabilityBps: number;
  direction: "YES" | "NO";
  correct: boolean;
  brier: bigint;
  multiplier: number;
  bankrollAfterUsdc6: bigint;
  reasoning: string;
}

export interface AblationRoundResult {
  replayId: number;
  statement: string;
  outcome: boolean;
  exposedHexagramLines: readonly number[] | null;
  predictions: readonly AblationPrediction[];
  meanBrier: number;
  hitRate: number;
}

export interface AblationSummary {
  sampleCount: number;
  correctCount: number;
  hitRateBps: number;
  averageBrier: number;
  yesCount: number;
  empiricalBaseRateBps: number;
  constantBaselineBrier: number;
  brierSkillScore: number | null;
  brierVsConstantPValue: number | null;
  wilson95: { lowerBps: number; upperBps: number };
}

export interface AblationGroup {
  condition: AblationCondition;
  label: string;
  roundCount: number;
  summary: AblationSummary;
  byDiviner: Record<DivinerKey, AblationSummary>;
  rounds: readonly AblationRoundResult[];
}

export interface AblationComparison {
  control: Exclude<AblationCondition, "actual">;
  controlLabel: string;
  brierDifference: number;
  brierRawPValue: number;
  brierHolmPValue: number;
  hitRateDifferencePercentagePoints: number;
  hitRateRawPValue: number;
  hitRateHolmPValue: number;
  significantAtFivePercent: boolean;
}

export interface AblationReport {
  schemaVersion: "1.0";
  generatedAt: string;
  network: { name: "Arc Testnet"; chainId: number };
  provider: {
    kind: "mock" | "deepseek";
    modelId: string;
    providerConfigHash?: Hex;
  };
  sourceReport: string;
  design: {
    pairedRounds: number;
    predictionsPerGroup: number;
    permutationRuns: number;
    randomHexagramSeed: string;
  };
  groups: Record<AblationCondition, AblationGroup>;
  comparisons: AblationComparison[];
  pairedHexagramSensitivity: {
    pairCount: number;
    changedProbabilityCount: number;
    changedProbabilityRateBps: number;
    meanAbsoluteProbabilityChangeBps: number;
    signedMeanProbabilityChangeBps: number;
    directionFlipCount: number;
    directionFlipRateBps: number;
    directionalShiftPValue: number;
  };
  conclusion: string;
  limitations: string[];
}

const DIVINER_KEYS = ["takashima", "wuxing", "meihua"] as const satisfies readonly DivinerKey[];
const CONDITION_LABELS: Record<AblationCondition, string> = {
  actual: "有真实卦象",
  none: "无卦象",
  random: "独立随机卦象",
  counterfactual: "同问题不同卦象",
};
const RANDOM_SEED = "yijing-ablation-independent-hexagram-v1";
const BRIER_SCALE = 100_000_000n;

function validateLines(lines: readonly number[]): void {
  if (lines.length !== 6 || lines.some((line) => ![6, 7, 8, 9].includes(line))) {
    throw new Error("消融实验六爻必须恰为六个 6/7/8/9 数值");
  }
}

/** 该随机卦象不读取截止块哈希、真实卦象或 outcome。 */
export function randomHexagramLines(replayId: number): readonly number[] {
  if (!Number.isSafeInteger(replayId) || replayId <= 0) throw new Error("replayId 必须为正整数");
  const digest = BigInt(keccak256(encodePacked(["string", "uint256"], [RANDOM_SEED, BigInt(replayId)])));
  return Array.from({ length: 6 }, (_unused, index) => 6 + Number((digest >> BigInt(index * 2)) & 3n));
}

/** 6↔9、7↔8，保证同一问题得到一个不同且仍合法的配对卦象。 */
export function counterfactualLines(lines: readonly number[]): readonly number[] {
  validateLines(lines);
  return lines.map((line) => 15 - line);
}

function exposedLines(condition: AblationCondition, round: FrozenReplayRound): readonly number[] | null {
  if (condition === "none") return null;
  if (condition === "random") return randomHexagramLines(round.replayId);
  if (condition === "counterfactual") return counterfactualLines(round.hexagram.lines);
  validateLines(round.hexagram.lines);
  return [...round.hexagram.lines];
}

export function buildAblationPredictorInput(input: {
  condition: AblationCondition;
  round: FrozenReplayRound;
  divinerKey: DivinerKey;
  performance: AblationPerformance;
}): AblationPredictorInput {
  const lines = exposedLines(input.condition, input.round);
  return {
    roundIndex: input.round.replayId - 1,
    divinerKey: input.divinerKey,
    proposition: Object.freeze({ ...input.round.proposition }),
    performance: Object.freeze({ ...input.performance }),
    ...(lines ? { hexagram: { lines } } : {}),
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item);
}

function mockProbability(input: AblationPredictorInput): number {
  const digest = keccak256(stringToHex(stableJson(input)));
  return 2_500 + Number(BigInt(digest) % 5_001n);
}

function summarize(
  predictions: readonly AblationPrediction[],
  rounds: readonly AblationRoundResult[],
  permutationRuns: number,
  seed: number,
): AblationSummary {
  const sampleCount = predictions.length;
  const correctCount = predictions.filter((prediction) => prediction.correct).length;
  const totalBrier = predictions.reduce((sum, prediction) => sum + prediction.brier, 0n);
  const averageBrier = sampleCount === 0 ? 0 : Number(totalBrier) / sampleCount / Number(BRIER_SCALE);
  const outcomes = rounds.map((round) => round.outcome);
  const skill = summarizeBrierSkill(outcomes, averageBrier);
  const predictionKeys = new Set(predictions.map((prediction) => prediction.divinerKey));
  const selectedKey = predictionKeys.size === 1 ? predictions[0]?.divinerKey : undefined;
  const clusteredBrier = rounds.map((round) => {
    const selected = selectedKey
      ? round.predictions.find((prediction) => prediction.divinerKey === selectedKey)
      : undefined;
    return selected
      ? Number(selected.brier) / Number(BRIER_SCALE)
      : round.meanBrier;
  });
  const brierDifferences = rounds.map((round, index) =>
    constantPredictionLoss(round.outcome, skill.empiricalBaseRate) - clusteredBrier[index]!);
  return {
    sampleCount,
    correctCount,
    hitRateBps: sampleCount === 0 ? 0 : Math.round(correctCount * 10_000 / sampleCount),
    averageBrier,
    yesCount: skill.yesCount,
    empiricalBaseRateBps: skill.empiricalBaseRateBps,
    constantBaselineBrier: skill.constantBaselineBrier,
    brierSkillScore: skill.brierSkillScore,
    brierVsConstantPValue: skill.brierSkillScore === null
      ? null
      : pairedPermutationPValue(brierDifferences, permutationRuns, seed),
    wilson95: wilson95(correctCount, sampleCount),
  };
}

function runGroup(source: FrozenReplaySource, condition: AblationCondition, permutationRuns: number): AblationGroup {
  const performance = Object.fromEntries(DIVINER_KEYS.map((key) => [key, {
    sampleCount: 0,
    correctCount: 0,
    totalBrier: 0n,
    bankrollUsdc6: 3_000_000n,
  }])) as Record<DivinerKey, AblationPerformance>;
  const rounds: AblationRoundResult[] = [];

  for (const round of source.rounds) {
    const predictions = DIVINER_KEYS.map((divinerKey): AblationPrediction => {
      const prior = performance[divinerKey];
      const predictorInput = buildAblationPredictorInput({ condition, round, divinerKey, performance: prior });
      const probabilityBps = mockProbability(predictorInput);
      const direction = probabilityBps >= 5_000 ? "YES" as const : "NO" as const;
      const correct = (direction === "YES") === round.outcome;
      const distance = BigInt(round.outcome ? 10_000 - probabilityBps : probabilityBps);
      const brier = distance * distance;
      const risk = deterministicRiskDecision({
        bankrollUsdc6: prior.bankrollUsdc6,
        feeUsdc6: 50_000n,
        sampleCount: prior.sampleCount,
        totalBrier: prior.totalBrier,
        maxRiskBps: 1_000,
        mMin: 1,
        mMax: 3,
      });
      const delta = settlementDeltaUsdc6(50_000n, risk.multiplier, probabilityBps, round.outcome);
      const bankrollAfterUsdc6 = prior.bankrollUsdc6 + delta;
      prior.sampleCount += 1;
      if (correct) prior.correctCount += 1;
      prior.totalBrier += brier;
      prior.bankrollUsdc6 = bankrollAfterUsdc6;
      return {
        divinerKey,
        probabilityBps,
        direction,
        correct,
        brier,
        multiplier: risk.multiplier,
        bankrollAfterUsdc6,
        reasoning: predictorInput.hexagram
          ? `确定性 mock 按固定命题、历史表现与六爻 ${predictorInput.hexagram.lines.join("/")} 生成概率。`
          : "确定性 mock 仅按固定命题与历史表现生成概率，输入中没有卦象或截止块哈希。",
      };
    });
    rounds.push({
      replayId: round.replayId,
      statement: round.proposition.statement,
      outcome: round.outcome,
      exposedHexagramLines: exposedLines(condition, round),
      predictions,
      meanBrier: predictions.reduce((sum, prediction) => sum + Number(prediction.brier) / Number(BRIER_SCALE), 0) / predictions.length,
      hitRate: predictions.filter((prediction) => prediction.correct).length / predictions.length,
    });
  }

  const allPredictions = rounds.flatMap((round) => round.predictions);
  const byDiviner = Object.fromEntries(DIVINER_KEYS.map((key) => [
    key,
    summarize(allPredictions.filter((prediction) => prediction.divinerKey === key), rounds, permutationRuns, 501 + DIVINER_KEYS.indexOf(key)),
  ])) as Record<DivinerKey, AblationSummary>;
  return {
    condition,
    label: CONDITION_LABELS[condition],
    roundCount: rounds.length,
    summary: summarize(allPredictions, rounds, permutationRuns, 500),
    byDiviner,
    rounds,
  };
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function seededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

/** 双侧配对随机化检验；零差异直接定义为 p=1。 */
export function pairedPermutationPValue(
  differences: readonly number[],
  permutationRuns = 99_999,
  seed = 2_026_090_5,
): number {
  if (differences.length === 0) throw new Error("配对置换检验至少需要一个差值");
  if (!Number.isSafeInteger(permutationRuns) || permutationRuns <= 0) throw new Error("置换次数必须为正整数");
  const observed = Math.abs(mean(differences));
  if (observed === 0 || differences.every((difference) => difference === 0)) return 1;
  const random = seededRandom(seed);
  let extreme = 0;
  for (let run = 0; run < permutationRuns; run += 1) {
    let sum = 0;
    for (const difference of differences) sum += random() < 0.5 ? difference : -difference;
    if (Math.abs(sum / differences.length) >= observed - 1e-15) extreme += 1;
  }
  return (extreme + 1) / (permutationRuns + 1);
}

function holmAdjust(values: readonly number[]): number[] {
  const ordered = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const adjusted = Array.from({ length: values.length }, () => 1);
  let runningMaximum = 0;
  ordered.forEach((entry, rank) => {
    runningMaximum = Math.max(runningMaximum, Math.min(1, entry.value * (values.length - rank)));
    adjusted[entry.index] = runningMaximum;
  });
  return adjusted;
}

function validateSource(source: FrozenReplaySource): void {
  if (source.sampleCount !== source.rounds.length || source.rounds.length === 0) {
    throw new Error("冻结回放来源的样本数与轮次数不一致");
  }
  const ids = new Set<number>();
  for (const round of source.rounds) {
    if (ids.has(round.replayId)) throw new Error(`重复 replayId：${round.replayId}`);
    ids.add(round.replayId);
    validateLines(round.hexagram.lines);
  }
}

export function runAblationExperiment(
  source: FrozenReplaySource,
  generatedAt: string,
  chainId: number,
  permutationRuns = 99_999,
): AblationReport {
  validateSource(source);
  const groups = {
    actual: runGroup(source, "actual", permutationRuns),
    none: runGroup(source, "none", permutationRuns),
    random: runGroup(source, "random", permutationRuns),
    counterfactual: runGroup(source, "counterfactual", permutationRuns),
  } satisfies Record<AblationCondition, AblationGroup>;

  const controls = ["none", "random", "counterfactual"] as const;
  const pending = controls.map((control, index) => {
    const brierDifferences = groups[control].rounds.map((round, roundIndex) => round.meanBrier - groups.actual.rounds[roundIndex]!.meanBrier);
    const hitDifferences = groups[control].rounds.map((round, roundIndex) => round.hitRate - groups.actual.rounds[roundIndex]!.hitRate);
    return {
      control,
      controlLabel: groups[control].label,
      brierDifference: mean(brierDifferences),
      brierRawPValue: pairedPermutationPValue(brierDifferences, permutationRuns, 101 + index),
      hitRateDifferencePercentagePoints: mean(hitDifferences) * 100,
      hitRateRawPValue: pairedPermutationPValue(hitDifferences, permutationRuns, 201 + index),
    };
  });
  const brierAdjusted = holmAdjust(pending.map((comparison) => comparison.brierRawPValue));
  const hitAdjusted = holmAdjust(pending.map((comparison) => comparison.hitRateRawPValue));
  const comparisons: AblationComparison[] = pending.map((comparison, index) => ({
    ...comparison,
    brierHolmPValue: brierAdjusted[index]!,
    hitRateHolmPValue: hitAdjusted[index]!,
    significantAtFivePercent: brierAdjusted[index]! < 0.05 || hitAdjusted[index]! < 0.05,
  }));

  const actualPredictions = groups.actual.rounds.flatMap((round) => round.predictions);
  const counterfactualPredictions = groups.counterfactual.rounds.flatMap((round) => round.predictions);
  const probabilityDifferences = counterfactualPredictions.map((prediction, index) => prediction.probabilityBps - actualPredictions[index]!.probabilityBps);
  const directionFlipCount = counterfactualPredictions.filter((prediction, index) => prediction.direction !== actualPredictions[index]!.direction).length;
  const changedProbabilityCount = probabilityDifferences.filter((difference) => difference !== 0).length;
  const roundProbabilityDifferences = groups.counterfactual.rounds.map((round, roundIndex) =>
    mean(round.predictions.map((prediction, predictionIndex) =>
      prediction.probabilityBps - groups.actual.rounds[roundIndex]!.predictions[predictionIndex]!.probabilityBps
    ))
  );
  const actualBetterThanBoth = comparisons
    .filter((comparison) => comparison.control === "none" || comparison.control === "random")
    .every((comparison) => comparison.brierDifference > 0 && comparison.brierHolmPValue < 0.05);
  const conclusion = actualBetterThanBoth
    ? "在这次确定性 mock 回放中，有卦象组相对无卦象与随机卦象出现统计显著的较低 Brier；这仍只是哈希流水线的结果，不能解释为卦象或真实模型具有预测增量。"
    : "在这次确定性 mock 回放中，没有观察到有卦象组相对无卦象与随机卦象同时具备经多重比较校正后的稳定预测增量。";

  return {
    schemaVersion: "1.0",
    generatedAt,
    network: { name: "Arc Testnet", chainId },
    provider: { kind: "mock", modelId: "deterministic-ablation-mock-v1" },
    sourceReport: source.sourceReport,
    design: {
      pairedRounds: source.rounds.length,
      predictionsPerGroup: source.rounds.length * DIVINER_KEYS.length,
      permutationRuns,
      randomHexagramSeed: RANDOM_SEED,
    },
    groups,
    comparisons,
    pairedHexagramSensitivity: {
      pairCount: probabilityDifferences.length,
      changedProbabilityCount,
      changedProbabilityRateBps: Math.round(changedProbabilityCount * 10_000 / probabilityDifferences.length),
      meanAbsoluteProbabilityChangeBps: mean(probabilityDifferences.map(Math.abs)),
      signedMeanProbabilityChangeBps: mean(probabilityDifferences),
      directionFlipCount,
      directionFlipRateBps: Math.round(directionFlipCount * 10_000 / probabilityDifferences.length),
      directionalShiftPValue: pairedPermutationPValue(roundProbabilityDifferences, permutationRuns, 301),
    },
    conclusion,
    limitations: [
      "当前 provider 是确定性 mock：概率由允许输入的哈希机械生成，只验证条件隔离、回放、计分和检验流水线，不能推断真实模型是否利用卦象。",
      "“有真实卦象”组复用既有主回放的冻结问题、卦象与 outcome，但不是直接复制既有主回放概率；四组均由同一个显式条件化的消融 mock 重跑，以保证组间只改变卦象暴露方式。",
      "真实 provider 就绪后必须在相同冻结轮次、相同提示版本和相同统计方案下重跑，不能挑选有利窗口。",
      `Wilson 区间按每条预测给出，三位易者共享同一轮 outcome，存在轮内相关；显著性判断因此以 ${source.rounds.length} 个轮次为配对聚类单位。`,
      "四组不是链上现场预测，不写入 ScoreBook 或 ReputationRegistry，也不冒充现场历史。",
    ],
  };
}

function percent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function pValue(value: number): string {
  return value < 0.0001 ? "<0.0001" : value.toFixed(4);
}

function nullableMetric(value: number | null): string {
  return value === null ? "不可定义" : value.toFixed(6);
}

function nullablePValue(value: number | null): string {
  return value === null ? "不可定义" : pValue(value);
}

export function serializeAblationReport(report: AblationReport): string {
  return `${JSON.stringify(report, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value, 2)}\n`;
}

export function renderAblationReport(report: AblationReport): string {
  const groupRows = Object.values(report.groups).map((group) =>
    `| ${group.label} | ${group.roundCount} / ${group.summary.sampleCount} | ${group.summary.correctCount} | ${percent(group.summary.hitRateBps)} | ${percent(group.summary.empiricalBaseRateBps)} | ${group.summary.constantBaselineBrier.toFixed(6)} | ${group.summary.averageBrier.toFixed(6)} | ${nullableMetric(group.summary.brierSkillScore)} | ${nullablePValue(group.summary.brierVsConstantPValue)} | ${percent(group.summary.wilson95.lowerBps)}–${percent(group.summary.wilson95.upperBps)} |`
  );
  const divinerRows = Object.values(report.groups).flatMap((group) => DIVINER_KEYS.map((key) => {
    const summary = group.byDiviner[key];
    return `| ${group.label} | ${key} | ${summary.sampleCount} | ${summary.correctCount} | ${percent(summary.hitRateBps)} | ${percent(summary.empiricalBaseRateBps)} | ${summary.constantBaselineBrier.toFixed(6)} | ${summary.averageBrier.toFixed(6)} | ${nullableMetric(summary.brierSkillScore)} | ${nullablePValue(summary.brierVsConstantPValue)} | ${percent(summary.wilson95.lowerBps)}–${percent(summary.wilson95.upperBps)} |`;
  }));
  const comparisonRows = report.comparisons.map((comparison) =>
    `| ${comparison.controlLabel} − 有真实卦象 | ${comparison.brierDifference >= 0 ? "+" : ""}${comparison.brierDifference.toFixed(6)} | ${pValue(comparison.brierRawPValue)} / ${pValue(comparison.brierHolmPValue)} | ${comparison.hitRateDifferencePercentagePoints >= 0 ? "+" : ""}${comparison.hitRateDifferencePercentagePoints.toFixed(2)} pp | ${pValue(comparison.hitRateRawPValue)} / ${pValue(comparison.hitRateHolmPValue)} | ${comparison.significantAtFivePercent ? "显著" : "不显著"} |`
  );
  const sensitivity = report.pairedHexagramSensitivity;
  return [
    "# 卦象消融实验报告",
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 冻结来源：\`${report.sourceReport}\``,
    `- 样本：每组 ${report.design.pairedRounds} 回合、${report.design.predictionsPerGroup} 条预测`,
    `- Provider：${report.provider.kind === "mock" ? "确定性 mock" : "DeepSeek 真实推理 API"}（${report.provider.modelId}）`,
    `- 基础概率（YES 占比）：${report.groups.actual.summary.yesCount}/${report.design.pairedRounds} = ${percent(report.groups.actual.summary.empiricalBaseRateBps)}`,
    `- 经验基础概率常数预测参照 Brier：${report.groups.actual.summary.constantBaselineBrier.toFixed(6)}；0.25 只代表永远报 50%，不是任意批次的正确参照。`,
    "- 警告：极端基础概率下，命中率会被多数类机械抬高，是误导性指标；主判断采用 Brier、BSS 与按轮次检验。",
    "",
    "## 四组结果",
    "",
    "| 条件 | 回合 / n | 命中 | 命中率 | 基础概率 | 常数 Brier | 平均 Brier | BSS | vs 常数 p | Wilson 95% |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...groupRows,
    "",
    "## 分易者结果",
    "",
    "| 条件 | 易者 | n | 命中 | 命中率 | 基础概率 | 常数 Brier | 平均 Brier | BSS | vs 常数 p | Wilson 95% |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...divinerRows,
    "",
    "## 组间显著性",
    "",
    `使用双侧配对置换检验（${report.design.permutationRuns.toLocaleString("zh-CN")} 次符号翻转）：同一历史轮次的三位易者先聚合为轮次均值，再比较 Brier 与命中率。这样保留配对并避免把同一 outcome 下的三条预测误当成完全独立。三项计划比较分别使用 Holm 法校正，α=0.05。`,
    "",
    "| 对照 − 主组 | 平均 Brier 差 | Brier p 原始 / Holm | 命中率差 | 命中 p 原始 / Holm | 判断 |",
    "|---|---:|---:|---:|---:|---|",
    ...comparisonRows,
    "",
    "Brier 差为正表示主组较好；命中率差为正表示对照组较好。显著性判断以 Holm 校正后 p<0.05 为准。",
    "",
    "## 同问题不同卦象的配对敏感性",
    "",
    `- 配对数：${sensitivity.pairCount}`,
    `- 概率发生变化：${sensitivity.changedProbabilityCount}（${percent(sensitivity.changedProbabilityRateBps)}）`,
    `- 平均绝对概率变化：${(sensitivity.meanAbsoluteProbabilityChangeBps / 100).toFixed(2)} 个百分点`,
    `- 有符号平均变化：${(sensitivity.signedMeanProbabilityChangeBps / 100).toFixed(2)} 个百分点`,
    `- 方向翻转：${sensitivity.directionFlipCount}（${percent(sensitivity.directionFlipRateBps)}）`,
    `- 一致方向偏移的配对置换 p：${pValue(sensitivity.directionalShiftPValue)}`,
    "",
    "## 诚实结论",
    "",
    report.conclusion,
    "",
    "## 限制",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
}
