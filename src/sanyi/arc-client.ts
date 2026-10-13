import { createPublicClient, defineChain, http } from "viem";
import type { ArcNetwork } from "../arc-network.js";

/** 三易服务的 Arc 只读客户端；网络由调用方按环境变量解析后传入。 */
export function createSanyiPublicClient(network: ArcNetwork) {
  const chain = defineChain({
    id: network.chainId,
    name: network.name,
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: [network.rpcUrl] } },
    blockExplorers: { default: { name: "Arc Explorer", url: network.explorerUrl } },
    testnet: !network.mainnet,
  });
  return createPublicClient({ chain, transport: http(network.rpcUrl, { timeout: 20_000 }) });
}
