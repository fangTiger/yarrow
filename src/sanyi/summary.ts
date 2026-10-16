// src/sanyi/summary.ts
// 白话总述：三家落笔之后，用普通人能懂的现代汉语把三家的结论合起来讲清楚（设计文档 21.3）；
// 同一次调用给出解法：心法、怎么做、别做什么（设计文档 22.2、22.3）。
import {
  StructuredOutputError, validateStructuredOutput, type StructuredOutputProvider,
} from "../agent/provider.js";
import type { JsonSchema } from "../agent/schemas.js";
import { splitSentences } from "./repair.js";
import { chineseBodyErrors } from "./language-guard.js";
import { englishBodyErrors, englishForbiddenErrors } from "./english/audit.js";
import { ENGLISH_OUTPUT_CONVENTIONS, appendEnglishReferenceMaterials } from "./english/prompt.js";
import { SUMMARY_SCHEMA_EN } from "./english/schema.js";
import { schemaHints } from "./schema-hints.js";
import type { SummaryState } from "./store.js";

export type SummaryTone = "顺" | "中" | "不顺";
export type SummaryKind = "question" | "fortune" | "destiny";

export interface RemedyStep {
  action: string;
  basis: string;
  timing?: string;
}

/** 解法：心法白话、怎么做、别做什么；心法原文由系统给出，不在此处。 */
export interface Remedy {
  principle: string;
  plan: RemedyStep[];
  avoid: string[];
}

/** 命理性格画像：简短标签、优势、短板与一句总评。 */
export interface Portrait {
  traits: string[];
  strengths: string[];
  blindSpots: string[];
  summary: string;
}

/** 心法依据：问事为本卦《大象传》原文，八字为三家取用与调候。 */
export interface SummaryAnchor {
  title: string;
  lines: string[];
}

export interface PlainSummary {
  /** 与合议一致的倾向；命理不写。 */
  tone?: SummaryTone;
  conclusion: string;
  agreement: string;
  difference?: string;
  explanation: string[];
  /** 解法；改版前的旧存档没有。 */
  remedy?: Remedy;
  /** 命理性格画像；旧存档以及问事、运势没有。 */
  portrait?: Portrait;
  /** 旧存档的建议；新总述并入解法，不再输出。 */
  advice?: string[];
  watch?: { window: string; condition: string };
  /** 运势的十年走势，或命理有逐运合议时的一生走势。 */
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
  /** 命理的逐运合议一行，如「第1步 戊申 4–13岁 5.0成；第2步 …」。 */
  periodConsensus?: string;
  schools: readonly SummarySchool[];
  /** 心法依据，由服务端组装；核对前从正文中剔除。 */
  anchor: SummaryAnchor;
  /** 正文盘面核对：返回中文错误；问事与八字各用自己的核对器。 */
  proseErrors(text: string): string[];
  /** 缺省为中文；英文仅改变展示字段，结构枚举保持不变。 */
  language?: "zh" | "en";
  /** 英文提示所需的完整事实术语材料；缺省沿用盘面要点。 */
  referenceText?: string;
}

export const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["conclusion", "agreement", "explanation", "remedy"],
  properties: {
    tone: { type: "string", enum: ["顺", "中", "不顺"] },
    conclusion: { type: "string", minLength: 1, maxLength: 40 },
    agreement: { type: "string", minLength: 1, maxLength: 150 },
    difference: { type: "string", minLength: 1, maxLength: 150 },
    explanation: {
      type: "array", minItems: 2, maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 200 },
    },
    remedy: {
      type: "object",
      additionalProperties: false,
      required: ["principle", "plan", "avoid"],
      properties: {
        principle: { type: "string", minLength: 1, maxLength: 60 },
        plan: {
          type: "array", minItems: 2, maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "basis"],
            properties: {
              action: { type: "string", minLength: 1, maxLength: 40 },
              basis: { type: "string", minLength: 1, maxLength: 50 },
              timing: { type: "string", minLength: 1, maxLength: 30 },
            },
          },
        },
        avoid: {
          type: "array", minItems: 1, maxItems: 2,
          items: { type: "string", minLength: 1, maxLength: 40 },
        },
      },
    },
    portrait: {
      type: "object",
      additionalProperties: false,
      required: ["traits", "strengths", "blindSpots", "summary"],
      properties: {
        traits: {
          type: "array", minItems: 3, maxItems: 5,
          items: { type: "string", minLength: 1, maxLength: 6 },
        },
        strengths: {
          type: "array", minItems: 2, maxItems: 2,
          items: { type: "string", minLength: 1, maxLength: 40 },
        },
        blindSpots: {
          type: "array", minItems: 2, maxItems: 2,
          items: { type: "string", minLength: 1, maxLength: 40 },
        },
        summary: { type: "string", minLength: 1, maxLength: 60 },
      },
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
- 问题可能是英文，请仍用中文作答。
- 只依据下方三家断语与盘面要点，不得新增三家都没说过的结论，不得写出盘面中不存在的干支、卦名、十神或关系。
- 术语第一次出现时用括号给白话解释，按所问类型选对含义：问事里「用神（代表所问之事的那一爻）」；命理、运势里「用神（对命局最有帮助的五行）」「大运（每十年一换的运程）」。
- conclusion 一句话直接回答所问，不超过 40 字；tone 必须与「合议倾向」一致，结论的语气也要与之一致。
- agreement 写三家一致之处；difference 写三家分歧之处，三家都一致时省略。
- explanation 写 2 至 4 段，每段讲一个原因。
- remedy 是解法，回答「那我该怎么办」：principle 用一句白话讲清「心法依据」教人怎么处事，不要照抄原文。
- remedy.plan 写 2 至 3 步：action 写做什么，basis 写依据的盘面要点或三家说法，
  timing 写什么时候做（结合应期，没有就省略）；remedy.avoid 写 1 至 2 条别做什么。
- 仅命理写 portrait：只综合三家「性格」分项与用神已有判断，不新增盘面依据。
  traits 写 3 至 5 个简短性格词，不写干支或十神；strengths 与 blindSpots 各写 2 条，
  summary 写一句总评。
- 解法只给现实中能照做的做法：不给颜色、方位、数字、佩戴之类的趋避，
  不推荐开光物、法器、符咒、护身符、吉祥物、摆件，不涉及放生、捐款、供奉、烧香。
- 需要留意的时间写入 watch，必须写明成立条件；没有就省略。
- 运势必须写 outlook，用一句话概括十年走势。
- 命理不写 tone，也不给总体吉凶评级；有「逐运合议」时必须写 outlook，
  用一句话概括一生大运起伏，没有逐运合议时不写 outlook。
- 不做医疗、法律、投资结论；涉及健康时建议就医。
- 自称只说「三易」，语气平实，不渲染恐惧，也不打包票。
输出必须严格符合给定 JSON Schema。`;

export const SUMMARY_SYSTEM_PROMPT_EN = `You write Yarrow's plain-language synthesis and are not one of the three readers.
Combine the three readings of the same question into clear, plain English and answer the question directly.
- Use only the supplied school readings and chart points. Do not add a conclusion none of the schools made, or invent stems, branches, hexagrams, Ten Gods, or relationships.
- On first use, explain specialist terms in parentheses. For a question, Yong Shen means the key line representing the matter. For destiny or fortune, Yong Shen means the element most helpful to the chart, and Da Yun means a ten-year luck period.
- conclusion must answer directly in one sentence. tone must match the supplied consensus tendency, and the wording of the conclusion must match it.
- agreement states where the schools agree. difference states where they differ and must be omitted when they fully agree.
- explanation contains two to four paragraphs, one reason per paragraph.
- remedy answers what the reader can do. principle explains the practical lesson of the supplied anchor without copying it. plan contains two or three steps: action says what to do, basis cites a chart point or school statement, and timing says when when relevant. avoid contains one or two things not to do.
- Only destiny includes portrait, based solely on the schools' character sections and existing useful-element judgments. traits has three to five short labels; strengths and blindSpots have exactly two items each; summary gives one overall sentence.
- Advice must be practical. Do not recommend colors, directions, numbers, wearable objects, consecrated objects, ritual implements, talismans, amulets, mascots, ornaments, releasing animals, donations, offerings, or incense.
- watch must include both a time window and the condition under which it applies; omit it when there is no supported timing.
- Fortune must include outlook as a one-sentence ten-year overview.
- Destiny has no tone or overall fortune rating. It must include outlook when period consensus is supplied and omit outlook otherwise.
- For health questions, recommend qualified medical care. Do not give medical, legal, or investment conclusions.
- Refer to yourself only as Yarrow. Keep the tone calm, avoid fear, and never guarantee an outcome.

${ENGLISH_OUTPUT_CONVENTIONS}`;

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

function toneConclusion(consensus: number, language: "zh" | "en" = "zh"): string {
  const tone = expectedTone(consensus);
  const value = consensus.toFixed(1);
  if (language === "en") {
    if (tone === "顺") return `The consensus is ${value}/10, so the outlook is mostly favorable.`;
    if (tone === "不顺") return `The consensus is ${value}/10, so the outlook is unfavorable; proceed carefully.`;
    return `The consensus is ${value}/10, so the outcome remains mixed.`;
  }
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
  if (input.periodConsensus) {
    lines.push(`逐运合议：${input.periodConsensus}`);
  }
  lines.push(`心法依据（${input.anchor.title}）：`, ...input.anchor.lines.map((line) => `- ${line}`));
  lines.push("盘面要点：", ...input.chartPoints.map((point) => `- ${point}`), "三家断语：");
  lines.push(...input.schools.map(schoolBlock));
  const base = lines.join("\n");
  return input.language === "en"
    ? appendEnglishReferenceMaterials(
        base,
        input.referenceText ?? input.chartPoints.join("\n"),
        input.anchor.lines.join("\n"),
      )
    : base;
}

/** 解法与总述都不得出现的民俗器物、供奉与趋避用语。 */
export const REMEDY_FORBIDDEN = /开光|法器|符咒|符箓|护身符|转运|化煞|吉祥物|摆件|放生|捐款|供奉|烧香|幸运色|幸运数字|吉位/gu;

function forbiddenErrors(text: string, language: "zh" | "en" = "zh"): string[] {
  if (language === "en") return englishForbiddenErrors(text);
  const words = [...new Set(text.match(REMEDY_FORBIDDEN) ?? [])];
  if (words.length === 0) {
    return [];
  }
  return [`不得出现「${words.join("」「")}」之类（法器、符咒、供奉、颜色方位趋避等），请改为现实中能照做的做法`];
}

/** 把心法原文按逗号、分号、句号切成短句，从正文中删去，避免原文用字被盘面核对误判。 */
function stripAnchor(
  text: string,
  anchor: SummaryAnchor,
  language: "zh" | "en" = "zh",
): string {
  if (language === "en") return text;
  const clauses = anchor.lines
    .flatMap((line) => line.split(/[，；。、：]/u))
    .map((clause) => clause.trim())
    .filter((clause) => [...clause].length >= 2)
    .sort((a, b) => b.length - a.length);
  return clauses.reduce((rest, clause) => rest.split(clause).join(""), text);
}

/** 单段文字的核对：盘面核对（剔除心法原文后）加禁用词。 */
function textErrors(text: string, input: SummaryInput): string[] {
  const language = input.language ?? "zh";
  return [
    ...input.proseErrors(stripAnchor(text, input.anchor, language)),
    ...forbiddenErrors(text, language),
  ];
}

function baseSummaryTexts(output: PlainSummary): string[] {
  const texts = [output.conclusion, output.agreement, ...output.explanation, ...(output.advice ?? [])];
  if (output.remedy) {
    texts.push(output.remedy.principle, ...output.remedy.avoid);
    for (const step of output.remedy.plan) {
      texts.push(step.action, step.basis, ...(step.timing ? [step.timing] : []));
    }
  }
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

function portraitTexts(portrait: Portrait | undefined): string[] {
  return portrait
    ? [...portrait.traits, ...portrait.strengths, ...portrait.blindSpots, portrait.summary]
    : [];
}

function summaryTexts(output: PlainSummary): string[] {
  return [...baseSummaryTexts(output), ...portraitTexts(output.portrait)];
}

export function summaryLanguageErrors(
  output: PlainSummary,
  language: "zh" | "en" = "zh",
): string[] {
  return language === "en"
    ? englishBodyErrors(summaryTexts(output))
    : chineseBodyErrors(summaryTexts(output));
}

/** 总述的业务核对：倾向与合议一致、命理与运势的字段要求、正文不得编造盘面。 */
export function checkSummary(output: PlainSummary, input: SummaryInput): string[] {
  const language = input.language ?? "zh";
  const languageErrors = (texts: readonly string[]) => language === "en"
    ? englishBodyErrors(texts)
    : chineseBodyErrors(texts);
  const errors: string[] = summaryLanguageErrors(output, language);
  if (input.kind === "destiny") {
    if (output.tone !== undefined) {
      errors.push("命理不写倾向（tone）");
    }
    if (!output.portrait) {
      errors.push("命理须写性格画像（portrait）");
    } else {
      if (output.portrait.traits.length < 3 || output.portrait.traits.length > 5) {
        errors.push("性格标签须为 3 至 5 项");
      }
      if (output.portrait.strengths.length !== 2) {
        errors.push("性格优势须恰好 2 项");
      }
      if (output.portrait.blindSpots.length !== 2) {
        errors.push("性格短板须恰好 2 项");
      }
    }
    if (input.periodConsensus) {
      if (!output.outlook) {
        errors.push("命理有逐运合议时须写一生走势（outlook）");
      }
    } else if (output.outlook !== undefined) {
      errors.push("命理没有逐运合议时不写 outlook");
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
  if (input.kind !== "destiny" && output.portrait) {
    errors.push(`${input.kind === "question" ? "问事" : "运势"}不写性格画像（portrait）`);
  }
  errors.push(...textErrors(baseSummaryTexts(output).join("\n"), input));
  if (output.portrait) {
    for (const trait of output.portrait.traits) {
      errors.push(...languageErrors([trait]), ...forbiddenErrors(trait, language));
    }
    for (const text of [
      ...output.portrait.strengths, ...output.portrait.blindSpots, output.portrait.summary,
    ]) {
      errors.push(...languageErrors([text]), ...textErrors(text, input));
    }
  }
  return errors;
}

export interface SummaryRepair {
  output: PlainSummary;
  removed: number;
  adjusted: number;
}

/** 总述删错留对：删去编造盘面或含禁用词的句子；倾向不符时改为合议倾向，并以模板结论代替；
 * 解法的步骤、避忌或心法被删空时用模板兜底。 */
export function repairSummary(output: PlainSummary, input: SummaryInput): SummaryRepair {
  let removed = 0;
  let adjusted = 0;
  const language = input.language ?? "zh";
  const languageErrors = (texts: readonly string[]) => language === "en"
    ? englishBodyErrors(texts)
    : chineseBodyErrors(texts);
  const keep = (text: string): string => {
    const kept = splitSentences(text, language).filter((sentence) => {
      const perSentenceLanguageErrors = language === "en" ? languageErrors([sentence]) : [];
      if (perSentenceLanguageErrors.length === 0 && textErrors(sentence, input).length === 0) {
        return true;
      }
      removed += 1;
      return false;
    });
    return kept.join("").trim();
  };
  const explanation = output.explanation.map(keep).filter((text) => text !== "");
  if (language === "en") {
    const fallbacks = [
      "Parts that did not match the chart were removed; see the three readings below.",
      "Only the points supported by the supplied readings remain.",
    ];
    while (explanation.length < 2) explanation.push(fallbacks[explanation.length]!);
  }
  const repaired: PlainSummary = {
    conclusion: keep(output.conclusion),
    agreement: keep(output.agreement) || (language === "en"
      ? "The three detailed readings appear below."
      : "三家的具体说法见下方依据。"),
    explanation: explanation.length > 0 ? explanation : [language === "en"
      ? "Parts that did not match the chart were removed; see the three readings below."
      : "与盘面不符的解释已删去，详见三家依据。"],
    remedy: repairRemedy(output.remedy, input.kind, keep, language),
  };
  if (input.kind === "destiny" && output.portrait) {
    const keepPortrait = (value: string, trait: boolean): string => {
      const errors = trait
        ? [...languageErrors([value]), ...forbiddenErrors(value, language)]
        : [...languageErrors([value]), ...textErrors(value, input)];
      if (errors.length === 0) {
        return value;
      }
      removed += 1;
      return "";
    };
    const traits = output.portrait.traits.map((value) => keepPortrait(value, true))
      .filter((value) => value !== "");
    const strengths = output.portrait.strengths.map((value) => keepPortrait(value, false))
      .filter((value) => value !== "");
    const blindSpots = output.portrait.blindSpots.map((value) => keepPortrait(value, false))
      .filter((value) => value !== "");
    const portraitSummary = keepPortrait(output.portrait.summary, false);
    if (traits.length >= 3 && traits.length <= 5 && strengths.length === 2
      && blindSpots.length === 2 && portraitSummary) {
      repaired.portrait = { traits, strengths, blindSpots, summary: portraitSummary };
    }
  }
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
    repaired.outlook = (output.outlook ? keep(output.outlook) : "") || (language === "en"
      ? "See the annual outlook below for the ten-year trend."
      : "十年走势见下方流年运势。");
  }
  if (input.kind === "destiny" && input.periodConsensus) {
    repaired.outlook = (output.outlook ? keep(output.outlook) : "") || (language === "en"
      ? "See Life Outlook for the pattern across the ten-year periods."
      : "一生大运起伏见「一生运势」。");
  }
  if (input.kind !== "destiny" && input.consensus !== null) {
    const tone = expectedTone(input.consensus);
    repaired.tone = tone;
    if (output.tone !== tone || !repaired.conclusion) {
      adjusted += 1;
      repaired.conclusion = toneConclusion(input.consensus, language);
    }
  }
  if (!repaired.conclusion) {
    repaired.conclusion = language === "en"
      ? "See the three readings below for their conclusions."
      : "三家看法见下方依据。";
  }
  return { output: repaired, removed, adjusted };
}

function repairRemedy(
  remedy: Remedy | undefined,
  kind: SummaryKind,
  keep: (text: string) => string,
  language: "zh" | "en" = "zh",
): Remedy {
  // 一步的做法被删则整步去掉，不再核对其依据。
  const steps = (remedy?.plan ?? []).flatMap((step): RemedyStep[] => {
    const action = keep(step.action);
    if (!action) {
      return [];
    }
    const basis = keep(step.basis);
    if (!basis) {
      return [];
    }
    const timing = step.timing ? keep(step.timing) : "";
    return [timing ? { action, basis, timing } : { action, basis }];
  });
  const avoid = (remedy?.avoid ?? []).map(keep).filter((text) => text !== "");
  const principle = remedy ? keep(remedy.principle) : "";
  return {
    principle: principle || (language === "en"
      ? kind === "question"
        ? "Act with integrity and follow the practical lesson of the anchor above."
        : "Use the three readings to build on strengths and limit weaknesses."
      : kind === "question" ? "按上方原文之意，守正而行。" : "按三家取用之意，扬长避短。"),
    plan: language === "en"
      ? [
          ...steps,
          { action: "Start with the safest practical step from the readings", basis: "The three readings" },
          { action: "Review the situation before committing", basis: "The supported points that remain" },
        ].slice(0, Math.max(2, steps.length))
      : steps.length > 0 ? steps : [{ action: "对照下方三家依据，择其稳妥者先行", basis: "三家断语" }],
    avoid: avoid.length > 0 ? avoid : [language === "en"
      ? "Do not use this reading as a medical or financial decision."
      : "不要据此做重大财务或医疗决定"],
  };
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
  const language = input.language ?? "zh";
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
        systemPrompt: language === "en" ? SUMMARY_SYSTEM_PROMPT_EN : SUMMARY_SYSTEM_PROMPT,
        cacheSystemPrompt: true,
        userPrompt,
        schema: language === "en" ? SUMMARY_SCHEMA_EN : SUMMARY_SCHEMA,
        effort: "medium",
      });
      const output = validateStructuredOutput<PlainSummary>(
        language === "en" ? SUMMARY_SCHEMA_EN : SUMMARY_SCHEMA,
        raw,
      );
      // 命理不分倾向：模型偶尔多写 tone，直接去掉，不为此重写。
      if (input.kind === "destiny" && output.tone !== undefined) {
        delete output.tone;
      }
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
      ...errors.map((error) => `- ${error}`),
      ...(language === "en" ? ["正文仍须用英文；如有 evidence 字段，claim 仍须用中文。"] : []),
    ].join("\n");
  }
  if (lastValid) {
    const repaired = repairSummary(lastValid, input);
    const repairedErrors = language === "en"
      ? checkSummary(repaired.output, input)
      : summaryLanguageErrors(repaired.output);
    let repairedStructureOk = true;
    if (language === "en") {
      try {
        validateStructuredOutput(SUMMARY_SCHEMA_EN, repaired.output);
      } catch {
        repairedStructureOk = false;
      }
    }
    if (repairedErrors.length === 0 && repairedStructureOk) {
      return {
        status: "done", output: repaired.output, calls,
        removed: repaired.removed, adjusted: repaired.adjusted,
      };
    }
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
