// tests/sanyi-summary.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  StructuredOutputError, validateStructuredOutput, type StructuredOutputProvider,
  type StructuredOutputRequest,
} from "../src/agent/provider.js";
import { auditQuestionProse } from "../src/sanyi/audit.js";
import {
  SUMMARY_SCHEMA, SUMMARY_SYSTEM_PROMPT, buildSummaryPrompt, checkSummary, expectedTone,
  repairSummary, runSummary, type PlainSummary, type SummaryInput,
} from "../src/sanyi/summary.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { facts } from "./helpers/sample-question.js";

const input: SummaryInput = {
  kind: "question",
  question: "这次面试能过吗",
  consensus: 4.67,
  chartPoints: ["本卦地天泰，之卦地风升", "用神官鬼在二爻，寅木旬空"],
  anchor: { title: "《象传》· 地天泰", lines: ["天地交，泰；后以财成天地之道，辅相天地之宜，以左右民。"] },
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
  remedy: {
    principle: "顺势而为，先把能做的准备做足。",
    plan: [
      { action: "面试前把作品集再打磨一遍", basis: "三家都认为时机还没完全到", timing: "面试前一周" },
      { action: "结果出来前别放弃其他机会", basis: "用神力量不足，结果未明" },
    ],
    avoid: ["不要急着催问结果"],
  },
};
const portrait = {
  traits: ["重情义", "求稳", "有担当"],
  strengths: ["做事稳妥，能顾全大局", "遇事愿意承担责任"],
  blindSpots: ["有时顾虑过多", "压力大时容易固执"],
  summary: "重承诺也重秩序，稳中带着韧劲。",
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
  for (const text of ["这次面试能过吗", "约4.7成", "合议倾向：中", "依据 3 家断语", "地天泰", "程颐", "京房", "邵雍",
    "官鬼旬空无力", "心法依据（《象传》· 地天泰）", "天地交，泰"]) {
    assert.ok(prompt.includes(text), text);
  }
  for (const text of ["白话", "括号", "不得新增", "医疗", "JSON Schema", "remedy", "开光", "不给颜色、方位"]) {
    assert.ok(SUMMARY_SYSTEM_PROMPT.includes(text), text);
  }
  for (const text of ["portrait", "性格", "逐运合议", "命理不写 tone"]) {
    assert.ok(SUMMARY_SYSTEM_PROMPT.includes(text), text);
  }
  assert.doesNotMatch(SUMMARY_SYSTEM_PROMPT, /押钱|赔付|封存|易者/);
  const lifePrompt = buildSummaryPrompt({
    ...input, kind: "destiny", consensus: null,
    periodConsensus: "第1步 壬午 7–16岁 4.0成；第2步 癸未 17–26岁 6.0成",
  });
  assert.match(lifePrompt,
    /逐运合议：第1步 壬午 7–16岁 4\.0成；第2步 癸未 17–26岁 6\.0成/);
});

test("画像 Schema 可选但结构严格限制条数与长度", () => {
  assert.doesNotThrow(() => validateStructuredOutput(SUMMARY_SCHEMA, good));
  assert.doesNotThrow(() => validateStructuredOutput(SUMMARY_SCHEMA, { ...good, portrait }));
  assert.throws(() => validateStructuredOutput(SUMMARY_SCHEMA, {
    ...good, portrait: { ...portrait, traits: ["求稳", "重情义"] },
  }));
  assert.throws(() => validateStructuredOutput(SUMMARY_SCHEMA, {
    ...good, portrait: { ...portrait, strengths: ["做事稳妥"] },
  }));
  assert.throws(() => validateStructuredOutput(SUMMARY_SCHEMA, {
    ...good, portrait: { ...portrait, blindSpots: ["谨慎", "固执", "多虑"] },
  }));
  assert.throws(() => validateStructuredOutput(SUMMARY_SCHEMA, {
    ...good, portrait: { ...portrait, traits: ["超过六个字标签", "求稳", "重情义"] },
  }));
});

test("问事与运势拒绝画像，命理须有画像且按逐运合议决定走势", () => {
  assert.deepEqual(checkSummary(good, input), []);
  assert.match(checkSummary({ ...good, tone: "顺" }, input).join(""), /倾向.*中/);
  const destiny = { ...input, kind: "destiny" as const, consensus: null };
  assert.match(checkSummary(good, destiny).join(""), /命理不写倾向/);
  const { tone: _tone, ...noTone } = good;
  assert.match(checkSummary(noTone, destiny).join(""), /命理须写性格画像/);
  assert.deepEqual(checkSummary({ ...noTone, portrait }, destiny), []);
  assert.match(checkSummary({ ...noTone, portrait: {
    ...portrait, traits: ["求稳", "重情义"],
  } }, destiny).join(""), /性格标签须为 3 至 5 项/);
  assert.match(checkSummary({ ...noTone, portrait, outlook: "中年渐顺。" }, destiny).join(""),
    /没有逐运合议.*outlook/);
  const life = { ...destiny, periodConsensus: "第1步 壬午 7–16岁 4.0成" };
  assert.match(checkSummary({ ...noTone, portrait }, life).join(""), /一生走势.*outlook/);
  assert.deepEqual(
    checkSummary({ ...noTone, portrait, outlook: "早年宜守，中年渐顺。" }, life),
    [],
  );
  const fortune = { ...input, kind: "fortune" as const };
  assert.match(checkSummary(good, fortune).join(""), /十年走势/);
  assert.deepEqual(checkSummary({ ...good, outlook: "前三年偏弱，后几年渐顺。" }, fortune), []);
  assert.match(checkSummary({ ...good, portrait, outlook: "前三年偏弱，后几年渐顺。" }, fortune)
    .join(""), /运势不写性格画像/);
  assert.match(checkSummary({ ...good, portrait }, input).join(""), /问事不写性格画像/);
  assert.match(checkSummary({ ...good, explanation: [...good.explanation, "午火官鬼发动。"] }, input).join(""),
    /不存在的盘面组合/);
});

test("画像标签只查语言与禁用词，其余字段还须通过盘面核对", () => {
  const strict: SummaryInput = {
    ...input, kind: "destiny", consensus: null,
    proseErrors: (text) => (/果断|午火/u.test(text) ? ["编造"] : []),
  };
  const { tone: _tone, ...base } = good;
  assert.deepEqual(checkSummary({
    ...base, portrait: { ...portrait, traits: ["果断", "求稳", "重情义"] },
  }, strict), []);
  assert.match(checkSummary({ ...base, portrait: {
    ...portrait, strengths: ["午火助身，行事果断", portrait.strengths[1]!],
  } }, strict).join(""), /编造/);
  assert.match(checkSummary({ ...base, portrait: {
    ...portrait, traits: ["开光", "求稳", "重情义"],
  } }, strict).join(""), /开光/);
});

test("删错留对：删去编造盘面的句子，倾向不符时改为合议倾向并用模板结论", () => {
  const bad: PlainSummary = {
    ...good,
    tone: "顺",
    conclusion: "大有可为，十拿九稳。",
    explanation: ["代表这件事的那一爻力量不足。午火官鬼发动，形势不妙。", "整体局面平稳。"],
    remedy: {
      principle: "顺势而为。",
      plan: [
        { action: "午火官鬼当令宜守", basis: "官鬼当令" },
        { action: "佩戴开光貔貅化解", basis: "可保平安" },
        { action: "多做准备", basis: "三家都认为时机未到" },
      ],
      avoid: ["不要急于求成"],
    },
  };
  const { output, removed, adjusted } = repairSummary(bad, input);
  assert.equal(output.tone, "中");
  assert.equal(output.conclusion, "合议约4.7成，成败参半，尚无定数。");
  assert.deepEqual(output.explanation, ["代表这件事的那一爻力量不足。", "整体局面平稳。"]);
  assert.deepEqual(output.remedy?.plan, [{ action: "多做准备", basis: "三家都认为时机未到" }]);
  assert.equal(removed, 3);
  assert.equal(adjusted, 1);
  assert.deepEqual(checkSummary(output, input), []);
});

test("解法禁用词：开光、法器、放生之类与颜色方位趋避判为不符", () => {
  const charm = { ...good, remedy: { ...good.remedy!, avoid: ["不要去放生"] } };
  assert.match(checkSummary(charm, input).join(""), /放生/);
  const lucky = { ...good, explanation: [...good.explanation, "穿幸运色出门更顺。"] };
  assert.match(checkSummary(lucky, input).join(""), /幸运色/);
});

test("心法原文在核对前剔除，原文以外的编造照常报错", () => {
  const strict: SummaryInput = { ...input, proseErrors: (text) => (/财成|午火/.test(text) ? ["编造"] : []) };
  const quoted = { ...good, remedy: { ...good.remedy!, principle: "后以财成天地之道，凡事先顺势。" } };
  assert.deepEqual(checkSummary(quoted, strict), []);
  const made = { ...good, explanation: [...good.explanation, "午火发动。"] };
  assert.deepEqual(checkSummary(made, strict), ["编造"]);
});

test("解法全被删时用模板兜底：问事与八字心法不同", () => {
  const empty: PlainSummary = {
    ...good,
    remedy: { principle: "开光转运。", plan: [{ action: "烧香供奉", basis: "求神" }], avoid: ["放生"] },
  };
  const question = repairSummary(empty, input).output.remedy;
  assert.equal(question?.principle, "按上方原文之意，守正而行。");
  assert.deepEqual(question?.plan, [{ action: "对照下方三家依据，择其稳妥者先行", basis: "三家断语" }]);
  assert.deepEqual(question?.avoid, ["不要据此做重大财务或医疗决定"]);
  const destiny = { ...input, kind: "destiny" as const, consensus: null };
  const { tone: _tone, ...noTone } = empty;
  assert.equal(repairSummary(noTone, destiny).output.remedy?.principle, "按三家取用之意，扬长避短。");
});

test("画像修补删去坏条目，条目不足或总评不合格时整块省略", () => {
  const destiny: SummaryInput = {
    ...input, kind: "destiny", consensus: null,
    proseErrors: (text) => (/午火/u.test(text) ? ["编造"] : []),
  };
  const { tone: _tone, ...base } = good;
  const kept = repairSummary({ ...base, portrait: {
    ...portrait, traits: [...portrait.traits, "开光"],
  } }, destiny);
  assert.deepEqual(kept.output.portrait, portrait);
  assert.equal(kept.removed, 1);

  const fewTraits = repairSummary({ ...base, portrait: {
    ...portrait, traits: ["求稳", "开光", "重情义"],
  } }, destiny);
  assert.equal(fewTraits.output.portrait, undefined);

  const missingStrength = repairSummary({ ...base, portrait: {
    ...portrait, strengths: ["午火助身", "午火使人果断"],
  } }, destiny);
  assert.equal(missingStrength.output.portrait, undefined);

  const missingSummary = repairSummary({ ...base, portrait: {
    ...portrait, summary: "午火使人果断。",
  } }, destiny);
  assert.equal(missingSummary.output.portrait, undefined);
});

test("命理走势修补只在有逐运合议时保留或补上 outlook", () => {
  const { tone: _tone, ...base } = good;
  const without = { ...input, kind: "destiny" as const, consensus: null };
  assert.equal(repairSummary({ ...base, portrait, outlook: "早年宜守。" }, without).output.outlook,
    undefined);
  const withPeriods = { ...without, periodConsensus: "第1步 壬午 7–16岁 4.0成" };
  assert.equal(repairSummary({ ...base, portrait }, withPeriods).output.outlook,
    "一生大运起伏见「一生运势」。");
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
