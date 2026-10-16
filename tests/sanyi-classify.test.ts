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
  const person = classifyQuestion("给孩子起个名字");
  assert.equal(person.supported, true);
  assert.equal(person.target, "person");
  assert.equal(person.needsBirth, true);
  assert.equal(person.suggestion, undefined);
  const business = classifyQuestion("给我的咖啡馆起个名字");
  assert.equal(business.supported, true);
  assert.equal(business.target, "business");
  assert.equal(business.needsBirth, false);
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

test("常见英文问题识别类型、时间范围与事项", () => {
  const english: Array<[string, string, string | undefined, string | undefined]> = [
    ["Will I get this job?", "question", undefined, "career"],
    ["Is now a good time to sign this contract?", "question", undefined, "documents"],
    ["Will Bitcoin go up today?", "question", undefined, "wealth"],
    ["Will my girlfriend come back?", "question", undefined, "relationship"],
    ["Will my mother recover from surgery?", "question", undefined, "illness"],
    ["Is my coworker trying to undermine me?", "question", undefined, "peers"],
    ["Will my son get into college?", "question", undefined, "wellbeing"],
    ["How will my life unfold?", "destiny", undefined, undefined],
    ["What are my character strengths?", "destiny", undefined, undefined],
    ["What does this year hold for me?", "fortune", "year", undefined],
    ["How is my luck in 2027?", "fortune", "year:2027", undefined],
    ["What does next year hold for me?", "fortune", "next-year", undefined],
  ];
  for (const [question, kind, horizon, subject] of english) {
    const result = classifyQuestion(question);
    assert.equal(result.kind, kind, question);
    assert.equal(result.horizon, horizon, question);
    assert.equal(result.subject?.key, subject, question);
    if (subject) assert.equal(result.subject?.fallback, undefined, question);
  }
  assert.equal(classifyQuestion("Name a warm neighborhood coffee shop").target, "business");
  assert.equal(classifyQuestion("I want a gentle, literary name").target, "person");
  assert.equal(classifyQuestion("What's my horoscope for 2027?").supported, false);
  // 「work out」不算工作，「cancer」不算星座。
  assert.equal(classifyQuestion("Will it work out with him?").subject?.key, "peers");
  assert.equal(classifyQuestion("Is my cancer treatable?").kind, "question");
});

test("识别不到事项时默认人际／同辈并标记 fallback，中英文一致", () => {
  for (const question of ["那件事会怎样", "Should I move to Berlin next spring?"]) {
    const subject = classifyQuestion(question).subject;
    assert.equal(subject?.key, "peers", question);
    assert.equal(subject?.fallback, true, question);
  }
  assert.equal(classifyQuestion("比特币今天还会上涨吗").subject?.key, "wealth");
});
