import { charInfo, isNameChar, nameChars, type Element } from "./lexicon.js";
import { NAMING_FORBIDDEN } from "./audit.js";
import type { NamingFamilyKey, NamingFamilyOutput, NamingName, NamingSummaryOutput } from "./schema.js";

function promptLength(prompt: string): 1 | 2 | 3 | 4 {
  const value = Number(prompt.match(/名字字数：([1-4]) 字/u)?.[1]);
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  throw new Error("起名 mock 请求缺少名字字数");
}

function gloss(char: string): string {
  const meaning = charInfo(char)?.meaning.split("；")[0]?.trim() || "取其美好含义";
  if (meaning.match(NAMING_FORBIDDEN)) return "取其美好含义";
  return [...meaning].slice(0, 12).join("");
}

const MOCK_TAGS: Readonly<Record<Element, readonly string[]>> = {
  木: ["仁爱", "上进", "蓬勃"], 火: ["热情", "有礼", "开朗"],
  土: ["诚信", "稳重", "宽厚"], 金: ["果断", "重义", "坚毅"],
  水: ["聪慧", "灵动", "善思"],
};

function tags(given: string): string[] {
  return [...new Set([...given].flatMap((char) => {
    const element = charInfo(char)?.wuxing;
    return element ? MOCK_TAGS[element] : [];
  }))].slice(0, 5);
}

function mockName(given: string, why: string, sourceId?: string): NamingName {
  const value: NamingName = {
    given,
    meaning: [...given].map(gloss).join("，"),
    why,
    chars: [...given].map((char) => ({
      char, gloss: gloss(char), sense: `用作名字意指${gloss(char)}`,
    })),
    tags: tags(given),
  };
  if (sourceId) value.sourceId = sourceId;
  return value;
}

function distinctNames(pool: readonly string[], length: number): string[] {
  if (pool.length < length + 2) throw new Error("起名 mock 可用字不足");
  return [0, 1, 2].map((offset) => (
    Array.from({ length }, (_, index) => pool[(offset + index) % pool.length]!).join("")
  ));
}

function wuxingOutput(prompt: string): NamingFamilyOutput {
  const length = promptLength(prompt);
  const usable = prompt.split("\n").flatMap((line): string[] => {
    const match = line.match(/^[木火土金水]：(.+)$/u);
    return match?.[1] ? match[1].split("、").filter(Boolean) : [];
  });
  if (usable.length > 0) {
    return {
      note: "先取喜用之字，再兼顾读音、字形与寓意。",
      names: distinctNames(usable, length).map((given) => mockName(given, "名字含喜用五行之字")),
    };
  }
  const element: Element = "木";
  const selfSelected = nameChars((info) => info.level === 1 && info.wuxing === element)
    .map(({ char }) => char);
  return {
    note: "行业无明确对应，取木的生长舒展之意。",
    element,
    names: distinctNames(selfSelected, length).map((given) => mockName(given, "字号含所选五行之字")),
  };
}

interface PromptCandidate {
  id: string;
  text: string;
}

function promptCandidates(prompt: string): PromptCandidate[] {
  return prompt.split("\n").flatMap((line): PromptCandidate[] => {
    const match = line.match(/^(S\d{2})｜[^｜]+｜(.+)$/u);
    return match?.[1] && match[2] ? [{ id: match[1], text: match[2] }] : [];
  });
}

function shiwenOutput(prompt: string): NamingFamilyOutput {
  const length = promptLength(prompt);
  const candidates = promptCandidates(prompt);
  const names: NamingName[] = [];
  const used = new Set<string>();
  for (let candidateIndex = 0; candidateIndex < candidates.length && names.length < 3; candidateIndex += 1) {
    const candidate = candidates[candidateIndex]!;
    const chars = [...new Set([...candidate.text].filter(isNameChar))];
    for (let offset = 0; offset < chars.length && names.length < 3; offset += 1) {
      const given = Array.from({ length }, (_, index) => chars[(offset + index) % chars.length]!).join("");
      if ([...given].length === length && !used.has(given)) {
        used.add(given);
        names.push(mockName(given, "各字取自同一候选诗句", candidate.id));
      }
    }
  }
  if (names.length < 3) throw new Error("起名 mock 候选诗句不足");
  return { note: "从候选原句取字，兼顾诗意与现代字义。", names };
}

function surnameTones(prompt: string): number[] {
  const line = prompt.split("\n").find((row) => row.startsWith("姓氏读音：")) ?? "";
  return [...line.matchAll(/（([1-5]) 声）/gu)].map((match) => Number(match[1]));
}

function yinyiOutput(prompt: string): NamingFamilyOutput {
  const length = promptLength(prompt);
  const tones = surnameTones(prompt);
  const surnameSingleTone = tones.length > 0 && tones.every((tone) => tone === tones[0]) ? tones[0] : null;
  const preferred = [..."泽远宁明安和景嘉言清夏知书雅"]
    .filter((char) => isNameChar(char));
  const selected: string[] = [];
  for (let offset = 0; offset < preferred.length && selected.length < 3; offset += 1) {
    const given = Array.from({ length }, (_, index) => (
      preferred[(offset + index) % preferred.length]!
    )).join("");
    const givenChars = [...given];
    const repeated = givenChars.length > 1 && new Set(givenChars).size === 1;
    const allSame = surnameSingleTone !== null && !repeated
      && givenChars.every((char) => charInfo(char)?.tone === surnameSingleTone);
    if (!allSame && !selected.includes(given)) selected.push(given);
  }
  if (selected.length < 3) throw new Error("起名 mock 音义候选不足");
  const names = selected.map((given) => mockName(given, "声调有变化，字形与字义协调"));
  return { note: "把姓与名连读，兼顾声调、字形和字义。", names };
}

export function mockNamingFamilyOutput(key: NamingFamilyKey, prompt: string): NamingFamilyOutput {
  if (key === "wuxing") return wuxingOutput(prompt);
  if (key === "shiwen") return shiwenOutput(prompt);
  return yinyiOutput(prompt);
}

export function mockNamingSummaryOutput(prompt: string): NamingSummaryOutput {
  const families: Array<{ label: string; names: string[] }> = [];
  let current: { label: string; names: string[] } | undefined;
  for (const line of prompt.split("\n")) {
    const heading = line.match(/^(五行补益|诗文出处|音形字义)：$/u);
    if (heading?.[1]) {
      current = { label: heading[1], names: [] };
      families.push(current);
      continue;
    }
    const name = current ? line.match(/^- ([^｜]+)｜综合 \d+ 分/u)?.[1] : undefined;
    if (name) {
      current?.names.push(name);
      continue;
    }
    if (line.includes("思路：")) current = undefined;
  }
  const names = families.flatMap((family) => family.names);
  const picks = [...new Set(names)].slice(0, 2)
    .map((given) => ({ given, reason: "兼顾本家取法与名字整体表现" }));
  if (picks.length < 2) throw new Error("起名 mock 合格名字不足");
  const countLabel = ["零", "一", "两", "三"][families.length] ?? String(families.length);
  return {
    picks,
    overview: `已落笔${countLabel}家都重视正面寓意，分别侧重${families
      .map(({ label }) => label).join("与")}。`,
    tips: ["念出全名听听是否顺口", "问问家人方言里有无不雅谐音"],
  };
}
