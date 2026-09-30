import assert from "node:assert/strict";
import test from "node:test";

import type { Hex } from "viem";

import { AgentOrchestrator, type PredictionSubmission, type PredictionSubmitter, type PropositionCompilerLike } from "../src/agent/orchestrator.js";
import { canonicalJson, hashJson, hashText } from "../src/agent/audit.js";
import { DeterministicMockProvider, type StructuredOutputRequest } from "../src/agent/provider.js";
import { FileAgentRunJournal, type AgentRunJournal, type RunJournalEvent } from "../src/agent/run-journal.js";
import type { CompiledProposition } from "../src/agent/proposition-compiler.js";
import { DIVINER_SYSTEM_PROMPTS, buildDivinerUserPrompt, type DivinerHistory, type DivinerKey } from "../src/agent/diviners.js";
import { PREDICTION_OUTPUT_SCHEMA } from "../src/agent/schemas.js";
import { PROPOSITION_OUTPUT_SCHEMA } from "../src/agent/schemas.js";

const proposition: CompiledProposition = {
  predicateId: `0x${"12".repeat(32)}`,
  params: `0x${"34".repeat(32)}`,
  deadlineBlock: 2_000n,
  statement: "固定命题",
  reasoning: "中立编译理由",
  calibration: {
    method: "historical-threshold-quantile-v1",
    sampleCount: 64,
    yesCount: 32,
    empiricalBaseRateBps: 5_000,
    historyStartBlock: 1_000n,
    historyEndBlock: 1_900n,
    horizonBlocks: 100n,
  },
};

const history: DivinerHistory = {
  sampleCount: 0,
  correctCount: 0,
  unresolvedCount: 0,
  averageBrier: 0,
  recent: [],
};

class JournalStub implements AgentRunJournal {
  claimed = false;
  readonly events: RunJournalEvent[] = [];

  async claim(): Promise<{ path: string; record(event: RunJournalEvent): Promise<void> }> {
    if (this.claimed) throw new Error("审计记录已存在，禁止重跑择优");
    this.claimed = true;
    return { path: "内存测试记录", record: async (event) => { this.events.push(event); } };
  }
}

const scope = { chainId: 5_042_002, predictionBook: `0x${"56".repeat(20)}` as const };

function compilerAudit(question: string) {
  return {
    modelId: "mock-yijing-v1",
    request: {
      taskId: "proposition-compiler",
      systemPrompt: "中立编译器",
      cacheSystemPrompt: false,
      userPrompt: question,
      schema: PROPOSITION_OUTPUT_SCHEMA,
      effort: "high" as const,
    },
    output: { predicateId: proposition.predicateId, params: proposition.params, reasoning: proposition.reasoning },
  };
}

test("命题编译器未在回调中持久化唯一输出时必须失败闭锁", async () => {
  const provider = new DeterministicMockProvider("mock-yijing-v1", {
    "diviner/takashima": { direction: "YES", probabilityBps: 6_000, reasoning: "不应执行" },
  });
  const orchestrator = new AgentOrchestrator({
    compiler: { compile: async () => proposition },
    provider,
    submitter: { submit: async () => ({ transactionHash: `0x${"ab".repeat(32)}`, blockNumber: 1n }) },
    journal: new JournalStub(),
    scope,
  });
  await assert.rejects(orchestrator.run({
    roundId: 8n,
    question: "测试问题",
    hexagram: { lines: [7, 7, 7, 7, 7, 7], primaryKingWenNumber: 1, derivedKingWenNumber: 1, changingLinePositions: [] },
    histories: { takashima: history, wuxing: history, meihua: history },
  }), /编译输出未持久化/);
  assert.equal(provider.callCount("diviner/takashima"), 0);
});

test("规范 JSON 与哈希不受对象键插入顺序影响", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
  assert.equal(hashJson({ b: 2, a: 1 }), hashJson({ a: 1, b: 2 }));
  assert.notEqual(hashText("a"), hashText("b"));
});

test("每位易者只推理一次且输出后的下一动作就是提交同一冻结命题", async () => {
  const events: string[] = [];
  let compileCalls = 0;
  const compiler = {
    compile: async (
      question: string,
      recordAudit: Parameters<PropositionCompilerLike["compile"]>[1],
      recordProviderAttempt: Parameters<PropositionCompilerLike["compile"]>[2],
    ) => {
      compileCalls += 1;
      events.push("compile");
      const rawOutput = canonicalJson(compilerAudit(question).output);
      await recordProviderAttempt?.({ attempt: 1, result: "valid", rawOutput, rawOutputHash: hashText(rawOutput) });
      const audit = compilerAudit(question);
      await recordAudit({
        ...audit,
        request: { ...audit.request, recordAttempt: async () => undefined },
      });
      return proposition;
    },
  };
  const keys: readonly DivinerKey[] = ["takashima", "wuxing", "meihua"];
  const fixtureByKey = {
    takashima: { direction: "YES", probabilityBps: 6_100, reasoning: "高島判断" },
    wuxing: { direction: "NO", probabilityBps: 4_200, reasoning: "五行判断" },
    meihua: { direction: "YES", probabilityBps: 7_300, reasoning: "梅花判断" },
  } as const;
  const provider = new DeterministicMockProvider("mock-yijing-v1", Object.fromEntries(keys.map((key) => [
    `diviner/${key}`,
    (_request: StructuredOutputRequest) => {
      events.push(`output:${key}`);
      return fixtureByKey[key];
    },
  ])));
  const submissions: PredictionSubmission[] = [];
  const submitter: PredictionSubmitter = {
    submit: async (submission) => {
      events.push(`submit:${submission.divinerKey}`);
      submissions.push(submission);
      return { transactionHash: `0x${"ab".repeat(32)}` as Hex, blockNumber: 1_500n };
    },
  };
  const journal = new JournalStub();
  const orchestrator = new AgentOrchestrator({ compiler, provider, submitter, journal, scope });

  const result = await orchestrator.run({
    roundId: 9n,
    question: "测试问题",
    hexagram: {
      lines: [8, 6, 8, 9, 8, 7],
      primaryKingWenNumber: 35,
      derivedKingWenNumber: 4,
      changingLinePositions: [2, 4],
    },
    histories: { takashima: history, wuxing: history, meihua: history },
  });

  assert.equal(compileCalls, 1);
  assert.deepEqual(events, [
    "compile",
    "output:takashima", "submit:takashima",
    "output:wuxing", "submit:wuxing",
    "output:meihua", "submit:meihua",
  ]);
  assert.equal(result.predictions.length, 3);
  assert.equal(submissions.length, 3);
  for (const [index, submission] of submissions.entries()) {
    const key = keys[index]!;
    assert.equal(provider.callCount(`diviner/${key}`), 1);
    assert.equal(submission.roundId, 9n);
    assert.equal(submission.predicateId, proposition.predicateId);
    assert.equal(submission.params, proposition.params);
    assert.equal(submission.deadline, proposition.deadlineBlock);
    assert.equal(submission.modelId, hashText("mock-yijing-v1"));
    assert.equal(submission.providerConfigHash, provider.providerConfigHash);
    assert.equal(submission.attemptCount, 1);
    const userPrompt = buildDivinerUserPrompt({
      question: "测试问题",
      hexagram: {
        lines: [8, 6, 8, 9, 8, 7],
        primaryKingWenNumber: 35,
        derivedKingWenNumber: 4,
        changingLinePositions: [2, 4],
      },
      proposition,
      history,
    });
    assert.equal(submission.promptHash, hashText(DIVINER_SYSTEM_PROMPTS[key]));
    assert.equal(submission.schemaHash, hashJson(PREDICTION_OUTPUT_SCHEMA));
    assert.equal("multiplier" in submission, false);
  }
  assert.deepEqual(journal.events.map((event) => event.type), [
    "provider-attempt",
    "proposition-output",
    "proposition-compiled",
    "provider-attempt",
    "diviner-output", "prediction-submitted",
    "provider-attempt",
    "diviner-output", "prediction-submitted",
    "provider-attempt",
    "diviner-output", "prediction-submitted",
  ]);
  const attempts = journal.events.filter((event) => event.type === "provider-attempt");
  assert.equal(attempts.length, 4);
  assert.equal(attempts.every((event) => event.payload.rawOutputHash && !("rawOutput" in event.payload)), true);
  assert.deepEqual(attempts.map((event) => event.payload.attempt), [1, 1, 1, 1]);
  const propositionOutput = journal.events.find((event) => event.type === "proposition-output")!;
  assert.equal("recordAttempt" in (propositionOutput.payload.request as Record<string, unknown>), false);
  const firstOutput = journal.events.find((event) => event.type === "diviner-output")!;
  const firstKey = keys[0]!;
  const firstUserPrompt = buildDivinerUserPrompt({
    question: "测试问题",
    hexagram: {
      lines: [8, 6, 8, 9, 8, 7],
      primaryKingWenNumber: 35,
      derivedKingWenNumber: 4,
      changingLinePositions: [2, 4],
    },
    proposition,
    history,
  });
  assert.equal(firstOutput.payload.inputHash, hashJson({ systemPrompt: DIVINER_SYSTEM_PROMPTS[firstKey], userPrompt: firstUserPrompt }));
  assert.equal(firstOutput.payload.outputHash, hashJson(fixtureByKey[firstKey]));
});

test("部分提交后重试不重跑推理，也不重复提交已成功部分", async () => {
  const submitCalls = new Map<DivinerKey, number>();
  const compiler = { compile: async (question: string, recordAudit: Parameters<PropositionCompilerLike["compile"]>[1]) => {
    await recordAudit(compilerAudit(question));
    return proposition;
  } };
  const provider = new DeterministicMockProvider("mock-yijing-v1", {
    "diviner/takashima": { direction: "YES", probabilityBps: 6_000, reasoning: "唯一输出" },
    "diviner/wuxing": { direction: "NO", probabilityBps: 4_000, reasoning: "唯一输出" },
    "diviner/meihua": { direction: "YES", probabilityBps: 7_000, reasoning: "唯一输出" },
  });
  const submitter: PredictionSubmitter = {
    submit: async (submission) => {
      const count = (submitCalls.get(submission.divinerKey) ?? 0) + 1;
      submitCalls.set(submission.divinerKey, count);
      if (submission.divinerKey === "wuxing" && count === 1) throw new Error("链上提交失败");
      const hashByte = submission.divinerKey === "takashima" ? "ab" : submission.divinerKey === "wuxing" ? "cd" : "ef";
      return {
        transactionHash: `0x${hashByte.repeat(32)}` as Hex,
        blockNumber: 1_500n,
      };
    },
  };
  const journal = new JournalStub();
  const orchestrator = new AgentOrchestrator({ compiler, provider, submitter, journal, scope });
  const request = {
    roundId: 10n,
    question: "测试问题",
    hexagram: {
      lines: [7, 7, 7, 7, 7, 7],
      primaryKingWenNumber: 1,
      derivedKingWenNumber: 1,
      changingLinePositions: [] as number[],
    },
    histories: { takashima: history, wuxing: history, meihua: history },
  };

  await assert.rejects(orchestrator.run(request), /链上提交失败/);
  assert.equal(provider.callCount("diviner/takashima"), 1);
  assert.equal(provider.callCount("diviner/wuxing"), 1);
  assert.equal(submitCalls.get("takashima"), 1);
  assert.equal(submitCalls.get("wuxing"), 1);

  const retried = await orchestrator.run(request);

  assert.equal(retried.predictions.length, 3);
  assert.equal(provider.callCount("diviner/takashima"), 1);
  assert.equal(provider.callCount("diviner/wuxing"), 1);
  assert.equal(provider.callCount("diviner/meihua"), 1);
  assert.equal(submitCalls.get("takashima"), 1);
  assert.equal(submitCalls.get("wuxing"), 2);
  assert.equal(submitCalls.get("meihua"), 1);
  assert.deepEqual(
    journal.events.filter((event) => event.type === "prediction-submitted").map((event) => event.payload.divinerKey),
    ["takashima", "wuxing", "meihua"],
  );
});

test("文件审计记录在不同进程实例之间也会禁止同一轮重跑", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "yijing-agent-journal-"));
  try {
    const first = new FileAgentRunJournal(directory);
    const handle = await first.claim(scope, 42n);
    await handle.record({ type: "proposition-compiled", payload: { predicateId: proposition.predicateId } });

    const second = new FileAgentRunJournal(directory);
    await assert.rejects(second.claim(scope, 42n), /禁止重跑择优/);
    const entries = (await readFile(handle.path, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(entries[0].type, "round-claimed");
    assert.equal(entries[1].type, "proposition-compiled");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
