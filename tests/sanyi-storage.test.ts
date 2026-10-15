import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ARC_MAINNET, ARC_TESTNET, resolveArcNetwork } from "../src/arc-network.js";
import { backendFromEnv, FileBackend, RedisBackend } from "../src/sanyi/storage.js";
import { ReadingStore, type StoredQuestionReading } from "../src/sanyi/store.js";
import { TranslationStore } from "../src/sanyi/translation/store.js";

/** 内存版 Upstash REST：只实现三易用到的命令，EVAL 按对应 Lua 的原子语义执行。 */
function fakeUpstash() {
  const data = new Map<string, string>();
  const commands: string[] = [];
  const fetchImplementation = (async (_url: string, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body)) as string[];
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer token");
    commands.push(args[0] as string);
    let result: unknown = null;
    const [name, ...rest] = args;
    if (name === "GET") result = data.get(rest[0] as string) ?? null;
    if (name === "SET" && rest[2] === "NX") {
      if (!data.has(rest[0] as string)) {
        data.set(rest[0] as string, rest[1] as string);
        result = "OK";
      }
    } else if (name === "SET") {
      data.set(rest[0] as string, rest[1] as string);
      result = "OK";
    }
    if (name === "EVAL") {
      if (rest.length === 4) {
        const [, , key, field] = rest as [string, string, string, string];
        const document = data.has(key)
          ? JSON.parse(data.get(key) as string) as { counts: Record<string, number> }
          : { counts: {} };
        document.counts[field] = (document.counts[field] ?? 0) + 1;
        data.set(key, JSON.stringify(document));
        result = document.counts[field];
      } else {
        const [, , key, expected, value] = rest as [string, string, string, string, string];
        result = data.get(key) === expected ? (data.set(key, value), 1) : 0;
      }
    }
    if (name === "SCAN") {
      const prefix = (rest[2] as string).slice(0, -1);
      result = ["0", [...data.keys()].filter((key) => key.startsWith(prefix))];
    }
    return new Response(JSON.stringify({ result }), { status: 200 });
  }) as typeof fetch;
  return { data, commands, backend: () => new RedisBackend({ url: "https://redis.example/", token: "token", fetch: fetchImplementation }) };
}

function reading(id: string): StoredQuestionReading {
  return { id, kind: "question", createdAt: "2026-10-13T00:00:00.000Z", question: "问", throws: [] } as unknown as StoredQuestionReading;
}

const ID = "a".repeat(26);

test("Redis 存储：读不到时抛 ENOENT，与文件存储一致", async () => {
  const store = new ReadingStore(fakeUpstash().backend());
  await assert.rejects(store.read(ID), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
});

test("Redis 存储：写入后另一个实例能读到，键名带命名空间", async () => {
  const upstash = fakeUpstash();
  await new ReadingStore(upstash.backend()).write(reading(ID));
  const other = new ReadingStore(upstash.backend());
  assert.equal((await other.read(ID)).question, "问");
  assert.ok(upstash.data.has(`sanyi:readings/${ID}`));
  assert.deepEqual(await other.listIds(), [ID]);
});

test("Redis 存储：两个实例并发更新同一卦，比较后写入不丢更新", async () => {
  const upstash = fakeUpstash();
  await new ReadingStore(upstash.backend()).write(reading(ID));
  const left = new ReadingStore(upstash.backend());
  const right = new ReadingStore(upstash.backend());
  const add = (store: ReadingStore, label: string) => store.update(ID, (current) => ({
    ...current, question: `${current.question}${label}`,
  }));
  await Promise.all([add(left, "甲"), add(right, "乙"), add(left, "丙"), add(right, "丁")]);
  const final = (await left.read(ID)).question;
  assert.equal(final.length, 5);
  for (const label of ["甲", "乙", "丙", "丁"]) assert.ok(final.includes(label));
  assert.ok(upstash.commands.includes("EVAL"));
});

test("Redis 存储：两百个实例原子累加同一 JSON 计数不丢更新", async () => {
  const upstash = fakeUpstash();
  await Promise.all(Array.from({ length: 200 }, () => (
    upstash.backend().incrementCounter("metrics/2026-10-16", "home_view")
  )));
  assert.deepEqual(JSON.parse(upstash.data.get("sanyi:metrics/2026-10-16") as string), {
    counts: { home_view: 200 },
  });
});

test("Redis 存储：同一笔付款只能认领一次，第二个实例拿到已有解读", async () => {
  const upstash = fakeUpstash();
  const claimKey = "0xpayer:0xhash";
  const [first, second] = await Promise.all([
    new ReadingStore(upstash.backend()).claimPayment(claimKey, ID),
    new ReadingStore(upstash.backend()).claimPayment(claimKey, "b".repeat(26)),
  ]);
  const results = [first, second].sort();
  assert.equal(results.filter((value) => value === null).length, 1);
  assert.ok(results.includes(ID) || results.includes("b".repeat(26)));
});

test("Redis 存储：译文首次更新时创建，之后按比较后写入合并", async () => {
  const upstash = fakeUpstash();
  const store = new TranslationStore(upstash.backend());
  assert.equal(await store.read(ID), undefined);
  await store.update(ID, (value) => ({ ...value, units: { ...value.units, a: { status: "done", sourceHash: "h", attempts: 1, failures: 0 } } }));
  await new TranslationStore(upstash.backend()).update(ID, (value) => ({ ...value, units: { ...value.units, b: { status: "pending", sourceHash: "h", attempts: 0, failures: 0 } } }));
  assert.deepEqual(Object.keys((await store.read(ID))?.units ?? {}).sort(), ["a", "b"]);
});

test("文件存储：磁盘格式保持不变", async () => {
  const root = await mkdtemp(join(tmpdir(), "sanyi-storage-"));
  await new ReadingStore(root).write(reading(ID));
  const text = await readFile(join(root, "readings", `${ID}.json`), "utf8");
  assert.equal(text, `${JSON.stringify(reading(ID), null, 2)}\n`);
  assert.equal(await new ReadingStore(root).claimPayment("k", ID), null);
  assert.equal(await new ReadingStore(root).claimPayment("k", "b".repeat(26)), ID);
});

test("按环境变量选存储：配了 Upstash 或 Vercel KV 用 Redis，否则用文件", () => {
  assert.ok(backendFromEnv({}) instanceof FileBackend);
  assert.ok(backendFromEnv({ KV_REST_API_URL: "https://x", KV_REST_API_TOKEN: "t" }) instanceof RedisBackend);
  assert.ok(backendFromEnv({ UPSTASH_REDIS_REST_URL: "https://x", UPSTASH_REDIS_REST_TOKEN: "t" }) instanceof RedisBackend);
});

test("Arc 网络：缺省测试网，5042 为主网，RPC 与网络相悖时拒绝", () => {
  assert.deepEqual(resolveArcNetwork({}), ARC_TESTNET);
  assert.deepEqual(resolveArcNetwork({ ARC_CHAIN_ID: "5042" }), ARC_MAINNET);
  assert.throws(() => resolveArcNetwork({ ARC_CHAIN_ID: "5042", ARC_RPC_URL: "https://rpc.testnet.arc.io" }));
  assert.throws(() => resolveArcNetwork({ ARC_CHAIN_ID: "5042002", ARC_RPC_URL: "https://rpc.mainnet.arc.io" }));
  assert.throws(() => resolveArcNetwork({ ARC_CHAIN_ID: "1" }));
  assert.equal(resolveArcNetwork({ ARC_CHAIN_ID: "5042", ARC_RPC_URL: "https://arc.example/rpc" }).rpcUrl,
    "https://arc.example/rpc");
});
