import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  getAddress,
  type Address,
  type EIP1193Provider,
} from "viem";

export const ARC_CHAIN_ID = 5_042_002;
export const ARC_CHAIN_HEX = "0x4cef52";
export const ARC_RPC_URL = "https://rpc.testnet.arc.io";
export const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
export const ARC_FAUCET_URL = "https://faucet.circle.com";
export const USDC_TOKEN_ADDRESS = "0x3600000000000000000000000000000000000000";
export const NATIVE_USDC_DECIMALS = 18;
export const ERC20_USDC_DECIMALS = 6;
export const NATIVE_TO_ERC20_SCALE = 1_000_000_000_000n;
/** 固定 10 USDC，可覆盖 floor(10 / 0.55) = 18 轮；拒绝无限授权。 */
export const REUSABLE_APPROVAL_USDC6 = 10_000_000n;
export const REUSABLE_APPROVAL_ROUND_COUNT = 18;

export const ARC_BROWSER_CHAIN = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: NATIVE_USDC_DECIMALS },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  blockExplorers: { default: { name: "Arcscan", url: ARC_EXPLORER_URL } },
  testnet: true,
});

export interface InjectedProvider {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export function browserInjectedProvider(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { ethereum?: InjectedProvider }).ethereum;
  return candidate ?? null;
}

/** 通过 viem 包装 EIP-1193 provider，并确保钱包最终位于 Arc Testnet。 */
export async function connectArcWallet(provider: InjectedProvider) {
  const transport = custom(provider as EIP1193Provider);
  const walletClient = createWalletClient({ chain: ARC_BROWSER_CHAIN, transport });
  const publicClient = createPublicClient({ chain: ARC_BROWSER_CHAIN, transport });
  const [address] = await walletClient.requestAddresses();
  if (!address) throw new Error("钱包没有返回可用地址");
  if (await walletClient.getChainId() !== ARC_CHAIN_ID) {
    try {
      await walletClient.switchChain({ id: ARC_CHAIN_ID });
    } catch (error) {
      if (errorCode(error) !== 4902 && !errorText(error).includes("unknown chain")) throw error;
      await walletClient.addChain({ chain: ARC_BROWSER_CHAIN });
      await walletClient.switchChain({ id: ARC_CHAIN_ID });
    }
  }
  if (await walletClient.getChainId() !== ARC_CHAIN_ID) throw new Error("钱包网络没有切换到 Arc Testnet");
  return { address: getAddress(address) as Address, walletClient, publicClient, provider };
}

export interface WalletFundsInput {
  erc20BalanceUsdc6: bigint;
  nativeBalanceWei18: bigint;
  feeUsdc6: bigint;
  bondUsdc6: bigint;
  estimatedGasWei18: bigint;
}

export interface WalletShortfalls {
  requiredErc20Usdc6: bigint;
  missingErc20Usdc6: bigint;
  requiredNativeWei18: bigint;
  missingNativeWei18: bigint;
}

/** 原生 USDC 使用 18 位；只在展示或预算比较边界向上换算为六位。 */
export function nativeWeiToUsdc6(value: bigint): bigint {
  if (value < 0n) throw new Error("原生 USDC 数量不能为负数");
  return (value + NATIVE_TO_ERC20_SCALE - 1n) / NATIVE_TO_ERC20_SCALE;
}

export function formatUsdc6(value: bigint): string {
  const sign = value < 0n ? "−" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 1_000_000n}.${(absolute % 1_000_000n).toString().padStart(6, "0")}`;
}

export function walletShortfalls(input: WalletFundsInput): WalletShortfalls {
  const requiredErc20Usdc6 = input.feeUsdc6 + input.bondUsdc6;
  return {
    requiredErc20Usdc6,
    missingErc20Usdc6: input.erc20BalanceUsdc6 < requiredErc20Usdc6
      ? requiredErc20Usdc6 - input.erc20BalanceUsdc6
      : 0n,
    requiredNativeWei18: input.estimatedGasWei18,
    missingNativeWei18: input.nativeBalanceWei18 < input.estimatedGasWei18
      ? input.estimatedGasWei18 - input.nativeBalanceWei18
      : 0n,
  };
}

function errorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const direct = "code" in error && typeof error.code === "number" ? error.code : undefined;
  if (direct !== undefined) return direct;
  return "cause" in error ? errorCode(error.cause) : undefined;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (error && typeof error === "object" && "message" in error) return String(error.message).toLowerCase();
  return "";
}

/** 钱包错误只输出产品可行动信息，不把 RPC 内部文案抛给用户。 */
export function classifyWalletError(error: unknown, action: string): string {
  const code = errorCode(error);
  const message = errorText(error);
  if (code === 4001 || code === -32_003 || message.includes("user rejected") || message.includes("user denied")) {
    return `你取消了“${action}”签名，本笔没有扣款。可以重新点击求卦再试一次。`;
  }
  if (code === 4902 || message.includes("unrecognized chain") || message.includes("unknown chain")) {
    return "钱包还没有 Arc Testnet（Chain ID 5042002）。页面会先添加网络，再请你确认切换。";
  }
  if (message.includes("insufficient funds") || message.includes("gas required exceeds")) {
    return "钱包里的 Arc 原生 USDC 不足以支付 gas。请先前往 Circle 水龙头领取测试币，再回来重试。";
  }
  if (message.includes("chain") || message.includes("network")) {
    return "当前钱包网络不是 Arc Testnet（Chain ID 5042002）。请允许页面切换网络后重试。";
  }
  return `“${action}”暂时没有完成。请确认钱包仍在 Arc Testnet，稍后重试；本页面不会显示钱包的内部错误。`;
}
