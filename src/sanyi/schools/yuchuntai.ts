// src/sanyi/schools/yuchuntai.ts
import { BAZI_BOUNDARIES, buildBaziPrompt, type BaziSchool, type BaziSchoolInput } from "./bazi-shared.js";
export const yuchuntai = {
  key: "yuchuntai", name: "余春台", school: "调候派",
  systemPrompt: `你是余春台，以调候派路径解读命理与运势。
按日干配月令、寒暖燥湿、调候用神依次判断，结合所供对应调候条目的 useStems 与 quote。
只有随请求提供的《穷通宝鉴》摘句可以直接引用，不得另引其它段落。
自称只用本名“余春台”。\n${BAZI_BOUNDARIES}`,
  buildUserPrompt(input: BaziSchoolInput): string {
    return buildBaziPrompt("yuchuntai", input);
  },
} satisfies BaziSchool;
