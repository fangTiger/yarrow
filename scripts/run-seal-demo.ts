import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  encodeAbiParameters,
  encodeFunctionData,
  http,
  keccak256,
  stringToHex,
  createWalletClient,
  type Abi,
  type Account,
  type Address,
  type Hex,
  type TransactionReceipt,
  maxUint256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact, type ProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { scanLogsInBlockWindows } from "../src/arc-logs.js";
import { errorMessage } from "../src/revert.js";
import {
  SEAL_DEMO_PARAMETERS,
  matchesExpectedCustomError,
  normalizeSealDemoNotes,
  plannedSealTrajectory,
  parseSealDemoReport,
  renderSealDemoReport,
  serializeSealDemoReport,
  type SealContractRecord,
  type SealDemoReport,
  type SealRoundRecord,
  type SealTransactionRecord,
} from "../src/seal-demo.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";
import {
  REPUTATION_REGISTRY_ADDRESS,
  USDC_ADDRESS,
  deriveRolePrivateKey,
} from "../src/yijing-deployment.js";

const MANIFEST_PATH = "deployments/arc-testnet-seal-demo.json";
const SUPPLY_PREDICATE_ID = keccak256(stringToHex("USDC_TOTAL_SUPPLY_ABOVE"));
const SUPPLY_SCHEMA_HASH = keccak256(stringToHex("abi.encode(uint256 threshold)"));
const MODEL_ID = "deterministic-seal-demo-mock-v1";
const MODEL_HASH = keccak256(stringToHex(MODEL_ID));
const OUTPUT_SCHEMA_HASH = keccak256(stringToHex("seal-demo-prediction-schema-v1"));
const PROVIDER_CONFIG_HASH = keccak256(stringToHex("deterministic-seal-demo-provider-config-v1"));
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

interface SealDemoManifest extends SealDemoReport {
  reportPath: string;
  profile: { key: "sealed-demo"; name: "折筮·零号" };
}

interface RoundView {
  commitBlock: bigint;
  revealDeadline: bigint;
  fee: bigint;
  bond: bigint;
  lines: readonly number[];
  primaryHex: number;
  derivedHex: number;
  state: number;
}

interface PredictionView {
  multiplier: number;
  probabilityBps: number;
}

interface StatsView {
  sampleCount: bigint;
  correctCount: bigint;
  unresolvedCount: bigint;
  totalBrier: bigint;
}

const publicClient = createArcPublicClient();
let manifest: SealDemoManifest;

function reportTimestamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-").replace(".", "-");
}

function walletFor(account: Account) {
  return createWalletClient({ account, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
}

function receiptCost(receipt: TransactionReceipt): bigint {
  return receipt.gasUsed * receipt.effectiveGasPrice;
}

function transactionRecord(
  title: string,
  expected: "SUCCESS" | "REVERT",
  status: "SUCCESS" | "REVERT" | "FAIL",
  hash: Hex,
  receipt: TransactionReceipt,
  revertReason?: string,
): SealTransactionRecord {
  return {
    title,
    expected,
    status,
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    gasCostWei: receiptCost(receipt),
    ...(revertReason ? { revertReason } : {}),
  };
}

function updateCosts(): void {
  const gasCostWei = manifest.transactions.reduce((sum, transaction) => sum + transaction.gasCostWei, 0n);
  manifest.costs.gasCostWei = gasCostWei;
  manifest.costs.gasCostUsdc6 = gasCostWei / 1_000_000_000_000n;
  manifest.costs.conservativeBudgetUseUsdc6 = manifest.costs.gasCostUsdc6 + manifest.costs.vaultFundingUsdc6;
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, filePath);
}

async function persist(): Promise<void> {
  updateCosts();
  await Promise.all([
    atomicWrite(MANIFEST_PATH, serializeSealDemoReport(manifest)),
    atomicWrite(manifest.reportPath.replace(/\.md$/, ".json"), serializeSealDemoReport(manifest)),
    atomicWrite(manifest.reportPath, renderSealDemoReport(manifest)),
  ]);
}

async function artifact(name: string): Promise<ProbeArtifact> {
  return loadProbeArtifact(`contracts/out/${name}.sol/${name}.json`);
}

async function deploy(
  title: string,
  name: string,
  artifactValue: ProbeArtifact,
  args: readonly unknown[],
  deployer: ReturnType<typeof privateKeyToAccount>,
): Promise<Address> {
  const existing = manifest.contracts[name];
  if (existing) {
    const code = await publicClient.getBytecode({ address: existing.address });
    if (!code || code === "0x") throw new Error(`${name} 已记录地址没有链上代码`);
    return existing.address;
  }
  const hash = await walletFor(deployer).deployContract({
    account: deployer,
    abi: artifactValue.abi,
    bytecode: artifactValue.bytecode,
    args,
  } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${title} 回滚：${hash}`);
  const record: SealContractRecord = {
    address: receipt.contractAddress,
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    gasCostWei: receiptCost(receipt),
    constructorArgs: args,
  };
  manifest.contracts[name] = record;
  manifest.transactions.push(transactionRecord(title, "SUCCESS", "SUCCESS", hash, receipt));
  await persist();
  console.log(`${title}：${hash}`);
  return receipt.contractAddress;
}

async function sendSuccess(input: {
  title: string;
  account: ReturnType<typeof privateKeyToAccount>;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}): Promise<SealTransactionRecord> {
  const simulation = await publicClient.simulateContract({
    account: input.account,
    address: input.address,
    abi: input.abi,
    functionName: input.functionName,
    args: input.args ?? [],
  } as never);
  const hash = await walletFor(input.account).writeContract({ ...simulation.request, account: input.account } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const status = receipt.status === "success" ? "SUCCESS" : "FAIL";
  const record = transactionRecord(input.title, "SUCCESS", status, hash, receipt);
  manifest.transactions.push(record);
  await persist();
  console.log(`${input.title}：${hash}`);
  if (status !== "SUCCESS") throw new Error(`${input.title} 链上回执为 reverted：${hash}`);
  return record;
}

async function requireSimulatedRevert(input: {
  account: ReturnType<typeof privateKeyToAccount>;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  expectedReason: string;
}): Promise<void> {
  try {
    await publicClient.simulateContract({
      account: input.account,
      address: input.address,
      abi: input.abi,
      functionName: input.functionName,
      args: input.args ?? [],
    } as never);
  } catch (error) {
    const message = errorMessage(error);
    if (!matchesExpectedCustomError(error, input.expectedReason)) {
      throw new Error(`预期 ${input.expectedReason}，模拟却得到：${message}`);
    }
    return;
  }
  throw new Error(`预期 ${input.expectedReason}，模拟调用却成功`);
}

async function sendExpectedRevert(input: {
  title: string;
  account: ReturnType<typeof privateKeyToAccount>;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  expectedReason: string;
}): Promise<SealTransactionRecord> {
  await requireSimulatedRevert(input);
  const data = encodeFunctionData({ abi: input.abi, functionName: input.functionName, args: input.args ?? [] } as never);
  const hash = await walletFor(input.account).sendTransaction({
    account: input.account,
    to: input.address,
    data,
    gas: 1_000_000n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const status = receipt.status === "reverted" ? "REVERT" : "FAIL";
  const record = transactionRecord(input.title, "REVERT", status, hash, receipt, input.expectedReason);
  manifest.transactions.push(record);
  await persist();
  console.log(`${input.title}（预期回滚）：${hash}`);
  if (status !== "REVERT") throw new Error(`${input.title} 本应回滚却成功：${hash}`);
  return record;
}

async function waitPastBlock(target: bigint, label: string): Promise<void> {
  const started = Date.now();
  let current = await publicClient.getBlockNumber();
  while (current <= target) {
    if (Date.now() - started > 120_000) throw new Error(`${label} 超时：目标 ${target}，当前 ${current}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    current = await publicClient.getBlockNumber();
  }
}

async function ensureBalance(
  deployer: ReturnType<typeof privateKeyToAccount>,
  recipient: Address,
  targetUsdc6: bigint,
  erc20Abi: Abi,
  label: string,
): Promise<void> {
  const current = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [recipient],
  }) as bigint;
  if (current >= targetUsdc6) return;
  await sendSuccess({
    title: `补足${label}余额`,
    account: deployer,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, targetUsdc6 - current],
  });
}

async function readKingWen(roundRegistry: Address, roundAbi: Abi, binaryIndex: number): Promise<number> {
  return Number(await publicClient.readContract({
    address: roundRegistry,
    abi: roundAbi,
    functionName: "kingWenNumber",
    args: [binaryIndex],
  }));
}

async function createRevealedRound(input: {
  sequence: number;
  question: string;
  fee: bigint;
  bond: bigint;
  querent: ReturnType<typeof privateKeyToAccount>;
  roundRegistry: Address;
  roundAbi: Abi;
}): Promise<{ roundId: bigint; round: RoundView; commitHash: Hex; revealHash: Hex }> {
  const roundId = await publicClient.readContract({
    address: input.roundRegistry,
    abi: input.roundAbi,
    functionName: "nextRoundId",
  }) as bigint;
  const salt = keccak256(stringToHex(`永久封存演示/${manifest.generatedAt}/${input.sequence}/${roundId}`));
  const commitment = await publicClient.readContract({
    address: input.roundRegistry,
    abi: input.roundAbi,
    functionName: "computeCommitment",
    args: [input.question, salt, input.querent.address, roundId],
  }) as Hex;
  const commit = await sendSuccess({
    title: `第${input.sequence}轮 commit`,
    account: input.querent,
    address: input.roundRegistry,
    abi: input.roundAbi,
    functionName: "commit",
    args: [commitment, input.fee, input.bond, roundId],
  });
  let round = await publicClient.readContract({
    address: input.roundRegistry,
    abi: input.roundAbi,
    functionName: "getRound",
    args: [roundId],
  }) as RoundView;
  await waitPastBlock(round.commitBlock + SEAL_DEMO_PARAMETERS.waitBlocks, `第${input.sequence}轮等待起卦块`);
  const reveal = await sendSuccess({
    title: `第${input.sequence}轮 reveal`,
    account: input.querent,
    address: input.roundRegistry,
    abi: input.roundAbi,
    functionName: "reveal",
    args: [roundId, input.question, salt],
  });
  round = await publicClient.readContract({
    address: input.roundRegistry,
    abi: input.roundAbi,
    functionName: "getRound",
    args: [roundId],
  }) as RoundView;
  return { roundId, round, commitHash: commit.transactionHash, revealHash: reveal.transactionHash };
}

async function controlledBalance(accounts: readonly Address[]): Promise<bigint> {
  const balances = await Promise.all(accounts.map((address) => publicClient.getBalance({ address })));
  return balances.reduce((sum, balance) => sum + balance, 0n);
}

async function resumePermanenceVerification(input: {
  deployer: ReturnType<typeof privateKeyToAccount>;
  querent: ReturnType<typeof privateKeyToAccount>;
  diviner: ReturnType<typeof privateKeyToAccount>;
  settler: ReturnType<typeof privateKeyToAccount>;
}): Promise<void> {
  const [roundArtifact, bookArtifact, vaultArtifact, scoreArtifact, erc20Artifact] = await Promise.all([
    artifact("DivinationRegistry"),
    artifact("PredictionBook"),
    artifact("DivinerVault"),
    artifact("ScoreBook"),
    artifact("IERC20"),
  ]);
  const roundRegistry = manifest.contracts.DivinationRegistry?.address;
  const predictionBook = manifest.contracts.PredictionBook?.address;
  const vault = manifest.contracts.DivinerVault?.address;
  const scoreBook = manifest.contracts.ScoreBook?.address;
  if (!roundRegistry || !predictionBook || !vault || !scoreBook) throw new Error("续跑清单缺少永久性复验所需合约");

  const nextRoundId = await publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "nextRoundId" }) as bigint;
  if (nextRoundId === 0n) throw new Error("续跑时链上不存在永久性复验轮次");
  const proofRoundId = nextRoundId - 1n;
  const proofRound = await publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [proofRoundId] }) as RoundView;
  if (proofRound.state !== 1) throw new Error(`续跑永久性复验轮次状态不是 REVEALED：${proofRound.state}`);

  const proofDeadline = (await publicClient.getBlockNumber()) + 96n;
  const proofRequest = {
    roundId: proofRoundId,
    direction: true,
    probabilityBps: SEAL_DEMO_PARAMETERS.probabilityBps,
    predicateId: SUPPLY_PREDICATE_ID,
    params: encodeAbiParameters([{ type: "uint256" }], [maxUint256]),
    deadline: proofDeadline,
    modelId: MODEL_HASH,
    promptHash: keccak256(stringToHex(`${MODEL_ID}/永久性复验续跑/${proofRoundId}`)),
    schemaHash: OUTPUT_SCHEMA_HASH,
    providerConfigHash: PROVIDER_CONFIG_HASH,
    attemptCount: 1,
  } as const;

  if (!manifest.transactions.some((transaction) => transaction.title === "封存后再次应卦")) {
    await sendExpectedRevert({
      title: "封存后再次应卦",
      account: input.diviner,
      address: predictionBook,
      abi: bookArtifact.abi,
      functionName: "submitPrediction",
      args: [proofRequest],
      expectedReason: "VaultSealed()",
    });
  }
  manifest.permanence.resubmitReverted = true;
  await persist();

  if (!manifest.transactions.some((transaction) => transaction.title === "封存后正式注资")) {
    await sendExpectedRevert({
      title: "封存后正式注资",
      account: input.deployer,
      address: vault,
      abi: vaultArtifact.abi,
      functionName: "deposit",
      args: [1n],
      expectedReason: "VaultSealed()",
    });
  }
  manifest.permanence.depositReverted = true;
  await persist();

  if (!manifest.transactions.some((transaction) => transaction.title === "向封存金库强制转入一个最小单位")) {
    await sendSuccess({
      title: "向封存金库强制转入一个最小单位",
      account: input.deployer,
      address: USDC_ADDRESS,
      abi: erc20Artifact.abi,
      functionName: "transfer",
      args: [vault, 1n],
    });
  }
  if (!manifest.transactions.some((transaction) => transaction.title === "强制转入后再次应卦")) {
    await sendExpectedRevert({
      title: "强制转入后再次应卦",
      account: input.diviner,
      address: predictionBook,
      abi: bookArtifact.abi,
      functionName: "submitPrediction",
      args: [proofRequest],
      expectedReason: "VaultSealed()",
    });
  }

  const [stateAfterForcedTransfer, historyCount, finalAssets] = await Promise.all([
    publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "state" }) as Promise<number>,
    publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "historyCount", args: [input.diviner.address] }) as Promise<bigint>,
    publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "totalAssets" }) as Promise<bigint>,
  ]);
  const sealedEventScanEnd = await publicClient.getBlockNumber();
  const sealedEvents = await scanLogsInBlockWindows({
    fromBlock: manifest.contracts.DivinerVault!.blockNumber,
    toBlock: sealedEventScanEnd,
    fetchLogs: ({ fromBlock, toBlock }) => publicClient.getContractEvents({
      address: vault,
      abi: vaultArtifact.abi,
      eventName: "Sealed",
      fromBlock,
      toBlock,
      strict: true,
    }),
  });
  if (stateAfterForcedTransfer !== 1) throw new Error("续跑复验发现强制转入后状态不是 SEALED");
  if (historyCount !== 6n) throw new Error(`续跑复验发现链上卦历不是 6：${historyCount}`);
  if (sealedEvents.length !== 1) throw new Error(`续跑复验预期一个 Sealed 事件，实际 ${sealedEvents.length}`);
  const lastEntry = await publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "getHistory", args: [input.diviner.address, historyCount - 1n] }) as { roundId: bigint };
  manifest.permanence = {
    resubmitReverted: true,
    depositReverted: true,
    forcedTransferDidNotRevive: true,
    finalState: "SEALED",
    finalAssetsUsdc6: finalAssets,
    historyCount,
    lastRoundId: lastEntry.roundId,
  };
  manifest.costs.deployerBalanceAfterWei = await publicClient.getBalance({ address: input.deployer.address });
  manifest.costs.controlledBalanceAfterWei = await controlledBalance([
    input.deployer.address,
    input.querent.address,
    input.diviner.address,
    input.settler.address,
  ]);
  updateCosts();
  if (manifest.costs.conservativeBudgetUseUsdc6 >= 4_000_000n) {
    throw new Error(`续跑后保守预算超过 4 USDC：${manifest.costs.conservativeBudgetUseUsdc6}`);
  }
  manifest.status = "PASS";
  manifest.notes.push("首次永久性模拟复验因 RPC 只返回自定义错误选择器而停住；确认 0x00497160=VaultSealed() 后按既有第 7 轮续跑，未重放部署或六轮结算。");
  await persist();
  console.log("Arc Testnet 永久封存：PASS（从永久性复验断点续跑）");
  console.log(`最终金库：${finalAssets}（六位精度）；卦历：${historyCount}`);
  console.log(`报告：${manifest.reportPath}`);
}

async function main(): Promise<void> {
  const basePrivateKey = requireArcPrivateKey(process.env);
  const deployer = privateKeyToAccount(basePrivateKey);
  const querent = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "seal-demo/querent"));
  const diviner = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "seal-demo/diviner"));
  const settler = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "seal-demo/settler"));
  const chainId = await publicClient.getChainId();
  if (chainId !== ARC_CHAIN_ID) throw new Error(`Chain ID 错误：${chainId}`);

  try {
    const existing = parseSealDemoReport<SealDemoManifest>(await readFile(MANIFEST_PATH, "utf8"));
    if (existing.status === "PASS") {
      manifest = existing;
      manifest.notes = normalizeSealDemoNotes(existing.notes);
      const vault = existing.contracts.DivinerVault?.address;
      if (!vault) throw new Error("既有封存清单缺少 DivinerVault");
      const vaultArtifact = await artifact("DivinerVault");
      const state = Number(await publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "state" }));
      if (state !== 1) throw new Error("既有封存清单标为 PASS，但链上金库不是 SEALED");
      await persist();
      console.log(`复用已完成的永久封存报告：${existing.reportPath}`);
      return;
    }
    const canResumePermanence = existing.rounds.length === 6
      && existing.transactions.some((transaction) => transaction.title === "第7轮 reveal")
      && existing.contracts.DivinerVault !== undefined;
    if (canResumePermanence) {
      manifest = existing;
      manifest.status = "RUNNING";
      await persist();
      await resumePermanenceVerification({ deployer, querent, diviner, settler });
      return;
    }
    throw new Error("发现未完成的封存清单；为避免重复发送交易，需先按逐笔哈希人工续跑");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }

  const generatedAt = new Date();
  const reportPath = `reports/arc-seal-demo-${reportTimestamp(generatedAt)}.md`;
  const deployerBalanceBeforeWei = await publicClient.getBalance({ address: deployer.address });
  if (deployerBalanceBeforeWei < 4_000_000_000_000_000_000n) {
    throw new Error("部署者余额低于 4 USDC，无法满足本轮保守预算预检");
  }
  manifest = {
    schemaVersion: "1.0",
    generatedAt: generatedAt.toISOString(),
    network: { name: "Arc Testnet", chainId: ARC_CHAIN_ID },
    status: "RUNNING",
    provider: { kind: "mock", modelId: MODEL_ID },
    parameters: SEAL_DEMO_PARAMETERS,
    accounts: { deployer: deployer.address, querent: querent.address, diviner: diviner.address, settler: settler.address },
    contracts: {},
    transactions: [],
    rounds: [],
    permanence: {
      resubmitReverted: false,
      depositReverted: false,
      forcedTransferDidNotRevive: false,
      finalState: "ACTIVE",
      finalAssetsUsdc6: 0n,
      historyCount: 0n,
      lastRoundId: 0n,
    },
    costs: {
      gasCostWei: 0n,
      gasCostUsdc6: 0n,
      vaultFundingUsdc6: SEAL_DEMO_PARAMETERS.vaultFundingUsdc6,
      conservativeBudgetUseUsdc6: SEAL_DEMO_PARAMETERS.vaultFundingUsdc6,
      deployerBalanceBeforeWei,
      deployerBalanceAfterWei: deployerBalanceBeforeWei,
      controlledBalanceAfterWei: deployerBalanceBeforeWei,
    },
    notes: [
      "六轮概率由确定性 mock 固定为 YES 99%；mock 不能证明真实模型能力。",
      "前五次错误之前的一次正确结算只用于让链上确定性策略先提高倍率，从而可观察后续收缩。",
      "错误轮使用 USDC 总量大于 uint256 最大值这一不可满足命题；结果由 UsdcSupplyResolver 在截止后首次链上观察并缓存，不由管理员写入。",
      "ERC-20 允许任何人强制转入代币，合约无法阻止该动作；永久性的定义是 SEALED 状态不变、deposit 回滚且之后永远不能再应卦。",
    ],
    reportPath,
    profile: { key: "sealed-demo", name: "折筮·零号" },
  };
  await persist();

  const [predicateArtifact, scoreArtifact, roundArtifact, bookArtifact, vaultArtifact, supplyArtifact, erc20Artifact] =
    await Promise.all([
      artifact("PredicateRegistry"),
      artifact("ScoreBook"),
      artifact("DivinationRegistry"),
      artifact("PredictionBook"),
      artifact("DivinerVault"),
      artifact("UsdcSupplyResolver"),
      artifact("IERC20"),
    ]);

  await ensureBalance(deployer, querent.address, 300_000n, erc20Artifact.abi, "演示提问者");
  await ensureBalance(deployer, diviner.address, 200_000n, erc20Artifact.abi, "演示易者");
  await ensureBalance(deployer, settler.address, 200_000n, erc20Artifact.abi, "无许可结算者");

  const predicateRegistry = await deploy("部署 PredicateRegistry", "PredicateRegistry", predicateArtifact, [], deployer);
  const scoreBook = await deploy("部署 ScoreBook", "ScoreBook", scoreArtifact, [REPUTATION_REGISTRY_ADDRESS], deployer);
  const roundRegistry = await deploy("部署 DivinationRegistry", "DivinationRegistry", roundArtifact, [
    USDC_ADDRESS,
    deployer.address,
    SEAL_DEMO_PARAMETERS.waitBlocks,
    SEAL_DEMO_PARAMETERS.revealWindow,
  ], deployer);
  const predictionBook = await deploy("部署 PredictionBook", "PredictionBook", bookArtifact, [
    USDC_ADDRESS,
    roundRegistry,
    predicateRegistry,
    scoreBook,
  ], deployer);
  const vault = await deploy("部署 DivinerVault", "DivinerVault", vaultArtifact, [
    USDC_ADDRESS,
    predictionBook,
    diviner.address,
    SEAL_DEMO_PARAMETERS.mMin,
    SEAL_DEMO_PARAMETERS.mMax,
  ], deployer);
  const supplyResolver = await deploy("部署 UsdcSupplyResolver", "UsdcSupplyResolver", supplyArtifact, [
    USDC_ADDRESS,
    SEAL_DEMO_PARAMETERS.maxResolutionDelay,
  ], deployer);

  if ((await publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "escrowOperator" })) === ZERO_ADDRESS) {
    await sendSuccess({ title: "设置托管操作员", account: deployer, address: roundRegistry, abi: roundArtifact.abi, functionName: "setEscrowOperator", args: [predictionBook] });
  }
  if ((await publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "recorder" })) === ZERO_ADDRESS) {
    await sendSuccess({ title: "设置计分记录者", account: deployer, address: scoreBook, abi: scoreArtifact.abi, functionName: "setRecorder", args: [predictionBook] });
  }
  if ((await publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "vaultOf", args: [diviner.address] })) === ZERO_ADDRESS) {
    await sendSuccess({ title: "注册演示易者", account: deployer, address: predictionBook, abi: bookArtifact.abi, functionName: "registerDiviner", args: [diviner.address, vault] });
  }
  await sendSuccess({
    title: "登记天层 USDC 总量谓词",
    account: deployer,
    address: predicateRegistry,
    abi: predicateArtifact.abi,
    functionName: "setPredicate",
    args: [SUPPLY_PREDICATE_ID, supplyResolver, SUPPLY_SCHEMA_HASH, false, 0, true],
  });

  await sendSuccess({ title: "授权演示金库注资", account: deployer, address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "approve", args: [vault, SEAL_DEMO_PARAMETERS.vaultFundingUsdc6] });
  await sendSuccess({ title: "注资演示金库", account: deployer, address: vault, abi: vaultArtifact.abi, functionName: "deposit", args: [SEAL_DEMO_PARAMETERS.vaultFundingUsdc6] });
  await sendSuccess({ title: "提问者授权七轮托管", account: querent, address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "approve", args: [roundRegistry, 210_002n] });

  const trajectory = plannedSealTrajectory();
  for (const expected of trajectory) {
    const outcomeLabel = expected.outcome ? "正确预热" : `连续错误 ${expected.sequence - 1}/5`;
    const question = `永久封存演示第 ${expected.sequence} 卦：Arc USDC 总量是否超过本轮预注册阈值？`;
    const revealed = await createRevealedRound({
      sequence: expected.sequence,
      question,
      fee: SEAL_DEMO_PARAMETERS.feeUsdc6,
      bond: SEAL_DEMO_PARAMETERS.bondUsdc6,
      querent,
      roundRegistry,
      roundAbi: roundArtifact.abi,
    });
    const currentBlock = await publicClient.getBlockNumber();
    const deadline = currentBlock + 24n;
    const threshold = expected.outcome ? 0n : maxUint256;
    const params = encodeAbiParameters([{ type: "uint256" }], [threshold]);
    const predictionId = await publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "nextPredictionId" }) as bigint;
    const promptHash = keccak256(stringToHex(`${MODEL_ID}/${expected.sequence}/${question}/${revealed.round.lines.join("/")}`));
    const request = {
      roundId: revealed.roundId,
      direction: true,
      probabilityBps: SEAL_DEMO_PARAMETERS.probabilityBps,
      predicateId: SUPPLY_PREDICATE_ID,
      params,
      deadline,
      modelId: MODEL_HASH,
      promptHash,
      schemaHash: OUTPUT_SCHEMA_HASH,
      providerConfigHash: PROVIDER_CONFIG_HASH,
      attemptCount: 1,
    } as const;
    const submit = await sendSuccess({
      title: `第${expected.sequence}轮应卦（${outcomeLabel}）`,
      account: diviner,
      address: predictionBook,
      abi: bookArtifact.abi,
      functionName: "submitPrediction",
      args: [request],
    });
    const prediction = await publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "getPrediction", args: [predictionId] }) as PredictionView;
    if (prediction.multiplier !== expected.multiplier || prediction.probabilityBps !== expected.probabilityBps) {
      throw new Error(`第${expected.sequence}轮链上 m/p 与计划不一致`);
    }
    await waitPastBlock(deadline, `第${expected.sequence}轮等待结算截止块`);
    const settle = await sendSuccess({
      title: `第${expected.sequence}轮真实结算（${outcomeLabel}）`,
      account: settler,
      address: predictionBook,
      abi: bookArtifact.abi,
      functionName: "settle",
      args: [predictionId],
    });
    const [assets, state, stats] = await Promise.all([
      publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "totalAssets" }) as Promise<bigint>,
      publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "state" }) as Promise<number>,
      publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "getStats", args: [diviner.address] }) as Promise<StatsView>,
    ]);
    if (assets !== expected.bankrollAfterUsdc6 || (state === 1) !== expected.sealedAfter || stats.sampleCount !== BigInt(expected.sequence)) {
      throw new Error(`第${expected.sequence}轮链上资金、状态或样本数偏离计划`);
    }
    const primary = await readKingWen(roundRegistry, roundArtifact.abi, revealed.round.primaryHex);
    const derived = await readKingWen(roundRegistry, roundArtifact.abi, revealed.round.derivedHex);
    const roundRecord: SealRoundRecord = {
      ...expected,
      roundId: revealed.roundId,
      deadline,
      primaryKingWenNumber: primary,
      derivedKingWenNumber: derived,
      lines: revealed.round.lines,
      commitTransactionHash: revealed.commitHash,
      revealTransactionHash: revealed.revealHash,
      submitTransactionHash: submit.transactionHash,
      settleTransactionHash: settle.transactionHash,
    };
    manifest.rounds.push(roundRecord);
    await persist();
    console.log(`第${expected.sequence}轮终态：m=${expected.multiplier}，Brier=${Number(expected.brier) / 100_000_000}，金库=${assets}`);
  }

  const finalState = Number(await publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "state" }));
  if (finalState !== 1) throw new Error("连续真实亏损完成后金库未进入 SEALED");
  const sealedEventScanEnd = await publicClient.getBlockNumber();
  const sealedEvents = await scanLogsInBlockWindows({
    fromBlock: manifest.contracts.DivinerVault!.blockNumber,
    toBlock: sealedEventScanEnd,
    fetchLogs: ({ fromBlock, toBlock }) => publicClient.getContractEvents({
      address: vault,
      abi: vaultArtifact.abi,
      eventName: "Sealed",
      fromBlock,
      toBlock,
      strict: true,
    }),
  });
  if (sealedEvents.length !== 1) throw new Error(`预期恰好一个 Sealed 事件，实际 ${sealedEvents.length}`);

  const proofRound = await createRevealedRound({
    sequence: 7,
    question: "永久性复验：已封存易者能否再次应卦？",
    fee: 1n,
    bond: 1n,
    querent,
    roundRegistry,
    roundAbi: roundArtifact.abi,
  });
  const proofDeadline = (await publicClient.getBlockNumber()) + 96n;
  const proofParams = encodeAbiParameters([{ type: "uint256" }], [maxUint256]);
  const proofRequest = {
    roundId: proofRound.roundId,
    direction: true,
    probabilityBps: SEAL_DEMO_PARAMETERS.probabilityBps,
    predicateId: SUPPLY_PREDICATE_ID,
    params: proofParams,
    deadline: proofDeadline,
    modelId: MODEL_HASH,
    promptHash: keccak256(stringToHex(`${MODEL_ID}/永久性复验/${proofRound.roundId}`)),
    schemaHash: OUTPUT_SCHEMA_HASH,
    providerConfigHash: PROVIDER_CONFIG_HASH,
    attemptCount: 1,
  } as const;
  await sendExpectedRevert({
    title: "封存后再次应卦",
    account: diviner,
    address: predictionBook,
    abi: bookArtifact.abi,
    functionName: "submitPrediction",
    args: [proofRequest],
    expectedReason: "VaultSealed()",
  });
  manifest.permanence.resubmitReverted = true;

  await sendExpectedRevert({
    title: "封存后正式注资",
    account: deployer,
    address: vault,
    abi: vaultArtifact.abi,
    functionName: "deposit",
    args: [1n],
    expectedReason: "VaultSealed()",
  });
  manifest.permanence.depositReverted = true;

  await sendSuccess({
    title: "向封存金库强制转入一个最小单位",
    account: deployer,
    address: USDC_ADDRESS,
    abi: erc20Artifact.abi,
    functionName: "transfer",
    args: [vault, 1n],
  });
  await sendExpectedRevert({
    title: "强制转入后再次应卦",
    account: diviner,
    address: predictionBook,
    abi: bookArtifact.abi,
    functionName: "submitPrediction",
    args: [proofRequest],
    expectedReason: "VaultSealed()",
  });
  const stateAfterForcedTransfer = Number(await publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "state" }));
  manifest.permanence.forcedTransferDidNotRevive = stateAfterForcedTransfer === 1;

  const historyCount = await publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "historyCount", args: [diviner.address] }) as bigint;
  if (historyCount !== 6n) throw new Error(`链上卦历应为 6，实际 ${historyCount}`);
  const lastEntry = await publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "getHistory", args: [diviner.address, historyCount - 1n] }) as { roundId: bigint };
  const finalAssets = await publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "totalAssets" }) as bigint;
  manifest.permanence = {
    resubmitReverted: true,
    depositReverted: true,
    forcedTransferDidNotRevive: stateAfterForcedTransfer === 1,
    finalState: stateAfterForcedTransfer === 1 ? "SEALED" : "ACTIVE",
    finalAssetsUsdc6: finalAssets,
    historyCount,
    lastRoundId: lastEntry.roundId,
  };
  manifest.costs.deployerBalanceAfterWei = await publicClient.getBalance({ address: deployer.address });
  manifest.costs.controlledBalanceAfterWei = await controlledBalance([
    deployer.address,
    querent.address,
    diviner.address,
    settler.address,
  ]);
  updateCosts();
  if (manifest.costs.conservativeBudgetUseUsdc6 >= 4_000_000n) {
    throw new Error(`保守预算超过 4 USDC：${manifest.costs.conservativeBudgetUseUsdc6}`);
  }
  if (!manifest.permanence.forcedTransferDidNotRevive) throw new Error("强制转入后金库状态发生复活");
  manifest.status = "PASS";
  await persist();

  console.log("Arc Testnet 永久封存：PASS");
  console.log(`连续错误次数：5；倍率轨迹：${trajectory.map((round) => round.multiplier).join("→")}`);
  console.log(`最终金库：${finalAssets}（六位精度）；卦历：${historyCount}`);
  console.log(`报告：${manifest.reportPath}`);
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (manifest) {
    manifest.status = "FAIL";
    manifest.notes.push(`执行失败：${message}`);
    await persist();
  }
  console.error(`永久封存演示失败：${message}`);
  process.exitCode = 1;
});
