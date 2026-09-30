import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  getAddress,
  http,
  keccak256,
  parseAbi,
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

import {
  AgentOrchestrator,
  type AgentRunRequest,
  type PredictionSubmitter,
  type PropositionCompilerLike,
} from "../agent/orchestrator.js";
import { readDivinerHistory } from "../agent/history.js";
import { ViemPredictionSubmitter, type DivinerSigner } from "../agent/onchain.js";
import { FileAgentRunJournal } from "../agent/run-journal.js";
import type { DeadlinePolicy } from "../agent/proposition-compiler.js";
import { PROPOSITION_OUTPUT_SCHEMA } from "../agent/schemas.js";
import { getHexagramText } from "../agent/zhouyi-corpus.js";
import { arcTestnet } from "../arc.js";
import { estimateDeepSeekUsageUsd, getDeepSeekBalance } from "../deepseek-budget.js";
import { requireArcPrivateKey, type ArcPrivateKey } from "../transaction-probe.js";
import {
  DIVINER_PROFILES,
  USDC_ADDRESS,
  YIJING_PARAMETERS,
  deriveRolePrivateKey,
} from "../yijing-deployment.js";
import type { DivinerKey } from "../agent/diviners.js";
import {
  DEMO_LIVE_BUDGET_CNY,
  DEMO_LIVE_INFERENCE_BUDGET_MS,
  DEMO_LIVE_PROVIDER_TIMEOUT_MS,
  createDemoProvider,
  isUsageTrackedDemoProvider,
  liveBudgetUpperBoundCny,
} from "./provider.js";
import {
  buildAttestedHumanProposition,
  humanRequestHash,
  resolveHumanWitnesses,
} from "./human-proposition.js";
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
  DemoProposition,
  DemoRoundResult,
  DemoSession,
  DemoSettlementResult,
  DemoTransaction,
  DemoWitnessInput,
} from "./service.js";
import { REUSABLE_APPROVAL_ROUND_COUNT, REUSABLE_APPROVAL_USDC6 } from "../frontend/wallet.js";
import { splitOracleFee } from "../oracle/fee-payment.js";

const DIVINER_KEYS = ["takashima", "wuxing", "meihua"] as const satisfies readonly DivinerKey[];
const DIVINER_NAMES = Object.fromEntries(DIVINER_PROFILES.map((profile) => [profile.key, profile.name])) as Record<DivinerKey, string>;

const ERC20_ABI = parseAbi([
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient,uint256 amount) returns (bool)",
]);

const ROUND_ABI = parseAbi([
  "function nextRoundId() view returns (uint256)",
  "function computeCommitment(string question,bytes32 salt,address sender,uint256 roundId) view returns (bytes32)",
  "function commit(bytes32 commitment,uint256 fee,uint256 bond,uint256 expectedRoundId) returns (uint256)",
  "function reveal(uint256 roundId,string question,bytes32 salt)",
  "function forfeit(uint256 roundId)",
  "function getRound(uint256 roundId) view returns ((bytes32 commitment,address querent,uint64 commitBlock,uint64 revealDeadline,uint256 fee,uint256 bond,bytes32 seed,uint8[6] lines,uint8 primaryHex,uint8 derivedHex,uint8 state))",
  "function kingWenNumber(uint8 binaryIndex) pure returns (uint8)",
]);

const PREDICTION_ABI = parseAbi([
  "function getPrediction(uint256 predictionId) view returns ((uint256 roundId,address diviner,bool direction,uint16 probabilityBps,uint16 multiplier,uint256 reserved,bytes32 predicateId,bytes params,uint64 deadline,bytes32 modelId,bytes32 promptHash,bytes32 schemaHash,bytes32 providerConfigHash,uint16 attemptCount))",
  "function quorumStatus(uint256 roundId) view returns (uint32 submitted,uint32 required)",
  "function registeredDivinerCount() view returns (uint256)",
  "function getRoundTerms(uint256 roundId) view returns ((bytes32 predicateId,bytes32 paramsHash,uint64 deadline,uint32 predictionCount,uint32 finalizedCount,bool initialized,bool unresolved))",
  "function cancelIncompleteRound(uint256 roundId)",
  "function settle(uint256 predictionId) returns (int256 delta)",
]);

const VAULT_ABI = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function availableBalance() view returns (uint256)",
  "function state() view returns (uint8)",
]);
const SCORE_ABI = parseAbi([
  "function historyCount(address diviner) view returns (uint256)",
  "function getHistory(address diviner,uint256 index) view returns ((uint256 predictionId,uint256 roundId,uint16 probabilityBps,uint256 brier,bool outcome,bool correct,bool unresolved))",
]);
const VALIDATION_ABI = parseAbi([
  "function validationRequest(address validatorAddress,uint256 agentId,string requestURI,bytes32 requestHash)",
]);
const ATTESTED_ABI = parseAbi([
  "function openCase(bytes32 requestHash,uint256 agentId,uint64 deadline)",
  "function submitOutcome(bytes32 requestHash,bool outcome,string responseURI,bytes32 responseHash)",
]);

interface DemoManifest {
  network: { chainId: number; rpcUrl: string };
  accounts: DemoManifestAccounts;
  contracts: Record<string, { address: string }>;
  agents?: Array<{ address: string; agentId: string }>;
  externalContracts?: { ValidationRegistry?: { address: string } };
}

interface DemoManifestAccounts {
  deployer: string;
  querent: string;
  thirdParty: string;
  diviners: Array<{ key: string; name: string; address: string }>;
}

interface RoundView {
  commitment: Hex;
  querent: Address;
  commitBlock: bigint;
  revealDeadline: bigint;
  lines: readonly number[];
  primaryHex: number;
  derivedHex: number;
  state: number;
}

interface RoundTermsView {
  deadline: bigint;
  initialized: boolean;
}

export function recoveryPlanForRound(
  round: Pick<RoundView, "state" | "revealDeadline">,
  terms: RoundTermsView | null,
): { kind: "forfeit" | "cancel"; deadlineBlock: bigint } | null {
  if (round.state === 0) return { kind: "forfeit", deadlineBlock: round.revealDeadline };
  if (round.state === 1 || round.state === 2) {
    return { kind: "cancel", deadlineBlock: terms?.initialized ? terms.deadline : round.revealDeadline };
  }
  return null;
}

export interface RecoveryRequest {
  roundId: bigint;
  confirmed: boolean;
}

export function parseRecoveryRequestArguments(args: readonly string[]): RecoveryRequest {
  const roundFlag = args.indexOf("--round-id");
  const rawRoundId = roundFlag >= 0 ? args[roundFlag + 1] : undefined;
  if (!rawRoundId) throw new Error("恢复命令必须显式提供 --round-id <非负整数>");
  if (!/^\d+$/.test(rawRoundId)) throw new Error("--round-id 必须是非负整数");
  if (!args.includes("--confirm")) throw new Error("恢复命令必须提供 --confirm 显式确认");
  const allowed = new Set(["--round-id", rawRoundId, "--confirm"]);
  if (args.some((arg) => !allowed.has(arg))) throw new Error("恢复命令包含未知参数");
  return { roundId: BigInt(rawRoundId), confirmed: true };
}

export function assertRecoveryReady(input: {
  confirmed: boolean;
  currentBlock: bigint;
  deadlineBlock: bigint;
}): void {
  if (!input.confirmed) throw new Error("恢复操作缺少显式确认");
  if (input.currentBlock <= input.deadlineBlock) {
    throw new Error(`轮次尚未到期（当前块 ${input.currentBlock}，截止块 ${input.deadlineBlock}），拒绝等待后自动处置`);
  }
}

interface PredictionView {
  multiplier: number;
}

interface HistoryView {
  roundId: bigint;
  outcome: boolean;
  unresolved: boolean;
}

export function settledOutcomeForRound(roundId: bigint, histories: readonly HistoryView[]): boolean {
  if (histories.length !== DIVINER_KEYS.length) throw new Error("结算后必须核验三家 ScoreBook 记录");
  for (const history of histories) {
    if (history.roundId !== roundId || history.unresolved) throw new Error("至少一家 ScoreBook 未完成有效结算");
  }
  const outcome = histories[0]!.outcome;
  if (histories.some((history) => history.outcome !== outcome)) throw new Error("三家 ScoreBook 的事实结果不一致");
  return outcome;
}

export function settledResolutionForRound(
  roundId: bigint,
  histories: readonly HistoryView[],
): { outcome: boolean | null; unresolved: boolean } {
  if (histories.length !== DIVINER_KEYS.length) throw new Error("结算后必须核验三家 ScoreBook 记录");
  if (histories.some((history) => history.roundId !== roundId)) throw new Error("至少一家 ScoreBook 未写入当前轮次");
  const unresolvedCount = histories.filter((history) => history.unresolved).length;
  if (unresolvedCount === histories.length) return { outcome: null, unresolved: true };
  if (unresolvedCount > 0) throw new Error("三家 ScoreBook 的人层终态不一致");
  const outcome = histories[0]!.outcome;
  if (histories.some((history) => history.outcome !== outcome)) throw new Error("三家 ScoreBook 的事实结果不一致");
  return { outcome, unresolved: false };
}

type LocalAccount = ReturnType<typeof privateKeyToAccount>;

export interface DemoAccounts {
  deployer: LocalAccount;
  querent: LocalAccount;
  thirdParty: LocalAccount;
  diviners: Record<DivinerKey, LocalAccount>;
}

export interface BlockWaitOptions {
  getBlockNumber(): Promise<bigint>;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMilliseconds?: number;
  pollMilliseconds?: number;
}

export interface ArcDemoDriverOptions {
  rootDir?: string;
  environment?: NodeJS.ProcessEnv;
  now?: () => Date;
}

const USDC18_TO_USDC6 = 1_000_000_000_000n;
export const DEMO_GAS_BUDGET_USDC6 = 1_000_000n;
const DEMO_GAS_BUDGET_WEI = DEMO_GAS_BUDGET_USDC6 * USDC18_TO_USDC6;
const GAS_ESTIMATE_SAFETY_MULTIPLIER = 2n;
const QUERENT_GAS_RESERVE_USDC6 = 100_000n;
const OPERATOR_GAS_TARGET_USDC6 = 80_000n;
const MINIMUM_VAULT_AVAILABLE_USDC6 = 3n * BigInt(YIJING_PARAMETERS.mMin) * YIJING_PARAMETERS.fee;
const DEMO_CALIBRATION_BUDGET_MS = 8_000;
const ARC_BLOCK_TIME_MILLISECONDS = 510;
const DEMO_OPERATIONAL_SAFETY_BLOCKS = 4;
export const DEMO_HUMAN_INTERACTION_BLOCKS = 60;
export const HUMAN_SHORT_CYCLE_BLOCKS = 120n;
export const HUMAN_LONG_CYCLE_BLOCKS = 1_185_883n;
export const DEMO_SETTLEMENT_TIMEOUT_MILLISECONDS = 240_000;

/**
 * commit 是唯一仍需人的步骤，钱包确认通常数秒，按 60 块约 30 秒保守预留。
 * 交易与推理已有各自预算，因此 safetyBlocks 只补足到 60 块总余量，避免重复相加。
 */
export function demoDeadlinePolicy(mode: DemoMode): DeadlinePolicy {
  const llmInferenceMilliseconds = DEMO_CALIBRATION_BUDGET_MS
    + (mode === "live" ? DEMO_LIVE_INFERENCE_BUDGET_MS : 0);
  const plannedSequentialWrites = 3;
  const blocksPerWriteBudget = 12;
  const automaticBudgetBlocks = plannedSequentialWrites * blocksPerWriteBudget
    + Math.ceil(llmInferenceMilliseconds / ARC_BLOCK_TIME_MILLISECONDS);
  return {
    plannedSequentialWrites,
    blocksPerWriteBudget,
    // 链下工作预算：历史校准 +（live 时）四次模型调用。
    llmInferenceMilliseconds,
    blockTimeMilliseconds: ARC_BLOCK_TIME_MILLISECONDS,
    safetyBlocks: Math.max(0, DEMO_HUMAN_INTERACTION_BLOCKS - automaticBudgetBlocks)
      + DEMO_OPERATIONAL_SAFETY_BLOCKS,
  };
}

export function gasWeiToUsdc6(value: bigint): string {
  return ((value + USDC18_TO_USDC6 - 1n) / USDC18_TO_USDC6).toString();
}

export function requiredTopUp(currentUsdc6: bigint, targetUsdc6: bigint): bigint {
  return currentUsdc6 < targetUsdc6 ? targetUsdc6 - currentUsdc6 : 0n;
}

export function assertGasSendBudget(input: {
  spentWei: bigint;
  estimatedGas: bigint;
  gasPriceWei: bigint;
  signerBalanceWei: bigint;
  maximumWei: bigint;
}): void {
  const estimatedCost = input.estimatedGas * input.gasPriceWei;
  if (input.spentWei + estimatedCost > input.maximumWei) {
    throw new Error("发送前累计 gas 预算门禁拒绝本笔交易");
  }
  if (input.signerBalanceWei < estimatedCost) throw new Error("签名账户 gas 余额不足以发送本笔交易");
}

export function assertDeadlineHeadroom(input: {
  currentBlock: bigint;
  deadlineBlock: bigint;
  remainingWrites: number;
  remainingInferenceCalls: number;
}): void {
  const inferenceBlocks = Math.ceil(DEMO_LIVE_PROVIDER_TIMEOUT_MS / ARC_BLOCK_TIME_MILLISECONDS);
  const required = BigInt(input.remainingWrites * 12 + input.remainingInferenceCalls * inferenceBlocks);
  const remaining = input.deadlineBlock > input.currentBlock ? input.deadlineBlock - input.currentBlock : 0n;
  if (remaining < required) {
    throw new Error(`固定命题剩余截止预算不足：当前仅剩 ${remaining} 块，安全完成至少需要 ${required} 块。请等待本轮到期清理后重新起一卦`);
  }
}

export interface UserTransactionView {
  from: Address;
  to: Address | null;
  input: Hex;
}

export interface UserTransactionIntent {
  sender: Address;
  contract: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

function comparableArgument(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value)) return value.toLowerCase();
  if (Array.isArray(value)) return value.map(comparableArgument);
  return value;
}

/** 用户回执不能只看成功状态；发送者、目标和 calldata 必须与准备阶段逐项一致。 */
export function assertUserTransactionIntent(transaction: UserTransactionView, expected: UserTransactionIntent): void {
  if (!sameAddress(transaction.from, expected.sender)) throw new Error("用户交易发送者与连接钱包不一致");
  if (!transaction.to || !sameAddress(transaction.to, expected.contract)) throw new Error("用户交易目标合约不一致");
  const decoded = decodeFunctionData({ abi: expected.abi, data: transaction.input });
  if (decoded.functionName !== expected.functionName) throw new Error("用户交易函数与准备内容不一致");
  const actualArgs = (decoded.args ?? []).map(comparableArgument);
  const expectedArgs = expected.args.map(comparableArgument);
  if (JSON.stringify(actualArgs) !== JSON.stringify(expectedArgs)) throw new Error("用户交易参数与准备内容不一致");
}

interface PredictionRunContext {
  mode: DemoMode;
  provider: ReturnType<typeof createDemoProvider>;
  orchestrator: AgentOrchestrator;
  request: AgentRunRequest;
  emitted: DemoPrediction[];
  progress: { current: (update: DemoProgress) => void };
  startedAt: number;
  predictionWriteMilliseconds: number;
  humanProposition: DemoProposition;
  feeDistributionTransactions: DemoTransaction[];
  vaults: Record<DivinerKey, Address>;
}

interface HumanCaseContext {
  requestHash: Hex;
  agentId: bigint;
  deadlineBlock: bigint;
  resolver: Address;
}

function toDemoProposition(proposition: Awaited<ReturnType<AgentOrchestrator["run"]>>["proposition"]): DemoProposition {
  const calibration = proposition.calibration;
  return {
    statement: proposition.statement,
    predicateId: proposition.predicateId,
    params: proposition.params,
    deadlineBlock: proposition.deadlineBlock.toString(),
    calibration: {
      method: calibration.method,
      sampleCount: calibration.sampleCount,
      yesCount: calibration.yesCount,
      empiricalBaseRateBps: calibration.empiricalBaseRateBps,
      historyStartBlock: calibration.historyStartBlock.toString(),
      historyEndBlock: calibration.historyEndBlock.toString(),
      horizonBlocks: calibration.horizonBlocks.toString(),
    },
  };
}

export async function waitUntilPastBlock(target: bigint, options: BlockWaitOptions): Promise<bigint> {
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)));
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 150_000;
  const pollMilliseconds = options.pollMilliseconds ?? 300;
  const startedAt = Date.now();
  let current = await options.getBlockNumber();
  while (current <= target) {
    if (Date.now() - startedAt > timeoutMilliseconds) {
      throw new Error(`等待截止块 ${target} 超时，最后块高 ${current}`);
    }
    await sleep(pollMilliseconds);
    current = await options.getBlockNumber();
  }
  return current;
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function resolveDemoAccounts(basePrivateKey: ArcPrivateKey, manifest: DemoManifestAccounts): DemoAccounts {
  const deployer = privateKeyToAccount(basePrivateKey);
  const querent = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "querent"));
  const thirdParty = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "third-party"));
  const diviners = Object.fromEntries(DIVINER_KEYS.map((key) => [
    key,
    privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, `diviner/${key}`)),
  ])) as Record<DivinerKey, LocalAccount>;
  const expected: Array<[string, string, string]> = [
    ["deployer", deployer.address, manifest.deployer],
    ["querent", querent.address, manifest.querent],
    ["thirdParty", thirdParty.address, manifest.thirdParty],
  ];
  for (const key of DIVINER_KEYS) {
    const declared = manifest.diviners.find((item) => item.key === key)?.address ?? "";
    expected.push([`diviner/${key}`, diviners[key].address, declared]);
  }
  for (const [role, actual, declared] of expected) {
    if (!declared || !sameAddress(actual, declared)) throw new Error(`${role} 派生地址与部署清单不匹配`);
  }
  return { deployer, querent, thirdParty, diviners };
}

function contractAddress(manifest: DemoManifest, name: string): Address {
  const value = manifest.contracts[name]?.address;
  if (!value) throw new Error(`部署清单缺少 ${name}`);
  return getAddress(value);
}

function walletFor(account: Account, rpcUrl: string): WalletClient<Transport, Chain, Account> {
  return createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl, { timeout: 20_000 }) });
}

/** Arc Testnet 写入驱动。构造后秘密只保存在 Node 进程对象中，不进入任何响应。 */
export class ArcDemoDriver implements DemoDriver {
  private readonly vaultBalancesBefore = new Map<string, Record<DivinerKey, bigint>>();
  private readonly predictionRuns = new Map<string, PredictionRunContext>();
  private readonly humanCases = new Map<string, HumanCaseContext>();
  private gasSpentWei = 0n;
  private readonly now: () => Date;

  private constructor(
    private readonly rootDir: string,
    private readonly environment: NodeJS.ProcessEnv,
    private readonly manifest: DemoManifest,
    private readonly accounts: DemoAccounts,
    private readonly publicClient: PublicClient,
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  static async create(options: ArcDemoDriverOptions = {}): Promise<ArcDemoDriver> {
    const rootDir = options.rootDir ?? process.cwd();
    const environment = options.environment ?? process.env;
    const manifest = JSON.parse(await readFile(resolve(rootDir, "deployments/arc-testnet.json"), "utf8")) as DemoManifest;
    if (manifest.network.chainId !== arcTestnet.id) throw new Error("演示部署清单 Chain ID 不正确");
    const accounts = resolveDemoAccounts(requireArcPrivateKey(environment), manifest.accounts);
    const publicClient = createPublicClient({ chain: arcTestnet, transport: http(manifest.network.rpcUrl, { timeout: 20_000 }) }) as PublicClient;
    return new ArcDemoDriver(rootDir, environment, manifest, accounts, publicClient, options.now);
  }

  async recoverIncomplete(request: RecoveryRequest): Promise<DemoTransaction[]> {
    const transactions: DemoTransaction[] = [];
    await this.recoverIncompleteRound(request.roundId, request.confirmed, (transaction) => transactions.push(transaction));
    return transactions;
  }

  async prepareRound(input: { question: string; mode: DemoMode; querent: Address }): Promise<DemoPreparedRound> {
    if (!this.revealSignerFor(input.querent)) {
      throw new Error("当前连接钱包不是服务端可自动揭示的受控演示账户。为避免锁定资金，本轮已在 commit 前停止；不改合约时，任意外部钱包仍必须自行签署 reveal");
    }
    const registry = contractAddress(this.manifest, "DivinationRegistry");
    const [chainId, roundId] = await Promise.all([
      this.publicClient.getChainId(),
      this.publicClient.readContract({ address: registry, abi: ROUND_ABI, functionName: "nextRoundId" }),
    ]);
    if (chainId !== this.manifest.network.chainId) throw new Error("RPC Chain ID 与部署清单不一致");
    const salt = bytesToHex(randomBytes(32));
    const commitment = await this.publicClient.readContract({
      address: registry,
      abi: ROUND_ABI,
      functionName: "computeCommitment",
      args: [input.question, salt, input.querent, roundId],
    });
    return {
      preparation: {
        chainId,
        roundId: roundId.toString(),
        commitment,
        registry,
        predictionBook: contractAddress(this.manifest, "PredictionBook"),
        usdcToken: USDC_ADDRESS,
        feeUsdc6: YIJING_PARAMETERS.fee.toString(),
        bondUsdc6: YIJING_PARAMETERS.bond.toString(),
        waitBlocks: YIJING_PARAMETERS.waitBlocks.toString(),
        approvalAmountUsdc6: REUSABLE_APPROVAL_USDC6.toString(),
        approvalRoundCount: REUSABLE_APPROVAL_ROUND_COUNT,
      },
      secret: { salt },
    };
  }

  async confirmRound(
    session: DemoSession,
    preparation: DemoRoundPreparation,
    secret: DemoRoundSecret,
    input: DemoRoundConfirmation,
    progress: (update: DemoProgress) => void,
  ): Promise<DemoRoundResult> {
    const registry = contractAddress(this.manifest, "DivinationRegistry");
    const roundId = BigInt(preparation.roundId);
    if (input.approvalHash) {
      const approval = await this.verifyUserWrite({
        hash: input.approvalHash,
        sender: session.walletAddress,
        contract: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [registry, BigInt(preparation.approvalAmountUsdc6)],
        kind: "approval",
        label: `首次授权 ${preparation.approvalAmountUsdc6} 个六位精度 USDC 单位`,
      });
      progress({ phase: "committing", transaction: approval });
    }
    const commit = await this.verifyUserWrite({
      hash: input.commitHash,
      sender: session.walletAddress,
      contract: registry,
      abi: ROUND_ABI,
      functionName: "commit",
      args: [preparation.commitment, YIJING_PARAMETERS.fee, YIJING_PARAMETERS.bond, roundId],
      kind: "commit",
      label: `轮次 #${roundId} 立誓`,
    });
    progress({ phase: "waiting-reveal", transaction: commit });
    const committedRound = await this.publicClient.readContract({
      address: registry,
      abi: ROUND_ABI,
      functionName: "getRound",
      args: [roundId],
    }) as RoundView;
    if (!sameAddress(committedRound.querent, session.walletAddress)) throw new Error("链上轮次提问者与连接钱包不一致");
    if (committedRound.commitment.toLowerCase() !== preparation.commitment.toLowerCase()) throw new Error("链上轮次承诺与准备内容不一致");
    if (committedRound.state !== 0) throw new Error("commit 后轮次未进入待揭示状态");

    const revealWaitStartedAt = Date.now();
    await waitUntilPastBlock(committedRound.commitBlock + BigInt(preparation.waitBlocks), {
      getBlockNumber: () => this.publicClient.getBlockNumber(),
      timeoutMilliseconds: DEMO_SETTLEMENT_TIMEOUT_MILLISECONDS,
    });
    progress({
      phase: "revealing",
      timing: { key: "reveal-wait", actualMilliseconds: Date.now() - revealWaitStartedAt },
    });
    const revealSigner = this.revealSignerFor(session.walletAddress);
    if (!revealSigner) throw new Error("服务端缺少与链上提问者同地址的揭示签名账户；资金未被静默处置，请按恢复提示处理");
    const revealStartedAt = Date.now();
    /*
     * 安全论证：seed = keccak256(abi.encode(salt, blockhash(commitBlock + N)))。
     * commit 时任何一方都不知道未来块哈希，所以服务端持有 salt 不产生选卦或操纵能力；
     * 自动揭示还消除了提问者看到结果后选择性不揭示的能力。salt 仅在 Node 内存中
     * 保留到此处，既不进入公开 preparation，也不进入浏览器产物或日志。
     * 合约又要求 msg.sender == querent，因此不改合约时只允许服务端托管的同地址演示账户。
     */
    const reveal = (await this.write({
      account: revealSigner,
      address: registry,
      abi: ROUND_ABI,
      functionName: "reveal",
      args: [roundId, session.question, secret.salt],
      kind: "reveal",
      label: `轮次 #${roundId} 服务端自动揭示成卦`,
    })).transaction;
    progress({
      phase: "revealing",
      transaction: reveal,
      timing: { key: "reveal", actualMilliseconds: Date.now() - revealStartedAt },
    });
    const round = await this.publicClient.readContract({
      address: registry,
      abi: ROUND_ABI,
      functionName: "getRound",
      args: [roundId],
    }) as RoundView;
    if (round.state !== 1) throw new Error("reveal 后轮次未进入已成卦状态");
    const [primary, derived] = await Promise.all([
      this.publicClient.readContract({ address: registry, abi: ROUND_ABI, functionName: "kingWenNumber", args: [round.primaryHex] }),
      this.publicClient.readContract({ address: registry, abi: ROUND_ABI, functionName: "kingWenNumber", args: [round.derivedHex] }),
    ]);
    const changing = round.lines
      .map((line, index) => line === 6 || line === 9 ? index + 1 : 0)
      .filter((position) => position !== 0);
    return {
      roundId: roundId.toString(),
      transactions: [reveal],
      hexagram: {
        lines: [...round.lines],
        primaryKingWenNumber: primary,
        primaryName: getHexagramText(primary).name,
        derivedKingWenNumber: derived,
        derivedName: getHexagramText(derived).name,
        changingLinePositions: changing,
      },
    };
  }

  async createPredictions(session: DemoSession, progress: (update: DemoProgress) => void): Promise<DemoPredictionResult> {
    const startedAt = Date.now();
    if (!session.roundId || !session.hexagram) throw new Error("演示会话缺少已揭示卦象");
    if (session.mode === "live") {
      const upperBound = liveBudgetUpperBoundCny();
      if (upperBound >= DEMO_LIVE_BUDGET_CNY) throw new Error(`live 最坏模型费用超过 ${DEMO_LIVE_BUDGET_CNY} CNY 硬上限`);
      const balance = await getDeepSeekBalance(this.environment);
      if (!balance.isAvailable || (balance.balances.CNY ?? 0) < upperBound) {
        throw new Error("DeepSeek 可用余额不足以覆盖本轮最坏费用上界");
      }
    }
    const existingRun = this.predictionRuns.get(session.roundId);
    if (existingRun) {
      existingRun.progress.current = progress;
      return this.completePredictionRun(existingRun);
    }
    const predictionBook = contractAddress(this.manifest, "PredictionBook");
    const scoreBook = contractAddress(this.manifest, "ScoreBook");
    const vaults = Object.fromEntries(DIVINER_KEYS.map((key) => [key, contractAddress(this.manifest, `DivinerVault_${key}`)])) as Record<DivinerKey, Address>;
    const [vaultReadiness, registeredDivinerCount] = await Promise.all([
      Promise.all(DIVINER_KEYS.map(async (key) => {
        const address = vaults[key];
        const [state, available] = await Promise.all([
          this.publicClient.readContract({ address, abi: VAULT_ABI, functionName: "state" }),
          this.publicClient.readContract({ address, abi: VAULT_ABI, functionName: "availableBalance" }),
        ]);
        return { key, state: Number(state), available };
      })),
      this.publicClient.readContract({
        address: predictionBook,
        abi: PREDICTION_ABI,
        functionName: "registeredDivinerCount",
      }),
    ]);
    for (const vault of vaultReadiness) {
      if (vault.state !== 0) throw new Error(`${DIVINER_NAMES[vault.key]}金库已封存，禁止调用模型`);
      if (vault.available < MINIMUM_VAULT_AVAILABLE_USDC6) {
        throw new Error(`${DIVINER_NAMES[vault.key]}可用金库不足，禁止调用模型`);
      }
    }
    if (registeredDivinerCount !== 3n) throw new Error("PredictionBook 注册易者数量不是三家，禁止调用模型");

    const provider = createDemoProvider(session.mode, {
      confirmLive: session.mode === "live",
      environment: this.environment,
    });
    const humanProposition = await this.prepareHumanCase(session, progress);
    const compiler: PropositionCompilerLike = {
      compile: async (question, recordAudit) => {
        const output = {
          predicateId: humanProposition.predicateId,
          params: humanProposition.params,
          reasoning: "问题已由独立分类步骤确认可判定；保留原问题并交由人层见证。",
        };
        const request = {
          taskId: "human-proposition-freeze",
          systemPrompt: "只冻结已确认的人层原问题，不读取或解释卦象。",
          cacheSystemPrompt: false,
          userPrompt: question,
          schema: PROPOSITION_OUTPUT_SCHEMA,
          effort: "low" as const,
        };
        await recordAudit({ modelId: "neutral-human-freezer-v1", request, output });
        return {
          predicateId: humanProposition.predicateId,
          params: humanProposition.params,
          deadlineBlock: BigInt(humanProposition.deadlineBlock),
          statement: humanProposition.statement,
          reasoning: output.reasoning,
          calibration: {
            method: humanProposition.calibration.method,
            sampleCount: 0,
            yesCount: 0,
            empiricalBaseRateBps: 0,
            historyStartBlock: BigInt(humanProposition.calibration.historyStartBlock),
            historyEndBlock: BigInt(humanProposition.calibration.historyEndBlock),
            horizonBlocks: BigInt(humanProposition.calibration.horizonBlocks),
          },
        };
      },
    };
    const [historyEntries, balancesBefore] = await Promise.all([
      Promise.all(DIVINER_KEYS.map(async (key) => [
        key,
        await readDivinerHistory(this.publicClient, scoreBook, this.accounts.diviners[key].address),
      ] as const)),
      Promise.all(DIVINER_KEYS.map(async (key) => [
        key,
        await this.publicClient.readContract({ address: vaults[key], abi: VAULT_ABI, functionName: "totalAssets" }),
      ] as const)),
    ]);
    const histories = Object.fromEntries(historyEntries) as Record<DivinerKey, Awaited<ReturnType<typeof readDivinerHistory>>>;
    this.vaultBalancesBefore.set(session.roundId, Object.fromEntries(balancesBefore) as Record<DivinerKey, bigint>);
    const signers = Object.fromEntries(DIVINER_KEYS.map((key) => [key, {
      account: this.accounts.diviners[key],
      wallet: walletFor(this.accounts.diviners[key], this.manifest.network.rpcUrl),
    } satisfies DivinerSigner])) as Record<DivinerKey, DivinerSigner>;
    const progressRef = { current: progress };
    const baseSubmitter = new ViemPredictionSubmitter({
      publicClient: this.publicClient,
      predictionBook,
      signers,
      beforeSend: ({ estimatedGas, gasPriceWei, signerBalanceWei }) => assertGasSendBudget({
        spentWei: this.gasSpentWei,
        estimatedGas: estimatedGas * GAS_ESTIMATE_SAFETY_MULTIPLIER,
        gasPriceWei,
        signerBalanceWei,
        maximumWei: DEMO_GAS_BUDGET_WEI,
      }),
      onConfirmedGasCost: (gasCostWei) => {
        this.gasSpentWei += gasCostWei;
      },
    });
    const emitted: DemoPrediction[] = [];
    const submitter: PredictionSubmitter = {
      submit: async (submission) => {
        const emittedBefore = emitted.length;
        assertDeadlineHeadroom({
          currentBlock: await this.publicClient.getBlockNumber(),
          deadlineBlock: submission.deadline,
          remainingWrites: DIVINER_KEYS.length - emittedBefore,
          remainingInferenceCalls: session.mode === "live" ? DIVINER_KEYS.length - emittedBefore - 1 : 0,
        });
        const predictionWriteStartedAt = Date.now();
        const receipt = await baseSubmitter.submit(submission);
        const activeContext = this.predictionRuns.get(session.roundId!);
        if (activeContext) activeContext.predictionWriteMilliseconds += Date.now() - predictionWriteStartedAt;
        if (receipt.predictionId === undefined) throw new Error("预测提交回执缺少 predictionId");
        const chain = await this.publicClient.readContract({
          address: predictionBook,
          abi: PREDICTION_ABI,
          functionName: "getPrediction",
          args: [receipt.predictionId],
        }) as PredictionView;
        const transaction = this.transaction(
          "prediction",
          `${DIVINER_NAMES[submission.divinerKey]}提交预测 #${receipt.predictionId}`,
          receipt.transactionHash,
          receipt.blockNumber,
          receipt.gasCostWei ?? 0n,
        );
        const prediction: DemoPrediction = {
          id: receipt.predictionId.toString(),
          divinerKey: submission.divinerKey,
          divinerName: DIVINER_NAMES[submission.divinerKey],
          probabilityBps: submission.probabilityBps,
          direction: submission.direction ? "YES" : "NO",
          multiplier: chain.multiplier,
          reasoning: submission.reasoning,
          transaction,
        };
        emitted.push(prediction);
        progressRef.current({ phase: "predicting", prediction });
        return receipt;
      },
    };
    const orchestrator = new AgentOrchestrator({
      compiler,
      provider,
      submitter,
      journal: new FileAgentRunJournal(resolve(this.rootDir, "reports/agent-run-journal")),
      scope: { chainId: this.manifest.network.chainId, predictionBook },
      onPropositionCompiled: async (proposition) => {
        progressRef.current({
          phase: "compiling",
          proposition: {
            ...toDemoProposition(proposition),
            ...(humanProposition.resolution ? { resolution: humanProposition.resolution } : {}),
          },
        });
      },
    });
    const context: PredictionRunContext = {
      mode: session.mode,
      provider,
      orchestrator,
      emitted,
      progress: progressRef,
      request: {
        roundId: BigInt(session.roundId),
        question: session.question,
        hexagram: {
          lines: session.hexagram.lines,
          primaryKingWenNumber: session.hexagram.primaryKingWenNumber,
          derivedKingWenNumber: session.hexagram.derivedKingWenNumber,
          changingLinePositions: session.hexagram.changingLinePositions,
        },
        histories,
      },
      startedAt,
      predictionWriteMilliseconds: 0,
      humanProposition,
      feeDistributionTransactions: [],
      vaults,
    };
    this.predictionRuns.set(session.roundId, context);
    return this.completePredictionRun(context);
  }

  private async completePredictionRun(context: PredictionRunContext): Promise<DemoPredictionResult> {
    const run = await context.orchestrator.run(context.request);
    if (context.emitted.length !== 3) throw new Error(`三家预测数量错误：${context.emitted.length}`);
    const feeShares = splitOracleFee();
    while (context.feeDistributionTransactions.length < feeShares.length) {
      const share = feeShares[context.feeDistributionTransactions.length]!;
      const vault = context.vaults[share.divinerKey as DivinerKey];
      if (!vault || !sameAddress(vault, share.vault)) {
        throw new Error(`${share.divinerName}金库地址与收费配置不一致，拒绝分账`);
      }
      /*
       * 可判定轨的用户卦金已随 commit 托管；旧合约会到结算才转给国库。
       * 在不改合约的约束下，由同一国库运营账户当场等额分给三座易者金库，
       * 让“解读由谁提供，钱就归谁”在用户看到结果前成立。
       */
      const written = (await this.write({
        account: this.accounts.deployer,
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [vault, share.amountUsdc6],
        kind: "fee-distribution",
        label: `卦金分入${share.divinerName}金库`,
      })).transaction;
      const transaction = { ...written, amountUsdc6: share.amountUsdc6.toString() };
      context.feeDistributionTransactions.push(transaction);
      context.progress.current({ phase: "predicting", transaction });
    }
    const providerSummary = {
      kind: context.mode,
      modelId: context.provider.modelId,
      ...(isUsageTrackedDemoProvider(context.provider) ? {
        usage: { ...context.provider.usageTotals },
        estimatedCostUsd: estimateDeepSeekUsageUsd(context.provider.usageTotals, this.now()),
      } : {}),
    };
    const totalMilliseconds = Date.now() - context.startedAt;
    context.progress.current({
      timing: {
        key: "inference",
        actualMilliseconds: Math.max(0, totalMilliseconds - context.predictionWriteMilliseconds),
      },
    });
    context.progress.current({
      timing: { key: "predictions", actualMilliseconds: context.predictionWriteMilliseconds },
    });
    return {
      proposition: context.humanProposition,
      predictions: context.emitted,
      transactions: context.feeDistributionTransactions,
      provider: providerSummary,
    };
  }

  async settleRound(
    session: DemoSession,
    progress: (update: DemoProgress) => void,
    input: DemoWitnessInput = {},
  ): Promise<DemoSettlementResult> {
    if (!session.roundId || !session.proposition || session.predictions.length !== 3) {
      throw new Error("结算前必须存在同轮三家预测与冻结命题");
    }
    const predictionBook = contractAddress(this.manifest, "PredictionBook");
    const scoreBook = contractAddress(this.manifest, "ScoreBook");
    const transactions: DemoTransaction[] = [];
    const humanCase = this.humanCases.get(session.roundId);
    if (!humanCase) throw new Error("缺少本轮人层见证案件");
    const witness = resolveHumanWitnesses({
      querentOutcome: typeof input.querentOutcome === "boolean" ? input.querentOutcome : null,
      counterpartyOutcome: typeof input.counterpartyOutcome === "boolean" ? input.counterpartyOutcome : null,
    });
    const currentBlock = await this.publicClient.getBlockNumber();
    if (!witness.unresolved && witness.outcome !== null && currentBlock <= humanCase.deadlineBlock) {
      const responseHash = keccak256(stringToHex(`yijing-human-response-v1/${humanCase.requestHash}/${witness.outcome}`));
      const responseURI = `data:application/json,${encodeURIComponent(JSON.stringify({
        kind: "querent-witness",
        roundId: session.roundId,
        outcome: witness.outcome,
        requestHash: humanCase.requestHash,
      }))}`;
      const attestation = (await this.write({
        account: this.accounts.deployer,
        address: humanCase.resolver,
        abi: ATTESTED_ABI,
        functionName: "submitOutcome",
        args: [humanCase.requestHash, witness.outcome, responseURI, responseHash],
        kind: "attestation",
        label: `提问者见证轮次 #${session.roundId}`,
      })).transaction;
      transactions.push(attestation);
      progress({ phase: "waiting-settlement", transaction: attestation });
    }
    await waitUntilPastBlock(humanCase.deadlineBlock, {
      getBlockNumber: () => this.publicClient.getBlockNumber(),
      timeoutMilliseconds: DEMO_SETTLEMENT_TIMEOUT_MILLISECONDS,
    });
    const settlementStartedAt = Date.now();
    for (const prediction of session.predictions) {
      const settled = (await this.write({
        account: this.accounts.thirdParty,
        address: predictionBook,
        abi: PREDICTION_ABI,
        functionName: "settle",
        args: [BigInt(prediction.id)],
        kind: "settlement",
        label: `服务端无许可结算 #${prediction.id}`,
      })).transaction;
      transactions.push(settled);
      progress({ phase: "settling", transaction: settled });
    }
    progress({
      phase: "settling",
      timing: { key: "settlement", actualMilliseconds: Date.now() - settlementStartedAt },
    });

    const before = this.vaultBalancesBefore.get(session.roundId);
    if (!before) throw new Error("缺少预测提交前的金库余额快照");
    const afterEntries = await Promise.all(DIVINER_KEYS.map(async (key) => [
      key,
      await this.publicClient.readContract({
        address: contractAddress(this.manifest, `DivinerVault_${key}`),
        abi: VAULT_ABI,
        functionName: "totalAssets",
      }),
    ] as const));
    const after = Object.fromEntries(afterEntries) as Record<DivinerKey, bigint>;
    const histories = await Promise.all(DIVINER_KEYS.map(async (key) => {
      const diviner = this.accounts.diviners[key].address;
      const historyCount = await this.publicClient.readContract({
        address: scoreBook,
        abi: SCORE_ABI,
        functionName: "historyCount",
        args: [diviner],
      });
      if (historyCount === 0n) throw new Error(`${DIVINER_NAMES[key]}结算后没有 ScoreBook 现场记录`);
      return this.publicClient.readContract({
        address: scoreBook,
        abi: SCORE_ABI,
        functionName: "getHistory",
        args: [diviner, historyCount - 1n],
      }) as Promise<HistoryView>;
    }));
    const resolution = settledResolutionForRound(BigInt(session.roundId), histories);
    return {
      transactions,
      outcome: resolution.outcome,
      unresolved: resolution.unresolved,
      vaultChanges: DIVINER_KEYS.map((key) => ({
        divinerKey: key,
        beforeUsdc6: before[key].toString(),
        afterUsdc6: after[key].toString(),
        deltaUsdc6: (after[key] - before[key]).toString(),
      })),
    };
  }

  /** 在调用三位易者前先建立标准 ERC-8004 人层案件，失败时不产生模型费用。 */
  private async prepareHumanCase(session: DemoSession, progress: (update: DemoProgress) => void): Promise<DemoProposition> {
    if (!session.roundId) throw new Error("人层案件缺少轮次");
    const existing = this.humanCases.get(session.roundId);
    if (existing) {
      return buildAttestedHumanProposition({
        question: session.question,
        requestHash: existing.requestHash,
        agentId: existing.agentId,
        cutoffBlock: existing.deadlineBlock - (session.horizon === "long" ? HUMAN_LONG_CYCLE_BLOCKS : HUMAN_SHORT_CYCLE_BLOCKS),
        deadlineBlock: existing.deadlineBlock,
        horizon: session.horizon,
      });
    }
    const resolver = contractAddress(this.manifest, "AttestedResolver");
    const validationRegistry = this.manifest.externalContracts?.ValidationRegistry?.address;
    if (!validationRegistry || !/^0x[0-9a-fA-F]{40}$/.test(validationRegistry)) {
      throw new Error("部署清单缺少 ERC-8004 ValidationRegistry");
    }
    const owner = this.accounts.diviners.takashima;
    const identity = this.manifest.agents?.find((agent) => sameAddress(agent.address, owner.address));
    if (!identity) throw new Error("部署清单缺少高島易断的人层 agentId");
    const agentId = BigInt(identity.agentId);
    const cutoffBlock = await this.publicClient.getBlockNumber();
    const horizonBlocks = session.horizon === "long" ? HUMAN_LONG_CYCLE_BLOCKS : HUMAN_SHORT_CYCLE_BLOCKS;
    const deadlineBlock = cutoffBlock + horizonBlocks;
    const requestHash = humanRequestHash({ roundId: session.roundId, question: session.question });
    const requestURI = `data:application/json,${encodeURIComponent(JSON.stringify({
      kind: "yijing-human-outcome",
      roundId: session.roundId,
      requestHash,
    }))}`;
    const requested = (await this.write({
      account: owner,
      address: validationRegistry as Address,
      abi: VALIDATION_ABI,
      functionName: "validationRequest",
      args: [resolver, agentId, requestURI, requestHash],
      kind: "attestation",
      label: `轮次 #${session.roundId} 请求人层见证`,
    })).transaction;
    progress({ phase: "compiling", transaction: requested });
    const opened = (await this.write({
      account: this.accounts.deployer,
      address: resolver,
      abi: ATTESTED_ABI,
      functionName: "openCase",
      args: [requestHash, agentId, deadlineBlock],
      kind: "attestation",
      label: `轮次 #${session.roundId} 登记人层案件`,
    })).transaction;
    progress({ phase: "compiling", transaction: opened });
    this.humanCases.set(session.roundId, { requestHash, agentId, deadlineBlock, resolver });
    return buildAttestedHumanProposition({
      question: session.question,
      requestHash,
      agentId,
      cutoffBlock,
      deadlineBlock,
      horizon: session.horizon,
    });
  }

  private async verifyUserWrite(input: {
    hash: Hex;
    sender: Address;
    contract: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    kind: DemoTransaction["kind"];
    label: string;
  }): Promise<DemoTransaction> {
    const [transaction, receipt] = await Promise.all([
      this.publicClient.getTransaction({ hash: input.hash }),
      this.publicClient.getTransactionReceipt({ hash: input.hash }),
    ]);
    if (receipt.status !== "success") throw new Error(`${input.label}交易没有成功确认`);
    assertUserTransactionIntent(
      { from: transaction.from, to: transaction.to, input: transaction.input },
      {
        sender: input.sender,
        contract: input.contract,
        abi: input.abi,
        functionName: input.functionName,
        args: input.args,
      },
    );
    return this.transaction(
      input.kind,
      input.label,
      input.hash,
      receipt.blockNumber,
      receipt.gasUsed * receipt.effectiveGasPrice,
    );
  }

  private revealSignerFor(address: Address): LocalAccount | null {
    const candidates = [this.accounts.deployer, this.accounts.querent, this.accounts.thirdParty];
    return candidates.find((candidate) => sameAddress(candidate.address, address)) ?? null;
  }

  private async write(input: {
    account: LocalAccount;
    address: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    kind: DemoTransaction["kind"];
    label: string;
  }): Promise<{ transaction: DemoTransaction; result: unknown }> {
    const simulation = await this.publicClient.simulateContract({
      account: input.account,
      address: input.address,
      abi: input.abi,
      functionName: input.functionName,
      args: input.args,
    } as never);
    const [estimatedGas, gasPrice, signerBalance] = await Promise.all([
      this.publicClient.estimateContractGas({
        account: input.account,
        address: input.address,
        abi: input.abi,
        functionName: input.functionName,
        args: input.args,
      } as never),
      this.publicClient.getGasPrice(),
      this.publicClient.getBalance({ address: input.account.address }),
    ]);
    assertGasSendBudget({
      spentWei: this.gasSpentWei,
      estimatedGas,
      gasPriceWei: gasPrice * GAS_ESTIMATE_SAFETY_MULTIPLIER,
      signerBalanceWei: signerBalance,
      maximumWei: DEMO_GAS_BUDGET_WEI,
    });
    const hash = await walletFor(input.account, this.manifest.network.rpcUrl).writeContract({
      ...simulation.request,
      account: input.account,
    } as never);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${input.label}交易回滚`);
    this.gasSpentWei += receipt.gasUsed * receipt.effectiveGasPrice;
    return {
      result: simulation.result,
      transaction: this.transaction(
        input.kind,
        input.label,
        hash,
        receipt.blockNumber,
        receipt.gasUsed * receipt.effectiveGasPrice,
      ),
    };
  }

  private async recoverLatestExpiredIncomplete(progress: (transaction: DemoTransaction) => void): Promise<void> {
    const registry = contractAddress(this.manifest, "DivinationRegistry");
    const nextRoundId = await this.publicClient.readContract({ address: registry, abi: ROUND_ABI, functionName: "nextRoundId" });
    if (nextRoundId === 0n) return;
    await this.recoverIncompleteRound(nextRoundId - 1n, true, progress, true);
  }

  private async recoverIncompleteRound(
    roundId: bigint,
    confirmed: boolean,
    progress: (transaction: DemoTransaction) => void,
    skipUntilExpired = false,
  ): Promise<void> {
    if (!confirmed) throw new Error("恢复操作缺少显式确认");
    const registry = contractAddress(this.manifest, "DivinationRegistry");
    const predictionBook = contractAddress(this.manifest, "PredictionBook");
    const nextRoundId = await this.publicClient.readContract({ address: registry, abi: ROUND_ABI, functionName: "nextRoundId" });
    if (roundId < 0n || roundId >= nextRoundId) throw new Error(`恢复目标轮次 #${roundId} 不存在`);
    const round = await this.publicClient.readContract({
      address: registry,
      abi: ROUND_ABI,
      functionName: "getRound",
      args: [roundId],
    }) as RoundView;
    const terms = round.state === 1 || round.state === 2
      ? await this.publicClient.readContract({
        address: predictionBook,
        abi: PREDICTION_ABI,
        functionName: "getRoundTerms",
        args: [roundId],
      }) as RoundTermsView
      : null;
    const plan = recoveryPlanForRound(round, terms);
    if (!plan) return;
    if (round.state === 2) {
      const quorum = await this.publicClient.readContract({
        address: predictionBook,
        abi: PREDICTION_ABI,
        functionName: "quorumStatus",
        args: [roundId],
      });
      if (quorum[0] === quorum[1]) throw new Error(`上轮 #${roundId} 已满足法定人数，必须先完成结算`);
    }
    const currentBlock = await this.publicClient.getBlockNumber();
    if (skipUntilExpired && currentBlock <= plan.deadlineBlock) return;
    assertRecoveryReady({ confirmed, currentBlock, deadlineBlock: plan.deadlineBlock });
    await this.fundIfBelow(
      this.accounts.thirdParty,
      OPERATOR_GAS_TARGET_USDC6,
      "补足上轮恢复账户 gas 垫",
      progress,
    );
    const recovered = plan.kind === "forfeit"
      ? await this.write({
        account: this.accounts.thirdParty,
        address: registry,
        abi: ROUND_ABI,
        functionName: "forfeit",
        args: [roundId],
        kind: "recovery",
        label: `清理未揭示轮次 #${roundId}`,
      })
      : await this.write({
        account: this.accounts.thirdParty,
        address: predictionBook,
        abi: PREDICTION_ABI,
        functionName: "cancelIncompleteRound",
        args: [roundId],
        kind: "recovery",
        label: `释放未完成轮次 #${roundId}`,
      });
    progress(recovered.transaction);
  }

  private async fundIfBelow(
    recipient: LocalAccount,
    targetUsdc6: bigint,
    label: string,
    progress: (transaction: DemoTransaction) => void,
  ): Promise<void> {
    const current = await this.publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [recipient.address],
    });
    const amount = requiredTopUp(current, targetUsdc6);
    if (amount === 0n) return;
    const funded = await this.write({
      account: this.accounts.deployer,
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [recipient.address, amount],
      kind: "funding",
      label,
    });
    progress(funded.transaction);
  }

  private transaction(
    kind: DemoTransaction["kind"],
    label: string,
    hash: Hex,
    blockNumber: bigint,
    gasCostWei: bigint,
  ): DemoTransaction {
    return { kind, label, hash, blockNumber: blockNumber.toString(), gasCostUsdc6: gasWeiToUsdc6(gasCostWei) };
  }
}

export function createArcDemoDriver(options: ArcDemoDriverOptions = {}): Promise<ArcDemoDriver> {
  return ArcDemoDriver.create(options);
}
