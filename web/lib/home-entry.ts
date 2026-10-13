// web/lib/home-entry.ts
import type { Classification } from "./api.js";
import {
  EMPTY_BIRTH, birthProblem, toBirthInput, type BirthFormValues, type BirthProfileInput,
} from "./birth-profile.js";
import { entryHorizon } from "./birth-entry.js";
import { type TFunction, zhT } from "./i18n.js";

export type EntryKind = "question" | "fortune" | "destiny" | "naming";
export type NamingTarget = "person" | "business";

/** 规则分类的前端视图，也是付款时带给服务端的分类。 */
export interface ClassificationView {
  question: string;
  kind: string;
  supported: boolean;
  subjectKey?: string;
  subject?: string;
  horizon?: string;
  suggestion?: string;
  target?: NamingTarget;
}

/** 首页入口状态：所选类型、是否手动点选、事项、时间范围与未开放提示。 */
export interface EntryState {
  kind: EntryKind;
  manual: boolean;
  subjectKey: string;
  subject: string;
  horizon: string;
  target: NamingTarget;
  unsupported?: string;
}

export const DEFAULT_ENTRY: EntryState = {
  kind: "destiny", manual: false, subjectKey: "", subject: "", horizon: "year", target: "person",
};

export const KIND_OPTIONS = [
  ["destiny", "命理"],
  ["question", "问事"],
  ["fortune", "运势"],
  ["naming", "起名"],
] as const;

export const PLACEHOLDERS: Record<EntryKind, string> = {
  question: zhT("question.placeholder.question"),
  fortune: zhT("question.placeholder.fortune"),
  destiny: zhT("question.placeholder.destiny"),
  naming: zhT("question.placeholder.naming"),
};

export const NAMING_PLACEHOLDERS: Record<NamingTarget, string> = {
  person: zhT("question.placeholder.naming"),
  business: zhT("question.placeholder.business"),
};

export const HORIZON_OPTIONS = [
  ["today", "今天"],
  ["month", "本月"],
  ["year", "今年"],
  ["next-year", "明年"],
] as const;

export function horizonLabel(horizon: string, t: TFunction = zhT): string {
  const keys: Record<string, Parameters<TFunction>[0]> = {
    today: "horizon.today", month: "horizon.month", year: "horizon.year", "next-year": "horizon.nextYear",
  };
  if (keys[horizon]) return t(keys[horizon]!);
  const year = horizon.match(/^year:(\d{4})$/);
  return year ? t("horizon.specificYear", { year: year[1]! }) : t("horizon.year");
}

const ENTRY_KINDS: readonly string[] = ["question", "fortune", "destiny", "naming"];

export function fromClassification(value: Classification): ClassificationView {
  const item = value as Classification & { subject?: { key?: string; label?: string }; horizon?: string };
  return {
    question: item.question,
    kind: item.kind,
    supported: item.supported,
    ...(item.subject?.key ? { subjectKey: item.subject.key } : {}),
    ...(item.subject?.label ? { subject: item.subject.label } : {}),
    ...(item.horizon ? { horizon: item.horizon } : {}),
    ...(item.suggestion ? { suggestion: item.suggestion } : {}),
    ...(item.target === "person" || item.target === "business" ? { target: item.target } : {}),
  };
}

/** 套用规则分类：自动模式下切换类型与细项；手动点选过类型时只补细项。 */
export function applyClassification(
  state: EntryState,
  view: ClassificationView,
  t: TFunction = zhT,
): EntryState {
  const next: EntryState = { ...state };
  delete next.unsupported;
  if (view.subjectKey && view.subject) {
    next.subjectKey = view.subjectKey;
    next.subject = view.subject;
  }
  if (view.kind === "fortune") {
    next.horizon = entryHorizon(view.horizon);
  }
  if (view.kind === "naming" && view.target) {
    next.target = view.target;
  }
  if (state.manual) {
    return next;
  }
  if (!view.supported || !ENTRY_KINDS.includes(view.kind)) {
    next.unsupported = t === zhT && view.suggestion ? view.suggestion : t("unsupported.default");
    return next;
  }
  next.kind = view.kind as EntryKind;
  return next;
}

/** 用户手动点选类型：之后的自动识别不再改动类型。 */
export function chooseKind(state: EntryState, kind: EntryKind): EntryState {
  const next: EntryState = { ...state, kind, manual: true };
  delete next.unsupported;
  return next;
}

/** 自动识别成功时给出的小字提示；手动模式或未开放时不提示。 */
export function subjectLabel(key: string, t: TFunction = zhT, fallback = ""): string {
  const translationKey = `subject.${key}` as Parameters<TFunction>[0];
  return ["career", "wealth", "documents", "wellbeing", "illness", "peers", "relationship"].includes(key)
    ? t(translationKey)
    : fallback;
}

export function autoHint(state: EntryState, t: TFunction = zhT): string | null {
  if (state.manual || state.unsupported) {
    return null;
  }
  if (state.kind === "question") {
    const subject = t === zhT && state.subject
      ? state.subject
      : subjectLabel(state.subjectKey, t, state.subject);
    return subject ? t("status.detected.subject", { subject }) : t("status.detected.question");
  }
  if (state.kind === "fortune") {
    return t("status.detected.fortune", { horizon: horizonLabel(state.horizon, t) });
  }
  if (state.kind === "naming") {
    return t("status.detected.naming", {
      target: t(state.target === "business" ? "naming.business" : "naming.person"),
    });
  }
  return t("status.detected.destiny");
}

/** 英文首页只把分类结果作为建议，不替用户改变类型或事项。 */
export function classificationHint(view: ClassificationView, t: TFunction): string {
  if (view.kind === "question") {
    const subject = subjectLabel(view.subjectKey ?? "", t, view.subject);
    return subject ? t("status.detected.subject", { subject }) : t("status.detected.question");
  }
  if (view.kind === "fortune") {
    return t("status.detected.fortune", { horizon: horizonLabel(entryHorizon(view.horizon), t) });
  }
  if (view.kind === "naming") {
    return t("status.detected.naming", {
      target: t(view.target === "business" ? "naming.business" : "naming.person"),
    });
  }
  return t("status.detected.destiny");
}

export interface GateInput {
  questionLength: number;
  classified: boolean;
  entry: EntryState;
  birthProblem: string | null;
  /** 生辰行已开始填并就地报错；此时按钮下不再重复同一句。 */
  birthShown?: boolean;
}

/** 问卦按钮是否可用，不可用时给出就地说明。 */
export function entryGate(
  input: GateInput,
  t: TFunction = zhT,
  options: { requireManualKind?: boolean; requireQuestionSubject?: boolean } = {},
): { ready: boolean; reason: string } {
  const emptyDestiny = input.entry.kind === "destiny" && input.questionLength === 0;
  if (!emptyDestiny && input.questionLength < 4) {
    return { ready: false, reason: t("gate.questionLength") };
  }
  if (!emptyDestiny && options.requireManualKind && !input.entry.manual) {
    return { ready: false, reason: t("gate.kindRequired") };
  }
  if (options.requireQuestionSubject && input.entry.kind === "question" && !input.entry.subjectKey) {
    return { ready: false, reason: t("gate.subjectRequired") };
  }
  if (!emptyDestiny && !input.classified && !input.entry.manual) {
    return { ready: false, reason: t("status.classifying") };
  }
  if (input.entry.unsupported) {
    return { ready: false, reason: input.entry.unsupported };
  }
  if (input.entry.kind !== "question" && input.birthProblem) {
    return { ready: false, reason: input.birthShown ? "" : t("gate.birth", { problem: input.birthProblem }) };
  }
  return { ready: true, reason: "" };
}

/** 命理空问题在付款前补成固定问题；非空输入仍使用用户原话。 */
export function submissionQuestion(
  state: EntryState,
  question: string,
  t: TFunction = zhT,
): string {
  const value = question.trim();
  return state.kind === "destiny" && value === "" ? t("destiny.defaultQuestion") : value;
}

/** 付款时带给服务端的分类：只带所选类型需要的字段。 */
export function paymentClassification(state: EntryState, question: string): ClassificationView {
  const base: ClassificationView = { question, kind: state.kind, supported: true };
  if (state.kind === "question" && state.subjectKey) {
    return { ...base, subjectKey: state.subjectKey, subject: state.subject };
  }
  if (state.kind === "fortune") {
    return { ...base, horizon: state.horizon };
  }
  return base;
}

/** 用户在首页的手动选择：类型、事项、时间范围。未选的项为 undefined。 */
export interface EntryChoice {
  kind?: EntryKind;
  subjectKey?: string;
  subject?: string;
  horizon?: string;
  target?: NamingTarget;
}

/** 渲染时由分类结果与手动选择合成入口状态，避免异步分类覆盖用户手选。 */
export function deriveEntry(
  view: ClassificationView | undefined,
  choice: EntryChoice,
  t: TFunction = zhT,
  lang: "zh" | "en" = "zh",
): EntryState {
  let state = DEFAULT_ENTRY;
  if (choice.kind) {
    state = chooseKind(state, choice.kind);
  }
  if (view && lang === "zh") {
    state = applyClassification(state, view, t);
  }
  if (choice.subjectKey !== undefined) {
    state = { ...state, subjectKey: choice.subjectKey, subject: choice.subject ?? "" };
  }
  if (choice.horizon) {
    state = { ...state, horizon: choice.horizon };
  }
  if (choice.target) {
    state = { ...state, target: choice.target };
  }
  return state;
}

export type NamingBirthValues = Omit<BirthFormValues, "gender"> & {
  gender: BirthFormValues["gender"] | "any";
};

export interface NamingFormValues {
  entry: EntryState;
  target: NamingTarget;
  surname: string;
  length: 1 | 2 | 3 | 4;
  unborn: boolean;
  ownerBirthEnabled: boolean;
  birth: NamingBirthValues;
}

export const DEFAULT_NAMING_FORM: NamingFormValues = {
  entry: { ...DEFAULT_ENTRY, kind: "naming" }, target: "person", surname: "", length: 2,
  unborn: false, ownerBirthEnabled: false, birth: { ...EMPTY_BIRTH },
};

/** 起名生辰单独校验；「不限」只影响取名用字，排盘按男命传入。 */
export function namingBirthProblem(
  value: NamingBirthValues,
  unborn: boolean,
  t: TFunction = zhT,
): string | null {
  return birthProblem({
    ...value,
    time: unborn ? "" : value.time,
    gender: value.gender === "any" ? "male" : value.gender,
  }, t);
}

export function namingGate(input: {
  questionLength: number;
  value: NamingFormValues;
  birthProblem: string | null;
}, t: TFunction = zhT): { ready: boolean; reason: string } {
  const { value } = input;
  if (value.target === "person") {
    if (!/^[一-鿿]{1,2}$/u.test(value.surname.trim())) {
      return { ready: false, reason: t("gate.surname") };
    }
    if (input.birthProblem) {
      return { ready: false, reason: t("gate.namingBirth", { problem: input.birthProblem }) };
    }
    return { ready: true, reason: "" };
  }
  if (input.questionLength < 2) {
    return { ready: false, reason: t("gate.namingLength") };
  }
  if (value.ownerBirthEnabled && input.birthProblem) {
    return { ready: false, reason: t("gate.ownerBirth", { problem: input.birthProblem }) };
  }
  return { ready: true, reason: "" };
}

export interface NamingRequest {
  question: string;
  kind: "naming";
  target: NamingTarget;
  surname?: string;
  gender: "male" | "female" | "any";
  length: 1 | 2 | 3 | 4;
  unborn: boolean;
  birth?: BirthProfileInput;
}

export function namingRequest(question: string, value: NamingFormValues): NamingRequest {
  const useBirth = value.target === "person" || value.ownerBirthEnabled;
  const gender: NamingRequest["gender"] = value.birth.gender || "any";
  const normalized: BirthFormValues = {
    ...value.birth,
    time: value.unborn ? "" : value.birth.time,
    gender: value.birth.gender === "any" ? "male" : value.birth.gender,
  };
  return {
    question, kind: "naming", target: value.target,
    ...(value.target === "person" ? { surname: value.surname.trim() } : {}),
    gender, length: value.length, unborn: value.target === "person" && value.unborn,
    ...(useBirth ? { birth: toBirthInput(normalized) } : {}),
  };
}
