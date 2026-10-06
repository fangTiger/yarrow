// src/sanyi/schools/bazi-index.ts
import { shenxiaozhan } from "./shenxiaozhan.js";
import { yuchuntai } from "./yuchuntai.js";
import { rentieqiao } from "./rentieqiao.js";
export const BAZI_SCHOOLS = [shenxiaozhan, yuchuntai, rentieqiao] as const;
export type { BaziSchoolKey } from "./bazi-shared.js";
