import assert from "node:assert/strict";
import test from "node:test";
import { createSanyiApi } from "../src/sanyi/api.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { publicNamingReading } from "../src/sanyi/naming/public.js";
import { statusForError } from "../src/sanyi/http-errors.js";
import { namingBirth, namingFixture, namingProof } from "./helpers/naming-service.js";

const unusedQuestionService = {
  createQuestionReading: async () => { throw new Error("不应创建问事卦"); },
  continueCasting: async () => { throw new Error("不应续掷"); },
  getReading: async () => { throw new Error("不应读取问事卦"); },
  retrySchool: async () => { throw new Error("不应重试问事三家"); },
  changeSubject: async () => { throw new Error("不应改事项"); },
  retrySummary: async () => { throw new Error("不应重试问事总述"); },
};

test("公开视图补全全名、拼音、逐字信息、出处与合参所属家", async () => {
  const f = await namingFixture();
  try {
    const created = await f.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    const stored = await f.naming.getReading(created.id);
    const view = publicNamingReading(stored);
    assert.equal(view.kind, "naming");
    assert.equal(view.basis.favorableNote, stored.basis.favorableNote);
    const wuxing = view.families.wuxing.output?.names[0];
    assert.ok(wuxing);
    assert.equal(wuxing.full, `张${wuxing.given}`);
    assert.equal(wuxing.pinyin.split(" ").length, [...wuxing.full].length);
    assert.ok(wuxing.chars.every((item) => (
      item.char && item.pinyin && Number.isInteger(item.tone) && item.wuxing
      && item.wuxingBasis && item.kangxi > 0 && item.meaning && item.level
      && typeof item.polyphonic === "boolean"
    )));
    assert.equal(wuxing.chars[0]?.meaning,
      stored.families.wuxing.output?.names[0]?.chars[0]?.gloss);
    assert.ok(Array.isArray(wuxing.hints));
    const shiwen = view.families.shiwen.output?.names[0];
    assert.ok(shiwen?.source?.book && shiwen.source.title && shiwen.source.text);
    const pick = view.summary?.output?.picks[0];
    assert.ok(pick?.full.startsWith("张"));
    assert.ok(pick?.pinyin.includes(" "));
    assert.ok(["五行补益", "诗文出处", "音形字义"].includes(pick?.family ?? ""));
    assert.doesNotMatch(JSON.stringify(view), /1990-05-15|15:30/u);
  } finally {
    await f.close();
  }
});

test("商号公开视图不加姓，缺模型字义时回退字库释义", async () => {
  const f = await namingFixture();
  try {
    const created = await f.naming.create({
      target: "business", gender: "any", length: 2, unborn: false,
      question: "社区咖啡馆", feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    const stored = await f.naming.getReading(created.id);
    const first = stored.families.wuxing.output?.names[0];
    assert.ok(first);
    first.chars = [];
    const view = publicNamingReading(stored);
    const name = view.families.wuxing.output?.names[0];
    assert.equal(name?.full, name?.given);
    assert.ok(name?.chars.every(({ meaning }) => meaning.length > 0));
  } finally {
    await f.close();
  }
});

test("公开视图会清理旧存档中不该出现的 element", async () => {
  const f = await namingFixture();
  try {
    const created = await f.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    const stored = await f.naming.getReading(created.id);
    for (const family of Object.values(stored.families)) {
      if (family.output) family.output.element = "木";
    }
    const view = publicNamingReading(stored);
    assert.equal(view.families.wuxing.output?.element, undefined);
    assert.equal(view.families.shiwen.output?.element, undefined);
    assert.equal(view.families.yinyi.output?.element, undefined);
  } finally {
    await f.close();
  }
});

test("API 创建、读取人名起名；人名问题可空，商号问题至少两字", async () => {
  const f = await namingFixture();
  try {
    const api = createSanyiApi(unusedQuestionService, { now: f.clock, naming: f.naming });
    const created = await api.createReading({
      kind: "naming", target: "person", surname: "张", gender: "female", length: 2,
      unborn: false, birth: namingBirth, question: "", feeProof: namingProof(),
    });
    assert.equal(created.kind, "naming");
    await f.naming.whenSettled(created.id);
    const read = await api.getReading(created.id);
    assert.equal(read.kind, "naming");
    if (read.kind === "naming") assert.equal(read.surname, "张");
    await assert.rejects(api.createReading({
      kind: "naming", target: "business", gender: "any", length: 2, unborn: false,
      question: "店", feeProof: namingProof(2),
    }), (error: unknown) => error instanceof Error && statusForError(error) === 400);
    assert.equal(f.calls.payments, 1);
  } finally {
    await f.close();
  }
});

test("API 在付款前校验起名字段与生辰", async () => {
  const f = await namingFixture();
  try {
    const api = createSanyiApi(unusedQuestionService, { naming: f.naming });
    const base = {
      kind: "naming", target: "person", surname: "张", gender: "female", length: 2,
      unborn: false, birth: namingBirth, question: "", feeProof: namingProof(),
    };
    for (const patch of [
      { target: "bad" }, { surname: "" }, { surname: "𪚥" }, { gender: "bad" },
      { length: 3 }, { unborn: "no" }, { birth: undefined }, { birth: {} },
    ]) {
      await assert.rejects(api.createReading({ ...base, ...patch }),
        (error: unknown) => error instanceof Error && statusForError(error) === 400);
    }
    assert.equal(f.calls.payments, 0);
  } finally {
    await f.close();
  }
});

test("API 将起名单家与合参重试分派到起名服务", async () => {
  const mock = new MockSchoolsProvider();
  let failFamily = true;
  let failSummary = true;
  const f = await namingFixture({
    ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
      if (failFamily && request.taskId === "sanyi/naming/shiwen") throw new Error("单家失败");
      if (failSummary && request.taskId === "sanyi/naming/summary") throw new Error("合参失败");
      return mock.generateStructured<T>(request);
    },
  });
  try {
    const api = createSanyiApi(unusedQuestionService, { naming: f.naming });
    const created = await api.createReading({
      kind: "naming", target: "person", surname: "张", gender: "female", length: 2,
      unborn: false, birth: namingBirth, question: "", feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    failFamily = false;
    const retrying = await api.retrySchool(created.id, "shiwen");
    assert.equal(retrying.kind, "naming");
    await f.naming.whenSettled(created.id);
    failSummary = false;
    const summary = await api.retrySummary(created.id);
    assert.equal(summary.kind, "naming");
    await f.naming.whenSettled(created.id);
    assert.equal((await api.getReading(created.id)).summary?.status, "done");
  } finally {
    await f.close();
  }
});
