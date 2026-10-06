import assert from "node:assert/strict";
import test from "node:test";
import { planFeePayment, PREFLIGHT_GAS_UNITS } from "../web/lib/fee-plan.js";
test("余额充足时无缺口且没有授权与分账", () => {
  const value = planFeePayment({ erc20Balance: 50_000n, nativeBalance: 10n ** 18n, gasPrice: 1n });
  assert.equal(value.shortfall.missingErc20Usdc6, 0n);
  assert.equal(value.shortfall.missingNativeWei18, 0n);
  assert.equal("missingApprovals" in value, false);
  assert.equal("depositCalls" in value, false);
});
test("ERC-20 不足时报告准确缺口", () => {
  const value = planFeePayment({ erc20Balance: 1n, nativeBalance: 10n ** 18n, gasPrice: 1n });
  assert.equal(value.shortfall.missingErc20Usdc6, 49_999n);
});
test("gas 不足时报告准确缺口", () => {
  const value = planFeePayment({ erc20Balance: 50_000n, nativeBalance: 1n, gasPrice: 2n });
  assert.equal(value.shortfall.missingNativeWei18, PREFLIGHT_GAS_UNITS * 2n - 1n);
});
