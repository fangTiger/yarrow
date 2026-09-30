import assert from "node:assert/strict";
import test from "node:test";

import { estimateDeepSeekUsageUsd, parseDeepSeekBalance } from "../src/deepseek-budget.js";

test("DeepSeek 余额解析只接受官方 CNY/USD 数字字段", () => {
  const balance = parseDeepSeekBalance({
    is_available: true,
    balance_infos: [{ currency: "CNY", total_balance: "24.30", granted_balance: "0.00", topped_up_balance: "24.30" }],
  });
  assert.equal(balance.isAvailable, true);
  assert.equal(balance.balances.CNY, 24.3);
});

test("预算估算按 2026-08-16 后的峰谷价格分别计算缓存命中、未命中和输出", () => {
  const usage = { promptTokens: 150, promptCacheHitTokens: 100, promptCacheMissTokens: 50, completionTokens: 20 };
  const offPeak = estimateDeepSeekUsageUsd(usage, new Date("2026-09-05T05:00:00.000Z"));
  const peak = estimateDeepSeekUsageUsd(usage, new Date("2026-09-05T06:30:00.000Z"));
  assert.equal(offPeak, (100 * 0.007 + 50 * 0.22 + 20 * 0.66) / 1_000_000);
  assert.equal(peak, offPeak * 2);
});
