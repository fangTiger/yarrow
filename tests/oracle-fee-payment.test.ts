import assert from "node:assert/strict";
import test from "node:test";

import {
  DIVINER_FEE_RECIPIENTS,
  ORACLE_FEE_USDC6,
  READING_FEE_APPROVAL_USDC6,
  buildQuestionFeePlan,
  splitOracleFee,
  verifyQuestionFeeTransfers,
} from "../src/oracle/fee-payment.js";

const PAYER = "0x0000000000000000000000000000000000000011" as const;
const HASH = `0x${"ab".repeat(32)}` as const;

test("每卦 0.05 USDC 按最小单位完整分入三位易者金库", () => {
  const shares = splitOracleFee(ORACLE_FEE_USDC6);

  assert.equal(ORACLE_FEE_USDC6, 50_000n);
  assert.equal(shares.length, 3);
  assert.deepEqual(shares.map((share) => share.amountUsdc6), [16_667n, 16_667n, 16_666n]);
  assert.equal(shares.reduce((sum, share) => sum + share.amountUsdc6, 0n), ORACLE_FEE_USDC6);
  assert.deepEqual(shares.map((share) => share.vault), DIVINER_FEE_RECIPIENTS.map((item) => item.vault));
});

test("不可判定问题使用三库原子授权与原子入库计划，不包含押注", () => {
  const plan = buildQuestionFeePlan();

  assert.equal(plan.atomicRequired, true);
  assert.equal(plan.feeUsdc6, 50_000n);
  assert.equal(plan.approvals.length, 3);
  assert.equal(plan.deposits.length, 3);
  assert.equal(plan.approvals.reduce((sum, item) => sum + item.amountUsdc6, 0n), READING_FEE_APPROVAL_USDC6);
  assert.equal("bondUsdc6" in plan, false);
  assert.equal("stakeUsdc6" in plan, false);
});

test("分账拒绝零费用，且任意金额都不丢失最小单位", () => {
  assert.throws(() => splitOracleFee(0n), /卦金/);
  const shares = splitOracleFee(50_002n);
  assert.equal(shares.reduce((sum, share) => sum + share.amountUsdc6, 0n), 50_002n);
  assert.ok(shares.every((share) => share.amountUsdc6 > 0n));
});

test("付款凭证必须逐一命中付款人、三座金库与精确份额", () => {
  const proof = { payer: PAYER, bundleId: "bundle-1", transactionHashes: [HASH] };
  const transfers = splitOracleFee().map((share) => ({
    from: PAYER,
    to: share.vault,
    amountUsdc6: share.amountUsdc6,
    transactionHash: HASH,
  }));

  const receipt = verifyQuestionFeeTransfers(proof, transfers, 321n);
  assert.equal(receipt.feeUsdc6, "50000");
  assert.equal(receipt.walletConfirmationCount, 1);
  assert.equal(receipt.gasUsdc6, "321");
  assert.deepEqual(receipt.shares.map((share) => share.amountUsdc6), ["16667", "16667", "16666"]);
});

test("缺库、错付款人、错金额与凭证外交易一律拒绝", () => {
  const proof = { payer: PAYER, bundleId: "bundle-1", transactionHashes: [HASH] };
  const valid = splitOracleFee().map((share) => ({
    from: PAYER,
    to: share.vault,
    amountUsdc6: share.amountUsdc6,
    transactionHash: HASH,
  }));
  assert.throws(() => verifyQuestionFeeTransfers(proof, valid.slice(1), 0n), /金库|份额/);
  assert.throws(() => verifyQuestionFeeTransfers(proof, valid.map((item, index) => index === 0 ? { ...item, from: DIVINER_FEE_RECIPIENTS[0].vault } : item), 0n), /付款人|金库/);
  assert.throws(() => verifyQuestionFeeTransfers(proof, valid.map((item, index) => index === 2 ? { ...item, amountUsdc6: item.amountUsdc6 + 1n } : item), 0n), /金额|份额/);
  assert.throws(() => verifyQuestionFeeTransfers(proof, valid.map((item) => ({ ...item, transactionHash: `0x${"cd".repeat(32)}` as const })), 0n), /凭证/);
});
