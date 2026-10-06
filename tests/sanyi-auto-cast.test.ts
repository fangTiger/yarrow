// tests/sanyi-auto-cast.test.ts
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { QuestionBlockSource } from "../src/oracle/question-oracle.js";
import type { SanyiFeeProof } from "../src/sanyi/fee.js";
import { createSanyiLogger } from "../src/sanyi/log.js";
import { MockSchoolsProvider, mockSingleFeeReceipt } from "../src/sanyi/mock-provider.js";
import { ReadingService, StateConflictError } from "../src/sanyi/reading-service.js";
import { ReadingStore } from "../src/sanyi/store.js";

class Blocks implements QuestionBlockSource {
  stalled = false;
  height = 0n;
  async latest() {
    if (this.stalled) {
      throw new Error("Arc RPC 无响应");
    }
    this.height += 1n;
    return {
      number: this.height,
      hash: `0x${this.height.toString(16).padStart(64, "0")}` as `0x${string}`,
      timestamp: 1_790_776_500n + this.height,
    };
  }
}

function proof(n: number): SanyiFeeProof {
  return { payer: `0x${"11".repeat(20)}`, transactionHash: `0x${n.toString(16).padStart(64, "0")}` };
}

async function fixture(root?: string, autoCast = true) {
  const dir = root ?? await mkdtemp(join(tmpdir(), "sanyi-cast-"));
  const blocks = new Blocks();
  const store = new ReadingStore(dir);
  const service = new ReadingService({
    feeVerifier: { verify: async (value: SanyiFeeProof) => mockSingleFeeReceipt(value) },
    blockSource: blocks,
    provider: new MockSchoolsProvider(),
    store,
    logger: createSanyiLogger(join(dir, "log")),
    clock: () => new Date("2026-10-06T21:00:00+08:00"),
    waitOptions: { timeoutMs: 3, pollMs: 1, sleep: async () => {} },
    autoCast,
    castRetry: { maxWaitMs: 50, sleep: async () => {} },
  });
  return { dir, blocks, store, service };
}

test("付款后服务端自动连掷六次并排盘落笔，无需客户端请求", async () => {
  const f = await fixture();
  try {
    const created = await f.service.createQuestionReading({ question: "这次面试能过吗", feeProof: proof(1) });
    assert.equal(created.status, "awaiting-throws");
    await f.service.whenSettled(created.id);
    const reading = await f.service.getReading(created.id);
    assert.equal(reading.throws.length, 6);
    assert.deepEqual(reading.throws.map((item) => item.index), [1, 2, 3, 4, 5, 6]);
    // 第一掷取付款所在区块（mock 回执为 1）之后的新区块，且逐掷严格递增
    const numbers = reading.throws.map((item) => BigInt(item.blockNumber));
    assert.ok(numbers[0]! > 1n);
    for (let i = 1; i < numbers.length; i += 1) {
      assert.ok(numbers[i]! > numbers[i - 1]!);
    }
    assert.equal(reading.status, "done");
    assert.equal(reading.castPaused, undefined);
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});

test("Arc 长时间无响应时保留已成之掷并暂停；继续起卦后从断点续掷", async () => {
  const f = await fixture();
  try {
    f.blocks.stalled = true;
    const created = await f.service.createQuestionReading({ question: "这次面试能过吗", feeProof: proof(2) });
    await f.service.whenSettled(created.id);
    let reading = await f.service.getReading(created.id);
    assert.equal(reading.status, "awaiting-throws");
    assert.equal(reading.castPaused, true);
    assert.equal(reading.throws.length, 0);
    await assert.rejects(f.service.continueCasting("aaaaaaaaaaaaaaaaaaaaaaaaaa"), /ENOENT|不存在/);
    f.blocks.stalled = false;
    await f.service.continueCasting(created.id);
    await f.service.whenSettled(created.id);
    reading = await f.service.getReading(created.id);
    assert.equal(reading.throws.length, 6);
    assert.equal(reading.status, "done");
    assert.equal(reading.castPaused, undefined);
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});

test("未暂停的卦不能「继续起卦」", async () => {
  const f = await fixture();
  try {
    const created = await f.service.createQuestionReading({ question: "这次面试能过吗", feeProof: proof(3) });
    await f.service.whenSettled(created.id);
    await assert.rejects(f.service.continueCasting(created.id), StateConflictError);
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});

test("服务重启后自动续掷未完成的卦，已成之掷不变", async () => {
  const first = await fixture(undefined, false);
  try {
    const created = await first.service.createQuestionReading({ question: "这次面试能过吗", feeProof: proof(4) });
    await first.service.throwCoin(created.id, 1);
    await first.service.throwCoin(created.id, 2);
    const before = (await first.service.getReading(created.id)).throws;
    const restarted = await fixture(first.dir, true);
    restarted.blocks.height = first.blocks.height;
    const resumed = await restarted.service.resumePendingCasts();
    assert.deepEqual(resumed, [created.id]);
    await restarted.service.whenSettled(created.id);
    const reading = await restarted.service.getReading(created.id);
    assert.deepEqual(reading.throws.slice(0, 2), before);
    assert.equal(reading.throws.length, 6);
    assert.equal(reading.status, "done");
  } finally {
    await rm(first.dir, { recursive: true, force: true });
  }
});
