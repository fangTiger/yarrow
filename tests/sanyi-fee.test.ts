import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics, parseAbi, type Address, type Hex } from "viem";
import {
  ArcFeeVerifier, FeePaymentError, FEE_USDC6, feeRecipientFromEnv, NATIVE_USDC_EMITTER, verifySingleFeeTransfer,
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
/** 0.05 USDC 的原生 18 位小数表示。 */
const FEE_NATIVE18 = 50_000_000_000_000_000n;
/** EIP-7708 系统地址发出的原生 Transfer。 */
function native(from = payer, to: Address = recipient, value = FEE_NATIVE18) {
  return log(from, to, value, NATIVE_USDC_EMITTER);
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
    payer, recipient, feeUsdc6: "50000", feePaymentKind: "erc20", transactionHash: hash, blockNumber: 42n,
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
  ["其它合约伪造事件", [log(payer, recipient, FEE_USDC6, `0x${"ff".repeat(19)}fd`)], /未找到卦金转账/],
  ["其它合约伪造原生金额", [log(payer, recipient, FEE_NATIVE18, `0x${"ff".repeat(19)}fd`)], /未找到卦金转账/],
  ["系统地址按 6 位小数付 0.05 不算数", [native(payer, recipient, FEE_USDC6)], /金额不符/],
  ["原生少付一个最小单位", [native(payer, recipient, FEE_NATIVE18 - 1n)], /金额不符/],
  ["原生多付一个最小单位", [native(payer, recipient, FEE_NATIVE18 + 1n)], /金额不符/],
  ["原生收款不符", [native(payer, payer)], /收款地址不符/],
  ["原生付款人不符", [native(recipient)], /付款人不符/],
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

test("原生 0.05 USDC 转账通过，并标明付款方式为原生", () => {
  assert.deepEqual(verify(receipt([native()])), {
    payer, recipient, feeUsdc6: "50000", feePaymentKind: "native", transactionHash: hash, blockNumber: 42n,
  });
});
test("ERC-20 付款的 0x3600 与 0xfffe 两条日志只认 ERC-20 一条", () => {
  // 镜像排在前面也一样：先认 ERC-20，再认原生。
  const result = verify(receipt([native(), log()]));
  assert.equal(result.feePaymentKind, "erc20");
  assert.equal(result.feeUsdc6, "50000");
});
test("两笔各半的原生转账不能拼成卦金", () => {
  assert.throws(() => verify(receipt([native(payer, recipient, FEE_NATIVE18 / 2n),
    native(payer, recipient, FEE_NATIVE18 / 2n)])), /金额不符/);
});
test("ERC-4337 收据：EntryPoint 付给 bundler 的 gas 补偿不被认作卦金", () => {
  const entryPoint: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  const bundler: Address = `0x${"22".repeat(20)}`;
  const gas = native(entryPoint, bundler, 10_240_865_000_000_000n);
  assert.equal(verify(receipt([log(), native(), gas])).feePaymentKind, "erc20");
  // 只有 gas 补偿、没有付给收款地址的转账时必须拒绝。
  assert.throws(() => verify(receipt([gas])), /付款人不符/);
  assert.throws(() => verifySingleFeeTransfer({
    receipt: receipt([gas]), payer: entryPoint, recipient, amountUsdc6: FEE_USDC6,
  }), /收款地址不符/);
});
