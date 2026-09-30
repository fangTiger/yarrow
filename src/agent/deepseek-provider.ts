import { hashJson, hashText } from "./audit.js";
import {
  StructuredOutputError,
  validateStructuredOutput,
  type ProviderAttemptAudit,
  type ProviderUsage,
  type StructuredOutputProvider,
  type StructuredOutputRequest,
} from "./provider.js";

export const DEEPSEEK_PROVIDER_CONFIG = Object.freeze({
  model: "deepseek-v4-flash",
  thinking: Object.freeze({ type: "disabled" }),
  response_format: Object.freeze({ type: "json_object" }),
  // 实际发送前会把完整 JSON Schema 追加到 system prompt；版本号进入上链配置哈希。
  prompt_transform_version: "json-schema-system-suffix-v1",
  base_url: "https://api.deepseek.com",
}) satisfies Readonly<Record<string, unknown>>;

export type DeepSeekFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface DeepSeekProviderOptions {
  environment?: NodeJS.ProcessEnv;
  fetch?: DeepSeekFetch;
  maxAttempts?: number;
  maxTokens?: number;
  timeoutMilliseconds?: number;
}

export class DeepSeekProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DeepSeekProviderError";
  }
}

interface DeepSeekEnvelope {
  choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
  usage?: Record<string, unknown>;
}

function nonNegativeInteger(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function usageFrom(value: unknown): ProviderUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  return {
    promptTokens: nonNegativeInteger(usage.prompt_tokens),
    completionTokens: nonNegativeInteger(usage.completion_tokens),
    promptCacheHitTokens: nonNegativeInteger(usage.prompt_cache_hit_tokens),
    promptCacheMissTokens: nonNegativeInteger(usage.prompt_cache_miss_tokens),
  };
}

function addUsage(target: ProviderUsage, usage: ProviderUsage | undefined): void {
  if (!usage) return;
  target.promptTokens += usage.promptTokens;
  target.completionTokens += usage.completionTokens;
  target.promptCacheHitTokens += usage.promptCacheHitTokens;
  target.promptCacheMissTokens += usage.promptCacheMissTokens;
}

export class DeepSeekProvider implements StructuredOutputProvider {
  readonly modelId = DEEPSEEK_PROVIDER_CONFIG.model;
  readonly providerConfig = DEEPSEEK_PROVIDER_CONFIG;
  readonly providerConfigHash = hashJson(DEEPSEEK_PROVIDER_CONFIG);
  readonly usageTotals: ProviderUsage = {
    promptTokens: 0,
    completionTokens: 0,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 0,
  };

  private readonly apiKey: string;
  private readonly fetchImplementation: DeepSeekFetch;
  private readonly maxAttempts: number;
  private readonly maxTokens: number;
  private readonly timeoutMilliseconds: number;

  constructor(options: DeepSeekProviderOptions = {}) {
    const environment = options.environment ?? process.env;
    const apiKey = environment.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      throw new DeepSeekProviderError(
        '缺少 DeepSeek 凭据。请确认进程从 .env 读取 DEEPSEEK_API_KEY；不会自动降级到 mock provider。',
      );
    }
    const configuredBaseUrl = (environment.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_PROVIDER_CONFIG.base_url)
      .replace(/\/+$/, "");
    if (configuredBaseUrl !== DEEPSEEK_PROVIDER_CONFIG.base_url) {
      throw new DeepSeekProviderError(
        `DEEPSEEK_BASE_URL 必须固定为 ${DEEPSEEK_PROVIDER_CONFIG.base_url}，当前值不符合上链配置承诺`,
      );
    }
    const maxAttempts = options.maxAttempts ?? 3;
    const maxTokens = options.maxTokens ?? 1_024;
    const timeoutMilliseconds = options.timeoutMilliseconds ?? 30_000;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) throw new DeepSeekProviderError("最大尝试次数必须是正整数");
    if (!Number.isSafeInteger(maxTokens) || maxTokens <= 0) throw new DeepSeekProviderError("max_tokens 必须是正整数");
    if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
      throw new DeepSeekProviderError("超时毫秒数必须是正整数");
    }
    this.apiKey = apiKey;
    this.fetchImplementation = options.fetch ?? fetch;
    this.maxAttempts = maxAttempts;
    this.maxTokens = maxTokens;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    const jsonInstruction = `请只返回一个合法 json 对象，不要输出 Markdown、代码围栏或额外说明。输出必须严格符合以下 JSON Schema，所有 required 字段都必须出现：${JSON.stringify(request.schema)}`;
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImplementation(`${DEEPSEEK_PROVIDER_CONFIG.base_url}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: DEEPSEEK_PROVIDER_CONFIG.model,
            max_tokens: this.maxTokens,
            thinking: DEEPSEEK_PROVIDER_CONFIG.thinking,
            response_format: DEEPSEEK_PROVIDER_CONFIG.response_format,
            messages: [
              { role: "system", content: `${request.systemPrompt}\n\n${jsonInstruction}` },
              { role: "user", content: request.userPrompt },
            ],
          }),
          signal: AbortSignal.timeout(this.timeoutMilliseconds),
        });
      } catch (error) {
        const audit: ProviderAttemptAudit = {
          attempt,
          result: "transport-error",
          errorHash: hashText(error instanceof Error ? `${error.name}:${error.message}` : String(error)),
        };
        await request.recordAttempt?.(audit);
        lastError = new DeepSeekProviderError(`DeepSeek 第 ${attempt} 次请求未产生输出`, { cause: error });
        if (attempt === this.maxAttempts) throw lastError;
        continue;
      }

      const responseBody = await response.text();
      if (!response.ok) {
        await request.recordAttempt?.({
          attempt,
          result: "http-error",
          httpStatus: response.status,
          errorHash: hashText(`${response.status}:${responseBody}`),
        });
        const error = new DeepSeekProviderError(`DeepSeek API 请求失败（HTTP ${response.status}）`);
        if ((response.status === 429 || response.status >= 500) && attempt < this.maxAttempts) {
          lastError = error;
          continue;
        }
        throw error;
      }

      let envelope: DeepSeekEnvelope;
      try {
        envelope = JSON.parse(responseBody) as DeepSeekEnvelope;
      } catch (error) {
        const rawOutputHash = hashText(responseBody);
        await request.recordAttempt?.({ attempt, result: "invalid-json", rawOutput: responseBody, rawOutputHash });
        lastError = new StructuredOutputError("DeepSeek HTTP 响应不是有效 JSON", [], { cause: error });
        if (attempt === this.maxAttempts) throw lastError;
        continue;
      }

      const usage = usageFrom(envelope.usage);
      addUsage(this.usageTotals, usage);
      const content = envelope.choices?.[0]?.message?.content;
      const rawOutput = typeof content === "string" ? content : "";
      const rawOutputHash = hashText(rawOutput);
      let value: unknown;
      try {
        value = JSON.parse(rawOutput);
      } catch (error) {
        await request.recordAttempt?.({
          attempt,
          result: "invalid-json",
          rawOutput,
          rawOutputHash,
          ...(usage ? { usage } : {}),
        });
        lastError = new StructuredOutputError("DeepSeek 输出不是有效 JSON", [], { cause: error });
        if (attempt === this.maxAttempts) throw lastError;
        continue;
      }

      try {
        const output = validateStructuredOutput<T>(request.schema, value);
        await request.recordAttempt?.({
          attempt,
          result: "valid",
          rawOutput,
          rawOutputHash,
          ...(usage ? { usage } : {}),
        });
        return output;
      } catch (error) {
        if (!(error instanceof StructuredOutputError)) throw error;
        await request.recordAttempt?.({
          attempt,
          result: "schema-invalid",
          rawOutput,
          rawOutputHash,
          ...(usage ? { usage } : {}),
        });
        lastError = error;
        if (attempt === this.maxAttempts) throw error;
      }
    }
    throw lastError ?? new DeepSeekProviderError("DeepSeek 未产生合法输出");
  }
}
