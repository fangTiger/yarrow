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
import { CoinThrow } from "../web/components/CoinThrow.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { api, ApiError, type PublicReading, type ThrowResult } from "../web/lib/api.js";

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

// 沿用首页测试的无 DOM 驱动方式，测试真实事件处理器与状态机。
function coinHarness(value = reading) {
  const internals = (React as unknown as {
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: { ReactCurrentDispatcher: { current: unknown } };
  }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const slots: unknown[] = [];
  let cursor = 0;
  const dispatcher = {
    useReducer(reducer: (state: unknown, action: unknown) => unknown, initial: unknown, init: (value: unknown) => unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = init(initial);
      return [slots[index], (action: unknown) => { slots[index] = reducer(slots[index], action); }];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect() {},
  };
  return {
    render() {
      cursor = 0;
      const previous = internals.ReactCurrentDispatcher.current;
      internals.ReactCurrentDispatcher.current = dispatcher;
      try { return CoinThrow({ reading: value, onReading: () => {} }); }
      finally { internals.ReactCurrentDispatcher.current = previous; }
    },
  };
}
function button(node: ReturnType<typeof CoinThrow>): React.ReactElement<any> {
  return (React.Children.toArray(node.props.children).filter(React.isValidElement) as React.ReactElement<any>[])
    .find((child) => child.type === "button")!;
}

for (const mode of ["pointer", " ", "Enter"]) {
  test(`${mode} 按住松开只发送一次六掷请求`, async (t) => {
    const call = t.mock.method(api, "throwCoin", async () => result);
    t.mock.method(api, "getReading", async () => ({ ...reading, throws: [result] }));
    const harness = coinHarness();
    let control = button(harness.render());
    if (mode === "pointer") control.props.onPointerDown();
    else {
      control.props.onKeyDown({ key: mode, repeat: false, preventDefault() {} });
      control.props.onKeyDown({ key: mode, repeat: true, preventDefault() {} });
    }
    assert.equal(call.mock.callCount(), 0);
    control = button(harness.render());
    if (mode === "pointer") { control.props.onPointerUp(); control.props.onPointerCancel(); }
    else { control.props.onKeyUp({ key: mode, preventDefault() {} }); control.props.onKeyUp({ key: mode, preventDefault() {} }); }
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(call.mock.callCount(), 1);
    assert.deepEqual(call.mock.calls[0]!.arguments, [reading.id, 1]);
    assert.equal(button(harness.render()).props.children, "摇 · 第2掷");
  });
}

test("Arc 失败后保留原记录并从原掷序恢复", async (t) => {
  t.mock.method(api, "throwCoin", async () => { throw new ApiError("未能取得天时", 503); });
  const harness = coinHarness({ ...reading, throws: [result] });
  button(harness.render()).props.onPointerDown();
  button(harness.render()).props.onPointerUp();
  await Promise.resolve();
  const node = harness.render();
  assert.equal(button(node).props.children, "摇 · 第2掷");
  const children = React.Children.toArray(node.props.children).filter(React.isValidElement) as React.ReactElement<any>[];
  const pause = children.find((child) => child.props.className === "throw-pause")!;
  const resume = (React.Children.toArray(pause.props.children).filter(React.isValidElement) as React.ReactElement<any>[])
    .find((child) => child.type === "button")!;
  resume.props.onClick();
  assert.equal(button(harness.render()).props.children, "摇 · 第2掷");
});
