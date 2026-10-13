import { ARC_TESTNET } from "../../src/arc-network.js";

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
/** network 为本站收费所在网络，缺省测试网；主网零余额提示充值而不是领测试币。 */
export function walletSummary(input: {
  address?: string;
  chainId?: number;
  balanceUsdc6?: bigint;
}, t: TFunction = zhT, network: { chainId: number; mainnet: boolean } = ARC_TESTNET) {
  if (!input.address) {
    return { state: "disconnected" as const, label: t("wallet.connect"), showFaucet: false, showFunding: false };
  }
  if (input.chainId !== network.chainId) {
    return { state: "wrong-chain" as const, label: t(network.mainnet ? "wallet.switchMainnet" : "wallet.switch"),
      showFaucet: false, showFunding: false };
  }
  const amount = input.balanceUsdc6;
  const balance = amount === undefined
    ? t("wallet.balanceLoading")
    : `${amount / 1_000_000n}.${((amount % 1_000_000n) / 10_000n).toString().padStart(2, "0")} USDC`;
  const empty = amount === 0n;
  return { state: "connected" as const, label: truncateAddress(input.address), balance,
    network: t(network.mainnet ? "wallet.networkMainnet" : "wallet.network"),
    showFaucet: empty && !network.mainnet, showFunding: empty && network.mainnet };
}
import { type TFunction, zhT } from "./i18n.js";
