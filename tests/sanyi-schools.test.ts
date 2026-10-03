// tests/sanyi-schools.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { Ajv } from "ajv";
import { auditOutput } from "../src/sanyi/audit.js";
import { buildOriginalTexts } from "../src/sanyi/original-texts.js";
import { mockSchoolOutput } from "../src/sanyi/mock-schools.js";
import {
  QUESTION_SCHOOL_SCHEMA,
  checkVerdictConsistency,
} from "../src/sanyi/schema.js";
import { QUESTION_SCHOOLS } from "../src/sanyi/schools/index.js";
import {
  LINES,
  facts,
} from "./helpers/sample-question.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { selectPrimaryOracleText } from "../src/calendar/bianzhan.js";

const originals = buildOriginalTexts(
  deriveFiveHexagrams(LINES),
  selectPrimaryOracleText(LINES),
);

test("原文清单含本卦之卦全部爻辞与主占之辞", () => {
  assert.match(originals.join("\n"), /本卦 地天泰 初九：拔茅茹/);
  assert.match(originals.join("\n"), /之卦 地风升/);
  assert.match(originals.join("\n"), /主占之辞/);
  assert.equal(originals.filter((line) => /[初二三四五上]/.test(line)).length >= 12, true);
});

test("三家系统提示词给出完整写作与安全边界", () => {
  for (const school of QUESTION_SCHOOLS) {
    assert.match(school.systemPrompt, /不得出现押钱、赔付、封存/);
    assert.match(school.systemPrompt, /evidence\.ref/);
    assert.match(school.systemPrompt, /JSON/);
    assert.match(school.systemPrompt, /健康.*就医/s);
    assert.match(school.systemPrompt, /医疗、法律或投资结论/);
    assert.match(school.systemPrompt, /自称只用本名/);
  }
  assert.match(QUESTION_SCHOOLS[1].systemPrompt, /以用神为纲/);
  assert.match(QUESTION_SCHOOLS[2].systemPrompt, /按本站体用取法/);
  assert.match(QUESTION_SCHOOLS[2].systemPrompt, /不得虚构外应/);
});

test("三家用户提示严格隔离事实且都收到原文", () => {
  const prompts = QUESTION_SCHOOLS.map((school) => {
    return school.buildUserPrompt({
      question: "这次面试能过吗",
      facts,
      originalTexts: originals,
    });
  });
  assert.doesNotMatch(prompts[0]!, /line:/);
  assert.doesNotMatch(prompts[2]!, /use-god/);
  for (const prompt of prompts) {
    assert.match(prompt, /本卦 地天泰/);
    assert.doesNotMatch(prompt, /值符|黄历|宜：|忌：/);
  }
});

test("三家 mock 同时通过结构、自洽和事实核对", () => {
  const validate = new Ajv({ allErrors: true }).compile(QUESTION_SCHOOL_SCHEMA);
  const pairs = QUESTION_SCHOOLS.map((school) => {
    return [school.key, mockSchoolOutput(school.key, facts)] as const;
  });
  assert.equal(new Set(pairs.map(([, output]) => output.verdict)).size, 3);
  assert.equal(new Set(pairs.map(([, output]) => output.confidenceTenths)).size, 3);
  for (const [key, output] of pairs) {
    assert.equal(validate(output), true, `${key}: ${JSON.stringify(validate.errors)}`);
    assert.deepEqual(checkVerdictConsistency(output), []);
    assert.deepEqual(auditOutput(output, facts), { ok: true, errors: [] });
    assert.doesNotMatch(JSON.stringify(output), /易者|押钱|赔付|封存|・/u);
  }
});
