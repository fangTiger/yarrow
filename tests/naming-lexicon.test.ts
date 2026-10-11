import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LEXICON_SIZE,
  charInfo,
  isNameChar,
  isSurname,
  nameChars,
} from "../src/sanyi/naming/lexicon.js";

type RawRow = readonly [string, number, string, string, string, number, number, number,
  string, string, string, number, string[], boolean];
const raw = JSON.parse(readFileSync(
  new URL("../src/sanyi/naming/lexicon.json", import.meta.url),
  "utf8",
)) as Record<string, RawRow | string[]>;
const rawRows = Object.entries(raw).filter(([char]) => char !== "_fields") as [string, RawRow][];
const COMMON_NAME_CHARS = [..."安宁乐欣悦嘉佳瑞涵浩清泽江海林森松柏桐柳梅兰芳若明阳星月云雨雪山峰玉思慧文雅诗书言诚信仁义礼智勇康健"];

test("字库收齐通用规范汉字，并按表中序号分级", () => {
  assert.equal(LEXICON_SIZE, 8105);
  assert.equal(rawRows.filter(([, row]) => row[7] === 1).length, 3500);
  assert.equal(rawRows.filter(([, row]) => row[7] === 2).length, 3000);
  assert.equal(rawRows.filter(([, row]) => row[7] === 3).length, 1605);
});

test("样例字的读音、笔画、繁体与五行可核验", () => {
  assert.deepEqual(charInfo("泽"), {
    char: "泽",
    pinyin: "zé",
    tone: 2,
    initial: "z",
    final: "e",
    trad: "澤",
    kangxi: 17,
    strokes: 8,
    level: 1,
    wuxing: "水",
    wuxingBasis: "部首·水",
    meaning: charInfo("泽")?.meaning,
    blocked: false,
    readings: ["zé"],
    polyphonic: false,
  });

  assert.equal(charInfo("瑾")?.kangxi, 16);
  assert.equal(charInfo("瑾")?.wuxing, "金");
  assert.equal(charInfo("瑾")?.wuxingBasis, "部首·玉");
  assert.equal(charInfo("涵")?.kangxi, 12);
  assert.equal(charInfo("涵")?.wuxing, "水");
  assert.equal(charInfo("林")?.kangxi, 8);
  assert.equal(charInfo("林")?.wuxing, "木");
  assert.equal(charInfo("明")?.kangxi, 8);
  assert.equal(charInfo("明")?.wuxing, "火");
  assert.equal(charInfo("明")?.wuxingBasis, "部首·日");
  assert.equal(charInfo("安")?.wuxing, "土");
  assert.equal(charInfo("安")?.wuxingBasis, "读音·喉音");
  assert.equal(charInfo("思")?.wuxing, "金");
  assert.equal(charInfo("思")?.wuxingBasis, "读音·齿音");
  assert.equal(charInfo("雨")?.wuxing, "水");
  assert.equal(charInfo("雨")?.wuxingBasis, "部首·雨");
  assert.equal(charInfo("峰")?.wuxing, "土");
  assert.equal(charInfo("峰")?.wuxingBasis, "部首·山");
  assert.equal(charInfo("鑫")?.wuxing, "金");
  assert.equal(charInfo("王")?.kangxi, 4);
});

test("现代字典多音字保留带调读音，同音节异调不误标", () => {
  for (const char of [..."乐长朝行重和露曾单解"]) {
    assert.equal(charInfo(char)?.polyphonic, true, `${char} 应标为多音字`);
  }
  assert.deepEqual(charInfo("乐")?.readings, ["lè", "yuè"]);
  assert.deepEqual(charInfo("长")?.readings, ["cháng", "zhǎng"]);
  assert.deepEqual(charInfo("朝")?.readings, ["cháo", "zhāo"]);
  for (const char of [..."宁暖泽涵"]) {
    assert.equal(charInfo(char)?.polyphonic, false, `${char} 不应误标为多音字`);
  }
  assert.deepEqual(charInfo("宁")?.readings, ["níng"]);
  assert.deepEqual(charInfo("暖")?.readings, ["nuǎn"]);
});

test("不宜入名字会被拦截，姓氏只接受一至两个字表内汉字", () => {
  assert.equal(charInfo("死")?.blocked, true);
  assert.equal(isNameChar("死"), false);
  for (const char of [..."离别寡散逝泪殇凄"]) {
    assert.equal(isNameChar(char), false, `${char} 不应进入名字`);
  }
  assert.equal(isNameChar("泽"), true);
  assert.equal(isSurname("欧阳"), true);
  assert.equal(isSurname("张"), true);
  assert.equal(isSurname("萧"), true);
  assert.equal(isSurname("Ab"), false);
  assert.equal(isSurname("张王李"), false);
});

test("释义优先取 more 的现代义项，不粘着例词残片", () => {
  assert.match(charInfo("涵")?.meaning ?? "", /浸润|包含/u);
  assert.match(charInfo("宇")?.meaning ?? "", /房屋/u);
  assert.match(charInfo("乐")?.meaning ?? "", /喜悦/u);
  assert.match(charInfo("怡")?.meaning ?? "", /和悦/u);
  assert.match(charInfo("晨")?.meaning ?? "", /^清晨/u);
  assert.match(charInfo("诗")?.meaning ?? "", /诗歌/u);
  assert.doesNotMatch(charInfo("轩")?.meaning ?? "", /又如/u);
  assert.doesNotMatch(charInfo("思")?.meaning ?? "", /悲伤/u);
  assert.match(charInfo("欣")?.meaning ?? "", /喜/u);

  for (const char of [..."涵宇乐王峰安雅"]) {
    const meaning = charInfo(char)?.meaning ?? "";
    assert.ok(meaning.length > 0, `${char} 应有释义`);
    assert.equal(meaning.endsWith(char), false, `${char} 的释义粘着了例词残片`);
    assert.doesNotMatch(meaning, /请包|察纳/u);
  }
});

test("五十个一级常用起名字的释义没有本字或占位符尾巴", () => {
  assert.equal(COMMON_NAME_CHARS.length, 50);
  for (const char of COMMON_NAME_CHARS) {
    const info = charInfo(char);
    assert.equal(info?.level, 1, `${char} 应为一级字`);
    assert.ok(info?.meaning, `${char} 应有释义`);
    assert.equal(info?.meaning.endsWith(char), false, `${char} 的释义不应以本字结尾`);
    assert.doesNotMatch(info?.meaning ?? "", /～$/u, `${char} 的释义不应以占位符结尾`);
    assert.doesNotMatch(info?.meaning ?? "", /--|《|又如/u, `${char} 的释义不应含引文或例词`);
  }
});

test("至少八成半字有简短、清理过的释义", () => {
  const chars = rawRows.map(([char]) => charInfo(char)!);
  const nonEmpty = chars.filter((info) => info.meaning.length > 0);
  assert.ok(nonEmpty.length / chars.length >= 0.85);
  for (const info of chars) {
    assert.ok([...info.meaning].length <= 24, `${info.char} 的释义超过 24 字`);
    assert.doesNotMatch(info.meaning, /～/u, `${info.char} 的释义残留例字占位符`);
    assert.doesNotMatch(info.meaning, /--|《|又如/u, `${info.char} 的释义含引文或例词`);
  }
  assert.ok(nameChars().every((info) => !info.blocked));
});
