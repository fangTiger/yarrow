export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function walletSummary(input: {
  address?: string;
  chainId?: number;
  balanceUsdc6?: bigint;
}, t: TFunction = zhT) {
  if (!input.address) {
    return { state: "disconnected" as const, label: t("wallet.connect"), showFaucet: false };
  }
  if (input.chainId !== 5_042_002) {
    return { state: "wrong-chain" as const, label: t("wallet.switch"), showFaucet: false };
  }
  const amount = input.balanceUsdc6;
  const balance = amount === undefined
    ? t("wallet.balanceLoading")
    : `${amount / 1_000_000n}.${((amount % 1_000_000n) / 10_000n).toString().padStart(2, "0")} USDC`;
  return { state: "connected" as const, label: truncateAddress(input.address), balance,
    network: t("wallet.network"), showFaucet: amount === 0n };
}
import { type TFunction, zhT } from "./i18n.js";
