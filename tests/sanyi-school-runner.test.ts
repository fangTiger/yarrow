// tests/sanyi-school-runner.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  StructuredOutputError,
  type StructuredOutputProvider,
  type StructuredOutputRequest,
} from "../src/agent/provider.js";
import { mockSchoolOutput } from "../src/sanyi/mock-schools.js";
import { runSchool } from "../src/sanyi/school-runner.js";
import type { QuestionSchoolOutput } from "../src/sanyi/schema.js";
import { QUESTION_SCHOOLS } from "../src/sanyi/schools/index.js";
import { facts } from "./helpers/sample-question.js";

class FakeProvider implements StructuredOutputProvider {
  readonly modelId = "fake";
  readonly providerConfig = {};
  readonly providerConfigHash = `0x${"00".repeat(32)}` as const;
  readonly requests: StructuredOutputRequest[] = [];

  constructor(
    private readonly responses: Array<QuestionSchoolOutput | Error>,
  ) {}

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error("测试响应不足");
    }
    if (response instanceof Error) {
      throw response;
    }
    return response as T;
  }
}

const school = QUESTION_SCHOOLS[1];
const valid = mockSchoolOutput("jingfang", facts);
const invalid: QuestionSchoolOutput = {
  ...valid,
  verdict: "吉",
  confidenceTenths: 3,
};
const input = {
  school,
  question: "这次面试能过吗",
  facts,
  originalTexts: ["本卦 地天泰 卦辞：泰，小往大来，吉亨。"],
};

test("一次通过返回 done 且 calls 为一", async () => {
  const provider = new FakeProvider([valid]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "done");
  assert.equal(result.calls, 1);
});

test("首次核对失败后重写通过，并附带上次错误", async () => {
  const provider = new FakeProvider([invalid, valid]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /吉对应的把握不得低于六成/);
});

test("三次都不过时删错留对，照常返回 done 并记录校正", async () => {
  const provider = new FakeProvider([invalid, invalid, invalid]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "done");
  assert.equal(result.calls, 3);
  if (result.status === "done") {
    assert.equal(result.output.confidenceTenths, 6);
    assert.equal(result.adjusted, 1);
    assert.equal(result.removed, 0);
  }
});

test("结构不合 Schema 时带具体字段提示重写", async () => {
  const schemaError = new StructuredOutputError("结构化输出不符合 JSON Schema", [{
    instancePath: "/headline", schemaPath: "#/properties/headline/maxLength", keyword: "maxLength",
    params: { limit: 16 }, message: "must NOT have more than 16 characters",
  }]);
  const provider = new FakeProvider([schemaError, valid]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /\/headline 不超过 16 字/);
});

test("模型抛错返回 failed 与中文错误", async () => {
  const provider = new FakeProvider([new Error("暂不可用")]);
  const result = await runSchool({ provider }, input);
  assert.equal(result.status, "failed");
  assert.equal(result.calls, 1);
  assert.match(result.status === "failed" ? result.error : "", /模型调用失败.*暂不可用/);
});
