import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Hex } from "viem";

import { ARC_CHAIN_ID } from "../src/arc.js";
import {
  renderAblationReport,
  runAblationExperiment,
  serializeAblationReport,
  type FrozenReplaySource,
} from "../src/replay/ablation.js";

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

function timestamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, filePath);
}

async function findFrozenSource(): Promise<string> {
  const names = (await readdir("reports"))
    .filter((name) => name.startsWith("arc-walk-forward-") && name.endsWith(".json"))
    .sort()
    .reverse();
  for (const name of names) {
    const candidate = JSON.parse(await readFile(path.join("reports", name), "utf8")) as Partial<StoredReplayReport>;
    if (candidate.sampleCount === 101 && candidate.rounds?.length === 101) return path.join("reports", name);
  }
  throw new Error("没有找到恰含 101 个冻结轮次的 walk-forward JSON 报告");
}

async function main(): Promise<void> {
  const sourcePath = await findFrozenSource();
  const stored = JSON.parse(await readFile(sourcePath, "utf8")) as StoredReplayReport;
  const source: FrozenReplaySource = {
    sourceReport: sourcePath,
    sampleCount: stored.sampleCount,
    rounds: stored.rounds.map((round) => ({
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
  const generatedAt = new Date();
  const report = runAblationExperiment(source, generatedAt.toISOString(), ARC_CHAIN_ID);
  const basePath = `reports/arc-ablation-${timestamp(generatedAt)}`;
  await Promise.all([
    atomicWrite(`${basePath}.json`, serializeAblationReport(report)),
    atomicWrite(`${basePath}.md`, renderAblationReport(report)),
  ]);

  console.log(`卦象消融实验完成：每组 ${report.design.pairedRounds} 回合 / ${report.design.predictionsPerGroup} 条预测`);
  for (const group of Object.values(report.groups)) {
    console.log(`${group.label}：n=${group.summary.sampleCount}，命中率=${(group.summary.hitRateBps / 100).toFixed(2)}%，Brier=${group.summary.averageBrier.toFixed(6)}，Wilson 95%=${(group.summary.wilson95.lowerBps / 100).toFixed(2)}%–${(group.summary.wilson95.upperBps / 100).toFixed(2)}%`);
  }
  console.log(`诚实结论：${report.conclusion}`);
  console.log(`报告：${basePath}.md 与 ${basePath}.json`);
}

main().catch((error: unknown) => {
  console.error(`卦象消融实验失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
