import type { Address, Hex } from "viem";

export const ORACLE_FEE_USDC6 = 50_000n;
export const READING_FEE_APPROVAL_USDC6 = 10_000_000n;

export const DIVINER_FEE_RECIPIENTS = [
  {
    divinerKey: "takashima",
    divinerName: "高島易断",
    vault: "0xdb87cf872654707eb8cfc53b616ce7426980c98e" as Address,
  },
  {
    divinerKey: "wuxing",
    divinerName: "五行易（断易）",
    vault: "0x3499a17d4c5ba31d6d4c9ac29b4c8ab801b086b7" as Address,
  },
  {
    divinerKey: "meihua",
    divinerName: "梅花心易",
    vault: "0xe489b564a522b2b217dfd3ec5375bb1325d1f116" as Address,
  },
] as const;

export interface DivinerFeeShare {
  divinerKey: string;
  divinerName: string;
  vault: Address;
  amountUsdc6: bigint;
}

export interface QuestionFeeProof {
  payer: Address;
  bundleId: string;
  transactionHashes: readonly Hex[];
}

export interface QuestionFeeReceipt {
  feeUsdc6: string;
  walletConfirmationCount: 1;
  transactionHashes: readonly Hex[];
  shares: ReadonlyArray<Omit<DivinerFeeShare, "amountUsdc6"> & { amountUsdc6: string }>;
  gasUsdc6: string;
}

export interface QuestionFeeTransfer {
  from: Address;
  to: Address;
  amountUsdc6: bigint;
  transactionHash: Hex;
}

/**
 * USDC 只有六位精度，三等分时把余数从第一位易者起逐个补齐。
 * 这保证每个最小单位都有公开去向，不用浮点数，也不把尾差留给平台。
 */
export function splitOracleFee(feeUsdc6: bigint = ORACLE_FEE_USDC6): DivinerFeeShare[] {
  if (feeUsdc6 <= 0n) throw new Error("卦金必须是正整数个 USDC 最小单位");
  if (feeUsdc6 < BigInt(DIVINER_FEE_RECIPIENTS.length)) throw new Error("卦金不足以分入三座易者金库");
  const count = BigInt(DIVINER_FEE_RECIPIENTS.length);
  const base = feeUsdc6 / count;
  const remainder = feeUsdc6 % count;
  return DIVINER_FEE_RECIPIENTS.map((recipient, index) => ({
    ...recipient,
    amountUsdc6: base + (BigInt(index) < remainder ? 1n : 0n),
  }));
}

export interface QuestionFeePlan {
  atomicRequired: true;
  feeUsdc6: bigint;
  approvals: DivinerFeeShare[];
  deposits: DivinerFeeShare[];
}

/** 不可判定问题只购买三家解读：有卦金，无保证金，也没有易者押注。 */
export function buildQuestionFeePlan(): QuestionFeePlan {
  return {
    atomicRequired: true,
    feeUsdc6: ORACLE_FEE_USDC6,
    approvals: splitOracleFee(READING_FEE_APPROVAL_USDC6),
    deposits: splitOracleFee(ORACLE_FEE_USDC6),
  };
}

export function mockQuestionFeeReceipt(proof: QuestionFeeProof): QuestionFeeReceipt {
  if (!/^0x[0-9a-fA-F]{40}$/.test(proof.payer)) throw new Error("付款钱包地址无效");
  if (!proof.bundleId.trim()) throw new Error("三座金库付款凭证不完整");
  if (!proof.transactionHashes.length || proof.transactionHashes.some((hash) => !/^0x[0-9a-fA-F]{64}$/.test(hash))) {
    throw new Error("三座金库付款交易哈希不完整");
  }
  return {
    feeUsdc6: ORACLE_FEE_USDC6.toString(),
    walletConfirmationCount: 1,
    transactionHashes: proof.transactionHashes,
    shares: splitOracleFee().map((share) => ({ ...share, amountUsdc6: share.amountUsdc6.toString() })),
    gasUsdc6: "0",
  };
}

/**
 * 服务端只承认付款钱包在所报交易内实际转入三座金库的 USDC。
 * 每座金库逐一对账，不能以总额相同掩盖错收方，也不能引用凭证外交易。
 */
export function verifyQuestionFeeTransfers(
  proof: QuestionFeeProof,
  transfers: readonly QuestionFeeTransfer[],
  gasUsdc6: bigint,
): QuestionFeeReceipt {
  if (!/^0x[0-9a-fA-F]{40}$/.test(proof.payer)) throw new Error("付款钱包地址无效");
  if (!proof.bundleId.trim() || !proof.transactionHashes.length) throw new Error("三座金库付款凭证不完整");
  const allowedHashes = new Set(proof.transactionHashes.map((hash) => hash.toLowerCase()));
  const payer = proof.payer.toLowerCase();
  const matching = transfers.filter((transfer) => transfer.from.toLowerCase() === payer);
  if (matching.some((transfer) => !allowedHashes.has(transfer.transactionHash.toLowerCase()))) {
    throw new Error("付款记录包含凭证外交易");
  }
  const shares = splitOracleFee();
  for (const share of shares) {
    const amount = matching
      .filter((transfer) => transfer.to.toLowerCase() === share.vault.toLowerCase())
      .reduce((sum, transfer) => sum + transfer.amountUsdc6, 0n);
    if (amount !== share.amountUsdc6) {
      throw new Error(`${share.divinerName}金库收到的卦金份额或金额不正确`);
    }
  }
  const expectedVaults = new Set(shares.map((share) => share.vault.toLowerCase()));
  if (matching.some((transfer) => !expectedVaults.has(transfer.to.toLowerCase()))) {
    throw new Error("卦金付款人存在未声明的金库转账");
  }
  return {
    feeUsdc6: ORACLE_FEE_USDC6.toString(),
    walletConfirmationCount: 1,
    transactionHashes: [...proof.transactionHashes],
    shares: shares.map((share) => ({ ...share, amountUsdc6: share.amountUsdc6.toString() })),
    gasUsdc6: gasUsdc6.toString(),
  };
}
