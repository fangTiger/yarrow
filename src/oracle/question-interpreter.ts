import { getHexagramText } from "../agent/zhouyi-corpus.js";
import type { StructuredOutputProvider } from "../agent/provider.js";
import type { JsonSchema } from "../agent/schemas.js";
import type {
  QuestionInterpretation,
  QuestionInterpretationInput,
  QuestionInterpreter,
} from "./question-oracle.js";

interface QuestionReadingOutput {
  interpretation: string;
  counsel: string;
}

const QUESTION_READING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["interpretation", "counsel"],
  properties: {
    interpretation: { type: "string", minLength: 1, maxLength: 180 },
    counsel: { type: "string", minLength: 1, maxLength: 120 },
  },
} as const satisfies JsonSchema;

const SYSTEM_PROMPT = `你是一位克制的易者。用户的问题没有一个会由将来事实唯一揭晓的答案；你只作主观解释与可行动建议，不替用户决定，不作事实承诺，不宣称神谕。页面已有统一责任文案，输出不得复述“主观解释”“不能替用户决定”“不担保”等责任声明，直接给出判断与动作。依据同一组六爻确定性推算出的本卦、互卦、综卦、变卦、错卦，输出 interpretation 与 counsel 两个字段。关系口诀：本卦为体，互卦探隐，综卦观反，变卦测果，错卦警变。`;

/** 問轨与可赔付预测使用不同输出契约，避免把主观解读伪装成未来事实。 */
export class ProviderQuestionInterpreter implements QuestionInterpreter {
  constructor(private readonly provider: StructuredOutputProvider) {}

  async interpret(input: QuestionInterpretationInput): Promise<QuestionInterpretation> {
    const { primary, mutual, reversed, derived, opposite } = input.hexagram.five;
    const renderFigure = (label: string, figure: typeof primary): string => {
      const text = getHexagramText(figure.kingWenNumber);
      return `${label}（${figure.meaning}）：${text.kingWenNumber}・${text.name}；卦辞：${text.judgement}`;
    };
    return this.provider.generateStructured<QuestionReadingOutput>({
      taskId: `question-reading/${input.divinerKey}`,
      systemPrompt: SYSTEM_PROMPT,
      cacheSystemPrompt: true,
      userPrompt: [
        `身份取向：${input.divinerName}`,
        `所问：${input.question}`,
        ...(input.subject ? [
          `最终确认事项：${input.subject.label}${input.subject.overridden ? "（用户已改选）" : ""}`,
          `用神：${input.subject.useGod}`,
        ] : []),
        `六爻自下而上：${input.hexagram.lines.join("、")}`,
        `动爻：${input.hexagram.changingLinePositions.join("、") || "无"}`,
        renderFigure("本卦", primary),
        renderFigure("互卦", mutual),
        renderFigure("综卦", reversed),
        renderFigure("变卦", derived),
        renderFigure("错卦", opposite),
        "请从五卦中点明与你的判断最相关的一至两卦，并给出一个用户今天能自行验证或执行的动作；不要重复页面的责任声明。",
      ].join("\n"),
      schema: QUESTION_READING_SCHEMA,
      effort: "high",
    });
  }
}

/** 零成本验收用固定解读；只依赖卦象与角色，不访问网络或模型。 */
export class DeterministicQuestionInterpreter implements QuestionInterpreter {
  async interpret(input: QuestionInterpretationInput): Promise<QuestionInterpretation> {
    const { primary, mutual, reversed, derived, opposite } = input.hexagram.five;
    const readings: Record<string, QuestionInterpretation> = {
      takashima: {
        interpretation: `本卦${primary.name}看处境，变卦${derived.name}看变化。`,
        counsel: "依本卦与变卦，写下继续与离开各自最具体的一项代价。",
      },
      wuxing: {
        interpretation: `${input.subject ? `${input.subject.useGod}为焦点；` : ""}互卦${mutual.name}探隐，错卦${opposite.name}警变；动爻在${input.hexagram.changingLinePositions.join("、") || "静位"}。`,
        counsel: "沿互卦所示症结列三条可验证条件，再标注已知与未知。",
      },
      meihua: {
        interpretation: `综卦${reversed.name}看对方，变卦${derived.name}看变化。`,
        counsel: "从综卦的对方立场先做一个可撤回的小决定，观察真实反应。",
      },
    };
    return readings[input.divinerKey] ?? {
      interpretation: `${primary.name}之${derived.name}，先看变化。`,
      counsel: "保留判断，并从一个可撤回的动作开始。",
    };
  }
}
