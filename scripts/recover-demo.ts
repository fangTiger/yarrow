import { DEMO_GAS_BUDGET_USDC6, createArcDemoDriver, parseRecoveryRequestArguments } from "../src/demo/arc-driver.js";

function formatUsdc6(value: bigint): string {
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, "0")}`;
}

const request = parseRecoveryRequestArguments(process.argv.slice(2));
console.log(`恢复预算预告：只处置已到期轮次 #${request.roundId}，不调用任何模型；gas 硬上限 1.500000 USDC`);
const driver = await createArcDemoDriver();
const transactions = await driver.recoverIncomplete(request);
const gasCostUsdc6 = transactions.reduce((sum, transaction) => sum + BigInt(transaction.gasCostUsdc6), 0n);
if (gasCostUsdc6 > DEMO_GAS_BUDGET_USDC6) throw new Error("恢复 gas 超过 1.5 USDC 硬上限");
if (transactions.length === 0) {
  console.log("无需恢复：最近轮次已经处于终态");
} else {
  for (const transaction of transactions) {
    console.log(`${transaction.label}：tx=${transaction.hash}，gas=${formatUsdc6(BigInt(transaction.gasCostUsdc6))} USDC`);
  }
  console.log(`恢复完成：${transactions.length} 笔，gas=${formatUsdc6(gasCostUsdc6)} USDC`);
}
