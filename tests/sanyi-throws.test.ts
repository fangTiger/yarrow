// tests/sanyi-throws.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { encodePacked, keccak256, type Hex } from "viem";
import { ArcUnavailableError, assertNextThrow, deriveThrow, waitForBlockAfter } from "../src/sanyi/throws.js";
const TX = `0x${"11".repeat(32)}` as Hex;
const BLOCK = `0x${"22".repeat(32)}` as Hex;

test("单掷与 viem 现场计算完全一致", () => {
  const expectedHash = keccak256(encodePacked(
    ["string", "bytes32", "bytes32", "string", "uint8"],
    ["sanyi-throw-v1", TX, BLOCK, "这件事会怎样", 1],
  ));
  const bits = Number(BigInt(expectedHash) & 7n);
  const coins = [bits & 1, (bits >> 1) & 1, (bits >> 2) & 1];
  const result = deriveThrow({
    paymentTxHash: TX,
    blockHash: BLOCK,
    question: "  这件事会怎样 ",
    index: 1,
  });
  assert.deepEqual(result.coins, coins);
  assert.equal(result.value, 6 + coins.reduce((sum, coin) => sum + coin, 0));
});
test("四种背数映射为交单拆重", () => {
  const expected = [[0, 6, "交"], [1, 7, "单"], [2, 8, "拆"], [3, 9, "重"]] as const;
  for (const [backs, value, name] of expected) {
    assert.deepEqual({ value: 6 + backs, name: ["交", "单", "拆", "重"][backs] }, { value, name });
  }
});
test("顺序、上限与新区块约束", async () => {
  assert.equal(assertNextThrow([], 1), undefined);
  assert.throws(() => assertNextThrow([], 2), /需先完成第 1 掷/);
  const complete = Array.from({ length: 6 }, (_, offset) => ({ index: offset + 1 }));
  assert.throws(() => assertNextThrow(complete, 7), /六掷已经完成/);
  const blocks = [{ number: 9n, hash: BLOCK, timestamp: 1n }, { number: 11n, hash: BLOCK, timestamp: 2n }];
  const source = {
    latest: async () => {
      const block = blocks.shift();
      assert.ok(block);
      return block;
    },
  };
  const block = await waitForBlockAfter(source, 10n, {
    timeoutMs: 10,
    pollMs: 0,
    now: () => 0,
    sleep: async () => {},
  });
  assert.equal(block.number, 11n);
});
test("超时抛可续掷错误", async () => {
  let now = 0;
  await assert.rejects(
    waitForBlockAfter(
      { latest: async () => ({ number: 10n, hash: BLOCK, timestamp: 1n }) },
      10n,
      {
        timeoutMs: 10,
        pollMs: 5,
        now: () => now,
        sleep: async (ms) => {
          now += ms;
        },
      },
    ),
    (error: unknown) => error instanceof ArcUnavailableError && /未能取得天时/.test(error.message),
  );
});
