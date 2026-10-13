/** Arc 网络预设：前后端共用，按链 ID 取 RPC、浏览器与是否主网。 */
export interface ArcNetwork {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  mainnet: boolean;
}

export const ARC_TESTNET: ArcNetwork = Object.freeze({
  chainId: 5_042_002,
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.io",
  explorerUrl: "https://testnet.arcscan.app",
  mainnet: false,
});

export const ARC_MAINNET: ArcNetwork = Object.freeze({
  chainId: 5_042,
  name: "Arc Mainnet",
  rpcUrl: "https://rpc.mainnet.arc.io",
  explorerUrl: "https://explorer.arc.io",
  mainnet: true,
});

/** 按链 ID 取预设；未知链 ID 直接报错，避免把卦金付到不认识的链上。 */
export function arcNetworkFor(chainId: number): ArcNetwork {
  if (chainId === ARC_MAINNET.chainId) return ARC_MAINNET;
  if (chainId === ARC_TESTNET.chainId) return ARC_TESTNET;
  throw new Error(`不支持的 Arc 链 ID：${chainId}`);
}

/** 从环境变量解析网络：ARC_CHAIN_ID 缺省测试网，RPC 与浏览器可覆盖，但不得与链 ID 的主网/测试网身份相悖。 */
export function resolveArcNetwork(env: {
  ARC_CHAIN_ID?: string | undefined;
  ARC_RPC_URL?: string | undefined;
  ARC_EXPLORER?: string | undefined;
}): ArcNetwork {
  const raw = env.ARC_CHAIN_ID?.trim();
  if (raw && !/^\d+$/u.test(raw)) {
    throw new Error("ARC_CHAIN_ID 必须是十进制整数");
  }
  const preset = arcNetworkFor(raw ? Number(raw) : ARC_TESTNET.chainId);
  const network = {
    ...preset,
    rpcUrl: env.ARC_RPC_URL?.trim() || preset.rpcUrl,
    explorerUrl: env.ARC_EXPLORER?.trim() || preset.explorerUrl,
  };
  const conflicting = network.mainnet ? /testnet/iu : /mainnet/iu;
  for (const url of [network.rpcUrl, network.explorerUrl]) {
    if (conflicting.test(url)) {
      throw new Error(`${network.name} 的 RPC 或浏览器地址与网络不符：${url}`);
    }
  }
  return network;
}
