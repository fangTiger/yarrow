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
// 把 Ajv 校验错误转成中文提示，告诉模型具体哪个字段违反了什么限制。
function schemaHints(error: StructuredOutputError): string[] {
  const hints = error.validationErrors.slice(0, 8).map((item) => {
    const path = item.instancePath || "/";
    const params = item.params as Record<string, unknown>;
    if (item.keyword === "maxLength") {
      return `字段 ${path} 不超过 ${String(params.limit)} 字`;
    }
    if (item.keyword === "minLength") {
      return `字段 ${path} 不少于 ${String(params.limit)} 字`;
    }
    if (item.keyword === "required") {
      return `字段 ${path} 缺少 ${String(params.missingProperty)}`;
    }
    if (item.keyword === "additionalProperties") {
      return `字段 ${path} 不得包含 ${String(params.additionalProperty)}`;
    }
    if (item.keyword === "enum" || item.keyword === "const") {
      return `字段 ${path} 取值不在允许范围内`;
    }
    if (item.keyword === "minItems" || item.keyword === "maxItems") {
      return `字段 ${path} 项数须${item.keyword === "minItems" ? "不少于" : "不超过"} ${String(params.limit)}`;
    }
    return `字段 ${path} 不符合要求（${item.keyword}）`;
  });
  if (hints.length === 0) {
    // 没有逐项错误时多为输出截断或非 JSON。
    return ["输出须为一个完整、有效的 JSON 对象，请精简措辞，避免过长被截断"];
  }
  return ["输出不符合 JSON Schema，请按以下各项修正后完整重写：", ...hints];
}
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
        errors = schemaHints(error);
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
