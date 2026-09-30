import assert from "node:assert/strict";
import test from "node:test";

import { DeterministicMockProvider } from "../src/agent/provider.js";
import type { StructuredOutputRequest } from "../src/agent/provider.js";
import { createDemoProvider } from "../src/demo/provider.js";
import { deriveQuestionHexagram } from "../src/oracle/question-oracle.js";
import {
  DeterministicQuestionInterpreter,
  ProviderQuestionInterpreter,
} from "../src/oracle/question-interpreter.js";

const HEXAGRAM = deriveQuestionHexagram({
  blockHash: `0x${"ab".repeat(32)}`,
  question: "我该不该辞职",
});

test("provider 解读使用独立任务，不输出概率或押注结论", async () => {
  let seenPrompt = "";
  const provider = new DeterministicMockProvider("mock-question-v1", {
    "question-reading/takashima": (request: StructuredOutputRequest) => {
      seenPrompt = `${request.systemPrompt}\n${request.userPrompt}`;
      return { interpretation: "进退之间先看现实条件。", counsel: "列出辞职后仍可掌控的三件事。" };
    },
  });
  const interpreter = new ProviderQuestionInterpreter(provider);
  const result = await interpreter.interpret({
    question: "我该不该辞职",
    divinerKey: "takashima",
    divinerName: "高島易断",
    hexagram: HEXAGRAM,
  });

  for (const label of ["本卦", "互卦", "变卦", "错卦", "综卦"]) assert.match(seenPrompt, new RegExp(label));
  assert.match(seenPrompt, /本卦为体，互卦探隐，综卦观反，变卦测果，错卦警变/);
  assert.match(seenPrompt, /主观解释/);
  assert.match(seenPrompt, /不得复述.*责任声明/);
  assert.doesNotMatch(seenPrompt, /probability|概率|押注|USDC|predicate/i);
  assert.match(result.interpretation, /现实条件/);
});

test("确定性 mock 为三家返回不同但克制的解读", async () => {
  const interpreter = new DeterministicQuestionInterpreter();
  const readings = await Promise.all(["takashima", "wuxing", "meihua"].map((divinerKey) => interpreter.interpret({
    question: "我该不该辞职",
    divinerKey,
    divinerName: divinerKey,
    hexagram: HEXAGRAM,
  })));
  assert.equal(new Set(readings.map((reading) => reading.interpretation)).size, 3);
  assert.ok(readings.every((reading) => reading.counsel.length > 0));
  assert.ok(readings.some((reading) => /互卦|症结/.test(reading.interpretation + reading.counsel)));
  assert.ok(readings.some((reading) => /综卦|对方/.test(reading.interpretation + reading.counsel)));
  assert.ok(readings.some((reading) => /错卦|反面/.test(reading.interpretation + reading.counsel)));
});

test("生产问轨选择 mock 时同样不会落到真实模型", async () => {
  const provider = createDemoProvider("mock", { environment: {} });
  const interpreter = new ProviderQuestionInterpreter(provider);
  const readings = await Promise.all([
    ["takashima", "高島易断"],
    ["wuxing", "五行易（断易）"],
    ["meihua", "梅花心易"],
  ].map(([divinerKey, divinerName]) => interpreter.interpret({
    question: "我该不该辞职",
    divinerKey: divinerKey!,
    divinerName: divinerName!,
    hexagram: HEXAGRAM,
  })));
  const combined = readings.map((reading) => `${reading.interpretation}\n${reading.counsel}`).join("\n");
  for (const label of ["本卦", "互卦", "变卦", "错卦", "综卦"]) assert.match(combined, new RegExp(label));
  assert.doesNotMatch(combined, /主观解释|主观观看|不能替你|不替你|答案仍由你承担/);
  assert.equal(provider.modelId, "mock-yijing-demo-v1");
});

test("provider 与确定性 mock 都能读取用户最终确认的用神，而非自行猜主题", async () => {
  let seenPrompt = "";
  const provider = new DeterministicMockProvider("mock-question-focus-v1", {
    "question-reading/wuxing": (request: StructuredOutputRequest) => {
      seenPrompt = `${request.systemPrompt}\n${request.userPrompt}`;
      return { interpretation: "先取官鬼为用神，再看旺衰。", counsel: "核对工作条件。" };
    },
  });
  const input = {
    question: "我该不该辞职",
    divinerKey: "wuxing",
    divinerName: "五行易（断易）",
    hexagram: HEXAGRAM,
    subject: {
      suggestedKey: "career",
      key: "career",
      label: "工作／官职",
      useGod: "官鬼",
      reason: "问题涉及辞职与工作。",
      overridden: false,
    },
  } as const;
  await new ProviderQuestionInterpreter(provider).interpret(input);
  assert.match(seenPrompt, /最终确认事项：工作／官职/);
  assert.match(seenPrompt, /用神：官鬼/);

  const mock = await new DeterministicQuestionInterpreter().interpret(input);
  assert.match(mock.interpretation + mock.counsel, /官鬼|用神/);
  assert.doesNotMatch(mock.interpretation + mock.counsel, /本次由你确认|不能替你|主观解释/);
});
