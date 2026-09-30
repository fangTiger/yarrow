import type { DivinerKey } from "../agent/diviners.js";
import type { ReplayRun } from "./engine.js";

export interface ReplayReportMetadata {
  generatedAt: string;
  chainId: number;
}

const DIVINER_NAMES: Readonly<Record<DivinerKey, string>> = {
  takashima: "高島易断",
  wuxing: "五行易（断易）",
  meihua: "梅花心易",
};

function percent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

function usdc6(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 1_000_000n;
  const fraction = (absolute % 1_000_000n).toString().padStart(6, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function isoTimestamp(value: bigint): string {
  return new Date(Number(value) * 1_000).toISOString();
}

function metric(value: number | null): string {
  return value === null ? "不可定义" : value.toFixed(6);
}

function pValue(value: number | null): string {
  if (value === null) return "不可定义";
  return value < 0.0001 ? "<0.0001" : value.toFixed(4);
}

/** 顶层与逐轮均保留 backtested，bigint 使用十进制字符串避免精度丢失。 */
export function serializeReplayRun(run: ReplayRun, metadata: ReplayReportMetadata): string {
  return `${JSON.stringify({
    schemaVersion: "1.0",
    generatedAt: metadata.generatedAt,
    network: { name: "Arc Testnet", chainId: metadata.chainId },
    ...run,
    disclosure: {
      historyType: "非现场历史",
      claim: "本回放只验证机制在运转，不能证明易经有预测力。",
    },
  }, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value, 2)}\n`;
}

export function renderReplayReport(run: ReplayRun, metadata: ReplayReportMetadata): string {
  const summaryRows = (Object.keys(run.summaries) as DivinerKey[]).map((key) => {
    const summary = run.summaries[key];
    const winRate = summary.sampleCount === 0 ? 0 : summary.correctCount * 10_000 / summary.sampleCount;
    return `| ${DIVINER_NAMES[key]} | ${summary.sampleCount} | ${summary.correctCount} | ${percent(winRate)} | ${summary.averageBrier.toFixed(6)} | ${metric(summary.brierSkillScore)} | ${pValue(summary.brierVsConstantPValue)} | ${percent(summary.wilson95.lowerBps)}–${percent(summary.wilson95.upperBps)} | ${usdc6(summary.finalBankrollUsdc6)} |`;
  });
  const roundRows = run.rounds.map((round) => {
    const predictions = round.predictions.map((prediction) =>
      `${DIVINER_NAMES[prediction.divinerKey]} ${percent(prediction.probabilityBps)} / Brier ${(Number(prediction.brier) / 100_000_000).toFixed(4)} / Δ ${usdc6(prediction.settlementDeltaUsdc6)}`,
    ).join("<br>");
    return `| ${round.replayId} | backtested | ${round.cutoff.blockNumber} / ${isoTimestamp(round.cutoff.timestamp)} | ${round.resolution.blockNumber} / ${isoTimestamp(round.resolution.timestamp)} | ${round.outcome ? "YES" : "NO"} | ${round.hexagram.primaryKingWenNumber}→${round.hexagram.derivedKingWenNumber} | ${predictions} |`;
  });
  return [
    "# Arc Walk-Forward 回放报告",
    "",
    `- 生成时间：${metadata.generatedAt}`,
    `- 网络：Arc Testnet（Chain ID ${metadata.chainId}）`,
    `- 数据性质：\`backtested\`，共 ${run.sampleCount} 回合`,
    `- 候选截止点：${run.candidateCount}；因不满足既定难度范围跳过：${run.skippedCandidateCount}`,
    `- Provider：${run.modelId}${run.modelId.includes("mock") ? "（确定性 mock）" : "（真实推理 API）"}`,
    "- 诚实声明：这是非现场历史，不得冒充现场预测记录；本回放只验证机制在运转，不能证明易经有预测力。",
    "",
    "## 汇总",
    "",
    `- 实际基础概率（YES 占比）：${run.outcomeBaseline.yesCount}/${run.outcomeBaseline.sampleCount} = ${percent(run.outcomeBaseline.empiricalBaseRateBps)}`,
    `- 经验基础概率常数预测参照 Brier：${run.outcomeBaseline.constantBaselineBrier.toFixed(6)}；它取代 0.25 作为本批次 BSS 的参照，因为 0.25 只代表永远报 50%。`,
    "- 警告：极端基础概率下，命中率会被多数类机械抬高，是误导性指标；应结合原始 Brier、BSS 与样本量判断。",
    "",
    "| 易者 | 样本量 n | 命中 | 胜率 | 平均 Brier | BSS | Brier vs 常数检验 p | Wilson 95% | 最终 bankroll（USDC） |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...summaryRows,
    "",
    "## 逐轮证据",
    "",
    "| # | 标记 | 截止块 / 真实时间 | 结算块 / 真实时间 | 结果 | 本卦→之卦 | 三家预测 / Brier / bankroll 变化 |",
    "|---:|---|---|---|---|---:|---|",
    ...roundRows,
    "",
    "## 方法边界",
    "",
    "预测输入仅含截止块及其之前的链上状态；未来结算块在三位易者均完成预测后才读取。候选截止点的跳过判定只使用对应截止块之前的历史，不读取该候选结果。bankroll 的倍率、预留和结算变化全部由确定性代码执行，推理 provider 无权决定下注额。",
    "",
  ].join("\n");
}
