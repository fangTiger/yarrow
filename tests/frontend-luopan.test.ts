// tests/frontend-luopan.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { BAGUA, MOUNTAINS } from "../web/components/Luopan.js";

test("二十四山自午顺时针且恰为二十四个", () => {
  assert.equal(MOUNTAINS[0], "午");
  assert.equal(MOUNTAINS.length, 24);
  assert.equal(MOUNTAINS.join(""), "午丁未坤申庚酉辛戌乾亥壬子癸丑艮寅甲卯乙辰巽巳丙");
});

test("后天八卦离南在上并按顺时针排列", () => {
  assert.deepEqual(BAGUA.map(([name]) => name), ["离", "坤", "兑", "乾", "坎", "艮", "震", "巽"]);
});

import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HexagramFigure } from "../web/components/HexagramFigure.js";
import { FiveHexagrams } from "../web/components/FiveHexagrams.js";
import { ThrowRecord } from "../web/components/ThrowRecord.js";
import { AutoCast } from "../web/components/AutoCast.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { type PublicReading, type ThrowResult } from "../web/lib/api.js";

const result: ThrowResult = {
  index: 1, coins: [1, 0, 0], backs: 1, value: 7, name: "单", moving: false,
  blockNumber: "8", blockHash: `0x${"ab".repeat(32)}`, blockTimestamp: "1790770501",
};
const reading: PublicReading = {
  id: "abcdefghijklmnopqrstuvwxyz", kind: "question", createdAt: "2026-09-30T12:15:00Z",
  question: "这次面试能过吗", subject: { suggestedKey: "career", finalKey: "career", overridden: false, changes: 0 },
  payment: { firstHash: `0x${"11".repeat(32)}` }, throws: [], status: "awaiting-throws",
  schools: {
    chengyi: { status: "pending", retries: 0 }, jingfang: { status: "pending", retries: 0 },
    shaoyong: { status: "pending", retries: 0 },
  },
};

test("逐爻卦画从初爻向上生长并标注当前动爻", () => {
  const html = renderToStaticMarkup(createElement(HexagramFigure, {
    lines: [true, false, true], moving: [1, 3], label: "已成三爻",
  }));
  assert.match(html, /class="yang moving".*class="yin".*class="yang moving"/su);
});

test("五卦和铜钱记录读取真实引擎与 RecordedThrow 字段", () => {
  const figures = deriveFiveHexagrams([7, 8, 9, 8, 7, 6]);
  const html = renderToStaticMarkup(createElement(FiveHexagrams, { figures, moving: [3, 6] }));
  for (const figure of Object.values(figures)) {
    assert.ok(html.includes(figure.name));
    assert.ok(html.includes(figure.label));
    assert.ok(html.includes(figure.derivation));
  }
  const record = renderToStaticMarkup(createElement(ThrowRecord, { throws: [result, { ...result, index: 2 }] }));
  assert.ok(record.indexOf("二爻") < record.indexOf("初爻"));
  assert.match(record, /1背 · 单 · 阳/u);
  assert.doesNotMatch(html + record, /\[object Object\]|undefined/u);
});

function cast(value: PublicReading): string {
  return renderToStaticMarkup(createElement(AutoCast, { reading: value, onReading: () => {} }));
}

test("付款后自动起卦：没有「摇」按钮，逐爻显示进度", () => {
  const html = cast({ ...reading, throws: [result, { ...result, index: 2 }] });
  assert.match(html, /自动起卦/);
  assert.match(html, /已成2爻/);
  assert.match(html, /第 3 掷/);
  assert.doesNotMatch(html, /摇 ·|松手落钱|按住/);
  assert.doesNotMatch(html, /<button/);
});

test("Arc 长时间无响应时提示暂停并提供「继续起卦」", () => {
  const html = cast({ ...reading, throws: [result], castPaused: true } as PublicReading);
  assert.match(html, /Arc 网络暂不可用，恢复后自动继续/);
  assert.match(html, /<button[^>]*>继续起卦<\/button>/);
});

test("六掷完成后提示正在排盘", () => {
  const throws = [1, 2, 3, 4, 5, 6].map((index) => ({ ...result, index }));
  const html = cast({ ...reading, throws, status: "charting" });
  assert.match(html, /六爻已成，正在排盘/);
});
