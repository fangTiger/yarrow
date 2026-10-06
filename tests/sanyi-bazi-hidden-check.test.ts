import assert from "node:assert/strict";
import test from "node:test";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { sampleBazi } from "./helpers/sample-bazi.js";

const invalid: [string, ...string[]][] = [
  ["原局壬水藏于辰未", "辰中不藏壬", "未中不藏壬"],
  ["辰中藏壬", "辰中不藏壬"],
  ["午中藏癸", "午中不藏癸"],
  ["壬藏辰中", "辰中不藏壬"],
  ["辰内藏壬", "辰中不藏壬"],
  ["辰未藏癸", "未中不藏癸"],
  ["辰藏戊偏印、壬食神", "辰中不藏壬"],
  ["辰中戊偏印壬食神", "辰中不藏壬"],
  ["巳藏丙火七杀与癸水伤官", "巳中不藏癸"],
];
for (const [reason, ...messages] of invalid) {
  test(`藏干归属拒绝：${reason}`, () => {
    const input = sampleBazi();
    const output = mockBaziSchoolOutput("yuchuntai", input.facts, "fortune");
    const result = auditBaziOutput({ ...output, reason }, input.facts);
    for (const message of messages) {
      assert.ok(result.errors.some((error) => error.includes(message)), result.errors.join("；"));
    }
  });
}
for (const reason of [
  "日支辰藏戊偏印、乙正财、癸伤官", "巳中丙火七杀未透", "巳藏丙火七杀与戊土偏印",
  "辰中戊偏印癸伤官", "庚金通根月巳", "申藏壬食神", "亥藏壬食神", "水木透泄火",
  "癸水藏辰", "辰中癸", "辰未藏乙", "辰藏戊，壬水调候", "癸水藏辰未透", "壬水藏申未透",
]) {
  test(`合法藏干或普通语句通过：${reason}`, () => {
    const input = sampleBazi();
    // 补齐普通关键词，独立验证固定藏干表，与命盘是否出现某支无关。
    input.facts.set("test:tokens", { id: "test:tokens", label: "测试词", tokens: new Set(["申", "亥"]) });
    const output = mockBaziSchoolOutput("yuchuntai", input.facts, "fortune");
    assert.deepEqual(auditBaziOutput({ ...output, reason }, input.facts).errors, []);
  });
}
for (const field of ["useGod", "headline", "reason", "sections", "advice", "timing", "evidence"] as const) {
  test(`藏干归属扫描 ${field}`, () => {
    const input = sampleBazi();
    const output = mockBaziSchoolOutput("yuchuntai", input.facts, "fortune");
    const claim = "辰中藏壬";
    const patch = field === "sections" ? { sections: [{ title: claim, text: claim }] }
      : field === "advice" ? { advice: [claim] }
      : field === "timing" ? { timing: { window: claim, condition: claim } }
      : field === "evidence" ? { evidence: [{ ref: "hidden:day", claim }] }
      : { [field]: claim };
    assert.match(auditBaziOutput({ ...output, ...patch }, input.facts).errors.join("；"), /辰中不藏壬/u);
  });
}
test("2028 年短评申藏壬通过，申藏癸失败", () => {
  const input = sampleBazi();
  const output = mockBaziSchoolOutput("yuchuntai", input.facts, "fortune");
  for (const note of ["申藏壬食神", "申藏癸"]) {
    const years = output.years.map((item) => {
      return item.year === 2028 ? { ...item, note } : item;
    });
    const result = auditBaziOutput({ ...output, years }, input.facts);
    if (note === "申藏壬食神") {
      assert.deepEqual(result.errors, []);
    } else {
      assert.match(result.errors.join("；"), /2028 年短评.*申中不藏癸/u);
    }
  }
});
