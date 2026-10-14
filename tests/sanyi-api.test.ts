// tests/sanyi-api.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import type { SanyiFeeProof } from "../src/sanyi/fee.js";
import { createSanyiApi } from "../src/sanyi/api.js";
import {
  NotFoundError,
  PaymentRequiredError,
  SanyiInputError,
  statusForError,
} from "../src/sanyi/http-errors.js";
import type { StoredQuestionReading as StoredReading } from "../src/sanyi/store.js";
const ID = "abcdefghijklmnopqrstuvwxyz";
const PROOF: SanyiFeeProof = {
  payer: `0x${"11".repeat(20)}`,
  transactionHash: `0x${"22".repeat(32)}`,
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
      transactionHash: PROOF.transactionHash,
      recipient: `0x${"33".repeat(20)}`,
      feeUsdc6: "50000",
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
    async continueCasting(id: string) {
      calls.push(`cast:${id}`);
      return value;
    },
    async retrySummary(id: string) {
      calls.push(`summary:${id}`);
      return value;
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
test("校验问题与事项；继续起卦走服务且不再提供单掷接口", async () => {
  const { api, calls } = fixture();
  await assert.rejects(api.classify({ question: "" }), SanyiInputError);
  await assert.rejects(
    api.createReading({ question: "这次面试能过吗", subjectKey: "bad", feeProof: PROOF }),
    SanyiInputError,
  );
  assert.equal("throwCoin" in api, false);
  await api.continueCasting(ID);
  assert.ok(calls.includes(`cast:${ID}`));
  await api.retrySummary(ID);
  assert.ok(calls.includes(`summary:${ID}`));
});
test("命理与运势缺生辰先给中文 400", async () => {
  const { api } = fixture();
  for (const question of ["看看我的八字", "我今年运势如何"]) {
    await assert.rejects(api.createReading({ question, feeProof: PROOF }), (error: unknown) => {
      return error instanceof SanyiInputError
        && error.message === "请先填写生辰";
    });
  }
});
test("起名开放但未装配服务时返回配置错误", async () => {
  const { api } = fixture();
  await assert.rejects(
    api.createReading({ question: "给女儿起个名字，姓王", feeProof: PROOF }),
    (error: unknown) => error instanceof Error && /起名服务尚未配置/.test(error.message),
  );
});
test("公开 reading 保留复算材料但移除内部字段", async () => {
  const { api } = fixture();
  const value = await api.getReading(ID);
  const text = JSON.stringify(value);
  assert.equal(value.question, "这次面试能过吗");
  assert.equal(value.payment.firstHash, PROOF.transactionHash);
  assert.equal(value.kind, "question");
  if (value.kind !== "question") {
    throw new Error("问事类型不符");
  }
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

test("付款配置下发服务器收款地址与链信息", async () => {
  const { api } = fixture();
  assert.deepEqual(await api.payment(), {
    recipient: "0x737301a6A40ea453A877627c409EF5756a395DB9",
    amountUsdc6: "50000", token: "0x3600000000000000000000000000000000000000", chainId: 5042002,
  });
});
test("拒绝缺失或非法单笔付款凭证", async () => {
  const { api } = fixture();
  for (const feeProof of [{ payer: PROOF.payer }, { ...PROOF, payer: "bad" },
    { ...PROOF, transactionHash: "0x12" }, []]) {
    await assert.rejects(api.createReading({ question: "这次面试能过吗", feeProof }), SanyiInputError);
  }
});

test("缺少付款凭证时返回 402 与付款要求，供 agent 发现价格与收款方", async () => {
  const { api, calls } = fixture();
  const error = await api.createReading({ question: "这次面试能过吗", kind: "question", subjectKey: "career" })
    .then(() => undefined, (caught: unknown) => caught);
  assert.ok(error instanceof PaymentRequiredError);
  assert.equal(statusForError(error), 402);
  assert.equal(error.code, "payment-proof-required");
  assert.deepEqual(error.payment, await api.payment());
  assert.equal(calls.length, 0, "未付款不得进入服务");
  for (const feeProof of [null, undefined]) {
    await assert.rejects(api.createReading({ question: "这次面试能过吗", feeProof }), PaymentRequiredError);
  }
});

test("请求本身无效时先给 400，不让 agent 为无效请求付款", async () => {
  const { api } = fixture();
  const short = await api.createReading({ question: "能过吗", kind: "question" })
    .then(() => undefined, (caught: unknown) => caught);
  assert.ok(short instanceof SanyiInputError && !(short instanceof PaymentRequiredError));
  assert.equal(statusForError(short), 400);
  const noBirth = await api.createReading({ question: "我这一生的运势走向与性格如何？", kind: "destiny" })
    .then(() => undefined, (caught: unknown) => caught);
  assert.equal(statusForError(noBirth), 400);
});
