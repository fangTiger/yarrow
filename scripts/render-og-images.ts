import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  DAY_MASTER_GUIDES_EN,
  TEN_GOD_GUIDES_EN,
  type DayMasterGuideEn,
  type TenGodGuideEn,
} from "../src/content/bazi-guides.en.js";
import { getHexagramYangLines } from "../src/oracle/liuyao-chart.js";
import { HEXAGRAMS_EN } from "../src/sanyi/i18n/glossary.js";

const runFile = promisify(execFile);
const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function cardHtml(content: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; }
html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
body { color: #eae5d9; background: radial-gradient(650px 440px at 86% 16%, rgba(201,168,102,.14), transparent 68%), #0f1110; font-family: Georgia, "Times New Roman", serif; }
.card { position: relative; width: 1200px; height: 630px; padding: 72px 84px; border: 1px solid rgba(201,168,102,.32); }
.eyebrow { margin: 0 0 26px; color: #c9a866; font-family: Arial, sans-serif; font-size: 19px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
h1 { max-width: 870px; margin: 0; font-size: 74px; font-weight: 400; line-height: 1.02; letter-spacing: -.035em; }
.subtitle { max-width: 820px; margin: 28px 0 0; color: #a6a195; font-size: 31px; line-height: 1.35; }
.brand { position: absolute; right: 84px; bottom: 58px; color: #c9a866; font-family: Arial, sans-serif; font-size: 20px; letter-spacing: .03em; }
.figure { position: absolute; top: 86px; right: 88px; display: grid; gap: 16px; width: 210px; }
.yao { display: flex; justify-content: space-between; height: 18px; }
.yao span { display: block; height: 18px; border-radius: 3px; background: #c9a866; }
.yao.yang span { width: 210px; }
.yao.yin span { width: 86px; }
.hex-copy { max-width: 720px; }
</style></head><body><main class="card">${content}<div class="brand">Yarrow · yarrow-six.vercel.app</div></main></body></html>`;
}

export function hexagramCardHtml(number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > 64) {
    throw new Error(`卦序必须为 1–64，实际 ${number}`);
  }
  const names = HEXAGRAMS_EN[number - 1]!;
  const lines = [...getHexagramYangLines(number)].reverse().map((yang) => (
    yang ? `<div class="yao yang"><span></span></div>`
      : `<div class="yao yin"><span></span><span></span></div>`
  )).join("");
  return cardHtml(`<div class="hex-copy"><p class="eyebrow">Hexagram ${number}</p>
    <h1>${escapeText(names.pinyin)}</h1><p class="subtitle">${escapeText(names.title)}</p></div>
    <div class="figure" aria-label="Six lines from top to bottom">${lines}</div>`);
}

export function dayMasterCardHtml(guide: DayMasterGuideEn): string {
  return cardHtml(`<p class="eyebrow">BaZi · Day Master</p>
    <h1>${escapeText(guide.name)} Day Master</h1><p class="subtitle">${escapeText(guide.tagline)}</p>`);
}

export function tenGodCardHtml(guide: TenGodGuideEn): string {
  return cardHtml(`<p class="eyebrow">BaZi · Ten Gods</p>
    <h1>${escapeText(guide.name)} · Ten Gods</h1><p class="subtitle">${escapeText(guide.tagline)}</p>`);
}

interface RenderOptions {
  outputRoot?: string;
  chromePath?: string;
}

interface CardJob {
  html: string;
  output: string;
}

export async function renderOgImages(options: RenderOptions = {}): Promise<void> {
  const outputRoot = options.outputRoot ?? resolve(process.cwd(), "web/brand/og");
  const chromePath = options.chromePath ?? process.env.CHROME_PATH ?? DEFAULT_CHROME;
  const cardsRoot = await mkdtemp(join(tmpdir(), "yarrow-og-cards-"));
  const jobs: CardJob[] = [
    ...Array.from({ length: 64 }, (_, index) => ({
      html: hexagramCardHtml(index + 1),
      output: resolve(outputRoot, "hexagram", `${index + 1}.png`),
    })),
    ...DAY_MASTER_GUIDES_EN.map((guide) => ({
      html: dayMasterCardHtml(guide),
      output: resolve(outputRoot, "bazi/day-master", `${guide.slug}.png`),
    })),
    ...TEN_GOD_GUIDES_EN.map((guide) => ({
      html: tenGodCardHtml(guide),
      output: resolve(outputRoot, "bazi/ten-gods", `${guide.slug}.png`),
    })),
  ];

  try {
    for (const [index, job] of jobs.entries()) {
      await mkdir(dirname(job.output), { recursive: true });
      const cardPath = resolve(cardsRoot, `${String(index + 1).padStart(2, "0")}-${basename(job.output, ".png")}.html`);
      await writeFile(cardPath, job.html, "utf8");
      await runFile(chromePath, [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1200,630",
        `--screenshot=${job.output}`,
        pathToFileURL(cardPath).href,
      ]);
      console.log(`已渲染 ${index + 1}/${jobs.length}：${job.output}`);
    }
  } finally {
    await rm(cardsRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await renderOgImages();
  console.log("84 张页面专属预览图渲染完成：web/brand/og/");
}
