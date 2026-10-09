import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { favorableFromTiaohou } from "../src/sanyi/naming/favorable.js";
import { statusForError } from "../src/sanyi/http-errors.js";
import { namingBirth, namingFixture, namingProof } from "./helpers/naming-service.js";

async function directoryText(path: string): Promise<string> {
  const names = await readdir(path);
  return (await Promise.all(names.map((name) => readFile(join(path, name), "utf8")))).join("\n");
}

test("人名付款后排四柱，三家与合参依次从 writing 到 done", async () => {
  const f = await namingFixture();
  try {
    const created = await f.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(),
    });
    assert.equal(created.status, "writing");
    assert.ok(Object.values(created.families).every((state) => state.status === "writing"));
    await f.naming.whenSettled(created.id);
    const reading = await f.naming.getReading(created.id);
    assert.equal(reading.status, "done");
    assert.ok(Object.values(reading.families).every((state) => (
      state.status === "done" && state.output?.names.length === 3
    )));
    assert.equal(reading.summary?.status, "done");
    assert.ok((reading.summary?.output?.picks.length ?? 0) >= 2);
    assert.equal(reading.basis.favorableSource, "tiaohou");
    assert.equal(reading.basis.favorableNote,
      `调候取${reading.basis.tiaohou?.useStems.join("、") ?? ""}`);
    assert.deepEqual(reading.basis.favorable,
      favorableFromTiaohou(reading.basis.tiaohou?.useStems ?? []));
    assert.ok(reading.basis.pillars?.year);
    assert.ok(reading.basis.pillars?.time);
  } finally {
    await f.close();
  }
});

test("未出生按预产期排三柱并保留 unborn 标记", async () => {
  const f = await namingFixture();
  try {
    const reading = await f.naming.create({
      target: "person", surname: "王", gender: "any", length: 1, unborn: true,
      question: "中性自然", birth: { ...namingBirth, time: { hour: 9, minute: 10 } },
      feeProof: namingProof(),
    });
    await f.naming.whenSettled(reading.id);
    const done = await f.naming.getReading(reading.id);
    assert.equal(done.basis.unborn, true);
    assert.equal(done.basis.pillars?.time, null);
    assert.equal(done.gender, "any");
  } finally {
    await f.close();
  }
});

test("商号无生辰按行业或模型定五行，带店主生辰时按调候", async () => {
  const f = await namingFixture();
  try {
    const coffee = await f.naming.create({
      target: "business", gender: "any", length: 2, unborn: false,
      question: "社区咖啡馆，温暖安静", feeProof: namingProof(1),
    });
    const soap = await f.naming.create({
      target: "business", gender: "any", length: 3, unborn: false,
      question: "卖手工皂", feeProof: namingProof(2),
    });
    const owner = await f.naming.create({
      target: "business", gender: "any", length: 2, unborn: false,
      question: "社区书店", birth: { ...namingBirth, gender: "male" }, feeProof: namingProof(3),
    });
    await Promise.all([coffee.id, soap.id, owner.id].map((id) => f.naming.whenSettled(id)));
    const [a, b, c] = await Promise.all([coffee.id, soap.id, owner.id]
      .map((id) => f.naming.getReading(id)));
    assert.ok(a && b && c);
    assert.deepEqual(a.basis.favorable, ["火"]);
    assert.equal(a.basis.favorableSource, "industry");
    assert.equal(a.basis.favorableNote, "按行业：咖啡 → 火");
    assert.equal(a.basis.pillars, null);
    assert.equal(a.surname, undefined);
    assert.equal(b.basis.favorable, null);
    assert.equal(b.basis.favorableSource, "model");
    assert.equal(b.basis.favorableNote, "行业未匹配，由五行补益家自选");
    assert.ok(b.families.wuxing.output?.element);
    assert.equal(c.basis.favorableSource, "tiaohou");
    assert.ok(c.basis.pillars?.time);
  } finally {
    await f.close();
  }
});

test("模型滥填的 element 在写入存档前完成规范化", async () => {
  const mock = new MockSchoolsProvider();
  const provider = {
    ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
      const output = await mock.generateStructured<T>(request);
      return request.taskId.startsWith("sanyi/naming/") && request.taskId !== "sanyi/naming/summary"
        ? { ...(output as object), element: "木" } as T
        : output;
    },
  };
  const f = await namingFixture(provider);
  try {
    const created = await f.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    const stored = await f.naming.getReading(created.id);
    for (const family of Object.values(stored.families)) {
      assert.equal(family.output?.element, undefined);
    }
  } finally {
    await f.close();
  }
});

test("单家失败与其它家隔离，恢复后免费重试并重写合参", async () => {
  const mock = new MockSchoolsProvider();
  let fail = true;
  const provider = {
    ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
      if (fail && request.taskId === "sanyi/naming/shiwen") throw new Error("供应商失败");
      return mock.generateStructured<T>(request);
    },
  };
  const f = await namingFixture(provider);
  try {
    const created = await f.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    const failed = await f.naming.getReading(created.id);
    assert.equal(failed.families.shiwen.status, "failed");
    assert.equal(failed.families.wuxing.status, "done");
    assert.equal(failed.families.yinyi.status, "done");
    assert.equal(failed.summary?.status, "done");
    assert.equal(failed.summary?.basis, 2);
    fail = false;
    await f.naming.retryFamily(created.id, "shiwen");
    await f.naming.whenSettled(created.id);
    const recovered = await f.naming.getReading(created.id);
    assert.equal(recovered.families.shiwen.status, "done");
    assert.equal(recovered.summary?.basis, 3);
    assert.equal(recovered.families.shiwen.retries, 1);
    assert.equal(f.calls.payments, 1);
  } finally {
    await f.close();
  }
});

test("单家与合参免费重试各至多两次", async () => {
  const mock = new MockSchoolsProvider();
  let familyFails = true;
  let summaryFails = true;
  const provider = {
    ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
      if (familyFails && request.taskId === "sanyi/naming/shiwen") throw new Error("单家失败");
      if (summaryFails && request.taskId === "sanyi/naming/summary") throw new Error("合参失败");
      return mock.generateStructured<T>(request);
    },
  };
  const f = await namingFixture(provider);
  try {
    const created = await f.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "温和有书卷气", birth: namingBirth, feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    for (let index = 0; index < 2; index += 1) {
      await f.naming.retryFamily(created.id, "shiwen");
      await f.naming.whenSettled(created.id);
    }
    await assert.rejects(f.naming.retryFamily(created.id, "shiwen"), /次数已用尽/);
    familyFails = false;
    for (let index = 0; index < 2; index += 1) {
      await f.naming.retrySummary(created.id);
      await f.naming.whenSettled(created.id);
    }
    await assert.rejects(f.naming.retrySummary(created.id), /次数已用尽/);
    assert.equal(f.calls.payments, 1);
    summaryFails = false;
  } finally {
    await f.close();
  }
});

test("付款不可复用，付款拒绝先于排盘；人名校验给中文 400", async () => {
  const f = await namingFixture();
  try {
    const input = {
      target: "person" as const, surname: "张", gender: "female" as const, length: 2 as const,
      unborn: false, question: "", birth: namingBirth, feeProof: namingProof(),
    };
    const first = await f.naming.create(input);
    await f.naming.whenSettled(first.id);
    await assert.rejects(f.naming.create(input), /付款凭证已用于/);
    for (const patch of [{ surname: "" }, { surname: "𪚥" }, { birth: undefined }]) {
      await assert.rejects(f.naming.create({ ...input, ...patch, feeProof: namingProof(9) }),
        (error: unknown) => error instanceof Error && statusForError(error) === 400);
    }
    assert.equal(f.calls.payments, 2);
  } finally {
    await f.close();
  }
});

test("起名存档、日志与读取结果不含原始出生日期时间", async () => {
  const mock = new MockSchoolsProvider();
  const forbidden = ["1990-05-15", "15:30", "乌鲁木齐", "87.6"];
  const f = await namingFixture({
    ...mock,
    generateStructured: async <T>(request: Parameters<typeof mock.generateStructured>[0]) => {
      if (request.taskId === "sanyi/naming/shiwen") throw new Error(forbidden.join(" "));
      return mock.generateStructured<T>(request);
    },
  });
  try {
    const created = await f.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "", birth: { ...namingBirth, city: "乌鲁木齐" }, feeProof: namingProof(),
    });
    await f.naming.whenSettled(created.id);
    const texts = [
      await directoryText(join(f.root, "readings")),
      await directoryText(join(f.root, "log")),
      JSON.stringify(await f.naming.getReading(created.id)),
    ];
    for (const text of texts) {
      for (const word of forbidden) assert.ok(!text.includes(word), `隐私扫描发现：${word}`);
      assert.doesNotMatch(text, /"(?:civil|effective|birthplace|longitude|timeKnown)"\s*:/u);
    }
  } finally {
    await f.close();
  }
});
