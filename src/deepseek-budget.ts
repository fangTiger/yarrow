import type { ProviderUsage } from "./agent/provider.js";

export interface DeepSeekBalance {
  isAvailable: boolean;
  balances: Partial<Record<"CNY" | "USD", number>>;
}

interface DeepSeekBalanceEnvelope {
  is_available?: unknown;
  balance_infos?: unknown;
}

export function parseDeepSeekBalance(value: unknown): DeepSeekBalance {
  if (!value || typeof value !== "object") throw new Error("DeepSeek 余额响应不是对象");
  const envelope = value as DeepSeekBalanceEnvelope;
  if (typeof envelope.is_available !== "boolean" || !Array.isArray(envelope.balance_infos)) {
    throw new Error("DeepSeek 余额响应字段不完整");
  }
  const balances: DeepSeekBalance["balances"] = {};
  for (const item of envelope.balance_infos) {
    if (!item || typeof item !== "object") throw new Error("DeepSeek 余额条目不是对象");
    const record = item as Record<string, unknown>;
    if ((record.currency !== "CNY" && record.currency !== "USD") || typeof record.total_balance !== "string") {
      throw new Error("DeepSeek 余额条目币种或金额无效");
    }
    const amount = Number(record.total_balance);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("DeepSeek 余额金额无效");
    balances[record.currency] = amount;
  }
  return { isAvailable: envelope.is_available, balances };
}

export async function getDeepSeekBalance(
  environment: NodeJS.ProcessEnv = process.env,
  fetchImplementation: typeof fetch = fetch,
): Promise<DeepSeekBalance> {
  const apiKey = environment.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("缺少 DeepSeek API 凭据");
  const response = await fetchImplementation("https://api.deepseek.com/user/balance", {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`DeepSeek 余额查询失败（HTTP ${response.status}）`);
  return parseDeepSeekBalance(await response.json());
}

/** 2026-08-16 起 V4-Flash 峰时 01–04、06–10 UTC；其余时段半价。 */
export function isDeepSeekPeakTime(date: Date): boolean {
  const hour = date.getUTCHours();
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}

export function estimateDeepSeekUsageUsd(usage: ProviderUsage, date: Date): number {
  const peakMultiplier = isDeepSeekPeakTime(date) ? 2 : 1;
  const classifiedPrompt = usage.promptCacheHitTokens + usage.promptCacheMissTokens;
  const unclassifiedPrompt = Math.max(0, usage.promptTokens - classifiedPrompt);
  const cacheHit = usage.promptCacheHitTokens;
  const cacheMiss = usage.promptCacheMissTokens + unclassifiedPrompt;
  return peakMultiplier * (
    cacheHit * 0.007
    + cacheMiss * 0.22
    + usage.completionTokens * 0.66
  ) / 1_000_000;
}

export function estimateDeepSeekUsagePeakUsd(usage: ProviderUsage): number {
  const classifiedPrompt = usage.promptCacheHitTokens + usage.promptCacheMissTokens;
  const unclassifiedPrompt = Math.max(0, usage.promptTokens - classifiedPrompt);
  return (
    usage.promptCacheHitTokens * 0.014
    + (usage.promptCacheMissTokens + unclassifiedPrompt) * 0.44
    + usage.completionTokens * 1.32
  ) / 1_000_000;
}
