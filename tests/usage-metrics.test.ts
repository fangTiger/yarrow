import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import { MockSchoolsProvider, mockSingleFeeReceipt } from "../src/sanyi/mock-provider.js";
import {
  DocumentUsageMetrics,
  isFrontendMetricEvent,
  type MetricEvent,
  type MetricsRecorder,
} from "../src/sanyi/metrics.js";
import { ReadingService } from "../src/sanyi/reading-service.js";
import { BaziReadingService } from "../src/sanyi/bazi-reading-service.js";
import { NamingReadingService } from "../src/sanyi/naming/service.js";
import type { DocumentBackend } from "../src/sanyi/storage.js";
import { missingDocument } from "../src/sanyi/storage.js";
import { ReadingStore } from "../src/sanyi/store.js";
import { createFrontendHandler } from "../src/frontend/server.js";
import { track } from "../web/lib/metrics.js";
import { birth, proof } from "./helpers/bazi-service.js";
import { namingBirth, namingProof } from "./helpers/naming-service.js";

class MemoryBackend implements DocumentBackend {
  readonly documents = new Map<string, string>();
  failWrites = false;

  async get(key: string): Promise<string> {
    const value = this.documents.get(key);
    if (value === undefined) throw missingDocument(key);
    return value;
  }
  async set(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error("写入失败");
    this.documents.set(key, value);
  }
  async compareAndSet(key: string, expected: string, value: string): Promise<boolean> {
    if (this.failWrites) throw new Error("写入失败");
    if (this.documents.get(key) !== expected) return false;
    this.documents.set(key, value);
    return true;
  }
  async setIfAbsent(key: string, value: string): Promise<boolean> {
    if (this.failWrites) throw new Error("写入失败");
    if (this.documents.has(key)) return false;
    this.documents.set(key, value);
    return true;
  }
  async incrementCounter(key: string, field: string): Promise<void> {
    if (this.failWrites) throw new Error("写入失败");
    const current = this.documents.has(key)
      ? JSON.parse(this.documents.get(key) as string) as { counts: Record<string, number> }
      : { counts: {} };
    current.counts[field] = (current.counts[field] ?? 0) + 1;
    this.documents.set(key, JSON.stringify(current));
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.documents.keys()].filter((key) => key.startsWith(`${prefix}/`));
  }
}

const logger = { messages: [] as string[], async write(message: string) { this.messages.push(message); } };

test("指标按北京时间日期原子累加，并只接受事件白名单", async () => {
  const backend = new MemoryBackend();
  const metrics = new DocumentUsageMetrics({
    backend,
    logger,
    clock: () => new Date("2026-10-16T16:01:00.000Z"),
  });
  await Promise.all(Array.from({ length: 20 }, () => metrics.increment("home_view")));
  await metrics.increment("sample_view:naming");

  assert.deepEqual(JSON.parse(await backend.get("metrics/2026-10-17")), {
    counts: { home_view: 20, "sample_view:naming": 1 },
  });
  for (const event of ["home_view", "sample_view:question", "sample_view:destiny",
    "sample_view:fortune", "sample_view:naming", "wallet_connect_click", "pay_click",
    "pay_failed:rejected", "pay_failed:insufficient", "pay_failed:wrong-chain",
    "pay_failed:claim", "pay_failed:other"]) {
    assert.equal(isFrontendMetricEvent(event), true, event);
  }
  for (const event of ["sample_view:other", "reading_done:question", "home_view:0x1234",
    "pay_failed:timeout", "pay_failed:", ""]) {
    assert.equal(isFrontendMetricEvent(event), false, event);
  }
});

test("两百个指标实例并发写同一天时不丢失计数", async () => {
  const backend = new MemoryBackend();
  const metrics = Array.from({ length: 200 }, () => new DocumentUsageMetrics({
    backend,
    logger,
    clock: () => new Date("2026-10-16T04:00:00.000Z"),
  }));

  await Promise.all(metrics.map((recorder) => recorder.increment("home_view")));

  assert.deepEqual(JSON.parse(await backend.get("metrics/2026-10-16")), {
    counts: { home_view: 200 },
  });
});

test("读取最近日期包含空白日，计数失败只记日志", async () => {
  const backend = new MemoryBackend();
  const localLogger = { messages: [] as string[], async write(message: string) {
    this.messages.push(message);
  } };
  const metrics = new DocumentUsageMetrics({
    backend,
    logger: localLogger,
    clock: () => new Date("2026-10-16T04:00:00.000Z"),
  });
  await metrics.increment("pay_click");
  assert.deepEqual(await metrics.recentDays(2), [
    { date: "2026-10-15", counts: {} },
    { date: "2026-10-16", counts: { pay_click: 1 } },
  ]);
  backend.failWrites = true;
  await assert.doesNotReject(metrics.increment("home_view"));
  assert.match(localLogger.messages.at(-1) ?? "", /计数失败/u);
});

async function dispatch(options: {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  metrics: DocumentUsageMetrics;
  statsToken?: string;
}) {
  const method = options.method ?? "GET";
  const text = typeof options.body === "string" ? options.body : JSON.stringify(options.body ?? {});
  const request = Readable.from(method === "POST" ? [Buffer.from(text)] : []) as IncomingMessage;
  Object.assign(request, {
    method,
    url: options.path,
    headers: {
      host: "local.test",
      ...(method === "POST" ? { origin: "http://local.test", "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let status = 0;
  let payload = "";
  const response = {
    writeHead(nextStatus: number) { status = nextStatus; return this; },
    end(chunk?: string | Buffer) { payload = chunk?.toString() ?? ""; return this; },
  } as unknown as ServerResponse;
  await createFrontendHandler({
    metrics: options.metrics,
    ...(options.statsToken === undefined ? {} : { statsToken: options.statsToken }),
  })(request, response);
  return { status, text: payload, json: payload ? JSON.parse(payload) as unknown : undefined };
}

test("事件接口沿用安全边界、丢弃额外字段，统计接口校验口令与天数", async () => {
  const backend = new MemoryBackend();
  const metrics = new DocumentUsageMetrics({
    backend,
    logger,
    clock: () => new Date("2026-10-16T04:00:00.000Z"),
  });
  const request = (path: string, input: Omit<Parameters<typeof dispatch>[0], "path" | "metrics"> = {}) => (
    dispatch({ path, metrics, statsToken: "secret", ...input })
  );
  const accepted = await request("/api/events", {
    method: "POST",
    body: { event: "home_view", address: "0xprivate", question: "秘密" },
  });
  assert.equal(accepted.status, 204);
  assert.equal(accepted.text, "");
  const stored = await backend.get("metrics/2026-10-16");
  assert.doesNotMatch(stored, /0xprivate|秘密|address|question/u);

  assert.equal((await request("/api/events", {
    method: "POST", body: { event: "reading_done:question" },
  })).status, 400);
  assert.equal((await request("/api/events", {
    method: "POST", body: { event: "pay_failed:timeout" },
  })).status, 400);
  assert.equal((await request("/api/events", {
    method: "POST", body: {}, headers: { origin: "" },
  })).status, 403);
  assert.equal((await request("/api/events", {
    method: "POST", body: {}, headers: { "content-type": "text/plain" },
  })).status, 415);
  assert.equal((await request("/api/events", {
    method: "POST", body: { event: "home_view", padding: "x".repeat(9 * 1_024) },
  })).status, 413);

  assert.equal((await request("/api/stats")).status, 403);
  assert.equal((await request("/api/stats", { headers: { "x-stats-token": "wrong" } })).status, 403);
  const defaultWindow = await request("/api/stats", { headers: { "x-stats-token": "secret" } });
  assert.equal((defaultWindow.json as { days: unknown[] }).days.length, 14);
  assert.equal((await request("/api/stats?days=0", {
    headers: { "x-stats-token": "secret" },
  })).status, 400);
  assert.equal((await request("/api/stats?days=61", {
    headers: { "x-stats-token": "secret" },
  })).status, 400);
  const stats = await request("/api/stats?days=2", {
    headers: { "x-stats-token": "secret" },
  });
  assert.equal(stats.status, 200);
  assert.deepEqual(stats.json, { days: [
    { date: "2026-10-15", counts: {} },
    { date: "2026-10-16", counts: { home_view: 1 } },
  ] });
  assert.equal((await dispatch({
    path: "/api/stats", metrics, headers: { "x-stats-token": "anything" },
  })).status, 404);
});

test("前端 track 使用 keepalive、静默失败并仅对首页和示例去重", async () => {
  const calls: Array<{ body: string; keepalive: boolean | undefined }> = [];
  const fakeFetch: typeof fetch = async (_input, init) => {
    calls.push({ body: String(init?.body), keepalive: init?.keepalive });
    throw new Error("离线");
  };
  track("home_view", fakeFetch);
  track("home_view", fakeFetch);
  track("sample_view:question", fakeFetch);
  track("sample_view:question", fakeFetch);
  track("pay_click", fakeFetch);
  track("pay_click", fakeFetch);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(calls.map((call) => JSON.parse(call.body)), [
    { event: "home_view" }, { event: "sample_view:question" }, { event: "pay_click" }, { event: "pay_click" },
  ]);
  assert.ok(calls.every((call) => call.keepalive === true));
});

class EventRecorder implements MetricsRecorder {
  readonly events: MetricEvent[] = [];
  async increment(event: MetricEvent): Promise<void> { this.events.push(event); }
}

test("问事、八字、起名在创建成功与首次终态记录服务端事件", async () => {
  const backend = new MemoryBackend();
  const store = new ReadingStore(backend);
  const metrics = new EventRecorder();
  const provider = new MockSchoolsProvider();
  const clock = () => new Date("2026-10-16T12:00:00.000Z");
  const feeVerifier = { verify: async (value: Parameters<typeof mockSingleFeeReceipt>[0]) => (
    mockSingleFeeReceipt(value)
  ) };
  let height = 0n;
  const question = new ReadingService({
    store, provider, feeVerifier, metrics, logger,
    clock,
    blockSource: { latest: async () => {
      height += 1n;
      return { number: height, hash: `0x${height.toString(16).padStart(64, "0")}` as `0x${string}`,
        timestamp: 1_797_000_000n + height };
    } },
    waitOptions: { timeoutMs: 3, pollMs: 1, sleep: async () => {} },
  });
  const q = await question.createQuestionReading({ question: "这次面试能过吗", feeProof: proof(1) });
  await question.whenSettled(q.id);

  const bazi = new BaziReadingService({ store, provider, feeVerifier, metrics, logger, clock });
  const b = await bazi.create({ kind: "fortune", question: "今年运势如何", birth, sect: 1,
    horizon: "year", feeProof: proof(2) });
  await bazi.whenSettled(b.id);

  const naming = new NamingReadingService({ store, provider, feeVerifier, metrics, logger, clock });
  const n = await naming.create({ target: "person", surname: "张", gender: "female", length: 2,
    unborn: false, question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(3) });
  await naming.whenSettled(n.id);

  // 后台任务可能被平台重复调度；同一结果重复完成时不能重复记录终态。
  await (question as unknown as { finalize(id: string): Promise<void> }).finalize(q.id);
  await (bazi as unknown as { finish(id: string, countTerminal: boolean): Promise<void> })
    .finish(b.id, true);
  await (naming as unknown as { finish(id: string, countTerminal: boolean): Promise<void> })
    .finish(n.id, true);

  assert.deepEqual(metrics.events, [
    "reading_created:question", "reading_done:question",
    "reading_created:fortune", "reading_done:fortune",
    "reading_created:naming", "reading_done:naming",
  ]);
});

test("问事首次进入失败终态时记录 failed，计数器异常不影响创建", async () => {
  const clock = () => new Date("2026-10-16T12:00:00.000Z");
  const feeVerifier = { verify: async (value: Parameters<typeof mockSingleFeeReceipt>[0]) => (
    mockSingleFeeReceipt(value)
  ) };
  const metrics = new EventRecorder();
  const failedStore = new ReadingStore(new MemoryBackend());
  let height = 0n;
  const failed = new ReadingService({
    store: failedStore,
    provider: new MockSchoolsProvider(),
    feeVerifier,
    metrics,
    logger,
    clock,
    blockSource: { latest: async () => {
      height += 1n;
      return { number: height, hash: `0x${height.toString(16).padStart(64, "0")}` as `0x${string}`,
        timestamp: 1_797_000_000n + height };
    } },
    waitOptions: { timeoutMs: 3, pollMs: 1, sleep: async () => {} },
    calendar: {
      almanacAt: () => { throw new Error("排盘依赖故障"); },
      qimenAt: () => { throw new Error("排盘依赖故障"); },
    },
  });
  const created = await failed.createQuestionReading({
    question: "这次面试能过吗",
    feeProof: proof(11),
  });
  await failed.whenSettled(created.id);
  assert.equal((await failed.getReading(created.id)).status, "failed");
  assert.deepEqual(metrics.events, ["reading_created:question", "reading_failed:question"]);
  await (failed as unknown as {
    failReading(id: string, error: unknown, countTerminal: boolean): Promise<void>;
  }).failReading(created.id, new Error("重复失败调度"), true);
  assert.deepEqual(metrics.events, ["reading_created:question", "reading_failed:question"]);

  const safe = new ReadingService({
    store: new ReadingStore(new MemoryBackend()),
    provider: new MockSchoolsProvider(),
    feeVerifier,
    metrics: { increment: async () => { throw new Error("计数器故障"); } },
    logger,
    clock,
    autoCast: false,
    blockSource: { latest: async () => { throw new Error("不应取区块"); } },
  });
  await assert.doesNotReject(safe.createQuestionReading({
    question: "这次面试能过吗",
    feeProof: proof(12),
  }));
});

test("八字与起名的完成日志失败不改写结果状态或吞掉终态计数", async () => {
  const backend = new MemoryBackend();
  const store = new ReadingStore(backend);
  const metrics = new EventRecorder();
  const provider = new MockSchoolsProvider();
  const clock = () => new Date("2026-10-16T12:00:00.000Z");
  const feeVerifier = { verify: async (value: Parameters<typeof mockSingleFeeReceipt>[0]) => (
    mockSingleFeeReceipt(value)
  ) };
  const brokenLogger = { async write(message: string) {
    if (message.includes("完成")) throw new Error("日志故障");
  } };

  const bazi = new BaziReadingService({ store, provider, feeVerifier, metrics,
    logger: brokenLogger, clock });
  const b = await bazi.create({ kind: "fortune", question: "今年运势如何", birth, sect: 1,
    horizon: "year", feeProof: proof(21) });
  await bazi.whenSettled(b.id);

  const naming = new NamingReadingService({ store, provider, feeVerifier, metrics,
    logger: brokenLogger, clock });
  const n = await naming.create({ target: "person", surname: "张", gender: "female", length: 2,
    unborn: false, question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(22) });
  await naming.whenSettled(n.id);

  assert.equal((await bazi.getReading(b.id)).status, "done");
  assert.equal((await naming.getReading(n.id)).status, "done");
  assert.deepEqual(metrics.events, [
    "reading_created:fortune", "reading_done:fortune",
    "reading_created:naming", "reading_done:naming",
  ]);
});
