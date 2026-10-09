import assert from "node:assert/strict";
import test from "node:test";
import { CLASSIC_LINES } from "../src/sanyi/naming/classics.js";
import { isNameChar } from "../src/sanyi/naming/lexicon.js";
import { nameWorthyChars } from "../src/sanyi/naming/pool.js";

const FUNCTION_WORDS =
  "之乎者也矣焉哉兮而以其于於为不无有所是此彼尔汝吾我余予何谁孰莫勿毋弗未非亦又且乃则即皆俱都已了么吗呢吧啊的地得着过个们这那些哪曰云谓与及或若如耳";
const UNSUITABLE =
  "刀歹乏打扒扑卜匕斗屯币叉丑丐尸叹吃吞吐咬骂扔挖砍劈拔拆拖推挤压逼迫抢夺偷骗赌狗猪驴蛇蝎虫蚁鼠蛙肚肠臀乳皮毛尾牙舌鼻屁尘泥沙土灰冷寒暗黑老旧弃失落去归离散";

function counts(): Map<string, number> {
  const result = new Map<string, number>();
  for (const line of CLASSIC_LINES) {
    for (const char of line.text) {
      result.set(char, (result.get(char) ?? 0) + 1);
    }
  }
  return result;
}

test("宜入名字池排除虚词与不宜字，只收一二级且语料至少出现三次", () => {
  const pool = nameWorthyChars();
  const chars = new Set(pool.map(({ char }) => char));
  for (const char of [...FUNCTION_WORDS, ...UNSUITABLE]) {
    assert.equal(chars.has(char), false, char);
  }
  const frequencies = counts();
  assert.ok(pool.every((info) => isNameChar(info.char)));
  assert.ok(pool.every((info) => info.level === 1 || info.level === 2));
  assert.ok(pool.every((info) => (frequencies.get(info.char) ?? 0) >= 3));
});

test("常见美字进入字池，结果确定且按诗文出现次数稳定排序", () => {
  const first = nameWorthyChars();
  const second = nameWorthyChars();
  assert.deepEqual(second, first);
  const chars = new Set(first.map(({ char }) => char));
  for (const char of [..."明清春泽宁安"]) {
    assert.equal(chars.has(char), true, char);
  }
  const frequencies = counts();
  for (let index = 1; index < first.length; index += 1) {
    const previous = first[index - 1]!;
    const current = first[index]!;
    const previousCount = frequencies.get(previous.char) ?? 0;
    const currentCount = frequencies.get(current.char) ?? 0;
    assert.ok(previousCount > currentCount
      || (previousCount === currentCount
        && previous.char.codePointAt(0)! < current.char.codePointAt(0)!));
  }
});

test("宜入名字池筛选保持原有排序", () => {
  const all = nameWorthyChars();
  const water = nameWorthyChars((info) => info.wuxing === "水");
  assert.ok(water.length > 0);
  assert.ok(water.every((info) => info.wuxing === "水"));
  assert.deepEqual(water, all.filter((info) => info.wuxing === "水"));
});

test("字池与候选诗句共用消极字过滤：泪、别、断、难、战等不入字池", async () => {
  const { nameWorthyChars } = await import("../src/sanyi/naming/pool.js");
  const { isNegativeChar } = await import("../src/sanyi/naming/classics.js");
  const chars = new Set(nameWorthyChars().map((info) => info.char));
  for (const char of ["泪", "别", "断", "难", "战", "孤", "愁"]) {
    assert.equal(chars.has(char), false, char);
  }
  assert.equal(isNegativeChar("泪"), true);
  assert.equal(isNegativeChar("烽"), true);
  assert.equal(isNegativeChar("清"), false);
});
