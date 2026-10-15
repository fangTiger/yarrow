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
  const top = block.y + 18;
  const bottom = block.y + block.height - 58;
  const step = block.width / Math.max(1, chart.points.length - 1);
  const pointY = (value: number) => (
    bottom - (Math.max(1, Math.min(9, value)) - 1) / 8 * (bottom - top)
  );
  const points = chart.points.map((point, index) => ({
    label: point.label,
    x: block.x + index * step,
    y: point.value === null ? null : pointY(point.value),
    labelY: block.y + block.height - 18,
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
  const lineWidth = 164;
  const lineX = box.x + (box.width - lineWidth) / 2;
  const lines = Array.from({ length: 6 }, (_, visual) => {
    const position = 5 - visual;
    const lineY = box.y + 60 + visual * 30;
    const segments = figure.lines[position]
      ? [{ x: lineX, y: lineY, width: lineWidth, height: 12 }]
      : [
        { x: lineX, y: lineY, width: 68, height: 12 },
        { x: lineX + 96, y: lineY, width: 68, height: 12 },
      ];
    const movingDot = moving.includes(position + 1)
      ? { x: lineX + lineWidth + 22, y: lineY + 6, radius: 7 }
      : undefined;
    return { segments, movingDot };
  });
  return {
    name: figure.name,
    nameX: box.x + box.width / 2,
    nameY: box.y + 28,
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
  const blocks: ShareCardLayoutBlock[] = [];
  const left = 72;
  const width = SHARE_CARD_WIDTH - left * 2;
  const addText = (
    role: string,
    text: string,
    y: number,
    size: number,
    maxLines: number,
    color: ShareCardColor = "paper",
    font: ShareCardFont = "body",
  ) => {
    const lines = wrapText(text, width, (value) => measure(value, size, font), maxLines);
    const lineHeight = Math.round(size * 1.45);
    blocks.push({
      kind: "text", role, x: left, y, width, height: lines.length * lineHeight,
      size, color, font, lines,
      lineYs: lines.map((_, index) => y + (index + 1) * lineHeight),
    });
    return y + lines.length * lineHeight;
  };

  blocks.push({
    kind: "seal", role: "brand-mark", x: left, y: 58, width: 82, height: 82,
    inset: { x: left + 6, y: 64, width: 70, height: 70 },
    mark: {
      text: model.brand === "三易" ? "易" : "Y",
      x: left + 41,
      y: 115,
      size: 42,
      font: model.brand === "三易" ? "brush" : "latin",
    },
  });
  blocks.push({
    kind: "text", role: "brand", x: 176, y: 70, width: 760, height: 58,
    size: 42, color: "gold", font: model.brand === "三易" ? "brush" : "latin",
    lines: [model.brand], lineYs: [131],
  });
  blocks.push({ kind: "rule", role: "header-rule", x: left, y: 164, width, height: 1 });
  let y = addText("title", model.title, 202, 56, 1, "gold", "brush") + 20;
  if (model.question) {
    y = addText("question-label", model.question, y, 27, 2, "muted") + 22;
  }
  if (model.chips?.length) {
    const items: ShareCardChipLayout[] = [];
    let chipX = left;
    for (const original of model.chips) {
      const available = left + width - chipX;
      if (available < 44) break;
      const text = measure(original, 22, "body") + 30 <= available
        ? original
        : fitEllipsis(original, Math.max(1, available - 30), (value) => (
          measure(value, 22, "body")
        ));
      const chipWidth = Math.min(measure(text, 22, "body") + 30, available);
      items.push({
        text, x: chipX, y, width: chipWidth, height: 54,
        textX: chipX + chipWidth / 2, textY: y + 36,
      });
      chipX += chipWidth + 12;
    }
    blocks.push({ kind: "chips", role: "chips", x: left, y, width, height: 54, items });
    y += 78;
  }
  y = addText("headline", model.headline, y, model.kind === "question" ? 35 : 38, 3) + 24;
  const chartHeight = model.chart?.kind === "hexagram" ? 292 : 276;
  if (model.chart) {
    const chartBox = { x: left, y, width, height: chartHeight };
    if (model.chart.kind === "trend") {
      blocks.push({
        kind: "trend", role: "chart", ...chartBox, ...layoutTrend(model.chart, chartBox),
      });
    } else {
      blocks.push({
        kind: "hexagram", role: "chart", ...chartBox, ...layoutHexagram(model.chart, chartBox),
      });
    }
    y += chartHeight + 24;
  }
  const lineLimit = model.kind === "question" ? 2 : 3;
  for (const [index, line] of model.lines.entries()) {
    y = addText(`line-${index}`, line, y, model.kind === "question" ? 24 : 26, lineLimit) + 14;
  }
  blocks.push({ kind: "rule", role: "footer-rule", x: left, y: 1212, width, height: 1 });
  addText("footer", model.footer, 1242, 21, 2, "muted", "latin");
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
  ctx.lineWidth = 4;
  ctx.beginPath();
  block.segments.forEach((segment) => {
    ctx.moveTo(segment.from.x, segment.from.y);
    ctx.lineTo(segment.to.x, segment.to.y);
  });
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.font = fontFor(fonts, "latin", 17);
  ctx.textAlign = "center";
  block.points.forEach((point) => {
    if (point.y !== null) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillText(point.label, point.x, point.labelY);
  });
  ctx.restore();
}

function drawFigure(
  ctx: CanvasRenderingContext2D,
  figure: ShareCardHexagramFigureLayout,
  fonts: ShareCardFonts,
): void {
  ctx.fillStyle = COLORS.gold;
  ctx.font = fontFor(fonts, "body", 25);
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
  ctx.font = fontFor(fonts, "latin", 34);
  ctx.textAlign = "center";
  ctx.fillText(block.arrow.text, block.arrow.x, block.arrow.y);
  drawFigure(ctx, block.figures[1]!, fonts);
}

/** canvas 薄封装：位置与换行全部由 layoutShareCard 计算。 */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  model: ShareCardModel,
  fonts: ShareCardFonts = {},
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
      ctx.font = fontFor(fonts, "body", 22);
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
