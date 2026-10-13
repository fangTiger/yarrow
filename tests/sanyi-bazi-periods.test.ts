import assert from "node:assert/strict";
import test from "node:test";
import { validateStructuredOutput } from "../src/agent/provider.js";
import { auditBaziOutput, auditBaziSummaryProse } from "../src/sanyi/bazi-audit.js";
import { publicBaziReading } from "../src/sanyi/bazi-public.js";
import * as baziPublic from "../src/sanyi/bazi-public.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA, baziLanguageErrors,
  checkBaziConsistency, type DestinyPeriodOutput, type DestinySchoolOutput,
  type FortuneSchoolOutput } from "../src/sanyi/bazi-schema.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { repairBazi } from "../src/sanyi/repair.js";
import { runBaziSchool } from "../src/sanyi/bazi-school-runner.js";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import * as baziShared from "../src/sanyi/schools/bazi-shared.js";
import { selectBaziFacts, type BaziSchoolInput } from
  "../src/sanyi/schools/bazi-shared.js";
import type { StoredBaziReading } from "../src/sanyi/store.js";
import type { StructuredOutputRequest } from "../src/agent/provider.js";
import { sampleBazi } from "./helpers/sample-bazi.js";

function expectedPeriods(input = sampleBazi("destiny")): DestinyPeriodOutput[] {
  return (input.chart.luck?.cycles ?? []).map((cycle, position) => ({
    index: cycle.index,
    verdict: position % 2 === 0 ? "吉" : "凶",
    confidenceTenths: position % 2 === 0 ? 7 : 3,
    note: `${cycle.ganZhi}${cycle.stemGod}`,
  }));
}

function destiny(input = sampleBazi("destiny")): DestinySchoolOutput {
  return {
    ...mockBaziSchoolOutput("shenxiaozhan", input.facts, "destiny"),
    periods: expectedPeriods(input),
  };
}

function storedDestiny(outputs: readonly DestinySchoolOutput[], input = sampleBazi("destiny")):
StoredBaziReading {
  const state = (output?: DestinySchoolOutput) => ({
    status: output ? "done" as const : "failed" as const,
    ...(output ? { output } : {}), attempts: 1, retries: 0,
  });
  return {
    id: "periods-test", kind: "destiny", createdAt: "2026-10-13T00:00:00.000Z",
    question: input.question,
    payment: {
      payer: "0x0000000000000000000000000000000000000001",
      recipient: "0x0000000000000000000000000000000000000002",
      transactionHash: "0x01", feeUsdc6: "1000000",
    },
    status: "done", chart: input.chart,
    analysis: undefined, tiaohou: input.tiaohou,
    correction: { dst: "not-applied", solar: "not-applied", timeKnown: true, sect: 1 },
    context: undefined, almanac: undefined, changes: 0,
    schools: {
      shenxiaozhan: state(outputs[0]),
      yuchuntai: state(outputs[1]),
      rentieqiao: state(outputs[2]),
    },
  } as unknown as StoredBaziReading;
}

function consensus(reading: StoredBaziReading) {
  const candidate = (baziPublic as Record<string, unknown>).periodConsensus;
  assert.equal(typeof candidate, "function", "应导出 periodConsensus");
  return (candidate as (value: StoredBaziReading) => Array<{
    index: number; average: number; min: number; max: number; count: number;
  } | null>)(reading);
}

test("命理 Schema 必填逐运列表，并限制逐项字段与长度", () => {
  const input = sampleBazi("destiny");
  const base = mockBaziSchoolOutput("shenxiaozhan", input.facts, "destiny");
  const periods = input.chart.luck!.cycles.map((cycle) => ({
    index: cycle.index, verdict: "吉" as const, confidenceTenths: 6, note: "甲木得扶",
  }));
  assert.doesNotThrow(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, { ...base, periods }));
  assert.doesNotThrow(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, { ...base, periods: [] }));
  assert.doesNotThrow(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, {
    // 提示词要求二十四字以内，Schema 留到三十字的余量，免得一句略长就整份重写。
    ...base, periods: [{ ...periods[0]!, note: "甲".repeat(30) }],
  }));
  const { periods: _periods, ...missing } = base;
  assert.throws(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, missing));
  for (const item of [
    { ...periods[0]!, index: 0 },
    { ...periods[0]!, index: 13 },
    { ...periods[0]!, index: 1.5 },
    { ...periods[0]!, verdict: "小吉" },
    { ...periods[0]!, confidenceTenths: 0 },
    { ...periods[0]!, confidenceTenths: 10 },
    { ...periods[0]!, note: "" },
    { ...periods[0]!, note: "甲".repeat(31) },
  ]) {
    assert.throws(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, {
      ...base, periods: [item],
    }));
  }
  assert.throws(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, {
    ...base,
    periods: Array.from({ length: 13 }, (_, index) => ({ ...periods[0]!, index: index % 12 + 1 })),
  }));
});

test("逐运序列须与盘面完全一致，无大运时只能为空", () => {
  const input = sampleBazi("destiny");
  const output = destiny(input);
  assert.deepEqual(checkBaziConsistency(output, input.chart, "year"), []);
  const periods = output.periods!;
  for (const variant of [
    periods.filter((item) => item.index !== 3),
    [...periods, { ...periods[0]!, index: 9 }],
    [...periods].reverse(),
  ]) {
    assert.match(checkBaziConsistency({ ...output, periods: variant }, input.chart, "year").join("；"),
      /大运编号序列/);
  }
  const noLuck = { ...input.chart, luck: null };
  assert.deepEqual(checkBaziConsistency({ ...output, periods: [] }, noLuck, "year"), []);
  assert.match(checkBaziConsistency(output, noLuck, "year").join("；"),
    /盘面无大运|大运编号序列/);
});

test("逐运吉凶与几成复用自洽规则并带步数前缀", () => {
  const input = sampleBazi("destiny");
  const output = destiny(input);
  const periods = output.periods!.map((item) => item.index === 3
    ? { ...item, verdict: "凶" as const, confidenceTenths: 7 } : item);
  assert.match(checkBaziConsistency({ ...output, periods }, input.chart, "year").join("；"),
    /第 3 步大运：.*四成/);
  const english = {
    ...output, useGod: "1", headline: "1", reason: "1",
    sections: output.sections.map(() => ({ title: "1", text: "1" })), advice: ["1"],
    periods: output.periods!.map((item) => ({ ...item, note: "Strong luck ahead" })),
  };
  assert.match(baziLanguageErrors(english).join("；"), /请用中文作答/);
});

test("逐运短评只允许本步大运与原局事实", () => {
  const input = sampleBazi("destiny");
  const facts = selectBaziFacts("shenxiaozhan", input);
  const output = destiny(input);
  assert.equal(auditBaziOutput(output, facts).ok, true);
  const otherLuck = output.periods!.map((item) => item.index === 3
    ? { ...item, note: "乙酉正财得助" } : item);
  assert.match(auditBaziOutput({ ...output, periods: otherLuck }, facts).errors.join("；"),
    /第 3 步大运短评.*乙酉/);
  const yearFact = output.periods!.map((item) => item.index === 3
    ? { ...item, note: "丙午七杀引动" } : item);
  assert.match(auditBaziOutput({ ...output, periods: yearFact }, facts).errors.join("；"),
    /第 3 步大运短评.*丙午/);
});

test("命理大运事实含本运藏干与十神，只放行本步藏干", () => {
  const input = sampleBazi("destiny");
  const facts = selectBaziFacts("shenxiaozhan", input);
  const fortuneFacts = selectBaziFacts("shenxiaozhan", sampleBazi("fortune"));
  assert.doesNotMatch(fortuneFacts.get("luck:4")?.label ?? "", /藏干/);
  assert.ok(facts.get("luck:4")?.tokens.has("辛"));
  assert.ok(facts.get("luck:4")?.tokens.has("劫财"));
  const output = destiny(input);
  const valid = output.periods!.map((item) => item.index === 4
    ? { ...item, note: "酉藏辛劫财" } : item);
  assert.equal(auditBaziOutput({ ...output, periods: valid }, facts).ok, true);
  const wrong = output.periods!.map((item) => item.index === 3
    ? { ...item, note: "酉藏辛劫财" } : item);
  assert.match(auditBaziOutput({ ...output, periods: wrong }, facts).errors.join("；"),
    /第 3 步大运短评.*酉/);
});

test("命理大运事实含本运与原局关系，只放行本步关系", () => {
  const input = sampleBazi("destiny");
  const facts = selectBaziFacts("shenxiaozhan", input);
  assert.match(facts.get("luck:1")?.label ?? "", /午午自刑/);
  assert.ok(facts.get("luck:1")?.tokens.has("午午自刑"));
  const output = destiny(input);
  const valid = output.periods!.map((item) => item.index === 1
    ? { ...item, note: "午午自刑宜守" } : item);
  assert.equal(auditBaziOutput({ ...output, periods: valid }, facts).ok, true);
  const wrong = output.periods!.map((item) => item.index === 2
    ? { ...item, note: "午午自刑宜守" } : item);
  assert.match(auditBaziOutput({ ...output, periods: wrong }, facts).errors.join("；"),
    /第 2 步大运短评.*午午自刑/);
});

test("命理总述核对的事实表含各步大运与原局关系，三家能说的总述可转述", () => {
  const input = sampleBazi("destiny");
  // 「丑未冲」只出现在第 8 步大运与原局之间，原局与流年里都没有。
  const text = "晚年第八步运丑未冲，宜守。";
  assert.ok(auditBaziSummaryProse(text, input.facts).length > 0);
  const facts = baziShared.withDestinyLuckRelations(input.chart, input.facts);
  assert.deepEqual(auditBaziSummaryProse(text, facts), []);
  // 原事实表不被改动。
  assert.ok(!input.facts.get("luck:8")?.tokens.has("丑未冲"));
});

test("调候派不用合冲刑害：余春台的大运事实不含关系", () => {
  const input = sampleBazi("destiny");
  const facts = selectBaziFacts("yuchuntai", input);
  assert.ok(facts.get("luck:1"));
  assert.doesNotMatch(facts.get("luck:1")?.label ?? "", /关系|午午自刑/u);
  assert.ok(!facts.get("luck:1")?.tokens.has("午午自刑"));
  assert.match(selectBaziFacts("rentieqiao", input).get("luck:1")?.label ?? "", /午午自刑/u);
});

test("命理修补按盘面排序去重，删多留缺，清空坏短评并夹回把握", () => {
  const input = sampleBazi("destiny");
  const facts = selectBaziFacts("shenxiaozhan", input);
  const output = destiny(input);
  const byIndex = new Map(output.periods!.map((item) => [item.index, item]));
  const periods = [
    byIndex.get(4)!,
    { ...byIndex.get(3)!, note: "乙酉正财得助" },
    { ...byIndex.get(3)!, verdict: "吉" as const, confidenceTenths: 2 },
    { ...byIndex.get(2)!, verdict: "凶" as const, confidenceTenths: 8 },
    byIndex.get(1)!, byIndex.get(8)!,
    { ...byIndex.get(1)!, index: 12 },
  ];
  const repaired = repairBazi({ ...output, periods }, facts, input.chart, "year");
  assert.ok(!("years" in repaired.output));
  assert.deepEqual(repaired.output.periods?.map((item) => item.index), [1, 2, 3, 4, 8]);
  assert.equal(repaired.output.periods?.find((item) => item.index === 2)?.confidenceTenths, 4);
  assert.equal(repaired.output.periods?.find((item) => item.index === 3)?.note, "");
  assert.equal(repaired.adjusted, 1);
  assert.equal(repaired.removed, 3);
});

test("逐运合议按盘面顺序计算平均、范围与参与家数", () => {
  const input = sampleBazi("destiny");
  const values = [7, 5, 7];
  const outputs = values.map((value) => {
    const output = destiny(input);
    return { ...output, periods: output.periods!.map((item) => ({ ...item, confidenceTenths: value })) };
  });
  const reading = storedDestiny(outputs, input);
  assert.deepEqual(consensus(reading)[0], { index: 1, average: 6.3, min: 5, max: 7, count: 3 });
  reading.schools.yuchuntai.status = "failed";
  reading.schools.rentieqiao.output = {
    ...outputs[2]!, periods: outputs[2]!.periods!.filter((item) => item.index !== 1),
  };
  assert.deepEqual(consensus(reading)[0], { index: 1, average: 7, min: 7, max: 7, count: 1 });
  reading.schools.shenxiaozhan.status = "failed";
  assert.equal(consensus(reading)[0], null);
});

test("命理公开视图包含逐运合议，旧存档没有 periods 仍返回全空合议", () => {
  const input = sampleBazi("destiny");
  const current = publicBaziReading(storedDestiny([destiny(input)], input));
  assert.equal(current.kind, "destiny");
  assert.deepEqual(current.periods[0], { index: 1, average: 7, min: 7, max: 7, count: 1 });
  const { periods: _periods, ...oldOutput } = destiny(input);
  const old = publicBaziReading(storedDestiny([oldOutput], input));
  assert.equal(old.kind, "destiny");
  assert.deepEqual(old.periods, Array(input.chart.luck!.cycles.length).fill(null));
});

test("命理提示词列出每步大运与逐运规则，fortune 系统提示保持原样", async () => {
  const input = sampleBazi("destiny");
  const school = BAZI_SCHOOLS[0]!;
  const prompt = school.buildUserPrompt(input);
  assert.match(prompt, /大运列表：/);
  assert.match(prompt, /第 3 步 luck:3 甲申 28–37 岁 2017–2026/);
  assert.match(school.systemPrompt, /命理不得输出吉凶、把握、逐年列表或 timing/);
  assert.doesNotMatch(school.systemPrompt, /periods/);
  const systemPrompt = (baziShared as Record<string, unknown>).baziSystemPrompt;
  assert.equal(typeof systemPrompt, "function", "应按任务类型生成八字系统提示");
  const resolve = systemPrompt as (value: typeof school, kind: "destiny" | "fortune") => string;
  assert.equal(resolve(school, "fortune"), school.systemPrompt);
  assert.match(resolve(school, "destiny"),
    /命理不得输出总断吉凶、把握、逐年列表或 timing，但须输出 periods/);
  assert.match(resolve(school, "destiny"), /只用该步大运事实（luck:<index>）与原局事实/);
  assert.match(resolve(school, "destiny"), /含藏干/);
  assert.match(resolve(school, "destiny"), /逐运.*六至九成.*四至六成.*一至四成/);
  const noLuck: BaziSchoolInput = {
    ...input, chart: { ...input.chart, luck: null },
    facts: new Map([...input.facts].filter(([id]) => !id.startsWith("luck:"))),
  };
  assert.match(school.buildUserPrompt(noLuck), /盘面无大运，periods 输出空数组/);
  assert.doesNotMatch(school.buildUserPrompt(sampleBazi("fortune")), /大运列表：/);

  let request: StructuredOutputRequest | undefined;
  const mock = new MockSchoolsProvider();
  const provider = { ...mock, generateStructured: async <T>(value: StructuredOutputRequest) => {
    request = value;
    return mock.generateStructured<T>(value);
  } };
  assert.equal((await runBaziSchool({ provider }, { ...sampleBazi("fortune"), school })).status, "done");
  assert.equal(request?.systemPrompt, school.systemPrompt);
});

test("命理逐运三次核对不过后按盘面删错留对", async () => {
  const input = sampleBazi("destiny");
  const school = BAZI_SCHOOLS[0]!;
  const good = mockBaziSchoolOutput(school.key, selectBaziFacts(school.key, input), "destiny");
  const periods = good.periods!.filter((item) => item.index !== 6).map((item) => {
    if (item.index === 2) {
      return { ...item, verdict: "凶" as const, confidenceTenths: 8 };
    }
    if (item.index === 3) {
      return { ...item, note: "乙酉正财得助" };
    }
    return item;
  });
  periods.push({ ...good.periods![0]!, index: 9 });
  const prompts: string[] = [];
  const systemPrompts: string[] = [];
  const provider = new MockSchoolsProvider();
  provider.generateStructured = async <T>(request: StructuredOutputRequest) => {
    prompts.push(request.userPrompt);
    systemPrompts.push(request.systemPrompt);
    return { ...good, periods } as T;
  };
  const result = await runBaziSchool({ provider }, { ...input, school });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 3);
  assert.match(prompts[1] ?? "", /大运编号序列/);
  assert.ok(systemPrompts.every((item) => /但须输出 periods/.test(item)));
  if (result.status === "done" && !("years" in result.output)) {
    assert.deepEqual(result.output.periods?.map((item) => item.index), [1, 2, 3, 4, 5, 7, 8]);
    assert.equal(result.output.periods?.find((item) => item.index === 2)?.confidenceTenths, 4);
    assert.equal(result.output.periods?.find((item) => item.index === 3)?.note, "");
    assert.equal(result.removed, 2);
    assert.equal(result.adjusted, 1);
  }
});

test("三家命理 mock 逐运有起伏且通过 Schema、核对与审计，运势输出保持不变", () => {
  for (const school of BAZI_SCHOOLS) {
    const input = sampleBazi("destiny");
    const facts = selectBaziFacts(school.key, input);
    const output = mockBaziSchoolOutput(school.key, facts, "destiny");
    assert.doesNotThrow(() => validateStructuredOutput(DESTINY_SCHOOL_SCHEMA, output));
    assert.deepEqual(checkBaziConsistency(output, input.chart, input.horizon), []);
    assert.equal(auditBaziOutput(output, facts).ok, true);
    assert.deepEqual(output.periods?.map((item) => item.index),
      input.chart.luck!.cycles.map((item) => item.index));
    assert.ok(output.periods?.some((item) => item.verdict === "吉"));
    assert.ok(output.periods?.some((item) => item.verdict === "凶"));
  }
  const fortuneInput = sampleBazi("fortune");
  const fortune = mockBaziSchoolOutput("shenxiaozhan", fortuneInput.facts, "fortune");
  assert.doesNotThrow(() => validateStructuredOutput<FortuneSchoolOutput>(FORTUNE_SCHOOL_SCHEMA, fortune));
  assert.ok(!("periods" in fortune));
  assert.deepEqual(checkBaziConsistency(fortune, fortuneInput.chart, fortuneInput.horizon), []);
});
