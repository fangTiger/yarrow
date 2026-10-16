// src/sanyi/mock-summary.ts
// 确定性白话总述，供测试与排练：按提示词中的合议倾向生成，不含任何干支与盘面组合，必然通过核对。
import type { PlainSummary, SummaryKind, SummaryTone } from "./summary.js";

const CONCLUSIONS: Record<SummaryTone, string> = {
  顺: "整体偏顺，按计划推进即可。",
  中: "成败参半，眼下还说不准，宜边做边看。",
  不顺: "整体偏不顺，宜放慢脚步、做足准备。",
};

export function mockSummaryOutput(kind: SummaryKind, prompt: string): PlainSummary {
  const tone = prompt.match(/合议倾向：(顺|中|不顺)/u)?.[1] as SummaryTone | undefined;
  const output: PlainSummary = {
    conclusion: kind === "destiny" ? "三家各有侧重，适合发挥所长、稳步积累。" : CONCLUSIONS[tone ?? "中"],
    agreement: "三家都认为当前的关键在于把握时机、量力而行。",
    difference: "三家对时机早晚的看法略有不同。",
    explanation: [
      "三家从不同角度看同一件事，结论大体相近。",
      "眼下的有利条件和不利条件并存，需要结合自身情况判断。",
    ],
    remedy: {
      principle: "先稳住自己，再看时机行事。",
      plan: [
        { action: "先把手头能做的准备做足", basis: "三家都认为关键在把握时机", timing: "近期" },
        { action: "关键节点前多留一些余地", basis: "有利与不利条件并存" },
      ],
      avoid: ["不要急于求成"],
    },
  };
  if (kind !== "destiny" && tone) {
    output.tone = tone;
  }
  if (kind === "destiny") {
    output.portrait = {
      traits: ["重情义", "求稳", "有担当"],
      strengths: ["做事稳妥，能够顾全大局", "遇到责任愿意主动承担"],
      blindSpots: ["顾虑较多时容易迟疑", "压力之下偶尔过于坚持"],
      summary: "重承诺也重秩序，稳中带着韧劲。",
    };
    if (prompt.includes("逐运合议：")) {
      output.outlook = "早年宜稳住根基，中年渐有转机，往后以守成为先。";
    }
  }
  if (kind === "fortune") {
    output.outlook = "十年之中有起有伏，前几年宜守，后几年渐有转机。";
  }
  return output;
}

/** 原生英文排练输出，不含盘面术语，稳定通过英文核对。 */
export function mockEnglishSummaryOutput(kind: SummaryKind, prompt: string): PlainSummary {
  const tone = prompt.match(/合议倾向：(顺|中|不顺)/u)?.[1] as SummaryTone | undefined;
  const conclusion = tone === "顺"
    ? "The overall outlook is favorable, so proceed with practical checks."
    : tone === "不顺"
      ? "The outlook is unfavorable, so slow down and prepare a fallback."
      : "The outcome remains mixed, so wait for clearer conditions.";
  const output: PlainSummary = {
    conclusion: kind === "destiny"
      ? "The three readings favor steady growth through practical use of existing strengths."
      : conclusion,
    agreement: "All three readings favor preparation over haste.",
    difference: "They place different weight on timing and present conditions.",
    explanation: [
      "Helpful and limiting signs are both present.",
      "A practical fallback reduces the cost of waiting.",
    ],
    remedy: {
      principle: "Stay steady and act when the conditions become clear.",
      plan: [
        { action: "Verify the practical conditions", basis: "The three readings agree", timing: "Soon" },
        { action: "Keep another option open", basis: "The outcome remains mixed" },
      ],
      avoid: ["Do not force an immediate answer."],
    },
  };
  if (kind !== "destiny") output.tone = tone ?? "中";
  if (kind === "destiny") {
    output.portrait = {
      traits: ["Steady", "Responsible", "Thoughtful"],
      strengths: [
        "Plans carefully and follows through on commitments.",
        "Handles responsibility with patience and consistency.",
      ],
      blindSpots: [
        "May hesitate when too many concerns compete for attention.",
        "Can hold a position longer than changing conditions warrant.",
      ],
      summary: "A steady, duty-minded temperament works best with room to adapt.",
    };
    if (prompt.includes("逐运合议：")) {
      output.outlook = "Earlier periods build the base, while later periods reward selective action.";
    }
  }
  if (kind === "fortune") {
    output.outlook = "The ten-year pattern is mixed at first and becomes more supportive later.";
  }
  return output;
}
