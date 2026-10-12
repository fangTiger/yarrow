import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicNamingReading } from "../src/sanyi/naming/public.js";
import { NameCard } from "../web/components/NameCard.js";
import { WuxingPanel } from "../web/components/WuxingPanel.js";
import { NamingReading } from "../web/pages/NamingReading.js";
import { shouldPollReading } from "../web/lib/reading-state.js";

const noop = () => {};
const pronunciations: Record<string, string> = {
  张: "zhāng", 明: "míng", 泽: "zé", 河: "hé", 洲: "zhōu", 思: "sī", 远: "yuǎn",
};

function visibleName(given: string, source = false) {
  const chars = [...given].map((char, index) => ({
    char,
    pinyin: pronunciations[char] ?? "yún",
    tone: 2 as const,
    wuxing: index === 0 ? "火" as const : "水" as const,
    wuxingBasis: index === 0 ? "部首·日" : "部首·水",
    kangxi: index === 0 ? 8 : 17,
    meaning: index === 0 ? "光明清朗" : "恩泽润养",
    sense: index === 0 ? "用作名字意指明朗通达" : "用作名字意指温润仁厚",
    level: index === 1 && given === "思远" ? 3 as const : 1 as const,
    polyphonic: false,
  }));
  return {
    given,
    full: `张${given}`,
    pinyin: [...`张${given}`].map((char) => pronunciations[char] ?? "yún").join(" "),
    meaning: `${given}寓意清朗安宁`,
    why: `${given}读来舒展，字义相映`,
    chars,
    surnameChars: [{
      char: "张", pinyin: "zhāng", tone: 1 as const, wuxing: "金" as const,
      wuxingBasis: "读音·齿音", kangxi: 11, meaning: "把弦安在弓上；开弓；拉弓弦", level: 1 as const,
      polyphonic: false,
    }],
    scores: { overall: 91, sound: 92, form: 90, wuxing: 95, poetry: 88 },
    supplements: [{ element: "火" as const, chars: [given[0]!] }],
    analysis: chars.map(({ char, wuxing }) => `「${char}」五行属${wuxing}，合所补之${wuxing}。`),
    echoes: [{ id: "sj-0001-01", book: "诗经", title: "篇目", text: `清和${given}` }],
    tags: ["温和", "好学", "明朗"],
    hints: given === "思远" ? ["名字首字与姓同声母，连读可能拗口"] : [],
    ...(source ? {
      sourceId: "S01",
      source: { book: "诗经", title: "周南·关雎", text: "关关雎鸠，在河之洲" },
    } : {}),
  };
}

function family(key: "wuxing" | "shiwen" | "yinyi", names: string[]) {
  return {
    status: "done" as const,
    retries: 0,
    removed: 0,
    output: {
      note: `${key}本家取名思路`,
      names: names.map((name, index) => visibleName(name, key === "shiwen" && index === 0)),
    },
  };
}

const baseReading = {
  id: "abcdefghijklmnopqrstuvwxyz",
  kind: "naming" as const,
  createdAt: "2026-10-09T12:00:00.000Z",
  target: "person" as const,
  question: "温和有书卷气",
  surname: "张",
  gender: "female" as const,
  length: 2 as const,
  unborn: false,
  status: "done" as const,
  payment: { firstHash: `0x${"11".repeat(32)}` },
  basis: {
    pillars: { year: "庚午", month: "辛巳", day: "庚辰", time: "甲申" },
    elements: [
      { element: "木", stem: 1, main: 0, middle: 0, residual: 0, total: 1 },
      { element: "火", stem: 1, main: 1, middle: 0, residual: 0, total: 2 },
      { element: "土", stem: 0, main: 1, middle: 1, residual: 0, total: 2 },
      { element: "金", stem: 1, main: 1, middle: 0, residual: 0, total: 2 },
      { element: "水", stem: 0, main: 1, middle: 0, residual: 0, total: 1 },
    ],
    tiaohou: {
      monthBranch: "巳", monthName: "四月", dayStem: "庚", useStems: ["壬", "丙"],
      section: "三夏庚金", quote: "壬丙为用。",
    },
    favorable: ["金", "木"],
    favorableSource: "missing" as const,
    favorableNote: "八字缺金，宜补金；调候喜木，兼补木",
    counts: { 木: 1, 火: 2, 土: 2, 金: 0, 水: 1 },
    missing: ["金"],
    hiddenCounts: { 木: 1, 火: 2, 土: 2, 金: 2, 水: 1 },
    unborn: false,
  },
  families: {
    wuxing: family("wuxing", ["明泽", "清安", "嘉宁"]),
    shiwen: family("shiwen", ["河洲", "云舒", "景行"]),
    yinyi: family("yinyi", ["思远", "知夏", "言蹊"]),
  },
  summary: {
    status: "done" as const,
    basis: 3,
    retries: 0,
    removed: 0,
    output: {
      picks: [
        { given: "明泽", full: "张明泽", pinyin: "zhāng míng zé", family: "五行补益", reason: "水火相济",
          scores: { overall: 91 }, supplements: [{ element: "火", chars: ["明"] }] },
        { given: "河洲", full: "张河洲", pinyin: "zhāng hé zhōu", family: "诗文出处", reason: "出处清楚",
          scores: { overall: 92 }, supplements: [{ element: "水", chars: ["河", "洲"] }] },
      ],
      overview: "三家都重视明朗字义，各自侧重五行、出处与音律。",
      tips: ["念出全名听听是否顺口", "问问家人方言里有无不雅谐音", "上户口前查一查重名"],
    },
  },
} as unknown as PublicNamingReading;

test("人名结果页依次展示所问、三家合参、三家九张名字卡、依据与说明", () => {
  const html = renderToStaticMarkup(createElement(NamingReading, { reading: baseReading, onReading: noop }));
  assert.match(html, /起名 · 人名（张姓 · 双名 · 女）/u);
  assert.match(html, /温和有书卷气/u);
  assert.ok(html.indexOf("五行分析") > html.indexOf("所问"));
  assert.ok(html.indexOf("五行分析") < html.indexOf("三家合参"));
  assert.match(html, /三家合参/u);
  assert.match(html, /张明泽/u);
  assert.match(html, /水火相济/u);
  assert.match(html, /三家都重视明朗字义/u);
  assert.match(html, /念出全名听听是否顺口/u);
  for (const text of ["五行补益", "诗文出处", "音形字义", ">五<", ">诗<", ">音<"]) {
    assert.match(html, new RegExp(text, "u"));
  }
  assert.equal((html.match(/class="name-card"/gu) ?? []).length, 9);
  assert.match(html, /起名依据/u);
  assert.match(html, /字形部首优先、读音五音其次/u);
  assert.match(html, /不采用姓名笔画吉凶/u);
  assert.match(html, /上户口前查重名/u);
  assert.match(html, /参考分，仅供参考/u);
  assert.doesNotMatch(html, /五格|天格|人格|地格|总格|外格|易者|押钱|赔付|封存|[぀-ヿ]|・/u);
});

test("五行分析附生克图：日主取自调候日干，图下写所补五行的生克说明", () => {
  const html = renderToStaticMarkup(createElement(WuxingPanel, { reading: baseReading }));
  assert.match(html, /<svg[^>]*role="img"/u);
  assert.match(html, /class="wuxing-body"/u);
  assert.match(html, /<title>金：0 个，缺，宜补；日主<\/title>/u);
  assert.match(html, /补金：土生金，金生水；金克木，火克金/u);
  assert.match(html, /补木：水生木，木生火；木克土，金克木/u);
  assert.ok(html.indexOf("<svg") < html.indexOf('class="wuxing-bars"'));
});

test("五行分析按木火土金水显示计数、缺补、结论、寓意与藏干说明", () => {
  const html = renderToStaticMarkup(createElement(WuxingPanel, { reading: baseReading }));
  const positions = ["木", "火", "土", "金", "水"].map((element) => (
    html.indexOf(`data-element="${element}"`)
  ));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal((html.match(/class="wuxing-row"/gu) ?? []).length, 5);
  assert.match(html, /data-element="金"[\s\S]*>0<[\s\S]*>缺</u);
  assert.match(html, />补</u);
  assert.match(html, /八字缺金，宜补金/u);
  assert.match(html, /木主仁：仁爱上进、生机勃勃/u);
  assert.match(html, /金主义：果断重义、坚毅有守/u);
  assert.match(html, /含藏干：木 1 · 火 2 · 土 2 · 金 2 · 水 1/u);
  assert.match(html, /缺什么补什么是民间通行的起名思路/u);
  assert.match(html, /《穷通宝鉴》调候喜用/u);
});

test("名字卡展示逐字公开信息、出处加重、生僻与音律提示", () => {
  const name = baseReading.families.shiwen.output!.names[0]!;
  const html = renderToStaticMarkup(createElement(NameCard, { name, familyKey: "shiwen" }));
  assert.match(html, /张河洲/u);
  assert.match(html, /zhāng hé zhōu/u);
  assert.match(html, /五行/u);
  assert.match(html, /部首·水/u);
  assert.match(html, /康熙/u);
  assert.match(html, /恩泽润养/u);
  assert.match(html, /寓意/u);
  assert.match(html, /理由/u);
  for (const label of ["综合", "好听", "字形", "八字五行", "诗文意蕴",
    "用字分析", "字义分析", "意蕴内涵", "性格标签", "补火"]) {
    assert.match(html, new RegExp(label, "u"));
  }
  assert.match(html, /温和/u);
  assert.match(html, /用作名字意指/u);
  assert.match(html, /诗经 · 周南·关雎/u);
  assert.match(html, /<b>河<\/b>/u);
  assert.match(html, /<b>洲<\/b>/u);

  const rare = baseReading.families.yinyi.output!.names[0]!;
  const rareHtml = renderToStaticMarkup(createElement(NameCard, { name: rare, familyKey: "yinyi" }));
  assert.match(rareHtml, /较生僻/u);
  assert.match(rareHtml, /同声母/u);
});

test("姓氏字块只展示读音、五行与康熙笔画，不展示字典释义", () => {
  const name = baseReading.families.wuxing.output!.names[0]!;
  const html = renderToStaticMarkup(createElement(NameCard, { name, familyKey: "wuxing" }));
  assert.match(html, /张[\s\S]*zhāng[\s\S]*金 · 康熙 11 画/u);
  assert.doesNotMatch(html, /把弦安在弓上|开弓|拉弓弦/u);
});

test("出处中每个名字字只按名字里的出现次数依次加重", () => {
  const base = baseReading.families.shiwen.output!.names[0]!;
  const source = { book: "论语", title: "宪问", text: "有德者必有言，有言者不必有德" };
  const distinct = { ...base, given: "有言", full: "张有言", source };
  const distinctHtml = renderToStaticMarkup(createElement(NameCard, {
    name: distinct, familyKey: "shiwen",
  }));
  assert.equal((distinctHtml.match(/<b>有<\/b>/gu) ?? []).length, 1);
  assert.equal((distinctHtml.match(/<b>言<\/b>/gu) ?? []).length, 1);

  const repeated = { ...base, given: "有有", full: "张有有", source };
  const repeatedHtml = renderToStaticMarkup(createElement(NameCard, {
    name: repeated, familyKey: "shiwen",
  }));
  assert.equal((repeatedHtml.match(/<b>有<\/b>/gu) ?? []).length, 2);
  assert.equal((repeatedHtml.match(/<b>言<\/b>/gu) ?? []).length, 0);
});

test("商号结果页无姓氏，登记提示替代查重名", () => {
  const business = {
    ...baseReading,
    target: "business",
    question: "社区咖啡馆，温暖安静",
    surname: undefined,
    gender: "any",
    basis: {
      ...baseReading.basis,
      pillars: null,
      tiaohou: null,
      favorable: ["火"],
      favorableSource: "industry",
      favorableNote: "按行业：咖啡 → 火",
    },
    families: {
      wuxing: family("wuxing", ["明泽", "清安", "嘉宁"]),
      shiwen: family("shiwen", ["河洲", "云舒", "景行"]),
      yinyi: family("yinyi", ["思远", "知夏", "言蹊"]),
    },
  } as unknown as PublicNamingReading;
  const html = renderToStaticMarkup(createElement(NamingReading, { reading: business, onReading: noop }));
  assert.match(html, /起名 · 商号（2 字）/u);
  assert.doesNotMatch(html, /张姓/u);
  assert.match(html, /按行业：咖啡 → 火/u);
  assert.doesNotMatch(html, /class="wuxing-row"/u);
  assert.match(html, /火主礼：热情有礼、开朗明快/u);
  assert.match(html, /注册前查询商标与工商登记/u);
});

test("未出生五行面板注明六字，旧存档缺新字段时只保留说明且不报错", () => {
  const unborn = {
    ...baseReading, unborn: true,
    basis: { ...baseReading.basis, unborn: true, pillars: { ...baseReading.basis.pillars!, time: null } },
  } as PublicNamingReading;
  assert.match(renderToStaticMarkup(createElement(WuxingPanel, { reading: unborn })),
    /按预产期，时辰不详，以年月日六字计/u);

  const legacy = {
    ...baseReading,
    basis: { ...baseReading.basis, counts: undefined, missing: undefined, hiddenCounts: undefined },
  } as unknown as PublicNamingReading;
  const panel = renderToStaticMarkup(createElement(WuxingPanel, { reading: legacy }));
  assert.match(panel, /八字缺金，宜补金/u);
  assert.doesNotMatch(panel, /class="wuxing-row"/u);
  const oldName = { ...baseReading.families.wuxing.output!.names[0]!,
    scores: undefined, supplements: undefined, analysis: undefined, echoes: undefined, tags: undefined,
    chars: baseReading.families.wuxing.output!.names[0]!.chars.map((item) => ({ ...item, sense: undefined })),
  } as unknown as Parameters<typeof NameCard>[0]["name"];
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(NameCard, {
    name: oldName, familyKey: "wuxing",
  })));
});

test("起名依据使用服务端说明，旧存档按来源显示通用文字", () => {
  const source = readFileSync(new URL("../web/pages/NamingReading.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /INDUSTRY_WORDS|industryKeyword/u);
  assert.match(source, /basis\.favorableNote/u);

  const legacy = {
    ...baseReading,
    basis: { ...baseReading.basis, favorableSource: "tiaohou", favorableNote: undefined },
  } as unknown as PublicNamingReading;
  const html = renderToStaticMarkup(createElement(NamingReading, { reading: legacy, onReading: noop }));
  assert.match(html, /按调候取用/u);
});

test("名字卡桌面双栏、窄屏叠排，评分条与页面宽度遵守视觉契约", () => {
  const card = readFileSync(new URL("../web/components/NameCard.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  assert.match(card, /className="name-card-layout"/u);
  assert.match(css, /\.name-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su);
  assert.match(css, /\.name-card-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*\.9fr\)\s+minmax\(0,\s*1\.1fr\)/su);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*\.name-card-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su);
  assert.match(css, /\.score-fill\s*\{[^}]*height:\s*8px[^}]*border-radius:\s*4px[^}]*background:\s*var\(--gold\)/su);
  assert.match(css, /\.naming-reading\s*\{[^}]*overflow-x:\s*(?:clip|hidden)/su);
  assert.match(css, /\.naming-basis:not\(\[open\]\)\s*\{[^}]*gap:\s*0/su);
  assert.match(css, /\.naming-basis\s*>\s*summary\s*\{[^}]*align-content:\s*center/su);
});

test("合参推荐卡显示综合分与补益五行", () => {
  const html = renderToStaticMarkup(createElement(NamingReading, { reading: baseReading, onReading: noop }));
  assert.match(html, /综合 91 分/u);
  assert.match(html, /补火：明/u);
});

test("未出生的人名在起名依据注明预产期与时辰不详", () => {
  const unborn = {
    ...baseReading,
    unborn: true,
    gender: "any",
    basis: { ...baseReading.basis, unborn: true, pillars: { ...baseReading.basis.pillars!, time: null } },
  } as PublicNamingReading;
  const html = renderToStaticMarkup(createElement(NamingReading, { reading: unborn, onReading: noop }));
  assert.match(html, /起名 · 人名（张姓 · 双名 · 不限 · 按预产期）/u);
  assert.match(html, /按预产期，时辰不详/u);
  assert.match(html, /不限/u);
});

test("写作进度、合参进度与单家免费重试分别可见", () => {
  const writing = {
    ...baseReading,
    status: "writing",
    summary: undefined,
    families: {
      ...baseReading.families,
      wuxing: { status: "writing", retries: 0 },
      shiwen: { status: "pending", retries: 0 },
    },
  } as unknown as PublicNamingReading;
  assert.match(renderToStaticMarkup(createElement(NamingReading, { reading: writing, onReading: noop })),
    /三位古代流派正在各自分析（1\/3）/u);

  const summaryWriting = {
    ...baseReading, status: "writing", summary: { status: "writing", basis: 3, retries: 0 },
  } as unknown as PublicNamingReading;
  assert.match(renderToStaticMarkup(createElement(NamingReading, { reading: summaryWriting, onReading: noop })),
    /正在用白话总结/u);

  const failed = {
    ...baseReading,
    families: { ...baseReading.families, yinyi: { status: "failed", retries: 1, error: "暂未落笔" } },
  } as unknown as PublicNamingReading;
  assert.match(renderToStaticMarkup(createElement(NamingReading, { reading: failed, onReading: noop })),
    /免费重试（还可 1 次）/u);
});

test("起名任一家或合参写作时轮询，全部结束后停止", () => {
  const familyWriting = {
    ...baseReading,
    families: { ...baseReading.families, wuxing: { status: "writing", retries: 0 } },
  } as unknown as PublicNamingReading;
  assert.equal(shouldPollReading(familyWriting), true);
  const summaryWriting = {
    ...baseReading, summary: { status: "writing", basis: 3, retries: 0 },
  } as unknown as PublicNamingReading;
  assert.equal(shouldPollReading(summaryWriting), true);
  assert.equal(shouldPollReading(baseReading), false);
});

test("结果页按 naming 分派，浏览器代码只类型导入起名服务类型", () => {
  const reading = readFileSync(new URL("../web/pages/Reading.tsx", import.meta.url), "utf8");
  assert.match(reading, /kind === "naming"[\s\S]*<NamingReading/u);
  for (const path of [
    "../web/pages/NamingReading.tsx", "../web/components/NameCard.tsx",
    "../web/components/WuxingPanel.tsx", "../web/lib/api.ts",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /import\s+(?!type\b)[^;]*src\/sanyi\/naming\//u);
  }
});
