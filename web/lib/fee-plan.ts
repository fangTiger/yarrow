// web/lib/fee-plan.ts
import { walletShortfalls } from "../../src/frontend/wallet.js";
import { buildQuestionFeePlan } from "../../src/oracle/fee-payment.js";

export const PREFLIGHT_GAS_UNITS = 600_000n;
export interface FeePlanInput {
  erc20Balance: bigint;
  nativeBalance: bigint;
  gasPrice: bigint;
  allowances: readonly bigint[];
}
export function planFeePayment(input: FeePlanInput) {
  const plan = buildQuestionFeePlan();
  const shortfall = walletShortfalls({
    erc20BalanceUsdc6: input.erc20Balance,
    nativeBalanceWei18: input.nativeBalance,
    feeUsdc6: plan.feeUsdc6,
    bondUsdc6: 0n,
    estimatedGasWei18: input.gasPrice * PREFLIGHT_GAS_UNITS,
  });
  return {
    shortfall,
    missingApprovals: plan.approvals.filter((share, index) => {
      return (input.allowances[index] ?? 0n) < share.amountUsdc6;
    }),
    depositCalls: plan.deposits.map((share) => ({ vault: share.vault, amount: share.amountUsdc6 })),
  };
}
