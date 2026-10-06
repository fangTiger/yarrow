// tests/sanyi-bazi-school-runner.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicMockProvider, type StructuredOutputRequest } from "../src/agent/provider.js";
import { runBaziSchool } from "../src/sanyi/bazi-school-runner.js";
import { mockBaziSchoolOutput } from "../src/sanyi/mock-bazi-schools.js";
import { BAZI_SCHOOLS } from "../src/sanyi/schools/bazi-index.js";
import { selectBaziFacts } from "../src/sanyi/schools/bazi-shared.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { DESTINY_SCHOOL_SCHEMA, FORTUNE_SCHOOL_SCHEMA,
  checkBaziConsistency } from "../src/sanyi/bazi-schema.js";
import { validateStructuredOutput } from "../src/agent/provider.js";
import { auditBaziOutput } from "../src/sanyi/bazi-audit.js";
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
