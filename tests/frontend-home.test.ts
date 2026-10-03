// tests/frontend-home.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClassificationTags,
  type ClassificationView,
} from "../web/components/ClassificationTags.js";
import { RecentReadings } from "../web/components/RecentReadings.js";
import { ShikongBar } from "../web/components/ShikongBar.js";
const forbidden = /易者|押钱|赔付|封存|・|[\u3040-\u30ff]/u;
import { almanacAt } from "../src/calendar/almanac.js";
import { toView } from "../web/components/ShikongBar.js";
test("时空栏以真实接口数据渲染六格主值与副注且节气不重复", () => {
  const value = toView(almanacAt(BigInt(Date.parse("2026-10-03T18:18:00+08:00") / 1000)));
  assert.deepEqual(value.solar, { label: "公历", main: "2026-10-03 18:18", sub: "北京时间" });
  assert.deepEqual(value.lunar, { label: "农历", main: "八月廿三", sub: "丙午年 · 酉时 · 下弦" });
  assert.equal(value.pillars.main, "丙午 丁酉 庚戌 乙酉");
  assert.equal(value.pillars.sub, "天河水 山下火 钗钏金 泉中水");
  assert.deepEqual(value.solarTerm, { label: "节气", main: "秋分 · 三候", sub: "水始涸 · 10月8日交寒露" });
  assert.deepEqual(value.monthDay, { label: "月建日辰", main: "酉月 · 庚戌日", sub: "旬首甲辰 · 旬空寅卯" });
  assert.deepEqual(value.duty, { label: "值日", main: "除日 · 天牢黑道", sub: "胃土雉 · 冲龙（甲辰）煞北" });
  const html = renderToStaticMarkup(createElement(ShikongBar, { data: value }));
  for (const cell of Object.values(value)) {
    assert.ok(html.includes(cell.label));
    assert.ok(html.includes(cell.main));
    assert.ok(html.includes(cell.sub));
  }
  assert.equal((html.match(/秋分/gu) ?? []).length, 1);
  assert.doesNotMatch(html, forbidden);
});
const view = (overrides: Partial<ClassificationView>): ClassificationView => ({
  question: "这次面试能过吗", kind: "question", supported: true, subject: "工作官职", ...overrides,
});
test("问事、运势与起名标签提供正确动作", () => {
  const callbacks = {
    onKindChange: () => {},
    onQuestionFallback: () => {},
    onSubjectChange: () => {},
  };
  const question = renderToStaticMarkup(createElement(ClassificationTags, {
    ...callbacks,
    view: view({}),
  }));
  const fortune = renderToStaticMarkup(createElement(ClassificationTags, {
    ...callbacks,
    view: view({
      kind: "fortune",
      supported: true,
      horizon: "今年",
    }),
  }));
  const naming = renderToStaticMarkup(createElement(ClassificationTags, {
    ...callbacks,
    view: view({
      kind: "naming",
      supported: false,
      suggestion: "可改为问事",
    }),
  }));
  assert.match(question, /问事.*工作官职/su);
  assert.match(fortune, /即将开放，可先改为问事/u);
  assert.match(naming, /可改为问事/u);
  assert.doesNotMatch(question + fortune + naming, forbidden);
});
test("最近记录可以打开", () => {
  const html = renderToStaticMarkup(createElement(RecentReadings, {
    readings: [{
      id: "abc",
      kind: "question",
      question: "面试能过吗",
      createdAt: "2026-09-30T12:15:00Z",
    }],
  }));
  assert.match(html, /href="#\/r\/abc"/u);
  assert.match(html, /面试能过吗/u);
  assert.doesNotMatch(html, forbidden);
});

test("可改事项与服务端白名单一致", async () => {
  const { QUESTION_SUBJECTS } = await import("../src/oracle/question-classifier.js");
  const html = renderToStaticMarkup(createElement(ClassificationTags, {
    view: view({}), onKindChange: () => {}, onQuestionFallback: () => {}, onSubjectChange: () => {},
  }));
  for (const item of QUESTION_SUBJECTS) assert.ok(html.includes(item.label), item.key);
});

import React from "react";
// Node 测试显式提供浏览器构建期公开常量，不读取本机配置。
Object.assign(globalThis, {
  __ARC_CHAIN_ID__: "5042002", __ARC_RPC_URL__: "https://rpc.testnet.arc.io",
  __ARC_EXPLORER__: "https://testnet.arcscan.app", __WALLETCONNECT_PROJECT_ID__: "0".repeat(32),
});
const { QuestionForm } = await import("../web/components/QuestionForm.js");
const { PaymentButton } = await import("../web/components/PaymentButton.js");
import { classifyQuestion } from "../src/sanyi/classify.js";
import { api } from "../web/lib/api.js";
import { readFileSync } from "node:fs";

// 无 DOM 环境下驱动组件状态和副作用，支付钱包流程不在这里执行。
function formHarness() {
  const internals = (React as unknown as {
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
      ReactCurrentDispatcher: { current: unknown };
    };
  }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const states: unknown[] = [];
  const effects: { deps: unknown[]; cleanup: (() => void) | undefined }[] = [];
  let stateIndex = 0;
  let effectIndex = 0;
  let pending: (() => void)[] = [];
  const dispatcher = {
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next: unknown) => { states[index] = next; }];
    },
    useEffect(callback: () => (() => void) | undefined, deps: unknown[]) {
      const index = effectIndex++;
      const previous = effects[index];
      if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
      pending.push(() => {
        previous?.cleanup?.();
        effects[index] = { deps, cleanup: callback() };
      });
    },
  };
  return {
    render() {
      stateIndex = effectIndex = 0;
      const previous = internals.ReactCurrentDispatcher.current;
      internals.ReactCurrentDispatcher.current = dispatcher;
      try { return QuestionForm(); }
      finally {
        internals.ReactCurrentDispatcher.current = previous;
        const callbacks = pending;
        pending = [];
        callbacks.forEach((callback) => callback());
      }
    },
    dispose() { effects.forEach((effect) => effect.cleanup?.()); },
  };
}
function childrenOf(node: ReturnType<typeof QuestionForm>) {
  return React.Children.toArray(node.props.children).filter(React.isValidElement) as React.ReactElement<any>[];
}

test("首页自动分类：未分类禁用、400ms 防抖、问事可用、起名提示且禁用", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const classify = t.mock.method(api, "classify", async (question: string) => ({
    question, kind: question.includes("名字") ? "naming" : "question",
    supported: !question.includes("名字"), suggestion: "可改为问事",
    subject: { key: "career", label: "工作官职" },
  }));
  const harness = formHarness();
  t.after(() => harness.dispose());
  let children = childrenOf(harness.render());
  const initialButton = children.find((child) => child.type === "button")!;
  assert.equal(initialButton.props.children, "问卦 · 0.05 USDC");
  assert.equal(initialButton.props.disabled, true);
  const input = children.find((child) => child.type === "textarea")!;
  assert.equal(input.props.placeholder, "例如：这次面试能过吗？");
  input.props.onChange({ target: { value: "这次面试能过吗" } });
  harness.render();
  t.mock.timers.tick(399);
  assert.equal(classify.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.ok(childrenOf(harness.render()).some((child) => child.props.children === "识别中"));
  await Promise.resolve();
  children = childrenOf(harness.render());
  assert.ok(children.some((child) => child.type === PaymentButton));
  children.find((child) => child.type === "textarea")!.props.onChange({ target: { value: "帮我取个名字" } });
  children = childrenOf(harness.render());
  assert.equal(children.find((child) => child.type === "button")!.props.disabled, true);
  t.mock.timers.tick(400);
  await Promise.resolve();
  children = childrenOf(harness.render());
  assert.equal(children.find((child) => child.type === "button")!.props.disabled, true);
  const tags = children.find((child) => child.type === ClassificationTags)!;
  const html = renderToStaticMarkup(tags);
  assert.match(html, /可改为问事/u);
  assert.match(html, /改为问事/u);
});

test("时空栏六列、980px 两列且副注使用小号弱色", () => {
  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  assert.match(css, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(css, /@media\s*\(max-width:\s*980px\)[\s\S]*\.shikong\s*\{\s*grid-template-columns:\s*repeat\(2,/u);
  assert.match(css, /\.shikong-sub[^{}]*\{[^}]*color:\s*var\(--muted\)[^}]*font-size:\s*12\.5px/su);
});

test("html 与 body 共用背景且最小高度覆盖页面", () => {
  const css = readFileSync(new URL("../web/styles/layout.css", import.meta.url), "utf8");
  assert.match(css, /html,\s*body\s*\{[^}]*min-height:\s*100%[^}]*background:/su);
});


test("分类接口规范化空白后仍可问卦", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(api, "classify", async (question: string) => classifyQuestion(question));
  const harness = formHarness();
  t.after(() => harness.dispose());
  childrenOf(harness.render()).find((child) => child.type === "textarea")!.props.onChange({ target: { value: "  这次面试能过吗  " } });
  harness.render();
  t.mock.timers.tick(400);
  await Promise.resolve();
  assert.ok(childrenOf(harness.render()).some((child) => child.type === PaymentButton));
});

test("短问题不分类，快速修改重置防抖，过期响应不能启用问卦", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const responses: ((value: ReturnType<typeof classifyQuestion>) => void)[] = [];
  const classify = t.mock.method(api, "classify", () => new Promise<ReturnType<typeof classifyQuestion>>((resolve) => responses.push(resolve)));
  const harness = formHarness();
  t.after(() => harness.dispose());
  const input = (question: string) => {
    childrenOf(harness.render()).find((child) => child.type === "textarea")!.props.onChange({ target: { value: question } });
    harness.render();
  };
  input("面试");
  t.mock.timers.tick(400);
  assert.equal(classify.mock.callCount(), 0);
  input("这次面试能过吗");
  t.mock.timers.tick(200);
  input("这次考试能过吗");
  t.mock.timers.tick(200);
  assert.equal(classify.mock.callCount(), 0);
  t.mock.timers.tick(200);
  assert.equal(classify.mock.callCount(), 1);
  input("帮我取个名字");
  responses[0]!(classifyQuestion("这次考试能过吗"));
  await Promise.resolve();
  let children = childrenOf(harness.render());
  assert.equal(children.find((child) => child.type === "button")!.props.disabled, true);
  assert.ok(!children.some((child) => child.type === ClassificationTags));
  t.mock.timers.tick(400);
  responses[1]!(classifyQuestion("帮我取个名字"));
  await Promise.resolve();
  children = childrenOf(harness.render());
  const tags = children.find((child) => child.type === ClassificationTags)!;
  assert.match(renderToStaticMarkup(tags), /起名即将开放/u);
  tags.props.onQuestionFallback();
  assert.ok(childrenOf(harness.render()).some((child) => child.type === PaymentButton));
});
