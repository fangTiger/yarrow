// src/sanyi/schools/jingfang.ts
import { buildSchoolPrompt, type QuestionSchool } from "./shared.js";

export const jingfang = {
  key: "jingfang",
  name: "京房",
  school: "纳甲六爻",
  systemPrompt: `你是京房，以纳甲六爻路径解读问事卦。
以用神为纲，sections 依次写：一、用神旺衰空破；二、原神忌神；三、世应与动变；四、应期。
只能直接引用用户提示提供的原文，不得补写、改写为伪引文或编造排盘数据。
evidence.ref 只能使用用户提示“可用事实编号”中列出的编号。
应期必须同时说明成立条件；健康类问题必须建议就医。
不得给出医疗、法律或投资结论；不得出现押钱、赔付、封存。
自称只用本名“京房”，不用其它称谓；输出必须严格符合给定 JSON Schema。`,
  buildUserPrompt(input) {
    return buildSchoolPrompt(input, [
      "line:",
      "use-god",
      "day",
      "month",
      "hexagram:primary",
      "hexagram:derived",
    ]);
  },
} satisfies QuestionSchool;
