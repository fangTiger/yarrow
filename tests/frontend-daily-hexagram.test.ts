import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import type { DailyHexagram as DailyHexagramData } from "../src/sanyi/daily-hexagram.js";
import { DailyHexagram, buildDailyHexagramView, loadDailyHexagram } from "../web/components/DailyHexagram.js";
import { verifyDailyHexagram } from "../web/lib/arc-verify.js";
import { hexagramPath } from "../web/lib/hexagram-path.js";
import { renderIn } from "./helpers/render-in.js";

const data: DailyHexagramData = {
  date: "2026-10-18",
  block: {
    number: "123456",
    hash: `0x${"12".repeat(32)}`,
    timestamp: "1792252801",
  },
  lines: [8, 6, 7, 7, 8, 7],
  chainId: 5_042,
};
const figures = deriveFiveHexagrams(data.lines);

test("今日一卦中文显示卦象、卦名、动爻、古文、出处、公式和问事入口", () => {
  const html = renderIn("zh", createElement(DailyHexagram, { data }));
  assert.match(html, /今日一卦/u);
  assert.match(html, new RegExp(figures.primary.name, "u"));
  assert.match(html, new RegExp(figures.derived.name, "u"));
  assert.match(html, /二爻/u);
  assert.match(html, /卦辞/u);
  assert.match(html, /第 123456 区块/u);
  assert.match(html, /0x1212…1212/u);
  assert.match(html, /sanyi-daily-v1/u);
  assert.match(html.replaceAll("&amp;", "&"), /href="#\/\?kind=question"/u);
  assert.match(html, /class="hexagram-figure/u);
});

test("今日一卦英文只显示固定英译并链接静态卦页", () => {
  const html = renderIn("en", createElement(DailyHexagram, { data }));
  const view = buildDailyHexagramView(data, "en");
  assert.match(html, /Today&#x27;s hexagram/u);
  assert.ok(html.includes(view.primaryName));
  assert.ok(html.includes(view.derivedName));
  assert.ok(html.includes(view.judgement));
  assert.match(html, new RegExp(`href="${hexagramPath(figures.primary.kingWenNumber)}"`, "u"));
  assert.doesNotMatch(html, /[\p{Script=Han}]/u);
});

test("静态卦页路径按文王序和无声调小写拼音生成", () => {
  assert.equal(hexagramPath(50), "/hexagram/50-ding/");
  assert.equal(hexagramPath(56), "/hexagram/56-lu/");
  assert.equal(hexagramPath(9), "/hexagram/9-xiao-chu/");
});

test("接口失败时加载器返回 null，空数据不渲染且首页顺序正确", async () => {
  assert.equal(await loadDailyHexagram(() => Promise.reject(new Error("offline"))), null);
  assert.equal(renderIn("zh", createElement(DailyHexagram, { data: null })), "");
  const source = readFileSync(new URL("../web/pages/Home.tsx", import.meta.url), "utf8");
  const almanac = source.indexOf("<DailyAlmanac");
  const daily = source.indexOf("<DailyHexagram");
  const form = source.indexOf("<QuestionForm");
  assert.ok(almanac >= 0 && daily > almanac && form > daily);
});

test("浏览器读取存档区块哈希并按每日公式复算六爻", async () => {
  const reader = { async getBlock(number: bigint) {
    assert.equal(number, 123456n);
    return { hash: data.block.hash, timestamp: BigInt(data.block.timestamp) };
  } };
  const passed = await verifyDailyHexagram(reader, data);
  assert.equal(passed.ok, true);
  assert.equal(passed.hashOk, true);
  assert.deepEqual(passed.lines, data.lines);

  const changed = await verifyDailyHexagram(reader, { ...data, lines: [7, ...data.lines.slice(1)] });
  assert.equal(changed.ok, false);
  assert.equal(changed.hashOk, true);
});

test("390 像素断点将今日一卦排为单列", () => {
  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  const marker = css.indexOf("/* 今日一卦");
  assert.ok(marker >= 0);
  const block = css.slice(marker);
  assert.match(block, /@media\s*\(max-width:\s*620px\)/u);
  assert.match(block, /\.daily-hexagram-main[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
});

test("问一卦与核对按钮挂接匿名事件", () => {
  const source = readFileSync(new URL("../web/components/DailyHexagram.tsx", import.meta.url), "utf8");
  assert.match(source, /track\("daily_hexagram_ask"\)/u);
  assert.match(source, /track\("daily_hexagram_verify"\)/u);
});
