// web/lib/home-entry.ts
import type { Classification } from "./api.js";
import { entryHorizon } from "./birth-entry.js";

export type EntryKind = "question" | "fortune" | "destiny";

/** 规则分类的前端视图，也是付款时带给服务端的分类。 */
export interface ClassificationView {
  question: string;
  kind: string;
  supported: boolean;
  subjectKey?: string;
  subject?: string;
  horizon?: string;
  suggestion?: string;
}

/** 首页入口状态：所选类型、是否手动点选、事项、时间范围与未开放提示。 */
export interface EntryState {
  kind: EntryKind;
  manual: boolean;
  subjectKey: string;
  subject: string;
  horizon: string;
  unsupported?: string;
}

export const DEFAULT_ENTRY: EntryState = {
  kind: "question", manual: false, subjectKey: "", subject: "", horizon: "year",
};

export const KIND_OPTIONS = [
  ["question", "问事"],
  ["fortune", "运势"],
  ["destiny", "命理"],
] as const;

export const PLACEHOLDERS: Record<EntryKind, string> = {
  question: "例如：这次面试能过吗？",
  fortune: "例如：我今年运势如何？",
  destiny: "例如：我适合做什么工作？",
};

export const HORIZON_OPTIONS = [
  ["today", "今天"],
  ["month", "本月"],
  ["year", "今年"],
  ["next-year", "明年"],
] as const;

export function horizonLabel(horizon: string): string {
  const option = HORIZON_OPTIONS.find(([value]) => value === horizon);
  if (option) {
    return option[1];
  }
  const year = horizon.match(/^year:(\d{4})$/);
  return year ? `${year[1]} 年` : "今年";
}

const ENTRY_KINDS: readonly string[] = ["question", "fortune", "destiny"];

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
  };
}

/** 套用规则分类：自动模式下切换类型与细项；手动点选过类型时只补细项。 */
export function applyClassification(state: EntryState, view: ClassificationView): EntryState {
  const next: EntryState = { ...state };
  delete next.unsupported;
  if (view.subjectKey && view.subject) {
    next.subjectKey = view.subjectKey;
    next.subject = view.subject;
  }
  if (view.kind === "fortune") {
    next.horizon = entryHorizon(view.horizon);
  }
  if (state.manual) {
    return next;
  }
  if (!view.supported || !ENTRY_KINDS.includes(view.kind)) {
    next.unsupported = view.suggestion ?? "这类问题即将开放，可点选「问事」照常起卦";
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
export function autoHint(state: EntryState): string | null {
  if (state.manual || state.unsupported) {
    return null;
  }
  if (state.kind === "question") {
    return state.subject ? `已自动识别为问事 · ${state.subject}` : "已自动识别为问事";
  }
  if (state.kind === "fortune") {
    return `已自动识别为运势 · ${horizonLabel(state.horizon)}`;
  }
  return "已自动识别为命理";
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
export function entryGate(input: GateInput): { ready: boolean; reason: string } {
  if (input.questionLength < 4) {
    return { ready: false, reason: "先写下想问的事（至少 4 个字）" };
  }
  if (!input.classified && !input.entry.manual) {
    return { ready: false, reason: "识别中" };
  }
  if (input.entry.unsupported) {
    return { ready: false, reason: input.entry.unsupported };
  }
  if (input.entry.kind !== "question" && input.birthProblem) {
    return { ready: false, reason: input.birthShown ? "" : `请先填好生辰：${input.birthProblem}` };
  }
  return { ready: true, reason: "" };
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
}

/** 渲染时由分类结果与手动选择合成入口状态，避免异步分类覆盖用户手选。 */
export function deriveEntry(view: ClassificationView | undefined, choice: EntryChoice): EntryState {
  let state = DEFAULT_ENTRY;
  if (choice.kind) {
    state = chooseKind(state, choice.kind);
  }
  if (view) {
    state = applyClassification(state, view);
  }
  if (choice.subjectKey !== undefined) {
    state = { ...state, subjectKey: choice.subjectKey, subject: choice.subject ?? "" };
  }
  if (choice.horizon) {
    state = { ...state, horizon: choice.horizon };
  }
  return state;
}
