// src/sanyi/bazi-school-runner.ts
import { StructuredOutputError, validateStructuredOutput,
  type StructuredOutputProvider } from "../agent/provider.js";
import { auditBaziOutput } from "./bazi-audit.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA, checkBaziConsistency, type BaziSchoolOutput,
  } from "./bazi-schema.js";
import { selectBaziFacts, type BaziSchool, type BaziSchoolInput } from "./schools/bazi-shared.js";
export type BaziSchoolRunResult = {
  status: "done";
  output: BaziSchoolOutput;
  calls: number;
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
    let userPrompt = basePrompt;
    let errors: string[] = [];
    for (let pass = 0; pass < 2; pass += 1) {
      calls += 1;
      try {
        const raw = await deps.provider.generateStructured<unknown>({
          taskId: `sanyi/${input.kind}/${input.school.key}`,
          systemPrompt: input.school.systemPrompt, cacheSystemPrompt: true,
          userPrompt, schema, effort: "medium",
        });
        // 不假设 provider 一定做过校验；Schema 失败也进入一次重写。
        const output = validateStructuredOutput<BaziSchoolOutput>(schema, raw);
        errors = [...checkBaziConsistency(output, input.chart, input.horizon),
          ...auditBaziOutput(output, facts).errors];
        if (errors.length === 0) {
          return { status: "done", output, calls };
        }
      }
      catch (error) {
        if (!(error instanceof StructuredOutputError)) {
          return { status: "failed", error: "模型调用失败，请稍后重试", calls };
        }
        errors = ["输出字段、类型、分项顺序或字数不符合 JSON Schema，请按规定完整重写"];
      }
      userPrompt = [basePrompt, "", "上一次输出未通过核对，请修正后完整重写：",
        ...errors.map((error) => `- ${error}`)].join("\n");
    }
    return { status: "failed", error: `断语未通过盘面核对：${errors.join("；")}`, calls };
  }
  catch {
    return { status: "failed", error: "三家输入组装失败，请检查事实表", calls };
  }
}
