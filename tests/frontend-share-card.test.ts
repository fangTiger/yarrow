import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EnglishSummary } from "../web/components/EnglishReadingSections.js";
import { PlainSummaryPanel } from "../web/components/PlainSummaryPanel.js";
import { ShareCard } from "../web/components/ShareCard.js";
import type { AnyPublicReading } from "../web/lib/api.js";
import { enT, zhT } from "../web/lib/i18n.js";
import { stemBranchEn } from "../web/lib/result-format.js";
import { localizedSampleReading } from "../web/pages/SampleReading.js";
import {
  buildShareCard, layoutShareCard, wrapText, type ShareCardModel,
} from "../web/lib/share-card.js";
import { renderIn } from "./helpers/render-in.js";

function sample(stem: string): AnyPublicReading {
  return JSON.parse(readFileSync(
    new URL(`../web/samples/${stem}.json`, import.meta.url), "utf8",
  )) as AnyPublicReading;
}

function englishSample(stem: string): AnyPublicReading {
  return localizedSampleReading(sample(`${stem}.en`), "en");
}

function modelText(model: ShareCardModel): string {
  return JSON.stringify(model);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

test("命理分享模型含画像与八段年龄走势，且不泄露年份、干支或生辰", () => {
  for (const [lang, reading, t] of [
    ["zh", sample("destiny.zh"), zhT],
    ["en", englishSample("destiny"), enT],
  ] as const) {
    assert.equal(reading.kind, "destiny");
    const model = buildShareCard(reading, lang, t, { sample: true });
    assert.equal(model.kind, "destiny");
    assert.equal(model.question, undefined);
    assert.ok(model.headline.length > 0);
    assert.ok(model.lines.length >= 2);
    assert.ok(model.chips && model.chips.length >= 3);
    assert.equal(model.chart?.kind, "trend");
    if (model.chart?.kind !== "trend") assert.fail("命理卡应使用走势模型");
    assert.equal(model.chart.points.length, 8);
    assert.ok(model.chart.points.every((point) => /岁|ages/iu.test(point.label)));
    assert.match(model.footer, /yarrow-six\.vercel\.app/u);
    assert.ok(model.footer.includes(t("share.sample")));

    const text = modelText(model);
    for (const cycle of reading.chart.luck?.cycles ?? []) {
      assert.ok(!text.includes(cycle.ganZhi), `${lang} 不应含大运干支 ${cycle.ganZhi}`);
      assert.ok(!text.includes(String(cycle.startYear)), `${lang} 不应含年份 ${cycle.startYear}`);
      assert.ok(!text.includes(String(cycle.endYear)), `${lang} 不应含年份 ${cycle.endYear}`);
    }
    assert.ok(!text.includes(reading.chart.luck?.start.solarDate ?? "__missing__"));
    assert.doesNotMatch(text, /四柱|Four Pillars|生辰/iu);
  }
});

test("问事分享模型含本卦、之卦、六爻动爻与三家判断，但不含付款哈希", () => {
  for (const [lang, reading, t] of [
    ["zh", sample("question.zh"), zhT],
    ["en", englishSample("question"), enT],
  ] as const) {
    assert.equal(reading.kind, "question");
    const model = buildShareCard(reading, lang, t);
    assert.equal(model.kind, "question");
    assert.equal(model.question, reading.question);
    assert.equal(model.lines.length, 3);
    assert.equal(model.chart?.kind, "hexagram");
    if (model.chart?.kind !== "hexagram") assert.fail("问事卡应使用卦画模型");
    assert.equal(model.chart.primary.lines.length, 6);
    assert.equal(model.chart.changed.lines.length, 6);
    assert.deepEqual(model.chart.moving, reading.lines?.flatMap(
      (value, index) => value === 6 || value === 9 ? [index + 1] : [],
    ));
    assert.ok(model.chart.primary.name.length > 0);
    assert.ok(model.chart.changed.name.length > 0);
    assert.match(model.footer, /yarrow-six\.vercel\.app/u);
    assert.ok(!modelText(model).includes(reading.payment.firstHash));
  }
});

test("运势分享模型含所问、结论、十年逐年走势与走势概括", () => {
  for (const [lang, reading, t] of [
    ["zh", sample("fortune.zh"), zhT],
    ["en", englishSample("fortune"), enT],
  ] as const) {
    assert.equal(reading.kind, "fortune");
    const model = buildShareCard(reading, lang, t);
    assert.equal(model.kind, "fortune");
    assert.equal(model.question, reading.question);
    assert.ok(model.headline.length > 0);
    assert.ok(model.lines.length > 0);
    assert.equal(model.chart?.kind, "trend");
    if (model.chart?.kind !== "trend") assert.fail("运势卡应使用走势模型");
    assert.equal(model.chart.points.length, 10);
    assert.deepEqual(model.chart.points.map((point) => point.label),
      reading.years.map((year) => String(year?.year)));
    assert.match(model.footer, /yarrow-six\.vercel\.app/u);
  }
});

test("英文卡除所问原文外不含汉字", () => {
  for (const stem of ["destiny", "question", "fortune"] as const) {
    for (const reading of [englishSample(stem), sample(`${stem}.en`)]) {
      const model = buildShareCard(reading as never, "en", enT);
      const withoutQuestion = modelText(model).split(reading.question).join("");
      assert.doesNotMatch(withoutQuestion, /\p{Script=Han}/u, stem);
      assert.notEqual(model.headline, enT("share.translationPending"));
      if (model.kind === "destiny") assert.ok(model.chips && model.chips.length >= 3);
    }
  }
  const originalQuestion = clone(sample("question.en"));
  assert.equal(originalQuestion.kind, "question");
  originalQuestion.question = "这件事能成吗？";
  assert.equal(buildShareCard(originalQuestion, "en", enT).question, originalQuestion.question);
});

test("自由文本即使夹带命盘、年份、生辰或付款哈希也不会进入卡片", () => {
  const destiny = clone(sample("destiny.zh"));
  assert.equal(destiny.kind, "destiny");
  const cycle = destiny.chart.luck!.cycles[0]!;
  destiny.summary!.output!.conclusion = [
    `四柱与生辰显示 ${cycle.ganZhi}`, `${cycle.startYear} 年转运`,
  ].join("，");
  destiny.summary!.output!.outlook = `出生日期见 ${destiny.chart.luck!.start.solarDate}`;
  destiny.summary!.output!.portrait!.summary = `大运干支 ${cycle.ganZhi}`;
  destiny.summary!.output!.portrait!.traits = [
    `${cycle.startYear} 年`, cycle.ganZhi, stemBranchEn(cycle.ganZhi), "生日", "沉稳",
  ];
  const destinyText = modelText(buildShareCard(destiny, "zh", zhT));
  for (const forbidden of ["四柱", "生辰", "生日", "大运干支", cycle.ganZhi,
    stemBranchEn(cycle.ganZhi), String(cycle.startYear), destiny.chart.luck!.start.solarDate]) {
    assert.ok(!destinyText.includes(forbidden), forbidden);
  }

  const fortune = clone(sample("fortune.zh"));
  assert.equal(fortune.kind, "fortune");
  const pillar = fortune.chart.pillars.year!.ganZhi;
  fortune.question = "我出生于 1990-01-01，今年如何？";
  fortune.summary!.output!.conclusion = `Four Pillars: ${stemBranchEn(pillar)}; DOB 1990-01-01`;
  fortune.summary!.output!.outlook = `Si Zhu / Ba Zi / date of birth; ${pillar}`;
  const fortuneText = modelText(buildShareCard(fortune, "zh", zhT));
  assert.ok(!fortuneText.includes(pillar));
  assert.doesNotMatch(fortuneText, /Four Pillars|DOB|Si Zhu|Ba Zi|date of birth|1990-01-01/iu);

  const question = clone(sample("question.zh"));
  assert.equal(question.kind, "question");
  question.question = `这笔付款 ${question.payment.firstHash} 能退吗？`;
  question.summary!.output!.conclusion = `结论参考 ${question.payment.firstHash.toUpperCase()}`;
  assert.ok(!modelText(buildShareCard(question, "zh", zhT)).includes(question.payment.firstHash));
  assert.ok(!modelText(buildShareCard(question, "zh", zhT))
    .includes(question.payment.firstHash.toUpperCase()));
});

test("英文正文未翻译完整时不生成残缺卡片", () => {
  const reading = clone(sample("question.en"));
  assert.equal(reading.kind, "question");
  delete reading.translation;
  assert.throws(() => buildShareCard(reading, "en", enT), /英文译文/u);
  assert.equal(renderIn("en", createElement(ShareCard, { reading })), "");
});

test("仅两家完成时第三家明确标为未落笔，仍保留三行判断", () => {
  const reading = clone(sample("question.zh"));
  assert.equal(reading.kind, "question");
  reading.schools.jingfang = { status: "failed", retries: 0 };
  reading.summary!.basis = 2;
  const model = buildShareCard(reading, "zh", zhT);
  assert.equal(model.lines.length, 3);
  assert.match(model.lines[1]!, /京房 · 未落笔/u);
});

test("wrapText 中文逐字、英文按词分行，超过上限以省略号收尾", () => {
  const measure = (text: string) => text.length * 10;
  assert.deepEqual(wrapText("甲乙丙丁戊", 20, measure, 4), ["甲乙", "丙丁", "戊"]);
  assert.deepEqual(wrapText("one two three four", 90, measure, 4), ["one two", "three", "four"]);
  assert.deepEqual(wrapText("甲乙丙丁戊己", 20, measure, 2), ["甲乙", "丙…"]);
  assert.deepEqual(wrapText("one two three four", 90, measure, 2), ["one two", "three…"]);
  const longWord = wrapText("supercalifragilisticexpialidocious", 80, measure, 2);
  assert.ok(longWord.every((line) => measure(line) <= 80));
  assert.ok(longWord.at(-1)?.endsWith("…"));
});

test("layoutShareCard 在纯函数中完成 1080×1350 布局并约束所有区块", () => {
  const reading = sample("question.zh");
  assert.equal(reading.kind, "question");
  const layout = layoutShareCard(buildShareCard(reading, "zh", zhT), (text, size) => (
    text.length * size
  ));
  assert.deepEqual({ width: layout.width, height: layout.height }, { width: 1080, height: 1350 });
  assert.ok(layout.blocks.length > 8);
  assert.ok(layout.blocks.every((block) => block.x >= 0 && block.y >= 0));
  assert.ok(layout.blocks.every((block) => block.x + block.width <= layout.width));
  assert.ok(layout.blocks.every((block) => block.y + block.height <= layout.height));
  for (const text of layout.blocks.filter((block) => block.kind === "text")) {
    assert.equal(text.lineYs.length, text.lines.length);
  }
  const seal = layout.blocks.find((block) => block.kind === "seal");
  assert.ok(seal?.kind === "seal");
  assert.ok(seal.inset.x > seal.x && seal.inset.x + seal.inset.width < seal.x + seal.width);
  const hexagram = layout.blocks.find((block) => block.kind === "hexagram");
  assert.ok(hexagram?.kind === "hexagram");
  assert.equal(hexagram.figures.flatMap((figure) => figure.lines).length, 12);
  assert.equal(hexagram.figures[0]!.lines.filter((line) => line.movingDot).length,
    reading.lines!.filter((line) => line === 6 || line === 9).length);

  const destiny = sample("destiny.zh");
  assert.equal(destiny.kind, "destiny");
  const destinyLayout = layoutShareCard(buildShareCard(destiny, "zh", zhT), (text, size) => (
    text.length * size
  ));
  const trend = destinyLayout.blocks.find((block) => block.kind === "trend");
  assert.ok(trend?.kind === "trend");
  assert.equal(trend.points.length, 8);
  assert.ok(trend.points.every((point) => point.x >= trend.x && point.x <= trend.x + trend.width));
  const chips = destinyLayout.blocks.find((block) => block.kind === "chips");
  assert.ok(chips?.kind === "chips");
  assert.ok(chips.items.every((item) => item.x + item.width <= chips.x + chips.width));
  assert.ok(chips.items.every((item) => item.textX >= item.x && item.textY >= item.y));
});

test("分享按钮只在白话总述完成后出现，中英文入口一致", () => {
  const complete = sample("question.zh");
  assert.equal(complete.kind, "question");
  const pending = { ...complete, summary: { status: "writing", basis: 3, retries: 0 } } as never;
  const zhDone = renderIn("zh", createElement(PlainSummaryPanel, {
    reading: complete, onReading: () => {}, readonly: true,
  }));
  const zhPending = renderIn("zh", createElement(PlainSummaryPanel, {
    reading: pending, onReading: () => {}, readonly: true,
  }));
  assert.match(zhDone, />生成分享图<\/button>/u);
  assert.doesNotMatch(zhPending, /生成分享图/u);

  const enReading = englishSample("question");
  assert.equal(enReading.kind, "question");
  const enDone = renderIn("en", createElement(EnglishSummary, {
    reading: enReading, readonly: true,
  }));
  const enPending = renderIn("en", createElement(EnglishSummary, {
    reading: { ...enReading, summary: { status: "writing", basis: 3, retries: 0 } } as never,
    readonly: true,
  }));
  assert.match(enDone, />Share image<\/button>/u);
  assert.doesNotMatch(enPending, /Share image/u);
});

test("ShareCard 自身拒绝未完成总述，示例入口保留标记语义", () => {
  const reading = sample("fortune.zh");
  assert.equal(reading.kind, "fortune");
  const pending = { ...reading, summary: { status: "failed", basis: 2, retries: 0 } } as never;
  assert.equal(renderToStaticMarkup(createElement(ShareCard, { reading: pending })), "");
  const html = renderIn("zh", createElement(ShareCard, { reading, sample: true }));
  assert.match(html, /data-sample="true"/u);
  assert.match(html, />生成分享图<\/button>/u);
});

test("中文分行时收尾标点不落在行首，挪到上一行末尾", () => {
  const measure = (text: string) => [...text].length * 10;
  const lines = wrapText("甲乙，丙丁。戊", 20, measure, 5);
  assert.ok(lines.slice(1).every((line) => !/^[，。、；：！？）」』”,.;:!?)]/u.test(line)), lines.join("|"));
  assert.equal(lines.join(""), "甲乙，丙丁。戊");
});

test("内容多时自动收紧：中英文三类卡片的正文都不压到卡尾分隔线", () => {
  // 近似真实字宽：汉字一个字号宽，拉丁字母约半个字号宽。
  const measure = (text: string, size: number) => [...text]
    .reduce((sum, char) => sum + (/[　-鿿＀-￯]/u.test(char) ? size : size * 0.52), 0);
  for (const file of ["destiny.zh", "destiny.en", "fortune.zh", "fortune.en", "question.zh", "question.en"]) {
    const lang = file.endsWith(".en") ? "en" : "zh";
    const reading = lang === "en" ? englishSample(file.split(".")[0] as never) : sample(file);
    const model = buildShareCard(reading as Parameters<typeof buildShareCard>[0], lang,
      lang === "en" ? enT : zhT);
    const layout = layoutShareCard(model, measure);
    const footerRule = layout.blocks.find((block) => block.role === "footer-rule")!;
    for (const block of layout.blocks) {
      if (block.role === "footer" || block.role === "footer-rule" || block.kind === "frame") continue;
      assert.ok(block.y + block.height <= footerRule.y, `${file} ${block.role} 压到卡尾`);
    }
    const trend = layout.blocks.find((block) => block.kind === "trend");
    if (trend?.kind === "trend") {
      assert.ok(trend.points[0]!.x >= trend.x + 40, `${file} 走势首点贴边`);
      assert.ok(trend.points.at(-1)!.x <= trend.x + trend.width - 40, `${file} 走势末点贴边`);
    }
  }
});
