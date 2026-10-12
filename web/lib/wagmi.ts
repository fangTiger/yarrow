import { getDefaultConfig, type Wallet, type WalletDetailsParams } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { createConnector, injected } from "wagmi";
import type { Lang } from "./i18n.js";

export const ARC_CHAIN_ID = Number(__ARC_CHAIN_ID__);
export const ARC_RPC_URL = __ARC_RPC_URL__;
export const ARC_EXPLORER = __ARC_EXPLORER__;

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC_EXPLORER } },
  testnet: true,
});

const browserWallet = (lang: Lang): Wallet => ({
  id: "injected",
  name: lang === "zh" ? "浏览器钱包" : "Browser wallet",
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%23131A2A'/%3E%3Cpath d='M7 10h18v13H7zM20 13h7v7h-7z' fill='none' stroke='%23C9A227' stroke-width='2'/%3E%3Ccircle cx='23' cy='16.5' r='1' fill='%23E24A2B'/%3E%3C/svg%3E",
  iconBackground: "#131A2A",
  installed: typeof window !== "undefined" && typeof (window as Window & { ethereum?: unknown }).ethereum !== "undefined",
  createConnector: (walletDetails: WalletDetailsParams) => createConnector((config) => ({
    ...injected()(config),
    ...walletDetails,
  })),
});

export function createWagmiConfig(lang: Lang) {
  return getDefaultConfig({
    appName: lang === "zh" ? "三易" : "Yarrow",
    projectId: __WALLETCONNECT_PROJECT_ID__,
    chains: [arcTestnet],
    wallets: [{
      groupName: lang === "zh" ? "浏览器钱包" : "Browser wallet",
      wallets: [() => browserWallet(lang)],
    }],
    ssr: false,
  });
}
