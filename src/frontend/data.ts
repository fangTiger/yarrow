import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createPublicClient, getAddress, http, type Address, type Hex, type PublicClient } from "viem";
import { getHexagramText } from "../agent/zhouyi-corpus.js";
import { scanLogsInBlockWindows } from "../arc-logs.js";
import {
  buildBankrollSeries,
  buildVerifiedGrave,
  createLineViews,
  interpretBacktestSignal,
  type GraveSnapshot,
} from "./domain.js";
import { divinationRegistryAbi, divinerVaultAbi, predictionBookAbi, scoreBookAbi } from "./abis.js";

export {
  ARC_LOG_SCAN_BLOCK_WINDOW,
  ARC_RPC_CONCURRENCY_LIMIT,
  scanLogsInBlockWindows,
} from "../arc-logs.js";

interface AuditRecord {
  type?: string;
  payload?: Record<string, unknown>;
}

export interface AuditContext {
  question: string;
  statement: string;
  provider: string;
  resolutionTier: "human" | "heaven";
  readings: Record<string, { reasoning: string; probabilityBps: number }>;
}

export interface ReportSummary {
  sampleCount: number;
  correctCount: number;
  averageBrier: number;
  brierSkillScore: number | null;
  brierVsConstantPValue: number | null;
  empiricalBaseRateBps: number;
  constantBaselineBrier: number;
  wilson95: { lowerBps: number; upperBps: number };
  finalBankrollUsdc6?: string;
}

export interface ChainBacktestSummary {
  sampleCount: bigint;
  correctCount: bigint;
  totalBrier: bigint;
  wilson95: readonly [number, number];
  brierSkill: readonly [number, bigint, bigint, boolean] | null;
}

export interface DivinerSnapshot {
  key: string;
  name: string;
  address: Address;
  agentId: string | null;
  vaultAddress: Address;
  vaultState: "ACTIVE" | "SEALED";
  vaultAssetsUsdc6: string;
  vaultAvailableUsdc6: string;
  liveStats: {
    sampleCount: number;
    correctCount: number;
    unresolvedCount: number;
    averageBrier: number | null;
    empiricalBaseRateBps: number | null;
    constantBaselineBrier: number | null;
    brierSkillScore: number | null;
    wilson95: [number, number];
  };
  lastLiveEntry: null | {
    predictionId: string;
    roundId: string;
    probabilityBps: number;
    brier: number;
    outcome: boolean;
    correct: boolean;
    unresolved: boolean;
  };
  backtest: {
    sampleCount: number;
    correctCount: number;
    averageBrier: number;
    brierSkillScore: number | null;
    brierVsConstantPValue: number | null;
    empiricalBaseRateBps: number;
    constantBaselineBrier: number;
    wilson95: [number, number];
    chainVerified: boolean;
    signal: "no-discernible-signal" | "inconclusive";
    finalBankrollUsdc6: string;
  };
}

export interface OracleSnapshot {
  generatedAt: string;
  chain: {
    name: string;
    chainId: number;
    latestBlock: string;
    status: "LIVE";
  };
  contracts: {
    divinationRegistry: Address;
    predictionBook: Address;
    scoreBook: Address;
  };
  round: {
    id: string;
    question: string;
    statement: string;
    state: string;
    commitBlock: string;
    revealDeadline: string;
    feeUsdc6: string;
    bondUsdc6: string;
    lines: ReturnType<typeof createLineViews>;
    primary: { number: number; name: string; judgement: string };
    derived: { number: number; name: string; judgement: string };
  };
  predictions: Array<{
    id: string;
    divinerKey: string;
    divinerName: string;
    direction: "YES" | "NO";
    probabilityBps: number;
    multiplier: number;
    reservedUsdc6: string;
    deadline: string;
    state: string;
    outcome: boolean | null;
    settlementDeltaUsdc6: string | null;
    reasoning: string | null;
    reasoningSource: "audit-journal" | "unavailable";
    modelId: Hex;
    promptHash: Hex;
    schemaHash: Hex;
    providerConfigHash: Hex;
    attemptCount: number;
  }>;
  diviners: DivinerSnapshot[];
  backtest: {
    tag: "backtested";
    provider: string;
    sampleCount: number;
    cutoffBlock: string;
    resolutionBlock: string;
    curves: ReturnType<typeof buildBankrollSeries>;
    source: string;
  };
  history: {
    live: OracleHistoryRound[];
    backtested: OracleHistoryRound[];
    source: string;
  };
  graves: GraveSnapshot[];
  disclosures: {
    heaven: string;
    human: string;
    inference: string;
    leap: string;
    replay: string;
    risk: string;
  };
}

export interface OracleHistoryPrediction {
  divinerKey: string;
  divinerName: string;
  probabilityBps: number;
  direction: "YES" | "NO";
  settlementDeltaUsdc6: string | null;
  brier: number | null;
  reasoning: string | null;
}

export interface OracleHistoryRound {
  id: string;
  source: "live" | "backtested";
  sourceLabel: string;
  resolutionTier: "human" | "heaven";
  provider: string;
  question: string;
  statement: string;
  occurredAt: string;
  cutoffBlock: string;
  deadlineBlock: string;
  outcome: boolean | null;
  state: string;
  lines: ReturnType<typeof createLineViews>;
  primary: { number: number; name: string };
  derived: { number: number; name: string };
  predictions: OracleHistoryPrediction[];
}

interface DeploymentFile {
  network: { name: string; chainId: number; rpcUrl: string };
  accounts: {
    diviners: Array<{ key: string; name: string; address: string }>;
  };
  contracts: Record<string, { address: string; blockNumber: string }>;
  agents?: Array<{ address: string; agentId: string }>;
  runs?: Array<{ reportPath: string }>;
}

interface ReplayRound {
  replayId: number;
  backtested?: boolean;
  cutoff: { blockNumber: string; timestamp?: string };
  resolution: { blockNumber: string; timestamp?: string };
  proposition?: { statement?: string };
  hexagram?: {
    lines: number[];
    primaryKingWenNumber: number;
    derivedKingWenNumber: number;
    changingLinePositions: number[];
  };
  outcome?: boolean;
  predictions: Array<{
    divinerKey: string;
    probabilityBps?: number;
    reasoning?: string;
    direction?: "YES" | "NO";
    settlementDeltaUsdc6?: string;
    brier?: string;
    multiplier: number;
    bankrollBeforeUsdc6: string;
    bankrollAfterUsdc6: string;
  }>;
}

interface ReplayReport {
  modelId: string;
  sampleCount: number;
  rounds: ReplayRound[];
  summaries: Record<string, ReportSummary>;
}

interface SealDemoDeploymentFile {
  network: { chainId: number };
  profile: { key: string; name: string };
  accounts: { diviner: string };
  contracts: Record<string, { address: string }>;
  agent?: { agentId: string };
}

interface RoundTuple {
  commitBlock: bigint;
  revealDeadline: bigint;
  fee: bigint;
  bond: bigint;
  lines: readonly number[];
  primaryHex: number;
  derivedHex: number;
  state: number;
}

interface PredictionTuple {
  roundId: bigint;
  diviner: Address;
  direction: boolean;
  probabilityBps: number;
  multiplier: number;
  reserved: bigint;
  deadline: bigint;
  modelId: Hex;
  promptHash: Hex;
  schemaHash: Hex;
  providerConfigHash: Hex;
  attemptCount: number;
}

interface StatsTuple {
  sampleCount: bigint;
  correctCount: bigint;
  unresolvedCount: bigint;
  totalBrier: bigint;
}

interface ScoreEntryTuple {
  predictionId: bigint;
  roundId: bigint;
  probabilityBps: number;
  brier: bigint;
  outcome: boolean;
  correct: boolean;
  unresolved: boolean;
}

const ROUND_STATES = ["已提交", "已成卦", "已预测", "已结算", "已没收", "未决", "已作废"] as const;
const PREDICTION_STATES = ["不存在", "待结算", "已结算", "未决", "已作废"] as const;

function liveSourceLabel(tier: "human" | "heaven", state: number): string {
  if (tier === "heaven") return "天层・链上现场（旧流程）";
  if (state === 3) return "人层・已结算";
  if (state === 5) return "人层・未决";
  return "人层・等待见证";
}

export function isDisplayableRoundState(state: number): boolean {
  return state === 1 || state === 2 || state === 3 || state === 5;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

export function extractAuditContext(
  records: readonly unknown[],
  predictionBook: string,
  roundId: string,
): AuditContext | null {
  const parsed = records.map((record) => record as AuditRecord);
  const claim = parsed.find((record) => record.type === "round-claimed");
  const claimedBook = String(claim?.payload?.predictionBook ?? "").toLowerCase();
  const claimedRound = String(claim?.payload?.roundId ?? "");
  if (claimedBook !== predictionBook.toLowerCase() || claimedRound !== roundId) return null;

  const compiled = parsed.find((record) => record.type === "proposition-compiled");
  const compiledOutput = asObject(compiled?.payload?.output);
  const calibration = asObject(compiledOutput?.calibration);
  const resolutionTier = String(calibration?.method ?? "").startsWith("human-") ? "human" as const : "heaven" as const;
  const readings: AuditContext["readings"] = {};
  let provider = "unknown";

  for (const record of parsed.filter((candidate) => candidate.type === "diviner-output")) {
    const key = String(record.payload?.divinerKey ?? "");
    const output = asObject(record.payload?.output);
    const reasoning = String(output?.reasoning ?? "");
    const probabilityBps = Number(output?.probabilityBps);
    if (!key || !reasoning || !Number.isInteger(probabilityBps)) continue;
    provider = String(record.payload?.modelId ?? provider);
    readings[key] = { reasoning, probabilityBps };
  }

  return {
    question: String(compiled?.payload?.question ?? ""),
    statement: String(compiledOutput?.statement ?? ""),
    provider,
    resolutionTier,
    readings,
  };
}

export function verifyBacktestSummary(report: ReportSummary, chain: ChainBacktestSummary): boolean {
  if (report.sampleCount !== Number(chain.sampleCount) || report.correctCount !== Number(chain.correctCount)) {
    return false;
  }
  if (report.wilson95.lowerBps !== chain.wilson95[0] || report.wilson95.upperBps !== chain.wilson95[1]) {
    return false;
  }
  if (chain.sampleCount === 0n) return report.averageBrier === 0 && chain.brierSkill !== null;
  const chainAverage = Number(chain.totalBrier) / Number(chain.sampleCount) / 100_000_000;
  if (Math.abs(report.averageBrier - chainAverage) > 0.00000001 || chain.brierSkill === null) return false;
  const [baseRateBps, constantBrierRaw, bssRaw, defined] = chain.brierSkill;
  const chainBss = defined ? Number(bssRaw) / 100_000_000 : null;
  return report.empiricalBaseRateBps === baseRateBps
    && Math.abs(report.constantBaselineBrier - Number(constantBrierRaw) / 100_000_000) <= 0.00000001
    && (report.brierSkillScore === null
      ? chainBss === null
      : chainBss !== null && Math.abs(report.brierSkillScore - chainBss) <= 0.00000001);
}

export function buildLiveScore(
  stats: StatsTuple,
  wilson95: readonly [number, number],
  brierSkill: readonly [number, bigint, bigint, boolean] | null,
): DivinerSnapshot["liveStats"] {
  const sampleCount = Number(stats.sampleCount);
  return {
    sampleCount,
    correctCount: Number(stats.correctCount),
    unresolvedCount: Number(stats.unresolvedCount),
    averageBrier: sampleCount === 0 ? null : Number(stats.totalBrier) / sampleCount / 100_000_000,
    empiricalBaseRateBps: brierSkill?.[0] ?? null,
    constantBaselineBrier: brierSkill ? Number(brierSkill[1]) / 100_000_000 : null,
    brierSkillScore: brierSkill?.[3] ? Number(brierSkill[2]) / 100_000_000 : null,
    wilson95: [wilson95[0], wilson95[1]],
  };
}

function normalizeReportSummary(report: ReplayReport, divinerKey: string): ReportSummary {
  const stored = report.summaries[divinerKey];
  if (!stored) throw new Error(`回放报告缺少易者 ${divinerKey}`);
  if (
    typeof stored.empiricalBaseRateBps === "number"
    && typeof stored.constantBaselineBrier === "number"
    && (typeof stored.brierSkillScore === "number" || stored.brierSkillScore === null)
    && (typeof stored.brierVsConstantPValue === "number" || stored.brierVsConstantPValue === null)
  ) return stored;

  const outcomes = report.rounds.map((round) => round.outcome).filter((outcome): outcome is boolean => typeof outcome === "boolean");
  if (outcomes.length !== report.rounds.length || outcomes.length === 0) {
    throw new Error("旧回放报告缺少计算经验基础概率所需的逐轮 outcome");
  }
  const yesCount = outcomes.filter(Boolean).length;
  const baseRate = yesCount / outcomes.length;
  const constantBaselineBrier = baseRate * (1 - baseRate);
  return {
    ...stored,
    empiricalBaseRateBps: Math.round(baseRate * 10_000),
    constantBaselineBrier,
    brierSkillScore: constantBaselineBrier === 0 ? null : 1 - stored.averageBrier / constantBaselineBrier,
    brierVsConstantPValue: null,
  };
}

export function selectGraves<T extends { vaultState: "ACTIVE" | "SEALED" }>(readings: readonly T[]): T[] {
  return readings.filter((reading) => reading.vaultState === "SEALED");
}

export function roundEventScanStart(commitBlock: bigint): bigint {
  if (commitBlock <= 0n) throw new Error("轮次提交块必须为正数");
  return commitBlock;
}

/** 现场时间只取链上区块时间，禁止用服务器生成快照的当前时钟冒充发生时间。 */
export function blockTimestampIso(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1_000).toISOString();
}

/** 小批量并发读取，避免卦历增长后一次把公共 RPC 打满。 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("RPC 并发上限必须是正整数");
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

/** 卦历优先使用已经落盘的完整 1000 回合报告；不会在页面请求期间重新跑回放。 */
export function selectReplayReportName(names: readonly string[]): string {
  if (names.includes("deepseek-walk-forward-1000.json")) return "deepseek-walk-forward-1000.json";
  const fallback = names
    .filter((name) => name.endsWith(".json") && name.includes("walk-forward") && !name.includes("calibration"))
    .sort()
    .at(-1);
  if (!fallback) throw new Error("未找到可展示的 walk-forward 回放报告");
  return fallback;
}

export function buildBacktestHistory(
  report: Pick<ReplayReport, "modelId" | "rounds">,
  divinerNames: Readonly<Record<string, string>>,
): OracleHistoryRound[] {
  return report.rounds.map((round) => {
    if (!round.hexagram || typeof round.outcome !== "boolean") {
      throw new Error(`回放 #${round.replayId} 缺少卦象或结算结果`);
    }
    const occurredAt = round.resolution.timestamp
      ? new Date(Number(round.resolution.timestamp) * 1_000).toISOString()
      : "";
    return {
      id: `backtest-${round.replayId}`,
      source: "backtested",
      sourceLabel: "天层・历史数据回放・1000 回合 backtested・非现场",
      resolutionTier: "heaven",
      provider: report.modelId,
      question: round.proposition?.statement ?? "回放报告未保存命题明文",
      statement: round.proposition?.statement ?? "回放报告未保存命题明文",
      occurredAt,
      cutoffBlock: round.cutoff.blockNumber,
      deadlineBlock: round.resolution.blockNumber,
      outcome: round.outcome,
      state: "已结算",
      lines: createLineViews(round.hexagram.lines),
      primary: {
        number: round.hexagram.primaryKingWenNumber,
        name: getHexagramText(round.hexagram.primaryKingWenNumber).name,
      },
      derived: {
        number: round.hexagram.derivedKingWenNumber,
        name: getHexagramText(round.hexagram.derivedKingWenNumber).name,
      },
      predictions: round.predictions.map((prediction) => ({
        divinerKey: prediction.divinerKey,
        divinerName: divinerNames[prediction.divinerKey] ?? prediction.divinerKey,
        probabilityBps: prediction.probabilityBps ?? 0,
        direction: prediction.direction ?? (Number(prediction.probabilityBps ?? 0) >= 5_000 ? "YES" : "NO"),
        settlementDeltaUsdc6: prediction.settlementDeltaUsdc6 ?? null,
        brier: prediction.brier === undefined ? null : Number(prediction.brier) / 100_000_000,
        reasoning: prediction.reasoning ?? null,
      })),
    };
  });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function readVerifiedGrave(
  client: PublicClient,
  input: {
    key: string;
    name: string;
    address: Address;
    agentId: string | null;
    vaultAddress: Address;
    divinationRegistry: Address;
    predictionBook: Address;
    scoreBook: Address;
  },
): Promise<GraveSnapshot | null> {
  const [vaultStateRaw, assets, historyCount] = await Promise.all([
    client.readContract({ address: input.vaultAddress, abi: divinerVaultAbi, functionName: "state" }),
    client.readContract({ address: input.vaultAddress, abi: divinerVaultAbi, functionName: "totalAssets" }),
    client.readContract({ address: input.scoreBook, abi: scoreBookAbi, functionName: "historyCount", args: [input.address] }),
  ]);
  const vaultState = Number(vaultStateRaw) === 1 ? "SEALED" as const : "ACTIVE" as const;
  if (vaultState !== "SEALED" || historyCount === 0n) return null;

  const entry = await client.readContract({
    address: input.scoreBook,
    abi: scoreBookAbi,
    functionName: "getHistory",
    args: [input.address, historyCount - 1n],
  }) as ScoreEntryTuple;
  const round = await client.readContract({
    address: input.divinationRegistry,
    abi: divinationRegistryAbi,
    functionName: "getRound",
    args: [entry.roundId],
  }) as RoundTuple;
  const [primaryNumberRaw, derivedNumberRaw] = await Promise.all([
    client.readContract({
      address: input.divinationRegistry,
      abi: divinationRegistryAbi,
      functionName: "kingWenNumber",
      args: [round.primaryHex],
    }),
    client.readContract({
      address: input.divinationRegistry,
      abi: divinationRegistryAbi,
      functionName: "kingWenNumber",
      args: [round.derivedHex],
    }),
  ]);
  const primaryNumber = Number(primaryNumberRaw);
  const derivedNumber = Number(derivedNumberRaw);
  return buildVerifiedGrave({
    key: input.key,
    name: input.name,
    address: input.address,
    agentId: input.agentId,
    vaultAddress: input.vaultAddress,
    vaultState,
    vaultAssetsUsdc6: assets.toString(),
    historyCount: Number(historyCount),
    lastLiveEntry: {
      roundId: entry.roundId.toString(),
      probabilityBps: entry.probabilityBps,
      brier: Number(entry.brier) / 100_000_000,
      unresolved: entry.unresolved,
      primary: { number: primaryNumber, name: getHexagramText(primaryNumber).name },
      derived: { number: derivedNumber, name: getHexagramText(derivedNumber).name },
    },
    contracts: {
      divinationRegistry: input.divinationRegistry,
      predictionBook: input.predictionBook,
      scoreBook: input.scoreBook,
    },
  });
}

async function readSealDemoGrave(
  rootDir: string,
  client: PublicClient,
  expectedChainId: number,
): Promise<GraveSnapshot | null> {
  let deployment: SealDemoDeploymentFile;
  try {
    deployment = await loadJson<SealDemoDeploymentFile>(resolve(rootDir, "deployments/arc-testnet-seal-demo.json"));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  if (deployment.network.chainId !== expectedChainId) throw new Error("封存演示清单 Chain ID 与主部署不一致");
  const required = ["DivinationRegistry", "PredictionBook", "ScoreBook", "DivinerVault"] as const;
  for (const name of required) {
    if (!deployment.contracts[name]?.address) throw new Error(`封存演示清单缺少 ${name}`);
  }
  return readVerifiedGrave(client, {
    key: deployment.profile.key,
    name: deployment.profile.name,
    address: getAddress(deployment.accounts.diviner),
    agentId: deployment.agent?.agentId ?? null,
    vaultAddress: getAddress(deployment.contracts.DivinerVault!.address),
    divinationRegistry: getAddress(deployment.contracts.DivinationRegistry!.address),
    predictionBook: getAddress(deployment.contracts.PredictionBook!.address),
    scoreBook: getAddress(deployment.contracts.ScoreBook!.address),
  });
}

async function loadReplayReport(rootDir: string, deployment: DeploymentFile): Promise<{ path: string; report: ReplayReport }> {
  void deployment;
  const names = await readdir(resolve(rootDir, "reports"));
  const path = `reports/${selectReplayReportName(names)}`;
  return { path, report: await loadJson<ReplayReport>(resolve(rootDir, path)) };
}

async function loadMatchingAudit(
  rootDir: string,
  predictionBook: string,
  roundId: string,
): Promise<AuditContext | null> {
  const directory = resolve(rootDir, "reports/agent-run-journal");
  const names = (await readdir(directory)).filter((name) => name.endsWith(".jsonl"));
  for (const name of names) {
    const text = await readFile(resolve(directory, name), "utf8");
    const records = text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown);
    const context = extractAuditContext(records, predictionBook, roundId);
    if (context) return context;
  }
  return null;
}

async function readLiveHistoryRound(input: {
  client: PublicClient;
  rootDir: string;
  deployment: DeploymentFile;
  registryAddress: Address;
  predictionBookAddress: Address;
  roundId: bigint;
  round: RoundTuple;
  question: string;
  predictionIds: readonly bigint[];
  settlements: ReadonlyMap<string, { outcome: boolean; delta: bigint }>;
  scoreEntries: ReadonlyMap<string, readonly ScoreEntryTuple[]>;
}): Promise<OracleHistoryRound> {
  const [primaryRaw, derivedRaw, commitBlock] = await Promise.all([
    input.client.readContract({
      address: input.registryAddress,
      abi: divinationRegistryAbi,
      functionName: "kingWenNumber",
      args: [input.round.primaryHex],
    }),
    input.client.readContract({
      address: input.registryAddress,
      abi: divinationRegistryAbi,
      functionName: "kingWenNumber",
      args: [input.round.derivedHex],
    }),
    input.client.getBlock({ blockNumber: input.round.commitBlock }),
  ]);
  const audit = await loadMatchingAudit(input.rootDir, input.predictionBookAddress, input.roundId.toString());
  const loadedPredictions = await mapWithConcurrency(input.predictionIds, 3, async (predictionId) => {
    const prediction = await input.client.readContract({
      address: input.predictionBookAddress,
      abi: predictionBookAbi,
      functionName: "getPrediction",
      args: [predictionId],
    }) as PredictionTuple;
    const profile = input.deployment.accounts.diviners.find(
      (diviner) => diviner.address.toLowerCase() === prediction.diviner.toLowerCase(),
    );
    const key = profile?.key ?? prediction.diviner;
    const auditReading = profile ? audit?.readings[profile.key] : undefined;
    const scoreEntry = input.scoreEntries.get(key)?.find((entry) => entry.predictionId === predictionId);
    const settlement = input.settlements.get(predictionId.toString());
    return {
      deadline: prediction.deadline.toString(),
      outcome: settlement?.outcome ?? (scoreEntry && !scoreEntry.unresolved ? scoreEntry.outcome : null),
      history: {
        divinerKey: key,
        divinerName: profile?.name ?? prediction.diviner,
        probabilityBps: prediction.probabilityBps,
        direction: prediction.direction ? "YES" as const : "NO" as const,
        settlementDeltaUsdc6: settlement?.delta.toString() ?? null,
        brier: scoreEntry ? Number(scoreEntry.brier) / 100_000_000 : null,
        reasoning: auditReading?.probabilityBps === prediction.probabilityBps ? auditReading.reasoning : null,
      },
    };
  });
  const primaryNumber = Number(primaryRaw);
  const derivedNumber = Number(derivedRaw);
  return {
    id: `live-${input.roundId}`,
    source: "live",
    sourceLabel: liveSourceLabel(audit?.resolutionTier ?? "heaven", input.round.state),
    resolutionTier: audit?.resolutionTier ?? "heaven",
    provider: audit?.provider ?? "链上承诺",
    question: input.question,
    statement: audit?.statement || "链上未保存命题明文",
    occurredAt: blockTimestampIso(commitBlock.timestamp),
    cutoffBlock: input.round.commitBlock.toString(),
    deadlineBlock: loadedPredictions[0]?.deadline ?? input.round.revealDeadline.toString(),
    outcome: loadedPredictions.find((prediction) => prediction.outcome !== null)?.outcome ?? null,
    state: ROUND_STATES[input.round.state] ?? `未知状态 ${input.round.state}`,
    lines: createLineViews(input.round.lines),
    primary: { number: primaryNumber, name: getHexagramText(primaryNumber).name },
    derived: { number: derivedNumber, name: getHexagramText(derivedNumber).name },
    predictions: loadedPredictions.map((prediction) => prediction.history),
  };
}

function mapAgentId(deployment: DeploymentFile, address: Address): string | null {
  return deployment.agents?.find((agent) => agent.address.toLowerCase() === address.toLowerCase())?.agentId ?? null;
}

/**
 * 只创建 public client。此路径没有 wallet client，也不会读取或接收私钥。
 */
export async function readOracleSnapshot(rootDir = process.cwd()): Promise<OracleSnapshot> {
  const deploymentPath = resolve(rootDir, "deployments/arc-testnet.json");
  const deployment = await loadJson<DeploymentFile>(deploymentPath);
  const registryAddress = getAddress(deployment.contracts.DivinationRegistry!.address);
  const predictionBookAddress = getAddress(deployment.contracts.PredictionBook!.address);
  const scoreBookAddress = getAddress(deployment.contracts.ScoreBook!.address);
  const client = createPublicClient({ transport: http(deployment.network.rpcUrl) });

  const [latestBlock, nextRoundId] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({ address: registryAddress, abi: divinationRegistryAbi, functionName: "nextRoundId" }),
  ]);
  if (nextRoundId === 0n) throw new Error("链上尚无可展示的起卦轮次");
  let roundId: bigint | null = null;
  let round: RoundTuple | null = null;
  const displayableRounds: Array<{ roundId: bigint; round: RoundTuple }> = [];
  for (let candidate = nextRoundId - 1n; candidate >= 0n; candidate -= 1n) {
    const candidateRound = await client.readContract({
      address: registryAddress,
      abi: divinationRegistryAbi,
      functionName: "getRound",
      args: [candidate],
    }) as RoundTuple;
    if (isDisplayableRoundState(candidateRound.state)) {
      displayableRounds.push({ roundId: candidate, round: candidateRound });
      if (roundId === null) {
        roundId = candidate;
        round = candidateRound;
      }
    }
    if (candidate === 0n) break;
  }
  if (roundId === null || round === null) throw new Error("链上尚无已揭示且可展示的起卦轮次");
  const earliestDisplayable = displayableRounds.at(-1)!;
  const historyEventScanStart = roundEventScanStart(earliestDisplayable.round.commitBlock);
  const revealEvents = await scanLogsInBlockWindows({
    fromBlock: historyEventScanStart,
    toBlock: latestBlock,
    fetchLogs: ({ fromBlock, toBlock }) => client.getContractEvents({
      address: registryAddress,
      abi: divinationRegistryAbi,
      eventName: "Revealed",
      fromBlock,
      toBlock,
      strict: true,
    }),
  });
  const predictionEvents = await scanLogsInBlockWindows({
    fromBlock: historyEventScanStart,
    toBlock: latestBlock,
    fetchLogs: ({ fromBlock, toBlock }) => client.getContractEvents({
      address: predictionBookAddress,
      abi: predictionBookAbi,
      eventName: "PredictionSubmitted",
      fromBlock,
      toBlock,
      strict: true,
    }),
  });
  const settlementEvents = await scanLogsInBlockWindows({
    fromBlock: historyEventScanStart,
    toBlock: latestBlock,
    fetchLogs: ({ fromBlock, toBlock }) => client.getContractEvents({
      address: predictionBookAddress,
      abi: predictionBookAbi,
      eventName: "PredictionSettled",
      fromBlock,
      toBlock,
      strict: true,
    }),
  });
  const questionsByRound = new Map<string, string>();
  for (const event of revealEvents) {
    if (event.args.roundId !== undefined && event.args.question !== undefined) {
      questionsByRound.set(event.args.roundId.toString(), event.args.question);
    }
  }
  const predictionIdsByRound = new Map<string, bigint[]>();
  for (const event of predictionEvents) {
    if (event.args.roundId === undefined || event.args.predictionId === undefined) continue;
    const key = event.args.roundId.toString();
    const ids = predictionIdsByRound.get(key) ?? [];
    ids.push(event.args.predictionId);
    predictionIdsByRound.set(key, ids);
  }
  const settlements = new Map<string, { outcome: boolean; delta: bigint }>();
  for (const event of settlementEvents) {
    if (event.args.predictionId !== undefined && event.args.outcome !== undefined && event.args.delta !== undefined) {
      settlements.set(event.args.predictionId.toString(), { outcome: event.args.outcome, delta: event.args.delta });
    }
  }

  const [primaryNumberRaw, derivedNumberRaw, currentCommitBlock] = await Promise.all([
    client.readContract({
      address: registryAddress,
      abi: divinationRegistryAbi,
      functionName: "kingWenNumber",
      args: [round.primaryHex],
    }),
    client.readContract({
      address: registryAddress,
      abi: divinationRegistryAbi,
      functionName: "kingWenNumber",
      args: [round.derivedHex],
    }),
    client.getBlock({ blockNumber: round.commitBlock }),
  ]);

  const primaryNumber = Number(primaryNumberRaw);
  const derivedNumber = Number(derivedNumberRaw);
  const primaryText = getHexagramText(primaryNumber);
  const derivedText = getHexagramText(derivedNumber);
  const question = questionsByRound.get(roundId.toString()) ?? "链上 Revealed 事件未返回问题明文";
  const audit = await loadMatchingAudit(rootDir, predictionBookAddress, roundId.toString());

  const predictions = await mapWithConcurrency(predictionIdsByRound.get(roundId.toString()) ?? [], 3, async (predictionId) => {
    const [prediction, state] = await Promise.all([
      client.readContract({
        address: predictionBookAddress,
        abi: predictionBookAbi,
        functionName: "getPrediction",
        args: [predictionId],
      }) as Promise<PredictionTuple>,
      client.readContract({
        address: predictionBookAddress,
        abi: predictionBookAbi,
        functionName: "stateOf",
        args: [predictionId],
      }),
    ]);
    const profile = deployment.accounts.diviners.find(
      (diviner) => diviner.address.toLowerCase() === prediction.diviner.toLowerCase(),
    );
    const reading = profile ? audit?.readings[profile.key] : undefined;
    const reasoningMatchesChain = reading?.probabilityBps === prediction.probabilityBps;
    const settlement = settlements.get(predictionId.toString());
    return {
      id: predictionId.toString(),
      divinerKey: profile?.key ?? prediction.diviner,
      divinerName: profile?.name ?? prediction.diviner,
      direction: prediction.direction ? "YES" as const : "NO" as const,
      probabilityBps: prediction.probabilityBps,
      multiplier: prediction.multiplier,
      reservedUsdc6: prediction.reserved.toString(),
      deadline: prediction.deadline.toString(),
      state: PREDICTION_STATES[Number(state)] ?? `未知状态 ${state}`,
      outcome: settlement?.outcome ?? null,
      settlementDeltaUsdc6: settlement?.delta.toString() ?? null,
      reasoning: reasoningMatchesChain ? reading.reasoning : null,
      reasoningSource: reasoningMatchesChain ? "audit-journal" as const : "unavailable" as const,
      modelId: prediction.modelId,
      promptHash: prediction.promptHash,
      schemaHash: prediction.schemaHash,
      providerConfigHash: prediction.providerConfigHash,
      attemptCount: prediction.attemptCount,
    };
  });

  const { path: replayPath, report } = await loadReplayReport(rootDir, deployment);
  const liveScoreEntries = new Map<string, ScoreEntryTuple[]>();
  const diviners = await Promise.all(deployment.accounts.diviners.map(async (profile): Promise<DivinerSnapshot> => {
    const address = getAddress(profile.address);
    const vaultAddress = getAddress(deployment.contracts[`DivinerVault_${profile.key}`]!.address);
    const [liveStatsRaw, liveWilsonRaw, liveBrierSkillRaw, historyCount, backtestStatsRaw, backtestWilsonRaw, backtestBrierSkillRaw, assets, available, vaultStateRaw] =
      await Promise.all([
        client.readContract({ address: scoreBookAddress, abi: scoreBookAbi, functionName: "getStats", args: [address] }),
        client.readContract({ address: scoreBookAddress, abi: scoreBookAbi, functionName: "wilson95", args: [address] }),
        client.readContract({ address: scoreBookAddress, abi: scoreBookAbi, functionName: "brierSkill", args: [address] })
          .then((value) => value as readonly [number, bigint, bigint, boolean])
          .catch(() => null),
        client.readContract({ address: scoreBookAddress, abi: scoreBookAbi, functionName: "historyCount", args: [address] }),
        client.readContract({ address: scoreBookAddress, abi: scoreBookAbi, functionName: "getBacktestStats", args: [address] }),
        client.readContract({ address: scoreBookAddress, abi: scoreBookAbi, functionName: "backtestWilson95", args: [address] }),
        client.readContract({ address: scoreBookAddress, abi: scoreBookAbi, functionName: "backtestBrierSkill", args: [address] })
          .then((value) => value as readonly [number, bigint, bigint, boolean])
          .catch(() => null),
        client.readContract({ address: vaultAddress, abi: divinerVaultAbi, functionName: "totalAssets" }),
        client.readContract({ address: vaultAddress, abi: divinerVaultAbi, functionName: "availableBalance" }),
        client.readContract({ address: vaultAddress, abi: divinerVaultAbi, functionName: "state" }),
      ]);
    const liveStats = liveStatsRaw as StatsTuple;
    const liveBrierSkill = liveBrierSkillRaw as readonly [number, bigint, bigint, boolean] | null;
    const backtestStats = backtestStatsRaw as StatsTuple;
    const liveWilson = liveWilsonRaw.map(Number) as [number, number];
    const backtestWilson = backtestWilsonRaw.map(Number) as [number, number];
    const vaultState = Number(vaultStateRaw) === 1 ? "SEALED" as const : "ACTIVE" as const;
    const reportSummary = normalizeReportSummary(report, profile.key);
    if (historyCount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${profile.name} 的现场历史数量超过前端安全范围`);
    const historyIndexes = Array.from({ length: Number(historyCount) }, (_, index) => index);
    const allLiveEntries = await mapWithConcurrency(historyIndexes, 4, async (index) => client.readContract({
        address: scoreBookAddress,
        abi: scoreBookAbi,
        functionName: "getHistory",
        args: [address, BigInt(index)],
      }) as Promise<ScoreEntryTuple>);
    liveScoreEntries.set(profile.key, allLiveEntries);
    let lastLiveEntry: DivinerSnapshot["lastLiveEntry"] = null;
    const entry = allLiveEntries.at(-1);
    if (entry) {
      lastLiveEntry = {
        predictionId: entry.predictionId.toString(),
        roundId: entry.roundId.toString(),
        probabilityBps: entry.probabilityBps,
        brier: Number(entry.brier) / 100_000_000,
        outcome: entry.outcome,
        correct: entry.correct,
        unresolved: entry.unresolved,
      };
    }
    const chainBacktest = {
      sampleCount: backtestStats.sampleCount,
      correctCount: backtestStats.correctCount,
      totalBrier: backtestStats.totalBrier,
      wilson95: backtestWilson,
      brierSkill: backtestBrierSkillRaw,
    } as const;
    return {
      key: profile.key,
      name: profile.name,
      address,
      agentId: mapAgentId(deployment, address),
      vaultAddress,
      vaultState,
      vaultAssetsUsdc6: assets.toString(),
      vaultAvailableUsdc6: available.toString(),
      liveStats: buildLiveScore(liveStats, liveWilson, liveBrierSkill),
      lastLiveEntry,
      backtest: {
        sampleCount: reportSummary.sampleCount,
        correctCount: reportSummary.correctCount,
        averageBrier: reportSummary.averageBrier,
        brierSkillScore: reportSummary.brierSkillScore,
        brierVsConstantPValue: reportSummary.brierVsConstantPValue,
        empiricalBaseRateBps: reportSummary.empiricalBaseRateBps,
        constantBaselineBrier: reportSummary.constantBaselineBrier,
        wilson95: [reportSummary.wilson95.lowerBps, reportSummary.wilson95.upperBps],
        chainVerified: verifyBacktestSummary(reportSummary, chainBacktest),
        signal: interpretBacktestSignal(reportSummary.brierSkillScore, reportSummary.brierVsConstantPValue),
        finalBankrollUsdc6: reportSummary.finalBankrollUsdc6 ?? "0",
      },
    };
  }));

  const firstRound = report.rounds[0];
  const lastRound = report.rounds.at(-1);
  if (!firstRound || !lastRound) throw new Error("回放报告没有逐轮数据");
  const mainGraves = (await Promise.all(diviners.map((diviner) => readVerifiedGrave(client, {
    key: diviner.key,
    name: diviner.name,
    address: diviner.address,
    agentId: diviner.agentId,
    vaultAddress: diviner.vaultAddress,
    divinationRegistry: registryAddress,
    predictionBook: predictionBookAddress,
    scoreBook: scoreBookAddress,
  })))).filter((grave): grave is GraveSnapshot => grave !== null);
  const sealDemoGrave = await readSealDemoGrave(rootDir, client, deployment.network.chainId);
  const divinerNames = Object.fromEntries(deployment.accounts.diviners.map((profile) => [profile.key, profile.name]));
  const backtestHistory = buildBacktestHistory(report, divinerNames);
  const settledOutcome = predictions.find((prediction) => prediction.outcome !== null)?.outcome ?? null;
  const currentLiveHistory: OracleHistoryRound = {
    id: `live-${roundId}`,
    source: "live",
    sourceLabel: liveSourceLabel(audit?.resolutionTier ?? "heaven", round.state),
    resolutionTier: audit?.resolutionTier ?? "heaven",
    provider: audit?.provider ?? "链上承诺",
    question,
    statement: audit?.statement || "链上未保存命题明文",
    occurredAt: blockTimestampIso(currentCommitBlock.timestamp),
    cutoffBlock: round.commitBlock.toString(),
    deadlineBlock: predictions[0]?.deadline ?? round.revealDeadline.toString(),
    outcome: settledOutcome,
    state: ROUND_STATES[round.state] ?? `未知状态 ${round.state}`,
    lines: createLineViews(round.lines),
    primary: { number: primaryNumber, name: primaryText.name },
    derived: { number: derivedNumber, name: derivedText.name },
    predictions: predictions.map((prediction) => {
      const entry = liveScoreEntries.get(prediction.divinerKey)?.find((candidate) => candidate.predictionId.toString() === prediction.id);
      return {
        divinerKey: prediction.divinerKey,
        divinerName: prediction.divinerName,
        probabilityBps: prediction.probabilityBps,
        direction: prediction.direction,
        settlementDeltaUsdc6: prediction.settlementDeltaUsdc6,
        brier: entry ? Number(entry.brier) / 100_000_000 : null,
        reasoning: prediction.reasoning,
      };
    }),
  };
  const olderLiveHistory = await mapWithConcurrency(displayableRounds.slice(1), 2, async (candidate) => readLiveHistoryRound({
    client,
    rootDir,
    deployment,
    registryAddress,
    predictionBookAddress,
    roundId: candidate.roundId,
    round: candidate.round,
    question: questionsByRound.get(candidate.roundId.toString()) ?? "链上 Revealed 事件未返回问题明文",
    predictionIds: predictionIdsByRound.get(candidate.roundId.toString()) ?? [],
    settlements,
    scoreEntries: liveScoreEntries,
  }));
  const liveHistory = [currentLiveHistory, ...olderLiveHistory];

  return {
    generatedAt: new Date().toISOString(),
    chain: {
      name: deployment.network.name,
      chainId: deployment.network.chainId,
      latestBlock: latestBlock.toString(),
      status: "LIVE",
    },
    contracts: {
      divinationRegistry: registryAddress,
      predictionBook: predictionBookAddress,
      scoreBook: scoreBookAddress,
    },
    round: {
      id: roundId.toString(),
      question,
      statement: audit?.statement || "审计日志中没有可用的命题明文",
      state: ROUND_STATES[round.state] ?? `未知状态 ${round.state}`,
      commitBlock: round.commitBlock.toString(),
      revealDeadline: round.revealDeadline.toString(),
      feeUsdc6: round.fee.toString(),
      bondUsdc6: round.bond.toString(),
      lines: createLineViews(round.lines),
      primary: { number: primaryNumber, name: primaryText.name, judgement: primaryText.judgement },
      derived: { number: derivedNumber, name: derivedText.name, judgement: derivedText.judgement },
    },
    predictions,
    diviners,
    backtest: {
      tag: "backtested",
      provider: report.modelId,
      sampleCount: report.sampleCount,
      cutoffBlock: firstRound.cutoff.blockNumber,
      resolutionBlock: lastRound.resolution.blockNumber,
      curves: buildBankrollSeries(report.rounds),
      source: replayPath,
    },
    history: {
      live: liveHistory,
      backtested: backtestHistory,
      source: replayPath,
    },
    graves: [...mainGraves, ...(sealDemoGrave ? [sealDemoGrave] : [])],
    disclosures: {
      heaven: "天层谓词读取 H 之后首次允许结算时观察到的值；不是 H 时刻的历史快照。",
      human: "人层结果依赖白名单人类 attestor；ERC-8004 记录请求与响应，不让事实本身变得 trustless。",
      inference: "LLM 推理由项目方服务器集中调用；当前默认使用真实 DeepSeek，确定性 mock provider 保留为零成本排练选项。",
      leap: "从卦辞到可证伪命题的推导包含解释跳跃；系统主动展示并让它承担可计量成本。",
      replay: "回放数据标记为 backtested，是非现场历史；它验证机制与前视偏差防护，不证明预测能力。",
      risk: "身銭倍率随 Brier 恶化而收缩，表示风险管理在生效，不表示易者预测能力正在提升。",
    },
  };
}
