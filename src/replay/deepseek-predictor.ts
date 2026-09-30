import { DIVINER_SYSTEM_PROMPTS, type DivinerKey } from "../agent/diviners.js";
import { PREDICTION_OUTPUT_SCHEMA, type DivinerOutput } from "../agent/schemas.js";
import { getHexagramText, type ZhouyiHexagramText } from "../agent/zhouyi-corpus.js";
import type { AblationCondition, AblationPredictorInput } from "./ablation.js";
import type { ReplayPredictionInput, ReplayPredictionOutput, ReplayPredictor } from "./engine.js";
import { ResumableStructuredGenerator } from "./generation-journal.js";

// v3 把截止块前的难度校准证据写入提示；旧版本审计保留但不得混入本次实验。
const EXPERIMENT_VERSION = "deepseek-replay-v3";
const BRIER_SCALE = 100_000_000;
const KING_WEN = Buffer.from(
  "021807130f242e0b103328363e37202208031d3c273f30052d112f3a1f311c2b171b04293416121a23154026381e320e142a3b3d352539090c19060a210d2c01",
  "hex",
);

interface PromptPerformance {
  sampleCount: number;
  correctCount: number;
  totalBrier: bigint;
  bankrollUsdc6: bigint;
}

interface PromptProposition {
  statement: string;
  cutoffBlock: bigint;
  resolutionBlock: bigint;
  threshold: bigint;
  calibration?: {
    suitable: true;
    thresholdDelta: bigint;
    sampleCount: number;
    yesCount: number;
    empiricalBaseRateBps: number;
    historyStartBlock: bigint;
    historyEndBlock: bigint;
    horizonBlocks: bigint;
  };
}

interface PromptInput {
  replayId: number;
  divinerKey: DivinerKey;
  proposition: Readonly<PromptProposition>;
  performance: Readonly<PromptPerformance>;
  lines?: readonly number[];
}

function hexagramNumbers(lines: readonly number[]): {
  primaryKingWenNumber: number;
  derivedKingWenNumber: number;
  changingLinePositions: readonly number[];
} {
  if (lines.length !== 6 || lines.some((line) => ![6, 7, 8, 9].includes(line))) {
    throw new Error("回放卦象必须恰有六个 6/7/8/9 数值");
  }
  let primaryIndex = 0;
  let derivedIndex = 0;
  const changingLinePositions: number[] = [];
  lines.forEach((line, index) => {
    const primaryYang = line === 7 || line === 9;
    const moving = line === 6 || line === 9;
    if (primaryYang) primaryIndex |= 1 << index;
    if (primaryYang !== moving) derivedIndex |= 1 << index;
    if (moving) changingLinePositions.push(index + 1);
  });
  return {
    primaryKingWenNumber: KING_WEN[primaryIndex]!,
    derivedKingWenNumber: KING_WEN[derivedIndex]!,
    changingLinePositions,
  };
}

function renderHexagram(title: string, hexagram: ZhouyiHexagramText): string {
  return [
    `${title}：${hexagram.kingWenNumber} ${hexagram.name}`,
    `卦辞：${hexagram.judgement}`,
    "爻辞：",
    ...hexagram.lines.map((line, index) => `${index + 1}. ${line.label}：${line.text}`),
    ...(hexagram.extras.length > 0
      ? [`特殊用辞：${hexagram.extras.map((line) => `${line.label}：${line.text}`).join("；")}`]
      : []),
  ].join("\n");
}

export function buildReplayPredictionPrompt(input: PromptInput): string {
  const averageBrier = input.performance.sampleCount === 0
    ? 0
    : Number(input.performance.totalBrier) / input.performance.sampleCount / BRIER_SCALE;
  const sections = [
    `固定命题：${input.proposition.statement}`,
    `截止块：${input.proposition.cutoffBlock}`,
    `结算块：${input.proposition.resolutionBlock}`,
    `截止时已知阈值：${input.proposition.threshold}`,
    ...(input.proposition.calibration
      ? [
          `难度校准（窗口严格早于截止块）：历史回测基础概率=${(input.proposition.calibration.empiricalBaseRateBps / 100).toFixed(2)}%；样本=${input.proposition.calibration.sampleCount}（YES=${input.proposition.calibration.yesCount}）；历史窗口=${input.proposition.calibration.historyStartBlock}–${input.proposition.calibration.historyEndBlock}；固定跨度=${input.proposition.calibration.horizonBlocks} 块；阈值增量=${input.proposition.calibration.thresholdDelta}`,
        ]
      : []),
    "历史表现（只含本轮之前的 backtested 记录）：",
    `样本数=${input.performance.sampleCount}；正确数=${input.performance.correctCount}；平均 Brier=${averageBrier.toFixed(6)}；bankroll=${input.performance.bankrollUsdc6}`,
  ];
  if (input.lines) {
    const numbers = hexagramNumbers(input.lines);
    sections.push(
      `六爻（自初爻至上爻）：${input.lines.join("、")}`,
      `变爻位置：${numbers.changingLinePositions.length > 0 ? numbers.changingLinePositions.join("、") : "无"}`,
      renderHexagram("本卦", getHexagramText(numbers.primaryKingWenNumber)),
      renderHexagram("之卦", getHexagramText(numbers.derivedKingWenNumber)),
    );
  }
  return sections.join("\n\n");
}

function validateDirection(output: DivinerOutput): void {
  if (
    (output.probabilityBps > 5_000 && output.direction !== "YES")
    || (output.probabilityBps < 5_000 && output.direction !== "NO")
  ) {
    throw new Error("回放输出的方向与概率不一致；该合法 JSON 已记录，不得重生成择优");
  }
}

export class DeepSeekReplayPredictor implements ReplayPredictor {
  readonly modelId = "deepseek-v4-flash";

  constructor(private readonly generator: ResumableStructuredGenerator) {}

  async predict(input: ReplayPredictionInput): Promise<ReplayPredictionOutput> {
    return this.generate("actual", {
      replayId: input.roundIndex + 1,
      divinerKey: input.divinerKey,
      proposition: input.proposition,
      performance: input.performance,
      lines: input.hexagram.lines,
    });
  }

  async predictAblation(condition: AblationCondition, input: AblationPredictorInput): Promise<ReplayPredictionOutput> {
    return this.generate(condition, {
      replayId: input.roundIndex + 1,
      divinerKey: input.divinerKey,
      proposition: input.proposition,
      performance: input.performance,
      ...(input.hexagram ? { lines: input.hexagram.lines } : {}),
    });
  }

  private async generate(condition: AblationCondition, input: PromptInput): Promise<ReplayPredictionOutput> {
    const output = await this.generator.generate<DivinerOutput>(
      `${EXPERIMENT_VERSION}/${condition}/${input.replayId}/${input.divinerKey}`,
      {
        taskId: `replay/${input.divinerKey}`,
        systemPrompt: DIVINER_SYSTEM_PROMPTS[input.divinerKey],
        cacheSystemPrompt: true,
        userPrompt: buildReplayPredictionPrompt(input),
        schema: PREDICTION_OUTPUT_SCHEMA,
        effort: "high",
      },
    );
    validateDirection(output);
    return { probabilityBps: output.probabilityBps, reasoning: output.reasoning };
  }
}
