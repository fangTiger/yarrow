import { DeepSeekProvider, type DeepSeekFetch } from "../agent/deepseek-provider.js";
import { DeterministicMockProvider, type ProviderUsage, type StructuredOutputProvider, type StructuredOutputRequest } from "../agent/provider.js";
import { estimateDeepSeekUsagePeakUsd } from "../deepseek-budget.js";
import type { DemoMode } from "./service.js";

export const DEMO_LIVE_CALL_LIMIT = 4;
export const DEMO_LIVE_PROVIDER_TIMEOUT_MS = 5_000;
export const DEMO_LIVE_INFERENCE_BUDGET_MS = DEMO_LIVE_CALL_LIMIT * DEMO_LIVE_PROVIDER_TIMEOUT_MS;
export const DEMO_LIVE_MAX_PROMPT_CHARACTERS = 4_800;
export const DEMO_LIVE_MAX_COMPLETION_TOKENS = 512;
export const DEMO_LIVE_BUDGET_CNY = 0.3;
const BUDGET_CNY_PER_USD = 8;

export interface DemoProviderOptions {
  confirmLive?: boolean;
  environment?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetch?: DeepSeekFetch;
}

interface CalibratedCandidate {
  predicateId: `0x${string}`;
  params: `0x${string}`;
}

function firstCalibratedCandidate(request: StructuredOutputRequest): CalibratedCandidate & { reasoning: string } {
  const marker = "链上已核验、难度已校准且可进入押注层的候选谓词：\n";
  const serialized = request.userPrompt.split(marker)[1];
  if (!serialized) throw new Error("mock 命题编译器未收到难度校准候选");
  const candidates = JSON.parse(serialized) as CalibratedCandidate[];
  const candidate = candidates[0];
  if (!candidate) throw new Error("mock 命题编译器没有可测量候选");
  return {
    predicateId: candidate.predicateId,
    params: candidate.params,
    reasoning: "采用链上已核验且完成历史难度校准的首个谓词。",
  };
}

export function requireLiveConfirmation(confirmed: boolean): void {
  if (!confirmed) throw new Error("live 模式必须显式确认后才能构造真实 provider");
}

/**
 * 按每个 Unicode 字符最多四个 token、峰时单价与 8 CNY/USD 计算保守上界。
 * 该门禁不依赖余额接口或演示时刻，避免在任何交易后才发现模型预算不足。
 */
export function liveBudgetUpperBoundCny(): number {
  const usage: ProviderUsage = {
    promptTokens: DEMO_LIVE_CALL_LIMIT * DEMO_LIVE_MAX_PROMPT_CHARACTERS * 4,
    completionTokens: DEMO_LIVE_CALL_LIMIT * DEMO_LIVE_MAX_COMPLETION_TOKENS,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: DEMO_LIVE_CALL_LIMIT * DEMO_LIVE_MAX_PROMPT_CHARACTERS * 4,
  };
  return estimateDeepSeekUsagePeakUsd(usage) * BUDGET_CNY_PER_USD;
}

export interface UsageTrackedDemoProvider extends StructuredOutputProvider {
  readonly usageTotals: ProviderUsage;
}

class BudgetedLiveProvider implements UsageTrackedDemoProvider {
  private calls = 0;

  constructor(private readonly inner: DeepSeekProvider) {}

  get modelId(): string {
    return this.inner.modelId;
  }

  get providerConfig(): Readonly<Record<string, unknown>> {
    return this.inner.providerConfig;
  }

  get providerConfigHash(): `0x${string}` {
    return this.inner.providerConfigHash;
  }

  get usageTotals(): ProviderUsage {
    return this.inner.usageTotals;
  }

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    if (this.calls >= DEMO_LIVE_CALL_LIMIT) throw new Error(`live provider 调用次数超过 ${DEMO_LIVE_CALL_LIMIT} 次硬上限`);
    const promptCharacters = request.systemPrompt.length + request.userPrompt.length + JSON.stringify(request.schema).length + 96;
    if (promptCharacters > DEMO_LIVE_MAX_PROMPT_CHARACTERS) {
      throw new Error(`live provider 提示长度超过 ${DEMO_LIVE_MAX_PROMPT_CHARACTERS} 字符硬上限`);
    }
    this.calls += 1;
    return this.inner.generateStructured<T>(request);
  }
}

export function isUsageTrackedDemoProvider(provider: StructuredOutputProvider): provider is UsageTrackedDemoProvider {
  return "usageTotals" in provider;
}

/** mock 保留为零成本排练选项；live 不重试，避免一次演示因重试放大模型费用。 */
export function createDemoProvider(mode: DemoMode, options: DemoProviderOptions = {}): StructuredOutputProvider {
  if (mode === "mock") {
    return new DeterministicMockProvider("mock-yijing-demo-v1", {
      "proposition-compiler": firstCalibratedCandidate,
      "diviner/takashima": {
        direction: "YES",
        probabilityBps: 6_100,
        reasoning: "时势可进，但卦象到具体人间问题仍有解释跳跃，故只取温和偏是。",
      },
      "diviner/wuxing": {
        direction: "NO",
        probabilityBps: 4_200,
        reasoning: "用神与所问之事并不相合，在承认解释跳跃后取谨慎偏否。",
      },
      "diviner/meihua": {
        direction: "YES",
        probabilityBps: 5_700,
        reasoning: "外应略有动象，但证据很弱，只给接近中性的偏是判断。",
      },
      "question-reading/takashima": {
        interpretation: "本卦看现实处境，变卦看行动后的变化。",
        counsel: "写下继续与离开各自最具体的一项代价。",
      },
      "question-reading/wuxing": {
        interpretation: "互卦辨症结，错卦看反面。",
        counsel: "沿互卦与错卦列出三条可验证条件，并标注已知与未知。",
      },
      "question-reading/meihua": {
        interpretation: "综卦看对方立场，变卦看变化。",
        counsel: "从对方视角做一个可撤回的小决定，观察真实反应。",
      },
    });
  }

  requireLiveConfirmation(options.confirmLive === true);
  if (liveBudgetUpperBoundCny() >= DEMO_LIVE_BUDGET_CNY) {
    throw new Error(`live provider 最坏费用超过 ${DEMO_LIVE_BUDGET_CNY} CNY 硬上限`);
  }
  const providerOptions = {
    maxAttempts: 1,
    maxTokens: DEMO_LIVE_MAX_COMPLETION_TOKENS,
    timeoutMilliseconds: DEMO_LIVE_PROVIDER_TIMEOUT_MS,
    ...(options.environment ? { environment: options.environment as NodeJS.ProcessEnv } : {}),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  };
  return new BudgetedLiveProvider(new DeepSeekProvider(providerOptions));
}
