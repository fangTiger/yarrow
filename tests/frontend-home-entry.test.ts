// tests/frontend-home-entry.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ENTRY, KIND_OPTIONS, PLACEHOLDERS, applyClassification, autoHint, chooseKind, entryGate,
  paymentClassification, type ClassificationView,
} from "../web/lib/home-entry.js";

const fortune: ClassificationView = {
  question: "我今年运势如何", kind: "fortune", supported: true, horizon: "year",
};
const naming: ClassificationView = {
  question: "帮我取个名字", kind: "naming", supported: false, suggestion: "起名即将开放，可改为问事",
};
const career: ClassificationView = {
  question: "这次面试能过吗", kind: "question", supported: true, subjectKey: "career", subject: "工作官职",
};

test("三个选项固定为问事、运势、命理，默认问事；占位文字随类型变化", () => {
  assert.deepEqual(KIND_OPTIONS.map(([, label]) => label), ["问事", "运势", "命理"]);
  assert.equal(DEFAULT_ENTRY.kind, "question");
  assert.equal(DEFAULT_ENTRY.manual, false);
  assert.match(PLACEHOLDERS.question, /面试/);
  assert.match(PLACEHOLDERS.fortune, /运势/);
  assert.match(PLACEHOLDERS.destiny, /适合/);
});

test("自动识别切换类型与细项，并给出小字提示", () => {
  const next = applyClassification(DEFAULT_ENTRY, fortune);
  assert.equal(next.kind, "fortune");
  assert.equal(next.horizon, "year");
  assert.equal(autoHint(next), "已自动识别为运势 · 今年");
  const question = applyClassification(DEFAULT_ENTRY, career);
  assert.equal(question.subjectKey, "career");
  assert.equal(autoHint(question), "已自动识别为问事 · 工作官职");
  const nextYear = applyClassification(DEFAULT_ENTRY, { ...fortune, horizon: "next-year" });
  assert.equal(autoHint(nextYear), "已自动识别为运势 · 明年");
  const custom = applyClassification(DEFAULT_ENTRY, { ...fortune, horizon: "year:2028" });
  assert.equal(custom.horizon, "year:2028");
  assert.equal(autoHint(custom), "已自动识别为运势 · 2028 年");
});

test("手动点选的类型优先，之后的识别不再改类型", () => {
  const manual = chooseKind(DEFAULT_ENTRY, "destiny");
  assert.equal(manual.manual, true);
  const after = applyClassification(manual, fortune);
  assert.equal(after.kind, "destiny");
  assert.equal(autoHint(after), null);
});

test("未开放类型：自动模式下给建议并禁止问卦；点选问事后可问", () => {
  const blocked = applyClassification(DEFAULT_ENTRY, naming);
  assert.equal(blocked.unsupported, "起名即将开放，可改为问事");
  assert.deepEqual(entryGate({ questionLength: 6, classified: true, entry: blocked, birthProblem: null }),
    { ready: false, reason: "起名即将开放，可改为问事" });
  const chosen = chooseKind(blocked, "question");
  assert.equal(chosen.unsupported, undefined);
  assert.equal(entryGate({ questionLength: 6, classified: true, entry: chosen, birthProblem: null }).ready, true);
});

test("问卦可用条件：问题至少 4 字、已识别或已手选、命理运势生辰有效", () => {
  assert.deepEqual(entryGate({ questionLength: 2, classified: false, entry: DEFAULT_ENTRY, birthProblem: null }),
    { ready: false, reason: "先写下想问的事（至少 4 个字）" });
  assert.deepEqual(entryGate({ questionLength: 6, classified: false, entry: DEFAULT_ENTRY, birthProblem: null }),
    { ready: false, reason: "识别中" });
  assert.equal(entryGate({
    questionLength: 6, classified: false, entry: chooseKind(DEFAULT_ENTRY, "question"), birthProblem: null,
  }).ready, true);
  const auto = applyClassification(DEFAULT_ENTRY, fortune);
  assert.deepEqual(entryGate({ questionLength: 6, classified: true, entry: auto, birthProblem: "请填写出生日期" }),
    { ready: false, reason: "请先填好生辰：请填写出生日期" });
  assert.equal(entryGate({ questionLength: 6, classified: true, entry: auto, birthProblem: null }).ready, true);
  // 问事不需要生辰，生辰无效也不拦
  assert.equal(entryGate({
    questionLength: 6, classified: true, entry: applyClassification(DEFAULT_ENTRY, career), birthProblem: "x",
  }).ready, true);
});

test("付款分类只带所选类型需要的字段", () => {
  const q = applyClassification(DEFAULT_ENTRY, career);
  assert.deepEqual(paymentClassification(q, "这次面试能过吗"), {
    question: "这次面试能过吗", kind: "question", supported: true, subjectKey: "career", subject: "工作官职",
  });
  const f = applyClassification(DEFAULT_ENTRY, { ...fortune, horizon: "next-year" });
  assert.deepEqual(paymentClassification(f, "我明年运势如何"), {
    question: "我明年运势如何", kind: "fortune", supported: true, horizon: "next-year",
  });
  const d = chooseKind(DEFAULT_ENTRY, "destiny");
  assert.deepEqual(paymentClassification(d, "我适合做什么"), {
    question: "我适合做什么", kind: "destiny", supported: true,
  });
});

test("分类结果与手选分开存，渲染时合成：防抖期间手点的类型不会被晚到的识别覆盖", async () => {
  const { deriveEntry } = await import("../web/lib/home-entry.js");
  assert.equal(deriveEntry(undefined, {}).kind, "question");
  assert.equal(deriveEntry(fortune, {}).kind, "fortune");
  const manual = deriveEntry(fortune, { kind: "destiny" });
  assert.equal(manual.kind, "destiny");
  assert.equal(manual.manual, true);
  assert.equal(deriveEntry(fortune, { horizon: "month" }).horizon, "month");
  const subject = deriveEntry(career, { subjectKey: "exam", subject: "考试" });
  assert.deepEqual([subject.subjectKey, subject.subject], ["exam", "考试"]);
  assert.equal(deriveEntry(career, { subjectKey: "", subject: "" }).subjectKey, "");
});
