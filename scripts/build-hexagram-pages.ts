import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getDaxiang } from "../src/agent/daxiang-corpus.js";
import { getZhouyiEnglish } from "../src/agent/zhouyi-en.js";
import { getHexagramText } from "../src/agent/zhouyi-corpus.js";
import { HEXAGRAM_GUIDES } from "../src/content/hexagram-guides.js";
import {
  DAY_MASTER_GUIDES_EN,
  TEN_GOD_GUIDES_EN,
  type DayMasterGuideEn,
  type TenGodGuideEn,
} from "../src/content/bazi-guides.en.js";
import { getHexagramYangLines, getTrigramName } from "../src/oracle/liuyao-chart.js";
import { ELEMENTS_EN, HEXAGRAMS_EN, TRIGRAMS_EN } from "../src/sanyi/i18n/glossary.js";
import { hexagramPath } from "../web/lib/hexagram-path.js";

export const SITE_ORIGIN = "https://yarrow-six.vercel.app";

const HEXAGRAM_PAGE_VIEW_BEACON = `<script>(()=>{fetch("/api/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event:"hexagram_page_view"}),keepalive:true}).catch(()=>{})})()</script>`;
const BAZI_PAGE_VIEW_BEACON = `<script>(()=>{fetch("/api/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event:"bazi_page_view"}),keepalive:true}).catch(()=>{})})()</script>`;

const CSS = `:root {
  color-scheme: dark;
  --bg: #0f1110;
  --panel: #151816;
  --paper: #eae5d9;
  --muted: #a6a195;
  --dim: #75716a;
  --gold: #c9a866;
  --line: rgb(201 168 102 / 0.2);
  --line-strong: rgb(201 168 102 / 0.44);
  --serif: Georgia, "Times New Roman", serif;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html { background: var(--bg); color: var(--paper); font-family: var(--serif); }
body { margin: 0; background: radial-gradient(700px 420px at 100% 18%, rgb(201 168 102 / .07), transparent 68%), var(--bg); }
a { color: var(--gold); text-underline-offset: 3px; }
.shell { width: min(920px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 54px; }
.site-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }
.brand { color: var(--paper); font-size: 19px; letter-spacing: .12em; text-decoration: none; }
.eyebrow { margin: 0 0 8px; color: var(--gold); font: 600 11px/1.4 var(--sans); letter-spacing: .14em; text-transform: uppercase; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) 210px; column-gap: 48px; row-gap: 22px; align-items: center; padding: 56px 0 42px; }
h1 { margin: 0; font-size: clamp(42px, 8vw, 76px); font-weight: 400; line-height: .98; letter-spacing: -.045em; }
.title-en { display: block; margin-top: 13px; color: var(--muted); font-size: clamp(20px, 3vw, 28px); letter-spacing: 0; }
.trigrams { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: 17px; }
.hexagram-svg { display: block; width: 100%; height: auto; color: var(--gold); }
.content { display: grid; gap: 18px; }
.panel { padding: clamp(22px, 5vw, 38px); border: 1px solid var(--line); background: rgb(21 24 22 / .86); }
.panel h2 { margin: 0 0 16px; color: var(--gold); font: 600 13px/1.4 var(--sans); letter-spacing: .1em; text-transform: uppercase; }
.panel p { margin: 0; color: var(--muted); font-size: 18px; line-height: 1.82; }
.classic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.lines { display: grid; gap: 0; margin: 0; }
.line { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 22px; padding: 17px 0; border-top: 1px solid var(--line); }
.line:first-child { border-top: 0; padding-top: 0; }
.line:last-child { padding-bottom: 0; }
.line dt { color: var(--gold); font: 600 12px/1.6 var(--sans); letter-spacing: .06em; text-transform: uppercase; }
.line dd { margin: 0; color: var(--muted); font-size: 17px; line-height: 1.72; }
.original { padding: clamp(22px, 5vw, 38px); border: 1px solid var(--line); background: rgb(21 24 22 / .86); }
.original summary { cursor: pointer; color: var(--gold); font-family: var(--sans); }
.original section { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--line); }
.original h2 { font-family: var(--serif); font-size: 24px; letter-spacing: 0; text-transform: none; }
.original h3 { margin: 20px 0 7px; color: var(--paper); font-size: 16px; }
.original p { font-size: 16px; }
.page-nav { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; padding: 14px 0; font-family: var(--sans); font-size: 13px; }
.page-nav .next { text-align: right; }
.cta { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px; border: 1px solid var(--line-strong); background: linear-gradient(120deg, rgb(201 168 102 / .13), transparent 70%); }
.cta strong { display: block; margin-bottom: 6px; font-size: 21px; font-weight: 400; }
.cta span { color: var(--muted); font: 13px/1.5 var(--sans); }
.button { flex: none; padding: 12px 18px; border: 1px solid var(--gold); color: var(--bg); background: var(--gold); font: 600 13px/1.2 var(--sans); text-decoration: none; }
.site-footer { padding-top: 32px; color: var(--dim); font: 12px/1.7 var(--sans); text-align: center; }
.index-head { max-width: 680px; padding: 58px 0 34px; }
.index-head h1 { line-height: 1.03; }
.index-head p { color: var(--muted); font-size: 18px; line-height: 1.7; }
.hexagram-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.hexagram-card { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 13px; align-items: center; min-width: 0; padding: 15px; border: 1px solid var(--line); color: var(--paper); text-decoration: none; }
.hexagram-card:hover { border-color: var(--line-strong); background: rgb(201 168 102 / .06); }
.hexagram-card svg { width: 42px; }
.hexagram-card small { display: block; color: var(--dim); font: 11px/1.4 var(--sans); }
.hexagram-card strong { display: block; margin-top: 3px; overflow-wrap: anywhere; font-size: 15px; font-weight: 400; line-height: 1.3; }
.hexagram-card span { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 1.3; }
.bazi-sections { display: grid; gap: 34px; }
.bazi-section h2 { margin: 0 0 15px; color: var(--gold); font: 600 13px/1.4 var(--sans); letter-spacing: .1em; text-transform: uppercase; }
.bazi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.bazi-card { display: block; min-width: 0; padding: 20px; border: 1px solid var(--line); color: var(--paper); text-decoration: none; }
.bazi-card:hover { border-color: var(--line-strong); background: rgb(201 168 102 / .06); }
.bazi-card small { display: block; color: var(--gold); font: 11px/1.4 var(--sans); letter-spacing: .07em; text-transform: uppercase; }
.bazi-card strong { display: block; margin-top: 7px; font-size: 20px; font-weight: 400; }
.bazi-card span { display: block; margin-top: 6px; color: var(--muted); font: 13px/1.5 var(--sans); }
.bazi-symbol { display: grid; place-items: center; width: 180px; aspect-ratio: 1; border: 1px solid var(--line-strong); border-radius: 50%; color: var(--gold); font: 18px/1.35 var(--sans); text-align: center; }
.point-list { display: grid; gap: 12px; margin: 0; padding-left: 20px; color: var(--muted); font-size: 17px; line-height: 1.65; }
.related-links { display: flex; flex-wrap: wrap; gap: 10px; }
.related-links a { padding: 9px 12px; border: 1px solid var(--line); font: 13px/1.4 var(--sans); text-decoration: none; }
.cta-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.button-secondary { color: var(--gold); background: transparent; }
@media (max-width: 760px) {
  .hexagram-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .classic-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .shell { width: min(100% - 28px, 920px); padding-top: 18px; }
  .site-head { padding-bottom: 18px; }
  .hero { grid-template-columns: minmax(0, 1fr) 105px; column-gap: 18px; row-gap: 14px; padding: 40px 0 30px; }
  h1 { font-size: clamp(38px, 12vw, 56px); }
  .title-en { font-size: 19px; }
  .trigrams { font-size: 14px; line-height: 1.55; }
  .panel { padding: 21px 18px; }
  .panel p, .line dd { font-size: 16px; }
  .line { grid-template-columns: 1fr; gap: 5px; }
  .page-nav { grid-template-columns: 1fr 1fr; }
  .page-nav .index-link { grid-column: 1 / -1; grid-row: 1; text-align: center; }
  .cta { align-items: stretch; flex-direction: column; }
  .button { text-align: center; }
  .hexagram-grid { grid-template-columns: 1fr; }
  .bazi-grid { grid-template-columns: 1fr; }
  .bazi-symbol { width: 100px; }
}`;

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

function figureSvg(lines: readonly boolean[], label: string): string {
  const marks = lines.map((yang, position) => {
    const y = 130 - position * 24;
    return yang
      ? `<rect x="10" y="${y}" width="140" height="10" rx="2" fill="currentColor"/>`
      : `<rect x="10" y="${y}" width="58" height="10" rx="2" fill="currentColor"/><rect x="92" y="${y}" width="58" height="10" rx="2" fill="currentColor"/>`;
  }).join("");
  return `<svg class="hexagram-svg" role="img" aria-label="${escapeAttribute(label)}" viewBox="0 0 160 150">${marks}</svg>`;
}

function head(
  title: string,
  description: string,
  canonical: string,
  image = `${SITE_ORIGIN}/brand/og.png`,
  imageAlt = "Yarrow I Ching and BaZi guide",
): string {
  return `<meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#0f1110">
    <title>${escapeText(title)}</title>
    <meta name="description" content="${escapeAttribute(description)}">
    <link rel="canonical" href="${escapeAttribute(canonical)}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Yarrow">
    <meta property="og:title" content="${escapeAttribute(title)}">
    <meta property="og:description" content="${escapeAttribute(description)}">
    <meta property="og:url" content="${escapeAttribute(canonical)}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:alt" content="${escapeAttribute(imageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttribute(title)}">
    <meta name="twitter:description" content="${escapeAttribute(description)}">
    <meta name="twitter:image" content="${image}">
    <link rel="icon" href="/favicon.ico" sizes="32x32">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="stylesheet" href="/hexagram/hexagram.css">`;
}

async function previewImage(outputRoot: string, relativePath: string): Promise<string> {
  const localPath = resolve(outputRoot, `.${relativePath}`);
  return access(localPath).then(() => `${SITE_ORIGIN}${relativePath}`)
    .catch(() => `${SITE_ORIGIN}/brand/og.png`);
}

function lineLabel(position: number): string {
  return ["First line", "Second line", "Third line", "Fourth line", "Fifth line", "Top line"][position - 1]!;
}

function pageFor(number: number, image: string): string {
  const names = HEXAGRAMS_EN[number - 1]!;
  const english = getZhouyiEnglish(number);
  const chinese = getHexagramText(number);
  const lines = getHexagramYangLines(number);
  const lower = TRIGRAMS_EN[getTrigramName(lines.slice(0, 3))];
  const upper = TRIGRAMS_EN[getTrigramName(lines.slice(3, 6))];
  const title = `Hexagram ${number}: ${names.pinyin} (${names.title}) · I Ching meaning · Yarrow`;
  const description = `Hexagram ${number}, ${names.pinyin} (${names.title}): a plain-English I Ching guide with the Judgement, Image, six lines, and original Chinese text.`;
  const canonical = `${SITE_ORIGIN}${hexagramPath(number)}`;
  const translatedLines = english.lines.map((text, index) => (
    `<div class="line"><dt>${lineLabel(index + 1)}</dt><dd>${escapeText(text)}</dd></div>`
  )).join("");
  const translatedExtras = english.extras.map((text, index) => {
    const label = number === 1 ? "Use of Nines" : number === 2 ? "Use of Sixes" : `Additional line ${index + 1}`;
    return `<div class="line"><dt>${label}</dt><dd>${escapeText(text)}</dd></div>`;
  }).join("");
  const originalLines = [...chinese.lines, ...chinese.extras].map((line) => (
    `<h3>${escapeText(line.label)}</h3><p>${escapeText(line.text)}</p>`
  )).join("");
  const previous = number > 1
    ? `<a href="${hexagramPath(number - 1)}" rel="prev">← Hexagram ${number - 1}</a>` : `<span></span>`;
  const next = number < 64
    ? `<a class="next" href="${hexagramPath(number + 1)}" rel="next">Hexagram ${number + 1} →</a>` : `<span></span>`;
  return `<!doctype html>
<html lang="en">
  <head>
    ${head(title, description, canonical, image,
      `Hexagram ${number}: ${names.pinyin}, ${names.title}`)}
  </head>
  <body>
    <main class="shell">
      <header class="site-head"><a class="brand" href="/">YARROW</a><a href="/hexagram/">All 64 hexagrams</a></header>
      <section class="hero">
        <div><p class="eyebrow">I Ching · Hexagram ${number}</p><h1>${escapeText(names.pinyin)}<span class="title-en">${escapeText(names.title)}</span></h1></div>
        ${figureSvg(lines, `Hexagram ${number}, six lines from bottom to top`)}
        <p class="trigrams">${upper.pinyin} · ${upper.image} over ${lower.pinyin} · ${lower.image}</p></section>
      <div class="content">
        <section class="panel"><h2>Plain-language guide</h2><p>${escapeText(HEXAGRAM_GUIDES[number - 1]!)}</p></section>
        <div class="classic-grid">
          <section class="panel"><h2>Judgement</h2><p>${escapeText(english.judgement)}</p></section>
          <section class="panel"><h2>Image</h2><p>${escapeText(english.image)}</p></section>
        </div>
        <section class="panel"><h2>Six lines</h2><dl class="lines">${translatedLines}${translatedExtras}</dl></section>
        <details class="original"><summary>Show the original Chinese text</summary><section lang="zh">
          <h2>${escapeText(chinese.name)}</h2><h3>卦辞</h3><p>${escapeText(chinese.judgement)}</p>
          <h3>大象</h3><p>${escapeText(getDaxiang(number))}</p>${originalLines}
        </section></details>
        <nav class="page-nav" aria-label="Hexagram navigation">${previous}<a class="index-link" href="/hexagram/">All 64 hexagrams</a>${next}</nav>
        <section class="cta"><div><strong>Ask Yarrow a question</strong><span>A full reading costs 0.05 USDC on Arc.</span></div>
          <a class="button" href="/#/?kind=question">Ask a question</a></section>
      </div>
      <footer class="site-footer">For reference and self-reflection only; not medical, legal, or investment advice.</footer>
    </main>
    ${HEXAGRAM_PAGE_VIEW_BEACON}
  </body>
</html>
`;
}

function baziCtas(): string {
  return `<section class="cta"><div><strong>Explore your own BaZi chart</strong><span>Start with a free Day Master lookup or continue to a full reading.</span></div>
    <div class="cta-actions"><a class="button button-secondary" href="/#/">Find your Day Master (free)</a>
      <a class="button" href="/#/?kind=destiny">Get a full BaZi reading · 0.05 USDC</a></div></section>`;
}

function relatedLinks(values: readonly { href: string; label: string }[]): string {
  return values.map((item) => `<a href="${escapeAttribute(item.href)}">${escapeText(item.label)}</a>`).join("");
}

function dayMasterPage(guide: DayMasterGuideEn, image: string): string {
  const title = `${guide.name} Day Master: personality and meaning · Yarrow`;
  const description = `${guide.name} Day Master explained in plain English: ${guide.tagline} Explore relationships, work style, balance, and self-reflection.`;
  const path = `/bazi/day-master/${guide.slug}/`;
  const counterpart = DAY_MASTER_GUIDES_EN.find((item) => (
    item.element === guide.element && item.slug !== guide.slug
  ))!;
  const gods = TEN_GOD_GUIDES_EN.filter((item) => item.relationGroup === "peer");
  const links = [
    { href: `/bazi/day-master/${counterpart.slug}/`, label: `${counterpart.name} Day Master` },
    ...gods.map((item) => ({ href: `/bazi/ten-gods/${item.slug}/`, label: `${item.name} · Ten Gods` })),
  ];
  return `<!doctype html>
<html lang="en">
  <head>
    ${head(title, description, `${SITE_ORIGIN}${path}`, image, `${guide.name} Day Master`)}
  </head>
  <body><main class="shell">
    <header class="site-head"><a class="brand" href="/">YARROW</a><a href="/bazi/">BaZi guides</a></header>
    <section class="hero"><div><p class="eyebrow">BaZi · ${escapeText(guide.yinYang)} ${escapeText(ELEMENTS_EN[guide.element])}</p>
      <h1>${escapeText(guide.name)}<span class="title-en">Day Master</span></h1></div>
      <div class="bazi-symbol" aria-label="${escapeAttribute(guide.image)}">${escapeText(guide.image)}</div>
      <p class="trigrams">${escapeText(guide.tagline)}</p></section>
    <div class="content">
      <section class="panel"><h2>Plain-language guide</h2><p>${escapeText(guide.guide)}</p></section>
      <section class="panel"><h2>Key ideas</h2><ul class="point-list">${guide.points.map((point) => `<li>${escapeText(point)}</li>`).join("")}</ul></section>
      <section class="panel"><h2>Related guides</h2><nav class="related-links" aria-label="Related BaZi guides">${relatedLinks(links)}</nav></section>
      ${baziCtas()}
    </div>
    <footer class="site-footer">For reference and self-reflection only; not medical, legal, or investment advice.</footer>
  </main>${BAZI_PAGE_VIEW_BEACON}</body>
</html>
`;
}

function tenGodPage(guide: TenGodGuideEn, image: string): string {
  const title = `${guide.name} in BaZi: Ten Gods meaning · Yarrow`;
  const description = `${guide.name} in the BaZi Ten Gods explained in plain English: ${guide.tagline} Learn its relationship, common meanings, and balance.`;
  const path = `/bazi/ten-gods/${guide.slug}/`;
  const related = TEN_GOD_GUIDES_EN.filter((item) => (
    item.relationGroup === guide.relationGroup && item.slug !== guide.slug
  ));
  return `<!doctype html>
<html lang="en">
  <head>
    ${head(title, description, `${SITE_ORIGIN}${path}`, image, `${guide.name}, BaZi Ten Gods`)}
  </head>
  <body><main class="shell">
    <header class="site-head"><a class="brand" href="/">YARROW</a><a href="/bazi/">BaZi guides</a></header>
    <section class="hero"><div><p class="eyebrow">BaZi · Ten Gods</p>
      <h1>${escapeText(guide.name)}<span class="title-en">Ten Gods relationship</span></h1></div>
      <div class="bazi-symbol" aria-label="Relationship to the Day Master">${escapeText(guide.relation)}</div>
      <p class="trigrams">${escapeText(guide.tagline)}</p></section>
    <div class="content">
      <section class="panel"><h2>Plain-language guide</h2><p>${escapeText(guide.guide)}</p></section>
      <section class="panel"><h2>Key ideas</h2><ul class="point-list">${guide.points.map((point) => `<li>${escapeText(point)}</li>`).join("")}</ul></section>
      <section class="panel"><h2>Related guides</h2><nav class="related-links" aria-label="Related Ten Gods">${relatedLinks(related.map((item) => ({
        href: `/bazi/ten-gods/${item.slug}/`, label: `${item.name} · Ten Gods`,
      })))}</nav></section>
      ${baziCtas()}
    </div>
    <footer class="site-footer">For reference and self-reflection only; not medical, legal, or investment advice.</footer>
  </main>${BAZI_PAGE_VIEW_BEACON}</body>
</html>
`;
}

function baziIndexPage(): string {
  const title = "BaZi Day Masters and Ten Gods: English guides · Yarrow";
  const description = "Explore plain-English guides to the 10 BaZi Day Masters and 10 Ten Gods relationships, then find your own Day Master for free.";
  const dayMasterCards = DAY_MASTER_GUIDES_EN.map((item) => (
    `<a class="bazi-card" href="/bazi/day-master/${item.slug}/"><small>${escapeText(item.yinYang)} ${escapeText(ELEMENTS_EN[item.element])}</small><strong>${escapeText(item.name)} Day Master</strong><span>${escapeText(item.tagline)}</span></a>`
  )).join("");
  const tenGodCards = TEN_GOD_GUIDES_EN.map((item) => (
    `<a class="bazi-card" href="/bazi/ten-gods/${item.slug}/"><small>Ten Gods · ${escapeText(item.relationGroup)}</small><strong>${escapeText(item.name)}</strong><span>${escapeText(item.tagline)}</span></a>`
  )).join("");
  return `<!doctype html>
<html lang="en">
  <head>${head(title, description, `${SITE_ORIGIN}/bazi/`)}</head>
  <body><main class="shell">
    <header class="site-head"><a class="brand" href="/">YARROW</a><a href="/hexagram/">I Ching hexagrams</a></header>
    <section class="index-head"><p class="eyebrow">BaZi in plain English</p><h1>Day Masters and Ten Gods</h1>
      <p>Your Day Master is the heavenly stem at the center of a BaZi chart. The Ten Gods describe how other elements relate to it through producing, controlling, or sharing an element, with yin and yang distinguishing each pair. These guides are reflective vocabulary, not fixed predictions.</p></section>
    <div class="bazi-sections">
      <section class="bazi-section"><h2>The 10 Day Masters</h2><nav class="bazi-grid" aria-label="The 10 Day Masters">${dayMasterCards}</nav></section>
      <section class="bazi-section"><h2>The 10 Ten Gods</h2><nav class="bazi-grid" aria-label="The 10 Ten Gods">${tenGodCards}</nav></section>
      ${baziCtas()}
    </div>
    <footer class="site-footer">For reference and self-reflection only; not medical, legal, or investment advice.</footer>
  </main>${BAZI_PAGE_VIEW_BEACON}</body>
</html>
`;
}

function indexPage(): string {
  const title = "The 64 I Ching hexagrams · Yarrow";
  const description = "Browse all 64 I Ching hexagrams with plain-English guides, Judgements, Images, line texts, diagrams, and original Chinese text.";
  const cards = HEXAGRAMS_EN.map((names, index) => {
    const number = index + 1;
    return `<a class="hexagram-card" href="${hexagramPath(number)}">${figureSvg(getHexagramYangLines(number), `Hexagram ${number}`)}<div><small>${number}</small><strong>${escapeText(names.pinyin)}</strong><span>${escapeText(names.title)}</span></div></a>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
  <head>
    ${head(title, description, `${SITE_ORIGIN}/hexagram/`)}
  </head>
  <body><main class="shell">
    <header class="site-head"><a class="brand" href="/">YARROW</a><a href="/#/?kind=question">Ask a question</a></header>
    <section class="index-head"><p class="eyebrow">The Book of Changes</p><h1>64 I Ching hexagrams</h1>
      <p>Explore each figure through its trigrams, Judgement, Image, six lines, a plain-English introduction, and the original Chinese text.</p></section>
    <nav class="hexagram-grid" aria-label="The 64 I Ching hexagrams">${cards}</nav>
    <footer class="site-footer">For reference and self-reflection only; not medical, legal, or investment advice.</footer>
  </main></body>
</html>
`;
}

export async function buildHexagramPages(outputRoot = resolve(process.cwd(), "web")): Promise<void> {
  const hexagramRoot = resolve(outputRoot, "hexagram");
  const baziRoot = resolve(outputRoot, "bazi");
  await Promise.all([mkdir(hexagramRoot, { recursive: true }), mkdir(baziRoot, { recursive: true })]);
  await Promise.all(Array.from({ length: 64 }, async (_, index) => {
    const number = index + 1;
    const directory = resolve(outputRoot, `.${hexagramPath(number)}`);
    await mkdir(directory, { recursive: true });
    const image = await previewImage(outputRoot, `/brand/og/hexagram/${number}.png`);
    await writeFile(resolve(directory, "index.html"), pageFor(number, image), "utf8");
  }));
  await Promise.all([
    ...DAY_MASTER_GUIDES_EN.map(async (guide) => {
      const directory = resolve(baziRoot, "day-master", guide.slug);
      const image = await previewImage(outputRoot, `/brand/og/bazi/day-master/${guide.slug}.png`);
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, "index.html"), dayMasterPage(guide, image), "utf8");
    }),
    ...TEN_GOD_GUIDES_EN.map(async (guide) => {
      const directory = resolve(baziRoot, "ten-gods", guide.slug);
      const image = await previewImage(outputRoot, `/brand/og/bazi/ten-gods/${guide.slug}.png`);
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, "index.html"), tenGodPage(guide, image), "utf8");
    }),
  ]);
  const sitemapUrls = [
    `${SITE_ORIGIN}/`, `${SITE_ORIGIN}/hexagram/`,
    ...Array.from({ length: 64 }, (_, index) => `${SITE_ORIGIN}${hexagramPath(index + 1)}`),
    `${SITE_ORIGIN}/bazi/`,
    ...DAY_MASTER_GUIDES_EN.map((item) => `${SITE_ORIGIN}/bazi/day-master/${item.slug}/`),
    ...TEN_GOD_GUIDES_EN.map((item) => `${SITE_ORIGIN}/bazi/ten-gods/${item.slug}/`),
  ];
  await Promise.all([
    writeFile(resolve(hexagramRoot, "index.html"), indexPage(), "utf8"),
    writeFile(resolve(hexagramRoot, "hexagram.css"), `${CSS}\n`, "utf8"),
    writeFile(resolve(baziRoot, "index.html"), baziIndexPage(), "utf8"),
    writeFile(resolve(outputRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`, "utf8"),
    writeFile(resolve(outputRoot, "robots.txt"),
      `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, "utf8"),
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildHexagramPages();
  console.log("64 卦与八字英文静态页生成完成：web/hexagram/、web/bazi/");
}
