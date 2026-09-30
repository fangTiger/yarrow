import assert from "node:assert/strict";
import test from "node:test";

import { encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  DEMO_GAS_BUDGET_USDC6,
  assertUserTransactionIntent,
  assertDeadlineHeadroom,
  assertGasSendBudget,
  assertRecoveryReady,
  gasWeiToUsdc6,
  parseRecoveryRequestArguments,
  requiredTopUp,
  recoveryPlanForRound,
  resolveDemoAccounts,
  settledResolutionForRound,
  settledOutcomeForRound,
  waitUntilPastBlock,
} from "../src/demo/arc-driver.js";
import {
  DEMO_LIVE_BUDGET_CNY,
  DEMO_LIVE_CALL_LIMIT,
  DEMO_LIVE_INFERENCE_BUDGET_MS,
  DEMO_LIVE_PROVIDER_TIMEOUT_MS,
  createDemoProvider,
  liveBudgetUpperBoundCny,
  requireLiveConfirmation,
} from "../src/demo/provider.js";
import type { StructuredOutputRequest } from "../src/agent/provider.js";
import { PROPOSITION_OUTPUT_SCHEMA, PREDICTION_OUTPUT_SCHEMA } from "../src/agent/schemas.js";
import { deriveRolePrivateKey } from "../src/yijing-deployment.js";
import { plannedDeadline } from "../src/yijing-deployment.js";

const BASE_KEY = `0x${"12".repeat(32)}` as const;
const USER = "0x0000000000000000000000000000000000000011" as const;
const REGISTRY = "0x0000000000000000000000000000000000000022" as const;
const ROUND_WRITE_ABI = parseAbi([
  "function commit(bytes32 commitment,uint256 fee,uint256 bond,uint256 expectedRoundId) returns (uint256)",
  "function reveal(uint256 roundId,string question,bytes32 salt)",
]);

function request(taskId: string, userPrompt: string, schema: Record<string, unknown>): StructuredOutputRequest {
  return {
    taskId,
    systemPrompt: "测试系统提示",
    cacheSystemPrompt: false,
    userPrompt,
    schema,
    effort: "high",
  };
}

test("演示账户必须由基础私钥按既有角色派生并逐一匹配部署清单", () => {
  const deployer = privateKeyToAccount(BASE_KEY);
  const querent = privateKeyToAccount(deriveRolePrivateKey(BASE_KEY, "querent"));
  const thirdParty = privateKeyToAccount(deriveRolePrivateKey(BASE_KEY, "third-party"));
  const diviners = ["takashima", "wuxing", "meihua"].map((key) => ({
    key,
    name: key,
    address: privateKeyToAccount(deriveRolePrivateKey(BASE_KEY, `diviner/${key}`)).address,
  }));

  const resolved = resolveDemoAccounts(BASE_KEY, {
    deployer: deployer.address,
    querent: querent.address,
    thirdParty: thirdParty.address,
    diviners,
  });
  assert.equal(resolved.deployer.address, deployer.address);
  assert.equal(resolved.querent.address, querent.address);
  assert.equal(resolved.thirdParty.address, thirdParty.address);
  assert.equal(resolved.diviners.meihua.address, diviners[2]!.address);

  assert.throws(() => resolveDemoAccounts(BASE_KEY, {
    deployer: deployer.address,
    querent: "0x0000000000000000000000000000000000000001",
    thirdParty: thirdParty.address,
    diviners,
  }), /querent.*不匹配/);
});

test("用户交易核验同时锁定发送者、目标合约、函数与参数", () => {
  const commitment = `0x${"34".repeat(32)}` as const;
  const data = encodeFunctionData({
    abi: ROUND_WRITE_ABI,
    functionName: "commit",
    args: [commitment, 50_000n, 500_000n, 9n],
  });
  const expected = {
    sender: USER,
    contract: REGISTRY,
    abi: ROUND_WRITE_ABI,
    functionName: "commit",
    args: [commitment, 50_000n, 500_000n, 9n] as const,
  };

  assert.doesNotThrow(() => assertUserTransactionIntent({ from: USER, to: REGISTRY, input: data }, expected));
  assert.throws(() => assertUserTransactionIntent({ from: REGISTRY, to: REGISTRY, input: data }, expected), /发送者/);
  assert.throws(() => assertUserTransactionIntent({ from: USER, to: USER, input: data }, expected), /目标合约/);
  assert.throws(() => assertUserTransactionIntent({
    from: USER,
    to: REGISTRY,
    input: encodeFunctionData({ abi: ROUND_WRITE_ABI, functionName: "reveal", args: [9n, "问题", commitment] }),
  }, expected), /函数/);
  assert.throws(() => assertUserTransactionIntent({ from: USER, to: REGISTRY, input: data }, { ...expected, args: [commitment, 50_000n, 500_000n, 10n] }), /参数/);
});

test("mock provider 固定选择首个校准候选且三家各有确定输出", async () => {
  const provider = createDemoProvider("mock", { confirmLive: false, environment: {} });
  const predicateId = `0x${"34".repeat(32)}`;
  const params = `0x${"56".repeat(32)}`;
  const compiled = await provider.generateStructured(request(
    "proposition-compiler",
    `提问：测试\n\n链上已核验、难度已校准且可进入押注层的候选谓词：\n${JSON.stringify([{ predicateId, params }])}`,
    PROPOSITION_OUTPUT_SCHEMA,
  ));
  assert.deepEqual(compiled, {
    predicateId,
    params,
    reasoning: "采用链上已核验且完成历史难度校准的首个谓词。",
  });

  const takashima = await provider.generateStructured<{ direction: string; probabilityBps: number; reasoning: string }>(
    request("diviner/takashima", "固定输入", PREDICTION_OUTPUT_SCHEMA),
  );
  assert.deepEqual(takashima, { direction: "YES", probabilityBps: 6100, reasoning: "时势可进，但卦象到具体人间问题仍有解释跳跃，故只取温和偏是。" });
  assert.equal(provider.modelId, "mock-yijing-demo-v1");
});

test("live provider 门禁必须收到显式确认", () => {
  assert.throws(() => requireLiveConfirmation(false), /显式确认/);
  assert.doesNotThrow(() => requireLiveConfirmation(true));
});

test("live 四次调用共享演示预算且最坏 token 费用严格低于本轮 0.3 CNY 上限", () => {
  assert.equal(DEMO_LIVE_CALL_LIMIT, 4);
  assert.equal(DEMO_LIVE_INFERENCE_BUDGET_MS, DEMO_LIVE_CALL_LIMIT * DEMO_LIVE_PROVIDER_TIMEOUT_MS);
  assert.equal(DEMO_LIVE_BUDGET_CNY, 0.3);
  assert.ok(liveBudgetUpperBoundCny() < DEMO_LIVE_BUDGET_CNY);
});

test("live provider 在第四次后硬停，并在请求发出前拒绝超长提示", async () => {
  let fetchCalls = 0;
  const provider = createDemoProvider("live", {
    confirmLive: true,
    environment: { DEEPSEEK_API_KEY: "测试占位凭据" },
    fetch: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ direction: "YES", probabilityBps: 5100, reasoning: "测试" }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 1 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  for (let index = 0; index < DEMO_LIVE_CALL_LIMIT; index += 1) {
    await provider.generateStructured(request(`diviner/${index}`, "短提示", PREDICTION_OUTPUT_SCHEMA));
  }
  await assert.rejects(
    () => provider.generateStructured(request("diviner/overflow", "短提示", PREDICTION_OUTPUT_SCHEMA)),
    /调用次数超过/,
  );
  assert.equal(fetchCalls, DEMO_LIVE_CALL_LIMIT);

  const tooLong = createDemoProvider("live", {
    confirmLive: true,
    environment: { DEEPSEEK_API_KEY: "测试占位凭据" },
    fetch: async () => { throw new Error("不应发请求"); },
  });
  await assert.rejects(
    () => tooLong.generateStructured(request("diviner/long", "字".repeat(8_193), PREDICTION_OUTPUT_SCHEMA)),
    /提示长度超过/,
  );
});

test("区块等待必须严格超过截止块且可使用无延时测试时钟", async () => {
  const values = [100n, 101n, 103n];
  let reads = 0;
  const reached = await waitUntilPastBlock(102n, {
    getBlockNumber: async () => values[Math.min(reads++, values.length - 1)]!,
    sleep: async () => undefined,
    timeoutMilliseconds: 1_000,
    pollMilliseconds: 0,
  });
  assert.equal(reached, 103n);
  assert.equal(reads, 3);
});

test("每笔预测发送前为剩余推理和顺序上链保留截止块余量", () => {
  assert.doesNotThrow(() => assertDeadlineHeadroom({
    currentBlock: 112n,
    deadlineBlock: 168n,
    remainingWrites: 3,
    remainingInferenceCalls: 2,
  }));
  assert.throws(() => assertDeadlineHeadroom({
    currentBlock: 113n,
    deadlineBlock: 168n,
    remainingWrites: 3,
    remainingInferenceCalls: 2,
  }), /剩余截止预算不足.*重新起一卦/);
});

test("自动流程只保留六十块总交互余量且不与自动步骤重复累计", async () => {
  const driverModule = await import("../src/demo/arc-driver.js") as typeof import("../src/demo/arc-driver.js") & {
    DEMO_HUMAN_INTERACTION_BLOCKS?: number;
    DEMO_SETTLEMENT_TIMEOUT_MILLISECONDS?: number;
    demoDeadlinePolicy?: (mode: "mock" | "live") => {
      plannedSequentialWrites: number;
      blocksPerWriteBudget: number;
      llmInferenceMilliseconds: number;
      blockTimeMilliseconds: number;
      safetyBlocks: number;
    };
  };
  assert.equal(typeof driverModule.demoDeadlinePolicy, "function");
  assert.equal(driverModule.DEMO_HUMAN_INTERACTION_BLOCKS, 60);
  assert.equal(driverModule.DEMO_SETTLEMENT_TIMEOUT_MILLISECONDS, 240_000);
  const currentBlock = 1_000n;
  const policy = driverModule.demoDeadlinePolicy!("mock");
  const deadlineBlock = plannedDeadline({ currentBlock, ...policy });
  assert.ok(deadlineBlock - currentBlock >= BigInt(driverModule.DEMO_HUMAN_INTERACTION_BLOCKS!));
  assert.ok(deadlineBlock - currentBlock <= 64n, "mock 总窗口只能再加四块操作安全垫");
  const livePolicy = driverModule.demoDeadlinePolicy!("live");
  const liveWindowBlocks = livePolicy.plannedSequentialWrites * livePolicy.blocksPerWriteBudget
    + Math.ceil(livePolicy.llmInferenceMilliseconds / livePolicy.blockTimeMilliseconds)
    + livePolicy.safetyBlocks;
  assert.ok(driverModule.DEMO_SETTLEMENT_TIMEOUT_MILLISECONDS! > liveWindowBlocks * livePolicy.blockTimeMilliseconds);
});

test("Arc 原生 18 位 USDC gas 成本向上换算，且全流程链上预算不超过一 USDC", () => {
  assert.equal(DEMO_GAS_BUDGET_USDC6, 1_000_000n);
  assert.equal(gasWeiToUsdc6(12_345_678_901_234_567n), "12346");
  assert.equal(gasWeiToUsdc6(999_999_999_999n), "1");
  assert.doesNotThrow(() => assertGasSendBudget({ spentWei: 1n, estimatedGas: 10n, gasPriceWei: 2n, signerBalanceWei: 100n, maximumWei: 30n }));
  assert.throws(() => assertGasSendBudget({ spentWei: 11n, estimatedGas: 10n, gasPriceWei: 2n, signerBalanceWei: 100n, maximumWei: 30n }), /累计 gas 预算/);
  assert.throws(() => assertGasSendBudget({ spentWei: 0n, estimatedGas: 10n, gasPriceWei: 2n, signerBalanceWei: 19n, maximumWei: 30n }), /签名账户 gas 余额不足/);
});

test("账户只补到明确目标余额，不发生负数或重复补款", () => {
  assert.equal(requiredTopUp(20_000n, 100_000n), 80_000n);
  assert.equal(requiredTopUp(100_000n, 100_000n), 0n);
  assert.equal(requiredTopUp(120_000n, 100_000n), 0n);
});

test("结算验收要求三家 ScoreBook 均写入同轮且事实结果一致", () => {
  const histories = [
    { roundId: 0n, outcome: true, unresolved: false },
    { roundId: 0n, outcome: true, unresolved: false },
    { roundId: 0n, outcome: true, unresolved: false },
  ];
  assert.equal(settledOutcomeForRound(0n, histories), true);
  assert.throws(() => settledOutcomeForRound(0n, [{ ...histories[0]!, unresolved: true }, histories[1]!, histories[2]!]), /未完成有效结算/);
  assert.throws(() => settledOutcomeForRound(0n, [histories[0]!, histories[1]!, { ...histories[2]!, outcome: false }]), /事实结果不一致/);
});

test("人层结算允许三家一致写入未决，但拒绝混合终态", () => {
  const unresolved = [
    { roundId: 9n, outcome: false, unresolved: true },
    { roundId: 9n, outcome: false, unresolved: true },
    { roundId: 9n, outcome: false, unresolved: true },
  ];
  assert.deepEqual(settledResolutionForRound(9n, unresolved), { outcome: null, unresolved: true });
  assert.throws(
    () => settledResolutionForRound(9n, [{ ...unresolved[0]!, unresolved: false }, unresolved[1]!, unresolved[2]!]),
    /终态不一致/,
  );
});

test("新排练会先为最近的未完成轮次选择合约原生恢复路径", () => {
  assert.deepEqual(recoveryPlanForRound({ state: 0, revealDeadline: 132n }, null), { kind: "forfeit", deadlineBlock: 132n });
  assert.deepEqual(recoveryPlanForRound({ state: 1, revealDeadline: 132n }, { initialized: false, deadline: 0n }), { kind: "cancel", deadlineBlock: 132n });
  assert.deepEqual(recoveryPlanForRound({ state: 2, revealDeadline: 132n }, { initialized: true, deadline: 190n }), { kind: "cancel", deadlineBlock: 190n });
  assert.equal(recoveryPlanForRound({ state: 3, revealDeadline: 132n }, null), null);
});

test("恢复入口要求显式轮次、确认标志，且只处置启动时已经到期的轮次", () => {
  assert.deepEqual(parseRecoveryRequestArguments(["--round-id", "12", "--confirm"]), {
    roundId: 12n,
    confirmed: true,
  });
  assert.throws(() => parseRecoveryRequestArguments(["--confirm"]), /--round-id/);
  assert.throws(() => parseRecoveryRequestArguments(["--round-id", "12"]), /--confirm/);
  assert.throws(() => parseRecoveryRequestArguments(["--round-id", "-1", "--confirm"]), /非负整数/);

  assert.doesNotThrow(() => assertRecoveryReady({
    confirmed: true,
    currentBlock: 133n,
    deadlineBlock: 132n,
  }));
  assert.throws(() => assertRecoveryReady({
    confirmed: false,
    currentBlock: 133n,
    deadlineBlock: 132n,
  }), /显式确认/);
  assert.throws(() => assertRecoveryReady({
    confirmed: true,
    currentBlock: 132n,
    deadlineBlock: 132n,
  }), /尚未到期/);
});
