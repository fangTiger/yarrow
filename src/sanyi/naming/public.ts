import type { NamingFamilyState, StoredNamingReading } from "../store.js";
import { normalizeFamilyOutput, toneHints, fallbackSense } from "./audit.js";
import { lineById } from "./classics.js";
import { NAMING_FAMILIES } from "./families.js";
import { charInfo } from "./lexicon.js";
import type { NamingFamilyKey, NamingName } from "./schema.js";
import { charAnalysis, echoLines, nameScores, nameSupplements } from "./card.js";

const FAMILY_NAMES: Readonly<Record<NamingFamilyKey, string>> = {
  wuxing: "五行补益",
  shiwen: "诗文出处",
  yinyi: "音形字义",
};

function fullName(reading: StoredNamingReading, given: string): string {
  return reading.target === "person" ? `${reading.surname ?? ""}${given}` : given;
}

function pinyin(value: string): string {
  return [...value].map((char) => charInfo(char)?.pinyin ?? char).join(" ");
}

function sourceFor(reading: StoredNamingReading, sourceId: string | undefined) {
  const index = sourceId?.match(/^S(\d{2})$/u)?.[1];
  if (!index) return undefined;
  const candidateId = reading.candidateIds[Number(index) - 1];
  const line = candidateId ? lineById(candidateId) : undefined;
  return line ? { book: line.book, title: line.title, text: line.text } : undefined;
}

function sourceCandidateId(reading: StoredNamingReading, sourceId: string | undefined) {
  const index = sourceId?.match(/^S(\d{2})$/u)?.[1];
  return index ? reading.candidateIds[Number(index) - 1] : undefined;
}


function visibleSurnameChars(value: string) {
  return [...value].flatMap((char) => {
    const info = charInfo(char);
    return info ? [{
      char,
      pinyin: info.pinyin,
      tone: info.tone,
      wuxing: info.wuxing,
      kangxi: info.kangxi,
    }] : [];
  });
}

function visibleName(reading: StoredNamingReading, key: NamingFamilyKey, value: NamingName) {
  const full = fullName(reading, value.given);
  const chars = [...value.given].flatMap((char, index) => {
    const info = charInfo(char);
    if (!info) return [];
    const modelMeaning = value.chars[index]?.char === char ? value.chars[index]?.gloss.trim() : "";
    return [{
      char,
      pinyin: info.pinyin,
      tone: info.tone,
      wuxing: info.wuxing,
      wuxingBasis: info.wuxingBasis,
      kangxi: info.kangxi,
      meaning: modelMeaning || info.meaning,
      // 旧存档没有 sense：用模型逐字字义兜底，再退字典释义。
      sense: (value.chars[index] as { sense?: string } | undefined)?.sense?.trim()
        || fallbackSense(char, modelMeaning),
      level: info.level,
      polyphonic: info.polyphonic,
    }];
  });
  const source = sourceFor(reading, value.sourceId);
  const cardFavorable = reading.basis.favorable ?? (
    key === "wuxing" && reading.basis.favorableSource === "model"
      ? reading.families.wuxing.output?.element ? [reading.families.wuxing.output.element] : null
      : null
  );
  const cardContext = {
    target: reading.target,
    favorable: cardFavorable,
    missing: reading.basis.missing ?? [],
    favorableSource: reading.basis.favorableSource,
  } as const;
  return {
    ...value,
    full,
    pinyin: pinyin(full),
    chars,
    ...(reading.target === "person" ? { surnameChars: visibleSurnameChars(reading.surname ?? "") } : {}),
    hints: toneHints(reading.target === "person" ? reading.surname : undefined, value.given),
    scores: nameScores({
      target: reading.target,
      ...(reading.surname ? { surname: reading.surname } : {}),
      given: value.given,
      favorable: cardFavorable,
      missing: reading.basis.missing ?? [],
      sourceVerified: key === "shiwen" && source !== undefined,
    }),
    supplements: nameSupplements(value.given, cardFavorable),
    analysis: [...value.given].map((char) => charAnalysis(char, cardContext)),
    echoes: echoLines(value.given, sourceCandidateId(reading, value.sourceId)),
    ...(source ? { source } : {}),
  };
}

function visibleFamily(
  reading: StoredNamingReading,
  key: NamingFamilyKey,
  state: NamingFamilyState,
) {
  const { attempts: _attempts, output, ...visible } = state;
  const normalized = output
    ? normalizeFamilyOutput(key, output, { favorableSource: reading.basis.favorableSource })
    : undefined;
  return {
    ...visible,
    ...(normalized ? {
      output: { ...normalized, names: normalized.names.map((name) => visibleName(reading, key, name)) },
    } : {}),
  };
}

function pickDetails(reading: StoredNamingReading, given: string) {
  for (const family of NAMING_FAMILIES) {
    const name = reading.families[family.key].output?.names.find((item) => item.given === given);
    if (name) {
      const visible = visibleName(reading, family.key, name);
      return {
        family: FAMILY_NAMES[family.key],
        scores: visible.scores,
        supplements: visible.supplements,
      };
    }
  }
  return { family: "三家合参" };
}

export function publicNamingReading(reading: StoredNamingReading) {
  const summary = reading.summary;
  const visibleSummary = summary ? (() => {
    const { attempts: _attempts, output, ...visible } = summary;
    return {
      ...visible,
      ...(output ? {
        output: {
          ...output,
          picks: output.picks.map((pick) => {
            const full = fullName(reading, pick.given);
            return { ...pick, full, pinyin: pinyin(full), ...pickDetails(reading, pick.given) };
          }),
        },
      } : {}),
    };
  })() : undefined;
  return {
    id: reading.id,
    kind: "naming" as const,
    createdAt: reading.createdAt,
    target: reading.target,
    question: reading.question,
    ...(reading.surname ? { surname: reading.surname } : {}),
    gender: reading.gender,
    length: reading.length,
    unborn: reading.unborn,
    status: reading.status,
    payment: { firstHash: reading.payment.transactionHash },
    basis: {
      ...reading.basis,
      hiddenCounts: Object.fromEntries(reading.basis.elements.map(({ element, total }) => (
        [element, total]
      ))),
    },
    families: {
      wuxing: visibleFamily(reading, "wuxing", reading.families.wuxing),
      shiwen: visibleFamily(reading, "shiwen", reading.families.shiwen),
      yinyi: visibleFamily(reading, "yinyi", reading.families.yinyi),
    },
    ...(visibleSummary ? { summary: visibleSummary } : {}),
  };
}

export type PublicNamingReading = ReturnType<typeof publicNamingReading>;
