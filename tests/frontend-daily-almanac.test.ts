import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import lunarPkg from "lunar-javascript";
import { almanacAt } from "../src/calendar/almanac.js";
import { DailyAlmanac, buildDailyAlmanacView } from "../web/components/DailyAlmanac.js";
import {
  ALMANAC_ACTIVITY_EN,
  DAY_DEITY_EN,
  DIRECTION_EN,
  LUNAR_MONTH_EN,
  MANSION_EN,
  NINE_STAR_EN,
  OFFICER_EN,
  PATH_EN,
  SOLAR_TERM_EN,
  ZODIAC_EN,
} from "../web/lib/almanac-en.js";
import { renderIn } from "./helpers/render-in.js";

const NOW = almanacAt(BigInt(Date.parse("2026-10-16T12:00:00+08:00") / 1_000));
const han = /[\p{Script=Han}]/u;

function rendered(lang: "zh" | "en", data: typeof NOW | null = NOW): string {
  return renderIn(lang, createElement(DailyAlmanac, { data }));
}

test("中文卡片显示设计指定信息，宜忌各最多八项", () => {
  const html = rendered("zh");
  assert.match(html, /<section[^>]*aria-labelledby="[^"]+"/u);
  assert.match(html, /<h2[^>]*>今日黄历<\/h2>/u);
  assert.match(html, /今日黄历/u);
  assert.match(html, /2026年10月16日/u);
  assert.match(html, /农历二〇二六年九月初七/u);
  assert.match(html, /癸亥日/u);
  assert.match(html, /寒露/u);
  assert.match(html, /除日 · 玉堂（黄道）/u);
  assert.match(html, /冲（丁巳）蛇 · 煞西/u);
  assert.match(html, /喜神东南 · 财神正南 · 福神东北/u);
  assert.equal((html.match(/class="daily-almanac-chip good"/gu) ?? []).length, 8);
  assert.equal((html.match(/class="daily-almanac-chip bad"/gu) ?? []).length, 8);
});

test("英文卡片翻译全部可见信息且不出现汉字", () => {
  const html = rendered("en");
  assert.match(html, /Today/u);
  assert.match(html, /October 16, 2026/u);
  assert.match(html, /Ninth lunar month · day 7 · 2026/u);
  assert.match(html, /Gui Hai day/u);
  assert.match(html, /Cold Dew/u);
  assert.match(html, /Remove · Jade Hall \(Yellow Path\)/u);
  assert.match(html, /Offerings/u);
  assert.match(html, /Weddings/u);
  assert.match(html, /Snake \(Ding Si\) · West/u);
  assert.match(html, /Joy: Southeast · Wealth: South · Fortune: Northeast/u);
  assert.doesNotMatch(html, /雀入大水为蛤|癸不词讼/u);
  assert.doesNotMatch(html, han);
});

test("英文宜忌表逐条覆盖 lunar-javascript 的 LunarUtil.YI_JI 全集", () => {
  const terms = (lunarPkg.LunarUtil as unknown as { YI_JI: string[] }).YI_JI;
  assert.equal(terms.length, 142);
  assert.deepEqual(Object.keys(ALMANAC_ACTIVITY_EN).sort(), [...terms].sort());
  for (const term of terms) {
    const translation = ALMANAC_ACTIVITY_EN[term];
    if (!translation?.trim()) assert.fail(`宜忌缺少英译：${term}`);
    assert.doesNotMatch(translation, han, `宜忌英译残留汉字：${term}`);
  }
});

test("英文黄历静态术语表覆盖设计要求，二十八宿格式统一", () => {
  assert.equal(Object.keys(OFFICER_EN).length, 12);
  assert.equal(Object.keys(DAY_DEITY_EN).length, 12);
  assert.equal(Object.keys(PATH_EN).length, 2);
  assert.equal(Object.keys(MANSION_EN).length, 28);
  assert.equal(Object.keys(NINE_STAR_EN).length, 9);
  assert.ok(Object.keys(DIRECTION_EN).length >= 9);
  assert.equal(Object.keys(ZODIAC_EN).length, 12);
  assert.equal(Object.keys(SOLAR_TERM_EN).length, 24);
  assert.equal(Object.keys(LUNAR_MONTH_EN).length, 12);
  assert.equal(MANSION_EN["亢金龙"], "Kang (Neck) · Metal Dragon");
  for (const translation of Object.values(MANSION_EN)) {
    assert.match(translation, /^[A-Za-zÜü]+ \([^)]+\) · [A-Za-z -]+$/u);
    assert.doesNotMatch(translation, han);
  }
});

test("英文遇到未知宜忌时跳过，不把原文带进页面", () => {
  const view = buildDailyAlmanacView({
    ...NOW,
    almanac: { ...NOW.almanac, suitable: ["祭祀", "不存在事项"], avoid: ["嫁娶", "未知禁忌"] },
  }, "en");
  assert.deepEqual(view.suitable, ["Offerings"]);
  assert.deepEqual(view.avoid, ["Weddings"]);
  assert.doesNotMatch(JSON.stringify(view), /不存在事项|未知禁忌/u);
});

test("窄屏摘要包含日期和前三项宜，按钮可切换展开状态", () => {
  const collapsed = rendered("zh");
  assert.match(collapsed, /class="daily-almanac-summary"/u);
  assert.match(collapsed, /aria-expanded="false"/u);
  assert.match(collapsed, /2026年10月16日 · 宜 祭祀、开光、出行/u);
  const expanded = renderIn("zh", createElement(DailyAlmanac, { data: NOW, defaultExpanded: true }));
  assert.match(expanded, /class="daily-almanac is-expanded"/u);
  assert.match(expanded, /aria-expanded="true"/u);

  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  const marker = css.indexOf("/* 今日黄历");
  assert.ok(marker >= 0);
  const block = css.slice(marker);
  assert.match(block, /@media\s*\(max-width:\s*620px\)/u);
  assert.match(block, /\.daily-almanac:not\(\.is-expanded\)\s+\.daily-almanac-body[^}]*display:\s*none/u);
});

test("运势入口按当前语言预填 fortune、today 与问题", () => {
  const zh = rendered("zh").replaceAll("&amp;", "&");
  const en = rendered("en").replaceAll("&amp;", "&");
  assert.ok(zh.includes("#/?kind=fortune&horizon=today&q="));
  assert.ok(zh.includes(encodeURIComponent("我今天的运势如何？")));
  assert.ok(en.includes("#/?kind=fortune&horizon=today&q="));
  assert.ok(en.includes(encodeURIComponent("How will today go for me?")));
});

test("接口失败状态不渲染卡片，首页只在说明区之后和表单之前插入入口", () => {
  assert.equal(rendered("zh", null), "");
  const source = readFileSync(new URL("../web/pages/Home.tsx", import.meta.url), "utf8");
  const description = source.indexOf("home-description");
  const daily = source.indexOf("<DailyAlmanac");
  const form = source.indexOf("<QuestionForm");
  assert.ok(description >= 0 && daily > description && form > daily);
  for (const unchanged of ["<Luopan home", "home-steps", "<QuestionForm", "HistoryMenu", "WalletBar"]) {
    assert.ok(source.includes(unchanged), `首页既有内容缺失：${unchanged}`);
  }
});

test("接口拒绝时加载器返回空终态", async () => {
  const dailyModule = await import("../web/components/DailyAlmanac.js");
  const load = (dailyModule as unknown as {
    loadDailyAlmanac?: (loader: () => Promise<typeof NOW>) => Promise<typeof NOW | null>;
  }).loadDailyAlmanac;
  assert.equal(typeof load, "function");
  assert.equal(await load!(() => Promise.reject(new Error("接口不可用"))), null);
});

test("首页内点击运势入口后，hashchange 把问题、类型与 today 应用到表单", async () => {
  const formModule = await import("../web/components/QuestionForm.js");
  type Prefill = { question?: string; choice: { kind?: string; horizon?: string } };
  type Navigation = {
    window: {
      addEventListener(type: "hashchange", listener: () => void): void;
      removeEventListener(type: "hashchange", listener: () => void): void;
    };
    location: { hash: string; pathname: string; search: string };
    history: { state: unknown; replaceState(state: unknown, unused: string, url: string): void };
  };
  const observe = (formModule as unknown as {
    observeHashPrefill?: (apply: (value: Prefill) => void, navigation: Navigation) => () => void;
  }).observeHashPrefill;
  assert.equal(typeof observe, "function");

  let listener: (() => void) | undefined;
  let removed = false;
  let applied: Prefill | undefined;
  let replaced = "";
  const location = { hash: "#/", pathname: "/", search: "" };
  const navigation: Navigation = {
    window: {
      addEventListener: (_type, next) => { listener = next; },
      removeEventListener: (_type, current) => { removed = current === listener; },
    },
    location,
    history: {
      state: null,
      replaceState: (_state, _unused, url) => { replaced = url; },
    },
  };
  const stop = observe!((value) => { applied = value; }, navigation);
  location.hash = buildDailyAlmanacView(NOW, "zh").href;
  listener!();
  assert.deepEqual(applied, {
    question: "我今天的运势如何？",
    choice: { kind: "fortune", horizon: "today" },
  });
  assert.equal(replaced, "/#/");
  stop();
  assert.equal(removed, true);
});
