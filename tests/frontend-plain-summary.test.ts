// tests/frontend-plain-summary.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlainSummaryPanel } from "../web/components/PlainSummaryPanel.js";
import { summaryStatus } from "../web/lib/reading-state.js";

const output = {
  tone: "中" as const,
  conclusion: "能不能过还说不准，偏向需要再等一等。",
  agreement: "三家都认为时机还没完全到。",
  difference: "京房更悲观一些。",
  explanation: ["代表这件事的那一爻力量不足。", "整体局面平稳。"],
  advice: ["把作品集再打磨一遍。", "别急着放弃其他机会。"],
  watch: { window: "下月中旬", condition: "若对方主动联系" },
};
function reading(overrides: Record<string, unknown> = {}) {
  return {
    id: "abcdefghijklmnopqrstuvwxyz", kind: "question", question: "这次面试能过吗", status: "done",
    schools: {
      chengyi: { status: "done", retries: 0 }, jingfang: { status: "done", retries: 0 },
      shaoyong: { status: "done", retries: 0 },
    },
    summary: { status: "done", basis: 3, attempts: 1, retries: 0, output },
    ...overrides,
  } as never;
}

test("总述状态：起卦中、排盘中、三家落笔进度、写作中、完成、未生成、旧存档无总述", () => {
  assert.deepEqual(summaryStatus(reading({ status: "awaiting-throws", summary: undefined })),
    { kind: "progress", text: "起卦中" });
  assert.deepEqual(summaryStatus(reading({ status: "charting", summary: undefined })),
    { kind: "progress", text: "排盘中" });
  assert.deepEqual(summaryStatus(reading({
    status: "writing", summary: undefined,
    schools: {
      chengyi: { status: "done", retries: 0 }, jingfang: { status: "writing", retries: 0 },
      shaoyong: { status: "failed", retries: 0 },
    },
  })), { kind: "progress", text: "三家落笔中（2/3）" });
  assert.deepEqual(summaryStatus(reading({ status: "writing", summary: { status: "writing", basis: 3 } })),
    { kind: "progress", text: "正在写白话总述" });
  assert.deepEqual(summaryStatus(reading()), { kind: "done" });
  assert.deepEqual(summaryStatus(reading({ summary: { status: "failed", basis: 2, retries: 0, error: "x" } })),
    { kind: "failed", text: "白话总述暂未生成", canRetry: true });
  assert.deepEqual(summaryStatus(reading({ summary: { status: "failed", basis: 0, retries: 0, error: "三家均未落笔，暂无白话总述" } })),
    { kind: "failed", text: "三家均未落笔，暂无白话总述", canRetry: false });
  assert.deepEqual(summaryStatus(reading({ summary: undefined })), { kind: "none" });
});

test("总述面板：结论、倾向、同异、解释、建议、留意时间、依据几家", () => {
  const html = renderToStaticMarkup(createElement(PlainSummaryPanel, { reading: reading(), onReading: () => {} }));
  assert.match(html, /白话总述/);
  assert.match(html, /这次面试能过吗/);
  assert.match(html, /能不能过还说不准/);
  assert.match(html, /成败参半/);
  assert.match(html, /三家一致/);
  assert.match(html, /京房更悲观一些/);
  assert.match(html, /整体局面平稳/);
  assert.match(html, /把作品集再打磨一遍/);
  assert.match(html, /下月中旬/);
  assert.match(html, /若对方主动联系/);
  assert.match(html, /依据 3 家断语/);
});

test("总述面板：未生成时给免费重试，写作中显示进度，运势显示十年走势", () => {
  const failed = renderToStaticMarkup(createElement(PlainSummaryPanel, {
    reading: reading({ summary: { status: "failed", basis: 2, retries: 1, error: "x" } }), onReading: () => {},
  }));
  assert.match(failed, /白话总述暂未生成/);
  assert.match(failed, /<button[^>]*>免费重试（还可 1 次）<\/button>/);
  const writing = renderToStaticMarkup(createElement(PlainSummaryPanel, {
    reading: reading({ status: "writing", summary: { status: "writing", basis: 3 } }), onReading: () => {},
  }));
  assert.match(writing, /正在写白话总述/);
  const fortune = renderToStaticMarkup(createElement(PlainSummaryPanel, {
    reading: reading({
      kind: "fortune",
      summary: { status: "done", basis: 3, retries: 0, output: { ...output, outlook: "前几年宜守，后几年渐顺。" } },
    }),
    onReading: () => {},
  }));
  assert.match(fortune, /十年走势/);
  assert.match(fortune, /后几年渐顺/);
});

test("结果页把白话总述放在最前，三家断语折叠为「看三家依据」", () => {
  for (const path of ["../web/pages/Reading.tsx", "../web/pages/BaziReading.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /<PlainSummaryPanel/);
    assert.match(source, /看三家依据/);
    assert.ok(source.indexOf("<PlainSummaryPanel") < source.indexOf("看三家依据"), path);
  }
});
