// src/sanyi/school-runner.ts
import { StructuredOutputError, type StructuredOutputProvider } from "../agent/provider.js";
import { auditOutput } from "./audit.js";
import type { FactTable } from "./facts.js";
import { repairQuestion } from "./repair.js";
import { schemaHints } from "./schema-hints.js";
import {
  QUESTION_SCHOOL_SCHEMA,
  checkVerdictConsistency,
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
): string[] {
  return [
    ...checkVerdictConsistency(output),
    ...auditOutput(output, facts).errors,
  ];
}

export async function runSchool(
  deps: SchoolRunDependencies,
  input: SchoolRunInput,
): Promise<SchoolRunResult> {
  const basePrompt = input.school.buildUserPrompt(input);
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
        systemPrompt: input.school.systemPrompt,
        cacheSystemPrompt: true,
        userPrompt,
        schema: QUESTION_SCHOOL_SCHEMA,
        effort: "medium",
      });
      lastValid = output;
      errors = validationErrors(output, input.facts);
      if (errors.length === 0) {
        return { status: "done", output, calls, removed: 0, adjusted: 0 };
      }
    } catch (error) {
      if (!(error instanceof StructuredOutputError)) {
        const message = error instanceof Error ? error.message : String(error);
        return { status: "failed", error: `模型调用失败：${message}`, calls };
      }
      // 结构不合 Schema 时带具体字段提示重写，不当作调用失败。
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
    const repaired = repairQuestion(lastValid, input.facts);
    return {
      status: "done", output: repaired.output, calls,
      removed: repaired.removed, adjusted: repaired.adjusted,
    };
  }
  return { status: "failed", error: "断语三次都不符合输出格式，请稍后重试", calls };
}
