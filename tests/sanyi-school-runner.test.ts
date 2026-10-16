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
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";

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

const validEnglish: QuestionSchoolOutput = {
  verdict: "平",
  confidenceTenths: 5,
  headline: "Wait for clearer conditions",
  reason: "The chart is mixed, so verify the practical conditions first.",
  sections: [
    { title: "Key line", text: "Zi Water Wealth is active, but the result remains mixed." },
    { title: "Change", text: "Keep room to adjust as new information arrives." },
    { title: "Action", text: "Prepare a fallback before committing." },
  ],
  advice: ["Check the facts before acting."],
  evidence: [{ ref: "line:1", claim: "初爻甲子水妻财发动" }],
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

test("英文路径选英文提示、英文 Schema 与附加术语及古文材料", async () => {
  const provider = new FakeProvider([validEnglish]);
  const result = await runSchool({ provider }, { ...input, language: "en" });
  assert.equal(result.status, "done");
  const request = provider.requests[0]!;
  assert.match(request.systemPrompt, /You are Jing Fang/u);
  assert.match(request.systemPrompt, /evidence\[\]\.claim.*Chinese/u);
  assert.match(request.userPrompt, /本盘术语英文对照/u);
  assert.match(request.userPrompt, /古文英译/u);
  const schema = request.schema as unknown as { properties: { headline: { maxLength?: number } } };
  assert.equal(schema.properties.headline.maxLength, 90);
});

test("英文 headline 混入汉字时重写，末尾再次强调正文英文、evidence 中文", async () => {
  const provider = new FakeProvider([{ ...validEnglish, headline: "Wait 时机" }, validEnglish]);
  const result = await runSchool({ provider }, { ...input, language: "en" });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /正文仍须用英文.*evidence.*中文/u);
});

test("英文路径的中文 evidence 编造干支时照常被拦并重写", async () => {
  const fabricated = {
    ...validEnglish,
    evidence: [{ ref: "line:1", claim: "丙辰火官鬼发动" }],
  };
  const provider = new FakeProvider([fabricated, validEnglish]);
  const result = await runSchool({ provider }, { ...input, language: "en" });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /不支持关键词|不支持盘面组合/u);
});

test("英文路径拒绝没有中文事实术语的空洞 evidence", async () => {
  const emptyClaim = {
    ...validEnglish,
    evidence: [{ ref: "line:1", claim: "123" }],
  };
  const provider = new FakeProvider([emptyClaim, validEnglish]);
  const result = await runSchool({ provider }, { ...input, language: "en" });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /中文盘面术语/u);
});

test("英文三次重写仍有坏段时删错留对并保持至少三段", async () => {
  const stubborn = {
    ...validEnglish,
    sections: validEnglish.sections.map((section) => ({
      ...section,
      text: "Bing Chen is not present.",
    })),
  };
  const result = await runSchool({ provider: new FakeProvider([stubborn, stubborn, stubborn]) }, {
    ...input, language: "en",
  });
  assert.equal(result.status, "done");
  if (result.status === "done") {
    assert.equal(result.calls, 3);
    assert.ok(result.output.sections.length >= 3);
    assert.ok(result.output.sections.every((section) => !section.text.includes("Bing Chen")));
  }
});

test("mock provider 可直接走英文问事路径", async () => {
  const result = await runSchool({ provider: new MockSchoolsProvider() }, {
    ...input, language: "en",
  });
  assert.equal(result.status, "done");
  if (result.status === "done") {
    assert.doesNotMatch(JSON.stringify({
      headline: result.output.headline,
      reason: result.output.reason,
      sections: result.output.sections,
      advice: result.output.advice,
    }), /\p{Script=Han}/u);
  }
});
