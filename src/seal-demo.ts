import { toFunctionSelector, type Address, type Hex } from "viem";

import { deterministicRiskDecision, settlementDeltaUsdc6 } from "./replay/engine.js";

export const SEAL_DEMO_PARAMETERS = {
  waitBlocks: 2n,
  revealWindow: 96n,
  maxResolutionDelay: 96n,
  feeUsdc6: 5_000n,
  bondUsdc6: 25_000n,
  vaultFundingUsdc6: 130_000n,
  mMin: 1,
  mMax: 5,
  probabilityBps: 9_900,
  minimumSurvivalUsdc6: 15_000n,
} as const;

export interface PlannedSealRound {
  sequence: number;
  outcome: boolean;
  probabilityBps: number;
  multiplier: number;
  brier: bigint;
  settlementDeltaUsdc6: bigint;
  bankrollBeforeUsdc6: bigint;
  bankrollAfterUsdc6: bigint;
  sealedAfter: boolean;
}

export interface SealTransactionRecord {
  title: string;
  expected: "SUCCESS" | "REVERT";
  status: "SUCCESS" | "REVERT" | "FAIL";
  transactionHash: Hex;
  blockNumber: bigint;
  gasUsed: bigint;
  gasCostWei: bigint;
  revertReason?: string;
}

export interface SealContractRecord {
  address: Address;
  transactionHash: Hex;
  blockNumber: bigint;
  gasUsed: bigint;
  gasCostWei: bigint;
  constructorArgs: readonly unknown[];
}

export interface SealRoundRecord extends PlannedSealRound {
  roundId: bigint;
  deadline: bigint;
  primaryKingWenNumber: number;
  derivedKingWenNumber: number;
  lines: readonly number[];
  commitTransactionHash: Hex;
  revealTransactionHash: Hex;
  submitTransactionHash: Hex;
  settleTransactionHash: Hex;
}

export interface SealDemoReport {
  schemaVersion: "1.0";
  generatedAt: string;
  network: { name: "Arc Testnet"; chainId: number };
  status: "RUNNING" | "PASS" | "FAIL";
  provider: { kind: "mock"; modelId: string };
  parameters: typeof SEAL_DEMO_PARAMETERS;
  accounts: { deployer: Address; querent: Address; diviner: Address; settler: Address };
  contracts: Record<string, SealContractRecord>;
  transactions: SealTransactionRecord[];
  rounds: SealRoundRecord[];
  agent?: { agentId: bigint; transactionHash: Hex };
  permanence: {
    resubmitReverted: boolean;
    depositReverted: boolean;
    forcedTransferDidNotRevive: boolean;
    finalState: "ACTIVE" | "SEALED";
    finalAssetsUsdc6: bigint;
    historyCount: bigint;
    lastRoundId: bigint;
  };
  costs: {
    gasCostWei: bigint;
    gasCostUsdc6: bigint;
    vaultFundingUsdc6: bigint;
    conservativeBudgetUseUsdc6: bigint;
    deployerBalanceBeforeWei: bigint;
    deployerBalanceAfterWei: bigint;
    controlledBalanceAfterWei: bigint;
  };
  notes: string[];
}

/** RPC 可能只返回四字节选择器；两种表达都必须能严格匹配同一个自定义错误。 */
export function matchesExpectedCustomError(error: unknown, signature: string): boolean {
  const name = signature.slice(0, signature.indexOf("("));
  const selector = toFunctionSelector(signature);
  const queue: unknown[] = [error];
  const seen = new Set<object>();
  while (queue.length > 0) {
    const candidate = queue.shift();
    if (typeof candidate === "string") {
      if (candidate.includes(name) || candidate.toLowerCase().includes(selector.toLowerCase())) return true;
      continue;
    }
    if (typeof candidate !== "object" || candidate === null || seen.has(candidate)) continue;
    seen.add(candidate);
    const record = candidate as Record<string, unknown>;
    for (const key of ["shortMessage", "message", "details", "data", "raw", "cause"]) {
      if (record[key] !== undefined) queue.push(record[key]);
    }
  }
  return false;
}

function brierScore(probabilityBps: number, outcome: boolean): bigint {
  const distance = BigInt(outcome ? 10_000 - probabilityBps : probabilityBps);
  return distance * distance;
}

/**
 * 与链上 RiskMath 和 SettlementMath 使用相同的整数顺序，预先固定演示的可验资金轨迹。
 */
export function plannedSealTrajectory(): PlannedSealRound[] {
  let bankrollUsdc6 = SEAL_DEMO_PARAMETERS.vaultFundingUsdc6;
  let sampleCount = 0;
  let totalBrier = 0n;
  const outcomes = [true, false, false, false, false, false] as const;

  return outcomes.map((outcome, index) => {
    const risk = deterministicRiskDecision({
      bankrollUsdc6,
      feeUsdc6: SEAL_DEMO_PARAMETERS.feeUsdc6,
      sampleCount,
      totalBrier,
      maxRiskBps: 10_000,
      mMin: SEAL_DEMO_PARAMETERS.mMin,
      mMax: SEAL_DEMO_PARAMETERS.mMax,
    });
    if (risk.multiplier === 0) throw new Error(`演示轨迹在第 ${index + 1} 轮提前失去应卦能力`);
    const brier = brierScore(SEAL_DEMO_PARAMETERS.probabilityBps, outcome);
    const delta = settlementDeltaUsdc6(
      SEAL_DEMO_PARAMETERS.feeUsdc6,
      risk.multiplier,
      SEAL_DEMO_PARAMETERS.probabilityBps,
      outcome,
    );
    const before = bankrollUsdc6;
    bankrollUsdc6 += delta;
    sampleCount += 1;
    totalBrier += brier;
    return {
      sequence: index + 1,
      outcome,
      probabilityBps: SEAL_DEMO_PARAMETERS.probabilityBps,
      multiplier: risk.multiplier,
      brier,
      settlementDeltaUsdc6: delta,
      bankrollBeforeUsdc6: before,
      bankrollAfterUsdc6: bankrollUsdc6,
      sealedAfter: bankrollUsdc6 < SEAL_DEMO_PARAMETERS.minimumSurvivalUsdc6,
    };
  });
}

function formatUsdc6(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "−" : ""}${absolute / 1_000_000n}.${(absolute % 1_000_000n).toString().padStart(6, "0")}`;
}

function formatNativeUsdc(value: bigint): string {
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = (value % 1_000_000_000_000_000_000n).toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${fraction}`;
}

export function serializeSealDemoReport(report: SealDemoReport): string {
  return `${JSON.stringify(report, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value, 2)}\n`;
}

const BIGINT_REPORT_KEYS = new Set([
  "waitBlocks",
  "revealWindow",
  "maxResolutionDelay",
  "feeUsdc6",
  "bondUsdc6",
  "vaultFundingUsdc6",
  "minimumSurvivalUsdc6",
  "blockNumber",
  "gasUsed",
  "gasCostWei",
  "brier",
  "settlementDeltaUsdc6",
  "bankrollBeforeUsdc6",
  "bankrollAfterUsdc6",
  "roundId",
  "deadline",
  "agentId",
  "finalAssetsUsdc6",
  "historyCount",
  "lastRoundId",
  "gasCostUsdc6",
  "conservativeBudgetUseUsdc6",
  "deployerBalanceBeforeWei",
  "deployerBalanceAfterWei",
  "controlledBalanceAfterWei",
]);

/** 从精确十进制 JSON 恢复续跑所需 bigint；未知扩展字段保持原样。 */
export function parseSealDemoReport<T extends SealDemoReport = SealDemoReport>(text: string): T {
  return JSON.parse(text, (key, value: unknown) => {
    if (BIGINT_REPORT_KEYS.has(key) && typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
    return value;
  }) as T;
}

/** 把早期续跑中保留的 RPC 原始回滚串转换为可交付的中文审计说明。 */
export function normalizeSealDemoNotes(notes: readonly string[]): string[] {
  return notes.map((note) => {
    if (note.includes('function "submitPrediction"') && note.includes("0x00497160")) {
      return "首次封存后应卦模拟仅返回自定义错误选择器 0x00497160；经合约 ABI 核对为 VaultSealed()。";
    }
    if (note.includes('function "deposit"') && note.includes("reverted")) {
      return "首次正式注资模拟仅报告合约回滚；随后发送的链上回滚交易与状态核验确认金库仍为 SEALED。";
    }
    return note;
  });
}

export function renderSealDemoReport(report: SealDemoReport): string {
  const transactionRows = report.transactions.map((transaction) =>
    `| ${transaction.title} | ${transaction.expected} | ${transaction.status} | \`${transaction.transactionHash}\` | ${transaction.blockNumber} | ${transaction.gasUsed} | ${formatNativeUsdc(transaction.gasCostWei)} | ${transaction.revertReason ?? "—"} |`
  );
  const roundRows = report.rounds.map((round) =>
    `| ${round.sequence} | ${round.roundId} | ${round.outcome ? "YES" : "NO"} | ${(round.probabilityBps / 100).toFixed(2)}% | ${round.multiplier} | ${(Number(round.brier) / 100_000_000).toFixed(4)} | ${formatUsdc6(round.settlementDeltaUsdc6)} | ${formatUsdc6(round.bankrollBeforeUsdc6)} → ${formatUsdc6(round.bankrollAfterUsdc6)} | ${round.sealedAfter ? "SEALED" : "ACTIVE"} |`
  );
  return [
    "# Arc Testnet 易者永久封存报告",
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 状态：${report.status}`,
    `- Provider：确定性 mock（${report.provider.modelId}）`,
    "- 结算来源：Arc Testnet 上的 UsdcSupplyResolver；没有管理函数写入 SEALED。",
    `- 生存线：3·m_min·F = ${formatUsdc6(report.parameters.minimumSurvivalUsdc6)} USDC`,
    "",
    "## 资金与评分轨迹",
    "",
    "| 序号 | roundId | 结果 | YES 概率 | m | Brier | ΔB（USDC） | 金库前→后（USDC） | 结算后状态 |",
    "|---:|---:|---|---:|---:|---:|---:|---:|---|",
    ...roundRows,
    "",
    "## 永久性验证",
    "",
    `- 再次应卦回滚：${report.permanence.resubmitReverted ? "PASS" : "FAIL"}`,
    `- 正式注资回滚：${report.permanence.depositReverted ? "PASS" : "FAIL"}`,
    `- 强制转入不能复活：${report.permanence.forcedTransferDidNotRevive ? "PASS" : "FAIL"}`,
    `- 最终状态：${report.permanence.finalState}`,
    `- 最终链上金库：${formatUsdc6(report.permanence.finalAssetsUsdc6)} USDC`,
    `- 链上卦历：${report.permanence.historyCount} 条；最后 roundId=${report.permanence.lastRoundId}`,
    "",
    "## 逐笔交易证据",
    "",
    "| 步骤 | 预期 | 回执 | 交易哈希 | 块高 | gas | 成本（USDC） | 回滚原因 |",
    "|---|---|---|---|---:|---:|---:|---|",
    ...transactionRows,
    "",
    "## 成本",
    "",
    `- gas：${formatNativeUsdc(report.costs.gasCostWei)} USDC`,
    `- 演示金库注资：${formatUsdc6(report.costs.vaultFundingUsdc6)} USDC`,
    `- 保守预算占用：${formatUsdc6(report.costs.conservativeBudgetUseUsdc6)} USDC`,
    `- 部署者余额：${formatNativeUsdc(report.costs.deployerBalanceBeforeWei)} → ${formatNativeUsdc(report.costs.deployerBalanceAfterWei)} USDC`,
    `- 受控账户合计余额：${formatNativeUsdc(report.costs.controlledBalanceAfterWei)} USDC`,
    "",
    "## 限制与说明",
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
  ].join("\n");
}
