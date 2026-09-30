import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Hex } from "viem";

import { ARC_CHAIN_ID } from "../src/arc.js";
import { DeepSeekProvider } from "../src/agent/deepseek-provider.js";
import type { ProviderUsage } from "../src/agent/provider.js";
import {
  estimateDeepSeekUsagePeakUsd,
  estimateDeepSeekUsageUsd,
  getDeepSeekBalance,
  isDeepSeekPeakTime,
} from "../src/deepseek-budget.js";
import {
  renderAblationReport,
  serializeAblationReport,
  type FrozenReplaySource,
} from "../src/replay/ablation.js";
import { runDeepSeekAblationExperiment } from "../src/replay/deepseek-ablation.js";
import { DeepSeekReplayPredictor } from "../src/replay/deepseek-predictor.js";
import { FileGenerationJournal, ResumableStructuredGenerator } from "../src/replay/generation-journal.js";

const MAIN_REPORT_PATH = "reports/deepseek-walk-forward-1000.json";
const CALIBRATION_REPORT_PATH = "reports/deepseek-walk-forward-calibration-20.json";
const JOURNAL_PATH = "reports/deepseek-generation-audit.jsonl";
const BUDGET_CNY_PER_USD = 7.5;

interface StoredReplayReport {
  sampleCount: number;
  rounds: Array<{
    replayId: number;
    cutoff: { blockNumber: string; blockHash: Hex; totalSupply: string };
    proposition: {
      statement: string;
      cutoffBlock: string;
      resolutionBlock: string;
      threshold: string;
      calibration: {
        suitable: true;
        threshold: string;
        thresholdDelta: string;
        sampleCount: number;
        yesCount: number;
        empiricalBaseRateBps: number;
        historyStartBlock: string;
        historyEndBlock: string;
        horizonBlocks: string;
      };
    };
    hexagram: { lines: number[]; primaryKingWenNumber: number; derivedKingWenNumber: number };
    outcome: boolean;
  }>;
}

interface CalibrationReport {
  budget?: { projectedMain1000PeakCny?: number };
}

function subtractUsage(after: ProviderUsage, before: ProviderUsage): ProviderUsage {
  return {
    promptTokens: after.promptTokens - before.promptTokens,
    completionTokens: after.completionTokens - before.completionTokens,
    promptCacheHitTokens: after.promptCacheHitTokens - before.promptCacheHitTokens,
    promptCacheMissTokens: after.promptCacheMissTokens - before.promptCacheMissTokens,
  };
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(`${filePath}.tmp`, content, "utf8");
  await rename(`${filePath}.tmp`, filePath);
}

async function main(): Promise<void> {
  const sampleText = process.argv.find((argument) => argument.startsWith("--samples="))?.slice("--samples=".length) ?? "1000";
  const sampleCount = Number(sampleText);
  if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0 || sampleCount > 1_000) {
    throw new Error("--samples 必须是 1 至 1000 的整数");
  }
  const stored = JSON.parse(await readFile(MAIN_REPORT_PATH, "utf8")) as StoredReplayReport;
  if (stored.sampleCount !== 1_000 || stored.rounds.length !== 1_000) {
    throw new Error("消融前必须先完成同一冻结窗口的 1000 回合 DeepSeek 主回放");
  }
  const source: FrozenReplaySource = {
    sourceReport: MAIN_REPORT_PATH,
    sampleCount,
    rounds: stored.rounds.slice(0, sampleCount).map((round) => ({
      replayId: round.replayId,
      cutoff: {
        blockNumber: BigInt(round.cutoff.blockNumber),
        blockHash: round.cutoff.blockHash,
        totalSupply: BigInt(round.cutoff.totalSupply),
      },
      proposition: {
        statement: round.proposition.statement,
        cutoffBlock: BigInt(round.proposition.cutoffBlock),
        resolutionBlock: BigInt(round.proposition.resolutionBlock),
        threshold: BigInt(round.proposition.threshold),
        calibration: {
          ...round.proposition.calibration,
          threshold: BigInt(round.proposition.calibration.threshold),
          thresholdDelta: BigInt(round.proposition.calibration.thresholdDelta),
          historyStartBlock: BigInt(round.proposition.calibration.historyStartBlock),
          historyEndBlock: BigInt(round.proposition.calibration.historyEndBlock),
          horizonBlocks: BigInt(round.proposition.calibration.horizonBlocks),
        },
      },
      hexagram: {
        lines: round.hexagram.lines,
        primaryKingWenNumber: round.hexagram.primaryKingWenNumber,
        derivedKingWenNumber: round.hexagram.derivedKingWenNumber,
      },
      outcome: round.outcome,
    })),
  };

  const calibration = JSON.parse(await readFile(CALIBRATION_REPORT_PATH, "utf8")) as CalibrationReport;
  const mainPeakCny = calibration.budget?.projectedMain1000PeakCny;
  if (typeof mainPeakCny !== "number" || !Number.isFinite(mainPeakCny)) throw new Error("校准报告缺少峰时预算外推");
  const rateMultiplier = isDeepSeekPeakTime(new Date()) ? 1 : 0.5;
  const projectedControlCny = mainPeakCny * 3 * sampleCount / 1_000 * rateMultiplier;
  const balanceBefore = await getDeepSeekBalance();
  const availableCny = balanceBefore.balances.CNY ?? 0;
  if (availableCny < projectedControlCny * 1.1) {
    const affordable = Math.max(1, Math.floor(sampleCount * availableCny / (projectedControlCny * 1.1)));
    throw new Error(`余额不足以保守覆盖 ${sampleCount} 回合三组对照；建议 --samples=${affordable}`);
  }

  const journal = await FileGenerationJournal.open(JOURNAL_PATH);
  const entryCountBefore = journal.allEntries().length;
  const usageBefore = journal.usageTotals();
  const provider = new DeepSeekProvider({ maxAttempts: 10, maxTokens: 384 });
  const predictor = new DeepSeekReplayPredictor(new ResumableStructuredGenerator(provider, journal));
  const generatedAt = new Date();
  const report = await runDeepSeekAblationExperiment({
    source,
    predictor,
    generatedAt: generatedAt.toISOString(),
    chainId: ARC_CHAIN_ID,
    providerConfigHash: provider.providerConfigHash,
    onRoundComplete: (completed, total) => {
      if (completed === total || completed % 25 === 0) console.log(`DeepSeek 四组消融进度：${completed}/${total}`);
    },
  });

  const balanceAfter = await getDeepSeekBalance();
  const entries = journal.allEntries().slice(entryCountBefore);
  const unexpectedActual = entries.filter((entry) => entry.key.includes("/actual/")).length;
  if (unexpectedActual !== 0) throw new Error(`actual 组意外新生成 ${unexpectedActual} 次，拒绝报告`);
  const usage = subtractUsage(journal.usageTotals(), usageBefore);
  const validOutputs = entries.filter((entry) => entry.result === "valid").length;
  const estimatedCurrentUsd = entries.reduce(
    (sum, entry) => sum + (entry.usage ? estimateDeepSeekUsageUsd(entry.usage, new Date(entry.recordedAt)) : 0),
    0,
  );
  const estimatedPeakUsd = estimateDeepSeekUsagePeakUsd(usage);
  const actualBalanceDeltaCny = (balanceBefore.balances.CNY ?? 0) - (balanceAfter.balances.CNY ?? 0);
  const budget = {
    balanceBefore,
    balanceAfter,
    actualBalanceDeltaCny,
    usage,
    attempts: entries.length,
    validOutputs,
    actualOutputsReused: sampleCount * 3,
    actualOutputsRegenerated: unexpectedActual,
    estimatedAtObservedTimeUsd: estimatedCurrentUsd,
    estimatedPeakUsd,
    estimatedPeakCny: estimatedPeakUsd * BUDGET_CNY_PER_USD,
    preflightProjectedCny: projectedControlCny,
    pricingWindowAtStart: rateMultiplier === 0.5 ? "谷时" : "峰时",
  };
  const reportObject = JSON.parse(serializeAblationReport(report)) as Record<string, unknown>;
  reportObject.budget = budget;
  reportObject.audit = {
    journalPath: JOURNAL_PATH,
    actualReuseVerified: true,
    firstValidOutputPolicy: "每一条件、轮次、易者采用首个合法输出；恢复时已有合法输出绝不再次生成。",
  };
  const basePath = `reports/deepseek-ablation-${sampleCount}`;
  const budgetMarkdown = [
    "",
    "## DeepSeek 审计与花费",
    "",
    `- actual 组复用主回放：${sampleCount * 3} 条；意外重生成：${unexpectedActual}`,
    `- 三组对照新合法输出：${validOutputs}；总尝试：${entries.length}`,
    `- token：prompt=${usage.promptTokens}（cache hit=${usage.promptCacheHitTokens}，miss=${usage.promptCacheMissTokens}），completion=${usage.completionTokens}`,
    `- 余额：${(balanceBefore.balances.CNY ?? 0).toFixed(2)} → ${(balanceAfter.balances.CNY ?? 0).toFixed(2)} CNY；接口可见扣减=${actualBalanceDeltaCny.toFixed(2)} CNY`,
    `- 按调用时段 token 估算：$${estimatedCurrentUsd.toFixed(6)}；峰时上界：$${estimatedPeakUsd.toFixed(6)} / ${(estimatedPeakUsd * BUDGET_CNY_PER_USD).toFixed(2)} CNY`,
    "",
  ].join("\n");
  await Promise.all([
    atomicWrite(`${basePath}.json`, `${JSON.stringify(reportObject, null, 2)}\n`),
    atomicWrite(`${basePath}.md`, `${renderAblationReport(report)}${budgetMarkdown}`),
  ]);

  console.log(`DeepSeek 消融完成：四组各 ${sampleCount} 回合 / ${sampleCount * 3} 条预测`);
  for (const group of Object.values(report.groups)) {
    console.log(`${group.label}：n=${group.summary.sampleCount}，命中率=${(group.summary.hitRateBps / 100).toFixed(2)}%，Brier=${group.summary.averageBrier.toFixed(6)}，Wilson=${(group.summary.wilson95.lowerBps / 100).toFixed(2)}%–${(group.summary.wilson95.upperBps / 100).toFixed(2)}%`);
  }
  console.log(`余额：${(balanceBefore.balances.CNY ?? 0).toFixed(2)} → ${(balanceAfter.balances.CNY ?? 0).toFixed(2)} CNY；actual 重生成=${unexpectedActual}`);
  console.log(`诚实结论：${report.conclusion}`);
  console.log(`报告：${basePath}.md 与 ${basePath}.json`);
}

main().catch((error: unknown) => {
  console.error(`DeepSeek 消融失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
