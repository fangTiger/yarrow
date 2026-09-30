import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { ARC_CHAIN_ID, createArcPublicClient } from "../src/arc.js";
import { DeepSeekProvider } from "../src/agent/deepseek-provider.js";
import type { DivinerKey } from "../src/agent/diviners.js";
import type { ProviderUsage } from "../src/agent/provider.js";
import {
  estimateDeepSeekUsagePeakUsd,
  estimateDeepSeekUsageUsd,
  getDeepSeekBalance,
} from "../src/deepseek-budget.js";
import { ArcReplaySource } from "../src/replay/arc-source.js";
import { DeepSeekReplayPredictor } from "../src/replay/deepseek-predictor.js";
import { WalkForwardReplayEngine } from "../src/replay/engine.js";
import { FileGenerationJournal, ResumableStructuredGenerator } from "../src/replay/generation-journal.js";
import { renderReplayReport, serializeReplayRun } from "../src/replay/report.js";
import { USDC_ADDRESS } from "../src/yijing-deployment.js";

const STATE_PATH = "reports/deepseek-replay-state.json";
const JOURNAL_PATH = "reports/deepseek-generation-audit.jsonl";
const FULL_REPORT_PATH = "reports/deepseek-walk-forward-1000";
const CALIBRATION_REPORT_PATH = "reports/deepseek-walk-forward-calibration-30";
const FULL_SAMPLE_COUNT = 1_000;
const CALIBRATION_SAMPLE_COUNT = 30;
const BLOCK_STEP = 8n;
const RESOLUTION_HORIZON = 6n;
const LOOKBACK_BLOCKS = 4;
const DIFFICULTY_CALIBRATION_SAMPLES = 64;
const DIFFICULTY_CALIBRATION_STEP = 8n;
const DIVINER_KEYS = ["takashima", "wuxing", "meihua"] as const satisfies readonly DivinerKey[];
// 只用于保守预算换算；最终实际花费以余额接口的人民币差额为准。
const BUDGET_CNY_PER_USD = 7.5;

interface ExperimentState {
  schemaVersion: "1.0";
  createdAt: string;
  chainId: number;
  startBlock: string;
  fullSampleCount: number;
  blockStep: string;
  resolutionHorizon: string;
  lookbackBlocks: number;
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

async function loadOrCreateState(mode: "calibrate" | "full"): Promise<ExperimentState> {
  try {
    const state = JSON.parse(await readFile(STATE_PATH, "utf8")) as ExperimentState;
    if (
      state.schemaVersion !== "1.0" || state.chainId !== ARC_CHAIN_ID
      || state.fullSampleCount !== FULL_SAMPLE_COUNT || state.blockStep !== BLOCK_STEP.toString()
      || state.resolutionHorizon !== RESOLUTION_HORIZON.toString() || state.lookbackBlocks !== LOOKBACK_BLOCKS
    ) throw new Error("冻结实验状态与当前协议不一致");
    return state;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    if (mode !== "calibrate") throw new Error("全量回放前必须先完成校准并冻结样本窗口");
    const latestBlock = await createArcPublicClient().getBlockNumber();
    const coveredBlocks = BigInt(FULL_SAMPLE_COUNT - 1) * BLOCK_STEP + RESOLUTION_HORIZON;
    const state: ExperimentState = {
      schemaVersion: "1.0",
      createdAt: new Date().toISOString(),
      chainId: ARC_CHAIN_ID,
      startBlock: (latestBlock - coveredBlocks - 32n).toString(),
      fullSampleCount: FULL_SAMPLE_COUNT,
      blockStep: BLOCK_STEP.toString(),
      resolutionHorizon: RESOLUTION_HORIZON.toString(),
      lookbackBlocks: LOOKBACK_BLOCKS,
    };
    await atomicWrite(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
    return state;
  }
}

async function main(): Promise<void> {
  const modeValue = process.argv.find((argument) => argument.startsWith("--mode="))?.slice("--mode=".length);
  if (modeValue !== "calibrate" && modeValue !== "full") {
    throw new Error("必须指定 --mode=calibrate 或 --mode=full");
  }
  const mode = modeValue;
  const sampleCount = mode === "calibrate" ? CALIBRATION_SAMPLE_COUNT : FULL_SAMPLE_COUNT;
  const state = await loadOrCreateState(mode);
  const journal = await FileGenerationJournal.open(JOURNAL_PATH);
  const usageBefore = journal.usageTotals();
  const entryCountBefore = journal.allEntries().length;
  const balanceBefore = await getDeepSeekBalance();
  const provider = new DeepSeekProvider({ maxAttempts: 10, maxTokens: 384 });
  const predictor = new DeepSeekReplayPredictor(new ResumableStructuredGenerator(provider, journal));
  const generatedAt = new Date();

  const run = await new WalkForwardReplayEngine({
    source: new ArcReplaySource(createArcPublicClient(), USDC_ADDRESS),
    predictor,
    divinerKeys: DIVINER_KEYS,
    sampleCount,
    startBlock: BigInt(state.startBlock),
    blockStep: BLOCK_STEP,
    resolutionHorizon: RESOLUTION_HORIZON,
    lookbackBlocks: LOOKBACK_BLOCKS,
    feeUsdc6: 50_000n,
    initialBankrollUsdc6: 3_000_000n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
    difficultyCalibration: {
      sampleCount: DIFFICULTY_CALIBRATION_SAMPLES,
      stepBlocks: DIFFICULTY_CALIBRATION_STEP,
      minimumBaseRateBps: 3_500,
      maximumBaseRateBps: 6_500,
    },
    onRoundComplete: async (completed, total) => {
      const interval = mode === "calibrate" ? 5 : 25;
      if (completed === total || completed % interval === 0) console.log(`DeepSeek 主回放进度：${completed}/${total}`);
      // 恢复阶段没有模型延迟；轻微节流避免瞬间打满公共历史 RPC。
      if (mode === "full") await new Promise((resolve) => setTimeout(resolve, 80));
    },
  }).run();

  const balanceAfter = await getDeepSeekBalance();
  const allEntries = journal.allEntries();
  const newEntries = allEntries.slice(entryCountBefore);
  const usage = subtractUsage(journal.usageTotals(), usageBefore);
  const validOutputs = newEntries.filter((entry) => entry.result === "valid").length;
  const estimatedCurrentUsd = newEntries.reduce(
    (sum, entry) => sum + (entry.usage ? estimateDeepSeekUsageUsd(entry.usage, new Date(entry.recordedAt)) : 0),
    0,
  );
  const estimatedPeakUsd = estimateDeepSeekUsagePeakUsd(usage);
  const actualBalanceDeltaCny = (balanceBefore.balances.CNY ?? 0) - (balanceAfter.balances.CNY ?? 0);
  const callsPerMain = FULL_SAMPLE_COUNT * DIVINER_KEYS.length;
  const peakMainUsd = validOutputs === 0 ? 0 : estimatedPeakUsd * callsPerMain / validOutputs;
  // actual 组直接复用主回放输出，另三组各调用相同数量，故总成本按主回放的四倍估算。
  const peakFourGroupsUsd = peakMainUsd * 4;
  const budget = {
    balanceBefore,
    balanceAfter,
    actualBalanceDeltaCny,
    usage,
    attempts: newEntries.length,
    validOutputs,
    estimatedAtObservedTimeUsd: estimatedCurrentUsd,
    estimatedPeakForThisRunUsd: estimatedPeakUsd,
    projectedMain1000PeakUsd: peakMainUsd,
    projectedMain1000PeakCny: peakMainUsd * BUDGET_CNY_PER_USD,
    projectedFourGroups1000PeakUsd: peakFourGroupsUsd,
    projectedFourGroups1000PeakCny: peakFourGroupsUsd * BUDGET_CNY_PER_USD,
    cnyPerUsdBudgetAssumption: BUDGET_CNY_PER_USD,
    pricingNote: "采用 2026-08-16 后 V4-Flash 峰时单价：缓存命中 $0.014/M、未命中 $0.44/M、输出 $1.32/M；实际扣款以余额接口为准。",
  };
  const metadata = { generatedAt: generatedAt.toISOString(), chainId: ARC_CHAIN_ID };
  const basePath = mode === "calibrate" ? CALIBRATION_REPORT_PATH : FULL_REPORT_PATH;
  const reportObject = JSON.parse(serializeReplayRun(run, metadata)) as Record<string, unknown>;
  reportObject.providerAudit = {
    modelId: provider.modelId,
    providerConfig: provider.providerConfig,
    providerConfigHash: provider.providerConfigHash,
    generationJournal: JOURNAL_PATH,
    firstValidOutputPolicy: "每个任务键采用并持久化首个合法输出；恢复时按请求哈希复用，禁止再次生成。",
  };
  reportObject.budget = budget;
  const budgetMarkdown = [
    "",
    "## DeepSeek 审计与预算",
    "",
    `- 固定配置哈希：\`${provider.providerConfigHash}\``,
    `- 本次新尝试：${newEntries.length}；首个合法输出：${validOutputs}`,
    `- token：prompt=${usage.promptTokens}（cache hit=${usage.promptCacheHitTokens}，miss=${usage.promptCacheMissTokens}），completion=${usage.completionTokens}`,
    `- 余额：${(balanceBefore.balances.CNY ?? 0).toFixed(2)} → ${(balanceAfter.balances.CNY ?? 0).toFixed(2)} CNY；接口可见扣减=${actualBalanceDeltaCny.toFixed(2)} CNY`,
    `- 按实际调用时段 token 估算：$${estimatedCurrentUsd.toFixed(6)}；按峰时单价估算本次：$${estimatedPeakUsd.toFixed(6)}`,
    `- 外推主回放 1000 回合：峰时 $${peakMainUsd.toFixed(4)} / ${budget.projectedMain1000PeakCny.toFixed(2)} CNY`,
    `- 外推四组各 1000 回合（actual 复用主回放）：峰时 $${peakFourGroupsUsd.toFixed(4)} / ${budget.projectedFourGroups1000PeakCny.toFixed(2)} CNY`,
    "- 审计日志逐尝试保存原始输出及其哈希；任务已有合法输出时按请求哈希恢复，不再次请求 provider。",
    "",
  ].join("\n");
  await Promise.all([
    atomicWrite(`${basePath}.json`, `${JSON.stringify(reportObject, null, 2)}\n`),
    atomicWrite(`${basePath}.md`, `${renderReplayReport(run, metadata)}${budgetMarkdown}`),
  ]);

  console.log(`DeepSeek ${mode === "calibrate" ? "校准" : "主回放"}完成：${sampleCount} 回合 / ${validOutputs} 个新合法输出`);
  console.log(`token：prompt=${usage.promptTokens}（命中=${usage.promptCacheHitTokens}，未命中=${usage.promptCacheMissTokens}），completion=${usage.completionTokens}`);
  console.log(`余额：${(balanceBefore.balances.CNY ?? 0).toFixed(2)} → ${(balanceAfter.balances.CNY ?? 0).toFixed(2)} CNY；可见扣减=${actualBalanceDeltaCny.toFixed(2)} CNY`);
  console.log(`预算外推：主回放1000峰时≈${budget.projectedMain1000PeakCny.toFixed(2)} CNY；四组各1000峰时≈${budget.projectedFourGroups1000PeakCny.toFixed(2)} CNY`);
  console.log(`报告：${basePath}.md 与 ${basePath}.json`);
}

main().catch((error: unknown) => {
  console.error(`DeepSeek 回放失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
