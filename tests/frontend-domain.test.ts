import assert from "node:assert/strict";
import test from "node:test";

interface FrontendDomainModule {
  createLineViews(lines: readonly number[]): Array<{
    position: number;
    value: number;
    changing: boolean;
    primaryYang: boolean;
    derivedYang: boolean;
  }>;
  buildBankrollSeries(rounds: readonly unknown[]): Record<
    string,
    Array<{ replayId: number; bankrollUsdc: number; multiplier: number }>
  >;
  interpretBacktestSignal(brierSkillScore: number | null, brierVsConstantPValue: number | null): string;
  formatUsdc6(value: bigint): string;
  buildVerifiedGrave(input: {
    key: string;
    name: string;
    address: string;
    agentId: string | null;
    vaultAddress: string;
    vaultState: "ACTIVE" | "SEALED";
    vaultAssetsUsdc6: string;
    historyCount: number;
    lastLiveEntry: null | {
      roundId: string;
      probabilityBps: number;
      brier: number;
      unresolved: boolean;
      primary: { number: number; name: string };
      derived: { number: number; name: string };
    };
    contracts: { divinationRegistry: string; predictionBook: string; scoreBook: string };
  }): null | { key: string; historyCount: number; lastLiveEntry: { primary: { name: string } }; contracts: { scoreBook: string } };
}

async function loadDomain(): Promise<FrontendDomainModule> {
  try {
    return (await import("../src/frontend/domain.js")) as FrontendDomainModule;
  } catch {
    assert.fail("前端领域模块尚未实现");
  }
}

test("六爻按上爻到初爻绘制，同时保留自下而上的爻位编号", async () => {
  const { createLineViews } = await loadDomain();
  const views = createLineViews([9, 8, 7, 7, 6, 8]);

  assert.deepEqual(views.map((line) => line.position), [6, 5, 4, 3, 2, 1]);
  assert.deepEqual(views.map((line) => line.value), [8, 6, 7, 7, 8, 9]);
});

test("老阳变阴、老阴变阳，少阴少阳不变", async () => {
  const { createLineViews } = await loadDomain();
  const byPosition = [...createLineViews([9, 8, 7, 6, 7, 8])].reverse();

  assert.deepEqual(
    byPosition.map(({ changing, primaryYang, derivedYang }) => ({ changing, primaryYang, derivedYang })),
    [
      { changing: true, primaryYang: true, derivedYang: false },
      { changing: false, primaryYang: false, derivedYang: false },
      { changing: false, primaryYang: true, derivedYang: true },
      { changing: true, primaryYang: false, derivedYang: true },
      { changing: false, primaryYang: true, derivedYang: true },
      { changing: false, primaryYang: false, derivedYang: false },
    ],
  );
});

test("bankroll 曲线严格使用回放报告中的逐轮确定性余额和倍率", async () => {
  const { buildBankrollSeries } = await loadDomain();
  const series = buildBankrollSeries([
    {
      replayId: 1,
      predictions: [
        {
          divinerKey: "takashima",
          multiplier: 1,
          bankrollBeforeUsdc6: "3000000",
          bankrollAfterUsdc6: "3014298",
        },
      ],
    },
    {
      replayId: 2,
      predictions: [
        {
          divinerKey: "takashima",
          multiplier: 2,
          bankrollBeforeUsdc6: "3014298",
          bankrollAfterUsdc6: "3031887",
        },
      ],
    },
  ]);

  assert.deepEqual(series.takashima, [
    { replayId: 0, bankrollUsdc: 3, multiplier: 1 },
    { replayId: 1, bankrollUsdc: 3.014298, multiplier: 1 },
    { replayId: 2, bankrollUsdc: 3.031887, multiplier: 2 },
  ]);
});

test("BSS 不优于零或相对经验常数预测不显著时只能判为无可辨识信号", async () => {
  const { interpretBacktestSignal } = await loadDomain();

  assert.equal(interpretBacktestSignal(-2.8, 0.001), "no-discernible-signal");
  assert.equal(interpretBacktestSignal(0.05, 0.20), "no-discernible-signal");
  assert.equal(interpretBacktestSignal(0.05, 0.01), "inconclusive");
  assert.equal(interpretBacktestSignal(null, null), "inconclusive");
});

test("六位精度 USDC 使用固定六位展示", async () => {
  const { formatUsdc6 } = await loadDomain();

  assert.equal(formatUsdc6(218000n), "0.218000");
  assert.equal(formatUsdc6(3_014_298n), "3.014298");
});

test("墓碑只由链上 SEALED 状态和非空卦历共同生成", async () => {
  const { buildVerifiedGrave } = await loadDomain();
  const candidate = {
    key: "sealed-demo",
    name: "折筮·零号",
    address: "0x0000000000000000000000000000000000000001",
    agentId: null,
    vaultAddress: "0x0000000000000000000000000000000000000002",
    vaultState: "SEALED" as const,
    vaultAssetsUsdc6: "3581",
    historyCount: 6,
    lastLiveEntry: {
      roundId: "5",
      probabilityBps: 9900,
      brier: 0.9801,
      unresolved: false,
      primary: { number: 23, name: "山地剥" },
      derived: { number: 2, name: "坤为地" },
    },
    contracts: {
      divinationRegistry: "0x0000000000000000000000000000000000000003",
      predictionBook: "0x0000000000000000000000000000000000000004",
      scoreBook: "0x0000000000000000000000000000000000000005",
    },
  };

  assert.equal(buildVerifiedGrave({ ...candidate, vaultState: "ACTIVE" }), null);
  assert.equal(buildVerifiedGrave({ ...candidate, historyCount: 0, lastLiveEntry: null }), null);
  assert.deepEqual(buildVerifiedGrave(candidate), candidate);
});
