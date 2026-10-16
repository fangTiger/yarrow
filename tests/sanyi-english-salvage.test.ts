// tests/sanyi-english-salvage.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  StructuredOutputError,
  validateWithSalvage,
  type StructuredOutputProvider,
  type StructuredOutputRequest,
} from "../src/agent/provider.js";
import { salvageEnglishOutput, schemaHintsEn, trimEnglishText } from "../src/sanyi/english/salvage.js";
import { QUESTION_SCHOOL_SCHEMA_EN } from "../src/sanyi/english/schema.js";
import type { QuestionSchoolOutput } from "../src/sanyi/schema.js";
import { runSchool } from "../src/sanyi/school-runner.js";
import { QUESTION_SCHOOLS } from "../src/sanyi/schools/index.js";
import { facts } from "./helpers/sample-question.js";

/** 模拟 DeepSeek：拿到原始输出后按请求的 Schema（与 salvage）校验。 */
class ValidatingProvider implements StructuredOutputProvider {
  readonly modelId = "fake";
  readonly providerConfig = {};
  readonly providerConfigHash = `0x${"00".repeat(32)}` as const;
  readonly requests: StructuredOutputRequest[] = [];
  constructor(private readonly responses: unknown[]) {}
  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    this.requests.push(request);
    return validateWithSalvage<T>(request, this.responses.shift());
  }
}

const englishOutput: QuestionSchoolOutput = {
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

test("英文截短：优先句末，退到词边界加省略号，未超长原样返回", () => {
  assert.equal(trimEnglishText("Short enough.", 40), "Short enough.");
  assert.equal(
    trimEnglishText("The first sentence stays. The second sentence is far too long to keep here.", 40),
    "The first sentence stays.",
  );
  const word = trimEnglishText("one two three four five six seven eight nine ten eleven", 30);
  assert.ok([...word].length <= 30);
  assert.match(word, /…$/u);
  assert.doesNotMatch(word, /\s…$/u);
  // 小数点不算句末。
  assert.equal(trimEnglishText("Odds are about 5.5 out of ten here. Extra words follow on.", 40),
    "Odds are about 5.5 out of ten here.");
});

test("抢救只处理超长与多余字段，其他结构问题不抢救", () => {
  const value = {
    reason: "First sentence is fine. Second sentence pushes it over.",
    sections: [{ title: "A", text: "Fine.", timing: "extra" }],
    evidence: [{ ref: "line:1", claim: "中文", claim_en: "English" }],
  };
  const salvaged = salvageEnglishOutput(value, [
    { instancePath: "/reason", schemaPath: "", keyword: "maxLength", params: { limit: 30 } },
    { instancePath: "/sections/0", schemaPath: "", keyword: "additionalProperties",
      params: { additionalProperty: "timing" } },
    { instancePath: "/evidence/0", schemaPath: "", keyword: "additionalProperties",
      params: { additionalProperty: "claim_en" } },
  ]) as typeof value;
  assert.equal(salvaged.reason, "First sentence is fine.");
  assert.deepEqual(salvaged.sections[0], { title: "A", text: "Fine." });
  assert.deepEqual(salvaged.evidence[0], { ref: "line:1", claim: "中文" });
  // 原对象不被改动。
  assert.equal(value.sections[0]!.timing, "extra");
  assert.equal(salvageEnglishOutput(value, [
    { instancePath: "", schemaPath: "", keyword: "required", params: { missingProperty: "advice" } },
  ]), undefined);
});

test("validateWithSalvage：英文 Schema 下超长 reason 与多余字段被修好；无 salvage 仍抛错", () => {
  const raw = {
    ...englishOutput,
    reason: `${"This reason keeps going. ".repeat(30)}`,
    evidence: [{ ...englishOutput.evidence[0]!, claim_en: "extra" }],
  };
  const repaired = validateWithSalvage<QuestionSchoolOutput>(
    { schema: QUESTION_SCHOOL_SCHEMA_EN, salvage: salvageEnglishOutput }, raw);
  assert.ok([...repaired.reason].length <= 400);
  assert.match(repaired.reason, /\.$/u);
  assert.deepEqual(Object.keys(repaired.evidence[0]!), ["ref", "claim"]);
  assert.throws(() => validateWithSalvage({ schema: QUESTION_SCHOOL_SCHEMA_EN }, raw), StructuredOutputError);
});

test("英文问事一家：超长输出就地抢救，一次通过；中文请求不带 salvage", async () => {
  const school = QUESTION_SCHOOLS[1]!;
  const base = { school, question: "Will I get this job?", facts, originalTexts: [] as string[] };
  const english = new ValidatingProvider([{ ...englishOutput, headline: `${"Very long headline words ".repeat(10)}` }]);
  const result = await runSchool({ provider: english }, { ...base, language: "en" });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 1);
  assert.equal(typeof english.requests[0]?.salvage, "function");

  const chinese = new ValidatingProvider([{}]);
  await runSchool({ provider: chinese }, { ...base, question: "这次面试能过吗" }).catch(() => undefined);
  assert.equal(chinese.requests[0]?.salvage, undefined);
});

test("无法抢救时英文订单收到英文重写提示", () => {
  const hints = schemaHintsEn(new StructuredOutputError("x", [
    { instancePath: "/advice", schemaPath: "", keyword: "minItems", params: { limit: 1 } },
    { instancePath: "/reason", schemaPath: "", keyword: "maxLength", params: { limit: 400 } },
  ]));
  assert.match(hints.join("\n"), /Field \/advice needs at least 1 items\./u);
  assert.match(hints.join("\n"), /within 400 characters/u);
  assert.doesNotMatch(hints.join("\n"), /\p{Script=Han}/u);
});
