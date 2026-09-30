export interface OutcomeBaseline {
  sampleCount: number;
  yesCount: number;
  empiricalBaseRate: number;
  empiricalBaseRateBps: number;
  constantBaselineBrier: number;
}

export interface BrierSkillSummary extends OutcomeBaseline {
  brierSkillScore: number | null;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeOutcomeBaseline(outcomes: readonly boolean[]): OutcomeBaseline {
  if (outcomes.length === 0) throw new Error("基础概率至少需要一个已决结果");
  const yesCount = outcomes.filter(Boolean).length;
  const empiricalBaseRate = yesCount / outcomes.length;
  return {
    sampleCount: outcomes.length,
    yesCount,
    empiricalBaseRate,
    empiricalBaseRateBps: Math.round(empiricalBaseRate * 10_000),
    constantBaselineBrier: empiricalBaseRate * (1 - empiricalBaseRate),
  };
}

/** BSS = 1 - 模型平均 Brier / 经验基础概率常数预测的平均 Brier。 */
export function summarizeBrierSkill(outcomes: readonly boolean[], averageBrier: number): BrierSkillSummary {
  if (!Number.isFinite(averageBrier) || averageBrier < 0) throw new Error("平均 Brier 必须是非负有限数");
  const baseline = summarizeOutcomeBaseline(outcomes);
  return {
    ...baseline,
    brierSkillScore: baseline.constantBaselineBrier === 0
      ? null
      : 1 - averageBrier / baseline.constantBaselineBrier,
  };
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

export function constantPredictionLoss(outcome: boolean, empiricalBaseRate: number): number {
  const observed = outcome ? 1 : 0;
  return (empiricalBaseRate - observed) ** 2;
}
