// tests/sanyi-summary.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { StructuredOutputError, type StructuredOutputProvider, type StructuredOutputRequest } from "../src/agent/provider.js";
import { auditQuestionProse } from "../src/sanyi/audit.js";
import {
  SUMMARY_SYSTEM_PROMPT, buildSummaryPrompt, checkSummary, expectedTone, repairSummary, runSummary,
  type PlainSummary, type SummaryInput,
} from "../src/sanyi/summary.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { facts } from "./helpers/sample-question.js";

const input: SummaryInput = {
  kind: "question",
  question: "这次面试能过吗",
  consensus: 4.67,
  chartPoints: ["本卦地天泰，之卦地风升", "用神官鬼在二爻，寅木旬空"],
  schools: [
    { name: "程颐", school: "义理派", verdict: "平", confidenceTenths: 5, headline: "守正待时",
      reason: "时机未至", sections: [{ title: "卦义", text: "泰卦小往大来" }], advice: ["稍安勿躁"] },
    { name: "京房", school: "纳甲六爻", verdict: "凶", confidenceTenths: 4, headline: "用神旬空",
      reason: "官鬼旬空无力", sections: [{ title: "用神", text: "二爻寅木官鬼旬空" }], advice: ["多做准备"] },
    { name: "邵雍", school: "梅花易数", verdict: "平", confidenceTenths: 5, headline: "体用相持",
      reason: "体用比和", sections: [{ title: "体用", text: "体用比和" }], advice: ["耐心等待"] },
  ],
  proseErrors: (text) => auditQuestionProse(text, facts),
};
const good: PlainSummary = {
  tone: "中",
  conclusion: "能不能过还说不准，眼下条件未齐，偏向需要再等一等。",
  agreement: "三家都认为时机还没完全到。",
  difference: "京房更悲观一些，程颐、邵雍认为还有余地。",
  explanation: ["代表这件事的那一爻目前力量不足，所以结果还不明朗。", "整体局面平稳，没有大的阻碍，也没有明显的助力。"],
  advice: ["面试前把作品集再打磨一遍。", "结果出来前别急着放弃其他机会。"],
};

test("倾向由合议决定：六成以上偏顺，四成以下偏不顺，其余为中", () => {
  assert.equal(expectedTone(6), "顺");
  assert.equal(expectedTone(7.3), "顺");
  assert.equal(expectedTone(4), "不顺");
  assert.equal(expectedTone(3.5), "不顺");
  assert.equal(expectedTone(4.67), "中");
  assert.equal(expectedTone(5.9), "中");
});

test("提示词含所问、合议倾向、盘面要点与三家断语；系统提示写明白话与边界", () => {
  const prompt = buildSummaryPrompt(input);
  for (const text of ["这次面试能过吗", "约4.7成", "合议倾向：中", "依据 3 家断语", "地天泰", "程颐", "京房", "邵雍", "官鬼旬空无力"]) {
    assert.ok(prompt.includes(text), text);
  }
  for (const text of ["白话", "括号", "不得新增", "医疗", "JSON Schema"]) {
    assert.ok(SUMMARY_SYSTEM_PROMPT.includes(text), text);
  }
  assert.doesNotMatch(SUMMARY_SYSTEM_PROMPT, /押钱|赔付|封存|易者/);
});

test("一致性核对：倾向须合合议，命理不写倾向与走势，运势须写走势，正文不得编造盘面", () => {
  assert.deepEqual(checkSummary(good, input), []);
  assert.match(checkSummary({ ...good, tone: "顺" }, input).join(""), /倾向.*中/);
  const destiny = { ...input, kind: "destiny" as const, consensus: null };
  assert.match(checkSummary(good, destiny).join(""), /命理不写倾向/);
  const { tone: _tone, ...noTone } = good;
  assert.deepEqual(checkSummary(noTone, destiny), []);
  const fortune = { ...input, kind: "fortune" as const };
  assert.match(checkSummary(good, fortune).join(""), /十年走势/);
  assert.deepEqual(checkSummary({ ...good, outlook: "前三年偏弱，后几年渐顺。" }, fortune), []);
  assert.match(checkSummary({ ...good, explanation: [...good.explanation, "午火官鬼发动。"] }, input).join(""),
    /不存在的盘面组合/);
});

test("删错留对：删去编造盘面的句子，倾向不符时改为合议倾向并用模板结论", () => {
  const bad: PlainSummary = {
    ...good,
    tone: "顺",
    conclusion: "大有可为，十拿九稳。",
    explanation: ["代表这件事的那一爻力量不足。午火官鬼发动，形势不妙。", "整体局面平稳。"],
    advice: ["午火官鬼当令宜守。", "多做准备。"],
  };
  const { output, removed, adjusted } = repairSummary(bad, input);
  assert.equal(output.tone, "中");
  assert.equal(output.conclusion, "合议约4.7成，成败参半，尚无定数。");
  assert.deepEqual(output.explanation, ["代表这件事的那一爻力量不足。", "整体局面平稳。"]);
  assert.deepEqual(output.advice, ["多做准备。"]);
  assert.equal(removed, 2);
  assert.equal(adjusted, 1);
  assert.deepEqual(checkSummary(output, input), []);
});

class Fake implements StructuredOutputProvider {
  readonly modelId = "fake";
  readonly providerConfig = {};
  readonly providerConfigHash = `0x${"00".repeat(32)}` as const;
  readonly requests: StructuredOutputRequest[] = [];
  constructor(private readonly responses: Array<unknown>) {}
  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next as T;
  }
}

test("运行器：一次通过、带错误重写、三次不过删错留对、调用失败", async () => {
  const pass = await runSummary({ provider: new Fake([good]) }, input);
  assert.equal(pass.status, "done");
  assert.equal(pass.calls, 1);
  const rewrite = new Fake([{ ...good, tone: "顺" }, good]);
  const second = await runSummary({ provider: rewrite }, input);
  assert.equal(second.status, "done");
  assert.equal(second.calls, 2);
  assert.match(rewrite.requests[1]?.userPrompt ?? "", /倾向/);
  assert.equal(rewrite.requests[0]?.taskId, "sanyi/summary/question");
  const stubborn = await runSummary({ provider: new Fake([{ ...good, tone: "顺" }, { ...good, tone: "顺" }, { ...good, tone: "顺" }]) }, input);
  assert.equal(stubborn.status, "done");
  assert.equal(stubborn.calls, 3);
  if (stubborn.status === "done") {
    assert.equal(stubborn.output.tone, "中");
    assert.equal(stubborn.adjusted, 1);
  }
  const schema = new StructuredOutputError("结构化输出不符合 JSON Schema", [{
    instancePath: "/conclusion", schemaPath: "#/properties/conclusion/maxLength", keyword: "maxLength",
    params: { limit: 40 }, message: "too long",
  }]);
  const hinted = new Fake([schema, good]);
  assert.equal((await runSummary({ provider: hinted }, input)).status, "done");
  assert.match(hinted.requests[1]?.userPrompt ?? "", /\/conclusion 不超过 40 字/);
  const failed = await runSummary({ provider: new Fake([new Error("网络超时")]) }, input);
  assert.equal(failed.status, "failed");
});

test("mock 总述按合议倾向生成并通过核对（问事、运势、命理）", async () => {
  const mock = new MockSchoolsProvider();
  for (const kind of ["question", "fortune", "destiny"] as const) {
    const value = { ...input, kind, consensus: kind === "destiny" ? null : 6.2 };
    const result = await runSummary({ provider: mock }, value);
    assert.equal(result.status, "done", kind);
    if (result.status === "done") {
      assert.equal(result.calls, 1, kind);
      assert.deepEqual(checkSummary(result.output, value), [], kind);
    }
  }
});
