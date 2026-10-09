import {
  StructuredOutputError,
  validateStructuredOutput,
  type StructuredOutputProvider,
} from "../../agent/provider.js";
import {
  auditFamily,
  auditNamingSummary,
  normalizeFamilyOutput,
  repairFamily,
  repairNamingSummary,
} from "./audit.js";
import { NAMING_FAMILIES } from "./families.js";
import {
  NAMING_FAMILY_SCHEMA,
  NAMING_SUMMARY_SCHEMA,
  type NamingContext,
  type NamingFamilyKey,
  type NamingFamilyOutput,
  type NamingSummaryOutput,
} from "./schema.js";
import { schemaHints } from "../schema-hints.js";

const MAX_CALLS = 3;

export type NamingFamily = (typeof NAMING_FAMILIES)[number];

export type NamingFamilyRunResult =
  | { status: "done"; output: NamingFamilyOutput; calls: number; removed: number }
  | { status: "failed"; error: string; calls: number };

export interface NamingFamilyRunInput {
  family: NamingFamily;
  ctx: NamingContext;
}

export async function runNamingFamily(
  deps: { provider: StructuredOutputProvider },
  input: NamingFamilyRunInput,
): Promise<NamingFamilyRunResult> {
  const basePrompt = input.family.buildUserPrompt(input.ctx);
  let userPrompt = basePrompt;
  let calls = 0;
  let lastValid: NamingFamilyOutput | undefined;
  for (let pass = 0; pass < MAX_CALLS; pass += 1) {
    let errors: string[];
    calls += 1;
    try {
      const raw = await deps.provider.generateStructured<unknown>({
        taskId: `sanyi/naming/${input.family.key}`,
        systemPrompt: input.family.systemPrompt,
        cacheSystemPrompt: true,
        userPrompt,
        schema: NAMING_FAMILY_SCHEMA,
        effort: "medium",
      });
      const output = validateStructuredOutput<NamingFamilyOutput>(NAMING_FAMILY_SCHEMA, raw);
      lastValid = output;
      errors = auditFamily(input.family.key, output, input.ctx);
      if (errors.length === 0) {
        return {
          status: "done",
          output: normalizeFamilyOutput(input.family.key, output, input.ctx),
          calls,
          removed: 0,
        };
      }
    } catch (error) {
      if (!(error instanceof StructuredOutputError)) {
        return { status: "failed", error: "起名本家暂未落笔，请稍后重试", calls };
      }
      errors = schemaHints(error);
    }
    userPrompt = [
      basePrompt,
      "",
      "上一次输出未通过核对，请修正后完整重写：",
      ...errors.map((error) => `- ${error}`),
    ].join("\n");
  }
  if (lastValid) {
    const repaired = repairFamily(input.family.key, lastValid, input.ctx);
    if (repaired.output.names.length > 0) {
      return {
        status: "done",
        output: normalizeFamilyOutput(input.family.key, repaired.output, input.ctx),
        calls,
        removed: repaired.removed,
      };
    }
  }
  return { status: "failed", error: "本家三次都未给出合规名字，请稍后重试", calls };
}

/** 单家模型调用失败或三次无合格名字时，把整个运行自动再试一次。 */
export async function runNamingFamilyWithRetry(
  deps: { provider: StructuredOutputProvider },
  input: NamingFamilyRunInput,
): Promise<NamingFamilyRunResult> {
  const first = await runNamingFamily(deps, input);
  if (first.status === "done") return first;
  const again = await runNamingFamily(deps, input);
  return { ...again, calls: first.calls + again.calls };
}

export interface NamingSummaryInput {
  target: "person" | "business";
  families: Partial<Record<NamingFamilyKey, NamingFamilyOutput>>;
}

export const NAMING_SUMMARY_SYSTEM_PROMPT = `你是「三易」起名的三家合参执笔人。
你的任务是从程序给出的合格名字中推荐 2 至 3 个，概括已落笔各家思路，并给出实际挑选方法。
- picks 只能使用合格名字清单中的名字，不得另起新名；推荐不得重复，reason 不超过 60 字。
- overview 只说明清单中已落笔各家的相同点与不同点，不得评论未提供的一家，不超过 150 字。
- tips 写 2 至 3 条，每条不超过 40 字；可建议念全名、请家人检查方言谐音、查询重名或商标。
- 不用五格、三才、数理，不承诺改运；不写开光、法器、符咒、转运、化煞、放生或供奉。
输出必须严格符合给定 JSON Schema。`;

export function buildNamingSummaryPrompt(input: NamingSummaryInput): string {
  const labels: Readonly<Record<NamingFamilyKey, string>> = {
    wuxing: "五行补益",
    shiwen: "诗文出处",
    yinyi: "音形字义",
  };
  const lines = [
    `起名对象：${input.target === "person" ? "人名" : "商号"}`,
    `依据 ${Object.values(input.families).filter((family) => family?.names.length).length} 家`,
    "合格名字清单（只能从中推荐）：",
  ];
  for (const key of ["wuxing", "shiwen", "yinyi"] as const) {
    const output = input.families[key];
    if (!output || output.names.length === 0) continue;
    lines.push(`${labels[key]}：${output.names.map(({ given }) => given).join("、")}`);
    lines.push(`${labels[key]}思路：${output.note}`);
  }
  lines.push("输出必须严格符合给定 JSON Schema。");
  return lines.join("\n");
}

export type NamingSummaryRunResult =
  | { status: "done"; output: NamingSummaryOutput; calls: number; removed: number }
  | { status: "failed"; error: string; calls: number };

function validNames(input: NamingSummaryInput): string[] {
  return Object.values(input.families)
    .flatMap((family) => family?.names.map(({ given }) => given) ?? []);
}

export async function runNamingSummary(
  deps: { provider: StructuredOutputProvider },
  input: NamingSummaryInput,
): Promise<NamingSummaryRunResult> {
  const basePrompt = buildNamingSummaryPrompt(input);
  const valid = validNames(input);
  let userPrompt = basePrompt;
  let calls = 0;
  let lastValid: NamingSummaryOutput | undefined;
  for (let pass = 0; pass < MAX_CALLS; pass += 1) {
    let errors: string[];
    calls += 1;
    try {
      const raw = await deps.provider.generateStructured<unknown>({
        taskId: "sanyi/naming/summary",
        systemPrompt: NAMING_SUMMARY_SYSTEM_PROMPT,
        cacheSystemPrompt: true,
        userPrompt,
        schema: NAMING_SUMMARY_SCHEMA,
        effort: "medium",
      });
      const output = validateStructuredOutput<NamingSummaryOutput>(NAMING_SUMMARY_SCHEMA, raw);
      lastValid = output;
      errors = auditNamingSummary(output, valid);
      if (errors.length === 0) {
        return { status: "done", output, calls, removed: 0 };
      }
    } catch (error) {
      if (!(error instanceof StructuredOutputError)) {
        return { status: "failed", error: "三家合参暂未生成，请稍后重试", calls };
      }
      errors = schemaHints(error);
    }
    userPrompt = [
      basePrompt,
      "",
      "上一次输出未通过核对，请修正后完整重写：",
      ...errors.map((error) => `- ${error}`),
    ].join("\n");
  }
  if (lastValid) {
    const families = Object.fromEntries(Object.entries(input.families).map(([key, family]) => [
      key,
      family?.names.map(({ given }) => given) ?? [],
    ])) as Partial<Record<NamingFamilyKey, string[]>>;
    const repaired = repairNamingSummary(lastValid, families, input.target);
    if (repaired.output.picks.length >= 2) {
      return { status: "done", output: repaired.output, calls, removed: repaired.removed };
    }
  }
  return { status: "failed", error: "三家合参三次都不合规，请稍后重试", calls };
}

/** 合参模型调用失败时，把整个运行自动再试一次。 */
export async function runNamingSummaryWithRetry(
  deps: { provider: StructuredOutputProvider },
  input: NamingSummaryInput,
): Promise<NamingSummaryRunResult> {
  const first = await runNamingSummary(deps, input);
  if (first.status === "done") return first;
  const again = await runNamingSummary(deps, input);
  return { ...again, calls: first.calls + again.calls };
}
