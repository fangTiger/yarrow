import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateRequiredBalance,
  classifyPrevRandaoSamples,
  classifyProbeError,
  classifyReceiptStatus,
  classifyInnerCall,
  completeTransactionResults,
  deriveFreshAddress,
  finalizeDrainResult,
  historyHashForWindowSearch,
  historyProbeCeiling,
  requireHistoryHash,
  requireArcPrivateKey,
  validateFreshAddress,
} from "../src/transaction-probe.js";

const transactionHash = `0x${"ab".repeat(32)}` as const;

test("私钥缺失或格式错误时在交易前终止", () => {
  assert.throws(() => requireArcPrivateKey({}), /ARC_PRIVATE_KEY/);
  assert.throws(() => requireArcPrivateKey({ ARC_PRIVATE_KEY: "not-a-key" }), /64 个十六进制/);

  const key = `0x${"11".repeat(32)}` as const;
  assert.equal(requireArcPrivateKey({ ARC_PRIVATE_KEY: key }), key);
});

test("fresh 地址由部署交易哈希确定性派生且不是零地址", () => {
  const first = deriveFreshAddress(transactionHash);
  const second = deriveFreshAddress(transactionHash);
  assert.equal(first, second);
  assert.match(first, /^0x[0-9a-fA-F]{40}$/);
  assert.notEqual(first.toLowerCase(), `0x${"00".repeat(20)}`);
});

test("只有零余额、零 nonce、无代码才通过 fresh 前置条件", async () => {
  const fresh = await validateFreshAddress(
    {
      async getBytecode() {
        return "0x" as const;
      },
      async getBalance() {
        return 0n;
      },
      async getTransactionCount() {
        return 0;
      },
    },
    "0x1111111111111111111111111111111111111111",
  );
  assert.equal(fresh.isFresh, true);

  const used = await validateFreshAddress(
    {
      async getBytecode() {
        return "0x6000" as const;
      },
      async getBalance() {
        return 1n;
      },
      async getTransactionCount() {
        return 2;
      },
    },
    "0x2222222222222222222222222222222222222222",
  );
  assert.equal(used.isFresh, false);
  assert.match(used.reason, /余额 1.*nonce 2.*代码 2 字节/);
});

test("内部调用失败归类为 REVERT 并保留原因", () => {
  assert.deepEqual(classifyInnerCall(true, "0x"), { status: "PASS", reason: undefined });
  assert.deepEqual(classifyInnerCall(false, "0x"), { status: "REVERT", reason: "无返回数据" });
});

test("外层 receipt 回滚必须归类为 REVERT 并保留重放原因", () => {
  assert.deepEqual(classifyReceiptStatus("success"), { status: "PASS", reason: undefined });
  assert.deepEqual(classifyReceiptStatus("reverted", "execution reverted: denied"), {
    status: "REVERT",
    reason: "execution reverted: denied",
  });
});

test("EIP-2935 内部回滚不能伪装成零哈希", () => {
  const hash = `0x${"12".repeat(32)}` as const;
  assert.equal(requireHistoryHash(true, hash, "0x"), hash);
  assert.throws(() => requireHistoryHash(false, `0x${"00".repeat(32)}`, "0xdeadbeef"), /内部调用回滚.*0xdeadbeef/);
});

test("EIP-2935 窗口搜索必须跨过文档上界并把内部回滚视为无效边界", () => {
  assert.equal(historyProbeCeiling(60_000_000n), 16_384);
  assert.equal(historyProbeCeiling(10_000n), 9_999);

  const hash = `0x${"12".repeat(32)}` as const;
  assert.equal(historyHashForWindowSearch(true, hash), hash);
  assert.equal(historyHashForWindowSearch(false, hash), `0x${"00".repeat(32)}`);
});

test("中英文回滚错误最终都归类为 REVERT", () => {
  assert.equal(classifyProbeError(new Error("execution reverted")), "REVERT");
  assert.equal(classifyProbeError(new Error("EIP-2935 内部调用回滚")), "REVERT");
  assert.equal(classifyProbeError(new Error("RPC 超时")), "FAIL");
});

test("gas 余额门槛同时覆盖注资和保守 gas 预算", () => {
  assert.equal(calculateRequiredBalance(10_000n, 2, 25n, 2_000_000n), 50_020_000n);
});

test("PREVRANDAO 必须在至少五个不同块高都为零", () => {
  const passing = classifyPrevRandaoSamples([
    { blockNumber: 10n, value: 0n },
    { blockNumber: 11n, value: 0n },
    { blockNumber: 12n, value: 0n },
    { blockNumber: 13n, value: 0n },
    { blockNumber: 14n, value: 0n },
  ]);
  assert.equal(passing.passed, true);

  assert.equal(classifyPrevRandaoSamples([{ blockNumber: 10n, value: 0n }]).passed, false);
  assert.equal(
    classifyPrevRandaoSamples([
      { blockNumber: 10n, value: 0n },
      { blockNumber: 11n, value: 0n },
      { blockNumber: 12n, value: 1n },
      { blockNumber: 13n, value: 0n },
      { blockNumber: 14n, value: 0n },
    ]).passed,
    false,
  );
});

test("交易流程中断时仍补齐八项结果", () => {
  const completed = completeTransactionResults(
    [{ id: "1-native-receive", title: "已有结果", status: "PASS", observed: "ok" }],
    "RPC 暂时不可用",
  );
  assert.equal(completed.length, 8);
  assert.deepEqual(
    completed.map((result) => result.id),
    [
      "1-native-receive",
      "2-transfer-existing",
      "3-transfer-fresh",
      "4-drain",
      "5-balance-scale",
      "6-eip2935-window",
      "7-prevrandao",
      "8-blockhash-comparison",
    ],
  );
  assert.equal(completed[0]?.status, "PASS");
  assert.equal(completed[7]?.status, "FAIL");
  assert.match(completed[7]?.reason ?? "", /RPC 暂时不可用/);
});

test("清空探针只有后置余额确认为零才能保持 PASS", () => {
  const base = { id: "4-drain", title: "清空", status: "PASS" as const, observed: "内部 call 成功" };
  assert.equal(finalizeDrainResult(base, 0n).status, "PASS");
  const remaining = finalizeDrainResult(base, 1n);
  assert.equal(remaining.status, "FAIL");
  assert.match(remaining.observed, /仍有余额 1/);
});
