// src/sanyi/mock-bazi-schools.ts
import type { FactTable } from "./facts.js";
import { DESTINY_TITLES, type BaziSchoolOutput, type DestinySchoolOutput, type FortuneSchoolOutput } from "./bazi-schema.js";
import type { BaziSchoolKey } from "./schools/bazi-shared.js";
import { DESTINY_TITLES_EN } from "./english/schema.js";
function useGodFor(key: BaziSchoolKey, facts: FactTable): {
    ref: string;
    word: string;
} {
    if (key === "yuchuntai") {
        const tiaohou = facts.get("tiaohou");
        const word = [...tiaohou?.tokens ?? []].find((token) => /^[甲乙丙丁戊己庚辛壬癸]$/u.test(token));
        if (!word) {
            throw new Error("调候 mock 缺少用神干");
        }
        return { ref: "tiaohou", word };
    }
    // 排练展示两派的典型取法，不把示例选择充当正式格局或强弱算法。
    const wanted = key === "shenxiaozhan" ? ["正印", "偏印", "正官", "七杀"] : ["比肩", "劫财", "正印", "偏印"];
    for (const word of wanted) {
        const fact = [...facts.values()].find((item) => {
            return (item.id.startsWith("pillar:") || item.id.startsWith("hidden:")) && item.tokens.has(word);
        });
        if (fact) {
            return { ref: fact.id, word };
        }
    }
    const day = facts.get("pillar:day");
    const word = [...day?.tokens ?? []].find((token) => /^[甲乙丙丁戊己庚辛壬癸]$/u.test(token));
    if (!word) {
        throw new Error("八字 mock 缺少日干事实");
    }
    return { ref: "pillar:day", word };
}
export function mockBaziSchoolOutput(key: BaziSchoolKey, facts: FactTable, kind: "destiny"): DestinySchoolOutput;
export function mockBaziSchoolOutput(key: BaziSchoolKey, facts: FactTable, kind: "fortune"): FortuneSchoolOutput;
export function mockBaziSchoolOutput(key: BaziSchoolKey, facts: FactTable, kind: "destiny" | "fortune"): BaziSchoolOutput;
export function mockBaziSchoolOutput(key: BaziSchoolKey, facts: FactTable, kind: "destiny" | "fortune"): BaziSchoolOutput {
    const useGod = useGodFor(key, facts);
    let reason = "依事实判断，先核实条件";
    if (facts.has("chart:limit")) {
        reason = "缺时柱，判断存在限制，先核实条件";
    }
    const base: DestinySchoolOutput = {
        useGod: useGod.word, headline: "审慎待时", reason,
        sections: DESTINY_TITLES.map((title) => ({ title, text: "先核实客观条件" })),
        advice: ["保留调整余地"], evidence: [{ ref: useGod.ref, claim: useGod.word }],
    };
    if (kind === "destiny") {
        const offset = { shenxiaozhan: 0, yuchuntai: 1, rentieqiao: 2 }[key];
        const periods = [...facts.values()].filter(fact => /^luck:\d+$/u.test(fact.id))
            .sort((left, right) => Number(left.id.slice(5)) - Number(right.id.slice(5))).map(fact => {
            const index = Number(fact.id.slice(5));
            const ganZhi = [...fact.tokens].find(token =>
                /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/u.test(token));
            const gods = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官",
                "偏印", "正印"];
            const god = [...fact.tokens].find(token => gods.includes(token));
            if (!ganZhi || !god) {
                throw new Error("逐运 mock 缺少大运干支或十神事实");
            }
            const favorable = (index + offset) % 2 === 0;
            return {
                index, verdict: favorable ? "吉" as const : "凶" as const,
                confidenceTenths: favorable ? 7 : 3,
                note: `${ganZhi}${god}，${favorable ? "宜进取" : "宜守成"}`,
            };
        });
        return { ...base, periods };
    }
    // 家与年份共同决定分数；各家偏移保证锚年总断不同。
    const offset = { shenxiaozhan: 0, yuchuntai: 1, rentieqiao: 2 }[key];
    const years = [...facts.values()].filter(fact => /^year:\d{4}$/u.test(fact.id))
        .sort((a, b) => a.id.localeCompare(b.id, "en")).map(fact => {
        const year = Number(fact.id.slice(5));
        const hash = (Math.imul(year, 31) >>> 0) % 5;
        const confidenceTenths = 3 + (hash + offset) % 5;
        const verdict = confidenceTenths >= 6 ? "吉" as const : confidenceTenths <= 4 ? "凶" as const : "平" as const;
        const word = [...fact.tokens].find(token => /(合|冲|刑|害|破|会|拱)/u.test(token)) ?? [...fact.tokens].find(token => ["比肩", "劫财", "食神", "伤官", "正财", "偏财", "正官", "七杀", "正印", "偏印"].includes(token));
        if (!word)
            throw new Error("逐年 mock 缺少关系或十神事实");
        return { year, verdict, confidenceTenths, note: `${word}，${verdict === "吉" ? "宜进取" : "宜守成"}` };
    });
    const anchorYear = Number(facts.get("year:anchor")?.label.match(/^\d{4}/u)?.[0]);
    const anchor = years.find(item => item.year === anchorYear);
    if (!anchor)
        throw new Error("逐年 mock 缺少锚年事实");
    return { ...base, headline: `${useGod.word}宜审慎`, verdict: anchor.verdict, confidenceTenths: anchor.confidenceTenths, years };
}

/** 原生英文排练输出：展示字段为英文，evidence 保留中文事实词。 */
export function mockEnglishBaziSchoolOutput(
  key: BaziSchoolKey,
  facts: FactTable,
  kind: "destiny" | "fortune",
): BaziSchoolOutput {
  const chinese = mockBaziSchoolOutput(key, facts, kind);
  const base: DestinySchoolOutput = {
    useGod: "Fire (Yong Shen) supports balance in this chart.",
    headline: "Build steadily around the chart's strongest support",
    reason: facts.has("chart:limit")
      ? "The birth hour is unknown, so this interpretation has clear limits."
      : "The supplied chart facts favor patience and practical preparation.",
    sections: DESTINY_TITLES_EN.map((title) => ({
      title,
      text: "The supported pattern favors measured action and realistic expectations.",
    })),
    advice: ["Keep practical options open while conditions develop."],
    evidence: chinese.evidence,
  };
  if (kind === "destiny" && !("years" in chinese)) {
    return {
      ...base,
      periods: (chinese.periods ?? []).map((item) => ({
        ...item,
        note: item.verdict === "吉" || item.verdict === "大吉"
          ? "This period supports the natal chart, so conditions are favorable."
          : "This period strains the natal chart, so a cautious approach is better.",
      })),
    };
  }
  if (!("years" in chinese)) throw new Error("英文运势 mock 缺少逐年输出");
  return {
    ...base,
    sections: [
      { title: "Useful Influence", text: "The selected useful influence guides the annual reading." },
      { title: "Chart Dynamics", text: "Support and restraint alternate across the requested window." },
      { title: "Practical Timing", text: "Act only when the stated practical conditions are present." },
    ],
    headline: "Proceed carefully and use the stronger windows well",
    verdict: chinese.verdict,
    confidenceTenths: chinese.confidenceTenths,
    years: chinese.years.map((item) => ({
      ...item,
      note: item.verdict === "吉" || item.verdict === "大吉"
        ? "This year supports the natal chart, so measured progress is favored."
        : item.verdict === "平"
          ? "This year brings mixed support, so keep plans flexible."
          : "This year strains the natal chart, so protect time and resources.",
    })),
  };
}
