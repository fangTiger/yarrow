import type { Address, Hex } from "viem";

import type {
  DemoDriver,
  DemoMode,
  DemoPrediction,
  DemoPredictionResult,
  DemoPreparedRound,
  DemoProgress,
  DemoRoundConfirmation,
  DemoRoundPreparation,
  DemoRoundSecret,
  DemoRoundResult,
  DemoSession,
  DemoSettlementResult,
  DemoWitnessInput,
  DemoTransaction,
} from "./service.js";
import { REUSABLE_APPROVAL_ROUND_COUNT, REUSABLE_APPROVAL_USDC6 } from "../frontend/wallet.js";
import { splitOracleFee } from "../oracle/fee-payment.js";
import { buildAttestedHumanProposition, humanRequestHash, resolveHumanWitnesses } from "./human-proposition.js";

const REGISTRY = "0xd33f6d851e8ce486d01198457a3c58daa4feee61";
const PREDICTION_BOOK = "0x83fc712fbd5f48c171d25c8136c87f71bebcb00e";
const TOKEN = "0x3600000000000000000000000000000000000000";
const PREDICTION_HASHES = [
  `0x${"44".repeat(32)}`,
  `0x${"55".repeat(32)}`,
  `0x${"66".repeat(32)}`,
] as const;
const FEE_DISTRIBUTION_HASHES = [
  `0x${"a1".repeat(32)}`,
  `0x${"b2".repeat(32)}`,
  `0x${"c3".repeat(32)}`,
] as const;
const REVEAL_HASH = `0x${"33".repeat(32)}` as const;
const SETTLEMENT_HASHES = [
  `0x${"77".repeat(32)}`,
  `0x${"88".repeat(32)}`,
  `0x${"99".repeat(32)}`,
] as const;

export interface MockDemoDriverOptions {
  delayMilliseconds?: number;
}

function transaction(kind: DemoTransaction["kind"], hash: Hex, label: string, blockNumber: number): DemoTransaction {
  return { kind, hash, label, blockNumber: String(blockNumber), gasCostUsdc6: "0" };
}

/** 只用于开发与排练；不访问链、钱包私钥或任何模型，也不是面向用户的免费轨。 */
export class MockDemoDriver implements DemoDriver {
  private readonly delayMilliseconds: number;

  constructor(options: MockDemoDriverOptions = {}) {
    this.delayMilliseconds = options.delayMilliseconds ?? 650;
  }

  async prepareRound(input: { question: string; mode: DemoMode; querent: Address }): Promise<DemoPreparedRound> {
    if (input.mode !== "mock") throw new Error("浏览器验收驱动只允许 mock，禁止真实模型调用");
    return {
      preparation: {
        chainId: 5_042_002,
        roundId: "9001",
        commitment: `0x${"bb".repeat(32)}`,
        registry: REGISTRY,
        predictionBook: PREDICTION_BOOK,
        usdcToken: TOKEN,
        feeUsdc6: "50000",
        bondUsdc6: "500000",
        waitBlocks: "8",
        approvalAmountUsdc6: REUSABLE_APPROVAL_USDC6.toString(),
        approvalRoundCount: REUSABLE_APPROVAL_ROUND_COUNT,
      },
      secret: { salt: `0x${"aa".repeat(32)}` },
    };
  }

  async confirmRound(
    _session: DemoSession,
    _preparation: DemoRoundPreparation,
    _secret: DemoRoundSecret,
    input: DemoRoundConfirmation,
    progress: (update: DemoProgress) => void,
  ): Promise<DemoRoundResult> {
    const revealWaitStartedAt = Date.now();
    await this.pause();
    if (input.approvalHash) progress({ phase: "committing", transaction: transaction("approval", input.approvalHash, "授权卦金与保证金", 101) });
    progress({ phase: "waiting-reveal", transaction: transaction("commit", input.commitHash, "立誓写入链上", 102) });
    await this.pause();
    progress({ timing: { key: "reveal-wait", actualMilliseconds: Date.now() - revealWaitStartedAt } });
    const revealStartedAt = Date.now();
    const reveal = transaction("reveal", REVEAL_HASH, "服务端自动揭示成卦", 111);
    progress({
      phase: "revealing",
      transaction: reveal,
      timing: { key: "reveal", actualMilliseconds: Date.now() - revealStartedAt },
    });
    return {
      roundId: "9001",
      transactions: [reveal],
      hexagram: {
        lines: [8, 6, 8, 9, 8, 7],
        primaryKingWenNumber: 35,
        primaryName: "火地晋",
        derivedKingWenNumber: 4,
        derivedName: "山水蒙",
        changingLinePositions: [2, 4],
      },
    };
  }

  async createPredictions(_session: DemoSession, progress: (update: DemoProgress) => void): Promise<DemoPredictionResult> {
    const inferenceStartedAt = Date.now();
    const proposition = buildAttestedHumanProposition({
      question: _session.question,
      requestHash: humanRequestHash({ roundId: _session.roundId ?? "9001", question: _session.question }),
      agentId: 891_440n,
      cutoffBlock: 12_400n,
      deadlineBlock: 12_460n,
      horizon: _session.horizon,
    });
    progress({ phase: "compiling", proposition });
    await this.pause();
    progress({ timing: { key: "inference", actualMilliseconds: Date.now() - inferenceStartedAt } });
    const predictions: DemoPrediction[] = [
      { id: "4101", divinerKey: "takashima", divinerName: "高島易断", probabilityBps: 6100, direction: "YES", multiplier: 1, reasoning: "晋卦有推进之势，但两处变爻提示过程并不稳定，因此对原问题只取温和偏是。", transaction: transaction("prediction", PREDICTION_HASHES[0], "高島易断提交预测", 112) },
      { id: "4102", divinerKey: "wuxing", divinerName: "五行易（断易）", probabilityBps: 4200, direction: "NO", multiplier: 1, reasoning: "世应之间助力不足，事情成就的条件尚未齐备，判断略偏不会发生。", transaction: transaction("prediction", PREDICTION_HASHES[1], "五行易提交预测", 113) },
      { id: "4103", divinerKey: "meihua", divinerName: "梅花心易", probabilityBps: 7300, direction: "YES", multiplier: 1, reasoning: "外应见动而之卦为蒙，消息虽有迟疑，仍给出较明确的会发生判断。", transaction: transaction("prediction", PREDICTION_HASHES[2], "梅花心易提交预测", 114) },
    ];
    const predictionStartedAt = Date.now();
    for (const prediction of predictions) {
      await this.pause();
      progress({ phase: "predicting", prediction });
    }
    const feeDistributionTransactions = splitOracleFee().map((share, index) => ({
      ...transaction(
        "fee-distribution",
        FEE_DISTRIBUTION_HASHES[index]!,
        `卦金分入${share.divinerName}金库`,
        115 + index,
      ),
      amountUsdc6: share.amountUsdc6.toString(),
    }));
    for (const item of feeDistributionTransactions) progress({ phase: "predicting", transaction: item });
    progress({ timing: { key: "predictions", actualMilliseconds: Date.now() - predictionStartedAt } });
    return {
      proposition,
      predictions,
      transactions: feeDistributionTransactions,
      provider: { kind: "mock", modelId: "mock-yijing-demo-v1" },
    };
  }

  async settleRound(
    _session: DemoSession,
    progress: (update: DemoProgress) => void,
    input: DemoWitnessInput = {},
  ): Promise<DemoSettlementResult> {
    const settlementStartedAt = Date.now();
    const transactions = SETTLEMENT_HASHES.map((hash, index) => transaction("settlement", hash, `服务端结算预测 #${4101 + index}`, 12501 + index));
    for (const item of transactions) {
      await this.pause();
      progress({ phase: "settling", transaction: item });
    }
    progress({ timing: { key: "settlement", actualMilliseconds: Date.now() - settlementStartedAt } });
    const witness = resolveHumanWitnesses({
      querentOutcome: typeof input.querentOutcome === "boolean" ? input.querentOutcome : null,
      counterpartyOutcome: typeof input.counterpartyOutcome === "boolean" ? input.counterpartyOutcome : null,
    });
    return {
      transactions,
      outcome: witness.outcome,
      unresolved: witness.unresolved,
      vaultChanges: [
        { divinerKey: "takashima", beforeUsdc6: "175580", afterUsdc6: "157580", deltaUsdc6: "-18000" },
        { divinerKey: "wuxing", beforeUsdc6: "214720", afterUsdc6: "222910", deltaUsdc6: "8190" },
        { divinerKey: "meihua", beforeUsdc6: "185020", afterUsdc6: "181020", deltaUsdc6: "-4000" },
      ],
    };
  }

  private async pause(): Promise<void> {
    if (this.delayMilliseconds <= 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, this.delayMilliseconds));
  }
}
