import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { DAY_MASTERS } from "../src/content/day-masters.js";
import {
  DayMasterFinderView,
  DayMasterResultCard,
  lookupDayMaster,
} from "../web/components/DayMasterFinder.js";
import { EMPTY_BIRTH, type BirthFormValues } from "../web/lib/birth-profile.js";
import { buildDayMasterShareCard, layoutShareCard } from "../web/lib/share-card.js";
import { renderIn } from "./helpers/render-in.js";

const filled: BirthFormValues = {
  ...EMPTY_BIRTH,
  year: "1990",
  month: "5",
  day: "15",
  time: "23:30",
  timeZone: "America/New_York",
  gender: "female",
};
const gui = DAY_MASTERS.find((item) => item.stem === "癸")!;
const han = /\p{Script=Han}/u;
const noop = () => {};

test("日主结果卡按当前语言显示短介绍、知识页和付费预填入口", () => {
  const zh = renderIn("zh", createElement(DayMasterResultCard, { profile: gui, onPaidEntry: noop }));
  assert.match(zh, /癸水/u);
  assert.match(zh, /阴/u);
  assert.ok(zh.includes(gui.zh.image));
  for (const keyword of gui.zh.keywords) assert.ok(zh.includes(keyword));
  assert.match(zh, /href="#\/\?kind=destiny"/u);
  assert.doesNotMatch(zh, /href="\/bazi\/day-master\/gui-water\/"/u);

  const en = renderIn("en", createElement(DayMasterResultCard, { profile: gui, onPaidEntry: noop }));
  assert.match(en, /Gui Water/u);
  assert.match(en, /Yin/u);
  assert.ok(en.includes(gui.en.image));
  assert.match(en, /href="\/bazi\/day-master\/gui-water\/"/u);
  assert.match(en, /href="#\/\?kind=destiny"/u);
  assert.doesNotMatch(en, han);
  const finder = readFileSync(new URL("../web/components/DayMasterFinder.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../web/components/QuestionForm.tsx", import.meta.url), "utf8");
  assert.match(finder, /onPaidEntry=\{saveCurrentBirth\}/u);
  assert.match(form, /observeHashPrefill[\s\S]*?loadBirthProfile\(\)[\s\S]*?setBirthValues/u);
});

test("日主卡片有中英文表单、查询中与就地错误状态", () => {
  const base = {
    values: filled, problem: null, result: null, onChange: noop, onSubmit: noop,
  };
  const zh = renderIn("zh", createElement(DayMasterFinderView, {
    ...base, busy: false, error: "生辰格式无效，请检查填写内容",
  }));
  assert.match(zh, /测测你的日主/u);
  assert.match(zh, /role="alert"/u);
  assert.match(zh, /生辰格式无效/u);
  const en = renderIn("en", createElement(DayMasterFinderView, {
    ...base, busy: true, error: "",
  }));
  assert.match(en, /Find your Day Master/u);
  assert.match(en, /Calculating/u);
  assert.doesNotMatch(en, han);
});

test("日主分享模型中英内容完整，不接受也不含生日资料", () => {
  const zh = buildDayMasterShareCard(gui, "zh");
  assert.equal(zh.title, "我的日主");
  assert.equal(zh.headline, "癸水");
  assert.ok(JSON.stringify(zh).includes(gui.zh.summary));

  const en = buildDayMasterShareCard(gui, "en");
  assert.equal(en.title, "My Day Master");
  assert.equal(en.headline, "Gui Water");
  const text = JSON.stringify(en);
  assert.doesNotMatch(text, han);
  assert.doesNotMatch(text, /1990|23:30|America\/New_York|birth(?:day| date| time)/iu);
  const layout = layoutShareCard(en, (value, size) => value.length * size * 0.56);
  assert.deepEqual([layout.width, layout.height], [1080, 1350]);
  const title = layout.blocks.find((block) => block.role === "title");
  const headline = layout.blocks.find((block) => block.role === "headline");
  assert.ok(title?.kind === "text" && headline?.kind === "text" && headline.size > title.size);
  const summary = layout.blocks.find((block) => block.role === "line-1");
  assert.ok(summary?.kind === "text");
  assert.equal(summary.lines.join(" "), gui.en.summary);
  assert.ok(summary.y + summary.height < 1222, "完整概述不得侵入页脚");

  for (const profile of DAY_MASTERS) {
    const profileLayout = layoutShareCard(
      buildDayMasterShareCard(profile, "en"),
      (value, size) => value.length * size * 0.56,
    );
    const profileSummary = profileLayout.blocks.find((block) => block.role === "line-1");
    assert.ok(profileSummary?.kind === "text");
    assert.equal(profileSummary.lines.join(" "), profile.en.summary);
    assert.ok(profileSummary.y + profileSummary.height < 1222, `${profile.slug} 概述不得侵入页脚`);
  }
});

test("日主查询只在成功后上报事件，事件不含生辰", async () => {
  const events: string[] = [];
  const profile = await lookupDayMaster({
    calendar: "solar", isLeapMonth: false, year: 1990, month: 5, day: 15,
    time: null, gender: "female", timeZone: "America/New_York",
  }, async () => ({ stem: "癸", element: "水", yinYang: "yin", slug: "gui-water" }),
  (event) => { events.push(event); });
  assert.equal(profile, gui);
  assert.deepEqual(events, ["day_master_lookup"]);
  assert.doesNotMatch(JSON.stringify(events), /1990|America|female/u);

  await assert.rejects(lookupDayMaster(filled as never, async () => {
    throw new Error("offline");
  }, (event) => { events.push(event); }));
  assert.deepEqual(events, ["day_master_lookup"]);
});

test("首页把日主卡放在今日一卦附近，390px 下切为单列且按钮可换行", () => {
  const home = readFileSync(new URL("../web/pages/Home.tsx", import.meta.url), "utf8");
  const daily = home.indexOf("<DailyHexagram");
  const finder = home.indexOf("<DayMasterFinder");
  const form = home.indexOf("<QuestionForm");
  assert.ok(daily >= 0 && finder > daily && form > finder);

  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.day-master-result[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(css, /\.day-master-actions[^}]*flex-wrap:\s*wrap/u);
});
