import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { createWalletClient, http, type Address, type Hex, type TransactionReceipt } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import type { DivinerKey } from "../src/agent/diviners.js";
import { ArcReplaySource } from "../src/replay/arc-source.js";
import { WalkForwardReplayEngine, type ReplayRun } from "../src/replay/engine.js";
import { DeterministicReplayMock } from "../src/replay/mock-provider.js";
import { renderReplayReport, serializeReplayRun } from "../src/replay/report.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";
import { USDC_ADDRESS } from "../src/yijing-deployment.js";

const DEPLOYMENT_PATH = "deployments/arc-testnet.json";
const SAMPLE_COUNT = 101;
// Arc 时间戳按秒记录；六块跨度避免“块高更晚但时间戳同秒”的无效样本。
const BLOCK_STEP = 8n;
const RESOLUTION_HORIZON = 6n;
const LOOKBACK_BLOCKS = 4;
const BATCH_SIZE = 10;
const DIVINER_KEYS: readonly DivinerKey[] = ["takashima", "wuxing", "meihua"];

interface DeploymentManifest {
  network: { chainId: number };
  accounts: { deployer: Address; diviners: Array<{ key: DivinerKey; address: Address }> };
  contracts: Record<string, { address: Address }>;
  runs: Array<{ reportPath: string; generatedAt: string; status: string }>;
}

interface OnchainRecord {
  transactionHash: Hex;
  blockNumber: string;
  gasUsed: string;
  gasCostWei: string;
}

interface OnchainStats {
  sampleCount: bigint;
  correctCount: bigint;
  unresolvedCount: bigint;
  totalBrier: bigint;
}

const publicClient = createArcPublicClient();

function reportTimestamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

function transactionRecord(receipt: TransactionReceipt, transactionHash: Hex): OnchainRecord {
  return {
    transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    gasCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
  };
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, filePath);
}

function onchainEntries(run: ReplayRun, divinerKey: DivinerKey) {
  return run.rounds.map((round) => {
    const prediction = round.predictions.find((candidate) => candidate.divinerKey === divinerKey);
    if (!prediction) throw new Error(`回放轮 ${round.replayId} 缺少 ${divinerKey} 预测`);
    return {
      replayId: BigInt(round.replayId),
      cutoffBlock: round.cutoff.blockNumber,
      resolutionBlock: round.resolution.blockNumber,
      cutoffTimestamp: round.cutoff.timestamp,
      resolutionTimestamp: round.resolution.timestamp,
      probabilityBps: prediction.probabilityBps,
      direction: prediction.direction === "YES",
      outcome: round.outcome,
    };
  });
}

async function persistManifest(manifest: DeploymentManifest): Promise<void> {
  await atomicWrite(DEPLOYMENT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  const reportName = `arc-walk-forward-${reportTimestamp(generatedAt)}`;
  const jsonPath = `reports/${reportName}.json`;
  const markdownPath = `reports/${reportName}.md`;
  const manifest = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as DeploymentManifest;
  if (manifest.network.chainId !== ARC_CHAIN_ID) throw new Error("部署清单 Chain ID 与 Arc Testnet 不一致");
  const scoreBook = manifest.contracts.ScoreBook?.address;
  if (!scoreBook) throw new Error("部署清单缺少 ScoreBook");

  const latestBlock = await publicClient.getBlockNumber();
  const coveredBlocks = BigInt(SAMPLE_COUNT - 1) * BLOCK_STEP + RESOLUTION_HORIZON;
  const startBlock = latestBlock - coveredBlocks - 32n;
  const run = await new WalkForwardReplayEngine({
    source: new ArcReplaySource(publicClient, USDC_ADDRESS),
    predictor: new DeterministicReplayMock(),
    divinerKeys: DIVINER_KEYS,
    sampleCount: SAMPLE_COUNT,
    startBlock,
    blockStep: BLOCK_STEP,
    resolutionHorizon: RESOLUTION_HORIZON,
    lookbackBlocks: LOOKBACK_BLOCKS,
    feeUsdc6: 50_000n,
    initialBankrollUsdc6: 3_000_000n,
    maxRiskBps: 1_000,
    mMin: 1,
    mMax: 3,
    difficultyCalibration: {
      sampleCount: 64,
      stepBlocks: BLOCK_STEP,
      minimumBaseRateBps: 3_500,
      maximumBaseRateBps: 6_500,
    },
  }).run();
  const metadata = { generatedAt: generatedAt.toISOString(), chainId: ARC_CHAIN_ID };
  await atomicWrite(jsonPath, serializeReplayRun(run, metadata));
  await atomicWrite(markdownPath, renderReplayReport(run, metadata));

  const privateKey = requireArcPrivateKey(process.env);
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() !== manifest.accounts.deployer.toLowerCase()) {
    throw new Error("部署清单的部署者与当前 ARC_PRIVATE_KEY 不一致");
  }
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
  const scoreArtifact = await loadProbeArtifact("contracts/out/ScoreBook.sol/ScoreBook.json");
  const transactions: OnchainRecord[] = [];

  for (const divinerKey of DIVINER_KEYS) {
    const diviner = manifest.accounts.diviners.find((candidate) => candidate.key === divinerKey)?.address;
    if (!diviner) throw new Error(`部署清单缺少 ${divinerKey} 地址`);
    const existingCount = await publicClient.readContract({
      address: scoreBook,
      abi: scoreArtifact.abi,
      functionName: "backtestHistoryCount",
      args: [diviner],
    }) as bigint;
    if (existingCount !== 0n) throw new Error(`${divinerKey} 已有 ${existingCount} 条回放记录，拒绝用新窗口覆盖`);
    const entries = onchainEntries(run, divinerKey);
    for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
      const batch = entries.slice(offset, offset + BATCH_SIZE);
      const simulation = await publicClient.simulateContract({
        account,
        address: scoreBook,
        abi: scoreArtifact.abi,
        functionName: "recordBacktestBatch",
        args: [diviner, batch],
      } as never);
      const transactionHash = await walletClient.writeContract({ ...simulation.request, account } as never);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
      if (receipt.status !== "success") throw new Error(`${divinerKey} 回放批次 ${offset / BATCH_SIZE + 1} 上链回滚`);
      transactions.push(transactionRecord(receipt, transactionHash));
      console.log(`${divinerKey} 回放上链：${Math.min(offset + batch.length, entries.length)}/${entries.length}`);
    }
  }

  for (const diviner of manifest.accounts.diviners) {
    const stats = await publicClient.readContract({
      address: scoreBook,
      abi: scoreArtifact.abi,
      functionName: "getBacktestStats",
      args: [diviner.address],
    }) as OnchainStats;
    const expected = run.summaries[diviner.key];
    if (stats.sampleCount !== BigInt(SAMPLE_COUNT) || stats.correctCount !== BigInt(expected.correctCount)) {
      throw new Error(`${diviner.key} 的 ScoreBook 回放统计与本地报告不一致`);
    }
  }

  const gasCostWei = transactions.reduce((sum, transaction) => sum + BigInt(transaction.gasCostWei), 0n);
  const reportObject = JSON.parse(serializeReplayRun(run, metadata)) as Record<string, unknown>;
  reportObject.onchain = {
    status: "PASS",
    scoreBook,
    transactionCount: transactions.length,
    gasCostWei: gasCostWei.toString(),
    gasCostUsdc: (Number(gasCostWei / 1_000_000_000n) / 1_000_000_000).toFixed(6),
    transactions,
  };
  await atomicWrite(jsonPath, `${JSON.stringify(reportObject, null, 2)}\n`);
  await atomicWrite(
    markdownPath,
    `${renderReplayReport(run, metadata)}\n## ScoreBook 链上写入\n\n- 状态：PASS\n- ScoreBook：\`${scoreBook}\`\n- 交易数：${transactions.length}\n- gas 成本：${(Number(gasCostWei / 1_000_000n) / 1_000_000_000_000).toFixed(6)} USDC\n- 三位易者各写入 ${SAMPLE_COUNT} 条独立标记为 backtested 的历史；现场统计与 ReputationRegistry 未被修改。\n`,
  );
  manifest.runs ??= [];
  manifest.runs.push({ reportPath: markdownPath, generatedAt: metadata.generatedAt, status: "PASS" });
  await persistManifest(manifest);

  console.log(`Walk-Forward 回放完成：${SAMPLE_COUNT} 回合，全部标注 backtested`);
  for (const key of DIVINER_KEYS) {
    const summary = run.summaries[key];
    console.log(`${key}：Brier=${summary.averageBrier.toFixed(6)}，Wilson 95%=${(summary.wilson95.lowerBps / 100).toFixed(2)}%–${(summary.wilson95.upperBps / 100).toFixed(2)}%`);
  }
  console.log(`报告：${markdownPath} 与 ${jsonPath}`);
}

main().catch((error: unknown) => {
  console.error(`Walk-Forward 回放失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
