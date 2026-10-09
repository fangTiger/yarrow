import type { NamingFamilyState, StoredNamingReading } from "../store.js";
import { normalizeFamilyOutput, toneHints } from "./audit.js";
import { lineById } from "./classics.js";
import { NAMING_FAMILIES } from "./families.js";
import { charInfo } from "./lexicon.js";
import type { NamingFamilyKey, NamingName } from "./schema.js";

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

function visibleName(reading: StoredNamingReading, value: NamingName) {
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
      level: info.level,
      polyphonic: info.polyphonic,
    }];
  });
  const source = sourceFor(reading, value.sourceId);
  return {
    ...value,
    full,
    pinyin: pinyin(full),
    chars,
    hints: toneHints(reading.target === "person" ? reading.surname : undefined, value.given),
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
      output: { ...normalized, names: normalized.names.map((name) => visibleName(reading, name)) },
    } : {}),
  };
}

function pickFamily(reading: StoredNamingReading, given: string): string {
  for (const family of NAMING_FAMILIES) {
    if (reading.families[family.key].output?.names.some((name) => name.given === given)) {
      return FAMILY_NAMES[family.key];
    }
  }
  return "三家合参";
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
            return { ...pick, full, pinyin: pinyin(full), family: pickFamily(reading, pick.given) };
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
    basis: reading.basis,
    families: {
      wuxing: visibleFamily(reading, "wuxing", reading.families.wuxing),
      shiwen: visibleFamily(reading, "shiwen", reading.families.shiwen),
      yinyi: visibleFamily(reading, "yinyi", reading.families.yinyi),
    },
    ...(visibleSummary ? { summary: visibleSummary } : {}),
  };
}

export type PublicNamingReading = ReturnType<typeof publicNamingReading>;
