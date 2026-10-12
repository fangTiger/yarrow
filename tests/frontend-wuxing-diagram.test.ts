// tests/frontend-wuxing-diagram.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WuxingDiagram, wuxingRelations } from "../web/components/WuxingDiagram.js";

const counts = { 木: 1, 火: 2, 土: 2, 金: 0, 水: 1 };

test("五行生克图：五个节点按相生顺序成圈，五条相生、五条相克连线", () => {
  const html = renderToStaticMarkup(createElement(WuxingDiagram, {
    counts, missing: ["金"], favorable: ["金", "木"], dayMaster: "金",
  }));
  assert.match(html, /<svg[^>]*role="img"/u);
  assert.match(html, /aria-label="五行生克图：木 1、火 2、土 2、金 0、水 1；缺金；补金、木"/u);
  for (const element of ["木", "火", "土", "金", "水"]) {
    assert.match(html, new RegExp(`data-node="${element}"`, "u"));
  }
  assert.equal((html.match(/data-relation="生"/gu) ?? []).length, 5);
  assert.equal((html.match(/data-relation="克"/gu) ?? []).length, 5);
  // 相生方向：木→火→土→金→水→木；相克：木→土→水→火→金→木
  for (const pair of ["木火", "火土", "土金", "金水", "水木"]) {
    assert.match(html, new RegExp(`data-relation="生" data-from="${pair[0]}" data-to="${pair[1]}"`, "u"));
  }
  for (const pair of ["木土", "土水", "水火", "火金", "金木"]) {
    assert.match(html, new RegExp(`data-relation="克" data-from="${pair[0]}" data-to="${pair[1]}"`, "u"));
  }
});

test("缺的节点虚线描边标「缺」，补的节点金色标「补」，日主有标注，悬停有说明", () => {
  const html = renderToStaticMarkup(createElement(WuxingDiagram, {
    counts, missing: ["金"], favorable: ["金", "木"], dayMaster: "金",
  }));
  assert.match(html, /data-node="金" class="[^"]*\bmissing\b[^"]*\bsupplement\b/u);
  assert.match(html, /data-node="木" class="[^"]*\bsupplement\b/u);
  assert.doesNotMatch(html, /data-node="火" class="[^"]*\b(missing|supplement)\b/u);
  assert.match(html, /<title>金：0 个，缺，宜补；日主<\/title>/u);
  assert.match(html, /<title>火：2 个<\/title>/u);
  assert.match(html, />日主</u);
  assert.match(html, /相生/u);
  assert.match(html, /相克/u);
});

test("所补五行的生克说明由固定表生成", () => {
  assert.deepEqual(wuxingRelations(["金", "木"]), [
    "补金：土生金，金生水；金克木，火克金",
    "补木：水生木，木生火；木克土，金克木",
  ]);
});

test("没有计数（商号未填店主生辰）时只标所用五行，不显示个数", () => {
  const html = renderToStaticMarkup(createElement(WuxingDiagram, {
    counts: undefined, missing: [], favorable: ["火"],
  }));
  assert.match(html, /data-node="火" class="[^"]*\bsupplement\b/u);
  assert.doesNotMatch(html, /个/u);
  assert.match(html, /aria-label="五行生克图：用火"/u);
  // 店铺没有八字可补，行业五行标「用」而不是「补」。
  assert.match(html, /<tspan class="bu"[^>]*>用<\/tspan>/u);
  assert.doesNotMatch(html, />补</u);
});
