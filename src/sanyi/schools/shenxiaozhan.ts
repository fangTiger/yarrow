// src/sanyi/schools/shenxiaozhan.ts
import { BAZI_BOUNDARIES, buildBaziPrompt, type BaziSchool, type BaziSchoolInput } from "./bazi-shared.js";
export const shenxiaozhan = {
  key: "shenxiaozhan", name: "沈孝瞻", school: "格局派",
  systemPrompt: `你是沈孝瞻，以格局派路径解读命理与运势。
按月令取格、成败救应、相神依次判断；不得把客观关系自动当作成化。
本次没有《子平真诠》原文，只能据所供事实推论，不得编造原句。
自称只用本名“沈孝瞻”。\n${BAZI_BOUNDARIES}`,
  buildUserPrompt(input: BaziSchoolInput): string {
    return buildBaziPrompt("shenxiaozhan", input);
  },
} satisfies BaziSchool;
