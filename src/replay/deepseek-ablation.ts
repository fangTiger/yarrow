import type { Hex } from "viem";

import type { DivinerKey } from "../agent/diviners.js";
import { constantPredictionLoss, summarizeBrierSkill } from "../scoring.js";
import {
  buildAblationPredictorInput,
  counterfactualLines,
  pairedPermutationPValue,
  randomHexagramLines,
  type AblationComparison,
  type AblationCondition,
  type AblationGroup,
  type AblationPerformance,
  type AblationPrediction,
  type AblationReport,
  type AblationRoundResult,
  type AblationSummary,
  type FrozenReplaySource,
} from "./ablation.js";
import { DeepSeekReplayPredictor } from "./deepseek-predictor.js";
import { deterministicRiskDecision, settlementDeltaUsdc6, wilson95 } from "./engine.js";

const DIVINER_KEYS = ["takashima", "wuxing", "meihua"] as const satisfies readonly DivinerKey[];
const CONDITIONS = ["actual", "none", "random", "counterfactual"] as const satisfies readonly AblationCondition[];
const LABELS: Record<AblationCondition, string> = {
  actual: "有真实卦象",
  none: "无卦象",
  random: "独立随机卦象",
  counterfactual: "同问题不同卦象",
};
const RANDOM_SEED = "yijing-ablation-independent-hexagram-v1";
const BRIER_SCALE = 100_000_000n;

export interface DeepSeekAblationOptions {
  source: FrozenReplaySource;
  predictor: DeepSeekReplayPredictor;
  generatedAt: string;
  chainId: number;
  providerConfigHash: Hex;
  permutationRuns?: number;
  onRoundComplete?: (completedRounds: number, totalRounds: number) => void | Promise<void>;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
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
    return selected ? Number(selected.brier) / Number(BRIER_SCALE) : round.meanBrier;
  });
  const differences = rounds.map((round, index) =>
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
      : pairedPermutationPValue(differences, permutationRuns, seed),
    wilson95: wilson95(correctCount, sampleCount),
  };
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

function exposedLines(condition: AblationCondition, source: FrozenReplaySource, roundIndex: number): readonly number[] | null {
  const round = source.rounds[roundIndex]!;
  if (condition === "none") return null;
  if (condition === "random") return randomHexagramLines(round.replayId);
  if (condition === "counterfactual") return counterfactualLines(round.hexagram.lines);
  return round.hexagram.lines;
}

export async function runDeepSeekAblationExperiment(options: DeepSeekAblationOptions): Promise<AblationReport> {
  if (options.source.sampleCount !== options.source.rounds.length || options.source.rounds.length === 0) {
    throw new Error("DeepSeek 消融的冻结来源样本数无效");
  }
  const permutationRuns = options.permutationRuns ?? 99_999;
  const performances = Object.fromEntries(CONDITIONS.map((condition) => [condition,
    Object.fromEntries(DIVINER_KEYS.map((key) => [key, {
      sampleCount: 0,
      correctCount: 0,
      totalBrier: 0n,
      bankrollUsdc6: 3_000_000n,
    }])) as Record<DivinerKey, AblationPerformance>,
  ])) as Record<AblationCondition, Record<DivinerKey, AblationPerformance>>;
  const roundGroups: Record<AblationCondition, AblationRoundResult[]> = {
    actual: [],
    none: [],
    random: [],
    counterfactual: [],
  };

  // 前置通道：先按顺序完成 actual 组。
  // actual 组的输出应当全部来自主回放日志的按请求哈希恢复；一旦哈希不一致，
  // 必须在为 none / random / counterfactual 三个对照组发出任何付费请求之前抛出。
  // 战绩状态需与主循环同步演进，否则后续轮次的请求哈希会与主循环不一致而无法恢复。
  const preflightPerformance = Object.fromEntries(DIVINER_KEYS.map((key) => [key, {
    sampleCount: 0,
    correctCount: 0,
    totalBrier: 0n,
    bankrollUsdc6: 3_000_000n,
  }])) as Record<DivinerKey, AblationPerformance>;

  for (const preflightRound of options.source.rounds) {
    for (const divinerKey of DIVINER_KEYS) {
      const prior = preflightPerformance[divinerKey]!;
      const output = await options.predictor.predictAblation("actual", buildAblationPredictorInput({
        condition: "actual",
        round: preflightRound,
        divinerKey,
        performance: prior,
      }));
      const direction = output.probabilityBps >= 5_000 ? "YES" as const : "NO" as const;
      const correct = (direction === "YES") === preflightRound.outcome;
      const distance = BigInt(preflightRound.outcome ? 10_000 - output.probabilityBps : output.probabilityBps);
      const risk = deterministicRiskDecision({
        bankrollUsdc6: prior.bankrollUsdc6,
        feeUsdc6: 50_000n,
        sampleCount: prior.sampleCount,
        totalBrier: prior.totalBrier,
        maxRiskBps: 1_000,
        mMin: 1,
        mMax: 3,
      });
      prior.bankrollUsdc6 += settlementDeltaUsdc6(50_000n, risk.multiplier, output.probabilityBps, preflightRound.outcome);
      prior.sampleCount += 1;
      if (correct) prior.correctCount += 1;
      prior.totalBrier += distance * distance;
    }
  }

  for (let roundIndex = 0; roundIndex < options.source.rounds.length; roundIndex += 1) {
    const round = options.source.rounds[roundIndex]!;
    const generated = await Promise.all(CONDITIONS.flatMap((condition) => DIVINER_KEYS.map(async (divinerKey) => {
      const prior = performances[condition][divinerKey];
      const input = buildAblationPredictorInput({ condition, round, divinerKey, performance: prior });
      const output = await options.predictor.predictAblation(condition, input);
      return { condition, divinerKey, prior, output };
    })));

    for (const condition of CONDITIONS) {
      const predictions = generated.filter((item) => item.condition === condition).map((item): AblationPrediction => {
        const { divinerKey, prior, output } = item;
        const direction = output.probabilityBps >= 5_000 ? "YES" as const : "NO" as const;
        const correct = (direction === "YES") === round.outcome;
        const distance = BigInt(round.outcome ? 10_000 - output.probabilityBps : output.probabilityBps);
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
        const delta = settlementDeltaUsdc6(50_000n, risk.multiplier, output.probabilityBps, round.outcome);
        const bankrollAfterUsdc6 = prior.bankrollUsdc6 + delta;
        prior.sampleCount += 1;
        if (correct) prior.correctCount += 1;
        prior.totalBrier += brier;
        prior.bankrollUsdc6 = bankrollAfterUsdc6;
        return {
          divinerKey,
          probabilityBps: output.probabilityBps,
          direction,
          correct,
          brier,
          multiplier: risk.multiplier,
          bankrollAfterUsdc6,
          reasoning: output.reasoning,
        };
      });
      roundGroups[condition].push({
        replayId: round.replayId,
        statement: round.proposition.statement,
        outcome: round.outcome,
        exposedHexagramLines: exposedLines(condition, options.source, roundIndex),
        predictions,
        meanBrier: mean(predictions.map((prediction) => Number(prediction.brier) / Number(BRIER_SCALE))),
        hitRate: predictions.filter((prediction) => prediction.correct).length / predictions.length,
      });
    }
    await options.onRoundComplete?.(roundIndex + 1, options.source.rounds.length);
  }

  const makeGroup = (condition: AblationCondition): AblationGroup => {
    const rounds = roundGroups[condition];
    const predictions = rounds.flatMap((round) => round.predictions);
    return {
      condition,
      label: LABELS[condition],
      roundCount: rounds.length,
      summary: summarize(predictions, rounds, permutationRuns, 600 + CONDITIONS.indexOf(condition)),
      byDiviner: Object.fromEntries(DIVINER_KEYS.map((key) => [
        key,
        summarize(predictions.filter((prediction) => prediction.divinerKey === key), rounds, permutationRuns, 700 + DIVINER_KEYS.indexOf(key)),
      ])) as Record<DivinerKey, AblationSummary>,
      rounds,
    };
  };
  const groups: Record<AblationCondition, AblationGroup> = {
    actual: makeGroup("actual"),
    none: makeGroup("none"),
    random: makeGroup("random"),
    counterfactual: makeGroup("counterfactual"),
  };

  const controls = ["none", "random", "counterfactual"] as const;
  const pending = controls.map((control, index) => {
    const brierDifferences = groups[control].rounds.map(
      (round, pairedIndex) => round.meanBrier - groups.actual.rounds[pairedIndex]!.meanBrier,
    );
    const hitDifferences = groups[control].rounds.map(
      (round, pairedIndex) => round.hitRate - groups.actual.rounds[pairedIndex]!.hitRate,
    );
    return {
      control,
      controlLabel: groups[control].label,
      brierDifference: mean(brierDifferences),
      brierRawPValue: pairedPermutationPValue(brierDifferences, permutationRuns, 101 + index),
      hitRateDifferencePercentagePoints: mean(hitDifferences) * 100,
      hitRateRawPValue: pairedPermutationPValue(hitDifferences, permutationRuns, 201 + index),
    };
  });
  const brierAdjusted = holmAdjust(pending.map((item) => item.brierRawPValue));
  const hitAdjusted = holmAdjust(pending.map((item) => item.hitRateRawPValue));
  const comparisons: AblationComparison[] = pending.map((item, index) => ({
    ...item,
    brierHolmPValue: brierAdjusted[index]!,
    hitRateHolmPValue: hitAdjusted[index]!,
    significantAtFivePercent: brierAdjusted[index]! < 0.05 || hitAdjusted[index]! < 0.05,
  }));

  const actualPredictions = groups.actual.rounds.flatMap((round) => round.predictions);
  const counterfactualPredictions = groups.counterfactual.rounds.flatMap((round) => round.predictions);
  const probabilityDifferences = counterfactualPredictions.map(
    (prediction, index) => prediction.probabilityBps - actualPredictions[index]!.probabilityBps,
  );
  const directionFlipCount = counterfactualPredictions.filter(
    (prediction, index) => prediction.direction !== actualPredictions[index]!.direction,
  ).length;
  const roundProbabilityDifferences = groups.counterfactual.rounds.map((round, roundIndex) => mean(
    round.predictions.map((prediction, predictionIndex) =>
      prediction.probabilityBps - groups.actual.rounds[roundIndex]!.predictions[predictionIndex]!.probabilityBps),
  ));
  const actualBetterThanBoth = comparisons
    .filter((comparison) => comparison.control === "none" || comparison.control === "random")
    .every((comparison) => comparison.brierDifference > 0 && comparison.brierHolmPValue < 0.05);

  return {
    schemaVersion: "1.0",
    generatedAt: options.generatedAt,
    network: { name: "Arc Testnet", chainId: options.chainId },
    provider: { kind: "deepseek", modelId: "deepseek-v4-flash", providerConfigHash: options.providerConfigHash },
    sourceReport: options.source.sourceReport,
    design: {
      pairedRounds: options.source.rounds.length,
      predictionsPerGroup: options.source.rounds.length * DIVINER_KEYS.length,
      permutationRuns,
      randomHexagramSeed: RANDOM_SEED,
    },
    groups,
    comparisons,
    pairedHexagramSensitivity: {
      pairCount: probabilityDifferences.length,
      changedProbabilityCount: probabilityDifferences.filter((difference) => difference !== 0).length,
      changedProbabilityRateBps: Math.round(probabilityDifferences.filter((difference) => difference !== 0).length * 10_000 / probabilityDifferences.length),
      meanAbsoluteProbabilityChangeBps: mean(probabilityDifferences.map(Math.abs)),
      signedMeanProbabilityChangeBps: mean(probabilityDifferences),
      directionFlipCount,
      directionFlipRateBps: Math.round(directionFlipCount * 10_000 / probabilityDifferences.length),
      directionalShiftPValue: pairedPermutationPValue(roundProbabilityDifferences, permutationRuns, 301),
    },
    conclusion: actualBetterThanBoth
      ? "DeepSeek 回放中，有真实卦象组相对无卦象与随机卦象均显示经 Holm 校正后的较低 Brier；这批数据出现预测增量，但仍受单一链、单一命题族和同一模型限制。"
      : "DeepSeek 回放中，没有观察到有真实卦象组相对无卦象与随机卦象同时具备经 Holm 校正后的稳定预测增量。",
    limitations: [
      "这是同一冻结历史窗口上的 backtested 实验，不是现场预测；未来结算事实仅在每轮生成完成后进入评分。",
      "actual 组直接复用主回放的首个合法输出；其余三组只改变卦象暴露，所有任务均按请求哈希断点恢复，不进行合法结果择优。",
      "研究只覆盖 Arc Testnet 的 USDC 总量单一命题族、一个模型版本和三种固定角色提示，不能外推为易经的一般预测能力。",
      `Wilson 区间按 ${options.source.rounds.length * 3} 条预测计算，但三位易者共享轮次 outcome；显著性检验以 ${options.source.rounds.length} 个轮次为配对聚类单位。`,
      "多重比较只对三个预先计划的 actual-vs-control 比较分别在 Brier 与命中率族内作 Holm 校正。",
    ],
  };
}
