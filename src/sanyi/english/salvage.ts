// src/sanyi/english/salvage.ts
// 英文输出的结构抢救：模型常把英文写得略长或多写字段，整份重写既慢又未必改对。
// 只处理两类问题——超长字段在句子边界截短、删去 Schema 不允许的多余字段；
// 其他结构问题（缺字段、枚举不符、条数不符）一律不抢救，交回原有重写流程。
import type { ErrorObject } from "ajv";
import type { StructuredOutputError } from "../../agent/provider.js";

type Container = Record<string, unknown> | unknown[];

function pointerSegments(pointer: string): string[] {
  return pointer.split("/").slice(1).map((part) => part.replace(/~1/gu, "/").replace(/~0/gu, "~"));
}

/** 按 JSON Pointer 找到父容器与末段键名。 */
function locate(root: unknown, pointer: string): { parent: Container; key: string } | undefined {
  const segments = pointerSegments(pointer);
  const key = segments.pop();
  if (key === undefined) return undefined;
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === null || typeof current !== "object") return undefined;
  return { parent: current as Container, key };
}

function lookup(root: unknown, pointer: string): unknown {
  let current: unknown = root;
  for (const segment of pointerSegments(pointer)) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** 截到上限以内：优先在句末（. ! ? ;）截断，不足四成时退到词边界并加省略号。 */
export function trimEnglishText(text: string, limit: number): string {
  const characters = [...text];
  if (characters.length <= limit) return text;
  const head = characters.slice(0, limit).join("");
  let sentenceEnd = -1;
  for (const match of head.matchAll(/[.!?;](?=\s|$)/gu)) {
    sentenceEnd = (match.index ?? 0) + 1;
  }
  if (sentenceEnd >= limit * 0.4) return head.slice(0, sentenceEnd).trim();
  const wordHead = characters.slice(0, limit - 1).join("");
  const space = wordHead.lastIndexOf(" ");
  const cut = space >= limit * 0.4 ? wordHead.slice(0, space) : wordHead;
  return `${cut.replace(/[\s,;:–-]+$/u, "")}…`;
}

/** 供 provider 的 salvage 钩子使用；无法抢救时返回 undefined。 */
export function salvageEnglishOutput(value: unknown, errors: readonly ErrorObject[]): unknown {
  if (value === null || typeof value !== "object" || errors.length === 0) return undefined;
  if (!errors.every((error) => error.keyword === "maxLength" || error.keyword === "additionalProperties")) {
    return undefined;
  }
  const copy = JSON.parse(JSON.stringify(value)) as unknown;
  for (const error of errors) {
    const params = error.params as Record<string, unknown>;
    if (error.keyword === "additionalProperties") {
      const owner = lookup(copy, error.instancePath);
      const extra = params.additionalProperty;
      if (owner && typeof owner === "object" && !Array.isArray(owner) && typeof extra === "string") {
        delete (owner as Record<string, unknown>)[extra];
      }
      continue;
    }
    const target = locate(copy, error.instancePath);
    const limit = Number(params.limit);
    if (!target || !Number.isFinite(limit)) return undefined;
    const current = (target.parent as Record<string, unknown>)[target.key];
    if (typeof current !== "string") return undefined;
    (target.parent as Record<string, unknown>)[target.key] = trimEnglishText(current, limit);
  }
  return copy;
}

/** 英文订单的结构重写提示：用英文说明哪个字段出了什么问题。 */
export function schemaHintsEn(error: StructuredOutputError): string[] {
  const hints = error.validationErrors.slice(0, 8).map((item) => {
    const path = item.instancePath || "/";
    const params = item.params as Record<string, unknown>;
    switch (item.keyword) {
      case "maxLength":
        return `Field ${path} is too long: keep it within ${String(params.limit)} characters `
          + `(about ${Math.round(Number(params.limit) / 6)} words).`;
      case "minLength":
        return `Field ${path} must not be empty.`;
      case "required":
        return `Field ${path} is missing ${String(params.missingProperty)}.`;
      case "additionalProperties":
        return `Field ${path} must not contain ${String(params.additionalProperty)}.`;
      case "enum":
      case "const":
        return `Field ${path} must use one of the allowed values.`;
      case "minItems":
        return `Field ${path} needs at least ${String(params.limit)} items.`;
      case "maxItems":
        return `Field ${path} allows at most ${String(params.limit)} items.`;
      default:
        return `Field ${path} does not match the schema (${item.keyword}).`;
    }
  });
  if (hints.length === 0) {
    return ["The output must be one complete, valid JSON object. Write more concisely so it is not cut off."];
  }
  return ["The output did not match the JSON Schema. Fix these and rewrite it in full:", ...hints];
}
