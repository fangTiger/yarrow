import { getDefaultConfig, type Wallet, type WalletDetailsParams } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { createConnector, injected } from "wagmi";
import { arcNetworkFor, ARC_TESTNET } from "../../src/arc-network.js";
import type { Lang } from "./i18n.js";

// 未经 esbuild 注入（如组件测试）时退回测试网预设。
export const ARC_CHAIN_ID = Number(typeof __ARC_CHAIN_ID__ === "undefined" ? ARC_TESTNET.chainId : __ARC_CHAIN_ID__);
export const ARC_RPC_URL = typeof __ARC_RPC_URL__ === "undefined" ? ARC_TESTNET.rpcUrl : __ARC_RPC_URL__;
export const ARC_EXPLORER = typeof __ARC_EXPLORER__ === "undefined" ? ARC_TESTNET.explorerUrl : __ARC_EXPLORER__;
/** 构建期按 ARC_CHAIN_ID 选定的网络；主网收真钱，文案与引导随之切换。 */
export const ARC_NETWORK = { ...arcNetworkFor(ARC_CHAIN_ID), rpcUrl: ARC_RPC_URL, explorerUrl: ARC_EXPLORER };

export const arcChain = defineChain({
  id: ARC_CHAIN_ID,
  name: ARC_NETWORK.name,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  blockExplorers: { default: { name: "Arc Explorer", url: ARC_EXPLORER } },
  testnet: !ARC_NETWORK.mainnet,
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
    chains: [arcChain],
    wallets: [{
      groupName: lang === "zh" ? "浏览器钱包" : "Browser wallet",
      wallets: [() => browserWallet(lang)],
    }],
    ssr: false,
  });
}
