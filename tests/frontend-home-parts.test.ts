// tests/frontend-home-parts.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QUESTION_SUBJECTS } from "../src/oracle/question-classifier.js";
import { BirthFields } from "../web/components/BirthFields.js";
import { HistoryMenu } from "../web/components/HistoryMenu.js";
import { HorizonChips } from "../web/components/HorizonChips.js";
import { KindOptions } from "../web/components/KindOptions.js";
import { SubjectSelect } from "../web/components/SubjectSelect.js";
import { EMPTY_BIRTH, type BirthFormValues } from "../web/lib/birth-profile.js";

const forbidden = /易者|押钱|赔付|封存|・|[぀-ヿ]/u;
const noop = () => {};
const filled: BirthFormValues = {
  ...EMPTY_BIRTH, year: "1990", month: "5", day: "15", time: "15:30", gender: "male",
};
function fields(values: BirthFormValues, problem: string | null = null): string {
  return renderToStaticMarkup(createElement(BirthFields, {
    values, problem, onChange: noop,
  }));
}

test("生辰行只收日期、时间（选填）、性别，没有勾选与告知，不出现城市与经纬度", () => {
  const html = fields(filled);
  assert.match(html, /type="date"/);
  assert.match(html, /value="1990-05-15"/);
  assert.match(html, /type="time"/);
  assert.match(html, /时间（选填）/);
  assert.match(html, />男</);
  assert.match(html, />女</);
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.doesNotMatch(html, /不知道时辰|记住|仅存本机|只存本机|分享链接/);
  assert.doesNotMatch(html, /城市|经度|经纬|出生地|港澳台|真太阳时/);
  assert.doesNotMatch(html, forbidden);
});

test("农历改用中文月日与闰月勾选；日期已填而时间空着时提示按三柱推算", () => {
  const lunar = fields({ ...filled, calendar: "lunar" });
  assert.doesNotMatch(lunar, /type="date"/);
  assert.match(lunar, /正月/);
  assert.match(lunar, /腊月/);
  assert.match(lunar, /初一/);
  assert.match(lunar, /闰月/);
  assert.match(fields({ ...filled, time: "" }), /未填时间，按年月日三柱推算/);
  assert.doesNotMatch(fields(filled), /未填时间/);
  assert.doesNotMatch(fields(EMPTY_BIRTH), /未填时间/);
  const form = readFileSync(new URL("../web/components/QuestionForm.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(form, /remember/i);
  assert.match(form, /saveBirthProfile\(/);
});

test("还没开始填时不显示报错，填了一半才就地提示", () => {
  assert.doesNotMatch(fields(EMPTY_BIRTH, "请填写出生日期"), /role="alert"/);
  assert.match(fields({ ...filled, day: "" }, "请填写出生日期"), /role="alert"[^>]*>请填写出生日期/);
});

test("卦历收在右上角图标里：收起时只有图标与条数，展开列出可打开的记录", () => {
  const readings = [
    { id: "abc", kind: "fortune", question: "我今年运势如何", createdAt: "2026-10-06T12:15:00Z" },
    { id: "def", kind: "question", question: "面试能过吗", createdAt: "2026-10-05T08:00:00Z" },
  ];
  const closed = renderToStaticMarkup(createElement(HistoryMenu, { readings }));
  assert.match(closed, /aria-label="卦历（2 条）"/);
  assert.match(closed, /aria-expanded="false"/);
  assert.doesNotMatch(closed, /href="#\/r\/abc"/);
  const open = renderToStaticMarkup(createElement(HistoryMenu, { readings, defaultOpen: true }));
  assert.match(open, /aria-expanded="true"/);
  assert.match(open, /href="#\/r\/abc"/);
  assert.match(open, /运势/);
  assert.match(open, /面试能过吗/);
  const empty = renderToStaticMarkup(createElement(HistoryMenu, { readings: [], defaultOpen: true }));
  assert.match(empty, /本机还没有留下卦历/);
  assert.doesNotMatch(open + empty, forbidden);
});

test("三个类型选项以单选组呈现，当前项高亮", () => {
  const html = renderToStaticMarkup(createElement(KindOptions, { value: "fortune", onChange: noop }));
  assert.match(html, /role="radiogroup"/);
  assert.equal((html.match(/role="radio"/g) ?? []).length, 3);
  assert.match(html, /aria-checked="true"[^>]*>运势</);
  assert.match(html, /aria-checked="false"[^>]*>问事</);
});

test("事项下拉含自动识别与服务端白名单全部事项", () => {
  const html = renderToStaticMarkup(createElement(SubjectSelect, {
    value: "", detected: "工作官职", onChange: noop,
  }));
  assert.match(html, /自动识别（工作官职）/);
  for (const item of QUESTION_SUBJECTS) {
    assert.ok(html.includes(item.label), item.key);
  }
});

test("运势时间范围为今天、本月、今年、明年，识别到的指定年份另列", () => {
  const html = renderToStaticMarkup(createElement(HorizonChips, { value: "year", onChange: noop }));
  for (const label of ["今天", "本月", "今年", "明年"]) {
    assert.match(html, new RegExp(`>${label}<`));
  }
  assert.match(html, /aria-pressed="true"[^>]*>今年</);
  const custom = renderToStaticMarkup(createElement(HorizonChips, { value: "year:2028", onChange: noop }));
  assert.match(custom, /aria-pressed="true"[^>]*>2028 年</);
});

test("首页不再显示时空栏与右侧最近记录，顶栏放卦历图标", () => {
  const source = readFileSync(new URL("../web/pages/Home.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /ShikongBar|<RecentReadings|components\/RecentReadings|home-grid/);
  assert.match(source, /HistoryMenu/);
  assert.match(source, /WalletBar/);
});
