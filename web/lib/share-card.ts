import { deriveFiveHexagrams } from "../../src/oracle/liuyao-chart.js";
import type { AnyPublicReading } from "./api.js";
import type { Lang, TFunction } from "./i18n.js";
import { applyReadingTranslation } from "./reading-translation.js";
import {
  confidenceEn, hexagramEn, schoolEn, stemBranchEn, verdictEn,
} from "./result-format.js";

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

type ShareReading = Exclude<AnyPublicReading, { kind: "naming" }>;

export interface TrendPoint {
  label: string;
  value: number | null;
}

export interface TrendChart {
  kind: "trend";
  points: TrendPoint[];
}

export interface HexagramCardFigure {
  name: string;
  lines: boolean[];
}

export interface HexagramChart {
  kind: "hexagram";
  primary: HexagramCardFigure;
  changed: HexagramCardFigure;
  moving: number[];
}

export interface ShareCardModel {
  kind: ShareReading["kind"];
  brand: string;
  title: string;
  question?: string | undefined;
  headline: string;
  lines: string[];
  chips?: string[] | undefined;
  chart?: TrendChart | HexagramChart | undefined;
  footer: string;
  sample: boolean;
}

export interface ShareCardBuildOptions {
  sample?: boolean | undefined;
}

const QUESTION_SCHOOLS = ["chengyi", "jingfang", "shaoyong"] as const;
const HAS_HAN = /\p{Script=Han}/u;
const BAZI_PRIVATE_WORDS_ZH = /四柱|生辰|生日|出生(?:日期|时间|于)?/u;
const BAZI_PRIVATE_WORDS_EN = new RegExp([
  "four\\s+pillars?", "si\\s+zhu", "ba\\s*zi", "dob",
  "date\\s+of\\s+birth", "birth(?:day|\\s+date|\\s+time)?", "born\\s+(?:on|in)",
].join("|"), "iu");
const FOUR_DIGIT_YEAR = /(?:18|19|20|21)\d{2}(?:\s*年)?/u;

export class ShareCardUnavailableError extends Error {
  constructor(message = "分享卡片资料不完整") {
    super(message);
    this.name = "ShareCardUnavailableError";
  }
}

function translatedText(value: string, lang: Lang): string {
  if (lang === "en" && HAS_HAN.test(value)) {
    throw new ShareCardUnavailableError("英文译文尚未完整生成");
  }
  return value;
}

function privateTokens(reading: ShareReading): string[] {
  if (reading.kind === "question") return [reading.payment.firstHash];
  const pillars = Object.values(reading.chart.pillars).flatMap((pillar) => (
    pillar ? [pillar.ganZhi, stemBranchEn(pillar.ganZhi)] : []
  ));
  const common = [reading.chart.luck?.start.solarDate ?? "", ...pillars];
  if (reading.kind === "fortune") return common.filter(Boolean);
  return [
    ...common,
    ...(reading.chart.luck?.cycles.flatMap((cycle) => [
      cycle.ganZhi, stemBranchEn(cycle.ganZhi),
      String(cycle.startYear), String(cycle.endYear),
    ]) ?? []),
  ].filter(Boolean);
}

function containsPrivateText(value: string, reading: ShareReading): boolean {
  const normalized = value.toLocaleLowerCase("en-US");
  if (privateTokens(reading).some((token) => (
    normalized.includes(token.toLocaleLowerCase("en-US"))
  ))) return true;
  if (reading.kind === "question") return false;
  return BAZI_PRIVATE_WORDS_ZH.test(value)
    || BAZI_PRIVATE_WORDS_EN.test(value)
    || (reading.kind === "destiny" && FOUR_DIGIT_YEAR.test(value));
}

function safeText(
  value: string,
  reading: ShareReading,
  lang: Lang,
  fallback: string,
): string {
  const translated = translatedText(value, lang);
  return containsPrivateText(translated, reading) ? fallback : translated;
}

function safeQuestion(value: string, reading: ShareReading, fallback: string): string {
  return containsPrivateText(value, reading) ? fallback : value;
}

function summaryOutput(reading: ShareReading) {
  const summary = reading.summary;
  if (summary?.status !== "done" || !summary.output) {
    throw new Error("分享卡片只能从已完成的白话总述生成");
  }
  return summary.output;
}

function footerFor(
  kind: ShareReading["kind"],
  t: TFunction,
  sample: boolean,
): string {
  const proof = kind === "question" ? t("share.verifyQuestion") : t("share.verifyPayment");
  return ["yarrow-six.vercel.app", proof, sample ? t("share.sample") : ""]
    .filter(Boolean)
    .join(" · ");
}

function schoolLine(
  reading: Extract<ShareReading, { kind: "question" }>,
  key: typeof QUESTION_SCHOOLS[number],
  lang: Lang,
  t: TFunction,
): string {
  const output = reading.schools[key].output;
  const school = lang === "en" ? schoolEn(key).name : t(`wait.school.${key}`);
  if (!output) return t("share.schoolUnavailableLine", { school });
  const verdict = lang === "en" ? verdictEn(output.verdict) : output.verdict;
  const confidence = lang === "en"
    ? confidenceEn(output.confidenceTenths)
    : t("share.confidence", { value: output.confidenceTenths });
  return t("share.schoolLine", { school, verdict, confidence });
}

/** 只从公开结果建立卡片模型。 */
// 刻意不复制付款哈希、出生资料、四柱或大运干支。
export function buildShareCard(
  reading: ShareReading,
  lang: Lang,
  t: TFunction,
  options: ShareCardBuildOptions = {},
): ShareCardModel {
  const visibleReading = (lang === "en" ? applyReadingTranslation(reading) : reading) as ShareReading;
  const output = summaryOutput(visibleReading);
  if (visibleReading.kind !== "question" && !visibleReading.chart) {
    throw new ShareCardUnavailableError();
  }
  const sample = options.sample ?? false;
  const common = {
    kind: visibleReading.kind,
    brand: lang === "en" ? "Yarrow" : "三易",
    footer: footerFor(visibleReading.kind, t, sample),
    sample,
  };
  if (visibleReading.kind === "destiny") {
    const portrait = output.portrait;
    const cycles = visibleReading.chart.luck?.cycles ?? [];
    const points = cycles.map((cycle) => ({
      label: t("share.ageRange", { from: cycle.startAge, to: cycle.endAge }),
      value: visibleReading.periods.find((period) => period?.index === cycle.index)?.average ?? null,
    }));
    const traits = portrait?.traits.flatMap((trait) => {
      const translated = translatedText(trait, lang);
      return containsPrivateText(translated, visibleReading) ? [] : [translated];
    }).slice(0, 5) ?? [];
    return {
      ...common,
      kind: "destiny",
      title: t("share.destinyTitle"),
      headline: safeText(
        portrait?.summary ?? output.conclusion,
        visibleReading,
        lang,
        t("share.privateSummary"),
      ),
      lines: [
        t("share.overall", {
          value: safeText(output.conclusion, visibleReading, lang, t("share.privateSummary")),
        }),
        t("share.lifeOutlook", {
          value: safeText(
            output.outlook ?? output.conclusion,
            visibleReading,
            lang,
            t("share.privateSummary"),
          ),
        }),
      ],
      chips: traits.length ? traits : [t("share.privateTrait")],
      chart: { kind: "trend", points },
    };
  }
  if (visibleReading.kind === "question") {
    if (!visibleReading.lines) throw new ShareCardUnavailableError();
    const figures = deriveFiveHexagrams(visibleReading.lines);
    const figureName = (figure: typeof figures.primary) => (
      lang === "en" ? hexagramEn(figure.kingWenNumber) : figure.name
    );
    return {
      ...common,
      kind: "question",
      title: t("share.questionTitle"),
      question: safeQuestion(
        visibleReading.question,
        visibleReading,
        t("share.privateQuestion"),
      ),
      headline: safeText(
        output.conclusion,
        visibleReading,
        lang,
        t("share.privateSummary"),
      ),
      lines: QUESTION_SCHOOLS.map((key) => schoolLine(visibleReading, key, lang, t)),
      chart: {
        kind: "hexagram",
        primary: { name: figureName(figures.primary), lines: [...figures.primary.yangLines] },
        changed: { name: figureName(figures.derived), lines: [...figures.derived.yangLines] },
        moving: visibleReading.lines.flatMap((value, index) => (
          value === 6 || value === 9 ? [index + 1] : []
        )),
      },
    };
  }
  return {
    ...common,
    kind: "fortune",
    title: t("share.fortuneTitle"),
    question: safeQuestion(
      visibleReading.question,
      visibleReading,
      t("share.privateQuestion"),
    ),
    headline: safeText(
      output.conclusion,
      visibleReading,
      lang,
      t("share.privateSummary"),
    ),
    lines: [t("share.tenYearOutlook", {
      value: safeText(
        output.outlook ?? output.conclusion,
        visibleReading,
        lang,
        t("share.privateSummary"),
      ),
    })],
    chart: {
      kind: "trend",
      points: visibleReading.years.map((year) => ({
        label: year ? String(year.year) : "—",
        value: year?.average ?? null,
      })),
    },
  };
}

function fitEllipsis(text: string, maxWidth: number, measure: (value: string) => number): string {
  const ellipsis = "…";
  let value = text.trimEnd();
  while (value && measure(`${value}${ellipsis}`) > maxWidth) value = value.slice(0, -1).trimEnd();
  return `${value}${ellipsis}`;
}

/** 中文按字、英文按词换行；第四个参数是可选的行数上限。 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
  maxLines = 4,
): string[] {
  if (!text || maxLines < 1) return [];
  const chinese = /\p{Script=Han}/u.test(text);
  const units = chinese ? [...text] : text.trim().split(/\s+/u);
  const separator = chinese ? "" : " ";
  const lines: string[] = [];
  let current = "";
  const addOversizedUnit = (unit: string) => {
    let part = "";
    for (const character of unit) {
      const candidate = `${part}${character}`;
      if (part && measure(candidate) > maxWidth) {
        lines.push(part);
        part = character;
      } else {
        part = candidate;
      }
    }
    current = part;
  };
  for (const unit of units) {
    const candidate = current ? `${current}${separator}${unit}` : unit;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = "";
    if (measure(unit) <= maxWidth) current = unit;
    else addOversizedUnit(unit);
  }
  if (current) lines.push(current);
  // 中文排版避头：收尾标点不落在行首，挪到上一行末尾（允许略微超出行宽）。
  for (let index = 1; index < lines.length; index += 1) {
    while (/^[，。、；：！？）」』”’,.;:!?)]/u.test(lines[index]!) && lines[index]!.length > 0) {
      lines[index - 1] = `${lines[index - 1]}${lines[index]!.charAt(0)}`;
      lines[index] = lines[index]!.slice(1);
    }
  }
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index] === "") lines.splice(index, 1);
  }
  const truncated = lines.length > maxLines;
  if (truncated) {
    lines.length = maxLines;
    lines[maxLines - 1] = fitEllipsis(lines[maxLines - 1] ?? "", maxWidth, measure);
  }
  return lines;
}

export type ShareCardColor = "paper" | "gold" | "muted" | "red";
export type ShareCardFont = "brush" | "body" | "latin";
type LayoutBox = Readonly<{ x: number; y: number; width: number; height: number }>;

export interface ShareCardChipLayout extends LayoutBox {
  text: string;
  textX: number;
  textY: number;
}

export interface ShareCardTrendPointLayout {
  label: string;
  x: number;
  y: number | null;
  labelY: number;
}

export interface ShareCardTrendSegmentLayout {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface ShareCardHexagramLineLayout {
  segments: LayoutBox[];
  movingDot?: { x: number; y: number; radius: number } | undefined;
}

export interface ShareCardHexagramFigureLayout {
  name: string;
  nameX: number;
  nameY: number;
  lines: ShareCardHexagramLineLayout[];
}

export type ShareCardLayoutBlock = {
  kind: "text";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  color: ShareCardColor;
  font: ShareCardFont;
  lines: string[];
  lineYs: number[];
} | {
  kind: "chips";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
  items: ShareCardChipLayout[];
} | {
  kind: "trend";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
  referenceY: number;
  points: ShareCardTrendPointLayout[];
  segments: ShareCardTrendSegmentLayout[];
} | {
  kind: "hexagram";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
  figures: ShareCardHexagramFigureLayout[];
  arrow: { text: string; x: number; y: number };
} | {
  kind: "rule";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
} | {
  kind: "frame";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
} | {
  kind: "seal";
  role: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inset: LayoutBox;
  mark: { text: string; x: number; y: number; size: number; font: ShareCardFont };
};

export interface ShareCardLayout {
  width: number;
  height: number;
  blocks: ShareCardLayoutBlock[];
}

export type ShareCardMeasure = (text: string, size: number, font?: ShareCardFont) => number;

function layoutTrend(chart: TrendChart, block: LayoutBox): {
  referenceY: number;
  points: ShareCardTrendPointLayout[];
  segments: ShareCardTrendSegmentLayout[];
} {
  const top = block.y + 24;
  const bottom = block.y + block.height - 70;
  const inset = 56;
  const step = (block.width - inset * 2) / Math.max(1, chart.points.length - 1);
  const pointY = (value: number) => (
    bottom - (Math.max(1, Math.min(9, value)) - 1) / 8 * (bottom - top)
  );
  const points = chart.points.map((point, index) => ({
    label: point.label,
    x: block.x + inset + index * step,
    y: point.value === null ? null : pointY(point.value),
    labelY: block.y + block.height - 22,
  }));
  const segments: ShareCardTrendSegmentLayout[] = [];
  let previous: ShareCardTrendPointLayout | undefined;
  for (const point of points) {
    if (point.y === null) {
      previous = undefined;
      continue;
    }
    if (previous?.y !== null && previous?.y !== undefined) {
      segments.push({
        from: { x: previous.x, y: previous.y },
        to: { x: point.x, y: point.y },
      });
    }
    previous = point;
  }
  return { referenceY: pointY(5), points, segments };
}

function layoutHexagramFigure(
  figure: HexagramCardFigure,
  moving: readonly number[],
  box: LayoutBox,
): ShareCardHexagramFigureLayout {
  // 卦名一行加六爻共约 290 像素，在区块内垂直居中，空间越大越舒展。
  const lineWidth = 220;
  const gap = 28;
  const half = (lineWidth - gap) / 2;
  const top = box.y + Math.max(0, (box.height - 290) / 2);
  const lineX = box.x + (box.width - lineWidth) / 2;
  const lines = Array.from({ length: 6 }, (_, visual) => {
    const position = 5 - visual;
    const lineY = top + 66 + visual * 40;
    const segments = figure.lines[position]
      ? [{ x: lineX, y: lineY, width: lineWidth, height: 16 }]
      : [
        { x: lineX, y: lineY, width: half, height: 16 },
        { x: lineX + half + gap, y: lineY, width: half, height: 16 },
      ];
    const movingDot = moving.includes(position + 1)
      ? { x: lineX + lineWidth + 28, y: lineY + 8, radius: 9 }
      : undefined;
    return { segments, movingDot };
  });
  return {
    name: figure.name,
    nameX: box.x + box.width / 2,
    nameY: top + 32,
    lines,
  };
}

function layoutHexagram(chart: HexagramChart, block: LayoutBox): {
  figures: ShareCardHexagramFigureLayout[];
  arrow: { text: string; x: number; y: number };
} {
  const half = block.width / 2;
  return {
    figures: [
      layoutHexagramFigure(chart.primary, chart.moving, {
        x: block.x, y: block.y, width: half - 35, height: block.height,
      }),
      layoutHexagramFigure(chart.changed, [], {
        x: block.x + half + 35, y: block.y, width: half - 35, height: block.height,
      }),
    ],
    arrow: { text: "→", x: block.x + half, y: block.y + block.height / 2 },
  };
}

/** 固定画布上的全部位置计算；不读取 DOM 或 canvas，Node 测试可直接覆盖。 */
export function layoutShareCard(model: ShareCardModel, measure: ShareCardMeasure): ShareCardLayout {
  // 社交平台上卡片常被缩到约 360 像素宽，字号按此放大：标题 72、结论 48 上下、正文 30。
  const left = 88;
  const width = SHARE_CARD_WIDTH - left * 2;
  const contentTop = 240;
  const footerRuleY = 1222;
  const latin = model.brand !== "三易";
  const header: ShareCardLayoutBlock[] = [
    { kind: "frame", role: "frame", x: 32, y: 32, width: SHARE_CARD_WIDTH - 64, height: SHARE_CARD_HEIGHT - 64 },
    {
      kind: "seal", role: "brand-mark", x: left, y: 78, width: 92, height: 92,
      inset: { x: left + 7, y: 85, width: 78, height: 78 },
      // 中英文统一用朱印「易」；有品牌印图片时绘制图片，否则退回文字。
      mark: { text: "易", x: left + 46, y: 142, size: 52, font: "brush" },
    },
    {
      kind: "text", role: "brand", x: left + 118, y: 92, width: 640, height: 64,
      size: 50, color: "gold", font: latin ? "latin" : "brush",
      lines: [model.brand], lineYs: [144],
    },
    { kind: "rule", role: "header-rule", x: left, y: 206, width, height: 1 },
  ];

  interface Fit { chart: number; lines: number; headline: number }
  const layoutContent = (offset: number, chartHeight: number, fit: Fit) => {
    const blocks: ShareCardLayoutBlock[] = [];
    const addText = (
      role: string,
      text: string,
      y: number,
      size: number,
      maxLines: number,
      color: ShareCardColor = "paper",
      font: ShareCardFont = "body",
      lineRatio = 1.42,
    ) => {
      const lines = wrapText(text, width, (value) => measure(value, size, font), maxLines);
      const lineHeight = Math.round(size * lineRatio);
      blocks.push({
        kind: "text", role, x: left, y, width, height: lines.length * lineHeight,
        size, color, font, lines,
        lineYs: lines.map((_, index) => y + (index + 1) * lineHeight - Math.round(size * 0.3)),
      });
      return y + lines.length * lineHeight;
    };
    let y = addText("title", model.title, contentTop + offset, 72, 1, "gold", latin ? "latin" : "brush", 1.3) + 22;
    if (model.question) {
      y = addText("question-label", model.question, y, 32, 2, "muted") + 20;
    }
    if (model.chips?.length) {
      // 标签放大后一行放不下时折到第二行，最多两行。
      const items: ShareCardChipLayout[] = [];
      const chipHeight = 66;
      let chipX = left;
      let row = 0;
      for (const original of model.chips) {
        const natural = measure(original, 30, "body") + 40;
        if (chipX > left && chipX + natural > left + width) {
          row += 1;
          chipX = left;
        }
        if (row > 1) break;
        const available = left + width - chipX;
        const text = natural <= available ? original
          : fitEllipsis(original, Math.max(1, available - 40), (value) => measure(value, 30, "body"));
        const chipWidth = Math.min(measure(text, 30, "body") + 40, available);
        const chipY = y + row * (chipHeight + 14);
        items.push({
          text, x: chipX, y: chipY, width: chipWidth, height: chipHeight,
          textX: chipX + chipWidth / 2, textY: chipY + 44,
        });
        chipX += chipWidth + 14;
      }
      const rows = items.length ? Math.max(...items.map((item) => item.y)) - y + chipHeight : 0;
      blocks.push({ kind: "chips", role: "chips", x: left, y, width, height: rows, items });
      y += rows + 30;
    }
    // 结论排不下时先缩字号再截断：英文总评常比中文长一倍。
    const headlineSize = model.kind === "question" ? 46 : 48;
    const fitsAt = (size: number) => wrapText(model.headline, width, (value) => measure(value, size, "body"),
      fit.headline + 1).length <= fit.headline;
    const headlineFinal = fitsAt(headlineSize) ? headlineSize : fitsAt(40) ? 40 : headlineSize - 6;
    y = addText("headline", model.headline, y, headlineFinal, fit.headline) + 26;
    if (model.chart) {
      const chartBox = { x: left, y, width, height: chartHeight };
      if (model.chart.kind === "trend") {
        blocks.push({ kind: "trend", role: "chart", ...chartBox, ...layoutTrend(model.chart, chartBox) });
      } else {
        blocks.push({ kind: "hexagram", role: "chart", ...chartBox, ...layoutHexagram(model.chart, chartBox) });
      }
      y += chartHeight + 26;
    }
    for (const [index, line] of model.lines.entries()) {
      y = addText(`line-${index}`, line, y, 30, model.kind === "question" ? 2 : fit.lines) + 14;
    }
    return { blocks, end: y };
  };

  // 由宽到紧依次尝试，取第一档放得下的；剩余空间先给图表（走势最多加 220、卦画最多加 120），
  // 仍有余则整体下移居中。最紧一档仍放不下时照用，正文行数已压到最少。
  const bottomLimit = footerRuleY - 36;
  const fits: Fit[] = [
    { chart: 300, lines: 4, headline: 4 },
    { chart: 280, lines: 3, headline: 4 },
    { chart: 240, lines: 3, headline: 3 },
    { chart: 210, lines: 2, headline: 3 },
    // 先压次要的总评与走势概括，再压结论，免得结论断在半句。
    { chart: 190, lines: 1, headline: 3 },
    { chart: 170, lines: 1, headline: 2 },
  ];
  let fit = fits.at(-1)!;
  let first = layoutContent(0, fit.chart, fit);
  for (const candidate of fits) {
    const attempt = layoutContent(0, candidate.chart, candidate);
    if (attempt.end <= bottomLimit) {
      fit = candidate;
      first = attempt;
      break;
    }
  }
  let spare = Math.max(0, bottomLimit - first.end);
  const grow = model.chart ? Math.min(spare, model.chart.kind === "trend" ? 220 : 120) : 0;
  spare -= grow;
  const content = layoutContent(Math.floor(spare / 2), fit.chart + grow, fit);
  const blocks: ShareCardLayoutBlock[] = [...header, ...content.blocks];
  blocks.push({ kind: "rule", role: "footer-rule", x: left, y: footerRuleY, width, height: 1 });
  const footerLines = wrapText(model.footer, width, (value) => measure(value, 26, "latin"), 2);
  blocks.push({
    kind: "text", role: "footer", x: left, y: footerRuleY + 18, width, height: footerLines.length * 36,
    size: 26, color: "muted", font: "latin", lines: footerLines,
    lineYs: footerLines.map((_, index) => footerRuleY + 52 + index * 36),
  });
  return { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, blocks };
}

export interface ShareCardFonts {
  brush?: string | undefined;
  body?: string | undefined;
  latin?: string | undefined;
}

const COLORS: Record<ShareCardColor, string> = {
  paper: "#EAE5D9",
  gold: "#C9A866",
  muted: "#A9A59B",
  red: "#A63A2B",
};

function fontFor(fonts: ShareCardFonts, role: ShareCardFont, size: number): string {
  const family = role === "brush" ? fonts.brush ?? "STKaiti, KaiTi, serif"
    : role === "latin" ? fonts.latin ?? "Georgia, serif"
      : fonts.body ?? "Songti SC, STSong, Georgia, serif";
  return `${size}px ${family}`;
}

function drawTrend(
  ctx: CanvasRenderingContext2D,
  block: Extract<ShareCardLayoutBlock, { kind: "trend" }>,
  fonts: ShareCardFonts,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(201,168,102,.42)";
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(block.x, block.referenceY);
  ctx.lineTo(block.x + block.width, block.referenceY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 5;
  ctx.beginPath();
  block.segments.forEach((segment) => {
    ctx.moveTo(segment.from.x, segment.from.y);
    ctx.lineTo(segment.to.x, segment.to.y);
  });
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.font = fontFor(fonts, "latin", 22);
  ctx.textAlign = "center";
  block.points.forEach((point) => {
    if (point.y !== null) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    // 英文刻度「ages 10–19」八个并排会连成一串，画时去掉前缀，只写年龄段。
    ctx.fillText(point.label.replace(/^ages\s+/iu, ""), point.x, point.labelY);
  });
  ctx.restore();
}

function drawFigure(
  ctx: CanvasRenderingContext2D,
  figure: ShareCardHexagramFigureLayout,
  fonts: ShareCardFonts,
): void {
  ctx.fillStyle = COLORS.gold;
  ctx.font = fontFor(fonts, "body", 32);
  ctx.textAlign = "center";
  ctx.fillText(figure.name, figure.nameX, figure.nameY);
  for (const line of figure.lines) {
    ctx.fillStyle = COLORS.paper;
    line.segments.forEach((segment) => (
      ctx.fillRect(segment.x, segment.y, segment.width, segment.height)
    ));
    if (line.movingDot) {
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(line.movingDot.x, line.movingDot.y, line.movingDot.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHexagram(
  ctx: CanvasRenderingContext2D,
  block: Extract<ShareCardLayoutBlock, { kind: "hexagram" }>,
  fonts: ShareCardFonts,
): void {
  drawFigure(ctx, block.figures[0]!, fonts);
  ctx.fillStyle = COLORS.gold;
  ctx.font = fontFor(fonts, "latin", 46);
  ctx.textAlign = "center";
  ctx.fillText(block.arrow.text, block.arrow.x, block.arrow.y);
  drawFigure(ctx, block.figures[1]!, fonts);
}

/** canvas 薄封装：位置与换行全部由 layoutShareCard 计算。 */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  model: ShareCardModel,
  fonts: ShareCardFonts = {},
  assets: { mark?: CanvasImageSource | undefined } = {},
): void {
  ctx.canvas.width = SHARE_CARD_WIDTH;
  ctx.canvas.height = SHARE_CARD_HEIGHT;
  ctx.fillStyle = "#0F1110";
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
  const layout = layoutShareCard(model, (text, size, font) => {
    ctx.font = fontFor(fonts, font ?? "body", size);
    return ctx.measureText(text).width;
  });
  for (const block of layout.blocks) {
    if (block.kind === "text") {
      ctx.fillStyle = COLORS[block.color];
      ctx.font = fontFor(fonts, block.font, block.size);
      ctx.textAlign = "left";
      block.lines.forEach((line, index) => ctx.fillText(line, block.x, block.lineYs[index]!));
    } else if (block.kind === "frame") {
      ctx.strokeStyle = "rgba(201,168,102,.28)";
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x, block.y, block.width, block.height);
    } else if (block.kind === "seal" && assets.mark) {
      // 品牌印图片（朱印「易」），与站点顶栏、图标一致。
      ctx.drawImage(assets.mark, block.x, block.y, block.width, block.height);
    } else if (block.kind === "seal") {
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(block.x, block.y, block.width, block.height);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(block.inset.x, block.inset.y, block.inset.width, block.inset.height);
      ctx.fillStyle = COLORS.paper;
      ctx.font = fontFor(fonts, block.mark.font, block.mark.size);
      ctx.textAlign = "center";
      ctx.fillText(block.mark.text, block.mark.x, block.mark.y);
    } else if (block.kind === "rule") {
      ctx.fillStyle = "rgba(201,168,102,.42)";
      ctx.fillRect(block.x, block.y, block.width, block.height);
    } else if (block.kind === "chips") {
      ctx.font = fontFor(fonts, "body", 30);
      ctx.lineWidth = 2;
      for (const item of block.items) {
        ctx.strokeStyle = COLORS.gold;
        ctx.strokeRect(item.x, item.y, item.width, item.height);
        ctx.fillStyle = COLORS.gold;
        ctx.textAlign = "center";
        ctx.fillText(item.text, item.textX, item.textY);
      }
    } else if (block.kind === "trend") {
      drawTrend(ctx, block, fonts);
    } else if (block.kind === "hexagram") {
      drawHexagram(ctx, block, fonts);
    }
  }
}
