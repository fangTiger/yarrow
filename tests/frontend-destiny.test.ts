import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { publicBaziReading } from "../src/sanyi/bazi-public.js";
import type { StoredReading } from "../src/sanyi/store.js";
import { sourceHash } from "../src/sanyi/translation/service.js";
import type { StoredTranslation } from "../src/sanyi/translation/store.js";
import { extractUnits } from "../src/sanyi/translation/units.js";
import { createT } from "../web/lib/i18n.js";
import { en } from "../web/i18n/en.js";
import { applyReadingTranslation } from "../web/lib/reading-translation.js";
import { baziFixture, birth, proof } from "./helpers/bazi-service.js";
import { renderIn } from "./helpers/render-in.js";
import { sampleBazi } from "./helpers/sample-bazi.js";

Object.assign(globalThis, {
  __ARC_CHAIN_ID__: "5042002", __ARC_RPC_URL__: "https://rpc.testnet.arc.io",
  __ARC_EXPLORER__: "https://testnet.arcscan.app", __WALLETCONNECT_PROJECT_ID__: "0".repeat(32),
});
const { BaziReading } = await import("../web/pages/BaziReading.js");
const { route } = await import("../web/app.js");

const noop = () => {};

function completedTranslation(reading: StoredReading): StoredTranslation {
  return {
    lang: "en",
    units: Object.fromEntries(extractUnits(reading).map((unit) => [unit.key, {
      status: "done",
      sourceHash: sourceHash(unit),
      texts: unit.entries.map(({ path }, index) => `English ${path} ${index + 1}`),
      attempts: unit.entries.length > 0 ? 1 : 0,
      failures: 0,
    }])),
  };
}

test("一生运势纯函数判断当前大运、分组、直标与三家逐运", async () => {
  const helpers = await import("../web/lib/life-luck.js").catch(() => null);
  assert.ok(helpers, "应提供一生运势纯函数模块");
  const chart = sampleBazi("destiny").chart;
  const current = helpers.currentCycleIndex(chart, "2026-10-06");
  assert.equal(current, chart.luck?.cycles.find((cycle) => (
    cycle.startYear <= 2026 && cycle.endYear >= 2026
  ))?.index ?? null);
  assert.equal(helpers.currentCycleIndex(chart, "1900-01-01"), null);
  const groups = helpers.cycleGroups(chart.luck?.cycles ?? [], current);
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), chart.luck?.cycles.length);
  assert.deepEqual(groups.map((group) => group.label), ["回看", "当前", "往后"]);
  assert.deepEqual(helpers.periodLabels([
    { index: 1, average: 4, min: 3, max: 5, count: 3 },
    { index: 2, average: 2, min: 1, max: 3, count: 3 },
    { index: 3, average: 8, min: 7, max: 9, count: 3 },
  ], 2), [
    ["回看中最低"], ["当前"], ["一生最顺"],
  ]);
  const reading = {
    schools: {
      shenxiaozhan: { status: "done", output: { periods: [{ index: 2, note: "稳步向前" }] } },
    },
  } as never;
  assert.equal(helpers.schoolPeriod(reading, "shenxiaozhan", 2)?.note, "稳步向前");
  assert.equal(helpers.schoolPeriod(reading, "shenxiaozhan", 3), undefined);
});

test("命理页按画像、一生运势、总述、解法、三家依据、盘面排列", async () => {
  const fixture = await baziFixture();
  try {
    const created = await fixture.bazi.create({
      kind: "destiny", question: "我这一生的运势走向与性格如何？", birth,
      sect: 1, horizon: "year", feeProof: proof(31),
    });
    await fixture.bazi.whenSettled(created.id);
    const reading = publicBaziReading(await fixture.bazi.getReading(created.id));
    const html = renderIn("zh", createElement(BaziReading, { reading, birth: null, onReading: noop }));
    const labels = ["性格画像", "一生运势", "白话总述", "解法", "看三家依据",
      "所问之事 · 命理", "合冲刑害", "五行分布"];
    labels.forEach((label) => assert.match(html, new RegExp(label, "u"), label));
    const markers = ["性格画像", "一生运势", "<h2>白话总述", "<h2>解法",
      "<summary>看三家依据", '<span class="label">所问之事 · 命理', "<h2>合冲刑害",
      "<h2>五行分布"];
    for (let index = 1; index < markers.length; index += 1) {
      assert.ok(html.indexOf(markers[index - 1]!) < html.indexOf(markers[index]!), labels[index]);
    }
    assert.match(html, /class="[^"]*life-luck-panel/u);
    assert.match(html, /顺行 · 7年/u);
    assert.match(html, /class="ln-plot"/u);
    assert.match(html, /class="ln-table"/u);
    assert.match(html, /回看 · 对照你的经历/u);
    assert.match(html, /class="[^"]*luck-current/u);
    assert.match(html, /一生走势/u);
    assert.doesNotMatch(html, /class="luck"/u, "一生运势出现时不重复旧大运时间轴");
  } finally {
    await fixture.close();
  }
});

test("一生运势英文图表只显示拼音、英译吉凶与 n/10", async () => {
  const fixture = await baziFixture();
  try {
    const created = await fixture.bazi.create({
      kind: "destiny", question: "How will my life unfold?", birth,
      sect: 1, horizon: "year", feeProof: proof(32),
    });
    await fixture.bazi.whenSettled(created.id);
    const reading = publicBaziReading(await fixture.bazi.getReading(created.id));
    for (const state of Object.values(reading.schools)) {
      if (state.status === "done" && state.output && "periods" in state.output) {
        state.output.periods?.forEach((period, index) => {
          period.note = period.index === 3 ? "" : `Cycle note ${index + 1}`;
        });
      }
    }
    const module = await import("../web/components/LifeLuckPanel.js").catch(() => null);
    assert.ok(module, "应提供中英共用的一生运势组件");
    assert.equal(reading.kind, "destiny");
    const html = renderIn("en", createElement(module.LifeLuckPanel, {
      reading: reading as Extract<typeof reading, { kind: "destiny" }>, currentDate: "2026-10-06",
    }));
    assert.match(html, /Life luck cycles/u);
    assert.match(html, /Forward · Starts after/u);
    assert.match(html, /Looking back · compare with your experience/u);
    assert.match(html, /Favorable|Mixed|Unfavorable/u);
    assert.match(html, /\d(?:\.\d)?\/10/u);
    assert.match(html, /Short note removed/u);
    assert.doesNotMatch(html, /[\p{Script=Han}]/u);
  } finally {
    await fixture.close();
  }
});

test("英文命理页共用画像与一生运势组件，顺序正确且可见区域无汉字", async () => {
  const fixture = await baziFixture();
  try {
    const created = await fixture.bazi.create({
      kind: "destiny", question: "How will my life unfold?", birth,
      sect: 1, horizon: "year", feeProof: proof(34),
    });
    await fixture.bazi.whenSettled(created.id);
    const stored = await fixture.bazi.getReading(created.id);
    const reading = applyReadingTranslation({
      ...publicBaziReading(stored), translation: completedTranslation(stored),
    });
    const html = renderIn("en", createElement(BaziReading, { reading, birth: null, onReading: noop }));
    const markers = ["Character portrait", "Life luck cycles", "Plain-language summary",
      "Practical guidance", "Three interpretations", "BaZi (Four Pillars of Destiny)",
      "Combinations &amp; clashes", "Five Elements balance"];
    markers.forEach((marker) => assert.ok(html.includes(marker), marker));
    for (let index = 1; index < markers.length; index += 1) {
      assert.ok(html.indexOf(markers[index - 1]!) < html.indexOf(markers[index]!), markers[index]);
    }
    const visible = html.replace(
      /<details[^>]*class="[^"]*traditional-chart[^"]*"[^>]*>[\s\S]*?<\/details>/gu,
      "",
    );
    assert.doesNotMatch(visible, /[\p{Script=Han}]/u);
  } finally {
    await fixture.close();
  }
});

test("旧命理存档无画像与逐运时降级为原大运时间轴", async () => {
  const fixture = await baziFixture();
  try {
    const created = await fixture.bazi.create({
      kind: "destiny", question: "我适合做什么", birth,
      sect: 1, horizon: "year", feeProof: proof(33),
    });
    await fixture.bazi.whenSettled(created.id);
    const stored = await fixture.bazi.getReading(created.id);
    if (stored.summary?.output) delete stored.summary.output.portrait;
    for (const state of Object.values(stored.schools)) {
      if (state.output && "periods" in state.output) delete state.output.periods;
    }
    const reading = publicBaziReading(stored);
    const html = renderIn("zh", createElement(BaziReading, { reading, birth: null, onReading: noop }));
    assert.doesNotMatch(html, /性格画像|life-luck-panel/u);
    assert.match(html, /class="luck"/u);
    assert.match(html, /大运/u);
    // 旧存档版式不变：大运时间轴仍在盘面之后、合冲刑害之前，不挪到页顶。
    assert.ok(html.indexOf('class="luck"') > html.indexOf("所问之事"));
    assert.ok(html.indexOf('class="luck"') < html.indexOf('class="rel-svg"'));
    const en = renderIn("en", createElement(BaziReading, { reading, birth: null, onReading: noop }));
    assert.ok(en.indexOf('class="luck"') > en.indexOf("BaZi (Four Pillars of Destiny)"));
  } finally {
    await fixture.close();
  }
});

test("命理首页空问题直达默认问题，写了问题仍走原分类规则", async () => {
  const home = await import("../web/lib/home-entry.js");
  assert.deepEqual(home.KIND_OPTIONS.map((option) => option[0]),
    ["destiny", "question", "fortune", "naming"]);
  assert.equal(home.DEFAULT_ENTRY.kind, "destiny");
  assert.deepEqual(home.entryGate({
    questionLength: 0, classified: false, entry: home.DEFAULT_ENTRY, birthProblem: null,
  }, createT(en), { requireManualKind: true, requireQuestionSubject: true }), { ready: true, reason: "" });
  assert.deepEqual(home.entryGate({
    questionLength: 0, classified: false, entry: home.DEFAULT_ENTRY,
    birthProblem: "Enter your birth date.",
  }, createT(en), { requireManualKind: true, requireQuestionSubject: true }), {
    ready: false, reason: "Complete your birth details: Enter your birth date.",
  });
  assert.equal(home.entryGate({
    questionLength: 8, classified: true, entry: home.DEFAULT_ENTRY, birthProblem: null,
  }, createT(en), { requireManualKind: true }).ready, false);
  assert.equal(home.submissionQuestion(home.DEFAULT_ENTRY, "", createT(en)),
    "How will my life unfold, and what is my character like?");
  assert.equal(home.submissionQuestion(home.DEFAULT_ENTRY, "  我想看性格  "), "我想看性格");
});

test("首页文案、示例顺序与命理示例路由符合命理优先设计", () => {
  const zh = readFileSync(new URL("../web/i18n/zh.ts", import.meta.url), "utf8");
  const enText = readFileSync(new URL("../web/i18n/en.ts", import.meta.url), "utf8");
  const form = readFileSync(new URL("../web/components/QuestionForm.tsx", import.meta.url), "utf8");
  assert.match(zh, /输入生辰，看你一生的大运起伏与性格底色/u);
  assert.match(zh, /填生辰（问题选填）/u);
  assert.match(enText, /Enter your birth date to see the ten-year luck cycles of your life/u);
  assert.match(enText, /Enter your birth date \(question optional\)/u);
  assert.ok(form.indexOf("#/sample/destiny") < form.indexOf("#/sample/question"));
  assert.deepEqual(route("#/sample/destiny"), { page: "sample", kind: "destiny" });
});

test("画像与一生运势在窄屏保持画像纵排、图完整和表内横滚", () => {
  const css = readFileSync(new URL("../web/styles/bazi.css", import.meta.url), "utf8");
  assert.match(css, /\.life-luck-panel\s+\.ln-x\s*\{[^}]*display:\s*grid/u);
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.portrait-columns\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(css, /\.ln-scroll\s*\{[^}]*overflow-x:\s*auto/u);
  assert.match(css, /\.ln-table tbody th[^}]*position:\s*sticky/u);
});
