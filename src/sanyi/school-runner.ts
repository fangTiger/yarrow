// src/sanyi/school-runner.ts
import type { StructuredOutputProvider } from "../agent/provider.js";
import { auditOutput } from "./audit.js";
import type { FactTable } from "./facts.js";
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

export type SchoolRunResult =
  | { status: "done"; output: QuestionSchoolOutput; calls: number }
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
  for (let pass = 0; pass < 2; pass += 1) {
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
      const errors = validationErrors(output, input.facts);
      if (errors.length === 0) {
        return { status: "done", output, calls };
      }
      if (pass === 1) {
        return {
          status: "rejected",
          error: `断语未通过盘面核对：${errors.join("；")}`,
          calls,
        };
      }
      userPrompt = [
        basePrompt,
        "",
        "上一次输出未通过核对，请修正后完整重写：",
        ...errors.map((error) => `- ${error}`),
      ].join("\n");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: "failed", error: `模型调用失败：${message}`, calls };
    }
  }
  return { status: "rejected", error: "断语未通过盘面核对", calls };
}
