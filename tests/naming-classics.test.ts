import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASSIC_LINES,
  lineById,
  pickCandidates,
} from "../src/sanyi/naming/classics.js";
import { charInfo, isNameChar } from "../src/sanyi/naming/lexicon.js";

const NEGATIVE = /[死亡病泣哀悲愁怨恨哭泪别孤寂苦凄惨伤恸残断衰枯憔悴叹忧惆怅萧啼寡鳏丧殇坟墓骨血兵戈杀]/u;
const EXPECTED_BOOK_COUNTS: Readonly<Record<string, number>> = {
  诗经: 14,
  楚辞: 12,
  唐诗三百首: 10,
  宋词三百首: 10,
  周易: 7,
  论语: 7,
};

test("诗文语料恰含五书与《周易》，关键原句和题名可检索", () => {
  assert.deepEqual(
    [...new Set(CLASSIC_LINES.map((line) => line.book))].sort(),
    ["诗经", "楚辞", "论语", "周易", "唐诗三百首", "宋词三百首"].sort(),
  );
  assert.ok(CLASSIC_LINES.some((line) => line.book === "诗经"
    && line.title === "周南·关雎" && line.text === "关关雎鸠，在河之洲"));
  assert.ok(CLASSIC_LINES.some((line) => line.book === "唐诗三百首"
    && line.text === "西陆蝉声唱，南冠客思侵"));
  assert.ok(CLASSIC_LINES.some((line) => line.book === "周易"
    && line.title === "乾·大象" && line.text === "天行健，君子以自强不息"));
  assert.ok(CLASSIC_LINES.some((line) => line.book === "周易"
    && line.title === "乾·初九" && line.text === "潜龙勿用"));
});

test("句子编号唯一、可回查且格式稳定", () => {
  const ids = CLASSIC_LINES.map((line) => line.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^(sj|cc|ly|zy|ts|sc)-\d{4}-\d{2,}$/u.test(id)));
  for (const line of CLASSIC_LINES.slice(0, 20)) {
    assert.deepEqual(lineById(line.id), line);
  }
  assert.equal(lineById("missing-0000-00"), undefined);
});

test("全部题名与正文不含日文中点或日文假名", () => {
  const japanese = /[・･\u3040-\u30ff]/u;
  for (const line of CLASSIC_LINES) {
    assert.doesNotMatch(line.title, japanese, `${line.id} 题名残留日文字符`);
    assert.doesNotMatch(line.text, japanese, `${line.id} 正文残留日文字符`);
  }
});

test("候选抽取确定、合规、覆盖多书并优先含期望字", () => {
  const options = { seed: "abc", length: 2 as const, count: 60, prefer: ["清"] };
  const first = pickCandidates(options);
  const second = pickCandidates(options);
  assert.deepEqual(second, first);
  assert.equal(first.length, 60);
  const bookCounts = Object.fromEntries(Object.keys(EXPECTED_BOOK_COUNTS).map((book) => [
    book,
    first.filter((line) => line.book === book).length,
  ]));
  assert.deepEqual(bookCounts, EXPECTED_BOOK_COUNTS);
  assert.ok((bookCounts["诗经"] ?? 0) + (bookCounts["楚辞"] ?? 0) >= 20);
  assert.ok(first.filter((line) => line.text.includes("清")).length >= 5);

  for (const line of first) {
    assert.ok([...line.text].length >= 4 && [...line.text].length <= 24);
    assert.doesNotMatch(line.text, NEGATIVE);
    assert.ok([...line.text].filter((char) => isNameChar(char)).length >= 2);
    assert.ok([...line.text].every((char) => !charInfoBlocked(char)));
  }
});

function charInfoBlocked(char: string): boolean {
  return charInfo(char)?.blocked === true;
}
