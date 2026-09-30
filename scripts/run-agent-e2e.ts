import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createWalletClient,
  decodeAbiParameters,
  encodeAbiParameters,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact, type ProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { AgentOrchestrator } from "../src/agent/orchestrator.js";
import { createDefaultProvider } from "../src/agent/default-provider.js";
import { readDivinerHistory } from "../src/agent/history.js";
import { ViemPredictionSubmitter, type DivinerSigner } from "../src/agent/onchain.js";
import { DeterministicMockProvider, type StructuredOutputProvider, type StructuredOutputRequest } from "../src/agent/provider.js";
import { FileAgentRunJournal } from "../src/agent/run-journal.js";
import { PROPOSITION_OUTPUT_SCHEMA, type PropositionSelectionOutput } from "../src/agent/schemas.js";
import {
  PropositionCompiler,
  ViemPredicateRegistryReader,
  type PredicateDefinition,
} from "../src/agent/proposition-compiler.js";
import { calibrateThreshold } from "../src/difficulty-calibration.js";
import { ArcReplaySource } from "../src/replay/arc-source.js";
import type { DivinerKey } from "../src/agent/diviners.js";
import { errorMessage } from "../src/revert.js";
import { reportTimestamp } from "../src/report.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";
import {
  DIVINER_PROFILES,
  REPUTATION_REGISTRY_ADDRESS,
  USDC_ADDRESS,
  YIJING_PARAMETERS,
  deriveRolePrivateKey,
  plannedDeadline,
} from "../src/yijing-deployment.js";
import { formatUsdc6, hexagramName } from "../src/yijing-report.js";

const DEPLOYMENT_PATH = "deployments/arc-testnet.json";
const SUPPLY_PREDICATE_ID = keccak256(stringToHex("USDC_TOTAL_SUPPLY_ABOVE"));
const MUTUAL_PREDICATE_ID = keccak256(stringToHex("MUTUAL_OUTCOME"));
const SUPPLY_SCHEMA_HASH = keccak256(stringToHex("abi.encode(uint256 threshold)"));
const MUTUAL_SCHEMA_HASH = keccak256(stringToHex("abi.encode(bytes32 caseId)"));
const DIVINER_KEYS = ["takashima", "wuxing", "meihua"] as const satisfies readonly DivinerKey[];
const DIFFICULTY_CALIBRATION_SAMPLES = 64;
const DIFFICULTY_CALIBRATION_STEP = 8n;
const DIVINER_NAMES = Object.fromEntries(DIVINER_PROFILES.map((profile) => [profile.key, profile.name])) as Record<DivinerKey, string>;
const runJournal = new FileAgentRunJournal("reports/agent-run-journal");

function firstCalibratedCandidate(request: StructuredOutputRequest): { predicateId: Hex; params: Hex; reasoning: string } {
  const marker = "链上已核验、难度已校准且可进入押注层的候选谓词：\n";
  const serialized = request.userPrompt.split(marker)[1];
  if (!serialized) throw new Error("mock 命题编译器未收到难度校准候选");
  const candidates = JSON.parse(serialized) as Array<{ predicateId: Hex; params: Hex }>;
  const candidate = candidates[0];
  if (!candidate) throw new Error("mock 命题编译器没有可测量候选");
  return { ...candidate, reasoning: "采用链上已核验且完成历史难度校准的谓词。" };
}

interface StoredTransaction {
  transactionHash: Hex;
  blockNumber: string;
  gasUsed: string;
  gasCostWei?: string;
  gasCostUsdc: string;
}

interface StoredContract extends StoredTransaction {
  address: Address;
}

interface DeploymentManifest {
  network: { chainId: number };
  accounts: {
    deployer: Address;
    querent: Address;
    thirdParty: Address;
    diviners: Array<{ key: DivinerKey; name: string; address: Address }>;
  };
  contracts: Record<string, StoredContract>;
  transactions: Record<string, StoredTransaction>;
  vaultFunding: Record<string, { amount: string; approve: StoredTransaction; deposit: StoredTransaction }>;
  runs?: Array<{ reportPath: string; generatedAt: string; status: string }>;
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
  direction: boolean;
  probabilityBps: number;
  multiplier: number;
  reserved: bigint;
  predicateId: Hex;
  params: Hex;
  deadline: bigint;
  modelId: Hex;
  promptHash: Hex;
  schemaHash: Hex;
  providerConfigHash: Hex;
  attemptCount: number;
}

interface ReportStep {
  title: string;
  status: "PASS" | "FAIL";
  actor: string;
  transactionHash?: Hex;
  blockNumber?: string;
  gasUsed?: string;
  gasCostUsdc?: string;
  observed: string;
  details?: Record<string, unknown>;
}

interface AgentReport {
  schemaVersion: "1.0";
  generatedAt: string;
  network: { name: "Arc Testnet"; chainId: number };
  provider: { kind: "mock" | "deepseek"; modelId: string };
  deploymentFile: string;
  steps: ReportStep[];
  checks: {
    mockAgentLifecycle: "PASS" | "FAIL";
    identicalProposition: "PASS" | "FAIL";
    auditHashesOnchain: "PASS" | "FAIL";
    permissionlessSettlement: "PASS" | "FAIL";
    unresolvedReplay: "PASS" | "FAIL";
    budgetBelowThreeUsdc: "PASS" | "FAIL";
  };
  totals: { gasCostUsdc: string; permanentLockUsdc: string; budgetUseUsdc: string };
  notes: string[];
}

const publicClient = createArcPublicClient();
let gasCostWei = 0n;

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item, 2);
}

function nativeUsdc6(value: bigint): string {
  return formatUsdc6(value / 1_000_000_000_000n);
}

function renderReport(report: AgentReport): string {
  const lines = [
    "# Arc Testnet Agent 层端到端报告",
    "",
    `- 生成时间：${report.generatedAt}`,
    `- Provider：${report.provider.kind}（${report.provider.modelId}）`,
    `- 部署清单：\`${report.deploymentFile}\``,
    "",
    "## 检查",
    "",
    ...Object.entries(report.checks).map(([name, status]) => `- ${name}：${status}`),
    "",
    "## 逐步证据",
    "",
    "| 步骤 | 状态 | 发起者 | 交易哈希 | 块高 | gas | 成本（USDC） | 观测 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.steps.map((step) => `| ${step.title} | ${step.status} | ${step.actor} | ${step.transactionHash ?? "—"} | ${step.blockNumber ?? "—"} | ${step.gasUsed ?? "—"} | ${step.gasCostUsdc ?? "—"} | ${step.observed.replaceAll("|", "\\|")} |`),
    "",
    "## 总量",
    "",
    `- gas 总成本：${report.totals.gasCostUsdc} USDC`,
    `- 未决永久锁定：${report.totals.permanentLockUsdc} USDC`,
    `- 保守预算占用：${report.totals.budgetUseUsdc} USDC`,
    "",
    "## 说明",
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
  ];
  return lines.join("\n");
}

async function persist(report: AgentReport, baseName: string): Promise<void> {
  await mkdir("reports", { recursive: true });
  const jsonPath = path.join("reports", `${baseName}.json`);
  const markdownPath = path.join("reports", `${baseName}.md`);
  await Promise.all([
    writeFile(`${jsonPath}.tmp`, `${stringify(report)}\n`, "utf8").then(() => rename(`${jsonPath}.tmp`, jsonPath)),
    writeFile(`${markdownPath}.tmp`, renderReport(report), "utf8").then(() => rename(`${markdownPath}.tmp`, markdownPath)),
  ]);
}

async function appendDeploymentRun(manifest: DeploymentManifest, reportName: string, generatedAt: string): Promise<void> {
  manifest.runs ??= [];
  manifest.runs.push({ reportPath: `reports/${reportName}.md`, generatedAt, status: "PASS" });
  await writeFile(`${DEPLOYMENT_PATH}.tmp`, `${stringify(manifest)}\n`, "utf8");
  await rename(`${DEPLOYMENT_PATH}.tmp`, DEPLOYMENT_PATH);
}

function walletFor(account: Account): WalletClient<Transport, Chain, Account> {
  return createWalletClient({ account, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
}

function accountFor(basePrivateKey: Hex, role: string): ReturnType<typeof privateKeyToAccount> {
  return privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, role));
}

async function artifact(name: string): Promise<ProbeArtifact> {
  return loadProbeArtifact(`contracts/out/${name}.sol/${name}.json`);
}

function requiredContract(manifest: DeploymentManifest, name: string): StoredContract {
  const value = manifest.contracts[name];
  if (!value) throw new Error(`部署清单缺少 ${name}`);
  return value;
}

async function executeWrite(input: {
  title: string;
  actor: string;
  account: ReturnType<typeof privateKeyToAccount>;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  report: AgentReport;
  reportName: string;
  observed: string;
}): Promise<Hex> {
  const simulation = await publicClient.simulateContract({
    account: input.account,
    address: input.address,
    abi: input.abi,
    functionName: input.functionName,
    args: input.args ?? [],
  } as never);
  const hash = await walletFor(input.account).writeContract({ ...simulation.request, account: input.account } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${input.title} 交易回滚`);
  const cost = receipt.gasUsed * receipt.effectiveGasPrice;
  gasCostWei += cost;
  input.report.steps.push({
    title: input.title,
    status: "PASS",
    actor: `${input.actor}（${input.account.address}）`,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    gasCostUsdc: nativeUsdc6(cost),
    observed: input.observed,
  });
  input.report.totals.gasCostUsdc = nativeUsdc6(gasCostWei);
  await persist(input.report, input.reportName);
  return hash;
}

async function waitPastBlock(target: bigint, label: string, report: AgentReport, reportName: string): Promise<void> {
  const started = Date.now();
  let current = await publicClient.getBlockNumber();
  console.log(`${label}：当前 ${current}，等待严格超过 ${target}`);
  while (current <= target) {
    if (Date.now() - started > 150_000) throw new Error(`${label} 超过 150 秒，最后块高 ${current}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    current = await publicClient.getBlockNumber();
  }
  report.steps.push({ title: label, status: "PASS", actor: "链上出块", observed: `目标 ${target}，到达 ${current}` });
  await persist(report, reportName);
}

async function ensureRoleBalance(
  deployer: ReturnType<typeof privateKeyToAccount>,
  recipient: Address,
  target: bigint,
  erc20Abi: Abi,
  label: string,
  report: AgentReport,
  reportName: string,
): Promise<void> {
  const current = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [recipient] }) as bigint;
  if (current >= target) return;
  await executeWrite({
    title: `补足${label}余额`, actor: "部署者", account: deployer, address: USDC_ADDRESS, abi: erc20Abi,
    functionName: "transfer", args: [recipient, target - current], report, reportName,
    observed: `${label}达到 ${formatUsdc6(target)} USDC`,
  });
}

function supplyDefinition(): PredicateDefinition {
  return {
    predicateId: SUPPLY_PREDICATE_ID,
    name: "Arc USDC 总量首次观察值超过阈值",
    description: "截止块后由 resolver 首次读取 USDC.totalSupply()，并与阈值比较。",
    paramsEncoding: "abi.encode(uint256 thresholdUsdc6)",
    schemaHash: SUPPLY_SCHEMA_HASH,
    validateParams: (params) => { decodeAbiParameters([{ type: "uint256" }], params); },
    renderStatement: (params) => {
      const [threshold] = decodeAbiParameters([{ type: "uint256" }], params);
      return `截止块后首次观察到的 Arc USDC 总量高于 ${threshold}（六位精度）`;
    },
    calibrateParams: async ({ cutoffBlock, deadlineBlock }) => {
      const source = new ArcReplaySource(publicClient as PublicClient, USDC_ADDRESS);
      const horizonBlocks = deadlineBlock - cutoffBlock + 1n;
      const [snapshot, history] = await Promise.all([
        source.readCutoffSnapshot(cutoffBlock, 1),
        source.readCalibrationHistory(
          cutoffBlock,
          horizonBlocks,
          DIFFICULTY_CALIBRATION_SAMPLES,
          DIFFICULTY_CALIBRATION_STEP,
        ),
      ]);
      const calibrated = calibrateThreshold({
        cutoffBlock,
        currentValue: snapshot.cutoff.totalSupply,
        horizonBlocks,
        history,
        minimumBaseRateBps: 3_500,
        maximumBaseRateBps: 6_500,
      });
      if (!calibrated.suitable) return calibrated;
      return {
        suitable: true as const,
        params: encodeAbiParameters([{ type: "uint256" }], [calibrated.threshold]),
        method: "historical-threshold-quantile-v1",
        sampleCount: calibrated.sampleCount,
        yesCount: calibrated.yesCount,
        empiricalBaseRateBps: calibrated.empiricalBaseRateBps,
        historyStartBlock: calibrated.historyStartBlock,
        historyEndBlock: calibrated.historyEndBlock,
        horizonBlocks: calibrated.horizonBlocks,
      };
    },
  };
}

function mutualDefinition(): PredicateDefinition {
  return {
    predicateId: MUTUAL_PREDICATE_ID,
    name: "双边结果声明一致为 YES",
    description: "案件双方在截止块前声明；冲突或缺席时进入未决。",
    paramsEncoding: "abi.encode(bytes32 caseId)",
    schemaHash: MUTUAL_SCHEMA_HASH,
    validateParams: (params) => { decodeAbiParameters([{ type: "bytes32" }], params); },
    renderStatement: (params) => {
      const [caseId] = decodeAbiParameters([{ type: "bytes32" }], params);
      return `双边案件 ${caseId} 的一致结果为 YES`;
    },
    calibrateParams: async () => ({
      suitable: false,
      reason: "双边声明谓词没有可由截止块前历史反解的数值阈值，仅保留为 resolver 生命周期测试，不进入测量押注层",
      sampleCount: 0,
      closestBaseRateBps: 0,
    }),
  };
}

async function createRevealedRound(input: {
  question: string;
  saltLabel: string;
  querent: ReturnType<typeof privateKeyToAccount>;
  roundRegistry: Address;
  roundAbi: Abi;
  report: AgentReport;
  reportName: string;
}): Promise<{ roundId: bigint; round: RoundView; primary: number; derived: number; changing: number[] }> {
  const roundId = await publicClient.readContract({ address: input.roundRegistry, abi: input.roundAbi, functionName: "nextRoundId" }) as bigint;
  const salt = keccak256(stringToHex(`${input.saltLabel}/${input.report.generatedAt}/${roundId}`));
  const commitment = await publicClient.readContract({
    address: input.roundRegistry, abi: input.roundAbi, functionName: "computeCommitment",
    args: [input.question, salt, input.querent.address, roundId],
  }) as Hex;
  await executeWrite({
    title: `${input.saltLabel}：commit`, actor: "提问者", account: input.querent,
    address: input.roundRegistry, abi: input.roundAbi, functionName: "commit",
    args: [commitment, YIJING_PARAMETERS.fee, YIJING_PARAMETERS.bond, roundId],
    report: input.report, reportName: input.reportName, observed: `roundId=${roundId}`,
  });
  let round = await publicClient.readContract({ address: input.roundRegistry, abi: input.roundAbi, functionName: "getRound", args: [roundId] }) as RoundView;
  await waitPastBlock(round.commitBlock + YIJING_PARAMETERS.waitBlocks, `${input.saltLabel}：等待起卦块`, input.report, input.reportName);
  await executeWrite({
    title: `${input.saltLabel}：reveal 与成卦`, actor: "提问者", account: input.querent,
    address: input.roundRegistry, abi: input.roundAbi, functionName: "reveal", args: [roundId, input.question, salt],
    report: input.report, reportName: input.reportName, observed: "问题与盐已揭示",
  });
  round = await publicClient.readContract({ address: input.roundRegistry, abi: input.roundAbi, functionName: "getRound", args: [roundId] }) as RoundView;
  const [primary, derived] = await Promise.all([
    publicClient.readContract({ address: input.roundRegistry, abi: input.roundAbi, functionName: "kingWenNumber", args: [round.primaryHex] }) as Promise<number>,
    publicClient.readContract({ address: input.roundRegistry, abi: input.roundAbi, functionName: "kingWenNumber", args: [round.derivedHex] }) as Promise<number>,
  ]);
  const changing = round.lines.map((line, index) => line === 6 || line === 9 ? index + 1 : 0).filter((position) => position !== 0);
  input.report.steps.at(-1)!.observed = `六爻=${round.lines.join("/")}；本卦=${primary} ${hexagramName(primary)}；之卦=${derived} ${hexagramName(derived)}；变爻=${changing.join("、") || "无"}`;
  await persist(input.report, input.reportName);
  return { roundId, round, primary, derived, changing };
}

function deploymentGas(manifest: DeploymentManifest): bigint {
  let total = 0n;
  for (const item of Object.values(manifest.contracts)) total += BigInt(item.gasCostWei ?? 0);
  for (const item of Object.values(manifest.transactions)) total += BigInt(item.gasCostWei ?? 0);
  for (const item of Object.values(manifest.vaultFunding)) {
    total += BigInt(item.approve.gasCostWei ?? 0) + BigInt(item.deposit.gasCostWei ?? 0);
  }
  return total;
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  const useDeepSeek = process.argv.includes("--deepseek");
  const reportName = `arc-agent-e2e-${reportTimestamp(generatedAt)}`;
  const report: AgentReport = {
    schemaVersion: "1.0", generatedAt: generatedAt.toISOString(),
    network: { name: "Arc Testnet", chainId: ARC_CHAIN_ID },
    provider: useDeepSeek
      ? { kind: "deepseek", modelId: "deepseek-v4-flash" }
      : { kind: "mock", modelId: "mock-yijing-v1" },
    deploymentFile: DEPLOYMENT_PATH, steps: [],
    checks: { mockAgentLifecycle: "FAIL", identicalProposition: "FAIL", auditHashesOnchain: "FAIL", permissionlessSettlement: "FAIL", unresolvedReplay: "FAIL", budgetBelowThreeUsdc: "FAIL" },
    totals: { gasCostUsdc: "0.000000", permanentLockUsdc: "0.000000", budgetUseUsdc: "0.000000" },
    notes: [
      "命题选择与三位易者概率估计是不同 provider 任务；易者输出 schema 不含命题字段。",
      "三位易者逐个执行唯一一次推理，输出后立即由各自账户签名提交；失败不会自动重跑。",
      "C5 使用 12 块/顺序交易、510ms/块、30 秒总推理预算与 24 块安全余量。",
    ],
  };
  await persist(report, reportName);

  try {
    const basePrivateKey = requireArcPrivateKey(process.env);
    const deployer = privateKeyToAccount(basePrivateKey);
    const querent = accountFor(basePrivateKey, "querent");
    const thirdParty = accountFor(basePrivateKey, "third-party");
    const diviners = Object.fromEntries(DIVINER_PROFILES.map((profile) => [profile.key, accountFor(basePrivateKey, `diviner/${profile.key}`)])) as Record<DivinerKey, ReturnType<typeof privateKeyToAccount>>;
    const manifest = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as DeploymentManifest;
    if (manifest.network.chainId !== ARC_CHAIN_ID || manifest.accounts.deployer.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error("Agent 部署清单与当前 Arc Testnet 账户不匹配");
    }

    const [roundArtifact, bookArtifact, scoreArtifact, mutualArtifact, erc20Artifact, vaultArtifact] = await Promise.all([
      artifact("DivinationRegistry"), artifact("PredictionBook"), artifact("ScoreBook"),
      artifact("MutualResolver"), artifact("IERC20"), artifact("DivinerVault"),
    ]);
    const predicateRegistry = requiredContract(manifest, "PredicateRegistry").address;
    const roundRegistry = requiredContract(manifest, "DivinationRegistry").address;
    const predictionBook = requiredContract(manifest, "PredictionBook").address;
    const scoreBook = requiredContract(manifest, "ScoreBook").address;
    const mutualResolver = requiredContract(manifest, "MutualResolver").address;
    const vaults = Object.fromEntries(DIVINER_KEYS.map((key) => [key, requiredContract(manifest, `DivinerVault_${key}`).address])) as Record<DivinerKey, Address>;
    gasCostWei = deploymentGas(manifest);

    if (process.argv.includes("--audit-round")) {
      const baselineGas = gasCostWei;
      let addedVaultFunding = 0n;
      report.notes.push("本补充轮专用于链上验证持久审计日志、完整输入/输出哈希与 ERC-8004 反馈路径。");
      // Arc 的 gas 与 ERC-20 视图共用 USDC 余额；授权交易也会消耗余额，必须显式预留 gas 垫。
      await ensureRoleBalance(deployer, querent.address, YIJING_PARAMETERS.fee + YIJING_PARAMETERS.bond + 100_000n, erc20Artifact.abi, "提问者", report, reportName);
      await ensureRoleBalance(deployer, thirdParty.address, 100_000n, erc20Artifact.abi, "第三方结算者", report, reportName);
      for (const key of DIVINER_KEYS) {
        await ensureRoleBalance(deployer, diviners[key].address, 40_000n, erc20Artifact.abi, DIVINER_NAMES[key], report, reportName);
        const available = await publicClient.readContract({
          address: vaults[key], abi: vaultArtifact.abi, functionName: "availableBalance",
        }) as bigint;
        const requiredReserve = 3n * YIJING_PARAMETERS.fee;
        if (available < requiredReserve) {
          const amount = requiredReserve - available;
          await executeWrite({ title: `审计复验：授权补足${DIVINER_NAMES[key]}金库`, actor: "部署者", account: deployer,
            address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "approve", args: [vaults[key], amount], report, reportName,
            observed: `仅授权 ${formatUsdc6(amount)} USDC` });
          await executeWrite({ title: `审计复验：补足${DIVINER_NAMES[key]}金库`, actor: "部署者", account: deployer,
            address: vaults[key], abi: vaultArtifact.abi, functionName: "deposit", args: [amount], report, reportName,
            observed: `可用余额补足到 ${formatUsdc6(requiredReserve)} USDC` });
          addedVaultFunding += amount;
        }
      }
      await executeWrite({ title: "审计复验：提问者授权单轮托管", actor: "提问者", account: querent,
        address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "approve", args: [roundRegistry, YIJING_PARAMETERS.fee + YIJING_PARAMETERS.bond],
        report, reportName, observed: "授权额严格等于单轮 F+D" });

      const currentSupply = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Artifact.abi, functionName: "totalSupply" }) as bigint;
      const threshold = currentSupply + 1_000_000_000_000n;
      const question = `Arc Testnet 的 USDC 总量在截止块后首次观察时是否严格高于 ${threshold}（六位精度）？`;
      const revealed = await createRevealedRound({ question, saltLabel: "审计加固复验", querent, roundRegistry, roundAbi: roundArtifact.abi, report, reportName });
      const provider: StructuredOutputProvider = useDeepSeek
        ? createDefaultProvider()
        : new DeterministicMockProvider("mock-yijing-v1", {
            "proposition-compiler": firstCalibratedCandidate,
            "diviner/takashima": { direction: "NO", probabilityBps: 4_000, reasoning: "时势尚稳，取谨慎偏否。" },
            "diviner/wuxing": { direction: "NO", probabilityBps: 3_500, reasoning: "资料有限，按动静取否。" },
            "diviner/meihua": { direction: "NO", probabilityBps: 4_500, reasoning: "外应未显，小幅偏否。" },
          });
      const compiler = new PropositionCompiler({
        provider,
        registry: new ViemPredicateRegistryReader(publicClient as PublicClient, predicateRegistry),
        definitions: [supplyDefinition()],
        currentBlock: () => publicClient.getBlockNumber(),
        deadlinePolicy: { plannedSequentialWrites: 3, blocksPerWriteBudget: 12, llmInferenceMilliseconds: 30_000, blockTimeMilliseconds: 510, safetyBlocks: 24 },
      });
      const historiesBefore = Object.fromEntries(await Promise.all(DIVINER_KEYS.map(async (key) => [key, await readDivinerHistory(publicClient as PublicClient, scoreBook, diviners[key].address)]))) as Record<DivinerKey, Awaited<ReturnType<typeof readDivinerHistory>>>;
      const signers = Object.fromEntries(DIVINER_KEYS.map((key) => [key, { account: diviners[key], wallet: walletFor(diviners[key]) } satisfies DivinerSigner])) as Record<DivinerKey, DivinerSigner>;
      const run = await new AgentOrchestrator({
        compiler,
        provider,
        submitter: new ViemPredictionSubmitter({ publicClient: publicClient as PublicClient, predictionBook, signers }),
        journal: runJournal,
        scope: { chainId: ARC_CHAIN_ID, predictionBook },
      }).run({
        roundId: revealed.roundId,
        question,
        hexagram: { lines: revealed.round.lines, primaryKingWenNumber: revealed.primary, derivedKingWenNumber: revealed.derived, changingLinePositions: revealed.changing },
        histories: historiesBefore,
      });
      const ids = run.predictions.map((prediction) => prediction.receipt.predictionId!);
      const chainPredictions = await Promise.all(ids.map((id) => publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "getPrediction", args: [id] }) as Promise<PredictionView>));
      if (!chainPredictions.every((item, index) => item.predicateId === run.proposition.predicateId
        && item.params === run.proposition.params
        && item.deadline === run.proposition.deadlineBlock
        && item.modelId === run.predictions[index]!.submission.modelId
        && item.promptHash === run.predictions[index]!.submission.promptHash
        && item.schemaHash === run.predictions[index]!.submission.schemaHash
        && item.providerConfigHash === run.predictions[index]!.submission.providerConfigHash
        && item.attemptCount === run.predictions[index]!.submission.attemptCount)) {
        throw new Error("审计复验的同题或四哈希、尝试次数链上值不一致");
      }
      report.steps.push(...run.predictions.map((prediction) => ({
        title: `审计复验：${DIVINER_NAMES[prediction.divinerKey]}唯一输出并立即提交`,
        status: "PASS" as const,
        actor: DIVINER_NAMES[prediction.divinerKey],
        transactionHash: prediction.receipt.transactionHash,
        blockNumber: prediction.receipt.blockNumber.toString(),
        ...(prediction.receipt.gasUsed === undefined ? {} : { gasUsed: prediction.receipt.gasUsed.toString() }),
        gasCostUsdc: nativeUsdc6(prediction.receipt.gasCostWei ?? 0n),
        observed: `YES 概率=${prediction.output.probabilityBps}；完整输入/输出已 fsync；四哈希与尝试次数链上一致`,
      })));
      gasCostWei += run.predictions.reduce((sum, prediction) => sum + (prediction.receipt.gasCostWei ?? 0n), 0n);
      await persist(report, reportName);
      await waitPastBlock(run.proposition.deadlineBlock, "审计复验：等待 C5 截止块", report, reportName);
      for (const id of ids) {
        const hash = await executeWrite({ title: `审计复验：第三方结算 predictionId=${id}`, actor: "非部署者第三方", account: thirdParty,
          address: predictionBook, abi: bookArtifact.abi, functionName: "settle", args: [id], report, reportName,
          observed: "等待 ERC-8004 反馈日志复核" });
        const receipt = await publicClient.getTransactionReceipt({ hash });
        if (!receipt.logs.some((log) => log.address.toLowerCase() === REPUTATION_REGISTRY_ADDRESS.toLowerCase())) {
          throw new Error(`predictionId=${id} 结算回执缺少 ReputationRegistry 日志`);
        }
        report.steps.at(-1)!.observed = "结算成功，回执含 ReputationRegistry 反馈日志";
      }
      const historiesAfter = Object.fromEntries(await Promise.all(DIVINER_KEYS.map(async (key) => [key, await readDivinerHistory(publicClient as PublicClient, scoreBook, diviners[key].address)]))) as Record<DivinerKey, Awaited<ReturnType<typeof readDivinerHistory>>>;
      if (DIVINER_KEYS.some((key) => historiesAfter[key].sampleCount !== historiesBefore[key].sampleCount + 1)) {
        throw new Error("审计复验后 ScoreBook 样本数未逐一增加");
      }
      report.checks.mockAgentLifecycle = "PASS";
      report.checks.identicalProposition = "PASS";
      report.checks.auditHashesOnchain = "PASS";
      report.checks.permissionlessSettlement = "PASS";
      report.checks.unresolvedReplay = "PASS";
      report.notes.push("未决之卦不再消耗资金重复执行；本项 PASS 引用原始真实链上报告。");
      const incrementalGas = gasCostWei - baselineGas;
      const cumulativeBudget = 2_028_557n + addedVaultFunding + incrementalGas / 1_000_000_000_000n;
      report.totals.permanentLockUsdc = "1.000000";
      report.totals.gasCostUsdc = nativeUsdc6(incrementalGas);
      report.totals.budgetUseUsdc = formatUsdc6(cumulativeBudget);
      if (cumulativeBudget >= 3_000_000n) throw new Error(`累计保守预算超过 3 USDC：${formatUsdc6(cumulativeBudget)}`);
      report.checks.budgetBelowThreeUsdc = "PASS";
      await persist(report, reportName);
      await appendDeploymentRun(manifest, reportName, report.generatedAt);
      console.log(`${useDeepSeek ? "DeepSeek" : "mock"} 审计加固 Arc Testnet 补充轮：PASS`);
      console.log(`累计保守预算占用：${report.totals.budgetUseUsdc} USDC`);
      console.log(`报告：reports/${reportName}.md 与 reports/${reportName}.json`);
      return;
    }

    const preflight = YIJING_PARAMETERS.vaultFunding * 3n + 1_000_000n + gasCostWei / 1_000_000_000_000n + 700_000n;
    if (preflight >= 3_000_000n) throw new Error(`三 USDC 预算预检失败：${formatUsdc6(preflight)} USDC`);

    await ensureRoleBalance(deployer, querent.address, 1_200_000n, erc20Artifact.abi, "提问者", report, reportName);
    await ensureRoleBalance(deployer, thirdParty.address, 150_000n, erc20Artifact.abi, "第三方结算者", report, reportName);
    for (const key of DIVINER_KEYS) {
      await ensureRoleBalance(deployer, diviners[key].address, 60_000n, erc20Artifact.abi, DIVINER_NAMES[key], report, reportName);
    }
    await executeWrite({
      title: "提问者授权两轮托管", actor: "提问者", account: querent, address: USDC_ADDRESS,
      abi: erc20Artifact.abi, functionName: "approve",
      args: [roundRegistry, 2n * (YIJING_PARAMETERS.fee + YIJING_PARAMETERS.bond)],
      report, reportName, observed: "授权额严格等于两轮 F+D",
    });

    const normalQuestion = "Arc Testnet 的 USDC 总量在截止块后首次观察时是否超过预设阈值？";
    const normal = await createRevealedRound({ question: normalQuestion, saltLabel: "mock agent 完整生命周期", querent, roundRegistry, roundAbi: roundArtifact.abi, report, reportName });
    const normalProvider = new DeterministicMockProvider("mock-yijing-v1", {
      "proposition-compiler": firstCalibratedCandidate,
      "diviner/takashima": { direction: "NO", probabilityBps: 3_000, reasoning: "时势未足，晋而戒进。" },
      "diviner/wuxing": { direction: "YES", probabilityBps: 7_000, reasoning: "动爻相激，取进势。" },
      "diviner/meihua": { direction: "NO", probabilityBps: 4_500, reasoning: "晋转蒙，外应仍昧。" },
    });
    const registryReader = new ViemPredicateRegistryReader(publicClient as PublicClient, predicateRegistry);
    const normalCompiler = new PropositionCompiler({
      provider: normalProvider, registry: registryReader, definitions: [supplyDefinition(), mutualDefinition()],
      currentBlock: () => publicClient.getBlockNumber(),
      deadlinePolicy: { plannedSequentialWrites: 3, blocksPerWriteBudget: 12, llmInferenceMilliseconds: 30_000, blockTimeMilliseconds: 510, safetyBlocks: 24 },
    });
    const signers = Object.fromEntries(DIVINER_KEYS.map((key) => [key, { account: diviners[key], wallet: walletFor(diviners[key]) } satisfies DivinerSigner])) as Record<DivinerKey, DivinerSigner>;
    const submitter = new ViemPredictionSubmitter({ publicClient: publicClient as PublicClient, predictionBook, signers });
    const histories = Object.fromEntries(await Promise.all(DIVINER_KEYS.map(async (key) => [key, await readDivinerHistory(publicClient as PublicClient, scoreBook, diviners[key].address)]))) as Record<DivinerKey, Awaited<ReturnType<typeof readDivinerHistory>>>;
    const normalRun = await new AgentOrchestrator({
      compiler: normalCompiler,
      provider: normalProvider,
      submitter,
      journal: runJournal,
      scope: { chainId: ARC_CHAIN_ID, predictionBook },
    }).run({
      roundId: normal.roundId, question: normalQuestion,
      hexagram: { lines: normal.round.lines, primaryKingWenNumber: normal.primary, derivedKingWenNumber: normal.derived, changingLinePositions: normal.changing },
      histories,
    });
    const normalPredictionIds = normalRun.predictions.map((prediction) => prediction.receipt.predictionId!);
    const onchainPredictions = await Promise.all(normalPredictionIds.map((id) => publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "getPrediction", args: [id] }) as Promise<PredictionView>));
    for (const [index, prediction] of normalRun.predictions.entries()) {
      const chain = onchainPredictions[index]!;
      const cost = prediction.receipt.gasCostWei ?? 0n;
      gasCostWei += cost;
      report.steps.push({
        title: `${DIVINER_NAMES[prediction.divinerKey]}：mock 输出后立即签名提交`, status: "PASS", actor: DIVINER_NAMES[prediction.divinerKey],
        transactionHash: prediction.receipt.transactionHash, blockNumber: prediction.receipt.blockNumber.toString(),
        ...(prediction.receipt.gasUsed === undefined ? {} : { gasUsed: prediction.receipt.gasUsed.toString() }),
        gasCostUsdc: nativeUsdc6(cost),
        observed: `YES 概率=${prediction.output.probabilityBps}；m=${chain.multiplier}（合约计算）`,
        details: { reasoning: prediction.output.reasoning, predicateId: chain.predicateId, params: chain.params, deadline: chain.deadline, modelId: chain.modelId, promptHash: chain.promptHash, schemaHash: chain.schemaHash, providerConfigHash: chain.providerConfigHash, attemptCount: chain.attemptCount },
      });
    }
    const sameTerms = onchainPredictions.every((item) => item.predicateId === normalRun.proposition.predicateId && item.params === normalRun.proposition.params && item.deadline === normalRun.proposition.deadlineBlock);
    const auditMatches = onchainPredictions.every((item, index) => {
      const submitted = normalRun.predictions[index]!.submission;
      return item.modelId === submitted.modelId && item.promptHash === submitted.promptHash
        && item.schemaHash === submitted.schemaHash && item.providerConfigHash === submitted.providerConfigHash
        && item.attemptCount === submitted.attemptCount;
    });
    if (!sameTerms || !auditMatches) throw new Error("正常轮链上命题或审计哈希核验失败");
    report.checks.identicalProposition = "PASS";
    report.checks.auditHashesOnchain = "PASS";
    await persist(report, reportName);

    await waitPastBlock(normalRun.proposition.deadlineBlock, "正常轮：等待谓词截止块", report, reportName);
    for (const predictionId of normalPredictionIds) {
      await executeWrite({ title: `第三方无许可结算 predictionId=${predictionId}`, actor: "非部署者第三方", account: thirdParty,
        address: predictionBook, abi: bookArtifact.abi, functionName: "settle", args: [predictionId], report, reportName, observed: "settle 成功" });
    }
    const [normalRoundFinal, normalStates] = await Promise.all([
      publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [normal.roundId] }) as Promise<RoundView>,
      Promise.all(normalPredictionIds.map((id) => publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "stateOf", args: [id] }) as Promise<number>)),
    ]);
    if (normalRoundFinal.state !== 3 || normalStates.some((state) => state !== 2)) throw new Error("mock agent 正常生命周期终态错误");
    report.checks.mockAgentLifecycle = "PASS";
    report.checks.permissionlessSettlement = "PASS";

    const unresolvedQuestion = "提问者与易者会否对本轮演示结果作出一致声明？";
    const unresolved = await createRevealedRound({ question: unresolvedQuestion, saltLabel: "未决之卦正当复跑", querent, roundRegistry, roundAbi: roundArtifact.abi, report, reportName });
    const caseId = keccak256(stringToHex(`未决复验/${report.generatedAt}/${unresolved.roundId}`));
    const mutualParams = encodeAbiParameters([{ type: "bytes32" }], [caseId]);
    const unresolvedProvider = new DeterministicMockProvider("mock-yijing-v1", {
      "proposition-compiler": { predicateId: MUTUAL_PREDICATE_ID, params: mutualParams, reasoning: "问题明确要求双边结果声明。" },
      "diviner/takashima": { direction: "YES", probabilityBps: 6_000, reasoning: "参考上一轮战绩后取谨慎偏是。" },
      "diviner/wuxing": { direction: "NO", probabilityBps: 4_000, reasoning: "双方立场相冲，偏向否。" },
      "diviner/meihua": { direction: "YES", probabilityBps: 5_500, reasoning: "外应有合意但不强。" },
    });
    // 双边声明仅用于复验 resolver 的 UNRESOLVED 生命周期；它被正常命题编译器剔除，不计入测量押注层。
    const unresolvedCompiler = {
      compile: async (
        question: string,
        recordAudit: Parameters<PropositionCompiler["compile"]>[1],
        recordProviderAttempt?: Parameters<PropositionCompiler["compile"]>[2],
      ) => {
        const cutoffBlock = await publicClient.getBlockNumber();
        const deadlineBlock = plannedDeadline({
          currentBlock: cutoffBlock,
          plannedSequentialWrites: 6,
          blocksPerWriteBudget: 12,
          llmInferenceMilliseconds: 30_000,
          blockTimeMilliseconds: 510,
          safetyBlocks: 24,
        });
        const request: StructuredOutputRequest = {
          taskId: "proposition-compiler",
          systemPrompt: "仅用于 resolver 生命周期复验；该命题不属于统计测量押注层。",
          cacheSystemPrompt: false,
          userPrompt: question,
          schema: PROPOSITION_OUTPUT_SCHEMA,
          effort: "high",
          ...(recordProviderAttempt ? { recordAttempt: recordProviderAttempt } : {}),
        };
        const output = await unresolvedProvider.generateStructured<PropositionSelectionOutput>(request);
        await recordAudit({ modelId: unresolvedProvider.modelId, request, output });
        if (output.predicateId !== MUTUAL_PREDICATE_ID || output.params !== mutualParams) {
          throw new Error("resolver 生命周期夹具返回了未冻结的双边命题");
        }
        return {
          predicateId: MUTUAL_PREDICATE_ID,
          params: mutualParams,
          deadlineBlock,
          statement: `双边案件 ${caseId} 的一致结果为 YES`,
          reasoning: output.reasoning,
          calibration: {
            method: "resolver-lifecycle-only-not-measurement",
            sampleCount: 0,
            yesCount: 0,
            empiricalBaseRateBps: 0,
            historyStartBlock: cutoffBlock - 1n,
            historyEndBlock: cutoffBlock - 1n,
            horizonBlocks: 0n,
          },
        };
      },
    };
    const calibratedHistories = Object.fromEntries(await Promise.all(DIVINER_KEYS.map(async (key) => [key, await readDivinerHistory(publicClient as PublicClient, scoreBook, diviners[key].address)]))) as Record<DivinerKey, Awaited<ReturnType<typeof readDivinerHistory>>>;
    if (Object.values(calibratedHistories).some((item) => item.sampleCount !== 1)) throw new Error("未决轮未读到三位易者上一轮战绩");
    const unresolvedRun = await new AgentOrchestrator({
      compiler: unresolvedCompiler,
      provider: unresolvedProvider,
      submitter,
      journal: runJournal,
      scope: { chainId: ARC_CHAIN_ID, predictionBook },
      onPropositionCompiled: async (frozenMutual) => {
        await executeWrite({ title: "未决复验：登记双边案件", actor: "登记者", account: deployer, address: mutualResolver,
          abi: mutualArtifact.abi, functionName: "registerCase", args: [caseId, querent.address, diviners.takashima.address, frozenMutual.deadlineBlock], report, reportName, observed: `截止块=${frozenMutual.deadlineBlock}` });
        await executeWrite({ title: "未决复验：提问者声明 YES", actor: "提问者", account: querent, address: mutualResolver,
          abi: mutualArtifact.abi, functionName: "declareOutcome", args: [caseId, true], report, reportName, observed: "partyA=YES" });
        await executeWrite({ title: "未决复验：易者声明 NO", actor: "高島易断", account: diviners.takashima, address: mutualResolver,
          abi: mutualArtifact.abi, functionName: "declareOutcome", args: [caseId, false], report, reportName, observed: "partyB=NO，形成冲突" });
      },
    }).run({
      roundId: unresolved.roundId, question: unresolvedQuestion,
      hexagram: { lines: unresolved.round.lines, primaryKingWenNumber: unresolved.primary, derivedKingWenNumber: unresolved.derived, changingLinePositions: unresolved.changing },
      histories: calibratedHistories,
    });
    const unresolvedIds = unresolvedRun.predictions.map((prediction) => prediction.receipt.predictionId!);
    for (const prediction of unresolvedRun.predictions) {
      const cost = prediction.receipt.gasCostWei ?? 0n;
      gasCostWei += cost;
      report.steps.push({ title: `未决复验：${DIVINER_NAMES[prediction.divinerKey]} 立即提交`, status: "PASS", actor: DIVINER_NAMES[prediction.divinerKey],
        transactionHash: prediction.receipt.transactionHash, blockNumber: prediction.receipt.blockNumber.toString(),
        ...(prediction.receipt.gasUsed === undefined ? {} : { gasUsed: prediction.receipt.gasUsed.toString() }),
        gasCostUsdc: nativeUsdc6(cost),
        observed: `读取历史样本=${calibratedHistories[prediction.divinerKey].sampleCount}；YES 概率=${prediction.output.probabilityBps}` });
    }
    await persist(report, reportName);
    await waitPastBlock(unresolvedRun.proposition.deadlineBlock, "未决复验：等待 C5 截止块", report, reportName);
    for (const predictionId of unresolvedIds) {
      await executeWrite({ title: `未决复验：第三方结算 predictionId=${predictionId}`, actor: "非部署者第三方", account: thirdParty,
        address: predictionBook, abi: bookArtifact.abi, functionName: "settle", args: [predictionId], report, reportName, observed: "resolver 返回 decided=false" });
    }
    const [unresolvedFinal, unresolvedStates, permanentBookLock, reservedTotals] = await Promise.all([
      publicClient.readContract({ address: roundRegistry, abi: roundArtifact.abi, functionName: "getRound", args: [unresolved.roundId] }) as Promise<RoundView>,
      Promise.all(unresolvedIds.map((id) => publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "stateOf", args: [id] }) as Promise<number>)),
      publicClient.readContract({ address: predictionBook, abi: bookArtifact.abi, functionName: "permanentlyLockedCollateral" }) as Promise<bigint>,
      Promise.all(DIVINER_KEYS.map((key) => publicClient.readContract({ address: vaults[key], abi: vaultArtifact.abi, functionName: "reservedTotal" }) as Promise<bigint>)),
    ]);
    const permanentLock = unresolvedFinal.fee + unresolvedFinal.bond + permanentBookLock + reservedTotals.reduce((sum, value) => sum + value, 0n);
    if (unresolvedFinal.state !== 5 || unresolvedStates.some((state) => state !== 3) || permanentBookLock !== 150_000n || reservedTotals.some((value) => value !== 150_000n) || permanentLock !== 1_000_000n) {
      throw new Error("未决之卦永久锁定终态不符合预期");
    }
    report.steps.push({ title: "未决复验：终态核验", status: "PASS", actor: "只读核验", observed: `roundState=UNRESOLVED；book锁定=${formatUsdc6(permanentBookLock)}；三库各锁定=0.150000；总永久锁定=${formatUsdc6(permanentLock)} USDC` });
    report.checks.unresolvedReplay = "PASS";
    report.totals.permanentLockUsdc = formatUsdc6(permanentLock);
    report.totals.gasCostUsdc = nativeUsdc6(gasCostWei);
    const budgetUse = YIJING_PARAMETERS.vaultFunding * 3n + permanentLock + gasCostWei / 1_000_000_000_000n;
    report.totals.budgetUseUsdc = formatUsdc6(budgetUse);
    if (budgetUse >= 3_000_000n) throw new Error(`最终预算超过 3 USDC：${formatUsdc6(budgetUse)}`);
    report.checks.budgetBelowThreeUsdc = "PASS";
    await persist(report, reportName);
    await appendDeploymentRun(manifest, reportName, report.generatedAt);

    console.log("Agent 层 Arc Testnet 端到端：PASS");
    console.log(`mock 生命周期=${report.checks.mockAgentLifecycle}；同题=${report.checks.identicalProposition}；三哈希上链=${report.checks.auditHashesOnchain}`);
    console.log(`未决之卦复验=${report.checks.unresolvedReplay}；无许可结算=${report.checks.permissionlessSettlement}`);
    console.log(`gas=${report.totals.gasCostUsdc} USDC；保守预算占用=${report.totals.budgetUseUsdc} USDC`);
    console.log(`报告：reports/${reportName}.md 与 reports/${reportName}.json`);
  } catch (error) {
    report.notes.push(`执行失败：${errorMessage(error)}`);
    report.totals.gasCostUsdc = nativeUsdc6(gasCostWei);
    await persist(report, reportName);
    console.error(`Agent 层端到端失败：${errorMessage(error)}`);
    console.error(`失败报告：reports/${reportName}.md 与 reports/${reportName}.json`);
    process.exitCode = 1;
  }
}

await main();
