import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics, parseAbi, type Address, type Hex } from "viem";
import {
  ArcFeeVerifier, FeePaymentError, FEE_USDC6, feeRecipientFromEnv, verifySingleFeeTransfer,
} from "../src/sanyi/fee.js";
import { USDC_TOKEN_ADDRESS } from "../src/frontend/wallet.js";
import { statusForError } from "../src/sanyi/http-errors.js";
const payer: Address = `0x${"11".repeat(20)}`;
const recipient = "0x737301a6A40ea453A877627c409EF5756a395DB9" as const;
const hash = `0x${"ab".repeat(32)}` as const;
const abi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);
function log(
  from = payer, to: Address = recipient, value = FEE_USDC6, address: Address = USDC_TOKEN_ADDRESS,
) {
  return {
    address,
    topics: encodeEventTopics({ abi, eventName: "Transfer", args: { from, to } }) as [Hex, ...Hex[]],
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  };
}
function receipt(logs = [log()]) {
  return { status: "success" as const, logs, blockNumber: 42n, transactionHash: hash };
}
function verify(value = receipt()) {
  return verifySingleFeeTransfer({ receipt: value, payer, recipient, amountUsdc6: FEE_USDC6 });
}
test("默认收款地址与环境覆盖规范化", () => {
  assert.equal(feeRecipientFromEnv({}), recipient);
  assert.equal(feeRecipientFromEnv({ SANYI_FEE_RECIPIENT: recipient.toLowerCase() }), recipient);
  assert.throws(() => feeRecipientFromEnv({ SANYI_FEE_RECIPIENT: "bad" }), /收款地址/);
});
test("准确转账返回单笔付款收据", () => {
  assert.deepEqual(verify(), {
    payer, recipient, feeUsdc6: "50000", transactionHash: hash, blockNumber: 42n,
  });
});
test("地址大小写不影响匹配", () => {
  assert.equal(verifySingleFeeTransfer({
    receipt: receipt(), payer, recipient: recipient.toLowerCase() as Address, amountUsdc6: FEE_USDC6,
  }).feeUsdc6, "50000");
});
test("交易失败返回中文领域错误及 400", () => {
  assert.throws(() => verifySingleFeeTransfer({
    receipt: { ...receipt(), status: "reverted" }, payer, recipient, amountUsdc6: FEE_USDC6,
  }), (error: unknown) => error instanceof FeePaymentError
    && /交易失败/.test(error.message) && statusForError(error) === 400);
});
for (const [name, logs, message] of [
  ["无日志", [], /未找到卦金转账/],
  ["其它合约伪造事件", [log(payer, recipient, FEE_USDC6, `0x${"ff".repeat(19)}fe`)], /未找到卦金转账/],
  ["收款不符", [log(payer, payer)], /收款地址不符/],
  ["金额不符", [log(payer, recipient, 49_999n)], /金额不符/],
  ["付款人不符", [log(recipient)], /付款人不符/],
  ["无法解码", [{ ...log(), data: "0x" as const }], /未找到卦金转账/],
] as const) {
  test(name, () => {
    assert.throws(() => verifySingleFeeTransfer({
      receipt: { ...receipt(), logs }, payer, recipient, amountUsdc6: FEE_USDC6,
    }), (error: unknown) => error instanceof FeePaymentError && message.test(error.message));
  });
}
test("多条日志中存在准确转账即可通过", () => {
  assert.equal(verify(receipt([log(payer, payer), log()])).feeUsdc6, "50000");
});
test("核验器等待真实回执六十秒后核验", async () => {
  const verifier = new ArcFeeVerifier({
    waitForTransactionReceipt: async (input) => {
      assert.deepEqual(input, { hash, timeout: 60_000 });
      return receipt();
    },
  }, recipient);
  assert.equal((await verifier.verify({ payer, transactionHash: hash })).transactionHash, hash);
});
