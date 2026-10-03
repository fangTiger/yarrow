// src/sanyi/schools/index.ts
import { chengyi } from "./chengyi.js";
import { jingfang } from "./jingfang.js";
import { shaoyong } from "./shaoyong.js";

export const QUESTION_SCHOOLS = [chengyi, jingfang, shaoyong] as const;
export type QuestionSchoolKey = typeof QUESTION_SCHOOLS[number]["key"];
