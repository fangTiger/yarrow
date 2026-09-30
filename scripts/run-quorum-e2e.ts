import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { errorMessage } from "../src/revert.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";
import { deriveRolePrivateKey, USDC_ADDRESS, YIJING_PARAMETERS } from "../src/yijing-deployment.js";

const DEPLOYMENT_PATH = "deployments/arc-testnet.json";
const SUPPLY_PREDICATE_ID = keccak256(stringToHex("USDC_TOTAL_SUPPLY_ABOVE"));

interface Manifest {
  network: { chainId: number };
  accounts: { deployer: Address; querent: Address; thirdParty: Address; diviners: Array<{ key: string; address: Address }> };
  contracts: Record<string, { address: Address }>;
  runs: Array<{ reportPath: string; generatedAt: string; status: string }>;
}

interface TransactionEvidence {
  name: string;
  hash: Hex;
  blockNumber: string;
  gasUsed: string;
  gasCostWei: string;
}

interface RoundView {
  fee: bigint;
  bond: bigint;
  commitBlock: bigint;
  state: number;
}

interface ScoreStats {
  sampleCount: bigint;
}

interface RoundTermsView {
  deadline: bigint;
  initialized: boolean;
}

const publicClient = createArcPublicClient();

function formatUsdc18(value: bigint): string {
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = (value % 1_000_000_000_000_000_000n).toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${fraction}`;
}

function evidence(name: string, hash: Hex, receipt: TransactionReceipt): TransactionEvidence {
  return {
    name,
    hash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    gasCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
  };
}

async function waitPast(target: bigint): Promise<void> {
  const started = Date.now();
  while (await publicClient.getBlockNumber() <= target) {
    if (Date.now() - started > 180_000) throw new Error(`等待块高 ${target} 超时`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  const reportName = `arc-quorum-e2e-${generatedAt.toISOString().replaceAll(":", "-").replace(".", "-")}`;
  const manifest = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Manifest;
  if (manifest.network.chainId !== ARC_CHAIN_ID) throw new Error("部署清单 Chain ID 不匹配");

  const basePrivateKey = requireArcPrivateKey(process.env);
  const deployer = privateKeyToAccount(basePrivateKey);
  const querent = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "querent"));
  const thirdParty = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "third-party"));
  const diviner = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "diviner/takashima"));
  if (
    deployer.address.toLowerCase() !== manifest.accounts.deployer.toLowerCase()
    || querent.address.toLowerCase() !== manifest.accounts.querent.toLowerCase()
    || thirdParty.address.toLowerCase() !== manifest.accounts.thirdParty.toLowerCase()
  ) throw new Error("部署清单角色与确定性派生账户不一致");

  const roundRegistry = manifest.contracts.DivinationRegistry?.address;
  const predictionBook = manifest.contracts.PredictionBook?.address;
  const scoreBook = manifest.contracts.ScoreBook?.address;
  const vault = manifest.contracts.DivinerVault_takashima?.address;
  if (!roundRegistry || !predictionBook || !scoreBook || !vault) throw new Error("部署清单缺少法定人数验收所需合约");
  const [roundArtifact, bookArtifact, scoreArtifact, vaultArtifact, erc20Artifact] = await Promise.all([
    loadProbeArtifact("contracts/out/DivinationRegistry.sol/DivinationRegistry.json"),
    loadProbeArtifact("contracts/out/PredictionBook.sol/PredictionBook.json"),
    loadProbeArtifact("contracts/out/ScoreBook.sol/ScoreBook.json"),
    loadProbeArtifact("contracts/out/DivinerVault.sol/DivinerVault.json"),
    loadProbeArtifact("contracts/out/IERC20.sol/IERC20.json"),
  ]);
  const transactions: TransactionEvidence[] = [];
  const wallet = (account: typeof deployer) => createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC_URL, { timeout: 20_000 }),
  });
  const write = async (name: string, account: typeof deployer, address: Address, abi: Abi, functionName: string, args: readonly unknown[] = []) => {
    const simulation = await publicClient.simulateContract({ account, address, abi, functionName, args } as never);
    const hash = await wallet(account).writeContract({ ...simulation.request, account } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${name} 交易回滚`);
    transactions.push(evidence(name, hash, receipt));
    return receipt;
  };

  // Arc 的交易费与 ERC-20 余额视图共用 USDC；托管额之外必须留出 gas 垫。
  const requiredQuerentBalance = YIJING_PARAMETERS.fee + YIJING_PARAMETERS.bond + 100_000n;
  const querentBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Artifact.abi,
    functionName: "balanceOf",
    args: [querent.address],
  }) as bigint;
  if (querentBalance < requiredQuerentBalance) {
    await write("补足提问者托管与 gas 垫", deployer, USDC_ADDRESS, erc20Artifact.abi, "transfer", [querent.address, requiredQuerentBalance - querentBalance]);
  }
  for (const [label, account] of [["高島易断", diviner], ["第三方作废者", thirdParty]] as const) {
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Artifact.abi,
      functionName: "balanceOf",
      args: [account.address],
    }) as bigint;
    if (balance < 80_000n) {
      await write(`补足${label} gas 垫`, deployer, USDC_ADDRESS, erc20Artifact.abi, "transfer", [account.address, 80_000n - balance]);
    }
  }

  // 只清理命令行显式指定、并经状态与法定人数核验的本次验收中断轮次。
  const cleanupArgument = process.argv.find((argument) => argument.startsWith("--cleanup-round="));
  if (cleanupArgument) {
    const rawRoundId = cleanupArgument.slice("--cleanup-round=".length);
    if (!/^(0|[1-9][0-9]*)$/.test(rawRoundId)) throw new Error("待清理 roundId 格式无效");
    const cleanupRoundId = BigInt(rawRoundId);
    const [round, terms, existingQuorum] = await Promise.all([
      publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [cleanupRoundId] }) as Promise<RoundView>,
      publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "getRoundTerms", args: [cleanupRoundId] }) as Promise<RoundTermsView>,
      publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "quorumStatus", args: [cleanupRoundId] }) as Promise<readonly [number, number]>,
    ]);
    if (
      round.state !== 2
      || !terms.initialized
      || terms.deadline >= await publicClient.getBlockNumber()
      || existingQuorum[0] !== 1
      || existingQuorum[1] !== 3
    ) throw new Error(`拒绝清理未经确认的轮次 ${cleanupRoundId}`);
    await write(`清理此前中断的不完整轮次 ${cleanupRoundId}`, thirdParty, predictionBook, bookArtifact.abi, "cancelIncompleteRound", [cleanupRoundId]);
  }

  const roundId = await publicClient.readContract({
    address: roundRegistry,
    abi: roundArtifact.abi,
    functionName: "nextRoundId",
  }) as bigint;
  const question = "法定人数反例：截止块后 Arc USDC 总量是否超过冻结阈值？";
  const salt = keccak256(stringToHex(`法定人数反例/${generatedAt.toISOString()}/${roundId}`));
  const commitment = await publicClient.readContract({
    address: roundRegistry,
    abi: roundArtifact.abi,
    functionName: "computeCommitment",
    args: [question, salt, querent.address, roundId],
  }) as Hex;
  await write("提问者授权单轮托管", querent, USDC_ADDRESS, erc20Artifact.abi, "approve", [roundRegistry, YIJING_PARAMETERS.fee + YIJING_PARAMETERS.bond]);
  await write("提交问题承诺", querent, roundRegistry, roundArtifact.abi, "commit", [commitment, YIJING_PARAMETERS.fee, YIJING_PARAMETERS.bond, roundId]);
  const committed = await publicClient.readContract({
    address: roundRegistry,
    abi: roundArtifact.abi,
    functionName: "getRound",
    args: [roundId],
  }) as RoundView;
  await waitPast(committed.commitBlock + YIJING_PARAMETERS.waitBlocks);
  await write("揭示问题并以历史块哈希起卦", querent, roundRegistry, roundArtifact.abi, "reveal", [roundId, question, salt]);

  const totalSupply = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "totalSupply" }) as bigint;
  const params = encodeAbiParameters([{ type: "uint256" }], [totalSupply + 1_000_000_000_000n]);
  const deadline = (await publicClient.getBlockNumber()) + 60n;
  const predictionId = await publicClient.readContract({
    address: predictionBook,
    abi: bookArtifact.abi,
    functionName: "nextPredictionId",
  }) as bigint;
  const statsBefore = await publicClient.readContract({
    address: scoreBook,
    abi: scoreArtifact.abi,
    functionName: "getStats",
    args: [diviner.address],
  }) as ScoreStats;
  const reserveBefore = await publicClient.readContract({
    address: vault,
    abi: vaultArtifact.abi,
    functionName: "reservedTotal",
  }) as bigint;
  await write("仅高島易断提交预测", diviner, predictionBook, bookArtifact.abi, "submitPrediction", [{
    roundId,
    direction: false,
    probabilityBps: 4_000,
    predicateId: SUPPLY_PREDICATE_ID,
    params,
    deadline,
    modelId: keccak256(stringToHex("mock-yijing-v1")),
    promptHash: keccak256(stringToHex(`法定人数反例输入/${roundId}`)),
    schemaHash: keccak256(stringToHex("yijing-prediction-output-v1")),
    providerConfigHash: keccak256(stringToHex("deterministic-mock-provider-config-v1")),
    attemptCount: 1,
  }]);
  const quorum = await publicClient.readContract({
    address: predictionBook,
    abi: bookArtifact.abi,
    functionName: "quorumStatus",
    args: [roundId],
  }) as readonly [number, number];
  if (quorum[0] !== 1 || quorum[1] !== 3) throw new Error(`链上法定人数不是预期的 1/3：${quorum[0]}/${quorum[1]}`);
  const reserveDuring = await publicClient.readContract({
    address: vault,
    abi: vaultArtifact.abi,
    functionName: "reservedTotal",
  }) as bigint;
  if (reserveDuring <= reserveBefore) throw new Error("单家提交未产生预期的金库预留");

  await waitPast(deadline);
  let settleRevert = "";
  try {
    await publicClient.simulateContract({
      account: thirdParty,
      address: predictionBook,
      abi: bookArtifact.abi,
      functionName: "settle",
      args: [predictionId],
    } as never);
  } catch (error) {
    const reverted = error instanceof BaseError
      ? error.walk((candidate) => candidate instanceof ContractFunctionRevertedError)
      : null;
    if (reverted instanceof ContractFunctionRevertedError && reverted.data) {
      const args = JSON.stringify(reverted.data.args, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value);
      settleRevert = `${reverted.data.errorName}${args === undefined ? "" : ` ${args}`}`;
    } else {
      settleRevert = errorMessage(error);
    }
  }
  if (!settleRevert.includes("QuorumNotReached")) {
    throw new Error(`单家结算没有以 QuorumNotReached 拒绝：${settleRevert || "调用意外成功"}`);
  }
  await write("第三方超时作废不完整轮次", thirdParty, predictionBook, bookArtifact.abi, "cancelIncompleteRound", [roundId]);

  const [cancelledRound, predictionState, reserveAfter, statsAfter] = await Promise.all([
    publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [roundId] }) as Promise<RoundView>,
    publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "stateOf", args: [predictionId] }) as Promise<number>,
    publicClient.readContract({ address: vault, abi: vaultArtifact.abi, functionName: "reservedTotal" }) as Promise<bigint>,
    publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "getStats", args: [diviner.address] }) as Promise<ScoreStats>,
  ]);
  if (cancelledRound.state !== 6 || cancelledRound.fee !== 0n || cancelledRound.bond !== 0n) {
    throw new Error("作废后轮次未进入 CANCELLED 或托管未清零");
  }
  if (predictionState !== 4 || reserveAfter !== reserveBefore || statsAfter.sampleCount !== statsBefore.sampleCount) {
    throw new Error("作废后预测状态、金库预留或现场 Brier 样本不符合预期");
  }

  const gasCostWei = transactions.reduce((sum, transaction) => sum + BigInt(transaction.gasCostWei), 0n);
  const report = {
    schemaVersion: "1.0",
    generatedAt: generatedAt.toISOString(),
    status: "PASS",
    chainId: ARC_CHAIN_ID,
    predictionBook,
    roundId: roundId.toString(),
    predictionId: predictionId.toString(),
    observedQuorum: { submitted: quorum[0], required: quorum[1] },
    prematureSettlement: { status: "REVERT", error: settleRevert },
    timeoutCancellation: {
      roundState: "CANCELLED",
      predictionState: "CANCELLED",
      escrowCleared: true,
      vaultReservationReleased: true,
      liveScoreUnchanged: true,
    },
    transactions,
    gasCostWei: gasCostWei.toString(),
    gasCostUsdc: formatUsdc18(gasCostWei),
  };
  const markdown = `# 链上法定人数与超时作废验收\n\n- 状态：PASS\n- PredictionBook：\`${predictionBook}\`\n- roundId / predictionId：${roundId} / ${predictionId}\n- 链上法定人数：submitted=1，required=3\n- 单家结算：REVERT（\`QuorumNotReached\`）\n- 截止后第三方作废：round=CANCELLED，prediction=CANCELLED\n- 资金：卦金与剩余保证金退款，PredictionBook 奖励抵押退款，金库预留恢复\n- 统计：现场 ScoreBook 样本数不变\n- gas 成本：${formatUsdc18(gasCostWei)} USDC\n`;
  await mkdir("reports", { recursive: true });
  await Promise.all([
    writeFile(`reports/${reportName}.json.tmp`, `${JSON.stringify(report, null, 2)}\n`, "utf8").then(() => rename(`reports/${reportName}.json.tmp`, `reports/${reportName}.json`)),
    writeFile(`reports/${reportName}.md.tmp`, markdown, "utf8").then(() => rename(`reports/${reportName}.md.tmp`, `reports/${reportName}.md`)),
  ]);
  manifest.runs ??= [];
  manifest.runs.push({ reportPath: `reports/${reportName}.md`, generatedAt: generatedAt.toISOString(), status: "PASS" });
  await writeFile(`${DEPLOYMENT_PATH}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(`${DEPLOYMENT_PATH}.tmp`, DEPLOYMENT_PATH);
  console.log(`链上法定人数反例：PASS；单家结算以 QuorumNotReached 回滚（1/3）`);
  console.log(`超时路径：第三方作废并释放全部本轮托管/预留；gas=${formatUsdc18(gasCostWei)} USDC`);
  console.log(`报告：reports/${reportName}.md 与 reports/${reportName}.json`);
}

await main();
