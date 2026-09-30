import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  type Abi,
  type Account,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact, type ProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { errorMessage } from "../src/revert.js";
import { reportTimestamp } from "../src/report.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";
import {
  DIVINER_PROFILES,
  IDENTITY_REGISTRY_ADDRESS,
  USDC_ADDRESS,
  YIJING_PARAMETERS,
  buildAgentRegistration,
  budgetUseUsdc6,
  deriveRolePrivateKey,
  extractAgentIdFromTransfer,
  plannedDeadline,
  registrationDataUri,
} from "../src/yijing-deployment.js";
import {
  formatUsdc6,
  hexagramName,
  writeE2EReport,
  type E2EReport,
  type E2EStep,
} from "../src/yijing-report.js";

const DEPLOYMENT_PATH = "deployments/arc-testnet.json";
const SUPPLY_PREDICATE_ID = keccak256(stringToHex("USDC_TOTAL_SUPPLY_ABOVE"));
const MUTUAL_PREDICATE_ID = keccak256(stringToHex("MUTUAL_OUTCOME"));
const LEGACY_E2E_MODEL_HASH = keccak256(stringToHex("deterministic-e2e-v1"));
const PREDICTION_SCHEMA_HASH = keccak256(stringToHex("prediction-output-schema-v1"));
const LEGACY_E2E_PROVIDER_CONFIG_HASH = keccak256(stringToHex("deterministic-e2e-provider-config-v1"));
const IDENTITY_ABI = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function ownerOf(uint256 agentId) view returns (address)",
  "function tokenURI(uint256 agentId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

interface StoredTransaction {
  transactionHash: Hex;
  blockNumber: string;
  gasUsed: string;
  gasCostWei?: string;
  gasCostUsdc: string;
}

interface StoredContract extends StoredTransaction {
  address: Address;
  constructorArgs: unknown[];
}

interface StoredAgent {
  name: string;
  address: Address;
  agentId: string;
  transactionHash: Hex;
  metadataUri: string;
}

interface DeploymentManifest {
  schemaVersion: "1.0";
  updatedAt: string;
  network: { name: string; chainId: number; rpcUrl: string };
  parameters: Record<string, unknown>;
  accounts: {
    deployer: Address;
    treasury: Address;
    querent: Address;
    thirdParty: Address;
    diviners: Array<{ key: string; name: string; address: Address }>;
  };
  contracts: Record<string, StoredContract>;
  transactions: Record<string, StoredTransaction>;
  vaultFunding: Record<string, { amount: string; approve: StoredTransaction; deposit: StoredTransaction }>;
  agents: StoredAgent[];
  runs: Array<{ reportPath: string; generatedAt: string; status: string }>;
}

interface RoundView {
  querent: Address;
  commitBlock: bigint;
  revealDeadline: bigint;
  fee: bigint;
  bond: bigint;
  seed: Hex;
  lines: readonly number[];
  primaryHex: number;
  derivedHex: number;
  state: number;
}

interface PredictionView {
  roundId: bigint;
  diviner: Address;
  probabilityBps: number;
  multiplier: number;
  reserved: bigint;
  deadline: bigint;
}

interface StatsView {
  sampleCount: bigint;
  correctCount: bigint;
  unresolvedCount: bigint;
  totalBrier: bigint;
}

const publicClient = createArcPublicClient();
let totalGasWei = 0n;

function gasCostWei(receipt: TransactionReceipt): bigint {
  return receipt.gasUsed * receipt.effectiveGasPrice;
}

function formatNativeUsdc(value: bigint): string {
  const integer = value / 1_000_000_000_000_000_000n;
  const fraction = (value % 1_000_000_000_000_000_000n).toString().padStart(18, "0").slice(0, 6);
  return `${integer}.${fraction}`;
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item), 2);
}

async function saveManifest(manifest: DeploymentManifest): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  await mkdir(path.dirname(DEPLOYMENT_PATH), { recursive: true });
  const temporaryPath = `${DEPLOYMENT_PATH}.tmp`;
  await writeFile(temporaryPath, `${stringify(manifest)}\n`, "utf8");
  await rename(temporaryPath, DEPLOYMENT_PATH);
}

async function loadManifest(): Promise<DeploymentManifest> {
  const manifest = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as DeploymentManifest;
  if (manifest.network.chainId !== ARC_CHAIN_ID) throw new Error("部署清单不是 Arc Testnet");
  return manifest;
}

async function artifact(contractName: string): Promise<ProbeArtifact> {
  return loadProbeArtifact(`contracts/out/${contractName}.sol/${contractName}.json`);
}

function requiredContract(manifest: DeploymentManifest, name: string): StoredContract {
  const deployment = manifest.contracts[name];
  if (!deployment) throw new Error(`部署清单缺少 ${name}`);
  return deployment;
}

function accountFor(basePrivateKey: Hex, role: string): ReturnType<typeof privateKeyToAccount> {
  return privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, role));
}

function walletFor(account: Account) {
  return createWalletClient({ account, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
}

async function waitPastBlock(target: bigint, title: string, report: E2EReport, reportName: string): Promise<void> {
  const started = Date.now();
  let current = await publicClient.getBlockNumber();
  console.log(`${title}：当前 ${current}，等待严格超过 ${target}`);
  while (current <= target) {
    if (Date.now() - started > 90_000) throw new Error(`${title} 等待超过 90 秒，最后块高 ${current}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    current = await publicClient.getBlockNumber();
  }
  report.steps.push({
    id: `wait-${title}`,
    title,
    status: "PASS",
    actor: "链上出块",
    observed: `目标块 ${target}，实际到达 ${current}`,
  });
  await writeE2EReport(report, reportName);
}

async function executeWrite(input: {
  id: string;
  title: string;
  actorLabel: string;
  account: ReturnType<typeof privateKeyToAccount>;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  observed: string;
  report: E2EReport;
  reportName: string;
}): Promise<{ receipt: TransactionReceipt; step: E2EStep }> {
  try {
    const simulation = await publicClient.simulateContract({
      account: input.account,
      address: input.address,
      abi: input.abi,
      functionName: input.functionName,
      args: input.args ?? [],
    } as never);
    const wallet = walletFor(input.account);
    const hash = await wallet.writeContract({ ...simulation.request, account: input.account } as never);
    console.log(`${input.title}：${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const cost = gasCostWei(receipt);
    totalGasWei += cost;
    const step: E2EStep = {
      id: input.id,
      title: input.title,
      status: receipt.status === "success" ? "PASS" : "FAIL",
      actor: `${input.actorLabel}（${input.account.address}）`,
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      gasCostUsdc: formatNativeUsdc(cost),
      observed: receipt.status === "success" ? input.observed : "交易 receipt 显示回滚",
    };
    input.report.steps.push(step);
    input.report.totals.gasCostUsdc = formatNativeUsdc(totalGasWei);
    await writeE2EReport(input.report, input.reportName);
    if (receipt.status !== "success") throw new Error(`${input.title} 交易回滚：${hash}`);
    return { receipt, step };
  } catch (error) {
    if (input.report.steps.at(-1)?.id !== input.id) {
      input.report.steps.push({
        id: input.id,
        title: input.title,
        status: "FAIL",
        actor: `${input.actorLabel}（${input.account.address}）`,
        observed: `交易前模拟或发送失败：${errorMessage(error)}`,
      });
      await writeE2EReport(input.report, input.reportName);
    }
    throw error;
  }
}

async function addReadCheck(
  report: E2EReport,
  reportName: string,
  id: string,
  title: string,
  passed: boolean,
  observed: string,
  details?: Record<string, unknown>,
): Promise<void> {
  report.steps.push({ id, title, status: passed ? "PASS" : "FAIL", actor: "只读核验", observed, ...(details ? { details } : {}) });
  await writeE2EReport(report, reportName);
  if (!passed) throw new Error(`${title} 未通过：${observed}`);
}

async function fundRole(
  report: E2EReport,
  reportName: string,
  deployer: ReturnType<typeof privateKeyToAccount>,
  usdcAbi: Abi,
  role: string,
  recipient: Address,
  targetBalance: bigint,
): Promise<void> {
  const current = (await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [recipient],
  })) as bigint;
  if (current >= targetBalance) {
    report.steps.push({
      id: `fund-${role}`,
      title: `准备 ${role} 测试资金`,
      status: "SKIP",
      actor: "部署者",
      observed: `现有余额 ${formatUsdc6(current)} USDC 已满足目标`,
    });
    await writeE2EReport(report, reportName);
    return;
  }
  await executeWrite({
    id: `fund-${role}`,
    title: `准备 ${role} 测试资金`,
    actorLabel: "部署者",
    account: deployer,
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "transfer",
    args: [recipient, targetBalance - current],
    observed: `补足到 ${formatUsdc6(targetBalance)} USDC`,
    report,
    reportName,
  });
}

async function registerAgent(input: {
  manifest: DeploymentManifest;
  report: E2EReport;
  reportName: string;
  account: ReturnType<typeof privateKeyToAccount>;
  profile: (typeof DIVINER_PROFILES)[number];
}): Promise<StoredAgent> {
  const existing = input.manifest.agents.find((agent) => agent.name === input.profile.name);
  if (existing) {
    const owner = (await publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: IDENTITY_ABI,
      functionName: "ownerOf",
      args: [BigInt(existing.agentId)],
    })) as Address;
    if (owner.toLowerCase() !== input.account.address.toLowerCase()) {
      throw new Error(`${input.profile.name} 已登记 agentId 的所有者不匹配`);
    }
    input.report.steps.push({
      id: `agent-${input.profile.key}`,
      title: `ERC-8004 注册 ${input.profile.name}`,
      status: "SKIP",
      actor: input.profile.name,
      transactionHash: existing.transactionHash,
      observed: `复用 Transfer 事件中的 agentId ${existing.agentId}`,
    });
    await writeE2EReport(input.report, input.reportName);
    return existing;
  }

  const preview = await publicClient.simulateContract({
    account: input.account,
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IDENTITY_ABI,
    functionName: "register",
    args: ["ipfs://bafybeigdyrzt-placeholder/agent-registration.json"],
  });
  const predictedAgentId = preview.result;
  const registration = buildAgentRegistration({
    name: input.profile.name,
    description: input.profile.description,
    agentId: predictedAgentId,
    chainId: ARC_CHAIN_ID,
    identityRegistry: IDENTITY_REGISTRY_ADDRESS,
  });
  const metadataUri = registrationDataUri(registration);
  const { receipt, step } = await executeWrite({
    id: `agent-${input.profile.key}`,
    title: `ERC-8004 注册 ${input.profile.name}`,
    actorLabel: input.profile.name,
    account: input.account,
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: IDENTITY_ABI,
    functionName: "register",
    args: [metadataUri],
    observed: "register(string) 已铸造身份 NFT",
    report: input.report,
    reportName: input.reportName,
  });
  const agentId = extractAgentIdFromTransfer(receipt.logs, IDENTITY_REGISTRY_ADDRESS, input.account.address);
  if (agentId !== predictedAgentId) throw new Error(`${input.profile.name} Transfer agentId 与预演结果不一致`);
  const [owner, onchainUri] = await Promise.all([
    publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: IDENTITY_ABI,
      functionName: "ownerOf",
      args: [agentId],
    }),
    publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: IDENTITY_ABI,
      functionName: "tokenURI",
      args: [agentId],
    }),
  ]);
  if ((owner as Address).toLowerCase() !== input.account.address.toLowerCase() || onchainUri !== metadataUri) {
    throw new Error(`${input.profile.name} 身份 NFT 的 owner 或 metadata URI 核验失败`);
  }
  step.observed = `从 Transfer 铸造事件取得 agentId ${agentId}`;
  step.details = { agentId, owner, registration };
  const stored: StoredAgent = {
    name: input.profile.name,
    address: input.account.address,
    agentId: agentId.toString(),
    transactionHash: receipt.transactionHash,
    metadataUri,
  };
  input.manifest.agents.push(stored);
  await saveManifest(input.manifest);
  await writeE2EReport(input.report, input.reportName);
  return stored;
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  const reportName = `arc-e2e-${reportTimestamp(generatedAt)}.md`;
  const reportPath = path.join("reports", reportName);
  const report: E2EReport = {
    schemaVersion: "1.0",
    generatedAt: generatedAt.toISOString(),
    network: { name: "Arc Testnet", chainId: ARC_CHAIN_ID },
    deploymentFile: DEPLOYMENT_PATH,
    parameters: {
      waitBlocks: YIJING_PARAMETERS.waitBlocks.toString(),
      revealWindow: YIJING_PARAMETERS.revealWindow.toString(),
      feeUsdc: formatUsdc6(YIJING_PARAMETERS.fee),
      bondUsdc: formatUsdc6(YIJING_PARAMETERS.bond),
      mMin: YIJING_PARAMETERS.mMin,
      mMax: YIJING_PARAMETERS.mMax,
    },
    steps: [],
    checks: { fullLifecycle: "FAIL", thirdPartyForfeit: "FAIL", unresolvedLocks: "FAIL", permissionlessSettlement: "FAIL" },
    agents: [],
    totals: {
      gasCostUsdc: "0.000000",
      vaultFundingUsdc: formatUsdc6(YIJING_PARAMETERS.vaultFunding * 3n),
      forfeitedUsdc: "0.000000",
      permanentlyLockedUsdc: "0.000000",
      deployerRemainingUsdc: "0.000000",
    },
    notes: [
      "waitBlocks=8 约为四秒，远小于 8191 块历史窗口；revealWindow=32 约为十六秒。",
      "m_min=1 保护无历史易者，m_max=3 限制演示期尾部损失。",
      "F=0.05 USDC 兼顾真实经济约束与 5 USDC 总预算。",
      "三位易者的最大提问者侧合计押注 S=3×3×0.05=0.45 USDC，D=0.50 USDC，D/S≈1.11。",
      "本轮只注册 ERC-8004 Identity；未把 agentId 写入 ScoreBook，因此没有 ReputationRegistry 写入。",
    ],
  };
  await writeE2EReport(report, reportName);

  let manifest: DeploymentManifest | undefined;
  try {
    const basePrivateKey = requireArcPrivateKey(process.env);
    const deployer = privateKeyToAccount(basePrivateKey);
    const querent = accountFor(basePrivateKey, "querent");
    const thirdParty = accountFor(basePrivateKey, "third-party");
    const diviners = DIVINER_PROFILES.map((profile) => ({
      profile,
      account: accountFor(basePrivateKey, `diviner/${profile.key}`),
    }));
    manifest = await loadManifest();
    if (manifest.accounts.deployer.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error("当前 ARC_PRIVATE_KEY 与部署清单不匹配");
    }
    if (querent.address.toLowerCase() !== manifest.accounts.querent.toLowerCase()) throw new Error("提问者派生地址不匹配");
    if (thirdParty.address.toLowerCase() !== manifest.accounts.thirdParty.toLowerCase()) throw new Error("第三方派生地址不匹配");
    if (thirdParty.address.toLowerCase() === deployer.address.toLowerCase()) throw new Error("第三方地址不得等于部署者");

    const [roundArtifact, bookArtifact, vaultArtifact, scoreArtifact, mutualArtifact, supplyArtifact, erc20Artifact] =
      await Promise.all([
        artifact("DivinationRegistry"),
        artifact("PredictionBook"),
        artifact("DivinerVault"),
        artifact("ScoreBook"),
        artifact("MutualResolver"),
        artifact("UsdcSupplyResolver"),
        artifact("IERC20"),
      ]);
    const roundRegistry = requiredContract(manifest, "DivinationRegistry").address;
    const predictionBook = requiredContract(manifest, "PredictionBook").address;
    const scoreBook = requiredContract(manifest, "ScoreBook").address;
    const mutualResolver = requiredContract(manifest, "MutualResolver").address;
    const supplyResolver = requiredContract(manifest, "UsdcSupplyResolver").address;
    const vaults = diviners.map(({ profile, account }) => ({
      profile,
      account,
      address: requiredContract(manifest!, `DivinerVault_${profile.key}`).address,
    }));

    const importedHashes = new Set<string>();
    const importStored = (id: string, title: string, stored: StoredTransaction, observed: string): void => {
      if (importedHashes.has(stored.transactionHash)) return;
      importedHashes.add(stored.transactionHash);
      const cost = stored.gasCostWei ? BigInt(stored.gasCostWei) : 0n;
      totalGasWei += cost;
      report.steps.push({
        id,
        title,
        status: "PASS",
        actor: "部署者",
        transactionHash: stored.transactionHash,
        blockNumber: stored.blockNumber,
        gasUsed: stored.gasUsed,
        gasCostUsdc: stored.gasCostUsdc,
        observed,
      });
    };
    for (const [name, deployment] of Object.entries(manifest.contracts)) {
      importStored(`deployment-${name}`, `部署 ${name}`, deployment, deployment.address);
    }
    for (const [name, transaction] of Object.entries(manifest.transactions)) {
      importStored(`configuration-${name}`, name, transaction, "部署后配置已上链");
    }
    for (const [name, funding] of Object.entries(manifest.vaultFunding)) {
      importStored(`vault-approve-${name}`, `${name} 金库授权`, funding.approve, `授权 ${formatUsdc6(BigInt(funding.amount))} USDC`);
      importStored(`vault-deposit-${name}`, `${name} 金库注资`, funding.deposit, `注资 ${formatUsdc6(BigInt(funding.amount))} USDC`);
    }
    report.totals.gasCostUsdc = formatNativeUsdc(totalGasWei);
    await writeE2EReport(report, reportName);

    await fundRole(report, reportName, deployer, erc20Artifact.abi, "提问者", querent.address, 2_000_000n);
    await fundRole(report, reportName, deployer, erc20Artifact.abi, "第三方结算者", thirdParty.address, 200_000n);
    for (const { profile, account } of diviners) {
      await fundRole(report, reportName, deployer, erc20Artifact.abi, profile.name, account.address, 150_000n);
    }

    for (const diviner of diviners) {
      await registerAgent({ manifest, report, reportName, account: diviner.account, profile: diviner.profile });
    }
    report.agents = manifest.agents.map((agent) => ({ ...agent }));
    const scoreLinks = await Promise.all(
      diviners.map(({ account }) =>
        publicClient.readContract({
          address: scoreBook,
          abi: scoreArtifact.abi,
          functionName: "hasAgentId",
          args: [account.address],
        }) as Promise<boolean>,
      ),
    );
    await addReadCheck(
      report,
      reportName,
      "identity-no-reputation-link",
      "确认本轮未启用 ReputationRegistry 写入",
      scoreLinks.every((linked) => !linked),
      scoreLinks.every((linked) => !linked) ? "三位易者均未写入 ScoreBook.agentIdOf" : "至少一位易者已意外绑定 agentId",
      { scoreLinks },
    );

    await executeWrite({
      id: "querent-approve",
      title: "提问者授权三轮托管",
      actorLabel: "提问者",
      account: querent,
      address: USDC_ADDRESS,
      abi: erc20Artifact.abi,
      functionName: "approve",
      args: [roundRegistry, 3n * (YIJING_PARAMETERS.fee + YIJING_PARAMETERS.bond)],
      observed: "仅授权本轮三次 commit 的精确总额",
      report,
      reportName,
    });

    const initialVaultBalances = await Promise.all(
      vaults.map(({ address }) =>
        publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
      ),
    );
    const normalRoundId = (await publicClient.readContract({
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "nextRoundId",
    })) as bigint;
    const normalQuestion = "Arc Testnet 的 USDC 总量在本轮首次结算观察时是否超过预设阈值？";
    const normalSalt = keccak256(stringToHex(`天层完整生命周期/${generatedAt.toISOString()}/${normalRoundId}`));
    const normalCommitment = (await publicClient.readContract({
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "computeCommitment",
      args: [normalQuestion, normalSalt, querent.address, normalRoundId],
    })) as Hex;
    await executeWrite({
      id: "normal-commit",
      title: "完整生命周期：commit",
      actorLabel: "提问者",
      account: querent,
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "commit",
      args: [normalCommitment, YIJING_PARAMETERS.fee, YIJING_PARAMETERS.bond, normalRoundId],
      observed: `roundId=${normalRoundId}，锁定 F+D=${formatUsdc6(YIJING_PARAMETERS.fee + YIJING_PARAMETERS.bond)} USDC`,
      report,
      reportName,
    });
    let normalRound = (await publicClient.readContract({
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "getRound",
      args: [normalRoundId],
    })) as RoundView;
    await waitPastBlock(normalRound.commitBlock + YIJING_PARAMETERS.waitBlocks, "完整生命周期：等待 N 块", report, reportName);
    const revealResult = await executeWrite({
      id: "normal-reveal",
      title: "完整生命周期：reveal 与成卦",
      actorLabel: "提问者",
      account: querent,
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "reveal",
      args: [normalRoundId, normalQuestion, normalSalt],
      observed: "盐与问题已揭示",
      report,
      reportName,
    });
    normalRound = (await publicClient.readContract({
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "getRound",
      args: [normalRoundId],
    })) as RoundView;
    const [primaryNumber, derivedNumber] = (await Promise.all([
      publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "kingWenNumber", args: [normalRound.primaryHex] }),
      publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "kingWenNumber", args: [normalRound.derivedHex] }),
    ])) as [number, number];
    const lineNames = ["", "", "", "", "", "", "老阴", "少阳", "少阴", "老阳"];
    revealResult.step.observed = `六爻（初爻至上爻）=${normalRound.lines.map((line) => `${line}${lineNames[line] ?? ""}`).join(" / ")}；本卦=${primaryNumber} ${hexagramName(primaryNumber)}；之卦=${derivedNumber} ${hexagramName(derivedNumber)}`;
    revealResult.step.details = {
      seed: normalRound.seed,
      lines: normalRound.lines,
      primaryBinaryIndex: normalRound.primaryHex,
      primaryKingWenNumber: primaryNumber,
      primaryName: hexagramName(primaryNumber),
      derivedBinaryIndex: normalRound.derivedHex,
      derivedKingWenNumber: derivedNumber,
      derivedName: hexagramName(derivedNumber),
    };
    await writeE2EReport(report, reportName);

    const currentSupply = (await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Artifact.abi,
      functionName: "totalSupply",
    })) as bigint;
    const supplyThreshold = currentSupply + 1_000_000n * 1_000_000n;
    const supplyParams = encodeAbiParameters([{ type: "uint256" }], [supplyThreshold]);
    const normalDeadline = plannedDeadline({
      currentBlock: await publicClient.getBlockNumber(),
      plannedSequentialWrites: 3,
      blocksPerWriteBudget: 12,
      llmInferenceMilliseconds: 30_000,
      blockTimeMilliseconds: 510,
      safetyBlocks: 24,
    });
    const normalPredictionIds: bigint[] = [];
    const normalProbabilities = [3_000, 7_000, 4_500] as const;
    for (let index = 0; index < diviners.length; index += 1) {
      const diviner = diviners[index];
      const probability = normalProbabilities[index];
      if (!diviner || probability === undefined) throw new Error("三位易者配置不完整");
      const predictionId = (await publicClient.readContract({
        address: predictionBook,
        abi: bookArtifact.abi,
        functionName: "nextPredictionId",
      })) as bigint;
      const result = await executeWrite({
        id: `normal-prediction-${diviner.profile.key}`,
        title: `完整生命周期：${diviner.profile.name} 提交概率与预测`,
        actorLabel: diviner.profile.name,
        account: diviner.account,
        address: predictionBook,
        abi: bookArtifact.abi,
        functionName: "submitPrediction",
        args: [[normalRoundId, probability >= 5_000, probability, SUPPLY_PREDICATE_ID, supplyParams, normalDeadline, LEGACY_E2E_MODEL_HASH, keccak256(stringToHex(`prompt/${diviner.profile.key}/v1`)), PREDICTION_SCHEMA_HASH, LEGACY_E2E_PROVIDER_CONFIG_HASH, 1]],
        observed: `YES 概率 ${probability / 100}%`,
        report,
        reportName,
      });
      const prediction = (await publicClient.readContract({
        address: predictionBook,
        abi: bookArtifact.abi,
        functionName: "getPrediction",
        args: [predictionId],
      })) as PredictionView;
      result.step.observed = `YES 概率 ${probability / 100}%；m=${prediction.multiplier}；金库预留 ${formatUsdc6(prediction.reserved)} USDC；提问者侧预留 ${formatUsdc6(BigInt(prediction.multiplier) * YIJING_PARAMETERS.fee)} USDC`;
      result.step.details = { predictionId, predicateId: SUPPLY_PREDICATE_ID, threshold: supplyThreshold, deadline: normalDeadline, prediction };
      normalPredictionIds.push(predictionId);
      await writeE2EReport(report, reportName);
    }

    await waitPastBlock(normalDeadline, "完整生命周期：等待谓词截止块", report, reportName);
    for (let index = 0; index < normalPredictionIds.length; index += 1) {
      const predictionId = normalPredictionIds[index];
      const diviner = diviners[index];
      if (predictionId === undefined || !diviner) throw new Error("正常结算预测索引缺失");
      const result = await executeWrite({
        id: `normal-settle-${diviner.profile.key}`,
        title: `完整生命周期：第三方结算 ${diviner.profile.name}`,
        actorLabel: "非部署者第三方",
        account: thirdParty,
        address: predictionBook,
        abi: bookArtifact.abi,
        functionName: "settle",
        args: [predictionId],
        observed: `无许可结算 predictionId=${predictionId}`,
        report,
        reportName,
      });
      const transaction = await publicClient.getTransaction({ hash: result.receipt.transactionHash });
      if (transaction.from.toLowerCase() !== thirdParty.address.toLowerCase()) throw new Error("结算交易发送者不是第三方地址");
    }
    const [settledRound, observation, finalVaultBalances, normalStats, normalStates] = await Promise.all([
      publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [normalRoundId] }) as Promise<RoundView>,
      publicClient.readContract({ address: supplyResolver, abi: supplyArtifact.abi, functionName: "getObservation", args: [supplyParams, normalDeadline] }) as Promise<readonly [bigint, bigint, boolean]>,
      Promise.all(vaults.map(({ address }) => publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "balanceOf", args: [address] }) as Promise<bigint>)),
      Promise.all(diviners.map(({ account }) => publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "getStats", args: [account.address] }) as Promise<StatsView>)),
      Promise.all(normalPredictionIds.map((predictionId) => publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "stateOf", args: [predictionId] }) as Promise<number>)),
    ]);
    const lifecyclePassed = settledRound.state === 3 && observation[2] && normalStates.every((state) => state === 2) && normalStats.every((stats) => stats.sampleCount === 1n);
    await addReadCheck(
      report,
      reportName,
      "normal-final-state",
      "完整生命周期：Brier、金库与 ScoreBook 终态",
      lifecyclePassed,
      `resolver 观察值=${observation[0]}（块 ${observation[1]}），结果=${observation[0] > supplyThreshold ? "YES" : "NO"}；金库变化=${finalVaultBalances.map((balance, index) => formatUsdc6(balance - (initialVaultBalances[index] ?? 0n))).join(" / ")} USDC`,
      { roundState: settledRound.state, predictionStates: normalStates, stats: normalStats, initialVaultBalances, finalVaultBalances, observation, supplyThreshold },
    );
    report.checks.fullLifecycle = "PASS";
    report.checks.permissionlessSettlement = "PASS";
    await writeE2EReport(report, reportName);

    const forfeitRoundId = (await publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "nextRoundId" })) as bigint;
    const forfeitQuestion = "这一卦将被故意弃置，不进行揭示。";
    const forfeitSalt = keccak256(stringToHex(`弃卦/${generatedAt.toISOString()}/${forfeitRoundId}`));
    const forfeitCommitment = (await publicClient.readContract({
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "computeCommitment",
      args: [forfeitQuestion, forfeitSalt, querent.address, forfeitRoundId],
    })) as Hex;
    await executeWrite({
      id: "forfeit-commit",
      title: "弃卦路径：commit 后故意不揭示",
      actorLabel: "提问者",
      account: querent,
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "commit",
      args: [forfeitCommitment, YIJING_PARAMETERS.fee, YIJING_PARAMETERS.bond, forfeitRoundId],
      observed: "已锁定卦金与保证金，后续不调用 reveal",
      report,
      reportName,
    });
    const forfeitRound = (await publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [forfeitRoundId] })) as RoundView;
    await waitPastBlock(forfeitRound.revealDeadline, "弃卦路径：等待揭示窗口超时", report, reportName);
    const treasuryBeforeForfeit = (await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "balanceOf", args: [manifest.accounts.treasury] })) as bigint;
    const forfeitResult = await executeWrite({
      id: "forfeit-third-party",
      title: "弃卦路径：第三方调用 forfeit",
      actorLabel: "非部署者第三方",
      account: thirdParty,
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "forfeit",
      args: [forfeitRoundId],
      observed: "第三方触发卦金与保证金没收",
      report,
      reportName,
    });
    const [forfeitedRound, treasuryAfterForfeit, forfeitTransaction] = await Promise.all([
      publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [forfeitRoundId] }) as Promise<RoundView>,
      publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "balanceOf", args: [manifest.accounts.treasury] }) as Promise<bigint>,
      publicClient.getTransaction({ hash: forfeitResult.receipt.transactionHash }),
    ]);
    const forfeitedAmount = treasuryAfterForfeit - treasuryBeforeForfeit;
    const forfeitPassed = forfeitedRound.state === 4 && forfeitedRound.fee === 0n && forfeitedRound.bond === 0n && forfeitedAmount === YIJING_PARAMETERS.fee + YIJING_PARAMETERS.bond && forfeitTransaction.from.toLowerCase() === thirdParty.address.toLowerCase();
    await addReadCheck(
      report,
      reportName,
      "forfeit-final-state",
      "弃卦路径：没收金额与第三方发送者核验",
      forfeitPassed,
      `状态=${forfeitedRound.state}；金库增加 ${formatUsdc6(forfeitedAmount)} USDC；发送者=${forfeitTransaction.from}`,
      { forfeitedRound, treasuryBeforeForfeit, treasuryAfterForfeit, sender: forfeitTransaction.from },
    );
    report.checks.thirdPartyForfeit = "PASS";
    report.totals.forfeitedUsdc = formatUsdc6(forfeitedAmount);
    await writeE2EReport(report, reportName);

    const unresolvedRoundId = (await publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "nextRoundId" })) as bigint;
    const unresolvedQuestion = "提问者与易者会否对本次演示结果作出一致声明？";
    const unresolvedSalt = keccak256(stringToHex(`未决之卦/${generatedAt.toISOString()}/${unresolvedRoundId}`));
    const unresolvedCommitment = (await publicClient.readContract({
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "computeCommitment",
      args: [unresolvedQuestion, unresolvedSalt, querent.address, unresolvedRoundId],
    })) as Hex;
    await executeWrite({
      id: "unresolved-commit",
      title: "未决之卦：commit",
      actorLabel: "提问者",
      account: querent,
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "commit",
      args: [unresolvedCommitment, YIJING_PARAMETERS.fee, YIJING_PARAMETERS.bond, unresolvedRoundId],
      observed: `roundId=${unresolvedRoundId}`,
      report,
      reportName,
    });
    let unresolvedRound = (await publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [unresolvedRoundId] })) as RoundView;
    await waitPastBlock(unresolvedRound.commitBlock + YIJING_PARAMETERS.waitBlocks, "未决之卦：等待 N 块", report, reportName);
    await executeWrite({
      id: "unresolved-reveal",
      title: "未决之卦：reveal",
      actorLabel: "提问者",
      account: querent,
      address: roundRegistry,
      abi: roundArtifact.abi,
      functionName: "reveal",
      args: [unresolvedRoundId, unresolvedQuestion, unresolvedSalt],
      observed: "未决测试卦已揭示",
      report,
      reportName,
    });
    unresolvedRound = (await publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [unresolvedRoundId] })) as RoundView;
    // 截止块需覆盖案件登记、两次声明和三次预测的顺序打包。
    const mutualDeadline = plannedDeadline({
      currentBlock: await publicClient.getBlockNumber(),
      plannedSequentialWrites: 6,
      blocksPerWriteBudget: 12,
      llmInferenceMilliseconds: 30_000,
      blockTimeMilliseconds: 510,
      safetyBlocks: 24,
    });
    const caseId = keccak256(stringToHex(`双边冲突/${generatedAt.toISOString()}/${unresolvedRoundId}`));
    const mutualParams = encodeAbiParameters([{ type: "bytes32" }], [caseId]);
    await executeWrite({
      id: "unresolved-register-case",
      title: "未决之卦：登记双边案件",
      actorLabel: "登记者",
      account: deployer,
      address: mutualResolver,
      abi: mutualArtifact.abi,
      functionName: "registerCase",
      args: [caseId, querent.address, diviners[0]!.account.address, mutualDeadline],
      observed: `案件截止块 ${mutualDeadline}`,
      report,
      reportName,
    });
    await executeWrite({
      id: "unresolved-declare-a",
      title: "未决之卦：提问者声明 YES",
      actorLabel: "提问者",
      account: querent,
      address: mutualResolver,
      abi: mutualArtifact.abi,
      functionName: "declareOutcome",
      args: [caseId, true],
      observed: "partyA=YES",
      report,
      reportName,
    });
    await executeWrite({
      id: "unresolved-declare-b",
      title: "未决之卦：易者声明 NO",
      actorLabel: diviners[0]!.profile.name,
      account: diviners[0]!.account,
      address: mutualResolver,
      abi: mutualArtifact.abi,
      functionName: "declareOutcome",
      args: [caseId, false],
      observed: "partyB=NO，双方声明冲突",
      report,
      reportName,
    });

    const unresolvedPredictionIds: bigint[] = [];
    const unresolvedMultipliers: bigint[] = [];
    const unresolvedProbabilities = [6_000, 4_000, 5_500] as const;
    for (let index = 0; index < diviners.length; index += 1) {
      const diviner = diviners[index];
      const probability = unresolvedProbabilities[index];
      if (!diviner || probability === undefined) throw new Error("未决之卦易者配置不完整");
      const predictionId = (await publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "nextPredictionId" })) as bigint;
      const result = await executeWrite({
        id: `unresolved-prediction-${diviner.profile.key}`,
        title: `未决之卦：${diviner.profile.name} 提交同一命题`,
        actorLabel: diviner.profile.name,
        account: diviner.account,
        address: predictionBook,
        abi: bookArtifact.abi,
        functionName: "submitPrediction",
        args: [[unresolvedRoundId, probability >= 5_000, probability, MUTUAL_PREDICATE_ID, mutualParams, mutualDeadline, LEGACY_E2E_MODEL_HASH, keccak256(stringToHex(`prompt/${diviner.profile.key}/v1`)), PREDICTION_SCHEMA_HASH, LEGACY_E2E_PROVIDER_CONFIG_HASH, 1]],
        observed: `YES 概率 ${probability / 100}%`,
        report,
        reportName,
      });
      const prediction = (await publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "getPrediction", args: [predictionId] })) as PredictionView;
      result.step.observed = `同一 caseId=${caseId}；m=${prediction.multiplier}；金库预留 ${formatUsdc6(prediction.reserved)} USDC`;
      result.step.details = { predictionId, prediction };
      unresolvedPredictionIds.push(predictionId);
      unresolvedMultipliers.push(BigInt(prediction.multiplier));
      await writeE2EReport(report, reportName);
    }
    await waitPastBlock(mutualDeadline, "未决之卦：等待双边案件截止块", report, reportName);
    for (let index = 0; index < unresolvedPredictionIds.length; index += 1) {
      const predictionId = unresolvedPredictionIds[index];
      const diviner = diviners[index];
      if (predictionId === undefined || !diviner) throw new Error("未决结算预测索引缺失");
      await executeWrite({
        id: `unresolved-settle-${diviner.profile.key}`,
        title: `未决之卦：第三方结算 ${diviner.profile.name}`,
        actorLabel: "非部署者第三方",
        account: thirdParty,
        address: predictionBook,
        abi: bookArtifact.abi,
        functionName: "settle",
        args: [predictionId],
        observed: "双方声明冲突，resolver 返回 decided=false",
        report,
        reportName,
      });
    }

    const [unresolvedFinalRound, permanentlyLockedCollateral, unresolvedStates, unresolvedStats, vaultReservedTotals] = await Promise.all([
      publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [unresolvedRoundId] }) as Promise<RoundView>,
      publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "permanentlyLockedCollateral" }) as Promise<bigint>,
      Promise.all(unresolvedPredictionIds.map((predictionId) => publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "stateOf", args: [predictionId] }) as Promise<number>)),
      Promise.all(diviners.map(({ account }) => publicClient.readContract({ address: scoreBook, abi: scoreArtifact.abi, functionName: "getStats", args: [account.address] }) as Promise<StatsView>)),
      Promise.all(vaults.map(({ address }) => publicClient.readContract({ address, abi: vaultArtifact.abi, functionName: "reservedTotal" }) as Promise<bigint>)),
    ]);
    const expectedQuerentCollateral = unresolvedMultipliers.reduce((sum, multiplier) => sum + multiplier * YIJING_PARAMETERS.fee, 0n);
    const expectedVaultReservations = unresolvedMultipliers.map((multiplier) => 3n * multiplier * YIJING_PARAMETERS.fee);
    const unresolvedPassed =
      unresolvedFinalRound.state === 5
      && permanentlyLockedCollateral === expectedQuerentCollateral
      && unresolvedStates.every((state) => state === 3)
      && unresolvedStats.every((stats) => stats.sampleCount === 2n && stats.unresolvedCount === 1n)
      && vaultReservedTotals.every((value, index) => value === expectedVaultReservations[index]);
    const querentLockedTotal = unresolvedFinalRound.fee + unresolvedFinalRound.bond + permanentlyLockedCollateral;
    const vaultLockedTotal = vaultReservedTotals.reduce((sum, value) => sum + value, 0n);
    const permanentLockedTotal = querentLockedTotal + vaultLockedTotal;
    await addReadCheck(
      report,
      reportName,
      "unresolved-final-state",
      "未决之卦：双方预留永久锁定并惩罚 ScoreBook",
      unresolvedPassed,
      `轮次状态=${unresolvedFinalRound.state}；提问者侧锁定 ${formatUsdc6(querentLockedTotal)} USDC；易者侧锁定 ${formatUsdc6(vaultLockedTotal)} USDC；三位 unresolvedCount 均为 1`,
      { unresolvedFinalRound, permanentlyLockedCollateral, expectedQuerentCollateral, predictionStates: unresolvedStates, stats: unresolvedStats, vaultReservedTotals, expectedVaultReservations },
    );
    report.checks.unresolvedLocks = "PASS";
    report.totals.permanentlyLockedUsdc = formatUsdc6(permanentLockedTotal);

    const deployerRemaining = (await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Artifact.abi,
      functionName: "balanceOf",
      args: [deployer.address],
    })) as bigint;
    report.totals.deployerRemainingUsdc = formatUsdc6(deployerRemaining);
    report.totals.gasCostUsdc = formatNativeUsdc(totalGasWei);
    const conservativeBudget = budgetUseUsdc6(
      YIJING_PARAMETERS.vaultFunding * 3n,
      forfeitedAmount,
      querentLockedTotal,
      totalGasWei,
    );
    await addReadCheck(
      report,
      reportName,
      "budget-final",
      "总预算核验",
      conservativeBudget <= 5_000_000n,
      `保守口径（注资+没收+永久锁定+gas）=${formatUsdc6(conservativeBudget)} USDC；部署者剩余=${formatUsdc6(deployerRemaining)} USDC`,
      { conservativeBudget, totalGasWei, deployerRemaining },
    );

    manifest.runs.push({ reportPath, generatedAt: report.generatedAt, status: "PASS" });
    await saveManifest(manifest);
    await writeE2EReport(report, reportName);
    console.log("端到端结果：PASS");
    console.log(`三条额外验证：第三方弃卦=${report.checks.thirdPartyForfeit}，未决永久锁定=${report.checks.unresolvedLocks}，无许可结算=${report.checks.permissionlessSettlement}`);
    console.log(`三个 agentId：${report.agents.map((agent) => `${agent.name}=${agent.agentId}`).join("，")}`);
    console.log(`gas 总成本：${report.totals.gasCostUsdc} USDC；保守预算口径：${formatUsdc6(conservativeBudget)} USDC`);
    console.log(`部署者剩余余额：${report.totals.deployerRemainingUsdc} USDC`);
    console.log(`报告：${reportPath}`);
  } catch (error) {
    const reason = errorMessage(error);
    report.notes.push(`执行失败：${reason}`);
    report.totals.gasCostUsdc = formatNativeUsdc(totalGasWei);
    try {
      if (manifest) {
        manifest.runs.push({ reportPath, generatedAt: report.generatedAt, status: "FAIL" });
        await saveManifest(manifest);
      }
      await writeE2EReport(report, reportName);
    } catch {
      // 主错误优先；报告写入失败不覆盖原始链上失败。
    }
    console.error(`端到端执行失败：${reason}`);
    console.error(`失败已保留在报告：${reportPath}`);
    process.exitCode = 1;
  }
}

await main();
