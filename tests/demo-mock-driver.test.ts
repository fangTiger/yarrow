import assert from "node:assert/strict";
import test from "node:test";

import { MockDemoDriver } from "../src/demo/mock-driver.js";
import { DemoActionService } from "../src/demo/service.js";

const WALLET = "0x0000000000000000000000000000000000000011";
const APPROVAL = `0x${"11".repeat(32)}` as const;
const COMMIT = `0x${"22".repeat(32)}` as const;
test("浏览器验收驱动只接受 mock，并以零模型费用和零链上花费走完整状态机", async () => {
  const service = new DemoActionService(new MockDemoDriver({ delayMilliseconds: 0 }));
  const prepared = await service.prepareRound({
    question: "今天之内会不会收到那条消息",
    mode: "mock",
    walletAddress: WALLET,
    confirmedTrack: "wager",
    horizon: "short",
  });
  assert.equal(prepared.preparation.chainId, 5_042_002);
  await service.confirmRound({ approvalHash: APPROVAL, commitHash: COMMIT, commitDurationMilliseconds: 5 });
  const predicted = await service.triggerPredictions();
  assert.equal(predicted.provider?.kind, "mock");
  assert.equal(predicted.provider?.estimatedCostUsd, undefined);
  const feeTransfers = predicted.transactions.filter((item) => item.kind === "fee-distribution");
  assert.equal(feeTransfers.length, 3);
  assert.deepEqual(feeTransfers.map((item) => item.amountUsdc6), ["16667", "16667", "16666"]);
  assert.equal(feeTransfers.every((item) => /卦金.*金库/.test(item.label)), true);
  const settled = await service.settleRound({ outcomeWaitDurationMilliseconds: 6, querentOutcome: false });

  assert.equal(settled.phase, "settled");
  assert.equal(settled.outcome, false);
  assert.equal(settled.transactions.reduce((sum, item) => sum + BigInt(item.gasCostUsdc6), 0n), 0n);
  assert.deepEqual(settled.timings.map((timing) => timing.label), ["立誓", "等待 N 块", "服务端揭示", "三家推理", "三笔预测", "等待应验", "三笔结算"]);
  assert.equal(settled.timings.every((timing) => timing.actualMilliseconds !== null), true);
});

test("浏览器验收驱动拒绝 live，避免误触真实 DeepSeek", async () => {
  const driver = new MockDemoDriver({ delayMilliseconds: 0 });
  await assert.rejects(
    driver.prepareRound({ question: "禁止现场", mode: "live", querent: WALLET }),
    /只允许 mock/,
  );
});
