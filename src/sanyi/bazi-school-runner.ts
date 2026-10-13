// src/sanyi/bazi-school-runner.ts
import { StructuredOutputError, validateStructuredOutput,
  type StructuredOutputProvider } from "../agent/provider.js";
import { auditBaziOutput } from "./bazi-audit.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA, baziLanguageErrors,
  checkBaziConsistency, type BaziSchoolOutput,
  } from "./bazi-schema.js";
import { repairBazi } from "./repair.js";
import { schemaHints } from "./schema-hints.js";
import { baziSystemPrompt, selectBaziFacts, type BaziSchool,
  type BaziSchoolInput } from "./schools/bazi-shared.js";

/** 每家最多三次调用：首次加两次带错误说明的重写。 */
const MAX_CALLS = 3;

export type BaziSchoolRunResult = {
  status: "done";
  output: BaziSchoolOutput;
  calls: number;
  /** 删错留对时删去的处数；一次通过时为 0。 */
  removed: number;
  /** 删错留对时校正的吉凶把握处数；一次通过时为 0。 */
  adjusted: number;
} | {
  status: "failed";
  error: string;
  calls: number;
};

export async function runBaziSchool(deps: {
  provider: StructuredOutputProvider;
}, input: BaziSchoolInput & {
  school: BaziSchool;
}): Promise<BaziSchoolRunResult> {
  const schema = input.kind === "destiny" ? DESTINY_SCHOOL_SCHEMA : FORTUNE_SCHOOL_SCHEMA;
  let calls = 0;
  try {
    const facts = selectBaziFacts(input.school.key, input);
    const basePrompt = input.school.buildUserPrompt(input);
    const systemPrompt = baziSystemPrompt(input.school, input.kind);
    let userPrompt = basePrompt;
    let errors: string[] = [];
    // 最后一次结构合格的输出：三次都不过核对时据此删错留对。
    let lastValid: BaziSchoolOutput | undefined;
    for (let pass = 0; pass < MAX_CALLS; pass += 1) {
      calls += 1;
      try {
        const raw = await deps.provider.generateStructured<unknown>({
          taskId: `sanyi/${input.kind}/${input.school.key}`,
          systemPrompt, cacheSystemPrompt: true,
          userPrompt, schema, effort: "medium",
        });
        // 不假设 provider 一定做过校验；Schema 失败也进入重写。
        const output = validateStructuredOutput<BaziSchoolOutput>(schema, raw);
        lastValid = output;
        errors = [...checkBaziConsistency(output, input.chart, input.horizon),
          ...auditBaziOutput(output, facts).errors];
        if (errors.length === 0) {
          return { status: "done", output, calls, removed: 0, adjusted: 0 };
        }
      } catch (error) {
        if (!(error instanceof StructuredOutputError)) {
          return { status: "failed", error: "模型调用失败，请稍后重试", calls };
        }
        errors = schemaHints(error);
      }
      userPrompt = [basePrompt, "", "上一次输出未通过核对，请修正后完整重写：",
        ...errors.map((error) => `- ${error}`)].join("\n");
    }
    if (lastValid) {
      const repaired = repairBazi(lastValid, facts, input.chart, input.horizon);
      if (baziLanguageErrors(repaired.output).length === 0) {
        return {
          status: "done", output: repaired.output, calls,
          removed: repaired.removed, adjusted: repaired.adjusted,
        };
      }
    }
    return { status: "failed", error: "断语三次都不符合输出格式，请稍后重试", calls };
  } catch {
    return { status: "failed", error: "三家输入组装失败，请检查事实表", calls };
  }
}
