// tests/sanyi-bazi-school-runner.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicMockProvider, type StructuredOutputRequest } from "../src/agent/provider.js";
import { runBaziSchool } from "../src/sanyi/bazi-school-runner.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import { baziSystemPrompt, selectBaziFacts } from "../src/sanyi/schools/bazi-shared.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA,
  checkBaziConsistency } from "../src/sanyi/bazi-schema.js";
import { validateStructuredOutput } from "../src/agent/provider.js";
import { auditBaziOutput, baziProse } from "../src/sanyi/bazi-audit.js";
import { BRANCHES_EN, STEMS_EN } from "../src/sanyi/i18n/glossary.js";

function ganzhiEn(value: string): string {
  return `${STEMS_EN[value[0] as keyof typeof STEMS_EN]} ${
    BRANCHES_EN[value[1] as keyof typeof BRANCHES_EN].pinyin}`;
}

function englishOutput(kind: "destiny" | "fortune", timeKnown = true) {
  const input = sampleBazi(kind, timeKnown);
  const school = BAZI_SCHOOLS[0]!;
  const facts = selectBaziFacts(school.key, input);
  const chinese = mockBaziSchoolOutput(school.key, facts, kind);
  const base = {
    ...chinese,
    useGod: "Fire (Yong Shen)",
    headline: "Build steadily around the chart's strongest support",
    reason: timeKnown
      ? "The available chart facts favor patience and practical preparation."
      : "The birth hour is unknown, so the reading has clear limits.",
    sections: (kind === "destiny"
      ? ["Character", "Career", "Wealth", "Relationships", "Health"]
      : ["Key Influence", "Chart Dynamics", "Timing"])
      .map((title) => ({ title, text: "The supported pattern favors measured action." })),
    advice: ["Keep practical options open while conditions develop."],
  };
  if ("years" in chinese) {
    return { input, school, facts, output: {
      ...base,
      years: chinese.years.map((item) => ({
        ...item,
        note: "This year interacts with the natal chart and favors a measured response.",
      })),
    } };
  }
  return { input, school, facts, output: {
    ...base,
    periods: chinese.periods?.map((item) => ({
      ...item,
      note: "This period interacts with the natal chart and explains the stated outlook.",
    })),
  } };
}
test("首次核对失败，带中文错误完整重写一次后成功", async () => {
  const input = sampleBazi();
  const school = BAZI_SCHOOLS[0];
  const valid = mockBaziSchoolOutput(school.key, selectBaziFacts(school.key, input), "fortune");
  const provider = new DeterministicMockProvider("rewrite", {
    "sanyi/fortune/shenxiaozhan": (request: StructuredOutputRequest, index: number) => {
      if (index === 0) {
        return { ...valid, reason: "子午冲" };
      }
      assert.match(request.userPrompt, /不支持关键词.*子午冲/);
      return valid;
    },
  });
  const result = await runBaziSchool({ provider }, { ...input, school });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
});
test("三次都不过时删错留对照常展示，另两家独立成功", async () => {
  const input = sampleBazi();
  const provider = new DeterministicMockProvider("bad", {
    "sanyi/fortune/shenxiaozhan": { ...mockBaziSchoolOutput("shenxiaozhan", input.facts, "fortune"),
      reason: "私人原文子午冲" },
  });
  const result = await runBaziSchool({ provider }, { ...input, school: BAZI_SCHOOLS[0] });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 3);
  if (result.status === "done") {
    assert.doesNotMatch(result.output.reason, /子午冲/);
    assert.ok(result.removed >= 1);
  }
  for (const school of BAZI_SCHOOLS.slice(1)) {
    assert.equal((await runBaziSchool({ provider: new MockSchoolsProvider() }, { ...input,
      school })).status, "done");
  }
});
test("provider 抛错返回 failed，错误消息不回显", async () => {
  const provider = new DeterministicMockProvider("transport", {
    "sanyi/fortune/shenxiaozhan": () => {
      throw new Error("私人输入回显");
    },
  });
  const result = await runBaziSchool({ provider }, { ...sampleBazi(), school: BAZI_SCHOOLS[0] });
  assert.deepEqual(result, { status: "failed", calls: 1, error: "模型调用失败，请稍后重试" });
});
test("运行器自行校验 Schema，结构三次都不合格才判失败", async () => {
  const provider = new MockSchoolsProvider();
  let calls = 0;
  provider.generateStructured = async <T>(): Promise<T> => {
    calls += 1;
    return {} as T;
  };
  const result = await runBaziSchool({ provider }, { ...sampleBazi(), school: BAZI_SCHOOLS[0] });
  assert.equal(result.status, "failed");
  assert.equal(calls, 3);
});
test("结构失败时重写提示写明具体字段与限制", async () => {
  const input = sampleBazi("fortune");
  const school = BAZI_SCHOOLS[0];
  assert.ok(school);
  const good = mockBaziSchoolOutput(school.key, selectBaziFacts(school.key, input), "fortune");
  const tooLong = {
    ...good,
    years: good.years.map((year, index) => {
      return index === 3 ? { ...year, note: "丙午七杀攻身，午午自刑，火炎土燥，宜守成而不宜进取冒进" } : year;
    }),
  };
  const prompts: string[] = [];
  const provider = new MockSchoolsProvider();
  provider.generateStructured = async <T>(request: StructuredOutputRequest): Promise<T> => {
    prompts.push(request.userPrompt);
    return (prompts.length === 1 ? tooLong : good) as T;
  };
  const result = await runBaziSchool({ provider }, { ...input, school });
  assert.equal(result.status, "done");
  assert.equal(prompts.length, 2);
  assert.match(prompts[1] ?? "", /years\/3\/note/);
  assert.match(prompts[1] ?? "", /不超过 24 字/);
});
test("三家命理运势 mock 全通过，窗口年份与锚项吻合", async () => {
  for (const kind of ["destiny", "fortune"] as const) {
    for (const timeKnown of [true, false]) {
      const input = sampleBazi(kind, timeKnown);
      for (const school of BAZI_SCHOOLS) {
        const facts = selectBaziFacts(school.key, input);
        const output = mockBaziSchoolOutput(school.key, facts, kind);
        const schema = kind === "destiny" ? DESTINY_SCHOOL_SCHEMA : FORTUNE_SCHOOL_SCHEMA;
        assert.doesNotThrow(() => validateStructuredOutput(schema, output));
        assert.deepEqual(checkBaziConsistency(output, input.chart, input.horizon), []);
        assert.equal(auditBaziOutput(output, facts).ok, true);
        if ("years" in output) {
          assert.equal(output.years.length, 10);
          assert.deepEqual(output.years.map((year) => year.year),
            input.chart.liunian.years.map((year) => year.year));
        }
        const result = await runBaziSchool({ provider: new MockSchoolsProvider() }, { ...input, school });
        assert.equal(result.status, "done");
        assert.equal(result.calls, 1);
      }
    }
  }
  const facts = sampleBazi("destiny").facts;
  assert.match(mockBaziSchoolOutput("shenxiaozhan", facts, "destiny").useGod, /正印/);
  assert.equal(mockBaziSchoolOutput("yuchuntai", facts, "destiny").useGod, "壬");
  assert.match(mockBaziSchoolOutput("rentieqiao", facts, "destiny").useGod, /比肩/);
});

test("英文八字 runner 选择英文提示、Schema 与核对，evidence 仍保留中文", async () => {
  for (const kind of ["destiny", "fortune"] as const) {
    const { input, school, output } = englishOutput(kind);
    const provider = new DeterministicMockProvider("english", {
      [`sanyi/${kind}/shenxiaozhan`]: output,
    });
    const result = await runBaziSchool({ provider }, { ...input, school, language: "en" });
    assert.equal(result.status, "done", kind);
    assert.equal(result.calls, 1, kind);
    if (result.status === "done") {
      const notes = "years" in result.output
        ? result.output.years.map((item) => item.note)
        : result.output.periods?.map((item) => item.note) ?? [];
      assert.doesNotMatch([...baziProse(result.output), ...notes].join("\n"), /\p{Script=Han}/u);
      assert.match(result.output.evidence[0]?.claim ?? "", /\p{Script=Han}/u);
    }
  }
});

test("八字三家英文提示保留各自人设、取用路径与逐运逐年结构", () => {
  const expected = [
    ["Shen Xiaozhan", [/month command/iu, /structure/iu, /supporting god/iu]],
    ["Yu Chuntai", [/cold, heat, dryness, and dampness.*climate-balancing/isu]],
    ["Ren Tieqiao", [/Day Master's strength.*support or restraint.*flow of qi/isu]],
  ] as const;
  BAZI_SCHOOLS.forEach((school, index) => {
    const [name, path] = expected[index]!;
    assert.match(school.systemPromptEn, new RegExp(`only as ${name}`, "u"));
    path.forEach((pattern) => assert.match(school.systemPromptEn, pattern));
    assert.match(school.systemPromptEn, /years\[\]|annual note|years item/iu);
    const destiny = baziSystemPrompt(school, "destiny", "en");
    assert.match(destiny, /periods\[\]\.note|periods item/iu);
    assert.match(destiny, /natal chart.*favorable or unfavorable/isu);
  });
});

test("英文逐运断语引用其它大运干支时触发三次核对并由英文兜底替换", async () => {
  const { input, school, facts, output } = englishOutput("destiny");
  if (!("periods" in output) || !output.periods?.[0]) throw new Error("缺逐运输出");
  const allowed = new Set([...facts].filter(([id, fact]) => id === "luck:1"
    || id.startsWith("pillar:") || id.startsWith("hidden:") || id === "tiaohou"
    || (id.startsWith("relation:") && fact.label.startsWith("natal ")))
    .flatMap(([, fact]) => [...fact.tokens]));
  const pair = [...facts].filter(([id]) => /^luck:\d+$/u.test(id) && id !== "luck:1")
    .flatMap(([, fact]) => [...fact.tokens])
    .find((token) => /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(token)
      && !allowed.has(token));
  assert.ok(pair);
  const badPair = ganzhiEn(pair);
  const bad = { ...output, periods: output.periods.map((item, index) => index === 0
    ? { ...item, note: `${badPair} governs this period and makes it favorable.` } : item) };
  const provider = new DeterministicMockProvider("english-period-scope", {
    "sanyi/destiny/shenxiaozhan": bad,
  });
  const result = await runBaziSchool({ provider }, { ...input, school, language: "en" });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 3);
  if (result.status === "done" && "periods" in result.output) {
    assert.doesNotMatch(result.output.periods?.[0]?.note ?? "", new RegExp(badPair, "u"));
    assert.match(result.output.periods?.[0]?.note ?? "", /removed|chart/iu);
  }
});

test("英文缺时柱未说明限制时触发核对并补英文限制说明", async () => {
  const { input, school, output } = englishOutput("fortune", false);
  const bad = { ...output, reason: "The birth hour determines important details in this chart." };
  const provider = new DeterministicMockProvider("english-hour-limit", {
    "sanyi/fortune/shenxiaozhan": bad,
  });
  const result = await runBaziSchool({ provider }, { ...input, school, language: "en" });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 3);
  if (result.status === "done") {
    assert.match(result.output.reason, /birth hour|hour pillar|time of birth/iu);
    assert.match(result.output.reason, /unknown|missing|unavailable|not known/iu);
    assert.match(result.output.reason, /limit|uncertain|cannot|can't/iu);
  }
});

test("英文缺时柱时逐年断语也不得把合法干支归给 hour pillar", async () => {
  const { input, school, facts, output } = englishOutput("fortune", false);
  if (!("years" in output) || !output.years[0]) throw new Error("缺逐年输出");
  const yearFact = facts.get(`year:${output.years[0].year}`);
  const pair = [...(yearFact?.tokens ?? [])].find((token) => (
    /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(token)
  ));
  assert.ok(pair);
  const bad = { ...output, years: output.years.map((item, index) => index === 0
    ? { ...item, note: `${ganzhiEn(pair)} is assigned to the hour pillar and favors this year.` }
    : item) };
  const provider = new DeterministicMockProvider("english-hour-note", {
    "sanyi/fortune/shenxiaozhan": bad,
  });
  const result = await runBaziSchool({ provider }, { ...input, school, language: "en" });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 3);
  if (result.status === "done" && "years" in result.output) {
    assert.doesNotMatch(result.output.years[0]?.note ?? "", /hour pillar/iu);
  }
});

test("英文八字 evidence.claim 仍按中文事实核对", async () => {
  const { input, school, output } = englishOutput("fortune");
  const bad = { ...output, evidence: [{ ...output.evidence[0]!, claim: "Direct Resource supports the chart" }] };
  const provider = new DeterministicMockProvider("english-evidence", {
    "sanyi/fortune/shenxiaozhan": bad,
  });
  const result = await runBaziSchool({ provider }, { ...input, school, language: "en" });
  assert.equal(result.status, "failed");
  assert.equal(result.calls, 3);
});
