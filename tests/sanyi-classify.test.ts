// tests/sanyi-classify.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { classifyQuestion, overrideClassification } from "../src/sanyi/classify.js";
const cases = [
  ["我本月财运怎么样", "fortune", "month"],
  ["我今年运势如何", "fortune", "year"],
  ["我明年运势如何", "fortune", "next-year"],
  ["2027年我的运势", "fortune", "year:2027"],
  ["今天运气怎么样", "fortune", "today"],
  ["我适合做什么工作", "destiny", undefined],
  ["看看我的八字", "destiny", undefined],
  ["那件事会怎样", "question", undefined],
  ["给女儿起个名字，姓王", "naming", undefined],
  ["下个月哪天搬家好", "date-selection", undefined],
  ["天蝎座本月运势", "zodiac", undefined],
  ["我们俩合不合", "compatibility", undefined],
] as const;
for (const [question, kind, horizon] of cases) {
  test(question, () => {
    const result = classifyQuestion(question);
    assert.equal(result.kind, kind);
    assert.equal(result.horizon, horizon);
  });
}
test("问事复用现有事项分类", () => {
  const result = classifyQuestion("这次面试能过吗");
  assert.equal(result.subject?.key, "career");
  assert.equal(result.subject?.useGod, "官鬼");
});
test("未开放类型给出问事替代建议", () => {
  const result = classifyQuestion("给女儿起个名字，姓王");
  assert.equal(result.supported, false);
  assert.match(result.suggestion ?? "", /给孩子起名叫某某好不好/);
});
test("付款前可改类型、事项和时间范围", () => {
  const base = classifyQuestion("我本月财运怎么样");
  const changed = overrideClassification(base, { kind: "question", subjectKey: "career" });
  assert.equal(changed.kind, "question");
  assert.equal(changed.subject?.key, "career");
  assert.throws(() => overrideClassification(base, { horizon: "year:20x7" }), /时间范围无效/);
});
test("规范化并拒绝无意义或越界输入", () => {
  assert.equal(classifyQuestion("  那件事   会怎样  ").question, "那件事 会怎样");
  assert.equal(classifyQuestion("1234").kind, "other");
  assert.throws(() => classifyQuestion("123"), /4–280/);
});
