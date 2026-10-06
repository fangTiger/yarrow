import assert from "node:assert/strict";
import test from "node:test";
import { parseFeeTransferArgs } from "../scripts/check-fee-transfer.js";
const hash = `0x${"ab".repeat(32)}`;
const address = `0x${"11".repeat(20)}`;
test("只读检查参数解析最小单位金额", () => {
  assert.deepEqual(parseFeeTransferArgs([
    "--tx", hash, "--payer", address, "--recipient", address, "--amount", "50000",
  ]), { transactionHash: hash, payer: address, recipient: address, amountUsdc6: 50_000n });
});
test("只读检查拒绝缺失参数与非法金额地址哈希", () => {
  assert.throws(() => parseFeeTransferArgs([]), /参数/u);
  for (const [flag, value] of [["--tx", "0x12"], ["--payer", "bad"],
    ["--recipient", "bad"], ["--amount", "0.05"], ["--amount", "-1"]]) {
    const args = ["--tx", hash, "--payer", address, "--recipient", address, "--amount", "50000"];
    args[args.indexOf(flag!) + 1] = value!;
    assert.throws(() => parseFeeTransferArgs(args), /参数/u);
  }
});
