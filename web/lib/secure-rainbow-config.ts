import type { Wallet, WalletDetailsParams } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import type { Chain } from "viem";

interface SecureDefaultConfigInput {
  appName: string;
  projectId: string;
  chains: readonly [Chain, ...Chain[]];
  wallets: Array<{
    groupName: string;
    wallets: Array<(options: never) => Wallet>;
  }>;
  ssr?: boolean;
}

/**
 * 与 RainbowKit getDefaultConfig 相同的单链配置路径。
 * 构建时只为 wagmi 配置入口替换默认钱包集合，避免把未启用钱包的账户派生实现带入浏览器。
 */
export function getDefaultConfig(input: SecureDefaultConfigInput) {
  let walletIndex = -1;
  const connectors = input.wallets.flatMap(({ groupName, wallets }, groupIndex) => wallets.flatMap((createWallet) => {
    walletIndex += 1;
    const wallet = createWallet({
      appName: input.appName,
      projectId: input.projectId,
      options: { metadata: { name: input.appName, description: input.appName, url: location.origin, icons: [] } },
      walletConnectParameters: { metadata: { name: input.appName, description: input.appName, url: location.origin, icons: [] } },
    } as never);
    if (wallet.hidden?.()) return [];
    const { createConnector, hidden: _hidden, ...walletMeta } = wallet;
    const rkDetails: WalletDetailsParams["rkDetails"] = {
      ...walletMeta,
      groupIndex: groupIndex + 1,
      groupName,
      index: walletIndex,
      isRainbowKitConnector: true,
    };
    return [createConnector({ rkDetails } satisfies WalletDetailsParams)];
  }));
  const transports = Object.fromEntries(input.chains.map((chain) => [chain.id, http()]));
  return createConfig({
    chains: input.chains,
    connectors,
    transports,
    ssr: input.ssr,
  } as never);
}
