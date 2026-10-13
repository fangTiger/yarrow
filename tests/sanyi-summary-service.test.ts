// tests/sanyi-summary-service.test.ts
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { StructuredOutputRequest } from "../src/agent/provider.js";
import type { QuestionBlockSource } from "../src/oracle/question-oracle.js";
import type { SanyiFeeProof } from "../src/sanyi/fee.js";
import { createSanyiLogger } from "../src/sanyi/log.js";
import { MockSchoolsProvider, mockSingleFeeReceipt } from "../src/sanyi/mock-provider.js";
import { ReadingService, StateConflictError } from "../src/sanyi/reading-service.js";
import { ReadingStore } from "../src/sanyi/store.js";
import { getDaxiang } from "../src/agent/daxiang-corpus.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { expectedTone } from "../src/sanyi/summary.js";
import { shouldPollReading } from "../web/lib/reading-state.js";
import { baziFixture, birth, proof as baziProof } from "./helpers/bazi-service.js";

class Blocks implements QuestionBlockSource {
  height = 0n;
  async latest() {
    this.height += 1n;
    return {
      number: this.height,
      hash: `0x${this.height.toString(16).padStart(64, "0")}` as `0x${string}`,
      timestamp: 1_790_776_500n + this.height,
    };
  }
}

/** 可按任务前缀让 mock 调用失败若干次。 */
class FlakyMock extends MockSchoolsProvider {
  readonly failures = new Map<string, number>();
  override async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    for (const [prefix, remaining] of this.failures) {
      if (request.taskId.startsWith(prefix) && remaining !== 0) {
        this.failures.set(prefix, remaining - 1);
        throw new Error("模型暂时不可用");
      }
    }
    return super.generateStructured<T>(request);
  }
}

async function questionFixture(provider = new FlakyMock()) {
  const dir = await mkdtemp(join(tmpdir(), "sanyi-summary-"));
  const service = new ReadingService({
    feeVerifier: { verify: async (value: SanyiFeeProof) => mockSingleFeeReceipt(value) },
    blockSource: new Blocks(),
    provider,
    store: new ReadingStore(dir),
    logger: createSanyiLogger(join(dir, "log")),
    clock: () => new Date("2026-10-06T21:00:00+08:00"),
    waitOptions: { timeoutMs: 3, pollMs: 1, sleep: async () => {} },
  });
  let n = 0;
  const create = async () => {
    n += 1;
    const created = await service.createQuestionReading({
      question: "这次面试能过吗",
      feeProof: { payer: `0x${"11".repeat(20)}`, transactionHash: `0x${n.toString(16).padStart(64, "0")}` },
    });
    await service.whenSettled(created.id);
    return service.getReading(created.id);
  };
  return { dir, service, provider, create, close: () => rm(dir, { recursive: true, force: true }) };
}

function consensusOf(schools: Record<string, { status: string; output?: { confidenceTenths: number } }>): number {
  const values = Object.values(schools).flatMap((state) => {
    return state.status === "done" && state.output ? [state.output.confidenceTenths] : [];
  });
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

test("问事三家落笔后写白话总述，倾向合合议，写完才算完成", async () => {
  const f = await questionFixture();
  try {
    const reading = await f.create();
    assert.equal(reading.status, "done");
    assert.equal(reading.summary?.status, "done");
    assert.equal(reading.summary?.basis, 3);
    assert.equal(reading.summary?.output?.tone, expectedTone(consensusOf(reading.schools)));
    // 解法：心法原文取本卦《大象传》，由系统给出。
    const primary = deriveFiveHexagrams(reading.lines!).primary;
    assert.deepEqual(reading.summary?.anchor, {
      title: `《象传》· ${primary.name}`, lines: [getDaxiang(primary.kingWenNumber)],
    });
    assert.ok((reading.summary?.output?.remedy?.plan.length ?? 0) >= 2);
    assert.equal(reading.summary?.output?.advice, undefined);
  } finally {
    await f.close();
  }
});

test("一家未落笔时总述依据两家；三家都未落笔时总述不生成", async () => {
  const one = new FlakyMock();
  one.failures.set("sanyi/question/chengyi", -1);
  const f = await questionFixture(one);
  try {
    const reading = await f.create();
    assert.equal(reading.schools.chengyi.status, "failed");
    assert.equal(reading.summary?.status, "done");
    assert.equal(reading.summary?.basis, 2);
  } finally {
    await f.close();
  }
  const all = new FlakyMock();
  all.failures.set("sanyi/question/", -1);
  const g = await questionFixture(all);
  try {
    const reading = await g.create();
    assert.equal(reading.summary?.status, "failed");
    assert.equal(reading.summary?.basis, 0);
    assert.match(reading.summary?.error ?? "", /三家均未落笔/);
  } finally {
    await g.close();
  }
});

test("单家重试成功后重写总述，依据变为三家", async () => {
  const provider = new FlakyMock();
  provider.failures.set("sanyi/question/jingfang", 2);
  const f = await questionFixture(provider);
  try {
    const reading = await f.create();
    assert.equal(reading.summary?.basis, 2);
    await f.service.retrySchool(reading.id, "jingfang");
    await f.service.whenSettled(reading.id);
    const after = await f.service.getReading(reading.id);
    assert.equal(after.schools.jingfang.status, "done");
    assert.equal(after.summary?.basis, 3);
    assert.equal(after.summary?.status, "done");
  } finally {
    await f.close();
  }
});

test("总述调用两次都失败时可免费重试，至多两次；未失败不能重试", async () => {
  const provider = new FlakyMock();
  provider.failures.set("sanyi/summary/", 2);
  const f = await questionFixture(provider);
  try {
    const reading = await f.create();
    assert.equal(reading.summary?.status, "failed");
    await f.service.retrySummary(reading.id);
    await f.service.whenSettled(reading.id);
    const after = await f.service.getReading(reading.id);
    assert.equal(after.summary?.status, "done");
    assert.equal(after.summary?.retries, 1);
    await assert.rejects(f.service.retrySummary(reading.id), StateConflictError);
  } finally {
    await f.close();
  }
});

test("总述写作中时页面继续轮询", () => {
  const base = { kind: "question", status: "done", schools: {} } as never;
  assert.equal(shouldPollReading({ ...(base as object), summary: { status: "writing" } } as never), true);
  assert.equal(shouldPollReading({ ...(base as object), summary: { status: "done" } } as never), false);
});

test(
  "运势与命理也写白话总述：运势带倾向，命理带画像与走势但不带倾向",
  async () => {
    const f = await baziFixture();
    try {
      const fortune = await f.bazi.create({
        kind: "fortune", question: "我今年运势如何", birth, sect: 1,
        horizon: "year", feeProof: baziProof(1),
      });
      await f.bazi.whenSettled(fortune.id);
      const a = await f.bazi.getReading(fortune.id);
      assert.equal(a.status, "done");
      assert.equal(a.summary?.status, "done");
      assert.equal(a.summary?.basis, 3);
      assert.ok(a.summary?.output?.tone);
      assert.ok(a.summary?.output?.outlook);
      // 八字心法依据：三家取用与调候。
      assert.equal(a.summary?.anchor?.title, "三家取用");
      const lines = a.summary?.anchor?.lines.join("\n") ?? "";
      for (const name of ["沈孝瞻：", "余春台：", "任铁樵：", "调候："]) {
        assert.ok(lines.includes(name), name);
      }
      assert.ok(a.summary?.output?.remedy);
      const destiny = await f.bazi.create({
        kind: "destiny", question: "我适合做什么", birth, sect: 1,
        horizon: "year", feeProof: baziProof(2),
      });
      await f.bazi.whenSettled(destiny.id);
      const b = await f.bazi.getReading(destiny.id);
      assert.equal(b.summary?.status, "done");
      assert.equal(b.summary?.output?.tone, undefined);
      assert.ok(b.summary?.output?.outlook);
      assert.ok(b.summary?.output?.portrait);
      assert.ok(b.summary?.output?.remedy);
    } finally {
      await f.close();
    }
  },
);
