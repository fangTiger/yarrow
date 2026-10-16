// src/sanyi/mock-schools.ts
import type { FactTable } from "./facts.js";
import type { QuestionSchoolOutput } from "./schema.js";
import type { QuestionSchoolKey } from "./schools/index.js";

const SETTINGS = {
  chengyi: { verdict: "吉", confidenceTenths: 6, ref: "main-text" },
  jingfang: { verdict: "平", confidenceTenths: 5, ref: "use-god" },
  shaoyong: { verdict: "凶", confidenceTenths: 4, ref: "body-use" },
} as const;

export function mockSchoolOutput(
  key: QuestionSchoolKey,
  facts: FactTable,
): QuestionSchoolOutput {
  const setting = SETTINGS[key];
  const fact = facts.get(setting.ref);
  if (!fact) {
    throw new Error(`mock 缺少事实：${setting.ref}`);
  }
  return {
    verdict: setting.verdict,
    confidenceTenths: setting.confidenceTenths,
    headline: "守正待时",
    reason: "依盘面事实判断，宜先核实条件",
    sections: [
      { title: "依据", text: fact.label },
      { title: "判断", text: "条件尚未齐备" },
      { title: "行动", text: "先核实客观条件" },
    ],
    advice: ["保留调整余地"],
    evidence: [{ ref: fact.id, claim: [...fact.tokens].join(" ") }],
  };
}

export function mockEnglishSchoolOutput(
  key: QuestionSchoolKey,
  facts: FactTable,
): QuestionSchoolOutput {
  const setting = SETTINGS[key];
  const fact = facts.get(setting.ref);
  if (!fact) throw new Error(`mock 缺少事实：${setting.ref}`);
  return {
    verdict: setting.verdict,
    confidenceTenths: setting.confidenceTenths,
    headline: "Wait for clearer conditions",
    reason: "The available signs favor preparation before commitment.",
    sections: [
      { title: "Basis", text: "The supplied chart fact sets the main constraint." },
      { title: "Judgment", text: "The conditions are not fully settled yet." },
      { title: "Action", text: "Keep a practical fallback and verify new information." },
    ],
    advice: ["Leave room to adjust."],
    evidence: [{ ref: fact.id, claim: fact.label }],
  };
}
