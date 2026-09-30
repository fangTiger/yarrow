import assert from "node:assert/strict";
import test from "node:test";

interface FrontendDataModule {
  ARC_LOG_SCAN_BLOCK_WINDOW: bigint;
  ARC_RPC_CONCURRENCY_LIMIT: number;
  scanLogsInBlockWindows<T extends { blockNumber: bigint | null; logIndex: number | null }>(input: {
    fromBlock: bigint;
    toBlock: bigint;
    windowSize?: bigint;
    fetchLogs: (range: { fromBlock: bigint; toBlock: bigint }) => Promise<readonly T[]>;
  }): Promise<T[]>;
  blockTimestampIso(timestamp: bigint): string;
  mapWithConcurrency<T, R>(items: readonly T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]>;
  selectReplayReportName(names: readonly string[]): string;
  buildBacktestHistory(
    report: {
      modelId: string;
      rounds: Array<{
        replayId: number;
        backtested: boolean;
        cutoff: { blockNumber: string; timestamp: string };
        resolution: { blockNumber: string; timestamp: string };
        proposition: { statement: string };
        hexagram: { lines: number[]; primaryKingWenNumber: number; derivedKingWenNumber: number; changingLinePositions: number[] };
        outcome: boolean;
        predictions: Array<{ divinerKey: string; probabilityBps: number; reasoning: string; direction: "YES" | "NO"; settlementDeltaUsdc6: string; brier: string }>;
      }>;
    },
    divinerNames: Readonly<Record<string, string>>,
  ): Array<{
    id: string;
    source: "backtested";
    sourceLabel: string;
    resolutionTier: "heaven";
    question: string;
    occurredAt: string;
    outcome: boolean;
    primary: { number: number; name: string };
    predictions: Array<{ divinerName: string; settlementDeltaUsdc6: string; brier: number }>;
  }>;
  roundEventScanStart(commitBlock: bigint): bigint;
  isDisplayableRoundState(state: number): boolean;
  extractAuditContext(
    records: readonly unknown[],
    predictionBook: string,
    roundId: string,
  ): {
    question: string;
    statement: string;
    provider: string;
    resolutionTier: "human" | "heaven";
    readings: Record<string, { reasoning: string; probabilityBps: number }>;
  } | null;
  verifyBacktestSummary(
    report: { sampleCount: number; correctCount: number; averageBrier: number; brierSkillScore: number | null; empiricalBaseRateBps: number; constantBaselineBrier: number; wilson95: { lowerBps: number; upperBps: number } },
    chain: { sampleCount: bigint; correctCount: bigint; totalBrier: bigint; wilson95: readonly [number, number]; brierSkill: readonly [number, bigint, bigint, boolean] | null },
  ): boolean;
  selectGraves<T extends { vaultState: "ACTIVE" | "SEALED" }>(readings: readonly T[]): T[];
  buildLiveScore(
    stats: { sampleCount: bigint; correctCount: bigint; unresolvedCount: bigint; totalBrier: bigint },
    wilson95: readonly [number, number],
    brierSkill: readonly [number, bigint, bigint, boolean] | null,
  ): {
    sampleCount: number;
    correctCount: number;
    unresolvedCount: number;
    averageBrier: number | null;
    empiricalBaseRateBps: number | null;
    constantBaselineBrier: number | null;
    brierSkillScore: number | null;
    wilson95: [number, number];
  };
}

async function loadDataModule(): Promise<FrontendDataModule> {
  try {
    return (await import("../src/frontend/data.js")) as FrontendDataModule;
  } catch {
    assert.fail("前端数据模块尚未实现");
  }
}

test("只接受当前 PredictionBook 与轮次完全匹配的审计日志", async () => {
  const { extractAuditContext } = await loadDataModule();
  const records = [
    { type: "round-claimed", payload: { predictionBook: "0xBook", roundId: "2" } },
    {
      type: "proposition-compiled",
      payload: { question: "问链之时势", output: { statement: "H 后首次观察值是否超过 X" } },
    },
    {
      type: "diviner-output",
      payload: {
        divinerKey: "takashima",
        modelId: "mock-yijing-v1",
        output: { reasoning: "止而后观。", probabilityBps: 4000 },
      },
    },
  ];

  assert.equal(extractAuditContext(records, "0xOther", "2"), null);
  assert.deepEqual(extractAuditContext(records, "0xbook", "2"), {
    question: "问链之时势",
    statement: "H 后首次观察值是否超过 X",
    provider: "mock-yijing-v1",
    resolutionTier: "heaven",
    readings: { takashima: { reasoning: "止而后观。", probabilityBps: 4000 } },
  });
});

test("卦历从审计命题识别人层，不把新賭轨混写成天层现场", async () => {
  const { extractAuditContext } = await loadDataModule();
  const context = extractAuditContext([
    { type: "round-claimed", payload: { predictionBook: "0xBook", roundId: "9" } },
    {
      type: "proposition-compiled",
      payload: {
        question: "今天之内会不会收到那条消息",
        output: {
          statement: "今天之内会不会收到那条消息",
          calibration: { method: "human-attestation-no-statistical-calibration" },
        },
      },
    },
  ], "0xbook", "9");

  assert.equal(context?.resolutionTier, "human");
});

test("回放摘要只有与链上样本、Brier 和 Wilson 区间一致时才标记已校验", async () => {
  const { verifyBacktestSummary } = await loadDataModule();
  const report = {
    sampleCount: 101,
    correctCount: 53,
    averageBrier: 0.27016474,
    brierSkillScore: -0.08065896,
    empiricalBaseRateBps: 5_000,
    constantBaselineBrier: 0.25,
    wilson95: { lowerBps: 4282, upperBps: 6194 },
  };
  const chain = {
    sampleCount: 101n,
    correctCount: 53n,
    totalBrier: 2_728_663_891n,
    wilson95: [4282, 6194] as const,
    brierSkill: [5_000, 25_000_000n, -8_065_896n, true] as const,
  };

  assert.equal(verifyBacktestSummary(report, chain), true);
  assert.equal(verifyBacktestSummary({ ...report, sampleCount: 100 }, chain), false);
  assert.equal(verifyBacktestSummary(report, { ...chain, brierSkill: null }), false);
});

test("墓域只收录链上已永久封存的易者", async () => {
  const { selectGraves } = await loadDataModule();
  const diviners = [
    { name: "尚存", vaultState: "ACTIVE" as const },
    { name: "已封存", vaultState: "SEALED" as const },
  ];

  assert.deepEqual(selectGraves(diviners), [{ name: "已封存", vaultState: "SEALED" }]);
});

test("当前轮次事件只从该轮提交块开始扫描", async () => {
  const { roundEventScanStart } = await loadDataModule();

  assert.equal(roundEventScanStart(60_474_433n), 60_474_433n);
});

test("事件扫描跨越远超单次限制的区间仍返回全部日志且并发不超过四", async () => {
  const {
    ARC_LOG_SCAN_BLOCK_WINDOW,
    ARC_RPC_CONCURRENCY_LIMIT,
    scanLogsInBlockWindows,
  } = await loadDataModule();
  const source = [
    { id: "起", blockNumber: 0n, logIndex: 0 },
    { id: "一", blockNumber: 8_999n, logIndex: 2 },
    { id: "二", blockNumber: 9_000n, logIndex: 0 },
    { id: "三", blockNumber: 27_123n, logIndex: 4 },
    { id: "末", blockNumber: 50_000n, logIndex: 1 },
  ];
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  let active = 0;
  let peak = 0;

  const logs = await scanLogsInBlockWindows({
    fromBlock: 0n,
    toBlock: 50_000n,
    fetchLogs: async (range) => {
      ranges.push(range);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      assert.equal(range.toBlock - range.fromBlock + 1n <= ARC_LOG_SCAN_BLOCK_WINDOW, true);
      return source.filter((log) => log.blockNumber >= range.fromBlock && log.blockNumber <= range.toBlock);
    },
  });

  const orderedRanges = [...ranges].sort((left, right) => left.fromBlock < right.fromBlock ? -1 : 1);
  assert.equal(ARC_LOG_SCAN_BLOCK_WINDOW, 9_000n);
  assert.equal(ARC_RPC_CONCURRENCY_LIMIT, 4);
  assert.equal(peak <= ARC_RPC_CONCURRENCY_LIMIT, true, `事件扫描峰值并发为 ${peak}`);
  assert.equal(orderedRanges[0]?.fromBlock, 0n);
  assert.equal(orderedRanges.at(-1)?.toBlock, 50_000n);
  for (let index = 1; index < orderedRanges.length; index += 1) {
    assert.equal(orderedRanges[index]?.fromBlock, orderedRanges[index - 1]!.toBlock + 1n);
  }
  assert.deepEqual(logs.map((log) => log.id), ["起", "一", "二", "三", "末"]);
});

test("事件查询超过结果上限时自动二分窗口而不是失败", async () => {
  const { scanLogsInBlockWindows } = await loadDataModule();
  const attemptedWidths: bigint[] = [];

  const logs = await scanLogsInBlockWindows({
    fromBlock: 100n,
    toBlock: 108n,
    fetchLogs: async ({ fromBlock, toBlock }) => {
      const width = toBlock - fromBlock + 1n;
      attemptedWidths.push(width);
      if (width > 2n) {
        const error = new Error("Request exceeds");
        Object.assign(error, { details: "query exceeds max results 20000" });
        throw error;
      }
      return Array.from({ length: Number(width) }, (_, index) => ({
        blockNumber: fromBlock + BigInt(index),
        logIndex: 0,
      }));
    },
  });

  assert.equal(attemptedWidths.includes(9n), true);
  assert.equal(attemptedWidths.some((width) => width > 2n), true);
  assert.deepEqual(logs.map((log) => log.blockNumber), [100n, 101n, 102n, 103n, 104n, 105n, 106n, 107n, 108n]);
});

test("分段事件合并后按块高与 logIndex 排序并去重", async () => {
  const { scanLogsInBlockWindows } = await loadDataModule();
  const logs = await scanLogsInBlockWindows({
    fromBlock: 10n,
    toBlock: 13n,
    windowSize: 2n,
    fetchLogs: async ({ fromBlock }) => fromBlock === 10n
      ? [
          { id: "同块末", blockNumber: 10n, logIndex: 3 },
          { id: "同块首", blockNumber: 10n, logIndex: 1 },
          { id: "同块中", blockNumber: 10n, logIndex: 2 },
          { id: "重复项", blockNumber: 10n, logIndex: 2 },
        ]
      : [
          { id: "后块", blockNumber: 13n, logIndex: 0 },
          { id: "前块", blockNumber: 12n, logIndex: 5 },
        ],
  });

  assert.deepEqual(logs.map((log) => log.id), ["同块首", "同块中", "同块末", "前块", "后块"]);
  assert.equal(new Set(logs.map((log) => `${log.blockNumber}:${log.logIndex}`)).size, logs.length);
});

test("现场卦历使用链上区块时间而不是页面读取时钟", async () => {
  const { blockTimestampIso } = await loadDataModule();

  assert.equal(blockTimestampIso(1_725_520_000n), "2024-09-05T07:06:40.000Z");
});

test("现场卦历 RPC 读取限制并发且保持原有顺序", async () => {
  const { mapWithConcurrency } = await loadDataModule();
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([3, 1, 2, 4], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, value));
    active -= 1;
    return value * 10;
  });

  assert.deepEqual(results, [30, 10, 20, 40]);
  assert.equal(peak, 2);
  await assert.rejects(() => mapWithConcurrency([1], 0, async (value) => value), /并发上限/);
});

test("现场 ScoreBook 元组转换为可直接刷新的 Brier/BSS 指标", async () => {
  const { buildLiveScore } = await loadDataModule();
  assert.deepEqual(buildLiveScore(
    { sampleCount: 4n, correctCount: 3n, unresolvedCount: 1n, totalBrier: 80_000_000n },
    [3000, 9500],
    [7500, 18_750_000n, -6_666_667n, true],
  ), {
    sampleCount: 4,
    correctCount: 3,
    unresolvedCount: 1,
    averageBrier: 0.2,
    empiricalBaseRateBps: 7500,
    constantBaselineBrier: 0.1875,
    brierSkillScore: -0.06666667,
    wilson95: [3000, 9500],
  });

  assert.deepEqual(buildLiveScore(
    { sampleCount: 1n, correctCount: 1n, unresolvedCount: 0n, totalBrier: 15_210_000n },
    [2065, 10_000],
    null,
  ), {
    sampleCount: 1,
    correctCount: 1,
    unresolvedCount: 0,
    averageBrier: 0.1521,
    empiricalBaseRateBps: null,
    constantBaselineBrier: null,
    brierSkillScore: null,
    wilson95: [2065, 10_000],
  });
});

test("只读面板跳过已没收与已作废轮次", async () => {
  const { isDisplayableRoundState } = await loadDataModule();
  assert.equal(isDisplayableRoundState(0), false);
  assert.equal(isDisplayableRoundState(1), true);
  assert.equal(isDisplayableRoundState(2), true);
  assert.equal(isDisplayableRoundState(3), true);
  assert.equal(isDisplayableRoundState(4), false);
  assert.equal(isDisplayableRoundState(5), true);
  assert.equal(isDisplayableRoundState(6), false);
});

test("卦历数据优先使用完整 1000 回合报告", async () => {
  const { selectReplayReportName } = await loadDataModule();
  assert.equal(selectReplayReportName([
    "arc-walk-forward-2026-09-04.json",
    "deepseek-walk-forward-calibration-30.json",
    "deepseek-walk-forward-1000.json",
  ]), "deepseek-walk-forward-1000.json");
  assert.throws(() => selectReplayReportName([]), /未找到/);
});

test("回放轮次被规范化成明确标注来源、结果和逐家盈亏的卦卡", async () => {
  const { buildBacktestHistory } = await loadDataModule();
  const cards = buildBacktestHistory({
    modelId: "saved-provider",
    rounds: [{
      replayId: 7,
      backtested: true,
      cutoff: { blockNumber: "100", timestamp: "1000" },
      resolution: { blockNumber: "106", timestamp: "1006" },
      proposition: { statement: "截止块后观察值是否高于阈值？" },
      hexagram: { lines: [7, 9, 7, 8, 7, 8], primaryKingWenNumber: 1, derivedKingWenNumber: 13, changingLinePositions: [2] },
      outcome: false,
      predictions: [{
        divinerKey: "takashima",
        probabilityBps: 3700,
        reasoning: "偏否。",
        direction: "NO",
        settlementDeltaUsdc6: "8190",
        brier: "13690000",
      }],
    }],
  }, { takashima: "高島易断" });

  assert.equal(cards[0]?.id, "backtest-7");
  assert.equal(cards[0]?.source, "backtested");
  assert.match(cards[0]?.sourceLabel ?? "", /天层.*历史数据回放.*backtested.*非现场/);
  assert.equal(cards[0]?.resolutionTier, "heaven");
  assert.equal(cards[0]?.question, "截止块后观察值是否高于阈值？");
  assert.equal(cards[0]?.outcome, false);
  assert.deepEqual(cards[0]?.primary, { number: 1, name: "乾为天" });
  assert.deepEqual(cards[0]?.predictions[0], {
    divinerKey: "takashima",
    divinerName: "高島易断",
    probabilityBps: 3700,
    direction: "NO",
    settlementDeltaUsdc6: "8190",
    brier: 0.1369,
    reasoning: "偏否。",
  });
});
