import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { publicBaziReading } from "../src/sanyi/bazi-public.js";
import { publicNamingReading } from "../src/sanyi/naming/public.js";
import type { StoredReading } from "../src/sanyi/store.js";
import { sourceHash } from "../src/sanyi/translation/service.js";
import type { StoredTranslation } from "../src/sanyi/translation/store.js";
import { extractUnits } from "../src/sanyi/translation/units.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { BaziReading } from "../web/pages/BaziReading.js";
import { NamingReading } from "../web/pages/NamingReading.js";
import { QuestionResult } from "../web/pages/Reading.js";
import { EnglishSummary } from "../web/components/EnglishReadingSections.js";
import { applyReadingTranslation } from "../web/lib/reading-translation.js";
import type { PublicReading } from "../web/lib/api.js";
import { renderIn } from "./helpers/render-in.js";
import { en } from "../web/i18n/en.js";
import { zh } from "../web/i18n/zh.js";
import { baziFixture, birth, proof } from "./helpers/bazi-service.js";
import { namingBirth, namingFixture, namingProof } from "./helpers/naming-service.js";
import { baseOutput, chart, LINES, TIME } from "./helpers/sample-question.js";

const noop = () => {};

test("结果页固定句式由中英字典提供", () => {
  const dictionaries = { en, zh } as Record<string, Record<string, string>>;
  for (const dictionary of Object.values(dictionaries)) {
    for (const key of [
      "bazi.yongShen", "bazi.section.character", "naming.analysis.element",
      "naming.analysis.missing", "wuxing.fallback.industry", "wuxing.generatingCycle",
    ]) {
      assert.equal(typeof dictionary[key], "string", `${key} must be in the dictionary`);
    }
  }
});

test("英文结果写作期显示三家分析与白话总结进度", () => {
  const base = {
    kind: "question", status: "writing", question: "Will I get this job?",
    schools: {
      chengyi: { status: "done" }, jingfang: { status: "writing" },
      shaoyong: { status: "pending" },
    },
  } as unknown as PublicReading;
  const schools = renderIn("en", createElement(EnglishSummary, { reading: base }));
  assert.match(schools, /Three classical schools are analyzing independently \(1\/3\)/u);
  const summary = renderIn("en", createElement(EnglishSummary, {
    reading: { ...base, summary: { status: "writing", basis: 3, retries: 0, attempts: 0 } },
  }));
  assert.match(summary, /Summarizing in plain language/u);
});

function completedTranslation(reading: StoredReading): StoredTranslation {
  return {
    lang: "en",
    units: Object.fromEntries(extractUnits(reading).map((unit) => [unit.key, {
      status: "done",
      sourceHash: sourceHash(unit),
      texts: unit.entries.map(({ path }, index) => `English ${path} ${index + 1}`),
      attempts: unit.entries.length > 0 ? 1 : 0,
      failures: 0,
    }])),
  };
}

function visibleEnglish(html: string): string {
  return html
    .replace(/<details[^>]*class="[^"]*traditional-chart[^"]*"[^>]*>[\s\S]*?<\/details>/gu, "")
    // 古文原文收在默认收起的「原文」折叠区，展开前不可见。
    .replace(/<details[^>]*class="[^"]*classic-originals[^"]*"[^>]*>[\s\S]*?<\/details>/gu, "");
}

function assertNoHan(html: string, allowed = ""): void {
  const withoutAllowed = [...allowed].reduce((text, char) => text.split(char).join(""), visibleEnglish(html));
  assert.deepEqual([...new Set(withoutAllowed.match(/[\p{Script=Han}]/gu) ?? [])], []);
  assert.doesNotMatch(html, /[ぁ-ヿ]|・|易者|押钱|赔付|封存|五格|天格|人格|地格|总格|外格/u);
}

test("问事结果页中英渲染：英文用术语与离线古文，隐藏 evidence", () => {
  const figures = deriveFiveHexagrams(LINES);
  const school = {
    status: "done" as const, retries: 0,
    output: {
      ...baseOutput,
      verdict: "吉" as const,
      headline: "A clear opening",
      reason: "Conditions are aligning.",
      sections: [{ title: "Focus", text: "Act with care." }],
      advice: ["Confirm the next step."],
      evidence: [{ ref: "line:1", claim: "绝不显示" }],
    },
  };
  const reading = {
    id: "abcdefghijklmnopqrstuvwxyz", kind: "question", createdAt: TIME.toString(), status: "done",
    question: "Will I get this job?", payment: { firstHash: `0x${"1".repeat(64)}` },
    throws: [], lines: LINES, chart,
    subject: { suggestedKey: "career", finalKey: "career", overridden: false, changes: 0 },
    schools: { chengyi: school, jingfang: school, shaoyong: school },
    summary: {
      status: "done", basis: 3, retries: 0,
      output: {
        conclusion: "The path is open, but timing matters.", agreement: "All three favor patience.",
        difference: "They weigh timing differently.", explanation: ["Prepare before committing."],
        remedy: { principle: "Stay steady.", plan: [], avoid: ["Do not rush."] },
      },
    },
  } as unknown as PublicReading;
  const en = renderIn("en", createElement(QuestionResult, { reading, onReading: noop }));
  assert.match(en, /Career &amp; status/u);
  assert.match(en, /Favorable · A clear opening/u);
  assert.match(en, /Translation by Yarrow/u);
  // 原文仍可查：收在默认收起的折叠区里。
  assert.match(en, new RegExp(`<details class="classic-originals"><summary>Show the original Chinese text</summary>[\\s\\S]*${figures.primary.judgement}`, "u"));
  assert.doesNotMatch(en, /<details class="classic-originals" open/u);
  assert.doesNotMatch(en, /绝不显示/u);
  assertNoHan(en);

  const zh = renderIn("zh", createElement(QuestionResult, { reading, onReading: noop }));
  assert.match(zh, /所问之事 · 工作／官职/u);
  assert.match(zh, /看三家依据/u);
});

test("八字结果页中英渲染：干支拼音、几成英文、专家盘折叠", async () => {
  const fixture = await baziFixture();
  try {
    const created = await fixture.bazi.create({
      kind: "fortune", question: "What does this year hold?", birth,
      sect: 1, horizon: "year", feeProof: proof(),
    });
    await fixture.bazi.whenSettled(created.id);
    const stored = await fixture.bazi.getReading(created.id);
    const publicReading = {
      ...publicBaziReading(stored), translation: completedTranslation(stored),
    };
    const reading = applyReadingTranslation(publicReading);
    const en = renderIn("en", createElement(BaziReading, { reading, birth: null, onReading: noop }));
    assert.match(en, /BaZi \(Four Pillars of Destiny\)/u);
    assert.match(en, /about \d in 10/u);
    assert.match(en, /Traditional chart \(Chinese\)/u);
    assert.doesNotMatch(en, /evidence/u);
    assertNoHan(en);

    const zh = renderIn("zh", createElement(BaziReading, { reading: publicBaziReading(stored), birth: null,
      onReading: noop }));
    assert.match(zh, /所问之事 · 运势/u);
    assert.match(zh, /数据来源：四柱、十神、藏干/u);
  } finally {
    await fixture.close();
  }
});

test("起名结果页中英渲染：保留姓名汉字，用结构化字段生成英文分析", async () => {
  const fixture = await namingFixture();
  try {
    const created = await fixture.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "A calm, literary name", birth: namingBirth, feeProof: namingProof(),
    });
    await fixture.naming.whenSettled(created.id);
    const stored = await fixture.naming.getReading(created.id);
    const publicReading = {
      ...publicNamingReading(stored), translation: completedTranslation(stored),
    };
    const reading = applyReadingTranslation(publicReading);
    const names = Object.values(reading.families).flatMap((family) => (
      family.output?.names.flatMap((name) => [...name.full]) ?? []
    )).join("");
    const en = renderIn("en", createElement(NamingReading, { reading, onReading: noop }));
    assert.match(en, /Five Elements analysis/u);
    assert.equal((en.match(/class="wuxing-track"/gu) ?? []).length, 5);
    assert.equal((en.match(/class="wuxing-fill"/gu) ?? []).length, 5);
    assert.match(en, /Character analysis/u);
    assert.match(en, /Wood|Fire|Earth|Metal|Water/u);
    assert.match(en, /radical|sound classification/u);
    assertNoHan(en, names);

    const writing = renderIn("en", createElement(NamingReading, {
      reading: { ...reading, status: "writing",
        summary: { status: "writing", basis: 3, retries: 0 } }, onReading: noop,
    }));
    assert.match(writing, /Summarizing in plain language/u);

    const zh = renderIn("zh", createElement(NamingReading, {
      reading: publicNamingReading(stored), onReading: noop,
    }));
    assert.match(zh, /三家合参/u);
    assert.match(zh, /五行分析/u);
  } finally {
    await fixture.close();
  }
});

test("原生英文命理、运势与起名直接渲染英文正文且不依赖 translation", async () => {
  const bazi = await baziFixture();
  const naming = await namingFixture();
  try {
    for (const [kind, index] of [["destiny", 71], ["fortune", 72]] as const) {
      const created = await bazi.bazi.create({
        kind, question: kind === "destiny" ? "Describe my life pattern" : "What is my outlook?",
        birth, sect: 1, horizon: "year", feeProof: proof(index), lang: "en",
      });
      await bazi.bazi.whenSettled(created.id);
      const reading = publicBaziReading(await bazi.bazi.getReading(created.id));
      assert.equal("translation" in reading, false);
      const html = renderIn("en", createElement(BaziReading, {
        reading, birth: null, onReading: noop,
      }));
      assert.match(html, /Yong Shen|Plain-language summary/u);
      assertNoHan(html);
    }

    const created = await naming.naming.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "A calm literary name", birth: namingBirth, feeProof: namingProof(73), lang: "en",
    });
    await naming.naming.whenSettled(created.id);
    const reading = publicNamingReading(await naming.naming.getReading(created.id));
    assert.equal("translation" in reading, false);
    const allowed = [reading.surname ?? "", ...Object.values(reading.families).flatMap((family) => (
      family.output?.names.flatMap((name) => [name.full, name.given,
        ...name.echoes.map((line) => line.text), name.source?.text ?? ""]) ?? []
    ))].join("");
    const html = renderIn("en", createElement(NamingReading, { reading, onReading: noop }));
    assert.match(html, /Five Elements analysis|Recommended names/u);
    assertNoHan(html, allowed);
  } finally {
    await Promise.all([bazi.close(), naming.close()]);
  }
});

test("中文正文已写完但译文未到时，四类英文解读区域只显示英文占位", async () => {
  const questionSchool = {
    status: "done" as const, retries: 0,
    output: { ...baseOutput, headline: "中文判断", reason: "中文理由",
      sections: [{ title: "重点", text: "中文正文" }], advice: ["中文建议"], evidence: [] },
  };
  const question = applyReadingTranslation({
    id: "abcdefghijklmnopqrstuvwxyz", kind: "question", createdAt: TIME.toString(), status: "done",
    question: "Will I get this job?", payment: { firstHash: `0x${"1".repeat(64)}` },
    throws: [], lines: LINES, chart,
    subject: { suggestedKey: "career", finalKey: "career", overridden: false, changes: 0 },
    schools: { chengyi: questionSchool, jingfang: questionSchool, shaoyong: questionSchool },
    summary: { status: "done", basis: 3, retries: 0, output: {
      conclusion: "中文结论", agreement: "中文共识", explanation: ["中文解释"],
      remedy: { principle: "中文心法", plan: [], avoid: ["中文禁忌"] },
    } },
    translation: { lang: "en", units: {} },
  } as never);
  const questionHtml = renderIn("en", createElement(QuestionResult, {
    reading: question as never, onReading: noop,
  }));
  assert.match(questionHtml, /Translating|Writing in English/u);
  assertNoHan(questionHtml);

  const bazi = await baziFixture();
  const naming = await namingFixture();
  try {
    const destinyCreated = await bazi.bazi.create({ kind: "destiny", question: "My destiny", birth,
      sect: 1, horizon: "year", feeProof: proof(91) });
    const fortuneCreated = await bazi.bazi.create({ kind: "fortune", question: "My fortune", birth,
      sect: 1, horizon: "year", feeProof: proof(92) });
    const namingCreated = await naming.naming.create({ target: "person", surname: "张", gender: "female",
      length: 2, unborn: false, question: "A calm name", birth: namingBirth, feeProof: namingProof(93) });
    await Promise.all([bazi.bazi.whenSettled(destinyCreated.id), bazi.bazi.whenSettled(fortuneCreated.id),
      naming.naming.whenSettled(namingCreated.id)]);
    for (const id of [destinyCreated.id, fortuneCreated.id]) {
      const stored = await bazi.bazi.getReading(id);
      const view = applyReadingTranslation({ ...publicBaziReading(stored),
        translation: { lang: "en", units: {} } } as never);
      const html = renderIn("en", createElement(BaziReading, { reading: view as never,
        birth: null, onReading: noop }));
      assert.match(html, /Translating|Writing in English/u);
      assertNoHan(html);
    }
    const storedNaming = await naming.naming.getReading(namingCreated.id);
    const namingView = applyReadingTranslation({ ...publicNamingReading(storedNaming),
      translation: { lang: "en", units: {} } } as never);
    const namingHtml = renderIn("en", createElement(NamingReading, {
      reading: namingView as never, onReading: noop,
    }));
    assert.match(namingHtml, /Translating|Writing in English/u);
    assertNoHan(namingHtml, storedNaming.surname ?? "");
  } finally {
    await Promise.all([bazi.close(), naming.close()]);
  }
});
