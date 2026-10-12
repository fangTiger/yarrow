import assert from "node:assert/strict";
import test from "node:test";
import { hanCharacterRatio, chineseBodyErrors } from "../src/sanyi/language-guard.js";
import { checkVerdictConsistency, type QuestionSchoolOutput } from "../src/sanyi/schema.js";
import { checkBaziConsistency, type DestinySchoolOutput } from "../src/sanyi/bazi-schema.js";
import { checkSummary, SUMMARY_SYSTEM_PROMPT, type PlainSummary, type SummaryInput } from "../src/sanyi/summary.js";
import { QUESTION_SCHOOLS } from "../src/sanyi/schools/index.js";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import { auditFamily, auditNamingSummary } from "../src/sanyi/naming/audit.js";
import { NAMING_FAMILIES } from "../src/sanyi/naming/families.js";
import { NAMING_SUMMARY_SYSTEM_PROMPT } from "../src/sanyi/naming/runner.js";
import type { NamingContext, NamingFamilyOutput } from "../src/sanyi/naming/schema.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { runSchool } from "../src/sanyi/school-runner.js";
import { mockSchoolOutput } from "../src/sanyi/mock-schools.js";
import { facts } from "./helpers/sample-question.js";
import type { StructuredOutputRequest } from "../src/agent/provider.js";

test("汉字占比以汉字和拉丁字母为分母，低于 50% 时要求中文重写", () => {
  assert.equal(hanCharacterRatio("中文 zh"), 0.5);
  assert.equal(hanCharacterRatio("结论 is clear"), 2 / 9);
  assert.deepEqual(chineseBodyErrors(["中文 zh"]), []);
  assert.deepEqual(chineseBodyErrors(["The answer is no."]), ["正文汉字占比低于 50%，请用中文作答"]);
  assert.deepEqual(chineseBodyErrors(["2026，六成。"]), []);
});

const englishQuestion: QuestionSchoolOutput = {
  verdict: "平", confidenceTenths: 5,
  headline: "Wait for clarity", reason: "The conditions are not ready yet.",
  sections: [{ title: "Analysis", text: "The signal remains mixed and uncertain." }],
  advice: ["Prepare another option."],
  evidence: [{ ref: "fact:1", claim: "用户问题原文可以是英文，不计入正文比例" }],
};

test("问事与八字核对只看模型正文，英文正文触发中文重写", () => {
  assert.match(checkVerdictConsistency(englishQuestion).join("\n"), /请用中文作答/u);
  const destiny: DestinySchoolOutput = {
    useGod: "Metal is useful", headline: "A balanced chart", reason: "The structure is stable.",
    sections: [{ title: "Career", text: "Choose work that rewards patience." }],
    advice: ["Stay consistent."], evidence: [{ ref: "pillar:day", claim: "庚辰" }],
  };
  assert.match(checkBaziConsistency(destiny, sampleBazi("destiny").chart, "year").join("\n"),
    /请用中文作答/u);
});

test("总述核对不把英文问题原文计入汉字占比", () => {
  const input: SummaryInput = {
    kind: "destiny", question: "What career suits me?", consensus: null,
    chartPoints: [], schools: [], anchor: { title: "依据", lines: [] }, proseErrors: () => [],
  };
  const chinese: PlainSummary = {
    conclusion: "适合稳中求进。", agreement: "三家都认为宜发挥耐心。",
    explanation: ["命局整体较稳，先积累经验。"],
    remedy: { principle: "稳步行动。", plan: [{ action: "先做准备", basis: "三家意见" }], avoid: ["不要冒进"] },
  };
  assert.deepEqual(checkSummary(chinese, input), []);
  const english: PlainSummary = {
    conclusion: "Choose a stable career path.", agreement: "All schools prefer steady progress.",
    explanation: ["Build experience before making a major change."],
    remedy: {
      principle: "Move carefully.",
      plan: [{ action: "Prepare first", basis: "The schools agree" }],
      avoid: ["Do not rush"],
    },
  };
  assert.match(checkSummary(english, input).join("\n"), /请用中文作答/u);
});

const namingContext: NamingContext = {
  target: "person", surname: "张", gender: "female", length: 2,
  question: "A calm and bright name", favorable: ["水"], favorableSource: "missing",
  favorableNote: "八字缺水", candidates: [],
};
const englishNaming: NamingFamilyOutput = {
  note: "Choose names with a calm feeling.",
  names: ["清宁", "清涵", "清和"].map((given) => ({
    given, meaning: "Calm and bright", why: "It sounds gentle and clear",
    chars: [...given].map((char) => ({ char, gloss: "Bright meaning", sense: "A positive personal quality" })),
    tags: ["Calm", "Bright", "Kind"],
  })),
};

test("起名三家与合参只检查模型文案，不靠名字汉字掩盖英文正文", () => {
  assert.match(auditFamily("wuxing", englishNaming, namingContext).join("\n"), /请用中文作答/u);
  assert.match(auditNamingSummary({
    picks: [{ given: "清宁", reason: "It sounds calm and bright" }, { given: "清涵", reason: "A gentle choice" }],
    overview: "The families agree on a calm style.", tips: ["Read it aloud", "Ask your family"],
  }, ["清宁", "清涵"], { target: "person" }).join("\n"), /请用中文作答/u);
});

test("三家、总述、起名提示词都明确英文问题仍须中文作答", () => {
  const prompts = [
    ...QUESTION_SCHOOLS.map((school) => school.systemPrompt),
    ...BAZI_SCHOOLS.map((school) => school.systemPrompt),
    ...NAMING_FAMILIES.map((family) => family.systemPrompt),
    SUMMARY_SYSTEM_PROMPT,
    NAMING_SUMMARY_SYSTEM_PROMPT,
  ];
  for (const prompt of prompts) {
    assert.match(prompt, /问题可能是英文，请仍用中文作答/u);
  }
});

test("英文问事正文的重写提示包含「请用中文作答」，中文重写后通过", async () => {
  const requests: string[] = [];
  const chinese = mockSchoolOutput("chengyi", facts);
  const result = await runSchool({
    provider: {
      modelId: "language-guard-test",
      providerConfig: {},
      providerConfigHash: `0x${"00".repeat(32)}` as `0x${string}`,
      generateStructured: async <T>(request: StructuredOutputRequest) => {
        requests.push(request.userPrompt);
        return (requests.length === 1 ? englishQuestion : chinese) as T;
      },
    },
  }, {
    school: QUESTION_SCHOOLS[0]!, question: "Will I get this job?", facts, originalTexts: [],
  });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(requests[1] ?? "", /请用中文作答/u);
});
