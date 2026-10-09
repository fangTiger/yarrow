import { charInfo } from "./lexicon.js";
import type {
  NamingContext,
  NamingFamilyKey,
  NamingFamilyOutput,
  NamingName,
  NamingSummaryOutput,
} from "./schema.js";

export const NAMING_FORBIDDEN =
  /开光|法器|符咒|符箓|护身符|转运|化煞|吉祥物|摆件|放生|捐款|供奉|烧香|五格|三才|数理|天格|人格|地格|总格|外格/gu;

const FAMILY_NAMES: Readonly<Record<NamingFamilyKey, string>> = {
  wuxing: "五行补益",
  shiwen: "诗文出处",
  yinyi: "音形字义",
};

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

function forbiddenError(label: string, texts: readonly string[]): string[] {
  const words = forbiddenWords(texts.join("\n"));
  return words.length > 0 ? [`${label}含禁用词「${words.join("」「")}」`] : [];
}

function nameTexts(name: NamingName): string[] {
  return [name.meaning, name.why, ...name.chars.map(({ gloss }) => gloss)];
}

interface CommonNameAudit {
  fatal: string[];
  chars: string[];
}

function commonNameAudit(name: NamingName, ctx: NamingContext): CommonNameAudit {
  const fatal: string[] = [];
  const charErrors: string[] = [];
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
    charErrors.push(`名字「${name.given}」的 chars 须与 given 逐字一致`);
  }
  for (const item of name.chars) {
    const length = [...item.gloss].length;
    if (length < 1 || length > 12) {
      charErrors.push(`名字「${name.given}」的 chars 字义须为 1 至 12 字`);
      break;
    }
  }
  const nameForbidden = forbiddenError(`名字「${name.given}」的文案`, nameTexts(name));
  if (nameForbidden.length > 0) {
    fatal.push(...nameForbidden);
  }
  return { fatal, chars: charErrors };
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
    return [...name.given]
      .filter((char) => !source.text.includes(char))
      .map((char) => `名字「${name.given}」的「${char}」不在所引诗句中`);
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
  const errors = forbiddenError("本家思路", [output.note]);
  const seen = new Set<string>();
  for (const name of output.names) {
    const common = commonNameAudit(name, ctx);
    errors.push(...common.fatal, ...common.chars);
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

function repairedChars(given: string): NamingName["chars"] {
  return [...given].map((char) => ({ char, gloss: fallbackGloss(char) }));
}

export function repairFamily(
  key: NamingFamilyKey,
  output: NamingFamilyOutput,
  ctx: NamingContext,
): { output: NamingFamilyOutput; removed: number } {
  const names: NamingName[] = [];
  const seen = new Set<string>();
  for (const name of output.names) {
    const common = commonNameAudit(name, ctx);
    const familyErrors = familyNameErrors(key, name, output, ctx);
    if (common.fatal.length > 0 || familyErrors.length > 0 || seen.has(name.given)) {
      continue;
    }
    seen.add(name.given);
    names.push(common.chars.length > 0 ? { ...name, chars: repairedChars(name.given) } : name);
  }
  const note = forbiddenWords(output.note).length > 0 ? "本家按既定规则取名。" : output.note;
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
): string[] {
  const errors: string[] = [];
  const allowed = new Set(valid);
  const seen = new Set<string>();
  for (const pick of output.picks) {
    if (!allowed.has(pick.given)) {
      errors.push(`推荐「${pick.given}」不在合格名字中`);
    }
    if (seen.has(pick.given)) {
      errors.push(`推荐「${pick.given}」重复`);
    }
    seen.add(pick.given);
    errors.push(...forbiddenError(`推荐「${pick.given}」的理由`, [pick.reason]));
  }
  errors.push(...forbiddenError("合参总述", [output.overview]));
  errors.push(...forbiddenError("挑选提示", output.tips));
  return errors;
}

function fixedTips(target: "person" | "business"): string[] {
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
): { output: NamingSummaryOutput; removed: number } {
  const valid = new Set(Object.values(families).flatMap((names) => names ?? []));
  const seen = new Set<string>();
  const picks = output.picks.filter((pick) => {
    const keep = valid.has(pick.given) && !seen.has(pick.given)
      && forbiddenWords(pick.reason).length === 0;
    if (keep) seen.add(pick.given);
    return keep;
  });
  const removed = output.picks.length - picks.length;
  if (picks.length < 2) {
    for (const key of ["wuxing", "shiwen", "yinyi"] as const) {
      const given = families[key]?.find((name) => !seen.has(name));
      if (given) {
        picks.push({ given, reason: `${FAMILY_NAMES[key]}首选` });
        seen.add(given);
      }
      if (picks.length === 3) break;
    }
  }
  const tipsInvalid = output.tips.length < 2 || output.tips.length > 3
    || forbiddenWords(output.tips.join("\n")).length > 0;
  return {
    output: {
      picks,
      overview: forbiddenWords(output.overview).length > 0
        ? "三家各有侧重，可结合读音、字义与出处挑选。"
        : output.overview,
      tips: tipsInvalid ? fixedTips(target) : output.tips,
    },
    removed,
  };
}
