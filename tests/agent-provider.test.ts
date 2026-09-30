import assert from "node:assert/strict";
import test from "node:test";

import type Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages/messages.js";

import { AnthropicProvider } from "../src/agent/anthropic-provider.js";
import {
  DEEPSEEK_PROVIDER_CONFIG,
  DeepSeekProvider,
  DeepSeekProviderError,
  type DeepSeekFetch,
} from "../src/agent/deepseek-provider.js";
import { hashJson, hashText } from "../src/agent/audit.js";
import { createDefaultProvider } from "../src/agent/default-provider.js";
import {
  DeterministicMockProvider,
  StructuredOutputError,
  type ProviderAttemptAudit,
} from "../src/agent/provider.js";
import { PREDICTION_OUTPUT_SCHEMA, type DivinerOutput } from "../src/agent/schemas.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function deepSeekResponse(content: string, usage: Record<string, number> = {}): Response {
  return jsonResponse({
    choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: {
      prompt_tokens: 205,
      completion_tokens: 182,
      prompt_cache_hit_tokens: 180,
      prompt_cache_miss_tokens: 25,
      ...usage,
    },
  });
}

function request(recordAttempt?: (attempt: ProviderAttemptAudit) => Promise<void>) {
  return {
    taskId: "diviner/takashima",
    systemPrompt: "稳定系统提示词",
    cacheSystemPrompt: true,
    userPrompt: "请判断固定命题",
    schema: PREDICTION_OUTPUT_SCHEMA,
    effort: "high" as const,
    ...(recordAttempt ? { recordAttempt } : {}),
  };
}

test("DeepSeek provider 缺少凭据时在网络调用前失败且不回退到 mock", () => {
  assert.throws(
    () => new DeepSeekProvider({ environment: {} }),
    (error: unknown) => {
      assert.ok(error instanceof DeepSeekProviderError);
      assert.match(error.message, /DEEPSEEK_API_KEY/);
      assert.doesNotMatch(error.message, /ANTHROPIC_API_KEY/);
      return true;
    },
  );
});

test("默认真实 provider 明确选择 DeepSeek，mock 只能显式构造", () => {
  const provider = createDefaultProvider({
    environment: { DEEPSEEK_API_KEY: "测试占位值" },
    fetch: async () => deepSeekResponse('{"direction":"YES","probabilityBps":5100,"reasoning":"不会调用"}'),
  });
  assert.ok(provider instanceof DeepSeekProvider);
  assert.equal(provider.modelId, "deepseek-v4-flash");
  assert.equal(provider instanceof DeterministicMockProvider, false);
});

test("DeepSeek provider 固定 V4-Flash、禁用思考、JSON 模式和 base URL，不发送采样参数", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fakeFetch: DeepSeekFetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return deepSeekResponse('{"direction":"YES","probabilityBps":6100,"reasoning":"测试判断"}');
  };
  const provider = new DeepSeekProvider({
    environment: {
      DEEPSEEK_API_KEY: "仅用于单元测试的占位值",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com/",
    },
    fetch: fakeFetch,
  });

  const output = await provider.generateStructured<DivinerOutput>(request());

  assert.deepEqual(output, { direction: "YES", probabilityBps: 6100, reasoning: "测试判断" });
  assert.deepEqual(provider.providerConfig, DEEPSEEK_PROVIDER_CONFIG);
  assert.equal(provider.providerConfigHash, hashJson(DEEPSEEK_PROVIDER_CONFIG));
  assert.equal(DEEPSEEK_PROVIDER_CONFIG.prompt_transform_version, "json-schema-system-suffix-v1");
  assert.equal(capturedUrl, "https://api.deepseek.com/chat/completions");
  assert.ok(capturedInit);
  assert.equal((capturedInit.headers as Record<string, string>).authorization, "Bearer 仅用于单元测试的占位值");
  const body = JSON.parse(String(capturedInit.body)) as Record<string, unknown>;
  assert.equal(body.model, "deepseek-v4-flash");
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal("temperature" in body, false);
  assert.equal("top_p" in body, false);
  assert.equal("top_k" in body, false);
  assert.match(JSON.stringify(body.messages), /json/);
  assert.match(JSON.stringify(body.messages), /JSON Schema/);
  assert.match(JSON.stringify(body.messages), /required/);
});

test("DeepSeek 只在非法 JSON 或 schema 失败后重试，并记录每次原始输出哈希", async () => {
  const raw = [
    "这不是 JSON",
    '{"direction":"YES","probabilityBps":9901,"reasoning":"越界"}',
    '{"direction":"NO","probabilityBps":4200,"reasoning":"首个合法输出"}',
  ];
  let calls = 0;
  const audits: ProviderAttemptAudit[] = [];
  const provider = new DeepSeekProvider({
    environment: { DEEPSEEK_API_KEY: "测试占位值" },
    maxAttempts: 5,
    fetch: async () => deepSeekResponse(raw[calls++]!),
  });

  const output = await provider.generateStructured<DivinerOutput>(request(async (audit) => {
    audits.push(audit);
  }));

  assert.deepEqual(output, { direction: "NO", probabilityBps: 4200, reasoning: "首个合法输出" });
  assert.equal(calls, 3);
  assert.deepEqual(audits.map((audit) => audit.result), ["invalid-json", "schema-invalid", "valid"]);
  assert.deepEqual(audits.map((audit) => audit.rawOutputHash), raw.map(hashText));
  assert.deepEqual(audits.map((audit) => audit.attempt), [1, 2, 3]);
  assert.equal(audits.every((audit) => audit.usage?.promptTokens === 205), true);
});

test("DeepSeek 拿到首个合法输出后绝不再次生成，即使后续也预置了合法候选", async () => {
  const responses = [
    '{"direction":"YES","probabilityBps":5100,"reasoning":"必须采用的首个合法输出"}',
    '{"direction":"YES","probabilityBps":9900,"reasoning":"禁止获取的更强候选"}',
  ];
  let calls = 0;
  const audits: ProviderAttemptAudit[] = [];
  const provider = new DeepSeekProvider({
    environment: { DEEPSEEK_API_KEY: "测试占位值" },
    maxAttempts: 5,
    fetch: async () => deepSeekResponse(responses[calls++]!),
  });

  const output = await provider.generateStructured<DivinerOutput>(request(async (audit) => {
    audits.push(audit);
  }));

  assert.equal(output.probabilityBps, 5100);
  assert.equal(output.reasoning, "必须采用的首个合法输出");
  assert.equal(calls, 1, "首个合法输出后不得继续请求或比较候选");
  assert.equal(audits.length, 1);
  assert.equal(audits[0]!.result, "valid");
  assert.equal(audits[0]!.rawOutputHash, hashText(responses[0]!));
});

test("DeepSeek 对 5xx 与连接失败可重试，但配置类 4xx 立即失败", async () => {
  let retryCalls = 0;
  const retryAudits: ProviderAttemptAudit[] = [];
  const retrying = new DeepSeekProvider({
    environment: { DEEPSEEK_API_KEY: "测试占位值" },
    maxAttempts: 4,
    fetch: async () => {
      retryCalls += 1;
      if (retryCalls === 1) throw new TypeError("连接失败");
      if (retryCalls === 2) return jsonResponse({ error: { message: "服务暂不可用" } }, 503);
      return deepSeekResponse('{"direction":"YES","probabilityBps":5500,"reasoning":"恢复后合法"}');
    },
  });
  const recovered = await retrying.generateStructured<DivinerOutput>(request(async (audit) => {
    retryAudits.push(audit);
  }));
  assert.equal(recovered.probabilityBps, 5500);
  assert.equal(retryCalls, 3);
  assert.deepEqual(retryAudits.map((audit) => audit.result), ["transport-error", "http-error", "valid"]);
  assert.equal(retryAudits[0]!.rawOutputHash, undefined);
  assert.equal(retryAudits[1]!.httpStatus, 503);

  let clientErrorCalls = 0;
  const clientError = new DeepSeekProvider({
    environment: { DEEPSEEK_API_KEY: "测试占位值" },
    maxAttempts: 4,
    fetch: async () => {
      clientErrorCalls += 1;
      return jsonResponse({ error: { message: "请求配置错误" } }, 400);
    },
  });
  await assert.rejects(clientError.generateStructured(request()), DeepSeekProviderError);
  assert.equal(clientErrorCalls, 1);
});

test("真实 provider 缺少凭据时在调用网络前给出明确配置指引", () => {
  assert.throws(
    () => new AnthropicProvider({ environment: {} }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /ANTHROPIC_API_KEY/);
      assert.match(error.message, /export ANTHROPIC_API_KEY=/);
      assert.match(error.message, /重启/);
      return true;
    },
  );
});

test("Anthropic provider 使用 Opus 5 的受支持参数与 ephemeral system prompt", async () => {
  let captured: MessageCreateParamsNonStreaming | undefined;
  let capturedOptions: unknown;
  const fakeClient = {
    messages: {
      create: async (params: MessageCreateParamsNonStreaming, options?: unknown) => {
        captured = params;
        capturedOptions = options;
        return {
          content: [{ type: "text", text: '{"direction":"YES","probabilityBps":6100,"reasoning":"测试判断"}' }],
        };
      },
    },
  } as unknown as Anthropic;
  const provider = new AnthropicProvider({
    environment: { ANTHROPIC_API_KEY: "仅用于单元测试的占位值" },
    client: fakeClient,
  });

  const output = await provider.generateStructured<DivinerOutput>({
    taskId: "diviner/takashima",
    systemPrompt: "稳定系统提示词",
    cacheSystemPrompt: true,
    userPrompt: "变化输入",
    schema: PREDICTION_OUTPUT_SCHEMA,
    effort: "high",
  });

  assert.deepEqual(output, { direction: "YES", probabilityBps: 6100, reasoning: "测试判断" });
  assert.ok(captured);
  assert.equal(captured.model, "claude-opus-5");
  assert.equal(captured.max_tokens, 16_000);
  assert.deepEqual(captured.thinking, { type: "adaptive" });
  assert.deepEqual(captured.output_config, {
    effort: "high",
    format: { type: "json_schema", schema: PREDICTION_OUTPUT_SCHEMA },
  });
  assert.deepEqual(captured.system, [
    { type: "text", text: "稳定系统提示词", cache_control: { type: "ephemeral" } },
  ]);
  assert.deepEqual(captured.messages, [{ role: "user", content: "变化输入" }]);
  assert.deepEqual(capturedOptions, { maxRetries: 0 });
  const raw = captured as unknown as Record<string, unknown>;
  assert.equal("temperature" in raw, false);
  assert.equal("top_p" in raw, false);
  assert.equal("top_k" in raw, false);
  assert.equal("budget_tokens" in (captured.thinking as unknown as Record<string, unknown>), false);
  assert.equal("output_format" in raw, false);
  assert.equal(captured.messages.some((message) => message.role === "assistant"), false);
});

test("确定性 mock provider 显式使用固定结果并同样执行 schema 校验", async () => {
  const provider = new DeterministicMockProvider("mock-yijing-v1", {
    "diviner/takashima": { direction: "NO", probabilityBps: 4200, reasoning: "固定输出" },
  });

  const first = await provider.generateStructured<DivinerOutput>({
    taskId: "diviner/takashima",
    systemPrompt: "系统",
    cacheSystemPrompt: true,
    userPrompt: "输入一",
    schema: PREDICTION_OUTPUT_SCHEMA,
    effort: "low",
  });
  const second = await provider.generateStructured<DivinerOutput>({
    taskId: "diviner/takashima",
    systemPrompt: "系统",
    cacheSystemPrompt: true,
    userPrompt: "输入二",
    schema: PREDICTION_OUTPUT_SCHEMA,
    effort: "low",
  });

  assert.deepEqual(first, second);
  assert.equal(provider.callCount("diviner/takashima"), 2);

  const invalid = new DeterministicMockProvider("mock-yijing-v1", {
    "diviner/takashima": { direction: "YES", probabilityBps: 9_901, reasoning: "越界" },
  });
  await assert.rejects(
    invalid.generateStructured({
      taskId: "diviner/takashima",
      systemPrompt: "系统",
      cacheSystemPrompt: true,
      userPrompt: "输入",
      schema: PREDICTION_OUTPUT_SCHEMA,
      effort: "low",
    }),
    StructuredOutputError,
  );
});
