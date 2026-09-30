import assert from "node:assert/strict";
import test from "node:test";

import {
  DemoActionService,
  type DemoDriver,
  type DemoPrediction,
  type DemoPredictionResult,
  type DemoProgress,
  type DemoRoundConfirmation,
  type DemoRoundPreparation,
  type DemoRoundSecret,
  type DemoRoundResult,
  type DemoSession,
} from "../src/demo/service.js";
import { MockDemoDriver } from "../src/demo/mock-driver.js";

const HASHES = {
  approve: `0x${"11".repeat(32)}`,
  commit: `0x${"22".repeat(32)}`,
  reveal: `0x${"33".repeat(32)}`,
  takashima: `0x${"44".repeat(32)}`,
  wuxing: `0x${"55".repeat(32)}`,
  meihua: `0x${"66".repeat(32)}`,
  settle1: `0x${"77".repeat(32)}`,
  settle2: `0x${"88".repeat(32)}`,
  settle3: `0x${"99".repeat(32)}`,
} as const;

const WALLET = "0x00000000000000000000000000000000000000A1";

function transaction(kind: DemoSession["transactions"][number]["kind"], hash: `0x${string}`, label: string) {
  return { kind, hash, label, blockNumber: "100", gasCostUsdc6: "1000" } as const;
}

function preparation(): DemoRoundPreparation {
  return {
    chainId: 5_042_002,
    roundId: "9",
    commitment: `0x${"bb".repeat(32)}`,
    registry: "0x00000000000000000000000000000000000000B1",
    predictionBook: "0x00000000000000000000000000000000000000B2",
    usdcToken: "0x3600000000000000000000000000000000000000",
    feeUsdc6: "50000",
    bondUsdc6: "500000",
    waitBlocks: "8",
    approvalAmountUsdc6: "10000000",
    approvalRoundCount: 18,
  };
}

function confirmation(): DemoRoundConfirmation {
  return { approvalHash: HASHES.approve, commitHash: HASHES.commit };
}

class DriverStub implements DemoDriver {
  readonly calls: string[] = [];

  async prepareRound(input: { question: string; mode: "mock" | "live"; querent: `0x${string}` }) {
    this.calls.push(`prepare:${input.mode}:${input.querent}:${input.question}`);
    return { preparation: preparation(), secret: { salt: `0x${"aa".repeat(32)}` as const } };
  }

  async confirmRound(
    _session: DemoSession,
    _preparation: DemoRoundPreparation,
    _secret: DemoRoundSecret,
    input: DemoRoundConfirmation,
    progress: (update: DemoProgress) => void,
  ): Promise<DemoRoundResult> {
    this.calls.push(`confirm:${input.commitHash}`);
    progress({ phase: "waiting-reveal", transaction: transaction("approval", HASHES.approve, "授权") });
    progress({ phase: "waiting-reveal", transaction: transaction("commit", HASHES.commit, "立誓") });
    return {
      roundId: "9",
      transactions: [transaction("reveal", HASHES.reveal, "开卦")],
      hexagram: {
        lines: [8, 6, 8, 9, 8, 7] as const,
        primaryKingWenNumber: 35,
        primaryName: "晋",
        derivedKingWenNumber: 4,
        derivedName: "蒙",
        changingLinePositions: [2, 4],
      },
    };
  }

  async createPredictions(_session: DemoSession, progress: (update: DemoProgress) => void): Promise<DemoPredictionResult> {
    this.calls.push("predictions");
    const predictions: DemoPrediction[] = [
      { id: "11", divinerKey: "takashima", divinerName: "高島易断", probabilityBps: 6100, direction: "YES", multiplier: 1, reasoning: "时势偏进。", transaction: transaction("prediction", HASHES.takashima, "高島提交") },
      { id: "12", divinerKey: "wuxing", divinerName: "五行易（断易）", probabilityBps: 4200, direction: "NO", multiplier: 1, reasoning: "动静偏否。", transaction: transaction("prediction", HASHES.wuxing, "五行提交") },
      { id: "13", divinerKey: "meihua", divinerName: "梅花心易", probabilityBps: 7300, direction: "YES", multiplier: 1, reasoning: "外应偏是。", transaction: transaction("prediction", HASHES.meihua, "梅花提交") },
    ];
    progress({ phase: "predicting", prediction: predictions[0]! });
    progress({ phase: "predicting", prediction: predictions[1]! });
    return {
      proposition: {
        statement: "截止块后首次观察到的 Arc USDC 总量高于固定阈值",
        predicateId: `0x${"cc".repeat(32)}`,
        params: `0x${"dd".repeat(32)}`,
        deadlineBlock: "160",
        calibration: { method: "historical-threshold-quantile-v1", sampleCount: 64, yesCount: 32, empiricalBaseRateBps: 5000, historyStartBlock: "1", historyEndBlock: "99", horizonBlocks: "61" },
      },
      predictions: [predictions[2]!],
      provider: { kind: "mock", modelId: "mock-yijing-demo-v1" },
    };
  }

  async settleRound(_session: DemoSession, progress: (update: DemoProgress) => void) {
    this.calls.push("settlement");
    progress({ phase: "settling", transaction: transaction("settlement", HASHES.settle1, "结算 #11") });
    return {
      transactions: [
        transaction("settlement", HASHES.settle2, "结算 #12"),
        transaction("settlement", HASHES.settle3, "结算 #13"),
      ],
      vaultChanges: [
        { divinerKey: "takashima", beforeUsdc6: "200000", afterUsdc6: "205000", deltaUsdc6: "5000" },
        { divinerKey: "wuxing", beforeUsdc6: "200000", afterUsdc6: "190000", deltaUsdc6: "-10000" },
        { divinerKey: "meihua", beforeUsdc6: "200000", afterUsdc6: "202000", deltaUsdc6: "2000" },
      ],
      outcome: false,
    };
  }
}

async function revealedService(driver = new DriverStub()): Promise<{ service: DemoActionService; driver: DriverStub }> {
  const service = new DemoActionService(driver, { now: () => new Date("2026-09-05T00:00:00.000Z") });
  await service.prepareRound({ question: "Arc Testnet 的 USDC 总量会增加吗？", mode: "mock", walletAddress: WALLET });
  await service.confirmRound(confirmation());
  return { service, driver };
}

test("服务只准备公开交易参数，并在用户回执确认后进入已成卦", async () => {
  const driver = new DriverStub();
  const service = new DemoActionService(driver, { now: () => new Date("2026-09-05T00:00:00.000Z") });

  const prepared = await service.prepareRound({ question: "Arc Testnet 的 USDC 总量会增加吗？", mode: "mock", walletAddress: WALLET });
  assert.equal(prepared.session.phase, "committing");
  assert.equal(prepared.session.walletAddress, WALLET);
  assert.equal(prepared.preparation.commitment, preparation().commitment);
  assert.equal("salt" in (prepared.preparation as unknown as Record<string, unknown>), false, "公开准备响应不得携带 salt");
  assert.equal("salt" in (service.getSession() as unknown as Record<string, unknown>), false, "公开轮询状态不得携带 salt");

  const round = await service.confirmRound(confirmation());
  assert.equal(round.phase, "revealed");
  assert.deepEqual(round.transactions.map(({ kind, hash }) => ({ kind, hash })), [
    { kind: "approval", hash: HASHES.approve },
    { kind: "commit", hash: HASHES.commit },
    { kind: "reveal", hash: HASHES.reveal },
  ]);
  assert.deepEqual(driver.calls, [
    `prepare:mock:${WALLET}:Arc Testnet 的 USDC 总量会增加吗？`,
    `confirm:${HASHES.commit}`,
  ]);
});

test("用户只提交 commit 回执，服务端随后自动揭示", async () => {
  const service = new DemoActionService(new DriverStub());
  await service.prepareRound({ question: "服务端会自动完成揭示吗？", mode: "mock", walletAddress: WALLET });
  const revealed = await service.confirmRound({
    approvalHash: HASHES.approve,
    commitHash: HASHES.commit,
  } as DemoRoundConfirmation);

  assert.equal(revealed.phase, "revealed");
  assert.equal(revealed.transactions.filter((item) => item.kind === "reveal").length, 1);
});

test("三家预测后由服务端自动发送三笔无许可结算", async () => {
  const { service } = await revealedService();
  await service.triggerPredictions();
  const candidate = service as DemoActionService & { settleRound?: () => Promise<DemoSession> };
  assert.equal(typeof candidate.settleRound, "function");
  const settled = await candidate.settleRound!();
  assert.equal(settled.phase, "settled");
  assert.equal(settled.transactions.filter((item) => item.kind === "settlement").length, 3);
});

test("带部分预测的错误会话不阻塞下一卦，并保留旧轮恢复提示", async () => {
  const driver = new DriverStub();
  driver.createPredictions = async (_session, progress) => {
    progress({
      phase: "predicting",
      prediction: {
        id: "11",
        divinerKey: "takashima",
        divinerName: "高島易断",
        probabilityBps: 6100,
        direction: "YES",
        multiplier: 1,
        reasoning: "已完成一份。",
        transaction: transaction("prediction", HASHES.takashima, "高島提交"),
      },
    });
    throw new Error("临时 RPC 故障");
  };
  const { service } = await revealedService(driver);
  await assert.rejects(service.triggerPredictions(), /自动重试/);

  const next = await service.prepareRound({ question: "错误后能立即重新开始吗？", mode: "mock", walletAddress: WALLET });
  assert.equal(next.session.phase, "committing");
});

test("显式弃卦入口清空活动会话并返回精确恢复命令", async () => {
  const { service } = await revealedService();
  const candidate = service as DemoActionService & {
    abandonRound?: () => Promise<{ session: null; recovery: { command: string | null; message: string } }>;
  };
  assert.equal(typeof candidate.abandonRound, "function");
  const result = await candidate.abandonRound!();
  assert.equal(result.session, null);
  assert.match(result.recovery.command ?? "", /demo:recover.*--round-id 9.*--confirm/);
  assert.match(result.recovery.message, /托管|资金/);
});

test("准备阶段拒绝无效钱包地址，且 live 仍需显式确认", async () => {
  const driver = new DriverStub();
  const service = new DemoActionService(driver);
  await assert.rejects(service.prepareRound({ question: "测试钱包地址", mode: "mock", walletAddress: "不是地址" }), /钱包地址/);
  await assert.rejects(service.prepareRound({ question: "测试现场问题", mode: "live", walletAddress: WALLET }), /显式确认/);
  assert.deepEqual(driver.calls, []);
});

test("未确认用户 commit/reveal 前禁止服务端发起易者预测", async () => {
  const service = new DemoActionService(new DriverStub());
  await service.prepareRound({ question: "等待用户签名", mode: "mock", walletAddress: WALLET });
  await assert.rejects(service.triggerPredictions(), /用户钱包.*开卦/);
});

test("用户开卦后服务端推进三家预测与三笔无许可结算", async () => {
  const { service, driver } = await revealedService();
  const predicted = await service.triggerPredictions();
  assert.equal(predicted.phase, "predicted");
  assert.equal(predicted.predictions.length, 3);

  const settled = await service.settleRound();
  assert.equal(settled.phase, "settled");
  assert.equal(settled.transactions.length, 9);
  assert.equal(settled.vaultChanges.length, 3);
  assert.deepEqual(driver.calls.slice(2), ["predictions", "settlement"]);
});

test("预测失败保留结果并供页面自动重试，错误文案不再要求点击中间按钮", async () => {
  const driver = new DriverStub();
  const createPredictions = driver.createPredictions.bind(driver);
  let attempts = 0;
  driver.createPredictions = async (session, progress) => {
    attempts += 1;
    if (attempts === 1) {
      const first = (await createPredictions(session, () => undefined)).predictions?.[0];
      assert.ok(first);
      progress({ phase: "predicting", prediction: first });
      throw new Error("临时 RPC 故障");
    }
    return createPredictions(session, progress);
  };
  const { service } = await revealedService(driver);

  await assert.rejects(service.triggerPredictions(), /页面将自动重试/);
  assert.equal(service.getSession()?.predictions.length, 1);
  assert.doesNotMatch(service.getSession()?.error ?? "", /点击|按钮/);

  const retried = await service.triggerPredictions();
  assert.equal(retried.predictions.length, 3);
  assert.equal(new Set(retried.predictions.map((item) => item.id)).size, 3);
});

test("三家未齐时服务端不得提前结算", async () => {
  const { service } = await revealedService();
  await assert.rejects(service.settleRound(), /三家预测尚未全部上链/);
});

test("賭轨 mock 保留人间原问题、只含一笔立誓并走人层见证", async () => {
  const service = new DemoActionService(new MockDemoDriver({ delayMilliseconds: 0 }));
  const question = "今天之内会不会收到那条消息";
  await service.prepareRound({ question, mode: "mock", walletAddress: WALLET, confirmedTrack: "wager", horizon: "short" });
  await service.confirmRound({ commitHash: HASHES.commit });
  const predicted = await service.triggerPredictions();

  assert.equal(predicted.track, "wager");
  assert.equal(predicted.proposition?.statement, question);
  assert.equal(predicted.proposition?.resolution?.tier, "human");
  assert.equal(predicted.proposition?.resolution?.method, "attested");
  assert.equal(predicted.transactions.filter((item) => item.kind === "commit").length, 1);
  assert.doesNotMatch(predicted.proposition?.statement ?? "", /Arc|USDC|总量/);
  assert.doesNotMatch(predicted.predictions.map((item) => item.reasoning).join("\n"), /Arc|USDC|总量|增长|上行|链上指标/);

  const settled = await service.settleRound({ querentOutcome: true, counterpartyOutcome: false });
  assert.equal(settled.phase, "settled");
  assert.equal(settled.outcome, null);
  assert.equal(settled.unresolved, true);
});

test("长周期賭轨明确停在等待见证，不伪装现场即时揭晓", async () => {
  const service = new DemoActionService(new MockDemoDriver({ delayMilliseconds: 0 }));
  await service.prepareRound({
    question: "这个月能不能拿到 offer",
    mode: "mock",
    walletAddress: WALLET,
    confirmedTrack: "wager",
    horizon: "long",
  });
  await service.confirmRound({ commitHash: HASHES.commit });
  const predicted = await service.triggerPredictions();
  assert.equal(predicted.proposition?.resolution?.horizon, "long");
  await assert.rejects(service.settleRound({ querentOutcome: true }), /长周期.*等待|截止.*尚未/);
});
