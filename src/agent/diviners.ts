import type { Hex } from "viem";

import { PREDICTION_OUTPUT_SCHEMA, type DivinerOutput } from "./schemas.js";
import type { ProviderAttemptAudit, StructuredOutputProvider } from "./provider.js";
import { getHexagramText, type ZhouyiHexagramText } from "./zhouyi-corpus.js";

export type DivinerKey = "takashima" | "wuxing" | "meihua";

const COMMON_CONTRACT = `你是“身銭を切る易者”系统中的一位易者。命题已经由独立、中立的 PropositionCompiler 固定；你不得选择、替换或改写命题，也不得输出任何新命题字段。你只能依据给定的实验输入与自己的历史战绩，估计该固定命题为真的概率；若输入未提供卦象，不得猜测、补造或反推卦象。probabilityBps 表示 YES 概率，必须在 100 至 9900 基点之间；大于 5000 时 direction 必须为 YES，小于 5000 时必须为 NO。只输出方向、概率与解卦理由，reasoning 不超过 100 个汉字。不得决定身銭倍率或押注金额，它们只能由合约计算。明确把解卦视为主观解释，不声称可验证推理。`;

export const DIVINER_SYSTEM_PROMPTS: Readonly<Record<DivinerKey, string>> = {
  takashima: `${COMMON_CONTRACT}\n\n你遵循高島易断的实务取向：沉稳、重时势、重可观察事实与行动后果。解释应克制，先看本卦所处局面，再看动爻与之卦如何改变局面；概率应体现历史战绩带来的校准，不以气势代替证据。`,
  wuxing: `${COMMON_CONTRACT}\n\n你遵循五行易（断易）的技术取向：机械、精确、重爻位、动静与生克关系。当前输入没有月建日辰、纳甲、六亲和世应时；若提供卦象，只能使用所给爻位、阴阳动静、卦辞与爻辞；若未提供则仅按历史表现校准，禁止虚构排盘数据。`,
  meihua: `${COMMON_CONTRACT}\n\n你遵循梅花心易的取象取向：敏锐、直觉、敢于形成方向判断，重本卦到之卦的整体转折与问题语境之间的外应。激进只允许体现在解读与概率，不得越过固定命题、概率边界或链上规则。`,
};

export interface FrozenProposition {
  predicateId: Hex;
  params: Hex;
  deadlineBlock: bigint;
  statement: string;
}

export interface DivinerHistoryEntry {
  probabilityBps: number;
  outcome: boolean | null;
  brier: number;
  unresolved: boolean;
}

export interface DivinerHistory {
  sampleCount: number;
  correctCount: number;
  unresolvedCount: number;
  averageBrier: number;
  recent: readonly DivinerHistoryEntry[];
}

export interface DivinerInput {
  question: string;
  hexagram: {
    lines: readonly number[];
    primaryKingWenNumber: number;
    derivedKingWenNumber: number;
    changingLinePositions: readonly number[];
  };
  proposition: FrozenProposition;
  history: DivinerHistory;
}

function renderText(title: string, entry: ZhouyiHexagramText): string {
  const lines = entry.lines.map((line, index) => `${index + 1}. ${line.label}：${line.text}`).join("\n");
  const extras = entry.extras.length > 0
    ? `\n特殊用辞：${entry.extras.map((line) => `${line.label}：${line.text}`).join("；")}`
    : "";
  return `${title}：${entry.kingWenNumber} ${entry.name}\n卦辞：${entry.judgement}\n爻辞：\n${lines}${extras}`;
}

export function buildDivinerUserPrompt(input: DivinerInput): string {
  if (input.hexagram.lines.length !== 6) throw new Error("卦象必须恰有六爻");
  const primary = getHexagramText(input.hexagram.primaryKingWenNumber);
  const derived = getHexagramText(input.hexagram.derivedKingWenNumber);
  const recent = input.history.recent.length === 0
    ? "无"
    : input.history.recent.map((entry, index) =>
      `${index + 1}. YES概率=${entry.probabilityBps}，结果=${entry.outcome === null ? "未决" : entry.outcome ? "YES" : "NO"}，Brier=${entry.brier}，未决=${entry.unresolved ? "是" : "否"}`
    ).join("\n");

  return [
    `提问：${input.question}`,
    `六爻（自初爻至上爻）：${input.hexagram.lines.join("、")}`,
    `变爻位置：${input.hexagram.changingLinePositions.length > 0 ? input.hexagram.changingLinePositions.join("、") : "无"}`,
    renderText("本卦", primary),
    renderText("之卦", derived),
    "固定命题（只读）：",
    `- predicateId：${input.proposition.predicateId}`,
    `- params：${input.proposition.params}`,
    `- deadlineBlock：${input.proposition.deadlineBlock}`,
    `- 明文：${input.proposition.statement}`,
    "你的历史战绩（用于自我校准）：",
    `- 样本数：${input.history.sampleCount}`,
    `- 正确数：${input.history.correctCount}`,
    `- 未决数：${input.history.unresolvedCount}`,
    `- 平均 Brier：${input.history.averageBrier}`,
    `- 最近记录：\n${recent}`,
  ].join("\n\n");
}

export async function interpretWithDiviner(
  provider: StructuredOutputProvider,
  key: DivinerKey,
  input: DivinerInput,
  recordAttempt?: (attempt: ProviderAttemptAudit) => Promise<void>,
): Promise<DivinerOutput> {
  const output = await provider.generateStructured<DivinerOutput>({
    taskId: `diviner/${key}`,
    systemPrompt: DIVINER_SYSTEM_PROMPTS[key],
    cacheSystemPrompt: true,
    userPrompt: buildDivinerUserPrompt(input),
    schema: PREDICTION_OUTPUT_SCHEMA,
    effort: "high",
    ...(recordAttempt ? { recordAttempt } : {}),
  });
  if (
    (output.probabilityBps > 5_000 && output.direction !== "YES")
    || (output.probabilityBps < 5_000 && output.direction !== "NO")
  ) {
    throw new Error("易者输出的方向与概率不一致，本轮不得提交且不会自动重跑");
  }
  return output;
}
