import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import type { Hex } from "viem";
import { throwFromHash } from "../src/sanyi/coins.js";
import {
  DailyHexagramService,
  DailyHexagramUnavailableError,
  beijingDate,
  beijingMidnightTimestamp,
  deriveDailyLines,
  findFirstBlockAtOrAfter,
  type DailyHexagramBlockClient,
  type DailyHexagram,
} from "../src/sanyi/daily-hexagram.js";
import { createFrontendHandler } from "../src/frontend/server.js";
import type { DocumentBackend } from "../src/sanyi/storage.js";

const BLOCK_HASH = `0x${"12".repeat(32)}` as Hex;

test("固定区块哈希与北京日期得到固定六爻", () => {
  assert.deepEqual(deriveDailyLines(BLOCK_HASH, "2026-10-18"), [8, 6, 7, 7, 8, 7]);
});

test("最低三位按一为背换算为与 deriveThrow 共用的 6–9 爻值", () => {
  for (let bits = 0; bits < 8; bits += 1) {
    const hash = `0x${bits.toString(16).padStart(64, "0")}` as Hex;
    const result = throwFromHash(hash, 1);
    const backs = [0, 1, 2].filter((position) => (bits & (1 << position)) !== 0).length;
    assert.equal(result.backs, backs);
    assert.equal(result.value, 6 + backs);
    assert.equal(result.moving, result.value === 6 || result.value === 9);
  }
});

test("北京时间以 UTC 16:00 为日期边界", () => {
  assert.equal(beijingDate(new Date("2026-10-17T15:59:59.999Z")), "2026-10-17");
  assert.equal(beijingDate(new Date("2026-10-17T16:00:00.000Z")), "2026-10-18");
  assert.equal(beijingMidnightTimestamp("2026-10-18"), 1_792_252_800n);
});

function linearClient(options: { failAt?: bigint } = {}): DailyHexagramBlockClient {
  return {
    async getBlock(input) {
      const number = "blockTag" in input ? 100n : input.blockNumber;
      assert.notEqual(number, undefined);
      if (number === options.failAt) throw new Error("rpc offline");
      return {
        number: number!,
        hash: `0x${number!.toString(16).padStart(64, "0")}` as Hex,
        timestamp: 1_000n + number! * 10n,
      };
    },
  };
}

test("二分查找时间戳不早于零点的最小区块号", async () => {
  const result = await findFirstBlockAtOrAfter(linearClient(), 1_455n);
  assert.ok(result);
  assert.equal(result.number, 46n);
  assert.equal(result.timestamp, 1_460n);
  assert.equal((await findFirstBlockAtOrAfter(linearClient(), 1_460n))?.number, 46n);
});

test("区块 RPC 出错时抛可识别错误并保留 cause", async () => {
  await assert.rejects(
    findFirstBlockAtOrAfter(linearClient({ failAt: 50n }), 1_455n),
    (error: unknown) => error instanceof DailyHexagramUnavailableError
      && error.cause instanceof Error
      && error.cause.message === "rpc offline",
  );
});

test("目标时间晚于最新区块时明确返回尚无新区块", async () => {
  assert.equal(await findFirstBlockAtOrAfter(linearClient(), 2_001n), null);
});

class MemoryBackend implements DocumentBackend {
  readonly values = new Map<string, string>();
  async get(key: string): Promise<string> {
    const value = this.values.get(key);
    if (value === undefined) {
      const error: NodeJS.ErrnoException = new Error("missing");
      error.code = "ENOENT";
      throw error;
    }
    return value;
  }
  async set(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async compareAndSet(key: string, expected: string, value: string): Promise<boolean> {
    if (this.values.get(key) !== expected) return false;
    this.values.set(key, value);
    return true;
  }
  async setIfAbsent(key: string, value: string): Promise<boolean> {
    if (this.values.has(key)) return false;
    this.values.set(key, value);
    return true;
  }
  async incrementCounter(): Promise<void> {}
  async list(): Promise<string[]> { return []; }
}

test("同一服务的同日并发请求只查链计算一次并返回同一份缓存", async () => {
  const backend = new MemoryBackend();
  let reads = 0;
  let latestReads = 0;
  const source = linearClient();
  const client: DailyHexagramBlockClient = {
    async getBlock(input) {
      reads += 1;
      if ("blockTag" in input) latestReads += 1;
      await new Promise((resolve) => setImmediate(resolve));
      return source.getBlock(input);
    },
  };
  const service = new DailyHexagramService({
    backend, client, chainId: 5_042, clock: () => new Date("1970-01-01T00:30:00.000Z"),
  });

  const [first, second] = await Promise.all([service.get(), service.get()]);
  const readsAfterFirstPair = reads;
  const third = await service.get();

  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
  assert.equal(reads, readsAfterFirstPair, "命中缓存后不应再读链");
  assert.equal(latestReads, 1, "并发请求只应启动一次链上定位");
  assert.equal(backend.values.size, 1);
  assert.ok(backend.values.has("daily-hexagram/1970-01-01"));
});

test("北京零点后链尚未出块时返回前一天已确定的卦", async () => {
  const service = new DailyHexagramService({
    backend: new MemoryBackend(),
    client: linearClient(),
    chainId: 5_042,
    clock: () => new Date("1970-01-01T16:30:00.000Z"),
  });
  const result = await service.get();
  assert.equal(result.date, "1970-01-01");
  assert.equal(result.block.number, "0");
});

test("setIfAbsent 竞争失败时重读胜出者，跨实例结果仍一致", async () => {
  const winner = {
    date: "1970-01-01",
    block: { number: "46", hash: `0x${"ab".repeat(32)}` as Hex, timestamp: "1460" },
    lines: [6, 7, 8, 9, 6, 7] as const,
    chainId: 5_042,
  };
  class RacingBackend extends MemoryBackend {
    override async setIfAbsent(key: string): Promise<boolean> {
      this.values.set(key, JSON.stringify(winner));
      return false;
    }
  }
  const service = new DailyHexagramService({
    backend: new RacingBackend(), client: linearClient(), chainId: 5_042,
    clock: () => new Date("1970-01-01T00:30:00.000Z"),
  });
  assert.deepEqual(await service.get(), winner);
});

async function dispatchDaily(get: () => Promise<DailyHexagram>, origin = "https://other.example") {
  const request = Readable.from([]) as IncomingMessage;
  Object.assign(request, { method: "GET", url: "/api/daily-hexagram", headers: {
    host: "local.test", origin,
  } });
  let status = 0;
  let headers: Record<string, string> = {};
  let payload = "";
  const response = {
    writeHead(nextStatus: number, nextHeaders: Record<string, string>) {
      status = nextStatus;
      headers = nextHeaders;
      return this;
    },
    end(chunk?: string) { payload = chunk ?? ""; return this; },
  } as unknown as ServerResponse;
  await createFrontendHandler({ dailyHexagram: { get } })(request, response);
  return { status, headers, payload: JSON.parse(payload) as unknown };
}

test("GET daily-hexagram 返回公开缓存头且不做同源校验", async () => {
  const result = {
    date: "2026-10-18",
    block: { number: "123", hash: BLOCK_HASH, timestamp: "1792252801" },
    lines: [8, 6, 7, 7, 8, 7],
    chainId: 5_042,
  };
  const response = await dispatchDaily(async () => result);
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "public, max-age=300");
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.deepEqual(response.payload, result);
});
