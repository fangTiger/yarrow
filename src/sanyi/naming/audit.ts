import { charInfo } from "./lexicon.js";
import { isNegativeChar } from "./classics.js";
import type {
  NamingContext,
  NamingFamilyKey,
  NamingFamilyOutput,
  NamingName,
  NamingSummaryOutput,
} from "./schema.js";
import { chineseBodyErrors } from "../language-guard.js";
import { englishBodyErrors, englishForbiddenErrors } from "../english/audit.js";

export const NAMING_FORBIDDEN =
  /开光|法器|符咒|符箓|护身符|转运|化煞|吉祥物|摆件|放生|捐款|供奉|烧香|五格|三才|数理|天格|人格|地格|总格|外格|[\u3041-\u3096\u30a1-\u30fa\u30fb]/gu;

const NAMING_FORBIDDEN_EN = /\b(?:five\s+grids?|three\s+talents?|stroke\s+numerology|stroke\s+fortune|heaven\s+grid|personality\s+grid|earth\s+grid|outer\s+grid|total\s+grid|ritual\s+implements?|luck-changing\s+objects?)\b/giu;
const NEGATIVE_TAG_EN = /\b(?:cruel|hostile|sorrowful|grieving|lonely|sickly|violent|malicious|gloomy|despairing)\b/iu;
const ENGLISH_TAG = /^[A-Za-z]+(?:['’-][A-Za-z]+)*(?:\s+[A-Za-z]+(?:['’-][A-Za-z]+)*){0,2}$/u;

const FAMILY_NAMES: Readonly<Record<NamingFamilyKey, string>> = {
  wuxing: "五行补益",
  shiwen: "诗文出处",
  yinyi: "音形字义",
};

const FAMILY_NAMES_EN: Readonly<Record<NamingFamilyKey, string>> = {
  wuxing: "Five Elements",
  shiwen: "Classical Poetry",
  yinyi: "Sound and Meaning",
};

const INTERNAL_CANDIDATE_ID = /S\d{2}/gu;

function candidateIdErrors(output: NamingFamilyOutput): string[] {
  const texts = [
    ["note", output.note],
    ...output.names.flatMap((name) => [["meaning", name.meaning], ["why", name.why]] as const),
  ] as const;
  return texts.some(([, text]) => /S\d{2}/u.test(text))
    ? ["note、meaning、why 不得包含内部候选编号，请重写"]
    : [];
}

function repairCandidateReference(value: string): string {
  return value.replace(/S\d{2}\s*原句/gu, "所引原句").replace(INTERNAL_CANDIDATE_ID, "所引原句");
}

function repairCandidateReferenceEn(value: string): string {
  return value.replace(/S\d{2}\s*原句/gu, "the cited original line")
    .replace(INTERNAL_CANDIDATE_ID, "the cited original line");
}

/** element 仅用于商号五行家在行业未命中时声明自选五行。 */
export function normalizeFamilyOutput(
  key: NamingFamilyKey,
  output: NamingFamilyOutput,
  ctx: Pick<NamingContext, "favorableSource">,
): NamingFamilyOutput {
  if (key === "wuxing" && ctx.favorableSource === "model") return output;
  const { element: _element, ...normalized } = output;
  return normalized;
}

function forbiddenWords(text: string): string[] {
  return [...new Set(text.match(NAMING_FORBIDDEN) ?? [])];
}

function englishNamingForbiddenErrors(text: string): string[] {
  const words = [...new Set(text.match(NAMING_FORBIDDEN_EN) ?? [])];
  return [
    ...englishForbiddenErrors(text),
    ...(words.length > 0 ? [`英文起名文案含禁用词「${words.join("」「")}」`] : []),
  ];
}

/** 与翻译单元一致：姓名、名中字及姓氏可作为英文展示中的汉字白名单。 */
export function allowedNamingHan(
  surname: string | undefined,
  names: ReadonlyArray<{ given: string }>,
): string[] {
  return [...new Set(names.flatMap((name) => {
    const full = `${surname ?? ""}${name.given}`;
    return [name.given, full, ...name.given, ...full];
  }))];
}

function forbiddenError(label: string, texts: readonly string[]): string[] {
  const words = forbiddenWords(texts.join("\n"));
  return words.length > 0 ? [`${label}含禁用词「${words.join("」「")}」`] : [];
}

function nameTexts(name: NamingName): string[] {
  return [name.meaning, name.why, ...name.chars.map(({ gloss }) => gloss)];
}

export function namingFamilyLanguageErrors(
  output: NamingFamilyOutput,
  key?: NamingFamilyKey,
  ctx?: NamingContext,
): string[] {
  const texts = [
    output.note,
    ...output.names.flatMap((name) => [
      name.meaning, name.why,
      ...name.chars.flatMap((char) => [char.gloss, char.sense]),
      ...name.tags,
    ]),
  ];
  if (ctx?.language === "en") {
    const allowed = allowedNamingHan(ctx.surname, output.names);
    const generalTexts = [
      output.note,
      ...output.names.flatMap((name) => [
        name.meaning,
        ...name.chars.flatMap((char) => [char.gloss, char.sense]),
        ...name.tags,
      ]),
    ];
    const whyErrors = output.names.flatMap((name) => {
      const sourceNumber = key === "shiwen" ? name.sourceId?.match(/^S(\d{2})$/u)?.[1] : undefined;
      const source = sourceNumber ? ctx.candidates[Number(sourceNumber) - 1] : undefined;
      return englishBodyErrors(
        [name.why],
        source ? [...allowed, source.book, source.title, source.text] : allowed,
      );
    });
    return [
      ...englishBodyErrors(generalTexts, allowed),
      ...whyErrors,
      ...englishNamingForbiddenErrors(texts.join("\n")),
    ];
  }
  return chineseBodyErrors(texts);
}

export function namingSummaryLanguageErrors(
  output: NamingSummaryOutput,
  options: { language?: "zh" | "en"; surname?: string } = {},
): string[] {
  const texts = [
    ...output.picks.map((pick) => pick.reason), output.overview, ...output.tips,
  ];
  return options.language === "en"
    ? englishBodyErrors(texts, allowedNamingHan(options.surname, output.picks))
    : chineseBodyErrors(texts);
}

interface CommonNameAudit {
  fatal: string[];
  repairable: string[];
}

function validSense(sense: string, language: "zh" | "en" = "zh"): boolean {
  if (language === "en") {
    return sense.length >= 1 && sense.length <= 120
      && /^As a name, it suggests\b/u.test(sense)
      && englishNamingForbiddenErrors(sense).length === 0;
  }
  const length = [...sense].length;
  return length >= 1 && length <= 30 && forbiddenWords(sense).length === 0;
}

function validTags(tags: readonly string[], language: "zh" | "en" = "zh"): boolean {
  if (language === "en") {
    return tags.length >= 3 && tags.length <= 5 && tags.every((tag) => {
      const words = tag.trim().split(/\s+/u).filter(Boolean);
      return tag.length >= 1 && tag.length <= 24 && words.length >= 1 && words.length <= 3
        && ENGLISH_TAG.test(tag.trim())
        && englishNamingForbiddenErrors(tag).length === 0 && !NEGATIVE_TAG_EN.test(tag);
    });
  }
  return tags.length >= 3 && tags.length <= 5 && tags.every((tag) => {
    const length = [...tag].length;
    return length >= 2 && length <= 4
      && forbiddenWords(tag).length === 0
      && ![...tag].some(isNegativeChar);
  });
}

function commonNameAudit(name: NamingName, ctx: NamingContext): CommonNameAudit {
  const fatal: string[] = [];
  const repairable: string[] = [];
  const chars = [...name.given];
  if (chars.length !== ctx.length) {
    fatal.push(`名字「${name.given}」应为 ${ctx.length} 字`);
  }
  for (const char of chars) {
    const info = charInfo(char);
    if (!info) {
      fatal.push(`名字「${name.given}」中的「${char}」不在通用规范汉字表`);
    } else if (info.blocked) {
      fatal.push(`名字「${name.given}」中的「${char}」不宜入名`);
    }
  }
  const mapped = name.chars.map(({ char }) => char);
  if (mapped.length !== chars.length || mapped.some((char, index) => char !== chars[index])) {
    repairable.push(`名字「${name.given}」的 chars 须与 given 逐字一致`);
  }
  for (const item of name.chars) {
    const length = [...item.gloss].length;
    const glossLimit = ctx.language === "en" ? 48 : 12;
    if (length < 1 || length > glossLimit) {
      repairable.push(`名字「${name.given}」的 chars 字义须为 1 至 ${glossLimit} 字`);
      break;
    }
    const senseLength = [...item.sense].length;
    if (ctx.language === "en") {
      if (senseLength < 1 || senseLength > 120) {
        repairable.push(`名字「${name.given}」的 sense 须为 1 至 120 字符`);
      } else if (!/^As a name, it suggests\b/u.test(item.sense)) {
        repairable.push(`名字「${name.given}」的 sense 必须以 As a name, it suggests 开头`);
      } else if (englishNamingForbiddenErrors(item.sense).length > 0) {
        repairable.push(`名字「${name.given}」的 sense 含英文禁用词`);
      }
    } else if (senseLength < 1 || senseLength > 30) {
      repairable.push(`名字「${name.given}」的 sense 须为 1 至 30 字`);
    } else if (forbiddenWords(item.sense).length > 0) {
      repairable.push(`名字「${name.given}」的 sense 含禁用词`);
    }
  }
  if (name.tags.length < 3 || name.tags.length > 5) {
    repairable.push(`名字「${name.given}」的 tags 须为 3 至 5 项`);
  }
  for (const tag of name.tags) {
    const length = [...tag].length;
    if (ctx.language === "en") {
      const words = tag.trim().split(/\s+/u).filter(Boolean);
      if (length < 1 || length > 24 || words.length < 1 || words.length > 3
        || !ENGLISH_TAG.test(tag.trim())) {
        repairable.push(`名字「${name.given}」的 tags 每项须为 1 至 3 English words 且不超过 24 字符`);
      }
      if (englishNamingForbiddenErrors(tag).length > 0) {
        repairable.push(`名字「${name.given}」的 tags 含英文禁用词`);
      }
      if (NEGATIVE_TAG_EN.test(tag)) {
        repairable.push(`名字「${name.given}」的 tags 含 negative word`);
      }
    } else {
      if (length < 2 || length > 4) {
        repairable.push(`名字「${name.given}」的 tags 每项须为 2 至 4 字`);
      }
      if (forbiddenWords(tag).length > 0) {
        repairable.push(`名字「${name.given}」的 tags 含禁用词`);
      }
      if ([...tag].some(isNegativeChar)) {
        repairable.push(`名字「${name.given}」的 tags 含消极字`);
      }
    }
  }
  const nameForbidden = ctx.language === "en"
    ? englishNamingForbiddenErrors([
        ...nameTexts(name), ...name.chars.map(({ sense }) => sense), ...name.tags,
      ].join("\n"))
    : forbiddenError(`名字「${name.given}」的文案`, nameTexts(name));
  if (nameForbidden.length > 0) {
    fatal.push(...nameForbidden);
  }
  return { fatal, repairable };
}

function allSameTone(surname: string | undefined, given: string): boolean {
  const givenChars = [...given];
  const repeated = givenChars.length > 1 && new Set(givenChars).size === 1;
  if (!surname || repeated) return false;
  const infos = [...surname, ...given].map(charInfo);
  return infos.length > 1 && infos.every(Boolean)
    && infos.every((info) => info?.tone === infos[0]?.tone);
}

function familyNameErrors(
  key: NamingFamilyKey,
  name: NamingName,
  output: NamingFamilyOutput,
  ctx: NamingContext,
): string[] {
  if (key === "wuxing") {
    const favorable = ctx.favorable ?? (output.element ? [output.element] : []);
    if (ctx.favorable === null && !output.element) {
      return ["商号自选五行时必须填写 element"];
    }
    if (! [...name.given].some((char) => {
      const element = charInfo(char)?.wuxing;
      return element !== undefined && favorable.includes(element);
    })) {
      return [
        `名字「${name.given}」无一字属喜用（${favorable.join("、") || "未指定"}）`,
      ];
    }
    return [];
  }
  if (key === "shiwen") {
    if (!name.sourceId) {
      return [`名字「${name.given}」缺少 sourceId`];
    }
    const sourceNumber = name.sourceId.match(/^S(\d{2})$/u)?.[1];
    const sourceIndex = sourceNumber ? Number(sourceNumber) - 1 : -1;
    const source = sourceIndex >= 0 ? ctx.candidates[sourceIndex] : undefined;
    if (!source) {
      return [`名字「${name.given}」所引编号 ${name.sourceId} 不在候选内`];
    }
    const errors = [...name.given]
      .filter((char) => !source.text.includes(char))
      .map((char) => `名字「${name.given}」的「${char}」不在所引诗句中`);
    if (ctx.language === "en") {
      const englishWords = name.why.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu) ?? [];
      if (englishWords.length < 5) {
        errors.push(`名字「${name.given}」的 why 引用原句时必须附 English explanation（英文解释）`);
      }
    }
    return errors;
  }
  if (ctx.target === "person" && allSameTone(ctx.surname, name.given)) {
    return [`名字「${name.given}」与姓氏连读时姓名声调全同`];
  }
  return [];
}

export function auditFamily(
  key: NamingFamilyKey,
  output: NamingFamilyOutput,
  ctx: NamingContext,
): string[] {
  const errors = namingFamilyLanguageErrors(output, key, ctx);
  errors.push(...candidateIdErrors(output));
  errors.push(...(ctx.language === "en"
    ? englishNamingForbiddenErrors(output.note)
    : forbiddenError("本家思路", [output.note])));
  const seen = new Set<string>();
  for (const name of output.names) {
    const common = commonNameAudit(name, ctx);
    errors.push(...common.fatal, ...common.repairable);
    if (seen.has(name.given)) {
      errors.push(`名字「${name.given}」重复，三个名字须互不相同`);
    }
    seen.add(name.given);
    errors.push(...familyNameErrors(key, name, output, ctx));
  }
  return errors;
}

function fallbackGloss(char: string): string {
  const meaning = charInfo(char)?.meaning.split("；")[0]?.trim() || "取其美好含义";
  return [...meaning].slice(0, 12).join("");
}

/** 字义分析兜底：先用模型按名字取意写的逐字字义；没有时用字典释义原文，不套「用作名字意指」，
 * 免得把字典首义（如「心：心脏」）说成名字的取意。 */
export function fallbackSense(char: string, gloss?: string): string {
  if (gloss && [...gloss].length >= 1 && [...gloss].length <= 12 && forbiddenWords(gloss).length === 0) {
    return `取「${gloss}」之意`;
  }
  const meaning = charInfo(char)?.meaning.split("；")[0]?.trim() || "取其美好含义";
  return forbiddenWords(meaning).length > 0 ? "取其美好含义" : [...meaning].slice(0, 30).join("");
}

function repairedChars(name: NamingName, language: "zh" | "en" = "zh"): NamingName["chars"] {
  return [...name.given].map((char, index) => {
    const current = name.chars[index];
    if (language === "en") {
      const pinyin = charInfo(char)?.pinyin ?? "Character";
      const gloss = current?.char === char && current.gloss.length >= 1 && current.gloss.length <= 48
        && englishBodyErrors([current.gloss]).length === 0
        && englishNamingForbiddenErrors(current.gloss).length === 0
        ? current.gloss
        : `${pinyin[0]?.toUpperCase() ?? ""}${pinyin.slice(1)}: a positive meaning`;
      return {
        char,
        gloss,
        sense: current?.char === char && validSense(current.sense, language)
          ? current.sense
          : "As a name, it suggests a positive and steady quality.",
      };
    }
    const modelGloss = current?.char === char && [...current.gloss].length >= 1
      && [...current.gloss].length <= 12 && forbiddenWords(current.gloss).length === 0 ? current.gloss : "";
    return {
      char,
      gloss: modelGloss || fallbackGloss(char),
      sense: current?.char === char && validSense(current.sense, language)
        ? current.sense : fallbackSense(char, modelGloss),
    };
  });
}

const ELEMENT_TAGS = {
  木: ["仁爱", "上进", "蓬勃"],
  火: ["热情", "有礼", "开朗", "明快"],
  土: ["诚信", "稳重", "宽厚", "包容"],
  金: ["果断", "重义", "坚毅", "守正"],
  水: ["聪慧", "灵动", "善思", "通达"],
} as const;

const ELEMENT_TAGS_EN = {
  木: ["Kind", "Growing", "Full of life"],
  火: ["Warm", "Courteous", "Bright"],
  土: ["Steady", "Honest", "Generous"],
  金: ["Decisive", "Loyal", "Resolute"],
  水: ["Thoughtful", "Adaptable", "Clear minded"],
} as const;

function fallbackTags(given: string, language: "zh" | "en" = "zh"): string[] {
  const tags: string[] = [...new Set([...given].flatMap((char) => {
    const element = charInfo(char)?.wuxing;
    return element ? language === "en" ? ELEMENT_TAGS_EN[element] : ELEMENT_TAGS[element] : [];
  }))];
  for (const tag of language === "en"
    ? ["Gentle", "Curious", "Bright"] : ["温和", "好学", "明朗"]) {
    if (tags.length >= 3) break;
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, 5);
}

export function repairFamily(
  key: NamingFamilyKey,
  output: NamingFamilyOutput,
  ctx: NamingContext,
): { output: NamingFamilyOutput; removed: number } {
  const names: NamingName[] = [];
  const language = ctx.language ?? "zh";
  const seen = new Set<string>();
  for (const name of output.names) {
    const common = commonNameAudit(name, ctx);
    const familyErrors = familyNameErrors(key, name, output, ctx);
    const perNameLanguageErrors = language === "en"
      ? namingFamilyLanguageErrors({ note: "Family method.", names: [name] }, key, ctx)
      : [];
    if (common.fatal.length > 0 || familyErrors.length > 0
      || perNameLanguageErrors.length > 0 || seen.has(name.given)) {
      continue;
    }
    seen.add(name.given);
    const visibleName = {
      ...name,
      meaning: language === "en"
        ? repairCandidateReferenceEn(name.meaning) : repairCandidateReference(name.meaning),
      why: language === "en"
        ? repairCandidateReferenceEn(name.why) : repairCandidateReference(name.why),
    };
    names.push(common.repairable.length > 0 ? {
      ...visibleName,
      chars: repairedChars(name, language),
      tags: validTags(name.tags, language) ? name.tags : fallbackTags(name.given, language),
    } : visibleName);
  }
  const note = language === "en"
    ? englishBodyErrors([output.note]).length > 0
      || englishNamingForbiddenErrors(output.note).length > 0
      ? "This family followed its stated naming method."
      : repairCandidateReferenceEn(output.note)
    : forbiddenWords(output.note).length > 0
      ? "本家按既定规则取名。" : repairCandidateReference(output.note);
  return {
    output: { ...output, note, names },
    removed: output.names.length - names.length,
  };
}

export function toneHints(surname: string | undefined, given: string): string[] {
  const hints: string[] = [];
  if (allSameTone(surname, given)) {
    hints.push("姓名声调全同，连读时可再听听是否顺口");
  }
  const surnameInfo = surname ? charInfo([...surname].at(-1) ?? "") : undefined;
  const firstInfo = charInfo([...given][0] ?? "");
  if (surnameInfo && firstInfo) {
    if (surnameInfo.initial && surnameInfo.initial === firstInfo.initial) {
      hints.push("名字首字与姓同声母，连读可能拗口");
    }
    if (surnameInfo.final && surnameInfo.final === firstInfo.final) {
      hints.push("名字首字与姓同韵母，连读可能拗口");
    }
  }
  const seen = new Set<string>();
  for (const char of [...given]) {
    if (seen.has(char)) continue;
    seen.add(char);
    const info = charInfo(char);
    if (info?.level === 3) {
      hints.push(`「${char}」是三级字，较生僻`);
    }
    if (info?.polyphonic) {
      hints.push(`「${char}」是多音字（${info.readings.join("、")}），请确认读音`);
    }
  }
  return hints;
}

export function auditNamingSummary(
  output: NamingSummaryOutput,
  valid: readonly string[],
  options: {
    target?: "person" | "business";
    sameToneNames?: readonly string[];
    language?: "zh" | "en";
    surname?: string;
  } = {},
): string[] {
  const language = options.language ?? "zh";
  const errors: string[] = namingSummaryLanguageErrors(output, {
    language,
    ...(options.surname ? { surname: options.surname } : {}),
  });
  const allowed = new Set(valid);
  const sameTone = new Set(options.sameToneNames ?? []);
  const withoutSameTone = new Set(valid.filter((given) => !sameTone.has(given)));
  const rejectSameTone = withoutSameTone.size >= 2;
  const seen = new Set<string>();
  for (const pick of output.picks) {
    if (!allowed.has(pick.given)) {
      errors.push(`推荐「${pick.given}」不在合格名字中`);
    }
    if (seen.has(pick.given)) {
      errors.push(`推荐「${pick.given}」重复`);
    }
    seen.add(pick.given);
    if (rejectSameTone && sameTone.has(pick.given)) {
      errors.push(`推荐「${pick.given}」有姓名声调全同提示，另有至少两个无此提示的名字，不应优先推荐`);
    }
    errors.push(...(language === "en"
      ? englishNamingForbiddenErrors(pick.reason)
      : forbiddenError(`推荐「${pick.given}」的理由`, [pick.reason])));
  }
  errors.push(...(language === "en"
    ? englishNamingForbiddenErrors([output.overview, ...output.tips].join("\n"))
    : [...forbiddenError("合参总述", [output.overview]),
        ...forbiddenError("挑选提示", output.tips)]));
  const tips = output.tips.join("\n");
  if (options.target === "person" && (language === "en"
    ? /\b(?:trademarks?|business registration|company registration)\b/iu.test(tips)
    : /商标|工商/u.test(tips))) {
    errors.push("人名挑选提示不得提商标或工商");
  }
  if (options.target === "business" && (language === "en"
    ? /\b(?:duplicate names?|household registration|hukou)\b/iu.test(tips)
    : /重名|户口/u.test(tips))) {
    errors.push("商号挑选提示不得提重名或户口");
  }
  return errors;
}

function fixedTips(target: "person" | "business", language: "zh" | "en" = "zh"): string[] {
  if (language === "en") {
    return [
      "Read the full name aloud and listen for a natural rhythm.",
      "Check for awkward homophones in the family's dialects.",
      target === "person"
        ? "Check duplicate-name records before household registration."
        : "Check trademarks and business registration before filing.",
    ];
  }
  return [
    "念出全名听听是否顺口",
    "问问家人方言里有无不雅谐音",
    target === "person" ? "上户口前查一查重名" : "注册前查询商标与工商登记",
  ];
}

export function repairNamingSummary(
  output: NamingSummaryOutput,
  families: Partial<Record<NamingFamilyKey, string[]>>,
  target: "person" | "business",
  sameToneNames: readonly string[] = [],
  language: "zh" | "en" = "zh",
  surname?: string,
): { output: NamingSummaryOutput; removed: number } {
  const valid = new Set(Object.values(families).flatMap((names) => names ?? []));
  const sameTone = new Set(sameToneNames);
  const rejectSameTone = [...valid].filter((given) => !sameTone.has(given)).length >= 2;
  const seen = new Set<string>();
  const picks = output.picks.filter((pick) => {
    const keep = valid.has(pick.given) && !seen.has(pick.given)
      && (language === "en"
        ? englishNamingForbiddenErrors(pick.reason).length === 0
          && englishBodyErrors([pick.reason], allowedNamingHan(surname, [pick])).length === 0
        : forbiddenWords(pick.reason).length === 0)
      && !(rejectSameTone && sameTone.has(pick.given));
    if (keep) seen.add(pick.given);
    return keep;
  });
  const removed = output.picks.length - picks.length;
  if (picks.length < 2) {
    const keys = ["wuxing", "shiwen", "yinyi"] as const;
    const represented = new Set<NamingFamilyKey>();
    for (const pick of picks) {
      const key = keys.find((family) => (
        !represented.has(family) && families[family]?.includes(pick.given)
      ));
      if (key) represented.add(key);
    }
    for (const key of keys) {
      if (represented.has(key)) continue;
      const given = families[key]?.find((name) => (
        !seen.has(name) && !(rejectSameTone && sameTone.has(name))
      ));
      if (given) {
        picks.push({ given, reason: language === "en"
          ? `A leading choice from ${FAMILY_NAMES_EN[key]}.`
          : `${FAMILY_NAMES[key]}首选` });
        seen.add(given);
        represented.add(key);
      }
      if (picks.length === 3) break;
    }
    for (const key of keys) {
      if (picks.length >= 2) break;
      const given = families[key]?.find((name) => (
        !seen.has(name) && !(rejectSameTone && sameTone.has(name))
      ));
      if (given) {
        picks.push({ given, reason: language === "en"
          ? `A leading choice from ${FAMILY_NAMES_EN[key]}.`
          : `${FAMILY_NAMES[key]}首选` });
        seen.add(given);
      }
    }
  }
  const tipsText = output.tips.join("\n");
  const tipsInvalid = output.tips.length < 2 || output.tips.length > 3
    || (language === "en"
      ? englishNamingForbiddenErrors(tipsText).length > 0
        || englishBodyErrors(output.tips, allowedNamingHan(surname, picks)).length > 0
        || (target === "person"
          && /\b(?:trademarks?|business registration|company registration)\b/iu.test(tipsText))
        || (target === "business"
          && /\b(?:duplicate names?|household registration|hukou)\b/iu.test(tipsText))
      : forbiddenWords(tipsText).length > 0
        || (target === "person" && /商标|工商/u.test(tipsText))
        || (target === "business" && /重名|户口/u.test(tipsText)));
  return {
    output: {
      picks,
      overview: language === "en"
        ? englishNamingForbiddenErrors(output.overview).length > 0
          || englishBodyErrors([output.overview], allowedNamingHan(surname, picks)).length > 0
          ? "The available families differ in emphasis; compare sound, meaning, and source."
          : output.overview
        : forbiddenWords(output.overview).length > 0
          ? "三家各有侧重，可结合读音、字义与出处挑选。"
          : output.overview,
      tips: tipsInvalid ? fixedTips(target, language) : output.tips,
    },
    removed,
  };
}
