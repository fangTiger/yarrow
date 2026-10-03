// tests/sanyi-schema.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { Ajv } from "ajv";
import {
  QUESTION_SCHOOL_SCHEMA,
  checkVerdictConsistency,
  type QuestionSchoolOutput,
  type Verdict,
} from "../src/sanyi/schema.js";
import { baseOutput } from "./helpers/sample-question.js";

function consistency(verdict: Verdict, confidenceTenths: number): string[] {
  return checkVerdictConsistency({ verdict, confidenceTenths });
}

test("五种吉凶使用规定的把握边界", () => {
  for (const verdict of ["大吉", "吉"] as const) {
    assert.deepEqual(consistency(verdict, 6), []);
    assert.notDeepEqual(consistency(verdict, 5), []);
  }
  assert.deepEqual(consistency("平", 4), []);
  assert.deepEqual(consistency("平", 6), []);
  assert.notDeepEqual(consistency("平", 3), []);
  assert.notDeepEqual(consistency("平", 7), []);
  for (const verdict of ["凶", "大凶"] as const) {
    assert.deepEqual(consistency(verdict, 4), []);
    assert.notDeepEqual(consistency(verdict, 5), []);
  }
});

const validate = new Ajv({ allErrors: true }).compile(QUESTION_SCHOOL_SCHEMA);

function valid(value: unknown): boolean {
  return validate(value) === true;
}

test("JSON Schema 接受完整合法对象", () => {
  assert.equal(valid(baseOutput), true, JSON.stringify(validate.errors));
});

const INVALID_CASES: ReadonlyArray<{
  name: string;
  value: QuestionSchoolOutput | Record<string, unknown>;
}> = [
  {
    name: "拒绝十七字标题",
    value: { ...baseOutput, headline: "一二三四五六七八九十一二三四五六七" },
  },
  {
    name: "拒绝少于三段正文",
    value: { ...baseOutput, sections: baseOutput.sections.slice(0, 2) },
  },
  {
    name: "拒绝应期缺少成立条件",
    value: { ...baseOutput, timing: { window: "下月" } },
  },
  {
    name: "拒绝未声明的额外字段",
    value: { ...baseOutput, extra: true },
  },
];

for (const sample of INVALID_CASES) {
  test(sample.name, () => {
    assert.equal(valid(sample.value), false);
  });
}
