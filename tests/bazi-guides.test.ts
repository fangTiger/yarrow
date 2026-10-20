import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY_MASTER_GUIDES_EN,
  TEN_GOD_GUIDES_EN,
  validateBaziGuides,
} from "../src/content/bazi-guides.en.js";
import { DAY_MASTERS } from "../src/content/day-masters.js";
import { ELEMENTS_EN, STEMS_EN, TEN_GODS_EN } from "../src/sanyi/i18n/glossary.js";

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

test("八字英文导读条数、术语、字数、汉字与禁用词均通过校验", () => {
  assert.equal(DAY_MASTER_GUIDES_EN.length, 10);
  assert.equal(TEN_GOD_GUIDES_EN.length, 10);
  assert.deepEqual(validateBaziGuides(DAY_MASTER_GUIDES_EN, TEN_GOD_GUIDES_EN), []);

  for (const guide of DAY_MASTER_GUIDES_EN) {
    const profile = DAY_MASTERS.find((item) => item.stem === guide.stem);
    assert.ok(profile);
    assert.equal(guide.name, `${STEMS_EN[guide.stem]} ${ELEMENTS_EN[guide.element]}`);
    assert.equal(guide.slug, profile.slug);
    assert.ok(wordCount(guide.guide) >= 120 && wordCount(guide.guide) <= 180);
    assert.doesNotMatch([guide.guide, ...guide.points].join(" "), /\p{Script=Han}/u);
  }

  const expectedTenGodNames = Object.entries(TEN_GODS_EN)
    .filter(([key]) => key !== "日主").map(([, name]) => name).sort();
  assert.deepEqual(TEN_GOD_GUIDES_EN.map((item) => item.name).sort(), expectedTenGodNames);
  for (const guide of TEN_GOD_GUIDES_EN) {
    assert.ok(wordCount(guide.guide) >= 100 && wordCount(guide.guide) <= 160);
    assert.doesNotMatch([guide.guide, ...guide.points].join(" "), /\p{Script=Han}/u);
    assert.match(guide.relation, /^(Same element|Produced by the Day Master|Controlled by the Day Master|Controls the Day Master|Produces the Day Master)/u);
  }
});

test("八字导读校验会报告缺项、错误术语、字数、汉字与禁用词", () => {
  const badDayMasters = DAY_MASTER_GUIDES_EN.slice(0, 9).map((item, index) => index === 0 ? {
    ...item, name: "Wrong name", guide: "too short 改运 improve your luck",
  } : item);
  const badTenGods = TEN_GOD_GUIDES_EN.map((item, index) => index === 0 ? {
    ...item, name: "Wrong god", guide: "too short 改运 improve your luck",
  } : item);
  const errors = validateBaziGuides(badDayMasters, badTenGods);
  for (const marker of ["10 条日主", "名称", "120–180", "100–160", "汉字", "禁用词"]) {
    assert.ok(errors.some((error) => error.includes(marker)), `缺少校验错误：${marker}`);
  }
});
