import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
  StructuredOutputProvider,
  StructuredOutputRequest,
} from "../src/agent/provider.js";
import type { QuestionBlockSource } from "../src/oracle/question-oracle.js";
import { createSanyiApi } from "../src/sanyi/api.js";
import { BaziReadingService } from "../src/sanyi/bazi-reading-service.js";
import type { SanyiFeeProof } from "../src/sanyi/fee.js";
import { createSanyiLogger } from "../src/sanyi/log.js";
import { MockSchoolsProvider, mockSingleFeeReceipt } from "../src/sanyi/mock-provider.js";
import { NamingReadingService } from "../src/sanyi/naming/service.js";
import { publicNamingReading } from "../src/sanyi/naming/public.js";
import { ReadingService } from "../src/sanyi/reading-service.js";
import type { DocumentBackend } from "../src/sanyi/storage.js";
import {
  ReadingStore,
  type StoredBaziReading,
  type StoredNamingReading,
  type StoredQuestionReading,
} from "../src/sanyi/store.js";
import { publicBaziReading } from "../src/sanyi/bazi-public.js";
import { birth } from "./helpers/bazi-service.js";
import { namingBirth } from "./helpers/naming-service.js";

const BASE_TIME = new Date("2026-10-15T12:00:00.000Z");

class MutableClock {
  private milliseconds = BASE_TIME.getTime();

  now = (): Date => new Date(this.milliseconds);

  advance(seconds: number): void {
    this.milliseconds += seconds * 1_000;
  }
}

class Blocks implements QuestionBlockSource {
  private height = 1n;

  async latest() {
    this.height += 1n;
    return {
      number: this.height,
      hash: `0x${this.height.toString(16).padStart(64, "0")}` as `0x${string}`,
      timestamp: 1_797_000_000n + this.height,
    };
  }
}

class FirstBlockGate implements QuestionBlockSource {
  private height = 1n;
  private releaseFirst!: () => void;
  private markStarted!: () => void;
  readonly started = new Promise<void>((resolve) => {
    this.markStarted = resolve;
  });
  private readonly gate = new Promise<void>((resolve) => {
    this.releaseFirst = resolve;
  });

  release(): void {
    this.releaseFirst();
  }

  async latest() {
    if (this.height === 1n) {
      this.markStarted();
      await this.gate;
    }
    this.height += 1n;
    return {
      number: this.height,
      hash: `0x${this.height.toString(16).padStart(64, "0")}` as `0x${string}`,
      timestamp: 1_797_000_000n + this.height,
    };
  }
}

class WritingGateProvider implements StructuredOutputProvider {
  readonly modelId = "writing-gate";
  readonly providerConfig = {};
  readonly providerConfigHash = `0x${"00".repeat(32)}` as const;
  private readonly delegate = new MockSchoolsProvider();
  private releaseSchools!: () => void;
  private releaseSummary!: () => void;
  private markSchoolStarted!: () => void;
  private markSummaryStarted!: () => void;
  readonly schoolsStarted = new Promise<void>((resolve) => {
    this.markSchoolStarted = resolve;
  });
  readonly summaryStarted = new Promise<void>((resolve) => {
    this.markSummaryStarted = resolve;
  });
  private readonly schoolGate = new Promise<void>((resolve) => {
    this.releaseSchools = resolve;
  });
  private readonly summaryGate = new Promise<void>((resolve) => {
    this.releaseSummary = resolve;
  });

  releaseSchoolWriting(): void {
    this.releaseSchools();
  }

  releaseSummaryWriting(): void {
    this.releaseSummary();
  }

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    if (request.taskId.startsWith("sanyi/summary/")) {
      this.markSummaryStarted();
      await this.summaryGate;
    } else {
      this.markSchoolStarted();
      await this.schoolGate;
    }
    return this.delegate.generateStructured<T>(request);
  }
}

function proof(index: number): SanyiFeeProof {
  return {
    payer: `0x${"11".repeat(20)}`,
    transactionHash: `0x${index.toString(16).padStart(64, "0")}`,
  };
}

function feeVerifier() {
  return { verify: async (value: SanyiFeeProof) => mockSingleFeeReceipt(value) };
}

async function questionFixture(provider: StructuredOutputProvider = new MockSchoolsProvider()) {
  const root = await mkdtemp(join(tmpdir(), "sanyi-resilience-question-"));
  const clock = new MutableClock();
  const store = new ReadingStore(root);
  const blocks = new Blocks();
  const service = new ReadingService({
    store,
    blockSource: blocks,
    provider,
    feeVerifier: feeVerifier(),
    logger: createSanyiLogger(join(root, "log"), clock.now),
    clock: clock.now,
    autoCast: false,
    waitOptions: { timeoutMs: 3, pollMs: 1, sleep: async () => {} },
  });
  return {
    root,
    clock,
    store,
    blocks,
    service,
    close: async () => rm(root, { recursive: true, force: true }),
  };
}

async function completeQuestion(
  fixture: Awaited<ReturnType<typeof questionFixture>>,
  index: number,
): Promise<StoredQuestionReading> {
  const created = await fixture.service.createQuestionReading({
    question: "这次面试能过吗",
    feeProof: proof(index),
  });
  for (let throwIndex = 1; throwIndex <= 6; throwIndex += 1) {
    await fixture.service.throwCoin(created.id, throwIndex);
  }
  await fixture.service.whenSettled(created.id);
  return fixture.service.getReading(created.id);
}

async function baziFixture() {
  const root = await mkdtemp(join(tmpdir(), "sanyi-resilience-bazi-"));
  const clock = new MutableClock();
  const store = new ReadingStore(root);
  const service = new BaziReadingService({
    store,
    provider: new MockSchoolsProvider(),
    feeVerifier: feeVerifier(),
    logger: createSanyiLogger(join(root, "log"), clock.now),
    clock: clock.now,
  });
  return {
    root,
    clock,
    store,
    service,
    close: async () => rm(root, { recursive: true, force: true }),
  };
}

async function completeBazi(
  fixture: Awaited<ReturnType<typeof baziFixture>>,
  index: number,
): Promise<StoredBaziReading> {
  const created = await fixture.service.create({
    kind: "fortune",
    question: "我今年运势如何",
    birth,
    sect: 1,
    horizon: "year",
    feeProof: proof(index),
  });
  await fixture.service.whenSettled(created.id);
  return fixture.service.getReading(created.id);
}

async function namingFixture() {
  const root = await mkdtemp(join(tmpdir(), "sanyi-resilience-naming-"));
  const clock = new MutableClock();
  const store = new ReadingStore(root);
  const service = new NamingReadingService({
    store,
    provider: new MockSchoolsProvider(),
    feeVerifier: feeVerifier(),
    logger: createSanyiLogger(join(root, "log"), clock.now),
    clock: clock.now,
  });
  return {
    root,
    clock,
    store,
    service,
    close: async () => rm(root, { recursive: true, force: true }),
  };
}

async function completeNaming(
  fixture: Awaited<ReturnType<typeof namingFixture>>,
  index: number,
): Promise<StoredNamingReading> {
  const created = await fixture.service.create({
    target: "person",
    surname: "张",
    gender: "female",
    length: 2,
    unborn: false,
    question: "温和有书卷气",
    birth: namingBirth,
    feeProof: proof(index),
  });
  await fixture.service.whenSettled(created.id);
  return fixture.service.getReading(created.id);
}

test("问事单家落笔超时后读取改判失败，不扣次数，并可重试成功", async () => {
  const fixture = await questionFixture();
  try {
    const done = await completeQuestion(fixture, 1);
    const startedAt = fixture.clock.now().toISOString();
    await fixture.store.update<StoredQuestionReading>(done.id, (reading) => ({
      ...reading,
      status: "writing",
      schools: {
        ...reading.schools,
        chengyi: { status: "writing", startedAt, attempts: 3, retries: 1 },
      },
    }));

    fixture.clock.advance(331);
    const recovered = await fixture.service.getReading(done.id);
    assert.equal(recovered.status, "done");
    assert.deepEqual(recovered.schools.chengyi, {
      status: "failed",
      attempts: 3,
      retries: 1,
      error: "落笔中断，请重试",
    });

    const retried = await fixture.service.retrySchool(done.id, "chengyi");
    assert.equal(retried.schools.chengyi.status, "writing");
    assert.equal(retried.schools.chengyi.startedAt, fixture.clock.now().toISOString());
    await fixture.service.whenSettled(done.id);
    assert.equal((await fixture.service.getReading(done.id)).schools.chengyi.status, "done");
  } finally {
    await fixture.close();
  }
});

test("首次落笔、改事项与换日重算的 writing 都记录注入时钟", async () => {
  const gate = new WritingGateProvider();
  const question = await questionFixture(gate);
  const bazi = await baziFixture();
  const naming = await namingFixture();
  try {
    const createdQuestion = await question.service.createQuestionReading({
      question: "这次面试能过吗",
      feeProof: proof(10),
    });
    for (let throwIndex = 1; throwIndex <= 6; throwIndex += 1) {
      await question.service.throwCoin(createdQuestion.id, throwIndex);
    }
    await gate.schoolsStarted;
    const writingQuestion = await question.store.read<StoredQuestionReading>(createdQuestion.id);
    for (const state of Object.values(writingQuestion.schools)) {
      assert.equal(state.startedAt, question.clock.now().toISOString());
    }
    gate.releaseSchoolWriting();
    await gate.summaryStarted;
    const writingSummary = await question.store.read<StoredQuestionReading>(createdQuestion.id);
    assert.equal(writingSummary.summary?.startedAt, question.clock.now().toISOString());
    gate.releaseSummaryWriting();
    await question.service.whenSettled(createdQuestion.id);

    const changedSubject = await question.service.changeSubject(createdQuestion.id, "wealth");
    assert.equal(changedSubject.schools.jingfang.startedAt, question.clock.now().toISOString());
    await question.service.whenSettled(createdQuestion.id);

    const createdBazi = await bazi.service.create({
      kind: "fortune",
      question: "我今年运势如何",
      birth,
      sect: 1,
      horizon: "year",
      feeProof: proof(11),
    });
    for (const state of Object.values(createdBazi.schools)) {
      assert.equal(state.startedAt, bazi.clock.now().toISOString());
    }
    await bazi.service.whenSettled(createdBazi.id);
    const changedDay = await bazi.service.changeDayBoundary(createdBazi.id, birth, 2);
    for (const state of Object.values(changedDay.schools)) {
      assert.equal(state.startedAt, bazi.clock.now().toISOString());
    }
    await bazi.service.whenSettled(createdBazi.id);

    const createdNaming = await naming.service.create({
      target: "person",
      surname: "张",
      gender: "female",
      length: 2,
      unborn: false,
      question: "温和有书卷气",
      birth: namingBirth,
      feeProof: proof(12),
    });
    for (const state of Object.values(createdNaming.families)) {
      assert.equal(state.startedAt, naming.clock.now().toISOString());
    }
    await naming.service.whenSettled(createdNaming.id);
  } finally {
    gate.releaseSchoolWriting();
    gate.releaseSummaryWriting();
    await Promise.all([question.close(), bazi.close(), naming.close()]);
  }
});

test("问事总述落笔超时后可免费重试成功", async () => {
  const fixture = await questionFixture();
  try {
    const done = await completeQuestion(fixture, 2);
    const summary = done.summary;
    assert.ok(summary);
    await fixture.store.update<StoredQuestionReading>(done.id, (reading) => ({
      ...reading,
      status: "writing",
      summary: {
        status: "writing",
        startedAt: fixture.clock.now().toISOString(),
        basis: summary.basis,
        attempts: 4,
        retries: 1,
      },
    }));

    fixture.clock.advance(331);
    const recovered = await fixture.service.getReading(done.id);
    assert.equal(recovered.status, "done");
    assert.equal(recovered.summary?.status, "failed");
    assert.equal(recovered.summary?.error, "落笔中断，请重试");
    assert.equal(recovered.summary?.retries, 1);

    const retried = await fixture.service.retrySummary(done.id);
    assert.equal(retried.summary?.startedAt, fixture.clock.now().toISOString());
    await fixture.service.whenSettled(done.id);
    assert.equal((await fixture.service.getReading(done.id)).summary?.status, "done");
  } finally {
    await fixture.close();
  }
});

test("八字单家与总述落笔超时后分别可重试成功", async () => {
  const fixture = await baziFixture();
  try {
    const done = await completeBazi(fixture, 3);
    const startedAt = fixture.clock.now().toISOString();
    await fixture.store.update<StoredBaziReading>(done.id, (reading) => ({
      ...reading,
      status: "writing",
      schools: {
        ...reading.schools,
        yuchuntai: { status: "writing", startedAt, attempts: 2, retries: 1 },
      },
    }));
    fixture.clock.advance(331);
    const recoveredSchool = await fixture.service.getReading(done.id);
    assert.equal(recoveredSchool.status, "done");
    assert.equal(recoveredSchool.schools.yuchuntai.status, "failed");
    assert.equal(recoveredSchool.schools.yuchuntai.error, "落笔中断，请重试");
    assert.equal(recoveredSchool.schools.yuchuntai.retries, 1);

    const retriedSchool = await fixture.service.retrySchool(done.id, "yuchuntai");
    assert.equal(retriedSchool.schools.yuchuntai.startedAt, fixture.clock.now().toISOString());
    await fixture.service.whenSettled(done.id);
    const afterSchool = await fixture.service.getReading(done.id);
    assert.equal(afterSchool.schools.yuchuntai.status, "done");

    const summary = afterSchool.summary;
    assert.ok(summary);
    await fixture.store.update<StoredBaziReading>(done.id, (reading) => ({
      ...reading,
      status: "writing",
      summary: {
        status: "writing",
        startedAt: fixture.clock.now().toISOString(),
        basis: summary.basis,
        attempts: 5,
        retries: 1,
      },
    }));
    fixture.clock.advance(331);
    const recoveredSummary = await fixture.service.getReading(done.id);
    assert.equal(recoveredSummary.status, "done");
    assert.equal(recoveredSummary.summary?.status, "failed");
    assert.equal(recoveredSummary.summary?.retries, 1);

    const retriedSummary = await fixture.service.retrySummary(done.id);
    assert.equal(retriedSummary.summary?.startedAt, fixture.clock.now().toISOString());
    await fixture.service.whenSettled(done.id);
    assert.equal((await fixture.service.getReading(done.id)).summary?.status, "done");
  } finally {
    await fixture.close();
  }
});

test("起名一家与总述落笔超时后分别可重试成功", async () => {
  const fixture = await namingFixture();
  try {
    const done = await completeNaming(fixture, 4);
    await fixture.store.update<StoredNamingReading>(done.id, (reading) => ({
      ...reading,
      status: "writing",
      families: {
        ...reading.families,
        shiwen: {
          status: "writing",
          startedAt: fixture.clock.now().toISOString(),
          attempts: 2,
          retries: 1,
        },
      },
    }));
    fixture.clock.advance(331);

    const recovered = await fixture.service.getReading(done.id);
    assert.equal(recovered.status, "done");
    assert.equal(recovered.families.shiwen.status, "failed");
    assert.equal(recovered.families.shiwen.error, "落笔中断，请重试");
    assert.equal(recovered.families.shiwen.retries, 1);

    const retried = await fixture.service.retryFamily(done.id, "shiwen");
    assert.equal(retried.families.shiwen.startedAt, fixture.clock.now().toISOString());
    await fixture.service.whenSettled(done.id);
    const afterFamily = await fixture.service.getReading(done.id);
    assert.equal(afterFamily.families.shiwen.status, "done");

    const summary = afterFamily.summary;
    assert.ok(summary);
    await fixture.store.update<StoredNamingReading>(done.id, (reading) => ({
      ...reading,
      status: "writing",
      summary: {
        status: "writing",
        startedAt: fixture.clock.now().toISOString(),
        basis: summary.basis,
        attempts: 4,
        retries: 1,
      },
    }));
    fixture.clock.advance(331);
    const recoveredSummary = await fixture.service.getReading(done.id);
    assert.equal(recoveredSummary.status, "done");
    assert.equal(recoveredSummary.summary?.status, "failed");
    assert.equal(recoveredSummary.summary?.retries, 1);
    await fixture.service.retrySummary(done.id);
    await fixture.service.whenSettled(done.id);
    assert.equal((await fixture.service.getReading(done.id)).summary?.status, "done");
  } finally {
    await fixture.close();
  }
});

test("落笔未超过 330 秒不变，旧存档没有 startedAt 也不变", async () => {
  const fixture = await questionFixture();
  try {
    const done = await completeQuestion(fixture, 5);
    const startedAt = fixture.clock.now().toISOString();
    await fixture.store.update<StoredQuestionReading>(done.id, (reading) => ({
      ...reading,
      status: "writing",
      schools: {
        ...reading.schools,
        chengyi: { status: "writing", startedAt, attempts: 1, retries: 0 },
      },
    }));
    fixture.clock.advance(330);
    assert.equal((await fixture.service.getReading(done.id)).schools.chengyi.status, "writing");

    await fixture.store.update<StoredQuestionReading>(done.id, (reading) => ({
      ...reading,
      schools: {
        ...reading.schools,
        chengyi: { status: "writing", attempts: 1, retries: 0 },
      },
    }));
    fixture.clock.advance(1_000);
    assert.equal((await fixture.service.getReading(done.id)).schools.chengyi.status, "writing");
  } finally {
    await fixture.close();
  }
});

class RacingBackend implements DocumentBackend {
  private documents = new Map<string, string>();
  completeBeforeNextCompare = false;

  async get(key: string): Promise<string> {
    const value = this.documents.get(key);
    if (value === undefined) {
      const error: NodeJS.ErrnoException = new Error("不存在");
      error.code = "ENOENT";
      throw error;
    }
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    this.documents.set(key, value);
  }

  async compareAndSet(key: string, expected: string, value: string): Promise<boolean> {
    if (this.completeBeforeNextCompare) {
      this.completeBeforeNextCompare = false;
      const current = JSON.parse(await this.get(key)) as StoredQuestionReading;
      this.documents.set(key, `${JSON.stringify({
        ...current,
        status: "done",
        schools: {
          ...current.schools,
          chengyi: { status: "done", attempts: 1, retries: 0 },
        },
      }, null, 2)}\n`);
    }
    if (this.documents.get(key) !== expected) return false;
    this.documents.set(key, value);
    return true;
  }

  async setIfAbsent(key: string, value: string): Promise<boolean> {
    if (this.documents.has(key)) return false;
    this.documents.set(key, value);
    return true;
  }

  async list(): Promise<string[]> {
    return [];
  }
}

test("恢复原子写回前若落笔已经完成，不把完成状态改判失败", async () => {
  const backend = new RacingBackend();
  const store = new ReadingStore(backend);
  const clock = new MutableClock();
  const id = "aaaaaaaaaaaaaaaaaaaaaaaaaa";
  const startedAt = clock.now().toISOString();
  const reading = {
    id,
    kind: "question",
    createdAt: startedAt,
    question: "测试",
    subject: { suggestedKey: "career", finalKey: "career", overridden: false, changes: 0 },
    payment: {
      payer: `0x${"11".repeat(20)}`,
      recipient: `0x${"22".repeat(20)}`,
      transactionHash: `0x${"33".repeat(32)}`,
      feeUsdc6: "50000",
    },
    throws: [],
    schools: {
      chengyi: { status: "writing", startedAt, attempts: 0, retries: 0 },
      jingfang: { status: "done", attempts: 1, retries: 0 },
      shaoyong: { status: "done", attempts: 1, retries: 0 },
    },
    status: "writing",
  } as StoredQuestionReading;
  await store.write(reading);
  const service = new ReadingService({
    store,
    blockSource: new Blocks(),
    provider: new MockSchoolsProvider(),
    feeVerifier: feeVerifier(),
    logger: { write: async () => {} },
    clock: clock.now,
    autoCast: false,
  });
  clock.advance(331);
  backend.completeBeforeNextCompare = true;

  const recovered = await service.getReading(id);
  assert.equal(recovered.status, "done");
  assert.equal(recovered.schools.chengyi.status, "done");
});

test("问事起卦 120 秒无进展后读取会暂停，continueCasting 可续掷", async () => {
  const fixture = await questionFixture();
  try {
    const created = await fixture.service.createQuestionReading({
      question: "这次面试能过吗",
      feeProof: proof(6),
    });
    assert.equal(created.castProgressAt, fixture.clock.now().toISOString());
    fixture.clock.advance(120);
    assert.equal((await fixture.service.getReading(created.id)).castPaused, undefined);
    fixture.clock.advance(1);

    const paused = await fixture.service.getReading(created.id);
    assert.equal(paused.status, "awaiting-throws");
    assert.equal(paused.castPaused, true);

    const continued = await fixture.service.continueCasting(created.id);
    assert.equal(continued.castPaused, undefined);
    assert.equal(continued.castProgressAt, fixture.clock.now().toISOString());
    await fixture.service.whenSettled(created.id);
    const completed = await fixture.service.getReading(created.id);
    assert.equal(completed.throws.length, 6);
    assert.equal(completed.status, "done");
  } finally {
    await fixture.close();
  }
});

test("旧待掷存档没有 castProgressAt 时按创建时间恢复暂停", async () => {
  const fixture = await questionFixture();
  try {
    const created = await fixture.service.createQuestionReading({
      question: "这次面试能过吗",
      feeProof: proof(14),
    });
    await fixture.store.update<StoredQuestionReading>(created.id, (reading) => {
      const next = { ...reading };
      delete next.castProgressAt;
      return next;
    });
    fixture.clock.advance(121);

    const paused = await fixture.service.getReading(created.id);
    assert.equal(paused.status, "awaiting-throws");
    assert.equal(paused.castPaused, true);
  } finally {
    await fixture.close();
  }
});

test("读取恢复暂停后，仍存活的自动起卦循环不再继续掷", async () => {
  const root = await mkdtemp(join(tmpdir(), "sanyi-resilience-live-cast-"));
  const clock = new MutableClock();
  const store = new ReadingStore(root);
  const blocks = new FirstBlockGate();
  const service = new ReadingService({
    store,
    blockSource: blocks,
    provider: new MockSchoolsProvider(),
    feeVerifier: feeVerifier(),
    logger: createSanyiLogger(join(root, "log"), clock.now),
    clock: clock.now,
  });
  try {
    const created = await service.createQuestionReading({
      question: "这次面试能过吗",
      feeProof: proof(13),
    });
    await blocks.started;
    clock.advance(121);
    assert.equal((await service.getReading(created.id)).castPaused, true);

    blocks.release();
    await service.whenSettled(created.id);
    const paused = await service.getReading(created.id);
    assert.equal(paused.status, "awaiting-throws");
    assert.equal(paused.castPaused, true);
    assert.equal(paused.throws.length, 1);

    await service.continueCasting(created.id);
    await service.whenSettled(created.id);
    const completed = await service.getReading(created.id);
    assert.equal(completed.status, "done");
    assert.equal(completed.throws.length, 6);
  } finally {
    blocks.release();
    await rm(root, { recursive: true, force: true });
  }
});

test("公开读取不包含 startedAt 与起卦内部进展时间", async () => {
  const question = await questionFixture();
  const bazi = await baziFixture();
  const naming = await namingFixture();
  try {
    const questionReading = await completeQuestion(question, 7);
    const baziReading = await completeBazi(bazi, 8);
    const namingReading = await completeNaming(naming, 9);
    assert.ok(baziReading.summary);
    assert.ok(namingReading.summary);
    const startedAt = question.clock.now().toISOString();
    await question.store.update<StoredQuestionReading>(questionReading.id, (reading) => ({
      ...reading,
      castProgressAt: startedAt,
      schools: {
        ...reading.schools,
        chengyi: { status: "writing", startedAt, attempts: 1, retries: 0 },
      },
    }));
    const pollingNaming = new NamingReadingService({
      store: question.store,
      provider: new MockSchoolsProvider(),
      feeVerifier: feeVerifier(),
      logger: createSanyiLogger(join(question.root, "polling-log"), question.clock.now),
      clock: question.clock.now,
    });
    const api = createSanyiApi(question.service, {
      now: question.clock.now,
      naming: pollingNaming,
    });
    question.clock.advance(331);
    const questionJson = JSON.stringify(await api.getReading(questionReading.id));
    assert.match(questionJson, /落笔中断，请重试/u);
    assert.doesNotMatch(questionJson, /startedAt|castProgressAt/u);

    const baziInternal: StoredBaziReading = {
      ...baziReading,
      schools: {
        ...baziReading.schools,
        shenxiaozhan: {
          ...baziReading.schools.shenxiaozhan,
          startedAt,
        },
      },
      summary: { ...baziReading.summary, startedAt },
    };
    const namingInternal: StoredNamingReading = {
      ...namingReading,
      families: {
        ...namingReading.families,
        wuxing: { ...namingReading.families.wuxing, startedAt },
      },
      summary: { ...namingReading.summary, startedAt },
    };
    assert.doesNotMatch(JSON.stringify(publicBaziReading(baziInternal)), /startedAt/u);
    assert.doesNotMatch(JSON.stringify(publicNamingReading(namingInternal)), /startedAt/u);
  } finally {
    await Promise.all([question.close(), bazi.close(), naming.close()]);
  }
});
