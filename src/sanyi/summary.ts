// src/sanyi/summary.ts
// 白话总述：三家落笔之后，用普通人能懂的现代汉语把三家的结论合起来讲清楚（设计文档 21.3）。
import {
  StructuredOutputError, validateStructuredOutput, type StructuredOutputProvider,
} from "../agent/provider.js";
import type { JsonSchema } from "../agent/schemas.js";
import { splitSentences } from "./repair.js";
import { schemaHints } from "./schema-hints.js";
import type { SummaryState } from "./store.js";

export type SummaryTone = "顺" | "中" | "不顺";
export type SummaryKind = "question" | "fortune" | "destiny";

export interface PlainSummary {
  /** 与合议一致的倾向；命理不写。 */
  tone?: SummaryTone;
  conclusion: string;
  agreement: string;
  difference?: string;
  explanation: string[];
  advice: string[];
  watch?: { window: string; condition: string };
  /** 运势的十年走势一句话；问事与命理不写。 */
  outlook?: string;
}

export interface SummarySchool {
  name: string;
  school: string;
  verdict?: string;
  confidenceTenths?: number;
  useGod?: string;
  headline: string;
  reason: string;
  sections: ReadonlyArray<{ title: string; text: string }>;
  advice: readonly string[];
  timing?: { window: string; condition: string };
}

export interface SummaryInput {
  kind: SummaryKind;
  question: string;
  /** 运势的所问范围，如「今年（2026 丙午）」。 */
  horizonLabel?: string;
  /** 已落笔各家把握的平均；命理为 null。 */
  consensus: number | null;
  /** 盘面要点，供总述引用；只写服务端排出的事实。 */
  chartPoints: readonly string[];
  /** 运势的逐年合议一行，如「2023 4.7成 · 2024 4.3成 …」。 */
  yearConsensus?: string;
  schools: readonly SummarySchool[];
  /** 正文盘面核对：返回中文错误；问事与八字各用自己的核对器。 */
  proseErrors(text: string): string[];
}

export const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["conclusion", "agreement", "explanation", "advice"],
  properties: {
    tone: { type: "string", enum: ["顺", "中", "不顺"] },
    conclusion: { type: "string", minLength: 1, maxLength: 40 },
    agreement: { type: "string", minLength: 1, maxLength: 150 },
    difference: { type: "string", minLength: 1, maxLength: 150 },
    explanation: {
      type: "array", minItems: 2, maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 200 },
    },
    advice: {
      type: "array", minItems: 2, maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 60 },
    },
    watch: {
      type: "object",
      additionalProperties: false,
      required: ["window", "condition"],
      properties: {
        window: { type: "string", minLength: 1, maxLength: 60 },
        condition: { type: "string", minLength: 1, maxLength: 80 },
      },
    },
    outlook: { type: "string", minLength: 1, maxLength: 80 },
  },
} as const satisfies JsonSchema;

export const SUMMARY_SYSTEM_PROMPT = `你是「三易」的白话总述执笔人，不是三家中的任何一家。
你的任务：把三家对同一问题的断语合起来，用普通人能读懂的现代汉语讲清楚，直接回答所问。
- 只依据下方三家断语与盘面要点，不得新增三家都没说过的结论，不得写出盘面中不存在的干支、卦名、十神或关系。
- 术语第一次出现时用括号给白话解释，按所问类型选对含义：问事里「用神（代表所问之事的那一爻）」；命理、运势里「用神（对命局最有帮助的五行）」「大运（每十年一换的运程）」。
- conclusion 一句话直接回答所问，不超过 40 字；tone 必须与「合议倾向」一致，结论的语气也要与之一致。
- agreement 写三家一致之处；difference 写三家分歧之处，三家都一致时省略。
- explanation 写 2 至 4 段，每段讲一个原因；advice 写 2 至 4 条具体可执行的建议。
- 需要留意的时间写入 watch，必须写明成立条件；没有就省略。
- 运势必须写 outlook，用一句话概括十年走势；命理不写 tone 和 outlook，也不评吉凶。
- 不做医疗、法律、投资结论；涉及健康时建议就医。
- 自称只说「三易」，语气平实，不渲染恐惧，也不打包票。
输出必须严格符合给定 JSON Schema。`;

const KIND_LABELS: Record<SummaryKind, string> = { question: "问事", fortune: "运势", destiny: "命理" };

/** 合议倾向：六成以上偏顺，四成以下偏不顺，其余为中。 */
export function expectedTone(consensus: number): SummaryTone {
  if (consensus >= 6) {
    return "顺";
  }
  if (consensus <= 4) {
    return "不顺";
  }
  return "中";
}

function toneConclusion(consensus: number): string {
  const tone = expectedTone(consensus);
  const value = consensus.toFixed(1);
  if (tone === "顺") {
    return `合议约${value}成，整体偏顺。`;
  }
  if (tone === "不顺") {
    return `合议约${value}成，整体偏不顺，宜审慎。`;
  }
  return `合议约${value}成，成败参半，尚无定数。`;
}

function schoolBlock(item: SummarySchool): string {
  const lines = [`【${item.name} · ${item.school}】`];
  if (item.verdict && item.confidenceTenths !== undefined) {
    lines.push(`吉凶：${item.verdict}，约${item.confidenceTenths}成`);
  }
  if (item.useGod) {
    lines.push(`用神：${item.useGod}`);
  }
  lines.push(`直断：${item.headline}`, `理由：${item.reason}`);
  for (const section of item.sections) {
    lines.push(`${section.title}：${section.text}`);
  }
  if (item.timing) {
    lines.push(`应期：${item.timing.window}（条件：${item.timing.condition}）`);
  }
  lines.push(`建议：${item.advice.join("；")}`);
  return lines.join("\n");
}

export function buildSummaryPrompt(input: SummaryInput): string {
  const lines = [`问题：${input.question}`, `类型：${KIND_LABELS[input.kind]}`];
  if (input.horizonLabel) {
    lines.push(`所问范围：${input.horizonLabel}`);
  }
  lines.push(`依据 ${input.schools.length} 家断语`);
  if (input.consensus !== null) {
    lines.push(`合议：约${input.consensus.toFixed(1)}成`, `合议倾向：${expectedTone(input.consensus)}`);
  }
  if (input.yearConsensus) {
    lines.push(`逐年合议：${input.yearConsensus}`);
  }
  lines.push("盘面要点：", ...input.chartPoints.map((point) => `- ${point}`), "三家断语：");
  lines.push(...input.schools.map(schoolBlock));
  return lines.join("\n");
}

function summaryTexts(output: PlainSummary): string[] {
  const texts = [output.conclusion, output.agreement, ...output.explanation, ...output.advice];
  if (output.difference) {
    texts.push(output.difference);
  }
  if (output.watch) {
    texts.push(output.watch.window, output.watch.condition);
  }
  if (output.outlook) {
    texts.push(output.outlook);
  }
  return texts;
}

/** 总述的业务核对：倾向与合议一致、命理与运势的字段要求、正文不得编造盘面。 */
export function checkSummary(output: PlainSummary, input: SummaryInput): string[] {
  const errors: string[] = [];
  if (input.kind === "destiny") {
    if (output.tone !== undefined || output.outlook !== undefined) {
      errors.push("命理不写倾向（tone）与十年走势（outlook）");
    }
  } else if (input.consensus !== null) {
    const tone = expectedTone(input.consensus);
    if (output.tone !== tone) {
      errors.push(`倾向须与合议一致：合议约${input.consensus.toFixed(1)}成，tone 应为「${tone}」`);
    }
  }
  if (input.kind === "fortune" && !output.outlook) {
    errors.push("运势须写 outlook，用一句话概括十年走势");
  }
  if (input.kind !== "fortune" && output.outlook !== undefined && input.kind !== "destiny") {
    errors.push("只有运势写十年走势（outlook）");
  }
  errors.push(...input.proseErrors(summaryTexts(output).join("\n")));
  return errors;
}

export interface SummaryRepair {
  output: PlainSummary;
  removed: number;
  adjusted: number;
}

/** 总述删错留对：删去编造盘面的句子；倾向不符时改为合议倾向，并以模板结论代替。 */
export function repairSummary(output: PlainSummary, input: SummaryInput): SummaryRepair {
  let removed = 0;
  let adjusted = 0;
  const keep = (text: string): string => {
    const kept = splitSentences(text).filter((sentence) => {
      if (input.proseErrors(sentence).length === 0) {
        return true;
      }
      removed += 1;
      return false;
    });
    return kept.join("").trim();
  };
  const explanation = output.explanation.map(keep).filter((text) => text !== "");
  const advice = output.advice.map(keep).filter((text) => text !== "");
  const repaired: PlainSummary = {
    conclusion: keep(output.conclusion),
    agreement: keep(output.agreement) || "三家的具体说法见下方依据。",
    explanation: explanation.length > 0 ? explanation : ["与盘面不符的解释已删去，详见三家依据。"],
    advice: advice.length > 0 ? advice : ["结合实际情况审慎行事。"],
  };
  const difference = output.difference ? keep(output.difference) : "";
  if (difference) {
    repaired.difference = difference;
  }
  if (output.watch) {
    const window = keep(output.watch.window);
    const condition = keep(output.watch.condition);
    if (window && condition) {
      repaired.watch = { window, condition };
    }
  }
  if (input.kind === "fortune") {
    repaired.outlook = (output.outlook ? keep(output.outlook) : "") || "十年走势见下方流年运势。";
  }
  if (input.kind !== "destiny" && input.consensus !== null) {
    const tone = expectedTone(input.consensus);
    repaired.tone = tone;
    if (output.tone !== tone || !repaired.conclusion) {
      adjusted += 1;
      repaired.conclusion = toneConclusion(input.consensus);
    }
  }
  if (!repaired.conclusion) {
    repaired.conclusion = "三家看法见下方依据。";
  }
  return { output: repaired, removed, adjusted };
}

const MAX_CALLS = 3;

export type SummaryRunResult =
  | { status: "done"; output: PlainSummary; calls: number; removed: number; adjusted: number }
  | { status: "failed"; error: string; calls: number };

/** 总述运行器：最多三次调用（首次加两次带错误说明的重写），仍不符则删错留对。 */
export async function runSummary(
  deps: { provider: StructuredOutputProvider },
  input: SummaryInput,
): Promise<SummaryRunResult> {
  const basePrompt = buildSummaryPrompt(input);
  let userPrompt = basePrompt;
  let calls = 0;
  let lastValid: PlainSummary | undefined;
  for (let pass = 0; pass < MAX_CALLS; pass += 1) {
    let errors: string[];
    calls += 1;
    try {
      const raw = await deps.provider.generateStructured<unknown>({
        taskId: `sanyi/summary/${input.kind}`,
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        cacheSystemPrompt: true,
        userPrompt,
        schema: SUMMARY_SCHEMA,
        effort: "medium",
      });
      const output = validateStructuredOutput<PlainSummary>(SUMMARY_SCHEMA, raw);
      lastValid = output;
      errors = checkSummary(output, input);
      if (errors.length === 0) {
        return { status: "done", output, calls, removed: 0, adjusted: 0 };
      }
    } catch (error) {
      if (!(error instanceof StructuredOutputError)) {
        return { status: "failed", error: "白话总述暂未生成，请稍后重试", calls };
      }
      errors = schemaHints(error);
    }
    userPrompt = [basePrompt, "", "上一次输出未通过核对，请修正后完整重写：",
      ...errors.map((error) => `- ${error}`)].join("\n");
  }
  if (lastValid) {
    const repaired = repairSummary(lastValid, input);
    return {
      status: "done", output: repaired.output, calls,
      removed: repaired.removed, adjusted: repaired.adjusted,
    };
  }
  return { status: "failed", error: "白话总述三次都不符合输出格式，请稍后重试", calls };
}

/** 由运行结果生成存档里的总述状态；重试计数按需保留。 */
export function summaryState(
  previous: { attempts: number; retries: number } | undefined,
  result: SummaryRunResult,
  basis: number,
  preserveRetries: boolean,
): SummaryState {
  const attempts = (previous?.attempts ?? 0) + result.calls;
  const retries = preserveRetries ? previous?.retries ?? 0 : 0;
  if (result.status === "failed") {
    return { status: "failed", basis, attempts, retries, error: result.error };
  }
  const state: SummaryState = { status: "done", output: result.output, basis, attempts, retries };
  if (result.removed > 0) {
    state.removed = result.removed;
  }
  if (result.adjusted > 0) {
    state.adjusted = result.adjusted;
  }
  return state;
}

/** 运行总述；模型调用偶发失败时自动再试一次。 */
export async function runSummaryWithRetry(
  deps: { provider: StructuredOutputProvider },
  input: SummaryInput,
): Promise<SummaryRunResult> {
  const first = await runSummary(deps, input);
  if (first.status !== "failed") {
    return first;
  }
  const again = await runSummary(deps, input);
  return { ...again, calls: again.calls + first.calls };
}

/** 已落笔各家把握的平均；命理或没有把握时为 null。 */
export function averageConfidence(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
