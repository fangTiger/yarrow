// scripts/font-charset.ts
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ZHOUYI_CORPUS } from "../src/agent/zhouyi-corpus.js";
const EIGHT_GATES = "休生伤杜景死惊开";
const NINE_STARS = "天蓬天任天冲天辅天英天芮天柱天心天禽";
const EIGHT_SPIRITS = "值符腾蛇螣蛇太阴六合白虎玄武九地九天勾陈朱雀";
const SIX_SPIRITS = "青龙朱雀勾陈腾蛇白虎玄武";
const SIX_RELATIONS = "父母兄弟子孙妻财官鬼";
const STEMS_BRANCHES = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥";
const SHI_YING = "世应";
const FIXED_COPY = [
  "三易", "所问之事", "三家断语", "六爻排盘", "奇门时盘", "当日黄历", "卦历",
  "公历", "农历", "四柱", "节气", "月建日辰", "值日", "最近所问", "问卦",
  "程颐", "京房", "邵雍", "问",
  "问题与生辰", "三家用神对照", "流年运势", "大运", "合冲刑害", "五行分布",
  "胎元", "命宫", "身宫", "起运", "沈孝瞻", "余春台", "任铁樵",
  "想问什么？", "生辰",
  "白话总述", "解法", "看三家依据", "自动起卦", "起卦中", "排盘中", "三家落笔中（/）", "正在写白话总述",
  "0123456789",
] as const;
export function buildFontCharset(): string {
  const source = [
    ...ZHOUYI_CORPUS.map((item) => item.name),
    EIGHT_GATES,
    NINE_STARS,
    EIGHT_SPIRITS,
    SIX_SPIRITS,
    SIX_RELATIONS,
    STEMS_BRANCHES,
    SHI_YING,
    ...FIXED_COPY,
  ].join("");
  return [...new Set(source)].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join("");
}
export async function writeFontCharset(path = "web/fonts/mashanzheng-chars.txt"): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${buildFontCharset()}\n`, "utf8");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeFontCharset();
}
