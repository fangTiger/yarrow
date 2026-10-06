// tests/sanyi-reading-service.test.ts
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
  StructuredOutputProvider,
  StructuredOutputRequest,
} from "../src/agent/provider.js";
import { mockSingleFeeReceipt } from "../src/sanyi/mock-provider.js";
import type { SanyiFeeProof } from "../src/sanyi/fee.js";
import type { QuestionBlockSource } from "../src/oracle/question-oracle.js";
import { createSanyiLogger, type SanyiLogger } from "../src/sanyi/log.js";
import { mockSchoolOutput } from "../src/sanyi/mock-schools.js";
import {
  LimitExceededError,
  PaymentAlreadyUsedError,
  ReadingService,
  StateConflictError,
} from "../src/sanyi/reading-service.js";
import type { QuestionSchoolOutput } from "../src/sanyi/schema.js";
import type { FactTable } from "../src/sanyi/facts.js";
import type { QuestionSchoolKey } from "../src/sanyi/schools/index.js";
import { ReadingStore } from "../src/sanyi/store.js";
import { ArcUnavailableError } from "../src/sanyi/throws.js";

const TX = `0x${"22".repeat(32)}` as const;
const PROOF: SanyiFeeProof = {
  payer: `0x${"11".repeat(20)}`,
  transactionHash: TX,
};

class FakeBlockSource implements QuestionBlockSource {
  calls = 0;
  stalled = false;
  private height = 0n;

  async latest(): Promise<{
    number: bigint;
    hash: `0x${string}`;
    timestamp: bigint;
  }> {
    this.calls += 1;
    if (!this.stalled) {
      this.height += 1n;
    }
    return {
      number: this.height,
      hash: `0x${this.height.toString(16).padStart(64, "0")}`,
      timestamp: 1_790_776_500n + this.height,
    };
  }
}

function factsFromPrompt(prompt: string): FactTable {
  const facts: FactTable = new Map();
  for (const line of prompt.split("\n")) {
    const match = line.match(/^([a-z-]+(?::\w+)?)[：](.+)$/u);
    if (match?.[1] && match[2]) {
      facts.set(match[1], {
        id: match[1],
        label: match[2],
        tokens: new Set<string>(),
      });
    }
  }
  return facts;
}

interface ProviderGate {
  started: Promise<void>;
  release(): void;
}

class FakeProvider implements StructuredOutputProvider {
  readonly modelId = "fake";
  readonly providerConfig = {};
  readonly providerConfigHash = `0x${"00".repeat(32)}` as const;
  readonly calls = new Map<QuestionSchoolKey, number>();
  throwFor: QuestionSchoolKey | null = null;
  /** 只在前 N 次调用时抛错，用来测后台自动再试。 */
  throwTimes = new Map<QuestionSchoolKey, number>();
  rejectFor: QuestionSchoolKey | null = null;
  private readonly gates = new Map<
    QuestionSchoolKey,
    Array<{ wait: Promise<void>; markStarted(): void }>
  >();

  delayNext(key: QuestionSchoolKey): ProviderGate {
    let release = (): void => {};
    let markStarted = (): void => {};
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const queue = this.gates.get(key) ?? [];
    queue.push({ wait, markStarted });
    this.gates.set(key, queue);
    return { started, release };
  }

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    const key = request.taskId.split("/").at(-1) as QuestionSchoolKey;
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1);
    const gate = this.gates.get(key)?.shift();
    if (gate) {
      gate.markStarted();
      await gate.wait;
    }
    if (this.throwFor === key) {
      throw new Error("模型暂不可用");
    }
    const remaining = this.throwTimes.get(key) ?? 0;
    if (remaining > 0) {
      this.throwTimes.set(key, remaining - 1);
      throw new Error("模型暂时超时");
    }
    const output = mockSchoolOutput(key, factsFromPrompt(request.userPrompt));
    if (this.rejectFor === key) {
      return {
        ...output,
        verdict: "吉",
        confidenceTenths: 3,
      } as T;
    }
    return output as T;
  }
}

interface Fixture {
  root: string;
  store: ReadingStore;
  blocks: FakeBlockSource;
  provider: FakeProvider;
  logger: SanyiLogger;
  service: ReadingService;
}

async function fixture(input: {
  root?: string;
  calendarThrows?: boolean;
  paymentHash?: SanyiFeeProof["transactionHash"];
} = {}): Promise<Fixture> {
  const root = input.root ?? await mkdtemp(join(tmpdir(), "sanyi-service-"));
  const store = new ReadingStore(root);
  const blocks = new FakeBlockSource();
  const provider = new FakeProvider();
  const logger = createSanyiLogger(join(root, "log"), () => new Date(0));
  const service = new ReadingService({
    feeVerifier: {
      verify: async (proof: SanyiFeeProof) => mockSingleFeeReceipt({
        ...proof, transactionHash: input.paymentHash ?? proof.transactionHash,
      }),
    },
    blockSource: blocks,
    provider,
    store,
    logger,
    clock: () => new Date("2026-09-30T12:15:00.000Z"),
    // 这些用例测逐掷取区块的底层机制，关掉自动起卦，由测试手动逐掷。
    autoCast: false,
    waitOptions: {
      timeoutMs: 3,
      pollMs: 1,
      sleep: async () => {},
    },
    ...(input.calendarThrows
      ? {
          calendar: {
            almanacAt: () => {
              throw new Error("历法失败");
            },
            qimenAt: () => {
              throw new Error("不应继续计算奇门");
            },
          },
        }
      : {}),
  });
  return { root, store, blocks, provider, logger, service };
}

async function create(
  service: ReadingService,
  feeProof: SanyiFeeProof = PROOF,
) {
  return service.createQuestionReading({
    question: "这次面试能过吗",
    feeProof,
  });
}

async function castAll(service: ReadingService, id: string): Promise<void> {
  for (let index = 1; index <= 6; index += 1) {
    await service.throwCoin(id, index);
  }
  await service.whenSettled(id);
}

test("创建后为 awaiting-throws", async () => {
  const item = await fixture();
  try {
    assert.equal((await create(item.service)).status, "awaiting-throws");
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("六掷后按官鬼排盘且三家完成", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const done = await item.service.getReading(reading.id);
    assert.equal(done.status, "done");
    assert.equal(done.chart?.focus?.useGod, "官鬼");
    assert.deepEqual(
      Object.values(done.schools).map((state) => state.status),
      ["done", "done", "done"],
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("重复和并发同一掷幂等且只读取一次区块", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    const [left, right] = await Promise.all([
      item.service.throwCoin(reading.id, 1),
      item.service.throwCoin(reading.id, 1),
    ]);
    assert.deepEqual(left, right);
    const calls = item.blocks.calls;
    assert.deepEqual(await item.service.throwCoin(reading.id, 1), left);
    assert.equal(item.blocks.calls, calls);
    assert.equal((await item.service.getReading(reading.id)).throws.length, 1);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("乱序掷被拒绝", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await assert.rejects(item.service.throwCoin(reading.id, 2), /第 1 掷/);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("区块停滞保留前序掷且恢复后可续掷", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await item.service.throwCoin(reading.id, 1);
    item.blocks.stalled = true;
    await assert.rejects(
      item.service.throwCoin(reading.id, 2),
      (error: unknown) => error instanceof ArcUnavailableError,
    );
    assert.equal((await item.service.getReading(reading.id)).throws.length, 1);
    item.blocks.stalled = false;
    await item.service.throwCoin(reading.id, 2);
    assert.equal((await item.service.getReading(reading.id)).throws.length, 2);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("一家失败被隔离、可成功重试且每卦第三次重试超限", async () => {
  const item = await fixture();
  try {
    item.provider.throwFor = "chengyi";
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    let stored = await item.service.getReading(reading.id);
    assert.equal(stored.schools.chengyi.status, "failed");
    assert.equal(stored.schools.jingfang.status, "done");
    assert.equal(stored.schools.shaoyong.status, "done");
    item.provider.throwFor = null;
    await item.service.retrySchool(reading.id, "chengyi");
    await item.service.whenSettled(reading.id);
    stored = await item.service.getReading(reading.id);
    assert.equal(stored.schools.chengyi.status, "done");
    const second = await create(item.service, {
      ...PROOF,
      transactionHash: `0x${"44".repeat(32)}`,
    });
    item.provider.throwFor = "chengyi";
    await castAll(item.service, second.id);
    await item.service.retrySchool(second.id, "chengyi");
    await item.service.whenSettled(second.id);
    await item.service.retrySchool(second.id, "chengyi");
    await item.service.whenSettled(second.id);
    await assert.rejects(
      item.service.retrySchool(second.id, "chengyi"),
      (error: unknown) => error instanceof LimitExceededError,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("京房三次核对不过后删错留对照常展示，并记录校正处数", async () => {
  const item = await fixture();
  try {
    item.provider.rejectFor = "jingfang";
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const done = await item.service.getReading(reading.id);
    assert.equal(done.schools.jingfang.status, "done");
    assert.equal(done.schools.jingfang.output?.confidenceTenths, 6);
    assert.equal(done.schools.jingfang.adjusted, 1);
    assert.equal(done.schools.jingfang.removed, undefined);
    assert.equal(item.provider.calls.get("jingfang"), 3);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("模型调用偶发失败时后台自动再试一次，不占用户的免费重试", async () => {
  const item = await fixture();
  try {
    item.provider.throwTimes.set("shaoyong", 1);
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const done = await item.service.getReading(reading.id);
    assert.equal(done.schools.shaoyong.status, "done");
    assert.equal(done.schools.shaoyong.retries, 0);
    assert.equal(item.provider.calls.get("shaoyong"), 2);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("改事项只重跑京房且第四次修改超限", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const before = await item.service.getReading(reading.id);
    const calls = new Map(item.provider.calls);
    for (const key of ["wealth", "career", "wealth"] as const) {
      await item.service.changeSubject(reading.id, key);
      await item.service.whenSettled(reading.id);
    }
    const after = await item.service.getReading(reading.id);
    assert.equal(after.chart?.focus?.useGod, "妻财");
    assert.equal(item.provider.calls.get("jingfang"), (calls.get("jingfang") ?? 0) + 3);
    assert.equal(item.provider.calls.get("chengyi"), calls.get("chengyi"));
    assert.equal(item.provider.calls.get("shaoyong"), calls.get("shaoyong"));
    assert.deepEqual(after.schools.chengyi.output, before.schools.chengyi.output);
    assert.deepEqual(after.schools.shaoyong.output, before.schools.shaoyong.output);
    await assert.rejects(
      item.service.changeSubject(reading.id, "career"),
      (error: unknown) => error instanceof LimitExceededError,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("whenSettled 等待同一 reading 的全部后台任务", async () => {
  const item = await fixture();
  try {
    item.provider.throwFor = "chengyi";
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    item.provider.throwFor = null;
    const chengyi = item.provider.delayNext("chengyi");
    const jingfang = item.provider.delayNext("jingfang");
    await item.service.retrySchool(reading.id, "chengyi");
    await chengyi.started;
    await item.service.changeSubject(reading.id, "wealth");
    await jingfang.started;
    let settled = false;
    const waiting = item.service.whenSettled(reading.id).then(() => {
      settled = true;
    });
    chengyi.release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    jingfang.release();
    await waiting;
    assert.equal(settled, true);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("首次京房落笔期间不能改事项，完成后可以修改", async () => {
  const item = await fixture();
  try {
    const gate = item.provider.delayNext("jingfang");
    const reading = await create(item.service);
    for (let index = 1; index <= 6; index += 1) {
      await item.service.throwCoin(reading.id, index);
    }
    await gate.started;
    await assert.rejects(
      item.service.changeSubject(reading.id, "wealth"),
      (error: unknown) => error instanceof StateConflictError,
    );
    gate.release();
    await item.service.whenSettled(reading.id);
    await item.service.changeSubject(reading.id, "wealth");
    await item.service.whenSettled(reading.id);
    assert.equal(
      (await item.service.getReading(reading.id)).subject.finalKey,
      "wealth",
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("已完成的一家不能重试", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    await assert.rejects(
      item.service.retrySchool(reading.id, "chengyi"),
      (error: unknown) => error instanceof StateConflictError,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("并发第三次改事项只有一次成功", async () => {
  const item = await fixture();
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    for (const key of ["wealth", "career"] as const) {
      await item.service.changeSubject(reading.id, key);
      await item.service.whenSettled(reading.id);
    }
    const results = await Promise.allSettled([
      item.service.changeSubject(reading.id, "wealth"),
      item.service.changeSubject(reading.id, "documents"),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.equal(
      rejected.reason instanceof LimitExceededError
        || rejected.reason instanceof StateConflictError,
      true,
    );
    await item.service.whenSettled(reading.id);
    assert.equal((await item.service.getReading(reading.id)).subject.changes, 3);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("付款凭证跨 service 与 store 实例返回原 reading id", async () => {
  const item = await fixture();
  try {
    const first = await create(item.service);
    const restarted = await fixture({ root: item.root });
    await assert.rejects(create(restarted.service), (error: unknown) => {
      return error instanceof PaymentAlreadyUsedError
        && error.readingId === first.id;
    });
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("历法异常落为 failed 且不产生未处理拒绝", async () => {
  const item = await fixture({ calendarThrows: true });
  const unhandled: unknown[] = [];
  const listener = (reason: unknown): void => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", listener);
  try {
    const reading = await create(item.service);
    await castAll(item.service, reading.id);
    const failed = await item.service.getReading(reading.id);
    assert.equal(failed.status, "failed");
    assert.match(failed.error ?? "", /排盘失败/);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(unhandled.length, 0);
  } finally {
    process.off("unhandledRejection", listener);
    await rm(item.root, { recursive: true, force: true });
  }
});

test("日志文件存在且 birthDate 字段被过滤", async () => {
  const item = await fixture();
  try {
    await item.logger.write("测试日志", {
      birthDate: "不可记录",
      readingId: "safe-id",
    });
    const path = join(item.root, "log", "sanyi_1970-01-01.log");
    const log = await readFile(path, "utf8");
    assert.match(log, /测试日志/);
    assert.doesNotMatch(log, /birthDate|不可记录/);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("存档保存单笔付款字段且交易哈希忽略大小写防复用", async () => {
  const item = await fixture();
  try {
    const proof: SanyiFeeProof = { ...PROOF, transactionHash: `0x${"ab".repeat(32)}` };
    const first = await create(item.service, proof);
    assert.equal(first.payment.transactionHash, proof.transactionHash);
    assert.equal(first.payment.feeUsdc6, "50000");
    assert.ok(first.payment.recipient);
    assert.equal("shares" in first.payment, false);
    await assert.rejects(create(item.service, {
      ...proof, transactionHash: `0x${"AB".repeat(32)}`,
    }), (error: unknown) => error instanceof PaymentAlreadyUsedError && error.readingId === first.id);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test("原交易与加速交易对应同一确认回执时不可重复付款", async () => {
  const confirmedHash = `0x${"cd".repeat(32)}` as const;
  const item = await fixture({ paymentHash: confirmedHash });
  try {
    const first = await create(item.service);
    assert.equal(first.payment.transactionHash, confirmedHash);
    await assert.rejects(create(item.service, { ...PROOF, transactionHash: confirmedHash }),
      (error: unknown) => error instanceof PaymentAlreadyUsedError && error.readingId === first.id);
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});
