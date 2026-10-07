// tests/frontend-plain-summary.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlainSummaryPanel } from "../web/components/PlainSummaryPanel.js";
import { RemedyPanel } from "../web/components/RemedyPanel.js";
import { summaryStatus } from "../web/lib/reading-state.js";

const output = {
  tone: "中" as const,
  conclusion: "能不能过还说不准，偏向需要再等一等。",
  agreement: "三家都认为时机还没完全到。",
  difference: "京房更悲观一些。",
  explanation: ["代表这件事的那一爻力量不足。", "整体局面平稳。"],
  remedy: {
    principle: "多与人切磋商量，比独自硬扛更有用。",
    plan: [
      { action: "把作品集再打磨一遍", basis: "三家都认为准备还不够充分", timing: "面试前一周" },
      { action: "约一位业内朋友模拟面试", basis: "兑卦讲朋友讲习" },
    ],
    avoid: ["别在结果出来前放弃其他机会"],
  },
  watch: { window: "下月中旬", condition: "若对方主动联系" },
};
const anchor = { title: "《象传》· 兑为泽", lines: ["丽泽，兑；君子以朋友讲习。"] };
function reading(overrides: Record<string, unknown> = {}) {
  return {
    id: "abcdefghijklmnopqrstuvwxyz", kind: "question", question: "这次面试能过吗", status: "done",
    schools: {
      chengyi: { status: "done", retries: 0 }, jingfang: { status: "done", retries: 0 },
      shaoyong: { status: "done", retries: 0 },
    },
    summary: { status: "done", basis: 3, attempts: 1, retries: 0, output, anchor },
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

test("总述面板：结论、倾向、同异、解释、留意时间、依据几家（建议并入解法）", () => {
  const html = renderToStaticMarkup(createElement(PlainSummaryPanel, { reading: reading(), onReading: () => {} }));
  assert.match(html, /白话总述/);
  assert.match(html, /这次面试能过吗/);
  assert.match(html, /能不能过还说不准/);
  assert.match(html, /成败参半/);
  assert.match(html, /三家一致/);
  assert.match(html, /京房更悲观一些/);
  assert.match(html, /整体局面平稳/);
  assert.doesNotMatch(html, /把作品集再打磨一遍/);
  assert.match(html, /下月中旬/);
  assert.match(html, /若对方主动联系/);
  assert.match(html, /依据 3 家断语/);
  assert.doesNotMatch(html, /<h3>建议<\/h3>/);
});

test("解法面板：心法原文与白话、怎么做（依据与时机）、别做什么", () => {
  const html = renderToStaticMarkup(createElement(RemedyPanel, { reading: reading() }));
  for (const text of ["解法", "心法", "《象传》· 兑为泽", "丽泽，兑；君子以朋友讲习。", "多与人切磋商量",
    "怎么做", "把作品集再打磨一遍", "依据：三家都认为准备还不够充分", "时机：面试前一周",
    "约一位业内朋友模拟面试", "别做什么", "别在结果出来前放弃其他机会"]) {
    assert.ok(html.includes(text), text);
  }
  assert.equal((html.match(/时机：/g) ?? []).length, 1);
  const writing = reading({ summary: { status: "writing", basis: 3 } });
  assert.equal(renderToStaticMarkup(createElement(RemedyPanel, { reading: writing })), "");
});

test("旧存档没有解法：不显示解法面板，总述照旧显示建议", () => {
  const { remedy: _remedy, ...rest } = output;
  const old = reading({
    summary: { status: "done", basis: 3, retries: 0, output: { ...rest, advice: ["把作品集再打磨一遍。"] } },
  });
  assert.equal(renderToStaticMarkup(createElement(RemedyPanel, { reading: old })), "");
  const html = renderToStaticMarkup(createElement(PlainSummaryPanel, { reading: old, onReading: () => {} }));
  assert.match(html, /<h3>建议<\/h3>/);
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

test("结果页依次是白话总述、解法、折叠的「看三家依据」", () => {
  for (const path of ["../web/pages/Reading.tsx", "../web/pages/BaziReading.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /<PlainSummaryPanel/);
    assert.match(source, /<RemedyPanel/);
    assert.match(source, /看三家依据/);
    assert.ok(source.indexOf("<PlainSummaryPanel") < source.indexOf("<RemedyPanel"), path);
    assert.ok(source.indexOf("<RemedyPanel") < source.indexOf("看三家依据"), path);
  }
});
