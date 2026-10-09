import { CLASSIC_LINES, isNegativeChar } from "./classics.js";
import { isNameChar, nameChars, type CharInfo } from "./lexicon.js";

const FUNCTION_WORDS = new Set([
  ..."之乎者也矣焉哉兮而以其于於为不无有所是此彼尔汝吾我余予何谁孰莫勿毋弗未非亦又且乃则即皆俱都已了么吗呢吧啊的地得着过个们这那些哪曰云谓与及或若如耳",
]);

const UNSUITABLE_CHARS = new Set([
  ..."刀歹乏打扒扑卜匕斗屯币叉丑丐尸叹吃吞吐咬骂扔挖砍劈拔拆拖推挤压逼迫抢夺偷骗赌狗猪驴蛇蝎虫蚁鼠蛙肚肠臀乳皮毛尾牙舌鼻屁尘泥沙土灰冷寒暗黑老旧弃失落去归离散难",
]);

const frequencies = new Map<string, number>();
for (const line of CLASSIC_LINES) {
  for (const char of line.text) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }
}

const pool = nameChars((info) => (
  isNameChar(info.char)
  && info.level <= 2
  && (frequencies.get(info.char) ?? 0) >= 3
  && !FUNCTION_WORDS.has(info.char)
  && !UNSUITABLE_CHARS.has(info.char)
  && !isNegativeChar(info.char)
)).sort((left, right) => (
  (frequencies.get(right.char) ?? 0) - (frequencies.get(left.char) ?? 0)
  || left.char.codePointAt(0)! - right.char.codePointAt(0)!
));

export function nameWorthyChars(filter?: (info: CharInfo) => boolean): CharInfo[] {
  const result = filter ? pool.filter(filter) : pool;
  return [...result];
}
