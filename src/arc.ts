import { createPublicClient, defineChain, http } from "viem";

export const ARC_CHAIN_ID = 5_042_002;
export const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.io";
export const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
      webSocket: ["wss://rpc.testnet.arc.io"],
    },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: ARC_EXPLORER_URL },
  },
  testnet: true,
});

export function createArcPublicClient() {
  return createPublicClient({ chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
}

