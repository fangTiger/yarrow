// src/sanyi/schema-hints.ts
import type { StructuredOutputError } from "../agent/provider.js";

// 把 Ajv 校验错误转成中文提示，告诉模型具体哪个字段违反了什么限制。
export function schemaHints(error: StructuredOutputError): string[] {
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
