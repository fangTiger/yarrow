export type QuestionTrack = "question" | "wager";
export type QuestionHorizon = "none" | "short" | "long";
export type QuestionSubjectKey = "career" | "wealth" | "documents" | "wellbeing" | "illness" | "peers" | "relationship";
export type QuestionUseGod = "父母" | "子孙" | "官鬼" | "妻财" | "兄弟";

export interface QuestionSubjectOption {
  key: QuestionSubjectKey;
  label: string;
  useGod: QuestionUseGod;
  scope: string;
}

export interface QuestionSubjectSuggestion extends QuestionSubjectOption {
  reason: string;
}

export interface ConfirmedQuestionSubject extends QuestionSubjectSuggestion {
  suggestedKey: QuestionSubjectKey;
  overridden: boolean;
}

/**
 * 事项到用神的产品口径依据《增删卜易·用神章》，只用于给出可改选建议。
 * “感情／伴侣”因古法会随所问对象区分妻财与官鬼，默认明确标成官鬼口径，
 * 由用户在确认卡改选，绝不根据姓名、性别或卦象暗中推断。
 */
export const QUESTION_SUBJECTS: readonly QuestionSubjectOption[] = [
  { key: "career", label: "工作／官职", useGod: "官鬼", scope: "工作、官职、功名、丈夫、盗贼" },
  { key: "wealth", label: "钱财／货品", useGod: "妻财", scope: "钱财、物价、器具、货品、债务" },
  { key: "documents", label: "房产／文书", useGod: "父母", scope: "房产、车船、土地、单位、文书、契约、衣物" },
  { key: "wellbeing", label: "技术／医药／解忧", useGod: "子孙", scope: "技术、艺术、医药、解忧、避灾、娱乐、子女" },
  { key: "illness", label: "健康／疾病", useGod: "官鬼", scope: "疾病、病因与忧虑" },
  { key: "peers", label: "人际／同辈", useGod: "兄弟", scope: "兄弟姐妹、朋友、同事、竞争者" },
  { key: "relationship", label: "感情／伴侣（官鬼口径）", useGod: "官鬼", scope: "泛指感情或伴侣；未获知对象身份时必须由用户核对" },
] as const;

export interface QuestionClassification {
  question: string;
  track: QuestionTrack;
  horizon: QuestionHorizon;
  reason: string;
  signals: readonly string[];
  subject: QuestionSubjectSuggestion;
}

export interface ConfirmedQuestionTrack extends QuestionClassification {
  suggestedTrack: QuestionTrack;
  overridden: boolean;
}

const NORMATIVE = /该不该|要不要|值不值得|应不应该|怎么办|如何选择|选哪个/;
const INNER_STATE = /怎么想|在想什么|爱不爱|真心|内心|态度到底|是否喜欢我/;
const SUBJECTIVE = /顺利|幸福|运势|前途|适合|好不好|未来如何|怎么样|会好吗|有希望吗/;
const OBSERVABLE = /收到|拿到|通过|录取|入职|签约|成交|完成|坚持|和好|联系|回复|见面|下雨|降雨|下雪|涨到|跌到|到达|发生|发布|上线|交付|跑步|打卡|还款|到账|结婚|分手/;
const FUTURE_BOUNDARY = /今天|今日|明天|本周|这周|一周|月底|这个月|本月|下个月|今年|年底|之前|之内|以后|未来\s*\d+|\d+\s*(?:天|周|个月|月|小时|分钟)/;
const BINARY_FORM = /会不会|能不能|是否|有没有|可不可以|能否/;
const SHORT_BOUNDARY = /今天|今日|明天|\d+\s*(?:小时|分钟)/;

const SUBJECT_SIGNALS: ReadonlyArray<{
  key: QuestionSubjectKey;
  pattern: RegExp;
  reason: string;
}> = [
  { key: "documents", pattern: /房产|房屋|房子|车船|车辆|土地|单位|文书|合同|契约|文件|证件|衣物/, reason: "问题涉及房产、载具、单位或文书契约。" },
  { key: "illness", pattern: /疾病|生病|病情|病因|健康|疼痛|症状|忧虑|焦虑/, reason: "问题直接涉及疾病、健康或忧虑。" },
  { key: "wellbeing", pattern: /技术|艺术|医药|药物|医生|治疗|解忧|避灾|福气|娱乐|游戏|子女|孩子|儿子|女儿/, reason: "问题涉及技术、医药、解忧或子女。" },
  { key: "wealth", pattern: /钱财|钱|财运|物价|价格|器具|货品|商品|债务|欠款|还款|收款|收入|工资|薪资|到账/, reason: "问题涉及钱财、货品、价格或债务。" },
  { key: "peers", pattern: /兄弟|姐妹|朋友|同事|同僚|同行|竞争者|竞争对手|队友|同学/, reason: "问题涉及同辈、人际或竞争关系。" },
  {
    key: "career",
    pattern: new RegExp(
      "面试|求职|应聘|跳槽|辞职|离职|工作|职业|事业|岗位|"
        + "官职|功名|升职|入职|offer|录取|丈夫|老公|先生|盗贼|小偷",
    ),
    reason: "问题涉及求职、工作、官职或功名。",
  },
  { key: "relationship", pattern: /感情|恋爱|伴侣|对象|男友|女友|喜欢|爱不爱|和好|结婚|分手/, reason: "问题泛指感情或伴侣；古法随所问对象有不同取法，请在确认卡核对。" },
];

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ");
}

function subjectOption(key: QuestionSubjectKey): QuestionSubjectOption {
  const option = QUESTION_SUBJECTS.find((item) => item.key === key);
  if (!option) throw new Error(`未知事项主题：${key}`);
  return option;
}

/** 只读问题文字的确定性主题建议；不接收卦象、身份、概率或链上状态。 */
export function classifyQuestionSubject(question: string): QuestionSubjectSuggestion {
  const matched = SUBJECT_SIGNALS.find((item) => item.pattern.test(question));
  if (matched) return { ...subjectOption(matched.key), reason: matched.reason };
  return {
    ...subjectOption("peers"),
    reason: "没有命中明确事项词，暂按人际／同辈给出低置信建议；请在起卦前改选更贴切的主题。",
  };
}

/** 用户可否决主题建议；只接受公开白名单键，原问题始终不被改写。 */
export function confirmQuestionSubject(
  suggestion: QuestionSubjectSuggestion,
  selectedKey: unknown,
): ConfirmedQuestionSubject {
  if (typeof selectedKey !== "string" || !QUESTION_SUBJECTS.some((item) => item.key === selectedKey)) {
    throw new Error("事项主题不在允许的选项中");
  }
  const option = subjectOption(selectedKey as QuestionSubjectKey);
  return {
    ...option,
    reason: selectedKey === suggestion.key
      ? suggestion.reason
      : `用户否决了“${suggestion.label}”建议，改按“${option.label}”取用神；原问题保持不变。`,
    suggestedKey: suggestion.key,
    overridden: selectedKey !== suggestion.key,
  };
}

/**
 * 中立分类只判断“未来是否会出现单一可观察答案”。
 * 不接收卦象、易者身份、概率、押注额或任何链上候选谓词。
 */
export function classifyQuestion(rawQuestion: string): QuestionClassification {
  const question = normalizeQuestion(rawQuestion);
  if (question.length < 4 || question.length > 280) throw new Error("问题长度必须为 4–280 个字符");

  const signals: string[] = [];
  const subject = classifyQuestionSubject(question);
  if (NORMATIVE.test(question)) signals.push("规范性选择");
  if (INNER_STATE.test(question)) signals.push("他人内在状态");
  if (SUBJECTIVE.test(question)) signals.push("缺少唯一判断标准");
  if (FUTURE_BOUNDARY.test(question)) signals.push("存在时间边界");
  if (OBSERVABLE.test(question)) signals.push("存在可观察事件");
  if (BINARY_FORM.test(question)) signals.push("问题可作是否判断");

  const inherentlyUnresolved = NORMATIVE.test(question) || INNER_STATE.test(question) || SUBJECTIVE.test(question);
  const objectivelyResolvable = FUTURE_BOUNDARY.test(question) && OBSERVABLE.test(question) && BINARY_FORM.test(question);
  if (!inherentlyUnresolved && objectivelyResolvable) {
    return {
      question,
      track: "wager",
      horizon: SHORT_BOUNDARY.test(question) ? "short" : "long",
      reason: "这件事有明确的时间边界和可观察结果，将来可以由提问者见证。",
      signals,
      subject,
    };
  }

  const reason = NORMATIVE.test(question)
    ? "这是一个需要你作出的选择，不会由将来某个事实替你决定。"
    : INNER_STATE.test(question)
      ? "他人的内在想法没有一个能由未来事实唯一揭晓的答案。"
      : SUBJECTIVE.test(question)
        ? "这件事缺少唯一、可复核的判断标准，不会自动揭晓一个共同答案。"
        : "目前没有识别到同时具备时间边界和单一可观察结果的答案。";
  return { question, track: "question", horizon: "none", reason, signals, subject };
}

/** 用户拥有最终分流权；否决只切换轨道，不改写原问题。 */
export function confirmQuestionTrack(
  classification: QuestionClassification,
  decision: "accept" | "deny",
): ConfirmedQuestionTrack {
  if (decision === "accept") {
    return { ...classification, suggestedTrack: classification.track, overridden: false };
  }
  const track: QuestionTrack = classification.track === "question" ? "wager" : "question";
  return {
    ...classification,
    track,
    suggestedTrack: classification.track,
    overridden: true,
    reason: `用户否决了分类结果，已切换到${track === "question" ? "問轨" : "賭轨"}；原问题保持不变。`,
  };
}
