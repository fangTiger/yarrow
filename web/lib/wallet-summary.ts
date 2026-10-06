export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function walletSummary(input: {
  address?: string;
  chainId?: number;
  balanceUsdc6?: bigint;
}) {
  if (!input.address) {
    return { state: "disconnected" as const, label: "连接钱包", showFaucet: false };
  }
  if (input.chainId !== 5_042_002) {
    return { state: "wrong-chain" as const, label: "切换到 Arc Testnet", showFaucet: false };
  }
  const amount = input.balanceUsdc6;
  const balance = amount === undefined
    ? "余额读取中"
    : `${amount / 1_000_000n}.${((amount % 1_000_000n) / 10_000n).toString().padStart(2, "0")} USDC`;
  return { state: "connected" as const, label: truncateAddress(input.address), balance,
    network: "Arc Testnet", showFaucet: amount === 0n };
}
