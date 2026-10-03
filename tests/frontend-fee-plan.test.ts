// tests/frontend-fee-plan.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { planFeePayment } from "../web/lib/fee-plan.js";
const enoughNative = 10n ** 18n;
test("余额不足时报告短缺", () => {
  const value = planFeePayment({
    erc20Balance: 1n, nativeBalance: 1n, gasPrice: 1n, allowances: [0n, 0n, 0n],
  });
  assert.equal(value.shortfall.missingErc20Usdc6, 49_999n);
  assert.ok(value.shortfall.missingNativeWei18 > 0n);
});
test("首次付款列出三笔授权与三笔入账", () => {
  const value = planFeePayment({
    erc20Balance: 50_000n, nativeBalance: enoughNative, gasPrice: 1n, allowances: [0n, 0n, 0n],
  });
  assert.equal(value.missingApprovals.length, 3);
  assert.equal(value.depositCalls.length, 3);
});
test("已有授权时不再授权", () => {
  const value = planFeePayment({
    erc20Balance: 50_000n,
    nativeBalance: enoughNative,
    gasPrice: 1n,
    allowances: [10_000_000n, 10_000_000n, 10_000_000n],
  });
  assert.deepEqual(value.missingApprovals, []);
  assert.deepEqual(value.depositCalls.map((call) => call.amount), [16_667n, 16_667n, 16_666n]);
});
