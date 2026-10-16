import { salvageEnglishOutput, schemaHintsEn } from "../english/salvage.js";
import {
  StructuredOutputError,
  validateStructuredOutput,
  type StructuredOutputProvider,
} from "../../agent/provider.js";
import {
  auditFamily,
  auditNamingSummary,
  namingFamilyLanguageErrors,
  namingSummaryLanguageErrors,
  normalizeFamilyOutput,
  repairFamily,
  repairNamingSummary,
  toneHints,
} from "./audit.js";
import { NAMING_FAMILIES } from "./families.js";
import {
  NAMING_FAMILY_SCHEMA,
  NAMING_FAMILY_SCHEMA_EN,
  NAMING_SUMMARY_SCHEMA,
  NAMING_SUMMARY_SCHEMA_EN,
  type NamingContext,
  type NamingFamilyKey,
  type NamingFamilyOutput,
  type NamingSummaryOutput,
} from "./schema.js";
import { schemaHints } from "../schema-hints.js";
import { nameScores, nameSupplements } from "./card.js";
import type { Element } from "./lexicon.js";

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
  const language = input.ctx.language ?? "zh";
  let userPrompt = basePrompt;
  let calls = 0;
  let lastValid: NamingFamilyOutput | undefined;
  for (let pass = 0; pass < MAX_CALLS; pass += 1) {
    let errors: string[];
    calls += 1;
    try {
      const raw = await deps.provider.generateStructured<unknown>({
        taskId: `sanyi/naming/${input.family.key}`,
        systemPrompt: language === "en" ? input.family.systemPromptEn : input.family.systemPrompt,
        cacheSystemPrompt: true,
        userPrompt,
        schema: language === "en" ? NAMING_FAMILY_SCHEMA_EN : NAMING_FAMILY_SCHEMA,
        effort: "medium",
        ...(language === "en" ? { salvage: salvageEnglishOutput } : {}),
      });
      const output = validateStructuredOutput<NamingFamilyOutput>(
        language === "en" ? NAMING_FAMILY_SCHEMA_EN : NAMING_FAMILY_SCHEMA,
        raw,
      );
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
      errors = language === "en" ? schemaHintsEn(error) : schemaHints(error);
    }
    userPrompt = [
      basePrompt,
      "",
      "上一次输出未通过核对，请修正后完整重写：",
      ...errors.map((error) => `- ${error}`),
      ...(language === "en" ? ["given 与 chars[].char 保留汉字，其余正文仍须用英文。"] : []),
    ].join("\n");
  }
  if (lastValid) {
    const repaired = repairFamily(input.family.key, lastValid, input.ctx);
    if (repaired.output.names.length > 0
      && namingFamilyLanguageErrors(repaired.output, input.family.key, input.ctx).length === 0) {
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

interface NamingSummaryInputBase {
  families: Partial<Record<NamingFamilyKey, NamingFamilyOutput>>;
  favorable?: readonly Element[] | null;
  missing?: readonly Element[];
  language?: "zh" | "en";
}

export type NamingSummaryInput =
  | NamingSummaryInputBase & { target: "person"; surname: string }
  | NamingSummaryInputBase & { target: "business"; surname?: never };

export const NAMING_SUMMARY_SYSTEM_PROMPT = `你是「三易」起名的三家合参执笔人。
你的任务是从程序给出的合格名字中推荐 2 至 3 个，概括已落笔各家思路，并给出实际挑选方法。
- 问题可能是英文，请仍用中文作答。
- picks 只能使用合格名字清单中的名字，不得另起新名；推荐不得重复，reason 不超过 60 字。
- 优先推荐没有音律提示的名字；推荐带音律提示的名字时，理由必须如实说明该提示。
- 优先推荐综合分高且补上所缺五行的名字，推荐理由写明补了什么。
- overview 只说明清单中已落笔各家的相同点与不同点，不得评论未提供的一家，不超过 150 字。
- tips 写 2 至 3 条，每条不超过 40 字；人名不得提商标、工商，商号不得提重名、户口。
- 不用五格、三才、数理，不承诺改运；不写开光、法器、符咒、转运、化煞、放生或供奉。
输出必须严格符合给定 JSON Schema。`;

export const NAMING_SUMMARY_SYSTEM_PROMPT_EN = `You write Yarrow's synthesis of the available naming families.
Choose two or three names only from the supplied qualified-name list, summarize the approaches that actually produced names, and give practical selection advice.
- picks[].given remains in Chinese characters and must come from the qualified list. Do not invent a new name or repeat a recommendation. Write picks[].reason in plain English, at most 240 characters.
- Prefer names without pronunciation warnings. If recommending a warned name, state the warning accurately in the reason.
- Prefer stronger overall scores and names that supplement missing elements; state the relevant supplement in the reason when it supports the choice.
- overview is English and compares only the supplied families, at most 600 characters.
- tips contains two or three practical English items, each at most 160 characters. For a person, do not mention trademarks or business registration. For a business, do not mention duplicate personal names or household registration.
- Chinese characters are allowed only for the supplied names and surname. Do not use Five Grids, Three Talents, stroke numerology, or promise that a name changes luck. Do not mention consecrated objects, ritual implements, talismans, luck-changing objects, releasing animals, donations, offerings, or incense.
Write for an international reader who does not know Chinese, using plain English. Output must strictly follow the provided JSON Schema.`;

function englishToneHints(hints: readonly string[]): string[] {
  return hints.map((hint) => {
    if (hint.startsWith("姓名声调全同")) return "the full name uses one tone throughout";
    if (hint.includes("同声母")) return "the surname and first given character share an initial";
    if (hint.includes("同韵母")) return "the surname and first given character share a final";
    if (hint.includes("较生僻")) return "contains a relatively rare character";
    if (hint.includes("多音字")) return "contains a character with multiple readings";
    return "has a pronunciation point to review";
  });
}

export function buildNamingSummaryPrompt(input: NamingSummaryInput): string {
  const language = input.language ?? "zh";
  const labels: Readonly<Record<NamingFamilyKey, string>> = language === "en"
    ? { wuxing: "Five Elements", shiwen: "Classical Poetry", yinyi: "Sound and Meaning" }
    : { wuxing: "五行补益", shiwen: "诗文出处", yinyi: "音形字义" };
  const lines = [
    language === "en"
      ? `Naming target: ${input.target === "person" ? "person" : "business"}`
      : `起名对象：${input.target === "person" ? "人名" : "商号"}`,
    language === "en"
      ? `Available families: ${Object.values(input.families).filter((family) => family?.names.length).length}`
      : `依据 ${Object.values(input.families).filter((family) => family?.names.length).length} 家`,
    language === "en" ? "Qualified names (recommend only from this list):" : "合格名字清单（只能从中推荐）：",
  ];
  for (const key of ["wuxing", "shiwen", "yinyi"] as const) {
    const output = input.families[key];
    if (!output || output.names.length === 0) continue;
    lines.push(language === "en" ? `${labels[key]}:` : `${labels[key]}：`);
    for (const name of output.names) {
      const { given } = name;
      const rawHints = toneHints(input.target === "person" ? input.surname : undefined, given);
      const hints = language === "en" ? englishToneHints(rawHints) : rawHints;
      const favorable = input.favorable ?? (key === "wuxing" && output.element
        ? [output.element] : null);
      const scores = nameScores({
        target: input.target,
        ...(input.target === "person" ? { surname: input.surname } : {}),
        given,
        favorable,
        missing: input.missing ?? [],
        sourceVerified: key === "shiwen" && name.sourceId !== undefined,
      });
      const supplements = nameSupplements(given, favorable)
        .map(({ element, chars }) => language === "en"
          ? `adds ${element}: ${chars.join(", ")}` : `补${element}：${chars.join("、")}`);
      lines.push([
        `- ${given}`,
        language === "en" ? `overall score ${scores.overall}` : `综合 ${scores.overall} 分`,
        ...supplements,
        ...(hints.length > 0 ? [language === "en"
          ? `pronunciation note: ${hints.join("; ")}` : `音律提示：${hints.join("；")}`] : []),
      ].join("｜"));
    }
    lines.push(language === "en"
      ? `${labels[key]} approach: ${output.note}` : `${labels[key]}思路：${output.note}`);
  }
  lines.push(language === "en"
    ? "Output must strictly follow the provided JSON Schema."
    : "输出必须严格符合给定 JSON Schema。");
  return lines.join("\n");
}

export type NamingSummaryRunResult =
  | { status: "done"; output: NamingSummaryOutput; calls: number; removed: number }
  | { status: "failed"; error: string; calls: number };

function validNames(input: NamingSummaryInput): string[] {
  return Object.values(input.families)
    .flatMap((family) => family?.names.map(({ given }) => given) ?? []);
}

function sameToneNames(input: NamingSummaryInput): string[] {
  const surname = input.target === "person" ? input.surname : undefined;
  return validNames(input).filter((given) => (
    toneHints(surname, given).some((hint) => hint.startsWith("姓名声调全同"))
  ));
}

export async function runNamingSummary(
  deps: { provider: StructuredOutputProvider },
  input: NamingSummaryInput,
): Promise<NamingSummaryRunResult> {
  const basePrompt = buildNamingSummaryPrompt(input);
  const language = input.language ?? "zh";
  const valid = validNames(input);
  const sameTone = sameToneNames(input);
  let userPrompt = basePrompt;
  let calls = 0;
  let lastValid: NamingSummaryOutput | undefined;
  for (let pass = 0; pass < MAX_CALLS; pass += 1) {
    let errors: string[];
    calls += 1;
    try {
      const raw = await deps.provider.generateStructured<unknown>({
        taskId: "sanyi/naming/summary",
        systemPrompt: language === "en"
          ? NAMING_SUMMARY_SYSTEM_PROMPT_EN : NAMING_SUMMARY_SYSTEM_PROMPT,
        cacheSystemPrompt: true,
        userPrompt,
        schema: language === "en" ? NAMING_SUMMARY_SCHEMA_EN : NAMING_SUMMARY_SCHEMA,
        effort: "medium",
        ...(language === "en" ? { salvage: salvageEnglishOutput } : {}),
      });
      const output = validateStructuredOutput<NamingSummaryOutput>(
        language === "en" ? NAMING_SUMMARY_SCHEMA_EN : NAMING_SUMMARY_SCHEMA,
        raw,
      );
      lastValid = output;
      errors = auditNamingSummary(output, valid, {
        target: input.target,
        sameToneNames: sameTone,
        language,
        ...(input.target === "person" ? { surname: input.surname } : {}),
      });
      if (errors.length === 0) {
        return { status: "done", output, calls, removed: 0 };
      }
    } catch (error) {
      if (!(error instanceof StructuredOutputError)) {
        return { status: "failed", error: "三家合参暂未生成，请稍后重试", calls };
      }
      errors = language === "en" ? schemaHintsEn(error) : schemaHints(error);
    }
    userPrompt = [
      basePrompt,
      "",
      "上一次输出未通过核对，请修正后完整重写：",
      ...errors.map((error) => `- ${error}`),
      ...(language === "en" ? ["推荐名字保留汉字，其余正文仍须用英文。"] : []),
    ].join("\n");
  }
  if (lastValid) {
    const families = Object.fromEntries(Object.entries(input.families).map(([key, family]) => [
      key,
      family?.names.map(({ given }) => given) ?? [],
    ])) as Partial<Record<NamingFamilyKey, string[]>>;
    const repaired = repairNamingSummary(
      lastValid,
      families,
      input.target,
      sameTone,
      language,
      input.target === "person" ? input.surname : undefined,
    );
    if (repaired.output.picks.length >= 2
      && namingSummaryLanguageErrors(repaired.output, {
        language,
        ...(input.target === "person" ? { surname: input.surname } : {}),
      }).length === 0) {
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
