// tests/sanyi-audit.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { auditOutput, tokenizeClaim } from "../src/sanyi/audit.js";
import type { QuestionSchoolOutput } from "../src/sanyi/schema.js";
import { baseOutput, facts } from "./helpers/sample-question.js";

function evidenceOutput(ref: string, claim: string): QuestionSchoolOutput {
  return {
    ...baseOutput,
    evidence: [{ ref, claim }],
  };
}

function proseOutput(text: string): QuestionSchoolOutput {
  return {
    ...baseOutput,
    sections: [
      { title: "正文", text },
      ...baseOutput.sections.slice(1),
    ],
  };
}

const CASES: ReadonlyArray<{
  name: string;
  output: QuestionSchoolOutput;
  expected: boolean;
}> = [
  {
    name: "允许二爻甲寅木官鬼死且旬空",
    output: evidenceOutput("line:2", "甲寅木官鬼死且旬空"),
    expected: true,
  },
  {
    name: "允许上爻应爻酉金子孙旺",
    output: evidenceOutput("line:6", "应爻酉金子孙旺"),
    expected: true,
  },
  {
    name: "允许初爻动化丑土回头克",
    output: evidenceOutput("line:1", "初爻子水动化丑土回头克"),
    expected: true,
  },
  {
    name: "允许三爻世爻辰土兄弟休",
    output: evidenceOutput("line:3", "世爻辰土兄弟休"),
    expected: true,
  },
  {
    name: "允许二爻伏乙巳火父母",
    output: evidenceOutput("line:2", "伏乙巳火父母"),
    expected: true,
  },
  {
    name: "允许用神官鬼与忌神子孙",
    output: evidenceOutput("use-god", "用神官鬼，忌神子孙"),
    expected: true,
  },
  {
    name: "允许正文引用盘中多个真实组合",
    output: proseOutput("寅木官鬼旬空，子水妻财发动来生，化丑土兄弟回头克"),
    expected: true,
  },
  {
    name: "正文普通词不触发单字误判",
    output: proseOutput("此事宜休息片刻，相助者多，应当耐心"),
    expected: true,
  },
  {
    name: "拦截不存在的时柱编号",
    output: evidenceOutput("pillar:time", "庚戌"),
    expected: false,
  },
  {
    name: "拦截三爻虚构旬空",
    output: evidenceOutput("line:3", "辰土兄弟旬空"),
    expected: false,
  },
  {
    name: "拦截二爻错误六亲",
    output: evidenceOutput("line:2", "寅木妻财"),
    expected: false,
  },
  {
    name: "拦截四爻虚构发动",
    output: evidenceOutput("line:4", "癸丑土兄弟动"),
    expected: false,
  },
  {
    name: "拦截正文不存在的午火官鬼",
    output: proseOutput("午火官鬼旺"),
    expected: false,
  },
];

for (const sample of CASES) {
  test(sample.name, () => {
    const result = auditOutput(sample.output, facts);
    assert.equal(result.ok, sample.expected, result.errors.join("；"));
  });
}

test("分词按最长候选从左到右匹配", () => {
  assert.deepEqual(
    tokenizeClaim("应爻酉金子孙旺"),
    ["应", "酉", "金", "子孙", "旺"],
  );
  assert.deepEqual(tokenizeClaim("甲寅木官鬼"), ["甲寅", "木", "官鬼"]);
  assert.deepEqual(tokenizeClaim("化丑土回头克"), ["丑", "土", "回头克"]);
});
