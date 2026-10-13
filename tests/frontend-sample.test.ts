import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { AnyPublicReading } from "../web/lib/api.js";
import { createElement } from "react";
import { renderIn } from "./helpers/render-in.js";
import { chart, LINES } from "./helpers/sample-question.js";

Object.assign(globalThis, {
  __ARC_CHAIN_ID__: "5042002", __ARC_RPC_URL__: "https://rpc.testnet.arc.io",
  __ARC_EXPLORER__: "https://testnet.arcscan.app", __WALLETCONNECT_PROJECT_ID__: "0".repeat(32),
});
const { route } = await import("../web/app.js");
const { resolveBaziBirth } = await import("../web/pages/BaziReading.js");
const { loadSampleReading, localizedSampleReading, sampleResult, SampleContent, SampleReading } =
  await import("../web/pages/SampleReading.js");

test("示例路由接受命理、问事、运势、起名", () => {
  assert.deepEqual(route("#/sample/destiny"), { page: "sample", kind: "destiny" });
  assert.deepEqual(route("#/sample/question"), { page: "sample", kind: "question" });
  assert.deepEqual(route("#/sample/fortune"), { page: "sample", kind: "fortune" });
  assert.deepEqual(route("#/sample/naming"), { page: "sample", kind: "naming" });
});

test("示例文件缺失时返回空值，由页面显示示例准备中", async () => {
  const missing = await loadSampleReading("question", async () => ({
    ok: false, json: async () => ({}),
  } as Response));
  assert.equal(missing, null);
  const pending = renderIn("zh", createElement(SampleContent, { reading: null, lang: "zh" }));
  assert.match(pending, /示例准备中/u);
  const loading = renderIn("en", createElement(SampleReading, { kind: "question" }));
  assert.match(loading, /示例 · Sample reading/u);
});

test("英文示例叠加 JSON 自带译文", () => {
  const reading = {
    id: "abcdefghijklmnopqrstuvwxyz", kind: "question", createdAt: "2026-01-01T00:00:00Z",
    question: "问题", status: "done", payment: { firstHash: "0x1" }, throws: [],
    schools: {
      chengyi: { status: "failed", retries: 2 }, jingfang: { status: "failed", retries: 2 },
      shaoyong: { status: "failed", retries: 2 },
    },
    summary: { status: "done", basis: 0, retries: 0, output: {
      conclusion: "中文结论", agreement: "", difference: "", explanation: [],
      remedy: { principle: "", plan: [], avoid: [] },
    } },
    subject: { suggestedKey: "career", finalKey: "career", overridden: false, changes: 0 },
    translation: { lang: "en", units: { summary: {
      status: "done", sourceHash: "hash", attempts: 1, failures: 0,
      texts: ["English conclusion"],
    } } },
  } as unknown as AnyPublicReading;
  const english = localizedSampleReading(reading, "en");
  const chinese = localizedSampleReading(reading, "zh");
  assert.equal(english.kind === "question" ? english.summary?.output?.conclusion : "", "English conclusion");
  assert.equal(chinese.kind === "question" ? chinese.summary?.output?.conclusion : "", "中文结论");
});

test("示例结果统一只读，八字明确传 birth=null，不读取本机生辰", () => {
  const question = sampleResult({ kind: "question" } as never);
  assert.equal(question.props.readonly, true);
  const fortune = sampleResult({ kind: "fortune" } as never);
  assert.equal(fortune.props.readonly, true);
  assert.equal(fortune.props.birth, null);
  let profileReads = 0;
  assert.equal(resolveBaziBirth(null, () => {
    profileReads += 1;
    throw new Error("示例不得读取本机生辰");
  }), null);
  assert.equal(profileReads, 0);
  const naming = sampleResult({ kind: "naming" } as never);
  assert.equal(naming.props.readonly, true);
});

test("只读问事示例不渲染重试或改事项操作", () => {
  const reading = {
    id: "abcdefghijklmnopqrstuvwxyz", kind: "question", createdAt: "2026-01-01T00:00:00Z",
    question: "这次面试能过吗？", status: "done", payment: { firstHash: `0x${"1".repeat(64)}` },
    throws: [], lines: LINES, chart,
    subject: { suggestedKey: "career", finalKey: "career", overridden: false, changes: 0 },
    schools: {
      chengyi: { status: "failed", retries: 0 }, jingfang: { status: "failed", retries: 0 },
      shaoyong: { status: "failed", retries: 0 },
    },
    summary: { status: "failed", basis: 1, retries: 0, error: "暂未生成" },
  } as unknown as AnyPublicReading;
  const html = renderIn("zh", createElement(() => sampleResult(reading)));
  assert.doesNotMatch(html, /<button|subject-change|免费重试|改事项/u);
});

test("示例按语言优先加载 <kind>.<lang>.json，缺失时退回 <kind>.json", async () => {
  const requested: string[] = [];
  const fetcher = async (url: string) => {
    requested.push(url);
    return url.endsWith("question.en.json")
      ? { ok: true, json: async () => ({ kind: "question", id: "en" }) }
      : { ok: false, json: async () => ({}) };
  };
  const en = await loadSampleReading("question", fetcher as never, "en");
  assert.equal((en as { id: string } | null)?.id, "en");
  assert.deepEqual(requested, ["/samples/question.en.json"]);
  requested.length = 0;
  const zh = await loadSampleReading("question", fetcher as never, "zh");
  assert.equal(zh, null);
  assert.deepEqual(requested, ["/samples/question.zh.json", "/samples/question.json"]);
});

test("随附的八份示例都能按各自语言完整渲染，盘面字段齐全", () => {
  for (const kind of ["destiny", "question", "fortune", "naming"] as const) {
    for (const lang of ["zh", "en"] as const) {
      const file = `${kind}.${lang}.json`;
      const reading = JSON.parse(readFileSync(new URL(`../web/samples/${file}`, import.meta.url), "utf8")) as
        AnyPublicReading;
      assert.equal(reading.kind, kind, file);
      if (reading.kind === "fortune") assert.ok(Array.isArray(reading.chart.warnings), `${file} 缺 chart.warnings`);
      if (reading.kind === "destiny") {
        assert.ok(Array.isArray(reading.chart.warnings), `${file} 缺 chart.warnings`);
        assert.equal(reading.periods.length, reading.chart.luck?.cycles.length, `${file} 逐运合议不全`);
        assert.ok(reading.summary?.output?.portrait, `${file} 缺性格画像`);
      }
      const html = renderIn(lang, createElement(SampleContent, { reading, lang }));
      assert.ok(html.length > 1_000, file);
      assert.doesNotMatch(html, /示例准备中/u, file);
      if (kind === "destiny") assert.match(html, /life-luck-panel/u, `${file} 缺一生运势`);
    }
  }
});
