import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

import { createArcPublicClient } from "../src/arc.js";
import { calibrateThreshold } from "../src/difficulty-calibration.js";
import { ArcReplaySource } from "../src/replay/arc-source.js";
import { USDC_ADDRESS } from "../src/yijing-deployment.js";

const STATE_PATH = "reports/deepseek-replay-state.json";
const BLOCK_STEP = 8n;
const RESOLUTION_HORIZON = 6n;
const DIFFICULTY_CALIBRATION_SAMPLES = 64;
const DIFFICULTY_CALIBRATION_STEP = 8n;

interface ExperimentState {
  startBlock: string;
  fullSampleCount: number;
  blockStep: string;
  resolutionHorizon: string;
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item, 2);
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir("reports", { recursive: true });
  await writeFile(`${filePath}.tmp`, content, "utf8");
  await rename(`${filePath}.tmp`, filePath);
}

async function main(): Promise<void> {
  const sampleText = process.argv.find((argument) => argument.startsWith("--samples="))?.slice("--samples=".length) ?? "20";
  const sampleCount = Number(sampleText);
  if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0 || sampleCount > 1_000) {
    throw new Error("--samples 必须是 1 至 1000 的整数");
  }
  const state = JSON.parse(await readFile(STATE_PATH, "utf8")) as ExperimentState;
  if (
    state.fullSampleCount !== 1_000
    || state.blockStep !== BLOCK_STEP.toString()
    || state.resolutionHorizon !== RESOLUTION_HORIZON.toString()
  ) {
    throw new Error("冻结实验状态与难度预检协议不一致");
  }

  const source = new ArcReplaySource(createArcPublicClient(), USDC_ADDRESS);
  const rounds = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const cutoffBlock = BigInt(state.startBlock) + BigInt(index) * BLOCK_STEP;
    const resolutionBlock = cutoffBlock + RESOLUTION_HORIZON;
    const [snapshot, history] = await Promise.all([
      source.readCutoffSnapshot(cutoffBlock, 1),
      source.readCalibrationHistory(
        cutoffBlock,
        RESOLUTION_HORIZON,
        DIFFICULTY_CALIBRATION_SAMPLES,
        DIFFICULTY_CALIBRATION_STEP,
      ),
    ]);
    const calibration = calibrateThreshold({
      cutoffBlock,
      currentValue: snapshot.cutoff.totalSupply,
      horizonBlocks: RESOLUTION_HORIZON,
      history,
      minimumBaseRateBps: 3_500,
      maximumBaseRateBps: 6_500,
    });
    if (!calibration.suitable) {
      throw new Error(`第 ${index + 1} 轮谓词不适合用于测量：${calibration.reason}`);
    }
    const resolution = await source.readResolution(resolutionBlock);
    rounds.push({
      replayId: index + 1,
      cutoffBlock,
      resolutionBlock,
      calibration,
      outcome: resolution.totalSupply > calibration.threshold,
    });
    if ((index + 1) % 10 === 0 || index + 1 === sampleCount) {
      console.log(`难度预检进度：${index + 1}/${sampleCount}`);
    }
  }

  const yesCount = rounds.filter((round) => round.outcome).length;
  const actualBaseRateBps = Math.round(yesCount * 10_000 / sampleCount);
  const historicalRates = rounds.map((round) => round.calibration.empiricalBaseRateBps);
  const report = {
    schemaVersion: "1.0",
    backtested: true,
    sampleCount,
    yesCount,
    actualBaseRateBps,
    allHistoricalRatesWithinTarget: historicalRates.every((rate) => rate >= 3_500 && rate <= 6_500),
    minimumHistoricalBaseRateBps: Math.min(...historicalRates),
    maximumHistoricalBaseRateBps: Math.max(...historicalRates),
    rounds,
  };
  const outputPath = `reports/difficulty-preflight-${sampleCount}.json`;
  await atomicWrite(outputPath, `${stringify(report)}\n`);
  console.log(`难度预检完成：n=${sampleCount}，实际 YES=${yesCount}（${(actualBaseRateBps / 100).toFixed(2)}%）`);
  console.log(`逐轮历史基础概率范围：${(report.minimumHistoricalBaseRateBps / 100).toFixed(2)}%–${(report.maximumHistoricalBaseRateBps / 100).toFixed(2)}%；全部位于 35%–65%=${report.allHistoricalRatesWithinTarget ? "是" : "否"}`);
  console.log(`报告：${outputPath}`);
}

main().catch((error: unknown) => {
  console.error(`难度预检失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
