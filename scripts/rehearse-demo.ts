import { mkdir, writeFile } from "node:fs/promises";

import { DEMO_GAS_BUDGET_USDC6 } from "../src/demo/arc-driver.js";
import { MockDemoDriver } from "../src/demo/mock-driver.js";
import { assertCompletedDemo, assertDemoDuration, demoDurationLimitMilliseconds } from "../src/demo/rehearsal.js";
import { DemoActionService } from "../src/demo/service.js";

const mode = process.argv.find((argument) => argument.startsWith("--mode="))?.slice("--mode=".length) ?? "mock";
if (mode !== "mock") throw new Error("命令行排练只允许 mock；LIVE 必须由浏览器中的用户钱包签名");

const hashes = {
  approval: `0x${"11".repeat(32)}` as const,
  commit: `0x${"22".repeat(32)}` as const,
  steadyCommit: `0x${"23".repeat(32)}` as const,
};
const generatedAt = new Date();
const timestamp = generatedAt.toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const service = new DemoActionService(new MockDemoDriver({ delayMilliseconds: 350 }));
const question = `Arc Testnet 的 USDC 总量在本次演示截止块后首次观察时会高于历史校准阈值吗？（${timestamp}）`;
const startedAt = performance.now();

console.log("零成本排练 1/4：准备用户钱包交易（不访问链、不调用模型）");
await service.prepareRound({
  question,
  mode: "mock",
  walletAddress: "0x0000000000000000000000000000000000000011",
});
console.log("零成本排练 2/4：模拟首次固定授权与一次立誓签名，服务端自动揭示");
await new Promise((resolve) => setTimeout(resolve, 900));
const revealed = await service.confirmRound({
  approvalHash: hashes.approval,
  commitHash: hashes.commit,
  commitDurationMilliseconds: 900,
});
console.log(`成卦：#${revealed.roundId} ${revealed.hexagram?.primaryName} → ${revealed.hexagram?.derivedName}`);
console.log("零成本排练 3/4：确定性 mock 三家应卦");
const predicted = await service.triggerPredictions();
for (const prediction of predicted.predictions) console.log(`${prediction.divinerName}：${(prediction.probabilityBps / 100).toFixed(2)}%`);
console.log("零成本排练 4/4：服务端自动完成三笔无许可结算");
const outcomeWaitDurationMilliseconds = 1_200;
await new Promise((resolve) => setTimeout(resolve, outcomeWaitDurationMilliseconds));
const settled = await service.settleRound({ outcomeWaitDurationMilliseconds, querentOutcome: false });

const durationMilliseconds = performance.now() - startedAt;
assertDemoDuration(durationMilliseconds, demoDurationLimitMilliseconds("mock"));
const assertion = assertCompletedDemo(settled, { expectedMode: "mock", maximumGasUsdc6: DEMO_GAS_BUDGET_USDC6 });

console.log("稳态签名复核：复用既有 10.000000 USDC allowance，再走一轮且不提交 approval 回执");
const steadyStartedAt = performance.now();
await service.prepareRound({
  question: `稳态复核：${question}`,
  mode: "mock",
  walletAddress: "0x0000000000000000000000000000000000000011",
});
await new Promise((resolve) => setTimeout(resolve, 900));
await service.confirmRound({ commitHash: hashes.steadyCommit, commitDurationMilliseconds: 900 });
await service.triggerPredictions();
await new Promise((resolve) => setTimeout(resolve, outcomeWaitDurationMilliseconds));
const steadySettled = await service.settleRound({ outcomeWaitDurationMilliseconds, querentOutcome: false });
const steadyDurationMilliseconds = performance.now() - steadyStartedAt;
assertDemoDuration(steadyDurationMilliseconds, demoDurationLimitMilliseconds("mock"));
const steadyAssertion = assertCompletedDemo(steadySettled, { expectedMode: "mock", maximumGasUsdc6: DEMO_GAS_BUDGET_USDC6 });
if (steadySettled.transactions.some((transaction) => transaction.kind === "approval")) {
  throw new Error("稳态轮次意外出现 approval 回执");
}
const reportPath = `reports/demo-mock-smoke-${timestamp}.json`;
await mkdir("reports", { recursive: true });
await writeFile(reportPath, `${JSON.stringify({
  schemaVersion: "2.0",
  generatedAt: generatedAt.toISOString(),
  mode: "mock",
  modelCostCny: 0,
  chainCostUsdc: 0,
  walletSignatures: { firstRound: 2, steadyRound: 1 },
  stageTimings: settled.timings,
  steadyStageTimings: steadySettled.timings,
  assertion,
  steadyAssertion,
  durationMilliseconds: Math.round(durationMilliseconds),
  steadyDurationMilliseconds: Math.round(steadyDurationMilliseconds),
  session: steadySettled,
}, null, 2)}\n`, "utf8");
console.log("阶段耗时（预计 / 实测）：");
for (const timing of settled.timings) {
  console.log(`${timing.label}：${timing.estimatedMilliseconds} ms / ${timing.actualMilliseconds ?? "未记录"} ms`);
}
console.log(`完整流程断言：PASS；首次 ${Math.round(durationMilliseconds)} ms / 2 次签名，稳态 ${Math.round(steadyDurationMilliseconds)} ms / 1 次签名；模型费用 0 CNY；链上花费 0 USDC；报告 ${reportPath}`);
