// tests/sanyi-bazi-reading-service.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { baziFixture, birth, proof } from "./helpers/bazi-service.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { statusForError } from "../src/sanyi/http-errors.js";
import { yearConsensus } from "../src/sanyi/bazi-public.js";
import type { StoredBaziReading } from "../src/sanyi/store.js";
async function create(f: Awaited<ReturnType<typeof baziFixture>>, index = 1,
  kind: "destiny" | "fortune" = "fortune") {
  const value = await f.bazi.create({ kind, question: kind === "fortune" ? "我今年运势如何" : "看看我的八字",
    birth, sect: 1, horizon: "year", feeProof: proof(index) });
  await f.bazi.whenSettled(value.id);
  return f.bazi.getReading(value.id);
}
test("缺生辰入口返回中文 400，非法生辰不调用付款", async () => {
  const f = await baziFixture();
  try {
    for (const question of ["我今年运势如何", "看看我的八字"]) {
      await assert.rejects(f.api.createReading({ question, feeProof: proof() }), (error: unknown) => {
        return error instanceof Error && error.message === "请先填写生辰" && statusForError(error) === 400;
      });
    }
    await assert.rejects(f.api.createReading({ question: "我今年运势如何", birth: {}, feeProof: proof() }));
    assert.equal(f.calls.payments, 0);
  } finally {
    await f.close();
  }
});
test("英文八字存档意图，各家与总述终态通知且通知异常不影响完成", async () => {
  const events: string[] = [];
  const f = await baziFixture(new MockSchoolsProvider(), { onUnitSettled: async (_id, unitKey) => {
    events.push(unitKey);
    throw new Error("旁路通知失败");
  } });
  try {
    const created = await f.bazi.create({ kind: "fortune", question: "今年运势如何", birth,
      sect: 1, horizon: "year", feeProof: proof(81), lang: "en" });
    assert.equal(created.lang, "en");
    assert.equal(created.translateTo, undefined);
    await f.bazi.whenSettled(created.id);
    assert.deepEqual(events.sort(), ["shenxiaozhan", "yuchuntai", "rentieqiao", "summary"].sort());
    const settled = await f.bazi.getReading(created.id);
    assert.equal(settled.status, "done");
    assert.equal((await f.api.getReading(created.id)).lang, "en");
    await f.store.update<StoredBaziReading>(created.id, (reading) => ({ ...reading, schools: {
      ...reading.schools, yuchuntai: { status: "failed", attempts: 1, retries: 0 },
    } }));
    events.length = 0;
    await f.bazi.retrySchool(created.id, "yuchuntai");
    await f.bazi.whenSettled(created.id);
    assert.deepEqual(events, ["yuchuntai", "summary"]);
    await f.store.update<StoredBaziReading>(created.id, (reading) => ({ ...reading,
      summary: { status: "failed", basis: 3, attempts: 1, retries: 0 },
    }));
    events.length = 0;
    await f.bazi.retrySummary(created.id);
    await f.bazi.whenSettled(created.id);
    assert.deepEqual(events, ["summary"]);
  } finally {
    await f.close();
  }
});
test("付款核验在排盘模型之前；跨三类型及重启后付款不可复用", async () => {
  const f = await baziFixture();
  try {
    const first = await create(f);
    for (const kind of ["destiny", "fortune"] as const) {
      await assert.rejects(create(f, 1, kind), /付款凭证已用于/);
    }
    await assert.rejects(f.question.createQuestionReading({ question: "这次面试能过吗", feeProof: proof() }),
      /付款凭证已用于/);
    const q = await f.question.createQuestionReading({ question: "这次面试能过吗", feeProof: proof(2) });
    await assert.rejects(create(f, 2), /付款凭证已用于/);
    const second = await create(f, 3, "destiny");
    await assert.rejects(create(f, 3), /付款凭证已用于/);
    assert.notEqual(q.id, first.id);
    assert.notEqual(second.id, first.id);
    // 同一目录新 store 实例验证持久化付款索引。
    const { ReadingStore } = await import("../src/sanyi/store.js");
    assert.equal(await new ReadingStore(f.root).claimPayment(proof().transactionHash, "unused"), first.id);
    // 核验拒绝时，即使排盘模块依赖抛错，也必须优先返回付款错误。
    const { BaziReadingService } = await import("../src/sanyi/bazi-reading-service.js");
    let modelCalls = 0;
    const denied = new BaziReadingService({ store: f.store, clock: () => new Date("2026-10-06T13:00:00Z"),
      logger: { write: async () => {} }, feeVerifier: { verify: async () => {
        throw new Error("付款核验拒绝");
      } }, provider: { ...new MockSchoolsProvider(), generateStructured: async <T>() => {
        modelCalls += 1;
        return {} as T;
      } } });
    await assert.rejects(denied.create({ kind: "fortune", question: "运势如何", birth: {},
      sect: 1, horizon: "year", feeProof: proof(4) }), /付款核验拒绝/);
    assert.equal(modelCalls, 0);
  } finally {
    await f.close();
  }
});
test("三家并行、一家失败隔离，免费重试最多两次", { timeout: 2_000 }, async () => {
  const mock = new MockSchoolsProvider();
  let fail = true;
  let started = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const f = await baziFixture({ ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
    started += 1;
    if (started === 3) {
      release();
    }
    await gate;
    if (fail && request.taskId.endsWith("yuchuntai")) {
      throw new Error("供应商失败");
    }
    return mock.generateStructured<T>(request);
  } });
  try {
    const r = await create(f);
    // 三家并行各调一次，余春台失败后后台自动再试一次，再加一次白话总述，共 5 次。
    assert.equal(started, 5);
    assert.equal(r.status, "done");
    assert.equal(r.schools.yuchuntai.status, "failed");
    assert.equal(r.schools.shenxiaozhan.status, "done");
    assert.equal(r.schools.rentieqiao.status, "done");
    assert.equal(yearConsensus(r)[0]?.count, 2);
    await f.bazi.retrySchool(r.id, "yuchuntai");
    await f.bazi.whenSettled(r.id);
    fail = false;
    await f.bazi.retrySchool(r.id, "yuchuntai");
    await f.bazi.whenSettled(r.id);
    assert.equal((await f.bazi.getReading(r.id)).schools.yuchuntai.status, "done");
    assert.equal(f.calls.payments, 1);
    await assert.rejects(f.bazi.retrySchool(r.id, "yuchuntai"), /不可重试/);
  } finally {
    release();
    await f.close();
  }
});
test("模型调用偶发失败时后台自动再试一次，不占用户免费重试", async () => {
  const mock = new MockSchoolsProvider();
  let failures = 1;
  const f = await baziFixture({ ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
      if (failures > 0 && request.taskId.endsWith("rentieqiao")) {
        failures -= 1;
        throw new Error("供应商超时");
      }
      return mock.generateStructured<T>(request);
    } });
  try {
    const r = await create(f);
    assert.equal(r.schools.rentieqiao.status, "done");
    assert.equal(r.schools.rentieqiao.retries, 0);
  } finally {
    await f.close();
  }
});
test("三家落笔不合格时删错留对照常展示，并记录删去处数", async () => {
  const mock = new MockSchoolsProvider();
  const f = await baziFixture({ ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
      const output = await mock.generateStructured<Record<string, unknown>>(request);
      if (request.taskId.endsWith("shenxiaozhan")) {
        return { ...output, reason: `${String(output.reason)}子午冲。` } as T;
      }
      return output as T;
    } });
  try {
    const r = await create(f);
    const state = r.schools.shenxiaozhan;
    assert.equal(state.status, "done");
    assert.doesNotMatch(String(state.output?.reason), /子午冲/);
    assert.ok((state.removed ?? 0) >= 1);
  } finally {
    await f.close();
  }
});
test("全失败免费重试限额，合议每年 null", async () => {
  const mock = new MockSchoolsProvider();
  const f = await baziFixture({ ...mock, generateStructured: async () => {
    throw new Error("失败");
  } });
  try {
    const r = await create(f);
    assert.deepEqual(yearConsensus(r), Array(10).fill(null));
    for (let index = 0; index < 2; index += 1) {
      await f.bazi.retrySchool(r.id, "yuchuntai");
      await f.bazi.whenSettled(r.id);
    }
    await assert.rejects(f.bazi.retrySchool(r.id, "yuchuntai"), /次数已用尽/);
    assert.equal(f.calls.payments, 1);
  } finally {
    await f.close();
  }
});
test("逐年算术平均保留一位，范围与 count 只含 done，一家也照算", async () => {
  const f = await baziFixture();
  try {
    const r = await create(f);
    for (const [key, value] of [["shenxiaozhan", 7], ["yuchuntai", 5], ["rentieqiao", 7]] as const) {
      const state = r.schools[key];
      if (!state.output || !("years" in state.output)) {
        throw new Error("缺运势输出");
      }
      state.output.years = state.output.years.map((item) => ({ ...item, confidenceTenths: value }));
    }
    assert.deepEqual(yearConsensus(r)[0], { year: 2023, average: 6.3, min: 5, max: 7, count: 3 });
    r.schools.yuchuntai.status = "failed";
    r.schools.rentieqiao.status = "failed";
    assert.deepEqual(yearConsensus(r)[0], { year: 2023, average: 7, min: 7, max: 7, count: 1 });
    r.schools.shenxiaozhan.status = "failed";
    assert.equal(yearConsensus(r)[0], null);
  } finally {
    await f.close();
  }
});
test("换日重传核验四柱，两次免费重跑；并发请求不越限", async () => {
  const f = await baziFixture();
  try {
    const r = await create(f);
    await assert.rejects(f.bazi.changeDayBoundary(r.id, { ...birth, day: 16 }, 2), (error: unknown) => {
      return error instanceof Error && error.message === "生辰与本卦命盘不符" && statusForError(error) === 400;
    });
    await assert.rejects(f.bazi.changeDayBoundary(r.id, { ...birth, gender: "female" }, 2),
      (error: unknown) => error instanceof Error && statusForError(error) === 400
        && error.message === "生辰与本卦命盘不符");
    const changed = await f.bazi.changeDayBoundary(r.id, birth, 2);
    assert.equal(changed.changes, 1);
    await f.bazi.whenSettled(r.id);
    const done = await f.bazi.getReading(r.id);
    assert.equal(done.chart.sect, 2);
    assert.ok(Object.values(done.schools).every((state) => state.status === "done" && state.attempts === 2));
    const both = await Promise.allSettled([
      f.bazi.changeDayBoundary(r.id, birth, 1), f.bazi.changeDayBoundary(r.id, birth, 1),
    ]);
    assert.equal(both.filter((item) => item.status === "fulfilled").length, 1);
    await f.bazi.whenSettled(r.id);
    await assert.rejects(f.bazi.changeDayBoundary(r.id, birth, 2), (error: unknown) => {
      return error instanceof Error && /换日切换次数已用尽/.test(error.message) && statusForError(error) === 409;
    });
    assert.equal(f.calls.payments, 1);
    assert.equal((await f.bazi.getReading(r.id)).changes, 2);
  } finally {
    await f.close();
  }
});
test("晚子时切换日柱，重启后凭派生盘可免费重试，无原始缓存", async () => {
  const f = await baziFixture();
  try {
    const late = { ...birth, year: 2000, month: 11, day: 3, time: { hour: 23, minute: 20 } };
    const r = await f.bazi.create({ kind: "fortune", question: "今年运势如何", birth: late,
      sect: 1, horizon: "year", feeProof: proof() });
    await f.bazi.whenSettled(r.id);
    await f.bazi.changeDayBoundary(r.id, late, 2);
    await f.bazi.whenSettled(r.id);
    assert.notEqual((await f.bazi.getReading(r.id)).chart.pillars.day.ganZhi, r.chart.pillars.day.ganZhi);
    const text = await readFile(join(f.root, "readings", `${r.id}.json`), "utf8");
    assert.ok(!text.includes("23:20"));
    assert.ok(!text.includes("2000-11-03"));
  } finally {
    await f.close();
  }
});
test("旧问事存档原样读出，公开响应按类型区分并附此刻黄历", async () => {
  const f = await baziFixture();
  try {
    const q = await f.question.createQuestionReading({ question: "这次面试能过吗", feeProof: proof() });
    assert.deepEqual(await f.store.read(q.id), q);
    const old = await f.api.getReading(q.id);
    assert.equal(old.kind, "question");
    const destiny = await f.api.createReading({ question: "看看我的八字", birth, feeProof: proof(2) });
    await f.bazi.whenSettled(destiny.id);
    const d = await f.api.getReading(destiny.id);
    assert.equal(d.kind, "destiny");
    assert.ok("almanac" in d && d.almanac);
    assert.ok(!("years" in d) && !("consensusTenths" in d) && !("verdict" in d));
    assert.equal(d.periods.length, d.chart.luck?.cycles.length ?? 0);
    const fortune = await f.api.createReading({ question: "我今年运势如何", birth, feeProof: proof(3) });
    await f.bazi.whenSettled(fortune.id);
    const r = await f.api.getReading(fortune.id);
    assert.equal(r.kind, "fortune");
    if (r.kind !== "fortune") {
      throw new Error("类型错误");
    }
    assert.equal(r.years.length, 10);
    assert.equal(r.consensusTenths, 5);
    assert.deepEqual(r.chart.pillars.time?.ganZhi, "癸未");
    assert.equal((await f.store.read<StoredBaziReading>(r.id)).kind, "fortune");
  } finally {
    await f.close();
  }
});

test("付款前可覆盖分类和范围，问事覆盖不要求生辰，非法范围拒绝", async () => {
  const f = await baziFixture();
  try {
    const q = await f.api.createReading({ question: "我今年运势如何", kind: "question", feeProof: proof() });
    assert.equal(q.kind, "question");
    const r = await f.api.createReading({ question: "这次面试能过吗", kind: "fortune", horizon: "next-year",
      birth, feeProof: proof(2) });
    await f.bazi.whenSettled(r.id);
    const done = await f.api.getReading(r.id);
    assert.equal(done.kind, "fortune");
    if (done.kind !== "fortune") {
      throw new Error("类型不符");
    }
    assert.equal(done.chart.liunian.anchorYear, 2027);
    for (const patch of [{ kind: "bad" }, { horizon: "yesterday" }, { sect: 3 }]) {
      await assert.rejects(f.api.createReading({ question: "我今年运势如何", birth, feeProof: proof(3), ...patch }));
    }
    assert.equal(f.calls.payments, 2);
    await assert.rejects(f.api.changeDayBoundary(r.id, {}), /请先填写生辰/);
    await assert.rejects(f.question.throwCoin(r.id, 1), /此接口只适用于问事/);
    await assert.rejects(f.api.retrySchool(r.id, "chengyi"), /此接口只适用于问事/);
    await assert.rejects(f.api.retrySchool(q.id, "yuchuntai"), /此接口只适用于命理或运势/);
  } finally {
    await f.close();
  }
});

test("缺时辰近似大运也拒绝相反性别换日", async () => {
  const f = await baziFixture();
  try {
    const input = { ...birth, time: null };
    const r = await f.bazi.create({ kind: "fortune", question: "今年运势如何", birth: input, sect: 1, horizon: "year", feeProof: proof() });
    await f.bazi.whenSettled(r.id);
    await assert.rejects(f.bazi.changeDayBoundary(r.id, { ...input, gender: "female" }, 2),
      (error: unknown) => error instanceof Error && statusForError(error) === 400 && error.message === "生辰与本卦命盘不符");
  } finally {
    await f.close();
  }
});
