// src/sanyi/classify.ts
import {
  QUESTION_SUBJECTS,
  classifyQuestionSubject,
  type QuestionSubjectKey,
  type QuestionSubjectSuggestion,
} from "../oracle/question-classifier.js";
export type QuestionKind =
  | "question"
  | "destiny"
  | "fortune"
  | "naming"
  | "date-selection"
  | "zodiac"
  | "compatibility"
  | "other";
export type FortuneHorizon = "today" | "month" | "year" | "next-year" | `year:${number}`;
export interface QuestionClassification {
  question: string;
  kind: QuestionKind;
  horizon?: FortuneHorizon;
  subject?: QuestionSubjectSuggestion;
  supported: boolean;
  needsBirth: boolean;
  target?: "person" | "business";
  suggestion?: string;
}

const RULES: ReadonlyArray<[Exclude<QuestionKind, "question" | "other">, RegExp]> = [
  ["naming", /起名|取名|名字/],
  ["compatibility", /合婚|合不合|八字合/],
  ["date-selection", /择日|哪天|吉日|搬家.*日/],
  [
    "zodiac",
    new RegExp(
      "星座|星盘|白羊|金牛|双子|巨蟹|狮子|处女|天秤|"+
      "天蝎|射手|摩羯|水瓶|双鱼",
    ),
  ],
  ["fortune", /运势|运气|流年|财运/],
  ["destiny", /八字|命里|命格|适合做什么|性格|一生命运/],
];
const UNSUPPORTED: Record<Exclude<QuestionKind, "question" | "destiny" | "fortune" | "naming">, string> = {
  "date-selection": "择日即将开放。也可以把候选日期当作一件事来问。",
  zodiac: "星座即将开放。也可以把关心的事情改为问事。",
  compatibility: "合婚即将开放。也可以把这段关系改为一件事来问。",
  other: "暂时无法识别这个问题，请改写成一件具体的事来问。",
};
const BUSINESS_NAMING = /公司|店|品牌|商号|字号|工作室|餐厅|咖啡|茶馆|门店|企业/u;
function namingTarget(question: string): "person" | "business" {
  return BUSINESS_NAMING.test(question) ? "business" : "person";
}
export function normalizeQuestion(value: string): string {
  const question = value.trim().replace(/\s+/g, " ");
  if (question.length < 4 || question.length > 280) {
    throw new Error("问题长度必须为 4–280 个字符");
  }
  return question;
}
function horizonFor(question: string): FortuneHorizon {
  const year = question.match(/(20\d{2})年/)?.[1];
  if (year) return `year:${Number(year)}`;
  if (/今天|今日/.test(question)) return "today";
  if (/本月|这个月/.test(question)) return "month";
  if (/明年/.test(question)) return "next-year";
  return "year";
}

export function classifyQuestion(raw: string): QuestionClassification {
  const question = normalizeQuestion(raw);
  const matched = RULES.find(([, pattern]) => pattern.test(question));
  const hasText = /[\p{Script=Han}A-Za-z]/u.test(question);
  const kind: QuestionKind = matched?.[0] ?? (hasText ? "question" : "other");
  const supported = kind === "question" || kind === "destiny" || kind === "fortune" || kind === "naming";
  const target = kind === "naming" ? namingTarget(question) : undefined;
  return {
    question,
    kind,
    supported,
    needsBirth: kind === "destiny" || kind === "fortune" || target === "person",
    ...(target ? { target } : {}),
    ...(kind === "fortune" ? { horizon: horizonFor(question) } : {}),
    ...(kind === "question" ? { subject: classifyQuestionSubject(question) } : {}),
    ...(!supported ? { suggestion: UNSUPPORTED[kind as keyof typeof UNSUPPORTED] } : {}),
  };
}
export function overrideClassification(
  base: QuestionClassification,
  patch: { kind?: QuestionKind; horizon?: FortuneHorizon | string; subjectKey?: QuestionSubjectKey },
): QuestionClassification {
  const kind = patch.kind ?? base.kind;
  const kinds: readonly QuestionKind[] = [
    "question",
    "destiny",
    "fortune",
    "naming",
    "date-selection",
    "zodiac",
    "compatibility",
    "other",
  ];
  if (!kinds.includes(kind)) {
    throw new Error("问题类型无效");
  }
  if (
    patch.horizon !== undefined
    && !/^(today|month|year|next-year|year:20\d{2})$/.test(patch.horizon)
  ) {
    throw new Error("时间范围无效");
  }
  const option = patch.subjectKey === undefined
    ? undefined
    : QUESTION_SUBJECTS.find((item) => item.key === patch.subjectKey);
  if (patch.subjectKey !== undefined && !option) {
    throw new Error("事项类型无效");
  }
  return {
    question: base.question,
    kind,
    supported: kind === "question" || kind === "destiny" || kind === "fortune" || kind === "naming",
    needsBirth: kind === "destiny" || kind === "fortune"
      || (kind === "naming" && namingTarget(base.question) === "person"),
    ...(kind === "naming" ? { target: base.target ?? namingTarget(base.question) } : {}),
    ...(kind === "fortune" ? { horizon: (patch.horizon ?? base.horizon ?? "year") as FortuneHorizon } : {}),
    ...(kind === "question"
      ? {
          subject: option
            ? { ...option, reason: "用户在付款前主动改选事项。" }
            : base.subject ?? classifyQuestionSubject(base.question),
        }
      : {}),
    ...(!["question", "destiny", "fortune", "naming"].includes(kind)
      ? { suggestion: UNSUPPORTED[kind as keyof typeof UNSUPPORTED] }
      : {}),
  };
}
