// src/sanyi/repair.ts
// 删错留对：重写两次后仍不符时，删去与盘面不符的句子、短评与引证，校正吉凶与把握，其余照常展示。
// 句子级检查复用核对器本身，修补后的输出因此必然通过核对。
import type { BaziChart } from "../calendar/bazi.js";
import { auditQuestionEvidence, auditQuestionProse } from "./audit.js";
import {
  auditQuestionEnglishProse,
  englishBodyErrors,
  englishForbiddenErrors,
} from "./english/audit.js";
import { VERDICTS_EN } from "./i18n/glossary.js";
import { auditBaziEvidence, auditBaziNote, auditBaziPeriodNote, auditBaziProse,
  baziProse } from "./bazi-audit.js";
import type { BaziSchoolOutput } from "./bazi-schema.js";
import type { FortuneHorizon } from "./classify.js";
import type { FactTable } from "./facts.js";
import type { QuestionSchoolOutput, Verdict } from "./schema.js";

export interface RepairResult<T> {
  output: T;
  /** 删去的句子、短评、引证、应期处数。 */
  removed: number;
  /** 校正的吉凶把握处数（把握夹回范围、所问之年对齐总断、补缺时柱说明）。 */
  adjusted: number;
}

/** 按句号、问号、叹号、分号与换行切句，标点留在句尾。 */
export function splitSentences(text: string, language: "zh" | "en" = "zh"): string[] {
  if (language === "zh") {
    return text.match(/[^。！？；\n]+[。！？；\n]?|[。！？；\n]/gu) ?? [];
  }
  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    const decimal = character === "." && /\d/u.test(text[index - 1] ?? "")
      && /\d/u.test(text[index + 1] ?? "");
    if ((character !== "." && character !== "!" && character !== "?"
      && character !== ";" && character !== "\n") || decimal) continue;
    let end = index + 1;
    if (character !== "\n") {
      while (text[end] === " " || text[end] === "\t") end += 1;
    }
    sentences.push(text.slice(start, end));
    start = end;
    index = end - 1;
  }
  if (start < text.length) sentences.push(text.slice(start));
  return sentences;
}

/** 把握夹回该吉凶等级允许的范围：吉以上不低于六成，平为四至六成，凶以下不高于四成。 */
export function clampConfidence(verdict: Verdict, confidence: number): number {
  if (verdict === "大吉" || verdict === "吉") {
    return Math.max(6, confidence);
  }
  if (verdict === "平") {
    return Math.min(6, Math.max(4, confidence));
  }
  return Math.min(4, confidence);
}

/** 逐句检查一段文字，删去有错的句子，返回剩余文字与删去句数。 */
export function keepValidSentences(
  text: string,
  check: (sentence: string) => string[],
  language: "zh" | "en" = "zh",
): { text: string; removed: number } {
  let removed = 0;
  const kept = splitSentences(text, language).filter((sentence) => {
    if (check(sentence).length === 0) {
      return true;
    }
    removed += 1;
    return false;
  });
  return { text: kept.join("").trim(), removed };
}

const REASON_REMOVED = "此家理由与盘面不符的部分已删去。";
const SECTIONS_REMOVED = "此家详断与盘面不符的部分已删去。";
const REASON_REMOVED_EN = "Parts of this reasoning that did not match the chart were removed.";
const SECTIONS_REMOVED_EN = "Parts of this interpretation that did not match the chart were removed.";

export function repairQuestion(
  output: QuestionSchoolOutput,
  facts: FactTable,
  language: "zh" | "en" = "zh",
): RepairResult<QuestionSchoolOutput> {
  let removed = 0;
  let adjusted = 0;
  const check = language === "en"
    ? (sentence: string) => [
        ...englishBodyErrors([sentence]),
        ...auditQuestionEnglishProse(sentence, facts),
        ...englishForbiddenErrors(sentence),
      ]
    : (sentence: string) => auditQuestionProse(sentence, facts);
  const evidence = output.evidence.filter((item) => auditQuestionEvidence(item, facts).length === 0);
  removed += output.evidence.length - evidence.length;
  const confidenceTenths = clampConfidence(output.verdict, output.confidenceTenths);
  if (confidenceTenths !== output.confidenceTenths) {
    adjusted += 1;
  }
  const headline = keepValidSentences(output.headline, check, language);
  removed += headline.removed;
  const reason = keepValidSentences(output.reason, check, language);
  removed += reason.removed;
  const sections = output.sections.map((section) => {
    const kept = keepValidSentences(section.text, check, language);
    removed += kept.removed;
    const title = language === "en" && [
      ...englishBodyErrors([section.title]),
      ...englishForbiddenErrors(section.title),
    ].length > 0
      ? "Details"
      : section.title;
    if (kept.text) return { title, text: kept.text };
    return language === "en"
      ? { title, text: SECTIONS_REMOVED_EN }
      : null;
  }).filter((section): section is { title: string; text: string } => section !== null);
  const advice = language === "en"
    ? output.advice.map((item) => keepValidSentences(item, check, language))
      .filter((item) => {
        removed += item.removed;
        return item.text !== "";
      }).map((item) => item.text)
    : output.advice;
  let timing = output.timing;
  if (language === "en" && timing) {
    const window = keepValidSentences(timing.window, check, language);
    const condition = keepValidSentences(timing.condition, check, language);
    removed += window.removed + condition.removed;
    timing = window.text && condition.text
      ? { window: window.text, condition: condition.text }
      : undefined;
  }
  const fallbackHeadline = language === "en"
    ? `${VERDICTS_EN[output.verdict]}, about ${confidenceTenths}/10`
    : `${output.verdict}，约${confidenceTenths}成`;
  const repaired: QuestionSchoolOutput = {
    ...output,
    confidenceTenths,
    headline: headline.text || fallbackHeadline,
    reason: reason.text || (language === "en" ? REASON_REMOVED_EN : REASON_REMOVED),
    sections: sections.length > 0 ? sections : [{
      title: language === "en" ? "Details" : "详断",
      text: language === "en" ? SECTIONS_REMOVED_EN : SECTIONS_REMOVED,
    }],
    advice: advice.length > 0 ? advice : language === "en"
      ? ["Use practical judgment before acting."]
      : advice,
    evidence,
  };
  if (language === "en") {
    if (timing) repaired.timing = timing;
    else delete repaired.timing;
  }
  return { output: repaired, removed, adjusted };
}

export function repairBazi(
  output: BaziSchoolOutput,
  facts: FactTable,
  chart: BaziChart,
  horizon: FortuneHorizon,
): RepairResult<BaziSchoolOutput> {
  let removed = 0;
  let adjusted = 0;
  const check = (sentence: string) => auditBaziProse(sentence, facts);
  const evidence = output.evidence.filter((item) => auditBaziEvidence(item, facts).length === 0);
  removed += output.evidence.length - evidence.length;
  const text = (value: string) => {
    const kept = keepValidSentences(value, check);
    removed += kept.removed;
    return kept.text;
  };
  const useGod = text(output.useGod) || "未定";
  const headline = text(output.headline);
  const reason = text(output.reason) || REASON_REMOVED;
  const sections = output.sections.map((section) => {
    return { title: section.title, text: text(section.text) || "（此段与盘面不符，已删去）" };
  });
  const advice = output.advice.map((item) => text(item)).filter((item) => item !== "");
  const base = {
    ...output, useGod, reason, sections, evidence,
    advice: advice.length > 0 ? advice : ["结合实际情况审慎判断。"],
  };
  if (!("verdict" in output)) {
    const allowed = new Set(chart.luck?.cycles.map((item) => item.index) ?? []);
    const unique = new Map<number, NonNullable<typeof output.periods>[number]>();
    for (const item of output.periods ?? []) {
      if (!allowed.has(item.index) || unique.has(item.index)) {
        removed += 1;
      } else {
        unique.set(item.index, item);
      }
    }
    const periods = (chart.luck?.cycles ?? []).flatMap((cycle) => {
      const item = unique.get(cycle.index);
      if (!item) {
        return [];
      }
      let next = { ...item };
      if (auditBaziPeriodNote(item, facts).length > 0) {
        removed += 1;
        next = { ...next, note: "" };
      }
      const clamped = clampConfidence(next.verdict, next.confidenceTenths);
      if (clamped !== next.confidenceTenths) {
        adjusted += 1;
        next = { ...next, confidenceTenths: clamped };
      }
      return [next];
    });
    const repaired = { ...base, headline: headline || `取${useGod}`, periods } as BaziSchoolOutput;
    return finishLimit(repaired, facts, removed, adjusted);
  }
  const confidenceTenths = clampConfidence(output.verdict, output.confidenceTenths);
  if (confidenceTenths !== output.confidenceTenths) {
    adjusted += 1;
  }
  let timing = output.timing;
  if (timing) {
    const window = text(timing.window);
    const condition = text(timing.condition);
    // 窗口或条件被删空时整条应期去掉；删去的句子已计入 removed。
    timing = window && condition ? { window, condition } : undefined;
  }
  // 逐年：只留窗口内年份（缺年不补），短评不符则删去，把握夹回，所问之年对齐总断。
  const windowYears = new Set(chart.liunian.years.map((item) => item.year));
  const wholeYear = horizon === "year" || horizon === "next-year" || horizon.startsWith("year:");
  const anchorYear = chart.liunian.anchorYear;
  const years = output.years.filter((item) => windowYears.has(item.year)).map((item) => {
    let next = { ...item };
    if (auditBaziNote(item, facts).length > 0) {
      removed += 1;
      next = { ...next, note: "" };
    }
    const clamped = clampConfidence(next.verdict, next.confidenceTenths);
    if (clamped !== next.confidenceTenths) {
      adjusted += 1;
      next = { ...next, confidenceTenths: clamped };
    }
    if (wholeYear && next.year === anchorYear
      && (next.verdict !== output.verdict || next.confidenceTenths !== confidenceTenths)) {
      adjusted += 1;
      next = { ...next, verdict: output.verdict, confidenceTenths };
    }
    return next;
  });
  const repaired = {
    ...base,
    headline: headline || `${output.verdict}，约${confidenceTenths}成`,
    confidenceTenths,
    years,
  } as BaziSchoolOutput & { timing?: unknown };
  if (timing) {
    repaired.timing = timing;
  } else {
    delete repaired.timing;
  }
  return finishLimit(repaired as BaziSchoolOutput, facts, removed, adjusted);
}

/** 缺时柱而正文没说明限制时，在理由前补一句说明。 */
function finishLimit(
  output: BaziSchoolOutput,
  facts: FactTable,
  removed: number,
  adjusted: number,
): RepairResult<BaziSchoolOutput> {
  if (facts.has("chart:limit") && !/缺时柱|时辰未知/u.test(baziProse(output).join("\n"))) {
    return { output: { ...output, reason: `缺时柱，判断存在限制。${output.reason}` }, removed, adjusted: adjusted + 1 };
  }
  return { output, removed, adjusted };
}
