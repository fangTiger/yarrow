import Anthropic from "@anthropic-ai/sdk";

import {
  StructuredOutputError,
  validateStructuredOutput,
  type StructuredOutputProvider,
  type StructuredOutputRequest,
} from "./provider.js";
import { hashJson, hashText } from "./audit.js";

export class AnthropicProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AnthropicProviderError";
  }
}

export interface AnthropicProviderOptions {
  environment?: NodeJS.ProcessEnv;
  client?: Anthropic;
}

export class AnthropicProvider implements StructuredOutputProvider {
  readonly modelId = "claude-opus-5";
  readonly providerConfig = Object.freeze({
    model: "claude-opus-5",
    thinking: Object.freeze({ type: "adaptive" }),
    output_config: Object.freeze({ type: "json_schema" }),
    max_retries: 0,
  });
  readonly providerConfigHash = hashJson(this.providerConfig);
  private readonly client: Anthropic;

  constructor(options: AnthropicProviderOptions = {}) {
    const environment = options.environment ?? process.env;
    if (!environment.ANTHROPIC_API_KEY?.trim()) {
      throw new AnthropicProviderError(
        '缺少 Anthropic 凭据。请在你自己的终端执行 export ANTHROPIC_API_KEY="你的密钥"，然后重启当前会话；不会自动降级到 mock provider。',
      );
    }
    // 零参构造让官方 SDK 按其标准规则读取凭据。
    this.client = options.client ?? new Anthropic();
  }

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: request.userPrompt }];
    const system: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: request.systemPrompt,
        ...(request.cacheSystemPrompt ? { cache_control: { type: "ephemeral" as const } } : {}),
      },
    ];
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.modelId,
      max_tokens: 16_000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: request.effort,
        format: { type: "json_schema", schema: request.schema },
      },
      system,
      messages,
    };

    try {
      // SDK 默认会自动重试 429/5xx 等错误；本系统为保证每轮唯一生成必须关闭。
      const response = await this.client.messages.create(params, { maxRetries: 0 });
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      if (!text) {
        await request.recordAttempt?.({ attempt: 1, result: "invalid-json", rawOutput: "", rawOutputHash: hashText("") });
        throw new StructuredOutputError("Anthropic 响应没有结构化文本块");
      }
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch (error) {
        await request.recordAttempt?.({ attempt: 1, result: "invalid-json", rawOutput: text, rawOutputHash: hashText(text) });
        throw new StructuredOutputError("Anthropic 结构化响应不是有效 JSON", [], { cause: error });
      }
      try {
        const output = validateStructuredOutput<T>(request.schema, value);
        await request.recordAttempt?.({ attempt: 1, result: "valid", rawOutput: text, rawOutputHash: hashText(text) });
        return output;
      } catch (error) {
        if (error instanceof StructuredOutputError) {
          await request.recordAttempt?.({ attempt: 1, result: "schema-invalid", rawOutput: text, rawOutputHash: hashText(text) });
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof StructuredOutputError) throw error;
      if (error instanceof Anthropic.RateLimitError) {
        await request.recordAttempt?.({ attempt: 1, result: "http-error", httpStatus: error.status, errorHash: hashText(`${error.status}:${error.name}`) });
        throw new AnthropicProviderError("Anthropic API 已限流，请稍后由操作员发起新的独立轮次", { cause: error });
      }
      if (error instanceof Anthropic.AuthenticationError) {
        await request.recordAttempt?.({ attempt: 1, result: "http-error", httpStatus: error.status, errorHash: hashText(`${error.status}:${error.name}`) });
        throw new AnthropicProviderError("Anthropic API 凭据无效，请更新凭据并重启当前会话", { cause: error });
      }
      if (error instanceof Anthropic.APIConnectionError) {
        await request.recordAttempt?.({ attempt: 1, result: "transport-error", errorHash: hashText(error.name) });
        throw new AnthropicProviderError("无法连接 Anthropic API，本轮不会自动重跑", { cause: error });
      }
      if (error instanceof Anthropic.APIError) {
        await request.recordAttempt?.({ attempt: 1, result: "http-error", httpStatus: error.status, errorHash: hashText(`${error.status}:${error.name}`) });
        throw new AnthropicProviderError(`Anthropic API 请求失败（HTTP ${error.status}），本轮不会自动重跑`, {
          cause: error,
        });
      }
      throw error;
    }
  }
}
