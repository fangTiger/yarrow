// src/sanyi/schools/bazi-shared.ts
import type { BaziChart } from "../../calendar/bazi.js";
import type { QiongtongEntry } from "../../calendar/qiongtong.js";
import type { FortuneHorizon } from "../classify.js";
import type { FactTable } from "../facts.js";
export type BaziSchoolKey = "shenxiaozhan" | "yuchuntai" | "rentieqiao";
export interface BaziSchoolInput {
  kind: "destiny" | "fortune";
  question: string;
  horizon: FortuneHorizon;
  chart: BaziChart;
  facts: FactTable;
  tiaohou: QiongtongEntry;
  // B5 按注入时钟生成今天/本月事实，B4 不从系统时钟或问题文本猜流日。
  period: {
    label: string;
    facts: FactTable;
  };
}
export interface BaziSchool {
  key: BaziSchoolKey;
  name: string;
  school: string;
  systemPrompt: string;
  buildUserPrompt(input: BaziSchoolInput): string;
}
const ALLOWED: Record<BaziSchoolKey, readonly string[]> = {
  shenxiaozhan: ["pillar:", "hidden:", "structure:month", "structure:roots", "relation:", "luck:"],
  yuchuntai: ["pillar:", "hidden:", "tiaohou", "elements", "luck:"],
  rentieqiao: ["pillar:", "hidden:", "structure:roots", "relation:", "elements", "luck:"],
};
export const BAZI_BOUNDARIES = `只能引用随请求提供的原文，不得补写或编造引文。
问题可能是英文，请仍用中文作答。
不得编造排盘数据，不得虚构外应；应期必须写明成立条件。
不做医疗、法律、投资结论，健康问题建议就医。
缺时柱时须说明判断限制，不得引用时柱、命宫或身宫事实。
evidence.ref 只能使用可用事实编号，claim 只陈述该事实支持的关键词。
useGod 只写一句本派所取用神与喜忌，不超过二十字，例如「身弱取印比，用土金，忌火木」；推理写在 reason 与详断中。
命理不得输出吉凶、把握、逐年列表或 timing，五分项依次为性格、事业、财运、感情、健康。
正文与 timing 只谈所问时间范围；其它年份的干支、关系只写在对应年份的短评中。
运势须回应所问时间范围，years 按逐年窗口升序每年一项，通常十年；出生年与上限裁剪后以实际窗口为准。
每项包含 year、verdict、confidenceTenths、note，短评不超过二十四字（含标点），只用该年与原局事实。
逐年吉凶必须依据本派所取用神的喜忌判断：流年干支（含藏干）生扶用神或制伏忌神，偏吉；克泄用神或助起忌神，偏凶。冲合刑害引动用神或忌神时，相应加减。
喜忌明确的年份要给出吉或凶，不要一律写平；只有喜忌相抵、确实难分的年份才写平。
短评要点出该年吉凶的依据，例如「戊土生身，印旺得扶」，不要只罗列干支、十神。
不得为了凑出起伏而编造事实；依据只能来自该年事实与原局事实。
问整年时锚年那项的 verdict 和 confidenceTenths 与总断相同，今天、本月不要求一致。
吉与大吉为六至九成，平为四至六成，凶与大凶为一至四成，总断和逐年均遵守。
需要留意的月份或日子写入 timing.window，成立条件写入 timing.condition。
输出必须严格符合给定 JSON Schema。`;
export function selectBaziFacts(key: BaziSchoolKey, input: BaziSchoolInput): FactTable {
  const facts: FactTable = new Map();
  for (const [id, fact] of input.facts) {
    const allowed = ALLOWED[key].some((prefix) => id === prefix || id.startsWith(prefix));
    const monthFact = input.kind === "fortune" && id.startsWith("liuyue:");
    const yearFact = input.kind === "fortune" && id.startsWith("year:");
    if (id === "chart:limit" || allowed || yearFact || monthFact) {
      if (input.kind === "destiny" && id.startsWith("relation:") && fact.label.startsWith("year ")) {
        continue;
      }
      // 余家逐年只收运年干支、十神与藏干，不追加格局派使用的关系和神煞。
      if (key === "yuchuntai" && yearFact) {
        const match = fact.label.match(/^(\d{4}) 年/u);
        const entry = input.chart.liunian.years.find((year) => String(year.year) === match?.[1]);
        if (!entry) {
          throw new Error("调候派缺少对应流年事实");
        }
        const tokens = [entry.ganZhi, entry.stem, entry.branch, entry.stemGod,
          ...entry.hidden.flatMap((hidden) => [hidden.stem, hidden.god])];
        if (entry.luck) {
          tokens.push(entry.luck.ganZhi, entry.luck.stemGod);
        }
        facts.set(id, { id, label: `${entry.year} 年 ${tokens.join(" ")}`, tokens: new Set(tokens) });
      } else {
        facts.set(id, fact);
      }
    }
  }
  if (input.kind === "fortune") {
    for (const [id, fact] of input.period.facts) {
      if (!id.startsWith("period:")) {
        throw new Error("时间范围事实编号须以 period: 开头");
      }
      if (key === "yuchuntai") {
        const tokens = [...fact.tokens].filter((token) => {
          return /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{1,2}$/u.test(token)
            || ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"].includes(token);
        });
        facts.set(id, { id, label: `${input.period.label} ${tokens.join(" ")}`, tokens: new Set(tokens) });
      } else {
        facts.set(id, fact);
      }
    }
  }
  return facts;
}
export function buildBaziPrompt(key: BaziSchoolKey, input: BaziSchoolInput): string {
  const facts = selectBaziFacts(key, input);
  const prompt = [
    `问题：${input.question}`, `任务类型：${input.kind}`,
    `时柱限制：${input.chart.pillars.time ? "时柱已知" : "缺时柱，判断存在限制"}`,
    "可用事实编号：", ...[...facts.values()].map((fact) => `${fact.id}：${fact.label}`),
    // JSON 保留 tokens，使 mock 与真实家使用同一筛选后的事实，而不从 prose 反推数据。
    `事实表 JSON：${JSON.stringify([...facts.values()].map((fact) => ({ ...fact, tokens: [...fact.tokens] })))}`,
  ];
  if (input.kind === "fortune") {
    prompt.push(`所问范围：${input.horizon} ${input.period.label}`,
      `锚年：${input.chart.liunian.anchorYear}`,
      `逐年窗口：${input.chart.liunian.years.map((year) => year.year).join("、")}`);
  }
  if (key === "yuchuntai") {
    prompt.push(`调候条目：${JSON.stringify(input.tiaohou)}`, `可直接引用的原文：${input.tiaohou.quote}`);
  } else {
    prompt.push("本次未提供可直接引用的原文，不得编造本派典籍的原句。");
  }
  return prompt.join("\n");
}
