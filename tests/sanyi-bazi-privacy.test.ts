// tests/sanyi-bazi-privacy.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { baziFixture, birth, proof } from "./helpers/bazi-service.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { BaziReadingService } from "../src/sanyi/bazi-reading-service.js";
import { createSanyiLogger } from "../src/sanyi/log.js";
const forbidden = ["1990-05-15", "15:30", "14:30", "乌鲁木齐", "87.6", "2000-11-03", "09:10"];
async function directoryText(path: string): Promise<string> {
  const names = await readdir(path);
  return (await Promise.all(names.map((name) => readFile(join(path, name), "utf8")))).join("\n");
}
test("未填地点、城市、手填经度：存档日志公开 JSON 全文无原始输入串", async () => {
  const f = await baziFixture();
  try {
    const inputs = [birth, { ...birth, city: "乌鲁木齐" }, { ...birth, longitude: 87.6 },
      { ...birth, year: 2000, month: 11, day: 3, time: { hour: 9, minute: 10 }, longitude: 87.6 }];
    for (const [index, value] of inputs.entries()) {
      const r = await f.api.createReading({ question: "我今年运势如何", birth: value, feeProof: proof(index + 1) });
      await f.bazi.whenSettled(r.id);
      await f.api.changeDayBoundary(r.id, { birth: value, sect: 2 });
      await f.bazi.whenSettled(r.id);
      const texts = [await directoryText(join(f.root, "readings")), await directoryText(join(f.root, "log")),
        JSON.stringify(await f.api.getReading(r.id))];
      for (const text of texts) {
        for (const word of forbidden) {
          assert.ok(!text.includes(word), `隐私扫描发现：${word}`);
        }
        assert.doesNotMatch(text, /"(?:civil|effective|birthplace|longitude|steps|before|after)"\s*:/);
      }
    }
    const stored = await f.bazi.getReading((await f.api.createReading({ question: "看看我的八字",
      birth: { ...birth, city: "香港" }, feeProof: proof(9) })).id);
    await f.bazi.whenSettled(stored.id);
    assert.equal(stored.correction.dst, "skipped-region");
    assert.equal(stored.correction.solar, "applied");
    assert.ok(stored.chart.luck?.start.solarDate);
  } finally {
    await f.close();
  }
});
test("模型错误回显生辰不会进入存档、日志或公开响应，重启后重试无需生辰", async () => {
  const mock = new MockSchoolsProvider();
  const f = await baziFixture({ ...mock, generateStructured: async () => {
    throw new Error(forbidden.join(" "));
  } });
  try {
    const r = await f.api.createReading({ question: "我今年运势如何", birth, feeProof: proof() });
    await f.bazi.whenSettled(r.id);
    const restarted = new BaziReadingService({ store: f.store, provider: mock,
      clock: () => new Date("2026-10-06T13:00:00Z"), logger: createSanyiLogger(join(f.root, "log")),
      feeVerifier: { verify: async () => {
        throw new Error("免费重试不得核验新付款");
      } } });
    await restarted.retrySchool(r.id, "yuchuntai");
    await restarted.whenSettled(r.id);
    assert.equal((await restarted.getReading(r.id)).schools.yuchuntai.status, "done");
    const texts = [await directoryText(join(f.root, "readings")), await directoryText(join(f.root, "log")),
      JSON.stringify(await f.api.getReading(r.id))];
    for (const text of texts) {
      for (const word of forbidden) {
        assert.ok(!text.includes(word));
      }
    }
    assert.equal(f.calls.payments, 1);
  } finally {
    await f.close();
  }
});
