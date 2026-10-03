// tests/helpers/sample-question.ts
import { selectPrimaryOracleText } from "../../src/calendar/bianzhan.js";
import { deriveMeihua } from "../../src/calendar/meihua.js";
import {
  buildLiuyaoChart,
  deriveFiveHexagrams,
} from "../../src/oracle/liuyao-chart.js";
import { buildQuestionFacts } from "../../src/sanyi/facts.js";
import type { QuestionSchoolOutput } from "../../src/sanyi/schema.js";

export const TIME = BigInt(Date.UTC(2026, 8, 30, 12, 15) / 1_000);
export const LINES: readonly number[] = [9, 7, 7, 8, 8, 8];
export const chart = buildLiuyaoChart({
  lines: LINES,
  timestamp: TIME,
  focus: {
    subjectKey: "career",
    subjectLabel: "工作／官职",
    useGod: "官鬼",
    overridden: false,
  },
});
export const facts = buildQuestionFacts(
  chart,
  deriveFiveHexagrams(LINES),
  deriveMeihua(LINES, TIME),
  selectPrimaryOracleText(LINES),
);
export const baseOutput: QuestionSchoolOutput = {
  verdict: "平",
  confidenceTenths: 5,
  headline: "守正待时",
  reason: "条件未齐",
  sections: [
    { title: "用神", text: "先看用神" },
    { title: "世应", text: "再看世应" },
    { title: "动变", text: "后看动变" },
  ],
  advice: ["等待明确通知"],
  evidence: [{ ref: "line:2", claim: "官鬼" }],
};
