// tests/frontend-bazi-charts-en.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { consensusText, tenthsText, yearGapLabel, yunLabel } from "../web/lib/liunian-chart.js";
import { relationEn, relationKindEn } from "../web/lib/result-format.js";
import { renderIn } from "./helpers/render-in.js";

Object.assign(globalThis, {
  __ARC_CHAIN_ID__: "5042002", __ARC_RPC_URL__: "https://rpc.testnet.arc.io",
  __ARC_EXPLORER__: "https://testnet.arcscan.app", __WALLETCONNECT_PROJECT_ID__: "0".repeat(32),
});
const { SampleContent } = await import("../web/pages/SampleReading.js");

const relation = (kind: string, label: string, count: number) => ({
  kind, label, nodeIds: Array.from({ length: count }, (_, index) => `n${index}`),
});

/** 图表区（大运起，到折叠的「传统盘」止）里出现的汉字。 */
function chartHan(html: string): string[] {
  const start = html.lastIndexOf("<section", html.indexOf('class="luck"'));
  const end = html.indexOf("traditional-chart");
  assert.ok(start >= 0 && end > start, "找不到图表区");
  return [...new Set(html.slice(start, end).match(/[\p{Script=Han}]/gu) ?? [])];
}

test("合冲刑害英译：成员写拼音，种类与所化五行写英文", () => {
  assert.equal(relationEn(relation("三会", "巳午未三会火", 3)), "Si–Wu–Wei Fire seasonal union");
  assert.equal(relationEn(relation("三合", "申子辰三合水", 3)), "Shen–Zi–Chen Water three harmony");
  assert.equal(relationEn(relation("半合", "巳酉半合金", 2)), "Si–You Metal half harmony");
  assert.equal(relationEn(relation("拱", "申辰拱水", 2)), "Shen–Chen Water arch");
  assert.equal(relationEn(relation("合", "午未合", 2)), "Wu–Wei combine");
  assert.equal(relationEn(relation("冲", "乙辛冲", 2)), "Yi–Xin clash");
  assert.equal(relationEn(relation("自刑", "午午自刑", 2)), "Wu–Wu self-punishment");
  for (const kind of ["害", "破", "刑"]) {
    assert.doesNotMatch(relationKindEn(relation(kind, `子未${kind}`, 2)), /[\p{Script=Han}]/u, kind);
  }
});

test("合议与几成按语言格式化，中文保持原样", () => {
  assert.equal(consensusText(4), "4.0成");
  assert.equal(consensusText(4, "en"), "4.0/10");
  assert.equal(tenthsText(7), "7成");
  assert.equal(tenthsText(7, "en"), "7/10");
  assert.equal(yunLabel("甲申", "2027-08-04", false), "甲申运 · 2027-08-04 交运");
  assert.equal(yunLabel("Jia Shen", "2027-08-04", false, "en"), "Jia Shen period · from 2027-08-04");
  assert.equal(yunLabel("Jia Shen", "2027-08-04", true, "en"), "Jia Shen period");
  assert.equal(yearGapLabel("failed"), "未落笔");
  assert.equal(yearGapLabel("failed", "en"), "Not written");
});

test("英文运势示例与中文页展示同一套图表，图表区无汉字", () => {
  const reading = JSON.parse(readFileSync(new URL("../web/samples/fortune.en.json", import.meta.url), "utf8"));
  const html = renderIn("en", createElement(SampleContent, { reading, lang: "en" }));
  assert.match(html, /class="ln-plot"/u, "流年走势图");
  assert.match(html, /class="ln-table"/u, "流年逐年表");
  assert.match(html, /class="rel-svg"/u, "合冲刑害图");
  assert.match(html, /class="el-bar"/u, "五行分布条");
  assert.match(html, /luck-current/u, "大运标出今年所在之运");
  assert.match(html, /Combinations &amp; clashes/u);
  assert.match(html, /Three-school consensus \(average\)/u);
  assert.match(html, /\d\/10/u);
  assert.deepEqual(chartHan(html), []);
});
