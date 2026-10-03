// tests/sanyi-api.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import type { QuestionFeeProof } from "../src/oracle/fee-payment.js";
import { createSanyiApi } from "../src/sanyi/api.js";
import {
  NotFoundError,
  NotOpenYetError,
  SanyiInputError,
} from "../src/sanyi/http-errors.js";
import type { StoredReading } from "../src/sanyi/store.js";
const ID = "abcdefghijklmnopqrstuvwxyz";
const PROOF: QuestionFeeProof = {
  payer: `0x${"11".repeat(20)}`,
  bundleId: "bundle-1",
  transactionHashes: [`0x${"22".repeat(32)}`],
};
function reading(): StoredReading {
  return {
    id: ID,
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
      payer: PROOF.payer,
      transactionHashes: PROOF.transactionHashes,
      firstHash: PROOF.transactionHashes[0]!,
      shares: [],
    },
    throws: [{
      index: 1,
      coins: [1, 0, 0],
      backs: 1,
      value: 7,
      name: "单",
      moving: false,
      blockNumber: "8",
      blockHash: `0x${"33".repeat(32)}`,
      blockTimestamp: "1790770501",
    }],
    schools: {
      chengyi: { status: "pending", attempts: 7, retries: 0 },
      jingfang: { status: "pending", attempts: 8, retries: 0 },
      shaoyong: { status: "pending", attempts: 9, retries: 0 },
    },
    status: "awaiting-throws",
    lines: [7, 8, 7, 8, 7, 8],
    castTime: "1790770501",
  };
}
function fixture() {
  const calls: string[] = [];
  const value = reading();
  const service = {
    async createQuestionReading(input: unknown) {
      calls.push(`create:${JSON.stringify(input)}`);
      return value;
    },
    async throwCoin(id: string, index: number) {
      calls.push(`throw:${id}:${index}`);
      return value.throws[0]!;
    },
    async getReading(id: string) {
      calls.push(`get:${id}`);
      if (id === "aaaaaaaaaaaaaaaaaaaaaaaaaa") {
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return value;
    },
    async retrySchool(id: string, key: "chengyi" | "jingfang" | "shaoyong") {
      calls.push(`retry:${id}:${key}`);
      return value;
    },
    async changeSubject(id: string, key: string) {
      calls.push(`subject:${id}:${key}`);
      return value;
    },
  };
  let milliseconds = Date.parse("2026-09-30T12:15:00.000Z");
  const api = createSanyiApi(service, { now: () => new Date(milliseconds) });
  return { api, calls, advance: (value: number) => { milliseconds += value; } };
}
test("校验问题、事项与掷序", async () => {
  const { api } = fixture();
  await assert.rejects(api.classify({ question: "" }), SanyiInputError);
  await assert.rejects(
    api.createReading({ question: "这次面试能过吗", subjectKey: "bad", feeProof: PROOF }),
    SanyiInputError,
  );
  await assert.rejects(api.throwCoin(ID, { index: "1" }), SanyiInputError);
});
test("命理与运势明确留待下一阶段", async () => {
  const { api } = fixture();
  for (const question of ["看看我的八字", "我今年运势如何"]) {
    await assert.rejects(api.createReading({ question, feeProof: PROOF }), (error: unknown) => {
      return error instanceof NotOpenYetError
        && error.message === "命理与运势将在下一阶段开放，可先改为问事";
    });
  }
});
test("未开放类型返回具体替代建议", async () => {
  const { api } = fixture();
  await assert.rejects(
    api.createReading({ question: "给女儿起个名字，姓王", feeProof: PROOF }),
    (error: unknown) => error instanceof SanyiInputError
      && /给孩子起名叫某某好不好/.test(error.message),
  );
});
test("公开 reading 保留复算材料但移除内部字段", async () => {
  const { api } = fixture();
  const value = await api.getReading(ID);
  const text = JSON.stringify(value);
  assert.equal(value.question, "这次面试能过吗");
  assert.equal(value.payment.firstHash, PROOF.transactionHashes[0]);
  assert.equal(value.throws[0]?.blockNumber, "8");
  assert.deepEqual(value.lines, [7, 8, 7, 8, 7, 8]);
  assert.equal(value.castTime, "1790770501");
  assert.doesNotMatch(text, /attempts|payer|transactionHashes|claimKey/);
});
test("存档 ENOENT 转换为 NotFoundError", async () => {
  const { api } = fixture();
  await assert.rejects(
    api.getReading("aaaaaaaaaaaaaaaaaaaaaaaaaa"),
    NotFoundError,
  );
});
test("now 在三十秒内复用对象，满三十秒刷新", async () => {
  const { api, advance } = fixture();
  const first = await api.now();
  advance(29_999);
  assert.equal(await api.now(), first);
  advance(1);
  assert.notEqual(await api.now(), first);
});
