import assert from "node:assert/strict";
import test from "node:test";
import { walletErrorMessage } from "../web/lib/wallet-errors.js";
import { PaymentFlowError, paymentFailureKind } from "../web/lib/payment-error.js";
for (const value of [{ name: "UserRejectedRequestError" }, { code: 4001 },
  new Error("User rejected request"), new Error("Request denied"),
  { cause: { code: 4001 } }]) {
  test(`用户取消：${JSON.stringify(value)}`, () => {
    assert.equal(walletErrorMessage(value), "你已取消付款，资金没有变动");
  });
}
test("余额不足中文化", () => {
  assert.equal(walletErrorMessage(new Error("insufficient funds")), "余额不足：每卦 0.05 USDC，另需少量 USDC 作手续费");
});
for (const message of ["chain mismatch", "Switch chain failed", "钱包网络不符", "network mismatch", "wrong network",
  "This Wallet does not support the requested chain ID ... "
    + "Details: Not supported batch request on chain: 0x4cef52"]) {
  test(`网络错误：${message}`, () => {
    assert.equal(walletErrorMessage(new Error(message)), "请把钱包切换到 Arc 网络后重试");
  });
}
test("其它错误附截断原因", () => {
  const text = walletErrorMessage(new Error("x".repeat(500)));
  assert.match(text, /^付款没有完成，请稍后重试/);
  assert.ok(text.length < 150);
});
test("未知错误仍显示中文", () => {
  assert.match(walletErrorMessage(null), /^付款没有完成，请稍后重试/);
});

test("网络超时归为稍后重试而非切网", () => {
  assert.match(walletErrorMessage(new Error("network timeout")), /^付款没有完成，请稍后重试/u);
});

test("付款失败按拒签、余额、切链、认领与其它分类", () => {
  for (const error of [{ name: "UserRejectedRequestError" }, { code: 4001 },
    new Error("wrapped", { cause: { code: 4001 } })]) {
    assert.equal(paymentFailureKind(error), "rejected");
  }
  for (const error of [new PaymentFlowError("insufficient"), { name: "InsufficientFundsError" },
    new Error("insufficient funds for gas")]) {
    assert.equal(paymentFailureKind(error), "insufficient");
  }
  assert.equal(paymentFailureKind(new Error("wrapped", {
    cause: new PaymentFlowError("wrong-chain"),
  })), "wrong-chain");
  assert.equal(paymentFailureKind(new PaymentFlowError("wrong-chain", {
    cause: { name: "UserRejectedRequestError", code: 4001 },
  })), "wrong-chain", "切链阶段标签优先于底层钱包拒绝码");
  assert.equal(paymentFailureKind(new Error("create failed"), { hasPaymentProof: true }), "claim");
  assert.equal(paymentFailureKind(new Error("rpc timeout")), "other");
});
