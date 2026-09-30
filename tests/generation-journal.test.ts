import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { hashText } from "../src/agent/audit.js";
import type { StructuredOutputProvider, StructuredOutputRequest } from "../src/agent/provider.js";
import { PREDICTION_OUTPUT_SCHEMA, type DivinerOutput } from "../src/agent/schemas.js";
import { FileGenerationJournal, ResumableStructuredGenerator } from "../src/replay/generation-journal.js";

const validRaw = JSON.stringify({ direction: "YES", probabilityBps: 5_100, reasoning: "首个合法输出" });
const request = {
  taskId: "replay/takashima",
  systemPrompt: "只输出 json",
  cacheSystemPrompt: true,
  userPrompt: "固定问题",
  schema: PREDICTION_OUTPUT_SCHEMA,
  effort: "high" as const,
};

function providerWithOneValid(callCounter: { value: number }): StructuredOutputProvider {
  return {
    modelId: "测试模型",
    providerConfig: { model: "测试模型" },
    providerConfigHash: `0x${"11".repeat(32)}`,
    generateStructured: async <T>(input: StructuredOutputRequest) => {
      callCounter.value += 1;
      await input.recordAttempt?.({
        attempt: 1,
        result: "valid",
        rawOutput: validRaw,
        rawOutputHash: hashText(validRaw),
        usage: { promptTokens: 100, completionTokens: 20, promptCacheHitTokens: 80, promptCacheMissTokens: 20 },
      });
      return JSON.parse(validRaw) as T;
    },
  };
}

test("首个合法输出落盘后，重启恢复必须复用它且不得再次调用 provider", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yijing-generation-journal-"));
  const journalPath = path.join(directory, "attempts.jsonl");
  const firstCalls = { value: 0 };
  const firstJournal = await FileGenerationJournal.open(journalPath);
  const first = new ResumableStructuredGenerator(providerWithOneValid(firstCalls), firstJournal);
  const output = await first.generate<DivinerOutput>("main/1/takashima", request);
  assert.equal(output.probabilityBps, 5_100);
  assert.equal(firstCalls.value, 1);

  const secondCalls = { value: 0 };
  const secondJournal = await FileGenerationJournal.open(journalPath);
  const second = new ResumableStructuredGenerator(providerWithOneValid(secondCalls), secondJournal);
  const recovered = await second.generate<DivinerOutput>("main/1/takashima", request);
  assert.deepEqual(recovered, output);
  assert.equal(secondCalls.value, 0);

  const entries = (await readFile(journalPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].rawOutputHash, hashText(validRaw));
  assert.equal(entries[0].result, "valid");
  assert.equal(entries[0].key, "main/1/takashima");
});

test("恢复时会校验日志中的原始输出哈希，损坏记录不得被采用", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yijing-generation-journal-"));
  const journalPath = path.join(directory, "attempts.jsonl");
  const journal = await FileGenerationJournal.open(journalPath);
  await assert.rejects(
    journal.recordAttempt("main/1/takashima", {
      attempt: 1,
      result: "valid",
      rawOutput: validRaw,
      rawOutputHash: `0x${"00".repeat(32)}`,
    }),
    /哈希不一致/,
  );
});

test("同一任务键若提示词发生变化必须拒绝恢复，不能静默复用或重生成", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yijing-generation-journal-"));
  const journalPath = path.join(directory, "attempts.jsonl");
  const calls = { value: 0 };
  const journal = await FileGenerationJournal.open(journalPath);
  const generator = new ResumableStructuredGenerator(providerWithOneValid(calls), journal);
  await generator.generate<DivinerOutput>("main/1/takashima", request);

  await assert.rejects(
    generator.generate<DivinerOutput>("main/1/takashima", { ...request, userPrompt: "另一个问题" }),
    /请求哈希不一致/,
  );
  assert.equal(calls.value, 1);
});
