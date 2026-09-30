import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCompletedDemo,
  assertDemoDuration,
  demoDurationLimitMilliseconds,
} from "../src/demo/rehearsal.js";
import { scanFrontendSources } from "../src/demo/secret-scan.js";
import type { DemoSession, DemoTransaction } from "../src/demo/service.js";

let hashIndex = 1;
function transaction(kind: DemoTransaction["kind"]): DemoTransaction {
  const byte = (hashIndex++ % 255).toString(16).padStart(2, "0");
  return { kind, label: kind, hash: `0x${byte.repeat(32)}`, blockNumber: String(100 + hashIndex), gasCostUsdc6: "1000" };
}

function completeSession(): DemoSession {
  const approval = transaction("approval");
  const commit = transaction("commit");
  const reveal = transaction("reveal");
  const keys = ["takashima", "wuxing", "meihua"] as const;
  const predictions = keys.map((key, index) => {
    const tx = transaction("prediction");
    return { id: String(index + 1), divinerKey: key, divinerName: key, probabilityBps: 5_500 + index * 100, direction: "YES" as const, multiplier: 1, reasoning: "固定解释", transaction: tx };
  });
  const settlements = keys.map(() => transaction("settlement"));
  return {
    id: "demo",
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:01:00.000Z",
    mode: "mock",
    track: "wager",
    horizon: "short",
    phase: "settled",
    question: "Arc Testnet 现场问题",
    walletAddress: "0x0000000000000000000000000000000000000011",
    roundId: "9",
    hexagram: { lines: [7, 8, 9, 6, 7, 8], primaryKingWenNumber: 1, primaryName: "乾", derivedKingWenNumber: 2, derivedName: "坤", changingLinePositions: [3, 4] },
    proposition: {
      statement: "固定命题",
      predicateId: `0x${"aa".repeat(32)}`,
      params: `0x${"bb".repeat(32)}`,
      deadlineBlock: "180",
      calibration: { method: "historical-threshold-quantile-v1", sampleCount: 64, yesCount: 32, empiricalBaseRateBps: 5000, historyStartBlock: "1", historyEndBlock: "100", horizonBlocks: "60" },
    },
    predictions,
    transactions: [approval, commit, reveal, ...predictions.map((prediction) => prediction.transaction), ...settlements],
    vaultChanges: keys.map((key) => ({ divinerKey: key, beforeUsdc6: "200000", afterUsdc6: "199000", deltaUsdc6: "-1000" })),
    outcome: false,
    unresolved: false,
    provider: { kind: "mock", modelId: "mock-yijing-demo-v1" },
    error: null,
    timings: [],
  };
}

test("排练断言接受完整的一卦三家结算链路并累计 gas", () => {
  const summary = assertCompletedDemo(completeSession(), { expectedMode: "mock", maximumGasUsdc6: 1_500_000n });
  assert.equal(summary.roundId, "9");
  assert.equal(summary.predictionCount, 3);
  assert.equal(summary.transactionCount, 9);
  assert.equal(summary.gasCostUsdc6, "9000");
});

test("新部署的首轮 roundId=0 也是有效演示轮次", () => {
  const session = completeSession();
  session.roundId = "0";

  assert.equal(
    assertCompletedDemo(session, { expectedMode: "mock", maximumGasUsdc6: 1_500_000n }).roundId,
    "0",
  );
});

test("mock 完整流程必须在 40 秒内结束", () => {
  assert.doesNotThrow(() => assertDemoDuration(39_999, 40_000));
  assert.throws(() => assertDemoDuration(40_001, 40_000), /完整演示超过/);
});

test("LIVE 总时限在 MOCK 基础上纳入四次真实推理预算", () => {
  assert.equal(demoDurationLimitMilliseconds("mock"), 40_000);
  assert.equal(demoDurationLimitMilliseconds("live"), 60_000);
});

test("排练断言拒绝缺少结算回执、重复易者或超预算", () => {
  const missing = completeSession();
  missing.transactions = missing.transactions.filter((transaction) => transaction.kind !== "settlement").slice(0, 8);
  assert.throws(() => assertCompletedDemo(missing, { expectedMode: "mock", maximumGasUsdc6: 1_500_000n }), /结算交易必须恰好为 3/);

  const duplicate = completeSession();
  duplicate.predictions[2]!.divinerKey = "takashima";
  assert.throws(() => assertCompletedDemo(duplicate, { expectedMode: "mock", maximumGasUsdc6: 1_500_000n }), /三位不同易者/);

  const expensive = completeSession();
  expensive.transactions[0]!.gasCostUsdc6 = "1500001";
  assert.throws(() => assertCompletedDemo(expensive, { expectedMode: "mock", maximumGasUsdc6: 1_500_000n }), /链上 gas 超过/);
});

test("秘密扫描只返回文件名和泄漏类别，不回显秘密值", () => {
  const secret = "0x0123456789abcdef0123456789abcdef";
  const leaks = scanFrontendSources(
    [
      { path: "web/app.ts", text: `const accidental = ${JSON.stringify(secret)}` },
      { path: "web/dist/app.js", text: "privateKeyToAccount('不应存在')" },
    ],
    [{ label: "测试私密值", value: secret }],
  );
  assert.deepEqual(leaks, [
    { path: "web/app.ts", reasons: ["测试私密值"] },
    { path: "web/dist/app.js", reasons: ["私钥入口", "浏览器账户派生入口"] },
  ]);
  assert.doesNotMatch(JSON.stringify(leaks), new RegExp(secret));
});

test("秘密扫描允许注入钱包签名，但继续阻止私钥、助记词与账户派生", () => {
  const leaks = scanFrontendSources([
    { path: "web/account.ts", text: 'import { mnemonicToAccount } from "viem/accounts";' },
    { path: "web/provider.ts", text: "window.ethereum.request({ method: 'eth_sendTransaction' })" },
    { path: "web/wallet.ts", text: "const client = useWalletClient();" },
    { path: "web/vendor.js", text: "if (process.env.NODE_ENV !== 'production') console.warn('dev')" },
    { path: "web/runtime.ts", text: "const endpoint = process.env.API_URL" },
    { path: "web/raw.ts", text: "const PRIVATE_KEY = '不应存在';" },
  ], []);

  assert.deepEqual(leaks, [
    { path: "web/account.ts", reasons: ["助记词入口", "浏览器账户派生入口"] },
    { path: "web/runtime.ts", reasons: ["服务端环境变量入口"] },
    { path: "web/raw.ts", reasons: ["私钥入口"] },
  ]);
});
