import assert from "node:assert/strict";
import test from "node:test";
import {
  StructuredOutputError,
  type StructuredOutputProvider,
  type StructuredOutputRequest,
} from "../src/agent/provider.js";
import { auditFamily, auditNamingSummary } from "../src/sanyi/naming/audit.js";
import { NAMING_FAMILIES } from "../src/sanyi/naming/families.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import {
  NAMING_SUMMARY_SYSTEM_PROMPT,
  buildNamingSummaryPrompt,
  runNamingFamily,
  runNamingFamilyWithRetry,
  runNamingSummary,
  runNamingSummaryWithRetry,
} from "../src/sanyi/naming/runner.js";
import type {
  NamingContext,
  NamingFamilyKey,
  NamingFamilyOutput,
  NamingName,
  NamingSummaryOutput,
} from "../src/sanyi/naming/schema.js";

class Fake implements StructuredOutputProvider {
  readonly modelId = "fake";
  readonly providerConfig = {};
  readonly providerConfigHash = `0x${"00".repeat(32)}` as const;
  readonly requests: StructuredOutputRequest[] = [];

  constructor(private readonly responses: unknown[]) {}

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    return response as T;
  }
}

const candidates = Array.from({ length: 60 }, (_, index) => ({
  id: `sj-${String(index + 1).padStart(4, "0")}-01`,
  book: "诗经",
  title: `雅篇${index + 1}`,
  text: index === 0 ? "关关雎鸠，在河之洲" : "清和明远，安宁知夏",
}));

const context: NamingContext = {
  target: "person",
  surname: "张",
  gender: "female",
  length: 2,
  question: "温和有书卷气",
  favorable: ["火", "水"],
  favorableSource: "tiaohou",
  favorableNote: "调候取丙、癸",
  candidates,
};

function name(given: string, extra: Partial<NamingName> = {}): NamingName {
  return {
    given,
    meaning: "温润明朗",
    why: "符合本家取名规则",
    chars: [...given].map((char) => ({
      char, gloss: "取其美好含义", sense: "用作名字意指温润明朗",
    })),
    tags: ["温和", "好学", "明朗"],
    ...extra,
  };
}

const valid: NamingFamilyOutput = {
  note: "以喜用为先，兼顾音义。",
  names: [name("明泽"), name("清宁"), name("知涵")],
};

test("单家运行器一次通过，请求参数与 taskId 符合约定", async () => {
  const provider = new Fake([valid]);
  const family = NAMING_FAMILIES[0]!;
  const result = await runNamingFamily({ provider }, { family, ctx: context });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 1);
  if (result.status === "done") assert.equal(result.removed, 0);
  assert.equal(provider.requests[0]?.taskId, "sanyi/naming/wuxing");
  assert.equal(provider.requests[0]?.effort, "medium");
  assert.equal(provider.requests[0]?.cacheSystemPrompt, true);
});

test("单家结果只在商号五行家自选时保留 element", async () => {
  const withElement = { ...valid, element: "木" as const };
  const wuxing = await runNamingFamily(
    { provider: new Fake([withElement]) },
    { family: NAMING_FAMILIES[0]!, ctx: context },
  );
  assert.equal(wuxing.status, "done");
  if (wuxing.status === "done") assert.equal(wuxing.output.element, undefined);

  const shiwenOutput: NamingFamilyOutput = {
    ...withElement,
    names: [
      name("清宁", { sourceId: "S02" }),
      name("知夏", { sourceId: "S02" }),
      name("明远", { sourceId: "S02" }),
    ],
  };
  const shiwen = await runNamingFamily(
    { provider: new Fake([shiwenOutput]) },
    { family: NAMING_FAMILIES[1]!, ctx: context },
  );
  assert.equal(shiwen.status, "done");
  if (shiwen.status === "done") assert.equal(shiwen.output.element, undefined);

  const yinyi = await runNamingFamily(
    { provider: new Fake([withElement]) },
    { family: NAMING_FAMILIES[2]!, ctx: context },
  );
  assert.equal(yinyi.status, "done");
  if (yinyi.status === "done") assert.equal(yinyi.output.element, undefined);

  const { surname: _surname, ...businessBase } = context;
  const business: NamingContext = {
    ...businessBase,
    target: "business",
    gender: "any",
    favorable: null,
    favorableSource: "model",
    favorableNote: "行业未匹配，由五行补益家自选",
  };
  const selected: NamingFamilyOutput = {
    note: "按行业气质自选五行。",
    element: "木",
    names: [name("林森"), name("松柏"), name("荣杰")],
  };
  const model = await runNamingFamily(
    { provider: new Fake([selected]) },
    { family: NAMING_FAMILIES[0]!, ctx: business },
  );
  assert.equal(model.status, "done");
  if (model.status === "done") assert.equal(model.output.element, "木");
});

test("业务核对失败后带中文错误完整重写", async () => {
  const invalid = { ...valid, names: [name("林森"), ...valid.names.slice(1)] };
  const provider = new Fake([invalid, valid]);
  const result = await runNamingFamily({ provider }, { family: NAMING_FAMILIES[0]!, ctx: context });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /无一字属喜用（火、水）/);
});

test("三次都有一个名字不合格时删错留对并返回 done", async () => {
  const invalid = { ...valid, names: [name("林森"), ...valid.names.slice(1)] };
  const result = await runNamingFamily(
    { provider: new Fake([invalid, invalid, invalid]) },
    { family: NAMING_FAMILIES[0]!, ctx: context },
  );
  assert.equal(result.status, "done");
  assert.equal(result.calls, 3);
  if (result.status === "done") {
    assert.equal(result.removed, 1);
    assert.deepEqual(result.output.names.map(({ given }) => given), ["清宁", "知涵"]);
  }
});

test("Schema 错误进入重写并使用中文字段提示", async () => {
  const schemaError = new StructuredOutputError("结构化输出不符合 JSON Schema", [{
    instancePath: "/names/0/chars/0/gloss",
    schemaPath: "#/properties/names/items/properties/chars/items/properties/gloss/maxLength",
    keyword: "maxLength",
    params: { limit: 12 },
    message: "too long",
  }]);
  const provider = new Fake([schemaError, valid]);
  const result = await runNamingFamily({ provider }, { family: NAMING_FAMILIES[0]!, ctx: context });
  assert.equal(result.status, "done");
  assert.equal(result.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /chars\/0\/gloss 不超过 12 字/);
});

test("调用错误直接失败，WithRetry 会把整个运行再试一次", async () => {
  const failed = await runNamingFamily(
    { provider: new Fake([new Error("网络超时")]) },
    { family: NAMING_FAMILIES[0]!, ctx: context },
  );
  assert.deepEqual(failed, { status: "failed", error: "起名本家暂未落笔，请稍后重试", calls: 1 });

  const provider = new Fake([new Error("网络超时"), valid]);
  const retried = await runNamingFamilyWithRetry(
    { provider }, { family: NAMING_FAMILIES[0]!, ctx: context },
  );
  assert.equal(retried.status, "done");
  assert.equal(retried.calls, 2);
});

const summary: NamingSummaryOutput = {
  picks: [{ given: "明泽", reason: "五行与字义兼顾" }, { given: "河洲", reason: "出处清楚" }],
  overview: "三家都重视正面寓意，各自侧重五行、出处与音义。",
  tips: ["念出全名听听是否顺口", "问问家人方言里有无不雅谐音"],
};

const summaryFamilies: Partial<Record<NamingFamilyKey, NamingFamilyOutput>> = {
  wuxing: valid,
  shiwen: { note: "取自诗经。", names: [name("河洲", { sourceId: "S01" })] },
  yinyi: { note: "读音舒展。", names: [name("思远")] },
};

const warningSummaryFamilies: Partial<Record<NamingFamilyKey, NamingFamilyOutput>> = {
  wuxing: { ...valid, names: [name("清淑"), name("明泽"), name("知涵")] },
  shiwen: { note: "取自诗文。", names: [name("河洲"), name("云舒"), name("景行")] },
  yinyi: { note: "兼顾音义。", names: [name("思远"), name("知夏"), name("言蹊")] },
};

test("合参提示词逐名附音律提示，并按对象约束推荐与挑选建议", () => {
  const prompt = buildNamingSummaryPrompt({
    target: "person", surname: "张", families: warningSummaryFamilies,
    favorable: ["火", "水"], missing: [],
  });
  assert.match(prompt, /- 清淑｜综合 \d+ 分.*音律提示：姓名声调全同，连读时可再听听是否顺口/u);
  assert.match(prompt, /- 明泽｜综合 \d+ 分/u);
  assert.match(prompt, /明泽.*综合 \d+ 分.*补火.*补水/u);
  assert.match(NAMING_SUMMARY_SYSTEM_PROMPT, /优先推荐没有音律提示的名字/u);
  assert.match(NAMING_SUMMARY_SYSTEM_PROMPT, /推荐带音律提示的名字时.*理由.*如实说明/u);
  assert.match(NAMING_SUMMARY_SYSTEM_PROMPT, /人名.*不得提商标、工商/u);
  assert.match(NAMING_SUMMARY_SYSTEM_PROMPT, /商号.*不得提重名、户口/u);
  assert.match(NAMING_SUMMARY_SYSTEM_PROMPT, /优先推荐综合分高.*补上所缺五行/u);
  assert.match(NAMING_SUMMARY_SYSTEM_PROMPT, /理由写明补了什么/u);
});

test("合参推荐全同声调名字时重写，三次不改则修补为各家首个无提示名字", async () => {
  const invalid: NamingSummaryOutput = {
    ...summary,
    picks: [
      { given: "清淑", reason: "合张姓音调" },
      { given: "明泽", reason: "五行与字义兼顾" },
    ],
  };
  const validSummary: NamingSummaryOutput = {
    ...summary,
    picks: [
      { given: "明泽", reason: "五行与字义兼顾" },
      { given: "河洲", reason: "出处清楚" },
    ],
  };
  const provider = new Fake([invalid, validSummary]);
  const rewritten = await runNamingSummary(
    { provider },
    { target: "person", surname: "张", families: warningSummaryFamilies },
  );
  assert.equal(rewritten.status, "done");
  assert.equal(rewritten.calls, 2);
  assert.match(provider.requests[1]?.userPrompt ?? "", /清淑.*姓名声调全同.*不应优先推荐/u);

  const repaired = await runNamingSummary(
    { provider: new Fake([invalid, invalid, invalid]) },
    { target: "person", surname: "张", families: warningSummaryFamilies },
  );
  assert.equal(repaired.status, "done");
  if (repaired.status === "done") {
    assert.deepEqual(repaired.output.picks.map(({ given }) => given), ["明泽", "河洲", "思远"]);
  }
});

test("合参运行器使用独立 taskId，失败时外层自动再试", async () => {
  const provider = new Fake([summary]);
  const result = await runNamingSummary(
    { provider }, { target: "person", surname: "张", families: summaryFamilies },
  );
  assert.equal(result.status, "done");
  assert.equal(provider.requests[0]?.taskId, "sanyi/naming/summary");
  assert.equal(provider.requests[0]?.effort, "medium");
  assert.equal(provider.requests[0]?.cacheSystemPrompt, true);

  const retryProvider = new Fake([new Error("超时"), summary]);
  const retried = await runNamingSummaryWithRetry(
    { provider: retryProvider }, { target: "person", surname: "张", families: summaryFamilies },
  );
  assert.equal(retried.status, "done");
  assert.equal(retried.calls, 2);
});

test("缺一家时合参提示与 mock 只概括已落笔的两家", async () => {
  const twoFamilies: Partial<Record<NamingFamilyKey, NamingFamilyOutput>> = {
    wuxing: valid,
    yinyi: { note: "读音舒展。", names: [name("思远"), name("安和"), name("景明")] },
  };
  const prompt = buildNamingSummaryPrompt({ target: "person", surname: "张", families: twoFamilies });
  assert.match(prompt, /依据 2 家/);
  assert.match(NAMING_SUMMARY_SYSTEM_PROMPT, /已落笔各家/);
  assert.doesNotMatch(NAMING_SUMMARY_SYSTEM_PROMPT, /五行、诗文、音形字义三种思路/);
  const result = await runNamingSummary(
    { provider: new MockSchoolsProvider() },
    { target: "person", surname: "张", families: twoFamilies },
  );
  assert.equal(result.status, "done");
  if (result.status === "done") {
    assert.match(result.output.overview, /两家/);
    assert.doesNotMatch(result.output.overview, /三家/);
  }
});

test("合参三次不合规且修补后不足两个推荐时返回 failed", async () => {
  const onlyOne: Partial<Record<NamingFamilyKey, NamingFamilyOutput>> = {
    wuxing: { note: "五行家。", names: [name("明泽")] },
    shiwen: { note: "诗文家。", names: [name("明泽", { sourceId: "S01" })] },
    yinyi: { note: "音义家。", names: [name("明泽")] },
  };
  const invalid: NamingSummaryOutput = {
    ...summary,
    picks: [{ given: "云舒", reason: "不在清单" }, { given: "山高", reason: "不在清单" }],
  };
  const result = await runNamingSummary(
    { provider: new Fake([invalid, invalid, invalid]) },
    { target: "person", surname: "张", families: onlyOne },
  );
  assert.equal(result.status, "failed");
  assert.equal(result.calls, 3);
});

test("MockSchoolsProvider 覆盖三家与合参的六种上下文，均一次通过", async () => {
  const { surname: _surname, ...businessBase } = context;
  const contexts: NamingContext[] = [
    context,
    { ...context, length: 1 },
    { ...context, gender: "any" },
    { ...context, surname: "王" },
    {
      ...businessBase, target: "business", gender: "any", length: 2,
      question: "社区咖啡馆，温暖安静", favorable: ["火"], favorableSource: "industry",
      favorableNote: "按行业：咖啡 → 火",
    },
    {
      ...businessBase, target: "business", gender: "any", length: 2,
      question: "卖手工皂，朴素自然", favorable: null, favorableSource: "model",
      favorableNote: "行业未匹配，由五行补益家自选",
    },
  ];
  for (const ctx of contexts) {
    const provider = new MockSchoolsProvider();
    const outputs: Partial<Record<NamingFamilyKey, NamingFamilyOutput>> = {};
    for (const family of NAMING_FAMILIES) {
      const result = await runNamingFamily({ provider }, { family, ctx });
      assert.equal(result.status, "done", `${ctx.target}/${ctx.length}/${family.key}`);
      if (result.status === "done") {
        assert.equal(result.calls, 1);
        assert.deepEqual(auditFamily(family.key, result.output, ctx), []);
        outputs[family.key] = result.output;
      }
    }
    const summaryInput = ctx.target === "person"
      ? { target: "person" as const, surname: ctx.surname ?? "张", families: outputs }
      : { target: "business" as const, families: outputs };
    const result = await runNamingSummary({ provider }, summaryInput);
    assert.equal(result.status, "done", `${ctx.target}/${ctx.length}/summary`);
    if (result.status === "done") {
      const names = Object.values(outputs).flatMap((item) => item?.names.map(({ given }) => given) ?? []);
      assert.deepEqual(auditNamingSummary(result.output, names), []);
    }
  }
});

test("诗文 mock 不把字典释义中的禁用词带进名字文案", async () => {
  const ctx: NamingContext = {
    ...context,
    candidates: [
      { id: "ts-0253-01", book: "唐诗三百首", title: "杜甫《古柏行》",
        text: "孔明庙前有老柏，柯如青铜根如石" },
      ...candidates.slice(1),
    ],
  };
  const result = await runNamingFamily(
    { provider: new MockSchoolsProvider() },
    { family: NAMING_FAMILIES[1]!, ctx },
  );
  assert.equal(result.status, "done");
  if (result.status === "done") {
    assert.equal(result.calls, 1);
    assert.equal(result.output.names.length, 3);
    assert.deepEqual(auditFamily("shiwen", result.output, ctx), []);
  }
});
