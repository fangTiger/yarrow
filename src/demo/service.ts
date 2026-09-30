import { isAddress, type Address, type Hex } from "viem";

export type DemoMode = "mock" | "live";
export type DemoPhase =
  | "committing"
  | "waiting-reveal"
  | "revealing"
  | "revealed"
  | "compiling"
  | "predicting"
  | "predicted"
  | "waiting-settlement"
  | "settling"
  | "settled"
  | "failed";

export type DemoStageKey =
  | "commit"
  | "reveal-wait"
  | "reveal"
  | "inference"
  | "predictions"
  | "outcome-wait"
  | "settlement";

export interface DemoStageTiming {
  key: DemoStageKey;
  label: string;
  estimatedMilliseconds: number;
  actualMilliseconds: number | null;
}

export interface DemoTransaction {
  kind: "recovery" | "funding" | "approval" | "reading-fee" | "commit" | "reveal" | "attestation" | "prediction" | "fee-distribution" | "settlement";
  label: string;
  hash: Hex;
  blockNumber: string;
  gasCostUsdc6: string;
  amountUsdc6?: string;
}

export interface DemoHexagram {
  lines: readonly number[];
  primaryKingWenNumber: number;
  primaryName: string;
  derivedKingWenNumber: number;
  derivedName: string;
  changingLinePositions: readonly number[];
}

export interface DemoCalibration {
  method: string;
  sampleCount: number;
  yesCount: number;
  empiricalBaseRateBps: number;
  historyStartBlock: string;
  historyEndBlock: string;
  horizonBlocks: string;
}

export interface DemoProposition {
  statement: string;
  predicateId: Hex;
  params: Hex;
  deadlineBlock: string;
  calibration: DemoCalibration;
  resolution?: DemoResolution;
}

export interface DemoResolution {
  tier: "human";
  method: "attested" | "mutual";
  witness: "querent";
  horizon: "short" | "long";
  status: "awaiting-witness" | "attested" | "unresolved";
}

export interface DemoPrediction {
  id: string;
  divinerKey: string;
  divinerName: string;
  probabilityBps: number;
  direction: "YES" | "NO";
  multiplier: number;
  reasoning: string;
  transaction: DemoTransaction;
}

export interface DemoVaultChange {
  divinerKey: string;
  beforeUsdc6: string;
  afterUsdc6: string;
  deltaUsdc6: string;
}

export interface DemoProviderSummary {
  kind: DemoMode;
  modelId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    promptCacheHitTokens: number;
    promptCacheMissTokens: number;
  };
  estimatedCostUsd?: number;
}

export interface DemoSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  mode: DemoMode;
  track: "wager";
  horizon: "short" | "long";
  phase: DemoPhase;
  question: string;
  walletAddress: Address;
  roundId: string | null;
  hexagram: DemoHexagram | null;
  proposition: DemoProposition | null;
  predictions: DemoPrediction[];
  transactions: DemoTransaction[];
  vaultChanges: DemoVaultChange[];
  outcome: boolean | null;
  unresolved: boolean;
  provider: DemoProviderSummary | null;
  error: string | null;
  timings: DemoStageTiming[];
}

export interface DemoProgress {
  phase?: DemoPhase;
  transaction?: DemoTransaction;
  prediction?: DemoPrediction;
  proposition?: DemoProposition;
  timing?: Pick<DemoStageTiming, "key" | "actualMilliseconds">;
}

export interface DemoRoundPreparation {
  chainId: number;
  roundId: string;
  commitment: Hex;
  registry: Address;
  predictionBook: Address;
  usdcToken: Address;
  feeUsdc6: string;
  bondUsdc6: string;
  waitBlocks: string;
  approvalAmountUsdc6: string;
  approvalRoundCount: number;
}

/** 只存在于 Node 进程内；不得序列化到任何浏览器响应。 */
export interface DemoRoundSecret {
  salt: Hex;
}

export interface DemoPreparedRound {
  preparation: DemoRoundPreparation;
  secret: DemoRoundSecret;
}

export interface DemoPrepareResponse {
  session: DemoSession;
  preparation: DemoRoundPreparation;
  previousRecovery?: DemoRecoveryNotice;
}

export interface DemoRoundConfirmation {
  approvalHash?: Hex | null;
  commitHash: Hex;
  commitDurationMilliseconds?: number;
}

export interface DemoRoundResult {
  roundId: string;
  hexagram: DemoHexagram;
  transactions?: readonly DemoTransaction[];
}

export interface DemoPredictionResult {
  proposition: DemoProposition;
  predictions?: readonly DemoPrediction[];
  transactions?: readonly DemoTransaction[];
  provider: DemoProviderSummary;
}

export interface DemoSettlementResult {
  transactions?: readonly DemoTransaction[];
  vaultChanges: readonly DemoVaultChange[];
  outcome: boolean | null;
  unresolved?: boolean;
}

export interface DemoWitnessInput {
  outcomeWaitDurationMilliseconds?: unknown;
  querentOutcome?: unknown;
  counterpartyOutcome?: unknown;
}

export interface DemoDriver {
  prepareRound(input: { question: string; mode: DemoMode; querent: Address }): Promise<DemoPreparedRound>;
  confirmRound(
    session: DemoSession,
    preparation: DemoRoundPreparation,
    secret: DemoRoundSecret,
    input: DemoRoundConfirmation,
    progress: (update: DemoProgress) => void,
  ): Promise<DemoRoundResult>;
  createPredictions(session: DemoSession, progress: (update: DemoProgress) => void): Promise<DemoPredictionResult>;
  settleRound(
    session: DemoSession,
    progress: (update: DemoProgress) => void,
    input?: DemoWitnessInput,
  ): Promise<DemoSettlementResult>;
}

export interface DemoRecoveryNotice {
  roundId: string | null;
  fundsStatus: "none" | "locked";
  amountUsdc6: string;
  command: string | null;
  message: string;
}

export interface DemoAbandonResponse {
  session: null;
  recovery: DemoRecoveryNotice;
}

export interface DemoStartInput {
  question?: unknown;
  mode?: unknown;
  confirmLive?: unknown;
  walletAddress?: unknown;
  confirmedTrack?: unknown;
  horizon?: unknown;
}

export interface DemoActionServiceOptions {
  now?: () => Date;
}

function publicError(error: unknown): string {
  return error instanceof Error ? error.message : "演示操作失败";
}

function uniqueTransactions(current: readonly DemoTransaction[], additions: readonly DemoTransaction[]): DemoTransaction[] {
  const byHash = new Map(current.map((item) => [item.hash.toLowerCase(), item]));
  for (const item of additions) byHash.set(item.hash.toLowerCase(), item);
  return [...byHash.values()];
}

function uniquePredictions(current: readonly DemoPrediction[], additions: readonly DemoPrediction[]): DemoPrediction[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of additions) byId.set(item.id, item);
  return [...byId.values()];
}

function predictionFailureMessage(error: unknown, completedCount: number): string {
  const retained = completedCount > 0
    ? `已保留 ${completedCount} 家成功结果，不会重复提交；`
    : "尚未成功提交任何预测；";
  return `三家应卦暂时中断：${publicError(error)}。${retained}页面将自动重试。`;
}

function requireHash(value: unknown, label: string): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label}必须是有效交易哈希`);
  return value as Hex;
}

const STAGE_LABELS: Record<DemoStageKey, string> = {
  commit: "立誓",
  "reveal-wait": "等待 N 块",
  reveal: "服务端揭示",
  inference: "三家推理",
  predictions: "三笔预测",
  "outcome-wait": "等待应验",
  settlement: "三笔结算",
};

/** UI 估时只用于解释等待，不参与链上安全判定。 */
export function demoStageTimings(mode: DemoMode): DemoStageTiming[] {
  const estimates: Record<DemoStageKey, number> = {
    commit: 3_000,
    "reveal-wait": 4_590,
    reveal: 1_500,
    inference: mode === "live" ? 20_000 : 800,
    predictions: 4_500,
    "outcome-wait": 30_600,
    settlement: 4_500,
  };
  return (Object.keys(STAGE_LABELS) as DemoStageKey[]).map((key) => ({
    key,
    label: STAGE_LABELS[key],
    estimatedMilliseconds: estimates[key],
    actualMilliseconds: null,
  }));
}

function recoveryNotice(session: DemoSession | null): DemoRecoveryNotice {
  const committed = session?.transactions.some((item) => item.kind === "commit") ?? false;
  if (!session?.roundId || !committed || session.phase === "settled") {
    return {
      roundId: session?.roundId ?? null,
      fundsStatus: "none",
      amountUsdc6: "0",
      command: null,
      message: "本轮没有已确认的链上托管，已可直接开始新的一卦。",
    };
  }
  const command = `npm run demo:recover -- --round-id ${session.roundId} --confirm`;
  return {
    roundId: session.roundId,
    fundsStatus: "locked",
    amountUsdc6: "550000",
    command,
    message: `旧轮 #${session.roundId} 可能仍有 0.550000 USDC 在链上托管。到期后运行 ${command}：未揭示轮次按合约罚没，已揭示但法定人数不足的轮次退回剩余托管；已满足法定人数的轮次必须继续无许可结算。`,
  };
}

/** 单进程演示状态机；钱包只提交首次授权与每轮 commit，后续链上步骤由服务端自动完成。 */
export class DemoActionService {
  private session: DemoSession | null = null;
  private preparation: DemoRoundPreparation | null = null;
  private secret: DemoRoundSecret | null = null;
  private busy = false;
  private readonly now: () => Date;

  constructor(private readonly driver: DemoDriver, options: DemoActionServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  getSession(): DemoSession | null {
    return this.session === null ? null : structuredClone(this.session);
  }

  async prepareRound(input: DemoStartInput): Promise<DemoPrepareResponse> {
    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (question.length < 4 || question.length > 280) throw new Error("问题长度必须为 4–280 个字符");
    const mode: DemoMode = input.mode === undefined ? "live" : input.mode === "mock" || input.mode === "live"
      ? input.mode
      : (() => { throw new Error("演示模式只能是 mock 或 live"); })();
    if (mode === "live" && input.confirmLive !== true) throw new Error("live 模式必须显式确认后才能启动");
    if (typeof input.walletAddress !== "string" || !isAddress(input.walletAddress, { strict: false })) {
      throw new Error("请先连接有效的钱包地址");
    }
    if (input.confirmedTrack !== undefined && input.confirmedTrack !== "wager") {
      throw new Error("链上演示只接受已确认的賭轨");
    }
    const horizon = input.horizon === "long" ? "long" : "short";
    this.requireIdle();
    const previousRecovery = this.session && this.session.phase !== "settled" ? recoveryNotice(this.session) : undefined;
    this.preparation = null;
    this.secret = null;

    const timestamp = this.now().toISOString();
    this.session = {
      id: `${timestamp}/${mode}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      mode,
      track: "wager",
      horizon,
      phase: "committing",
      question,
      walletAddress: input.walletAddress as Address,
      roundId: null,
      hexagram: null,
      proposition: null,
      predictions: [],
      transactions: [],
      vaultChanges: [],
      outcome: null,
      unresolved: false,
      provider: null,
      error: null,
      timings: demoStageTimings(mode),
    };
    return this.runExclusive(async () => {
      const prepared = await this.driver.prepareRound({ question, mode, querent: input.walletAddress as Address });
      this.preparation = prepared.preparation;
      this.secret = prepared.secret;
      this.patch({ roundId: prepared.preparation.roundId });
      return {
        session: this.requiredSession(),
        preparation: prepared.preparation,
        ...(previousRecovery ? { previousRecovery } : {}),
      };
    });
  }

  async confirmRound(input: DemoRoundConfirmation): Promise<DemoSession> {
    this.requireIdle();
    const session = this.requiredSession();
    const preparation = this.preparation;
    const secret = this.secret;
    if (!preparation || !secret || session.phase !== "committing") throw new Error("当前没有等待用户钱包确认的开卦");
    const confirmation: DemoRoundConfirmation = {
      approvalHash: input.approvalHash == null ? null : requireHash(input.approvalHash, "授权交易"),
      commitHash: requireHash(input.commitHash, "立誓交易"),
      ...(Number.isFinite(input.commitDurationMilliseconds) && Number(input.commitDurationMilliseconds) >= 0
        ? { commitDurationMilliseconds: Number(input.commitDurationMilliseconds) }
        : {}),
    };
    if (confirmation.commitDurationMilliseconds !== undefined) {
      this.recordTiming("commit", confirmation.commitDurationMilliseconds);
    }
    return this.runExclusive(async () => {
      const result = await this.driver.confirmRound(session, preparation, secret, confirmation, (update) => this.applyProgress(update));
      this.patch({
        phase: "revealed",
        roundId: result.roundId,
        hexagram: result.hexagram,
        transactions: uniqueTransactions(this.requiredSession().transactions, result.transactions ?? []),
        error: null,
      });
      this.preparation = null;
      this.secret = null;
      return this.requiredSession();
    });
  }

  async triggerPredictions(): Promise<DemoSession> {
    this.requireIdle();
    if (!this.session) throw new Error("当前尚未成卦，请先求一卦");
    const current = this.session;
    const predictionCompleted = current.predictions.length === 3
      || current.phase === "predicted"
      || current.phase === "waiting-settlement"
      || current.phase === "settling"
      || current.phase === "settled";
    if (predictionCompleted) throw new Error("本轮预测已成功完成，无需重复应卦");
    const retryable = current.phase === "revealed"
      || ((current.phase === "compiling" || current.phase === "predicting") && current.error !== null);
    if (!current.roundId || !current.hexagram || !retryable) {
      throw new Error("用户钱包尚未完成开卦，请等待钱包确认");
    }
    this.patch({ phase: "compiling", error: null });
    return this.runExclusive(async () => {
      const result = await this.driver.createPredictions(this.requiredSession(), (update) => this.applyProgress(update));
      const active = this.requiredSession();
      const predictions = uniquePredictions(active.predictions, result.predictions ?? []);
      this.patch({
        phase: "predicted",
        proposition: result.proposition,
        provider: result.provider,
        predictions,
        transactions: uniqueTransactions(
          active.transactions,
          [...(result.transactions ?? []), ...predictions.map((prediction) => prediction.transaction)],
        ),
        error: null,
      });
      return this.requiredSession();
    }, (error, active) => ({
      phase: active.predictions.length > 0 ? "predicting" : "revealed",
      error: predictionFailureMessage(error, active.predictions.length),
    }));
  }

  async settleRound(input: DemoWitnessInput = {}): Promise<DemoSession> {
    this.requireIdle();
    const current = this.requiredSession();
    if (current.phase !== "predicted") throw new Error("三家预测尚未全部上链或本轮已经结算");
    if (current.proposition?.resolution?.horizon === "long") {
      throw new Error("长周期人间事的截止尚未到达，需要等待后再由提问者见证");
    }
    if (Number.isFinite(input.outcomeWaitDurationMilliseconds) && Number(input.outcomeWaitDurationMilliseconds) >= 0) {
      this.recordTiming("outcome-wait", Number(input.outcomeWaitDurationMilliseconds));
    }
    this.patch({ phase: "waiting-settlement", error: null });
    return this.runExclusive(async () => {
      const result = await this.driver.settleRound(this.requiredSession(), (update) => this.applyProgress(update), input);
      const active = this.requiredSession();
      this.patch({
        phase: "settled",
        outcome: result.outcome,
        unresolved: result.unresolved ?? result.outcome === null,
        vaultChanges: [...result.vaultChanges],
        transactions: uniqueTransactions(active.transactions, result.transactions ?? []),
      });
      return this.requiredSession();
    });
  }

  async abandonRound(): Promise<DemoAbandonResponse> {
    this.requireIdle();
    const recovery = recoveryNotice(this.session);
    this.session = null;
    this.preparation = null;
    this.secret = null;
    return { session: null, recovery };
  }

  private requireIdle(): void {
    if (this.busy) throw new Error("已有演示操作正在执行，请等待当前步骤完成");
  }

  private requiredSession(): DemoSession {
    if (!this.session) throw new Error("尚未发起演示轮次");
    return this.session;
  }

  private patch(update: Partial<DemoSession>): void {
    const session = this.requiredSession();
    this.session = { ...session, ...update, updatedAt: this.now().toISOString() };
  }

  private applyProgress(update: DemoProgress): void {
    const session = this.requiredSession();
    const predictions = update.prediction ? uniquePredictions(session.predictions, [update.prediction]) : session.predictions;
    const newTransactions = [
      ...(update.transaction ? [update.transaction] : []),
      ...(update.prediction ? [update.prediction.transaction] : []),
    ];
    this.patch({
      ...(update.phase ? { phase: update.phase } : {}),
      ...(update.proposition ? { proposition: update.proposition } : {}),
      predictions,
      transactions: uniqueTransactions(session.transactions, newTransactions),
    });
    const timing = update.timing;
    if (timing && timing.actualMilliseconds !== null) {
      this.recordTiming(timing.key, timing.actualMilliseconds);
    }
  }

  private recordTiming(key: DemoStageKey, actualMilliseconds: number): void {
    const session = this.requiredSession();
    this.patch({
      timings: session.timings.map((item) => item.key === key
        ? { ...item, actualMilliseconds: Math.max(0, Math.round(actualMilliseconds)) }
        : item),
    });
  }

  private async runExclusive<T>(
    operation: () => Promise<T>,
    onFailure?: (error: unknown, session: DemoSession) => Partial<DemoSession>,
  ): Promise<T> {
    this.busy = true;
    try {
      return structuredClone(await operation());
    } catch (error) {
      if (this.session) this.patch(onFailure ? onFailure(error, this.session) : { phase: "failed", error: publicError(error) });
      if (onFailure && this.session?.error) throw new Error(this.session.error, { cause: error });
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
