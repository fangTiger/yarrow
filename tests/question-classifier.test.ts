import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  QUESTION_SUBJECTS,
  classifyQuestion,
  confirmQuestionSubject,
  confirmQuestionTrack,
  type QuestionSubjectKey,
  type QuestionTrack,
} from "../src/oracle/question-classifier.js";

const CASES: ReadonlyArray<{ question: string; expected: QuestionTrack }> = [
  { question: "我该不该辞职", expected: "question" },
  { question: "他到底怎么想", expected: "question" },
  { question: "今年会顺利吗", expected: "question" },
  { question: "今天天气怎么样", expected: "question" },
  { question: "我这周会不会和他和好", expected: "wager" },
  { question: "这个月能不能拿到 offer", expected: "wager" },
  { question: "我能不能坚持跑步一周", expected: "wager" },
  { question: "今天之内会不会收到那条消息", expected: "wager" },
];

test("中立分类器按未来是否存在单一可观察答案区分典型问题", () => {
  for (const sample of CASES) {
    const result = classifyQuestion(sample.question);
    assert.equal(result.track, sample.expected, `${sample.question} 分类错误：${result.reason}`);
    assert.equal(result.question, sample.question);
    assert.ok(result.reason.length > 0);
  }
});

test("宽泛主观问题安全地落入問轨，明确短周期事实标为现场可演示", () => {
  const broad = classifyQuestion("今年会顺利吗");
  assert.equal(broad.track, "question");
  assert.equal(broad.horizon, "none");
  assert.match(broad.reason, /唯一|标准|揭晓/);

  const short = classifyQuestion("今天之内会不会收到那条消息");
  assert.equal(short.track, "wager");
  assert.equal(short.horizon, "short");

  const long = classifyQuestion("这个月能不能拿到 offer");
  assert.equal(long.track, "wager");
  assert.equal(long.horizon, "long");
});

test("用户可以否决分类并切换轨道", () => {
  const initial = classifyQuestion("我该不该辞职");
  assert.equal(confirmQuestionTrack(initial, "accept").track, "question");
  const overridden = confirmQuestionTrack(initial, "deny");
  assert.equal(overridden.track, "wager");
  assert.equal(overridden.overridden, true);
  assert.match(overridden.reason, /用户否决/);
});

test("事项主题独立建议用神，辞职取官鬼且用户可以改选", () => {
  const career = classifyQuestion("我该不该辞职");
  assert.deepEqual(
    [career.subject.key, career.subject.label, career.subject.useGod],
    ["career", "工作／官职", "官鬼"],
  );
  assert.match(career.subject.reason, /辞职|工作/);

  const cases: ReadonlyArray<[string, QuestionSubjectKey, string]> = [
    ["这笔债务什么时候能收回", "wealth", "妻财"],
    ["房屋买卖契约是否合适", "documents", "父母"],
    ["这个疾病让我很忧虑", "illness", "官鬼"],
    ["这项医药技术是否值得学", "wellbeing", "子孙"],
    ["我和同事最近怎样相处", "peers", "兄弟"],
  ];
  for (const [question, key, useGod] of cases) {
    const result = classifyQuestion(question).subject;
    assert.deepEqual([result.key, result.useGod], [key, useGod], question);
  }

  const overridden = confirmQuestionSubject(career.subject, "wealth");
  assert.equal(overridden.suggestedKey, "career");
  assert.equal(overridden.key, "wealth");
  assert.equal(overridden.useGod, "妻财");
  assert.equal(overridden.overridden, true);
  assert.equal(QUESTION_SUBJECTS.some((item) => item.key === overridden.key), true);
  assert.throws(() => confirmQuestionSubject(career.subject, "unknown"), /事项主题/);
});

test("分类器源码与卦象和三位易者保持架构隔离", async () => {
  const source = await readFile("src/oracle/question-classifier.ts", "utf8");
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:diviner|zhouyi|hexagram)/i);
  assert.doesNotMatch(source, /高島|五行易|梅花心易|卦辞|爻辞/);
  assert.doesNotMatch(source, /deriveFiveHexagrams|buildLiuyaoChart|getHexagramText/);
});
