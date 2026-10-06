// src/sanyi/mock-bazi-schools.ts
import type { FactTable } from "./facts.js";
import { DESTINY_TITLES, type BaziSchoolOutput, type DestinySchoolOutput, type FortuneSchoolOutput } from "./bazi-schema.js";
import type { BaziSchoolKey } from "./schools/bazi-shared.js";
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
        return base;
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
