// src/sanyi/school-runner.ts
import { salvageEnglishOutput, schemaHintsEn } from "./english/salvage.js";
import {
  StructuredOutputError,
  validateStructuredOutput,
  type StructuredOutputProvider,
} from "../agent/provider.js";
import { auditOutput, auditQuestionEvidence } from "./audit.js";
import { auditQuestionEnglishProse, englishForbiddenErrors } from "./english/audit.js";
import { appendQuestionEnglishMaterials } from "./english/prompt.js";
import { QUESTION_SCHOOL_SCHEMA_EN } from "./english/schema.js";
import type { FactTable } from "./facts.js";
import { chineseBodyErrors } from "./language-guard.js";
import { repairQuestion } from "./repair.js";
import { schemaHints } from "./schema-hints.js";
import {
  QUESTION_SCHOOL_SCHEMA,
  checkVerdictConsistency,
  questionLanguageErrors,
  type QuestionSchoolOutput,
} from "./schema.js";
import type { QuestionSchool } from "./schools/shared.js";

export interface SchoolRunDependencies {
  provider: StructuredOutputProvider;
}

export interface SchoolRunInput {
  school: QuestionSchool;
  question: string;
  facts: FactTable;
  originalTexts: readonly string[];
  language?: "zh" | "en";
}

/** 每家最多三次调用：首次加两次带错误说明的重写。 */
const MAX_CALLS = 3;

export type SchoolRunResult =
  | {
    status: "done";
    output: QuestionSchoolOutput;
    calls: number;
    /** 删错留对时删去的处数；一次通过时为 0。 */
    removed: number;
    /** 删错留对时校正的吉凶把握处数；一次通过时为 0。 */
    adjusted: number;
  }
  | { status: "failed" | "rejected"; error: string; calls: number };

function validationErrors(
  output: QuestionSchoolOutput,
  facts: FactTable,
  language: "zh" | "en",
): string[] {
  if (language === "en") {
    const prose = [output.headline, output.reason, ...output.sections.map((section) => section.text)]
      .join("\n");
    const display = [
      output.headline, output.reason,
      ...output.sections.flatMap((section) => [section.title, section.text]),
      ...(output.timing ? [output.timing.window, output.timing.condition] : []),
      ...output.advice,
    ].join("\n");
    return [
      ...checkVerdictConsistency(output, language),
      ...output.evidence.flatMap((evidence) => auditQuestionEvidence(evidence, facts)),
      ...chineseBodyErrors(output.evidence.map((evidence) => evidence.claim)),
      ...output.evidence.flatMap((evidence) => {
        if (!/\p{Script=Han}/u.test(evidence.claim)) {
          return ["evidence[].claim 必须包含中文盘面术语"];
        }
        const fact = facts.get(evidence.ref);
        const anchored = fact && [...fact.tokens].some((token) => (
          /\p{Script=Han}/u.test(token) && evidence.claim.includes(token)
        ));
        return anchored ? [] : ["evidence[].claim 必须使用所引事实中的中文盘面术语"];
      }),
      ...auditQuestionEnglishProse(prose, facts),
      ...englishForbiddenErrors(display),
    ];
  }
  return [
    ...checkVerdictConsistency(output),
    ...auditOutput(output, facts).errors,
  ];
}

export async function runSchool(
  deps: SchoolRunDependencies,
  input: SchoolRunInput,
): Promise<SchoolRunResult> {
  const language = input.language ?? "zh";
  const chinesePrompt = input.school.buildUserPrompt(input);
  const basePrompt = language === "en"
    ? appendQuestionEnglishMaterials(chinesePrompt, input.facts, input.originalTexts)
    : chinesePrompt;
  let userPrompt = basePrompt;
  let calls = 0;
  // 最后一次结构合格的输出：三次都不过核对时据此删错留对。
  let lastValid: QuestionSchoolOutput | undefined;
  for (let pass = 0; pass < MAX_CALLS; pass += 1) {
    let errors: string[];
    try {
      calls += 1;
      const output = await deps.provider.generateStructured<QuestionSchoolOutput>({
        taskId: `sanyi/question/${input.school.key}`,
        systemPrompt: language === "en" ? input.school.systemPromptEn : input.school.systemPrompt,
        cacheSystemPrompt: true,
        userPrompt,
        schema: language === "en" ? QUESTION_SCHOOL_SCHEMA_EN : QUESTION_SCHOOL_SCHEMA,
        effort: "medium",
        ...(language === "en" ? { salvage: salvageEnglishOutput } : {}),
      });
      lastValid = output;
      errors = validationErrors(output, input.facts, language);
      if (errors.length === 0) {
        return { status: "done", output, calls, removed: 0, adjusted: 0 };
      }
    } catch (error) {
      if (!(error instanceof StructuredOutputError)) {
        const message = error instanceof Error ? error.message : String(error);
        return { status: "failed", error: `模型调用失败：${message}`, calls };
      }
      // 结构不合 Schema 时带具体字段提示重写，不当作调用失败。
      errors = language === "en" ? schemaHintsEn(error) : schemaHints(error);
    }
    userPrompt = [
      basePrompt,
      "",
      "上一次输出未通过核对，请修正后完整重写：",
      ...errors.map((error) => `- ${error}`),
      ...(language === "en" ? ["正文仍须用英文，evidence[].claim 仍须用中文。"] : []),
    ].join("\n");
  }
  if (lastValid) {
    const repaired = repairQuestion(lastValid, input.facts, language);
    const repairedErrors = language === "en"
      ? validationErrors(repaired.output, input.facts, language)
      : questionLanguageErrors(repaired.output);
    let repairedStructureOk = true;
    if (language === "en") {
      try {
        validateStructuredOutput(QUESTION_SCHOOL_SCHEMA_EN, repaired.output);
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
  return { status: "failed", error: "断语三次都不符合输出格式，请稍后重试", calls };
}
