// tests/frontend-reading-state.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import type { PublicReading } from "../web/lib/api.js";
import {
  consensusTenths,
  readingStage,
  shouldPollReading,
} from "../web/lib/reading-state.js";

function reading(
  status: PublicReading["status"],
  schoolStatuses: readonly [string, string, string],
): PublicReading {
  const school = (index: number, confidenceTenths?: number) => ({
    status: schoolStatuses[index],
    retries: 0,
    ...(confidenceTenths === undefined
      ? {}
      : {
          output: {
            verdict: "平",
            confidenceTenths,
            headline: "静待其时",
            reason: "盘面尚需合看",
            sections: [{ title: "卦义", text: "守正" }],
            advice: ["先核对条件"],
            evidence: [{ ref: "day", claim: "日辰" }],
          },
        }),
  });
  return {
    id: "abcdefghijklmnopqrstuvwxyz",
    kind: "question",
    createdAt: "2026-09-30T12:15:00.000Z",
    question: "这次面试能过吗",
    subject: {
      suggestedKey: "career",
      finalKey: "career",
      overridden: false,
      changes: 0,
    },
    payment: { firstHash: `0x${"11".repeat(32)}` },
    throws: [],
    schools: {
      chengyi: school(0, 6),
      jingfang: school(1, 3),
      shaoyong: school(2, 4),
    },
    status,
  } as PublicReading;
}

test("阶段由 reading 与三家状态共同确定", () => {
  assert.equal(readingStage(reading("awaiting-throws", ["pending", "pending", "pending"])),
    "awaiting-throws");
  assert.equal(readingStage(reading("charting", ["pending", "pending", "pending"])), "charting");
  assert.equal(readingStage(reading("writing", ["done", "writing", "pending"])), "writing");
  assert.equal(readingStage(reading("done", ["done", "done", "done"])), "done");
  assert.equal(readingStage(reading("failed", ["done", "failed", "done"])), "failed");
});

test("排盘或任一家仍落笔时需要轮询", () => {
  assert.equal(shouldPollReading(reading("charting", ["pending", "pending", "pending"])), true);
  assert.equal(shouldPollReading(reading("done", ["done", "writing", "done"])), true);
  assert.equal(shouldPollReading(reading("done", ["done", "done", "done"])), false);
  assert.equal(shouldPollReading(reading("failed", ["done", "failed", "rejected"])), false);
});

test("合议只平均已完成且有输出的家", () => {
  const value = reading("writing", ["done", "failed", "done"]);
  assert.equal(consensusTenths(value.schools), 5);
  const none = reading("writing", ["pending", "failed", "rejected"]);
  assert.equal(consensusTenths(none.schools), undefined);
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Reading } from "../web/pages/Reading.js";
import { buildLiuyaoChart, deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { almanacAt } from "../src/calendar/almanac.js";

// 预载真实 reading，直接验证结果页组合输出；网络状态由独立测试覆盖。
function renderReading(value: PublicReading | undefined) {
  const internals = (React as unknown as {
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: { ReactCurrentDispatcher: { current: unknown } };
  }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const previous = internals.ReactCurrentDispatcher.current;
  let index = 0;
  internals.ReactCurrentDispatcher.current = {
    useState(initial: unknown) { return [index++ === 0 ? value : initial, () => {}]; },
    useEffect() {},
    useCallback(callback: unknown) { return callback; },
  };
  let node: ReturnType<typeof Reading>;
  try { node = Reading({ id: "abcdefghijklmnopqrstuvwxyz" }); }
  finally { internals.ReactCurrentDispatcher.current = previous; }
  return renderToStaticMarkup(node);
}

test("结果页在待六掷与排盘阶段显示对应内容", () => {
  assert.match(renderReading(undefined), /正在打开这一卦/u);
  assert.match(renderReading(reading("awaiting-throws", ["pending", "pending", "pending"])), /亲手六掷/u);
  assert.match(renderReading(reading("charting", ["pending", "pending", "pending"])), /正在排盘/u);
  const failed = { ...reading("failed", ["failed", "failed", "failed"]), error: "排盘数据不可得" };
  assert.match(renderReading(failed), /排盘未能完成.*排盘数据不可得/su);
});

test("结果页首屏使用真实 lines、chart、almanac 展示卦象与六格时空", () => {
  const timestamp = 1790770501n;
  const lines = [7, 8, 9, 8, 7, 6];
  const value = {
    ...reading("writing", ["writing", "pending", "pending"]),
    lines, chart: buildLiuyaoChart({ lines, timestamp }), almanac: almanacAt(timestamp),
  };
  const html = renderReading(value);
  assert.ok(html.includes(value.question));
  for (const figure of Object.values(deriveFiveHexagrams(lines))) assert.ok(html.includes(figure.name));
  assert.match(html, /动爻 3、6/u);
  assert.match(html, /本互变错综五卦/u);
  assert.match(html, /北京时间/u);
  assert.match(html, /四柱/u);
  assert.doesNotMatch(html, /\[object Object\]|undefined/u);
});

import { QUESTION_SUBJECTS } from "../src/oracle/question-classifier.js";
test("结果页事项标签逐一符合服务端真实事项白名单", () => {
  const lines = [7, 8, 7, 8, 7, 8];
  const chart = buildLiuyaoChart({ lines, timestamp: 1790770501n });
  for (const subject of QUESTION_SUBJECTS) {
    const base = reading("done", ["done", "done", "done"]);
    const html = renderReading({ ...base, lines, chart, subject: { ...base.subject, finalKey: subject.key } });
    assert.ok(html.includes(subject.label), subject.key);
  }
});
