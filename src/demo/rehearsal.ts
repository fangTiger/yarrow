import type { DemoMode, DemoSession } from "./service.js";
import { DEMO_LIVE_INFERENCE_BUDGET_MS } from "./provider.js";

const DEMO_BASE_DURATION_LIMIT_MS = 40_000;

export interface DemoAssertionOptions {
  expectedMode: DemoMode;
  maximumGasUsdc6: bigint;
}

export interface DemoAssertionSummary {
  roundId: string;
  predictionCount: number;
  transactionCount: number;
  gasCostUsdc6: string;
}

export function assertDemoDuration(durationMilliseconds: number, maximumMilliseconds: number): void {
  if (!Number.isFinite(durationMilliseconds) || durationMilliseconds < 0) throw new Error("演示耗时必须是非负有限数");
  if (durationMilliseconds > maximumMilliseconds) {
    throw new Error(`完整演示超过 ${maximumMilliseconds} ms 上限：${Math.round(durationMilliseconds)} ms`);
  }
}

/** LIVE 在链上流程的基础时限上，额外计入四次真实推理的既有硬预算。 */
export function demoDurationLimitMilliseconds(mode: DemoMode): number {
  return DEMO_BASE_DURATION_LIMIT_MS + (mode === "live" ? DEMO_LIVE_INFERENCE_BUDGET_MS : 0);
}

function requireCount(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label}必须恰好为 ${expected}，实际 ${actual}`);
}

/** 对排练结果做结构和预算断言；不以“脚本未抛错”代替链路证据。 */
export function assertCompletedDemo(session: DemoSession, options: DemoAssertionOptions): DemoAssertionSummary {
  if (session.mode !== options.expectedMode) throw new Error(`演示模式错误：${session.mode}`);
  if (session.phase !== "settled" || session.error !== null) throw new Error(`演示未进入无错误 settled 终态：${session.phase}`);
  if (!/^(0|[1-9][0-9]*)$/.test(session.roundId ?? "")) throw new Error("演示结果缺少有效 roundId");
  if (!session.hexagram || session.hexagram.lines.length !== 6) throw new Error("演示结果缺少六爻");
  if (!session.proposition || session.proposition.calibration.sampleCount <= 0) throw new Error("演示结果缺少已校准的固定命题");
  if (typeof session.outcome !== "boolean") throw new Error("演示结果缺少已判定事实结果");
  requireCount(session.predictions.length, 3, "预测记录");
  requireCount(new Set(session.predictions.map((prediction) => prediction.divinerKey)).size, 3, "三位不同易者");
  requireCount(session.vaultChanges.length, 3, "金库变化记录");

  const counts = (kind: DemoSession["transactions"][number]["kind"]) =>
    session.transactions.filter((transaction) => transaction.kind === kind).length;
  requireCount(counts("commit"), 1, "commit 交易");
  requireCount(counts("reveal"), 1, "reveal 交易");
  requireCount(counts("prediction"), 3, "预测交易");
  requireCount(counts("settlement"), 3, "结算交易");
  if (counts("approval") > 1) throw new Error("授权交易不得超过 1 笔");
  for (const transaction of session.transactions) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(transaction.hash)) throw new Error(`${transaction.label} 缺少有效交易哈希`);
    if (!/^[0-9]+$/.test(transaction.blockNumber)) throw new Error(`${transaction.label} 缺少有效块高`);
    if (!/^[0-9]+$/.test(transaction.gasCostUsdc6)) throw new Error(`${transaction.label} 的 gas 成本格式无效`);
  }
  const gasCost = session.transactions.reduce((sum, transaction) => sum + BigInt(transaction.gasCostUsdc6), 0n);
  if (gasCost > options.maximumGasUsdc6) {
    throw new Error(`链上 gas 超过 ${options.maximumGasUsdc6} 个六位精度 USDC 上限：${gasCost}`);
  }
  return {
    roundId: session.roundId!,
    predictionCount: session.predictions.length,
    transactionCount: session.transactions.length,
    gasCostUsdc6: gasCost.toString(),
  };
}
