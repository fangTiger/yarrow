import rawGuides from "./hexagram-guides.en.json" with { type: "json" };
import { englishForbiddenErrors } from "../sanyi/english/audit.js";

const HAN = /\p{Script=Han}/u;

export function validateHexagramGuides(value: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(value) || value.length !== 64) {
    errors.push("英文卦导读必须恰有 64 条");
  }
  if (!Array.isArray(value)) return errors;
  value.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push(`第 ${index + 1} 卦导读必须是字符串`);
      return;
    }
    const words = item.trim() === "" ? [] : item.trim().split(/\s+/u);
    if (words.length < 60 || words.length > 100) {
      errors.push(`第 ${index + 1} 卦导读字数须为 60–100 个英文词，实际 ${words.length}`);
    }
    if (HAN.test(item)) errors.push(`第 ${index + 1} 卦导读不得含汉字`);
    errors.push(...englishForbiddenErrors(item).map((error) => `第 ${index + 1} 卦导读：${error}`));
  });
  return errors;
}

const errors = validateHexagramGuides(rawGuides);
if (errors.length > 0) throw new Error(errors.join("\n"));

export const HEXAGRAM_GUIDES: readonly string[] = rawGuides;
