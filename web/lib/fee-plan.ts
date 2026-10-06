import { walletShortfalls } from "../../src/frontend/wallet.js";

export const PREFLIGHT_GAS_UNITS = 100_000n;
export interface FeePlanInput {
  erc20Balance: bigint;
  nativeBalance: bigint;
  gasPrice: bigint;
}
export function planFeePayment(input: FeePlanInput) {
  return {
    shortfall: walletShortfalls({
      erc20BalanceUsdc6: input.erc20Balance,
      nativeBalanceWei18: input.nativeBalance,
      feeUsdc6: 50_000n,
      bondUsdc6: 0n,
      estimatedGasWei18: input.gasPrice * PREFLIGHT_GAS_UNITS,
    }),
  };
}
