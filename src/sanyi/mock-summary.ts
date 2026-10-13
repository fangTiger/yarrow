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
