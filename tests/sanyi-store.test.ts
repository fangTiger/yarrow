// tests/sanyi-store.test.ts
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ReadingStore, isReadingId, newReadingId } from "../src/sanyi/store.js";
import type { StoredQuestionReading as StoredReading } from "../src/sanyi/store.js";

function emptyReading(id = newReadingId()): StoredReading {
  return {
    id,
    kind: "question",
    createdAt: "2026-09-30T12:15:00.000Z",
    question: "这次面试能过吗",
    subject: {
      suggestedKey: "career",
      finalKey: "career",
      overridden: false,
      changes: 0,
    },
    payment: {
      payer: `0x${"11".repeat(20)}`,
      transactionHash: `0x${"22".repeat(32)}`,
      recipient: `0x${"33".repeat(20)}`,
      feeUsdc6: "50000",
    },
    throws: [],
    schools: {
      chengyi: { status: "pending", attempts: 0, retries: 0 },
      jingfang: { status: "pending", attempts: 0, retries: 0 },
      shaoyong: { status: "pending", attempts: 0, retries: 0 },
    },
    status: "awaiting-throws",
  };
}

async function withStore(
  run: (store: ReadingStore, root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "sanyi-store-"));
  try {
    await run(new ReadingStore(root), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("写读往返保留具体类型字段", async () => {
  await withStore(async (store) => {
    const reading = emptyReading();
    await store.write(reading);
    assert.deepEqual(await store.read(reading.id), reading);
  });
});

test("reading id 固定 26 位且一千次无重复", () => {
  const ids = Array.from({ length: 1_000 }, () => newReadingId());
  assert.equal(ids.every(isReadingId), true);
  assert.equal(new Set(ids).size, 1_000);
});

test("付款凭证跨 store 实例仍不可复用", async () => {
  await withStore(async (store, root) => {
    const id = newReadingId();
    assert.equal(await store.claimPayment("claim", id), null);
    assert.equal(await store.claimPayment("claim", newReadingId()), id);
    const restarted = new ReadingStore(root);
    assert.equal(await restarted.claimPayment("claim", newReadingId()), id);
  });
});

test("同一 reading 的二十次并发更新不丢失", async () => {
  await withStore(async (store) => {
    const reading = emptyReading();
    await store.write(reading);
    await Promise.all(Array.from({ length: 20 }, (_, index) => {
      return store.update(reading.id, (current) => {
        return { ...current, lines: [...(current.lines ?? []), index] };
      });
    }));
    assert.equal((await store.read(reading.id)).lines?.length, 20);
  });
});

test("非法 id 被拒绝且存档键不含生辰前缀", async () => {
  await withStore(async (store) => {
    await assert.rejects(store.read("../bad"), /reading id 无效/);
    const reading = emptyReading();
    await store.write(reading);
    const keys: string[] = [];
    JSON.stringify(await store.read(reading.id), (key, value) => {
      keys.push(key);
      return value;
    });
    assert.equal(keys.some((key) => /^birth/i.test(key)), false);
  });
});
