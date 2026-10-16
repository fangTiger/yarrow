import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";

import { canonicalJson, hashJson, hashText } from "./audit.js";
import type { JsonSchema } from "./schemas.js";

export type ProviderEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface StructuredOutputRequest {
  taskId: string;
  systemPrompt: string;
  cacheSystemPrompt: boolean;
  userPrompt: string;
  schema: JsonSchema;
  effort: ProviderEffort;
  recordAttempt?: (attempt: ProviderAttemptAudit) => Promise<void>;
  /**
   * 可选的结构抢救：输出不合 Schema 时先交给它修补（如截短超长字段、删去多余字段），
   * 修补后仍须通过 Schema。返回 undefined 表示无法抢救，按原逻辑重试。
   */
  salvage?: (value: unknown, errors: readonly ErrorObject[]) => unknown;
}

export interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
  promptCacheHitTokens: number;
  promptCacheMissTokens: number;
}

export type ProviderAttemptResult =
  | "transport-error"
  | "http-error"
  | "invalid-json"
  | "schema-invalid"
  | "valid";

export interface ProviderAttemptAudit {
  attempt: number;
  result: ProviderAttemptResult;
  rawOutputHash?: `0x${string}`;
  /** 仅供需要崩溃恢复的调用方在同一次 fsync 中保存；常规审计日志可主动剔除。 */
  rawOutput?: string;
  errorHash?: `0x${string}`;
  httpStatus?: number;
  usage?: ProviderUsage;
}

export interface StructuredOutputProvider {
  readonly modelId: string;
  readonly providerConfig: Readonly<Record<string, unknown>>;
  readonly providerConfigHash: `0x${string}`;
  generateStructured<T>(request: StructuredOutputRequest): Promise<T>;
}

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    readonly validationErrors: readonly ErrorObject[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StructuredOutputError";
  }
}

const ajv = new Ajv({ allErrors: true, strict: true });
const validators = new WeakMap<JsonSchema, ValidateFunction>();

/** 先按 Schema 校验；不合格且请求提供了 salvage 时，用修补结果再校验一次。 */
export function validateWithSalvage<T>(
  request: Pick<StructuredOutputRequest, "schema" | "salvage">,
  value: unknown,
): T {
  try {
    return validateStructuredOutput<T>(request.schema, value);
  } catch (error) {
    if (!(error instanceof StructuredOutputError) || !request.salvage) throw error;
    const repaired = request.salvage(value, error.validationErrors);
    if (repaired === undefined) throw error;
    return validateStructuredOutput<T>(request.schema, repaired);
  }
}

export function validateStructuredOutput<T>(schema: JsonSchema, value: unknown): T {
  const cached = validators.get(schema);
  const validate: ValidateFunction = cached ?? ajv.compile(schema);
  if (!cached) validators.set(schema, validate);
  if (!validate(value)) {
    throw new StructuredOutputError("结构化输出不符合 JSON Schema", validate.errors ?? []);
  }
  return value as T;
}

type MockFixture = unknown | ((request: StructuredOutputRequest, callIndex: number) => unknown | Promise<unknown>);

/** 显式测试 provider；不会被真实 provider 自动选中。 */
export class DeterministicMockProvider implements StructuredOutputProvider {
  private readonly calls = new Map<string, number>();
  readonly providerConfig: Readonly<Record<string, unknown>>;
  readonly providerConfigHash: `0x${string}`;

  constructor(
    readonly modelId: string,
    private readonly fixtures: Readonly<Record<string, MockFixture>>,
  ) {
    this.providerConfig = Object.freeze({ kind: "deterministic-mock", model: modelId });
    this.providerConfigHash = hashJson(this.providerConfig);
  }

  callCount(taskId: string): number {
    return this.calls.get(taskId) ?? 0;
  }

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    const fixture = this.fixtures[request.taskId];
    if (fixture === undefined) throw new Error(`mock provider 缺少任务 ${request.taskId} 的固定输出`);
    const callIndex = this.callCount(request.taskId);
    this.calls.set(request.taskId, callIndex + 1);
    const value = typeof fixture === "function" ? await fixture(request, callIndex) : fixture;
    const rawOutput = canonicalJson(value);
    try {
      const validated = validateWithSalvage<T>(request, value);
      await request.recordAttempt?.({
        attempt: callIndex + 1,
        result: "valid",
        rawOutput,
        rawOutputHash: hashText(rawOutput),
      });
      return validated;
    } catch (error) {
      await request.recordAttempt?.({
        attempt: callIndex + 1,
        result: "schema-invalid",
        rawOutput,
        rawOutputHash: hashText(rawOutput),
      });
      throw error;
    }
  }
}
