// tests/sanyi-bazi-schools.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import { selectBaziFacts } from "../src/sanyi/schools/bazi-shared.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
// 原样复用 1A frontend-sanyi-content.test.ts 的文化守卫表达式。
const CULTURE_FORBIDDEN = /[\u3040-\u30ff]|・|易者|身銭|筮竹|神社|高島|断易|問|賭/u;
test("余春台输入有庚金巳月及原文，沈任输入无调候摘句", () => {
  const input = sampleBazi();
  for (const school of BAZI_SCHOOLS) {
    const prompt = school.buildUserPrompt(input);
    if (school.key === "yuchuntai") {
      assert.match(prompt, /三夏庚金/);
      assert.match(prompt, /但先壬水/);
      assert.ok(prompt.includes(input.tiaohou.quote));
      assert.ok(!selectBaziFacts(school.key, input).has("relation:1"));
    } else {
      assert.ok(!prompt.includes(input.tiaohou.quote));
      assert.doesNotMatch(prompt, /但先壬水/);
      assert.ok(!selectBaziFacts(school.key, input).has("tiaohou"));
    }
    assert.doesNotMatch(school.systemPrompt, CULTURE_FORBIDDEN);
    assert.match(school.systemPrompt, new RegExp(`自称只用本名“${school.name}”`));
    assert.match(prompt, /2023/);
    assert.match(school.systemPrompt, /二十四字/);
    assert.match(school.systemPrompt, /整年/);
  }
});
test("命理无流年窗口输入，透干通根按原局确定性组装", () => {
  const input = sampleBazi("destiny");
  for (const school of BAZI_SCHOOLS) {
    const facts = selectBaziFacts(school.key, input);
    assert.ok(![...facts.keys()].some((id) => id.startsWith("year:")));
    assert.ok(!school.buildUserPrompt(input).includes("逐年窗口："));
    if (school.key === "shenxiaozhan") {
      assert.ok(facts.has("structure:month"));
      assert.ok(!facts.has("elements"));
    }
    if (school.key === "rentieqiao") {
      assert.ok(facts.has("structure:roots"));
    }
  }
});

for (const school of BAZI_SCHOOLS) {
  test(`${school.name} 运势提示词按用神喜忌区分逐年吉凶`, () => {
    const prompt = school.systemPrompt + school.buildUserPrompt(sampleBazi());
    assert.match(prompt, /本派.*用神.*喜忌/u);
    assert.match(prompt, /不要一律写平/u);
    assert.match(prompt, /生扶用神或制伏忌神/u);
    assert.match(prompt, /克泄用神或助起忌神/u);
    assert.match(prompt, /冲合刑害/u);
    assert.match(prompt, /喜忌相抵/u);
    assert.match(prompt, /戊土生身，印旺得扶/u);
    assert.match(prompt, /不得为了凑出起伏而编造事实/u);
  });
}
