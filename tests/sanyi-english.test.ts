import assert from "node:assert/strict";
import test from "node:test";
import {
  auditQuestionEnglishProse,
  englishBodyErrors,
  englishForbiddenErrors,
} from "../src/sanyi/english/audit.js";
import { facts } from "./helpers/sample-question.js";

test("英文正文拦截非白名单汉字，并允许数字、标点、拉丁字母与白名单", () => {
  assert.deepEqual(englishBodyErrors(["Clear in 2026: 6/10."]), []);
  assert.match(englishBodyErrors(["Clear，但仍需等待。"]).join("\n"), /汉字/u);
  assert.deepEqual(englishBodyErrors(["The name 张清 is calm."], ["张", "清"]), []);
  assert.match(englishBodyErrors(["The name 张清宁 is calm."], ["张", "清"]).join("\n"), /宁/u);
});

test("英文盘面核对识别甲子对、十神与地支五行六亲组合", () => {
  const realGanzhi = [...facts.values()].flatMap((fact) => [...fact.tokens])
    .find((token) => /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(token));
  assert.ok(realGanzhi);
  const stem: Record<string, string> = {
    甲: "Jia", 乙: "Yi", 丙: "Bing", 丁: "Ding", 戊: "Wu",
    己: "Ji", 庚: "Geng", 辛: "Xin", 壬: "Ren", 癸: "Gui",
  };
  const branch: Record<string, string> = {
    子: "Zi", 丑: "Chou", 寅: "Yin", 卯: "Mao", 辰: "Chen", 巳: "Si",
    午: "Wu", 未: "Wei", 申: "Shen", 酉: "You", 戌: "Xu", 亥: "Hai",
  };
  const realPair = `${stem[realGanzhi[0]!]} ${branch[realGanzhi[1]!]}`;
  assert.deepEqual(auditQuestionEnglishProse(realPair, facts), []);
  assert.match(auditQuestionEnglishProse("Bing Chen", facts).join("\n"), /Bing Chen/u);

  const withTenGod = new Map(facts);
  withTenGod.set("ten-god", { id: "ten-god", label: "正官", tokens: new Set(["正官"]) });
  assert.deepEqual(auditQuestionEnglishProse("Direct Officer", withTenGod), []);
  assert.match(auditQuestionEnglishProse("Seven Killings", withTenGod).join("\n"), /Seven Killings/u);

  const withCombination = new Map(facts);
  withCombination.set("line:9", {
    id: "line:9", label: "子水父母", tokens: new Set(["子", "水", "父母"]),
  });
  assert.deepEqual(auditQuestionEnglishProse("Zi Water Parents", withCombination), []);
  assert.deepEqual(auditQuestionEnglishProse("zi water parent", withCombination), []);
  assert.match(auditQuestionEnglishProse("Zi Fire Parents", withCombination).join("\n"), /Zi Fire Parents/u);
});

test("单音节拼音与常用英文词不被当作盘面术语", () => {
  assert.deepEqual(auditQuestionEnglishProse("You can wait. Wu appears alone.", facts), []);
  assert.deepEqual(auditQuestionEnglishProse("A charming and crystal clear answer.", facts), []);
});

test("英文禁用词按词边界命中，charm 等正常词不误报", () => {
  for (const text of [
    "Wear an amulet.", "Choose a lucky color.", "Use ritual objects.",
    "Do not gamble or place bets.", "Ask for compensation.",
    "Face a lucky direction.", "Carry wearable objects or ornaments.",
    "Release animals and make a donation.", "Use an item to ward off misfortune.",
  ]) {
    assert.notEqual(englishForbiddenErrors(text).length, 0, text);
  }
  assert.deepEqual(englishForbiddenErrors("Her charm is crystal clear."), []);
  assert.deepEqual(englishForbiddenErrors("This is a better option."), []);
  assert.deepEqual(englishForbiddenErrors("Ask for directions to the station."), []);
});

test("干支对写成连字符或短破折号也要核对", () => {
  // 样例问事盘里没有丙辰：三种写法都应被拦下。
  for (const text of ["Bing Chen", "Bing-Chen", "Bing–Chen"]) {
    assert.match(auditQuestionEnglishProse(`${text} rules the period.`, facts).join("\n"), /Bing.Chen/u, text);
  }
  // 地支相连（Hai-Mao）不是干支对，不报。
  assert.deepEqual(auditQuestionEnglishProse("Hai-Mao join to Wood.", facts), []);
});
