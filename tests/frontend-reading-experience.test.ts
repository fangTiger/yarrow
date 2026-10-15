import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicBaziReading } from "../src/sanyi/bazi-public.js";
import { EnglishSummary } from "../web/components/EnglishReadingSections.js";
import { LifeLuckPanel } from "../web/components/LifeLuckPanel.js";
import { LiuNianPanel } from "../web/components/LiuNianPanel.js";
import { PlainSummaryPanel } from "../web/components/PlainSummaryPanel.js";
import { createT } from "../web/lib/i18n.js";
import { en } from "../web/i18n/en.js";
import { zh } from "../web/i18n/zh.js";
import { BaziReading } from "../web/pages/BaziReading.js";
import { renderIn } from "./helpers/render-in.js";

const noop = () => {};
const schoolKeys = ["shenxiaozhan", "yuchuntai", "rentieqiao"] as const;
const destiny = JSON.parse(readFileSync(
  new URL("../web/samples/destiny.zh.json", import.meta.url), "utf8",
)) as Extract<PublicBaziReading, { kind: "destiny" }>;
const fortune = JSON.parse(readFileSync(
  new URL("../web/samples/fortune.zh.json", import.meta.url), "utf8",
)) as Extract<PublicBaziReading, { kind: "fortune" }>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function writingDestiny(done: 0 | 1) {
  const reading = clone(destiny);
  reading.status = "writing";
  reading.summary = { status: "writing", basis: done, attempts: 1, retries: 0 };
  schoolKeys.forEach((key, index) => {
    if (index < done) {
      reading.schools[key].status = "done";
      return;
    }
    reading.schools[key].status = index === done ? "writing" : "pending";
    delete reading.schools[key].output;
  });
  reading.periods = reading.periods.map((item) => done && item ? { ...item, count: 1 } : null);
  return reading;
}

function writingFortune() {
  const reading = clone(fortune);
  reading.status = "writing";
  reading.summary = { status: "writing", basis: 1, attempts: 1, retries: 0 };
  reading.schools.shenxiaozhan.status = "done";
  for (const key of ["yuchuntai", "rentieqiao"] as const) {
    reading.schools[key].status = key === "yuchuntai" ? "writing" : "pending";
    delete reading.schools[key].output;
  }
  reading.years = reading.years.map((item) => item ? { ...item, count: 1 } : null);
  return reading;
}

test("新命理卦从 0 家落笔起固定显示一生运势，画像占位且没有直标", () => {
  const html = renderIn("zh", createElement(BaziReading, {
    reading: writingDestiny(0), birth: null, onReading: noop, readonly: true,
  }));
  assert.match(html, /<h2>性格画像<\/h2><p>三家写完后综合<\/p>/u);
  assert.match(html, /已落笔 0\/3 家，走势随落笔更新/u);
  assert.match(html, /已落笔各家平均/u);
  assert.match(html, /落笔中/u);
  assert.ok(html.indexOf("一生运势") < html.indexOf("白话总述"));
  assert.doesNotMatch(html, /class="ln-lab"/u);
  assert.doesNotMatch(html, /一生最顺/u);
});

test("一家落笔时命理与运势图仍不画直标，三家结束后沿用原图例", () => {
  const life = renderIn("zh", createElement(LifeLuckPanel, {
    reading: writingDestiny(1), currentDate: "2026-10-16", readonly: true,
  }));
  assert.match(life, /已落笔 1\/3 家，走势随落笔更新/u);
  assert.match(life, /已落笔各家平均/u);
  assert.doesNotMatch(life, /class="ln-lab"/u);

  const annual = renderIn("zh", createElement(LiuNianPanel, {
    reading: writingFortune(), currentYear: 2026,
  }));
  assert.match(annual, /已落笔 1\/3 家，走势随落笔更新/u);
  assert.match(annual, /已落笔各家平均/u);
  assert.doesNotMatch(annual, /class="ln-lab"/u);

  const completeLife = renderIn("zh", createElement(LifeLuckPanel, {
    reading: destiny, currentDate: "2026-10-13", readonly: true,
  }));
  assert.match(completeLife, /三家合议（平均）/u);
  assert.match(completeLife, /一生最顺/u);
  assert.doesNotMatch(completeLife, /走势随落笔更新/u);
});

test("英文写作期命理与运势图表不泄露尚未翻译的汉字", () => {
  const life = renderIn("en", createElement(LifeLuckPanel, {
    reading: writingDestiny(1), currentDate: "2026-10-16", readonly: true,
  }));
  const annual = renderIn("en", createElement(LiuNianPanel, {
    reading: writingFortune(), currentYear: 2026,
  }));
  assert.doesNotMatch(life, /[\p{Script=Han}]/u);
  assert.doesNotMatch(annual, /[\p{Script=Han}]/u);
});

test("旧命理存档仍降级原大运轴；完成的只读示例含分享入口且文本快照稳定", () => {
  const old = clone(destiny);
  delete old.summary?.output?.portrait;
  for (const key of schoolKeys) {
    if (old.schools[key].output && "periods" in old.schools[key].output) {
      delete old.schools[key].output.periods;
    }
  }
  old.periods = old.periods.map(() => null);
  const oldHtml = renderIn("zh", createElement(BaziReading, {
    reading: old, birth: null, onReading: noop, readonly: true,
  }));
  assert.match(oldHtml, /class="luck"/u);
  assert.doesNotMatch(oldHtml, /life-luck-panel|三家写完后综合/u);

  const hashes = [destiny, fortune].map((reading) => {
    const html = renderIn("zh", createElement(BaziReading, {
      reading, birth: null, onReading: noop, readonly: true,
    }));
    assert.match(html, />生成分享图<\/button>/u);
    const text = html.replace(/<[^>]*>/gu, "");
    return createHash("sha256").update(text).digest("hex");
  });
  assert.deepEqual(hashes, [
    "268790898433e26a01ffbc154b7f471e0ad14ea23c20127373d918a285791482",
    "6d04e7a55839898312cad60ef13a52cdad9870884d75d5e9fdcc026f70f292fc",
  ]);
});

test("等待区列出三家状态、已用时间与三分钟超时提示，中英都完整", (t) => {
  const reading = writingDestiny(1);
  reading.createdAt = "2026-10-16T00:00:00.000Z";
  t.mock.method(Date, "now", () => Date.parse("2026-10-16T00:03:01.000Z"));
  const zhHtml = renderIn("zh", createElement(PlainSummaryPanel, {
    reading, onReading: noop, readonly: true,
  }));
  for (const text of ["沈孝瞻", "✓ 已落笔", "余春台", "落笔中", "任铁樵", "未落笔",
    "已用时间 3分 01秒", "通常 1–2 分钟",
    "比平时久，可稍后回来，结果会保存在卦历里"]) {
    assert.ok(zhHtml.includes(text), text);
  }
  const enHtml = renderIn("en", createElement(EnglishSummary, { reading }));
  for (const text of ["Shen Xiaozhan", "Written", "Yu Chuntai", "Writing", "Ren Tieqiao",
    "Not written", "Elapsed 3m 01s", "Usually 1–2 minutes"]) {
    assert.ok(enHtml.includes(text), text);
  }
  assert.doesNotMatch(enHtml, /[\p{Script=Han}]/u);
});

test("大运反馈显示规则、汇总、取消选择和只读隐藏", async () => {
  const helpers = await import("../web/lib/life-luck.js") as Record<string, unknown>;
  assert.equal(typeof helpers.nextPeriodVote, "function");
  const nextPeriodVote = helpers.nextPeriodVote as (
    current: string | undefined, clicked: string,
  ) => string | null;
  assert.equal(nextPeriodVote(undefined, "accurate"), "accurate");
  assert.equal(nextPeriodVote("accurate", "accurate"), null);
  assert.equal(nextPeriodVote("accurate", "inaccurate"), "inaccurate");

  const reading = clone(destiny);
  reading.feedback = { periods: { "1": "accurate", "2": "inaccurate", "4": "accurate" } };
  const html = renderIn("zh", createElement(LifeLuckPanel, {
    reading, currentDate: "2026-10-16", onReading: noop,
  }));
  assert.match(html, /你已对照 3 步：准 2 · 不太准 1/u);
  assert.match(html, /这十年对照你的经历/u);
  assert.match(html, />准<|>不太准</u);

  const readonly = renderIn("zh", createElement(LifeLuckPanel, {
    reading, currentDate: "2026-10-16", onReading: noop, readonly: true,
  }));
  assert.doesNotMatch(readonly, /这十年对照你的经历|细看这十年|kind=fortune/u);
});

test("当前与未来大运生成中英文细看链接，过去大运不生成", async () => {
  const helpers = await import("../web/lib/life-luck.js") as Record<string, unknown>;
  assert.equal(typeof helpers.cycleFortuneHref, "function");
  const href = helpers.cycleFortuneHref as (
    cycle: { startYear: number; endYear: number; index: number },
    currentIndex: number | null,
    t: ReturnType<typeof createT>,
  ) => string | null;
  const cycles = destiny.chart.luck!.cycles;
  assert.equal(href(cycles[2]!, 4, createT(zh)), null);
  assert.equal(href(cycles[3]!, 4, createT(zh)),
    "#/?kind=fortune&horizon=year&q=%E6%88%91%202020%E2%80%932029%20%E8%BF%99%E5%8D%81%E5%B9%B4"
      + "%E9%80%90%E5%B9%B4%E7%9A%84%E8%BF%90%E5%8A%BF%E5%A6%82%E4%BD%95%EF%BC%9F");
  assert.equal(href(cycles[4]!, 4, createT(en)),
    "#/?kind=fortune&horizon=year%3A2033&q=How%20will%20each%20year%20of%20"
      + "2030%E2%80%932039%20go%20for%20me%3F");
});

test("首页 hash 预填逐项校验，带参数的首页路由仍为首页", async () => {
  const home = await import("../web/lib/home-entry.js") as Record<string, unknown>;
  assert.equal(typeof home.prefillFromHash, "function");
  const prefill = home.prefillFromHash as (hash: string) => {
    question?: string; choice: { kind?: string; horizon?: string };
  } | null;
  assert.deepEqual(prefill("#/?kind=fortune&horizon=year%3A2038&q=How%20will%20this%20decade%20go%3F"), {
    question: "How will this decade go?", choice: { kind: "fortune", horizon: "year:2038" },
  });
  assert.deepEqual(prefill("#/?kind=bad&horizon=year%3A2100&q=abc"), null);
  assert.deepEqual(prefill("#/?kind=destiny&horizon=nope&q=%E6%88%91%E6%83%B3%E7%9C%8B%E4%B8%80%E7%94%9F"), {
    question: "我想看一生", choice: { kind: "destiny" },
  });
  const { route } = await import("../web/app.js");
  assert.deepEqual(route("#/?kind=fortune&horizon=year&q=abcd"), { page: "home" });
});

test("标题 hook 在 SSR 无 document 时安全，计时器副作用提供清理函数", async (t) => {
  const progress = await import("../web/lib/reading-progress.js").catch(() => null);
  if (!progress) assert.fail("应提供结果页进度 hook");
  const progressModule = progress;
  assert.equal(typeof progressModule.useReadingTitle, "function");
  assert.equal(typeof progressModule.useElapsedSeconds, "function");
  assert.equal(typeof progressModule.readingTitle, "function");
  assert.equal(progressModule.readingTitle(writingDestiny(1), createT(zh)), "（1/3）三易");
  assert.equal(progressModule.readingTitle(destiny, createT(en)), "✓ Result ready · Yarrow");
  function Probe() {
    progressModule.useReadingTitle(writingDestiny(1));
    progressModule.useElapsedSeconds("2026-10-16T00:00:00.000Z");
    return null;
  }
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(Probe)));

  const internals = (React as unknown as {
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
      ReactCurrentDispatcher: { current: unknown };
    };
  }).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const effects: Array<() => void | (() => void)> = [];
  const previous = internals.ReactCurrentDispatcher.current;
  internals.ReactCurrentDispatcher.current = {
    useState(initial: unknown) {
      return [typeof initial === "function" ? (initial as () => unknown)() : initial, () => {}];
    },
    useEffect(callback: () => void | (() => void)) { effects.push(callback); },
    useRef(initial: unknown) { return { current: initial }; },
  };
  try {
    progressModule.useElapsedSeconds("2026-10-16T00:00:00.000Z");
  } finally {
    internals.ReactCurrentDispatcher.current = previous;
  }
  const cleanups = effects.map((effect) => effect()).filter((value): value is () => void => (
    typeof value === "function"
  ));
  assert.equal(cleanups.length, 1);
  const clearInterval = t.mock.method(globalThis, "clearInterval");
  cleanups.forEach((cleanup) => cleanup());
  assert.equal(clearInterval.mock.callCount(), 1);
});

test("一生运势窄屏只留「当前」直标，最顺与最低标为宽屏才显示", async () => {
  const { readFileSync } = await import("node:fs");
  const reading = JSON.parse(readFileSync(new URL("../web/samples/destiny.zh.json", import.meta.url), "utf8"));
  const { LifeLuckPanel } = await import("../web/components/LifeLuckPanel.js");
  const html = renderIn("zh", createElement(LifeLuckPanel, { reading, currentDate: "2026-10-13", readonly: true }));
  assert.match(html, /<span class="wide-only">一生最顺 /u);
  assert.match(html, /<span>当前 /u);
});
