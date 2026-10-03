// src/calendar/qimen.ts
import lunarPkg from "lunar-javascript";
import { almanacAt } from "./almanac.js";

type Palace =
  | "坎一" | "坤二" | "震三" | "巽四" | "中五"
  | "乾六" | "兑七" | "艮八" | "离九";
type RingPalace = Exclude<Palace, "中五">;
type Dun = "阳" | "阴";
interface Cell {
  heavenStem?: string;
  earthStem: string;
  star?: string;
  door?: string;
  god?: string;
}
export interface QimenResult {
  localTime: string;
  method: "时家转盘拆补法";
  dayPillar: string;
  hourPillar: string;
  solarTerm: string;
  layout: string;
  xunHead: string;
  chiefStem: string;
  chiefStar: string;
  chiefStarPalace: Palace;
  chiefDoor: string;
  chiefDoorPalace: Palace;
  dayVoid: string;
  hourVoid: string;
  horse: string;
  palaces: Record<Palace, Cell>;
}

const PALACES: readonly Palace[] = [
  "坎一", "坤二", "震三", "巽四", "中五", "乾六", "兑七", "艮八", "离九",
];
const RING: readonly RingPalace[] = [
  "坎一", "艮八", "震三", "巽四", "离九", "坤二", "兑七", "乾六",
];
const STEMS = ["戊", "己", "庚", "辛", "壬", "癸", "丁", "丙", "乙"] as const;
const ORIGINAL_STAR: Record<Palace, string> = {
  坎一: "天蓬", 坤二: "天芮", 震三: "天冲", 巽四: "天辅", 中五: "天禽",
  乾六: "天心", 兑七: "天柱", 艮八: "天任", 离九: "天英",
};
const ORIGINAL_DOOR: Record<RingPalace, string> = {
  坎一: "休门", 艮八: "生门", 震三: "伤门", 巽四: "杜门",
  离九: "景门", 坤二: "死门", 兑七: "惊门", 乾六: "开门",
};
const GODS = {
  阳: ["值符", "腾蛇", "太阴", "六合", "勾陈", "朱雀", "九地", "九天"],
  阴: ["值符", "腾蛇", "太阴", "六合", "白虎", "玄武", "九地", "九天"],
} as const;
const XUN: Record<string, { head: string; stem: string; void: string }> = {
  甲子: { head: "甲子", stem: "戊", void: "戌亥" },
  甲戌: { head: "甲戌", stem: "己", void: "申酉" },
  甲申: { head: "甲申", stem: "庚", void: "午未" },
  甲午: { head: "甲午", stem: "辛", void: "辰巳" },
  甲辰: { head: "甲辰", stem: "壬", void: "寅卯" },
  甲寅: { head: "甲寅", stem: "癸", void: "子丑" },
};
const TERM_JU: Record<string, readonly [number, number, number]> = {
  冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6],
  立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
  春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8],
  立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
  夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4],
  立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6],
  秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2],
  立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1],
};
const STEM_INDEX: Record<string, number> = {
  甲: 0, 乙: 1, 丙: 2, 丁: 3, 戊: 4, 己: 5, 庚: 6, 辛: 7, 壬: 8, 癸: 9,
};
const BRANCH_INDEX: Record<string, number> = {
  子: 0, 丑: 1, 寅: 2, 卯: 3, 辰: 4, 巳: 5,
  午: 6, 未: 7, 申: 8, 酉: 9, 戌: 10, 亥: 11,
};
const mod = (n: number, m: number): number => ((n % m) + m) % m;
const palaceByNumber = (n: number): Palace => PALACES[n - 1]!;
const ringIndex = (p: Palace): number => RING.indexOf(p === "中五" ? "坤二" : p);

function cycleIndex(gz: string): number {
  for (let n = 0; n < 60; n += 1) {
    if (n % 10 === STEM_INDEX[gz[0]!] && n % 12 === BRANCH_INDEX[gz[1]!]) return n;
  }
  throw new Error(`无效干支：${gz}`);
}
function xunFor(gz: string) {
  const n = cycleIndex(gz);
  return XUN[["甲子", "甲戌", "甲申", "甲午", "甲辰", "甲寅"][Math.floor(n / 10)]!]!;
}
// 符头取当日或之前最近的甲／己日，并由符头地支决定上中下元。
function yuanFor(day: string): 0 | 1 | 2 {
  const index = cycleIndex(day);
  let distance = 0;
  while (distance < 5) {
    const stem = mod(index - distance, 10);
    if (stem === 0 || stem === 5) break;
    distance += 1;
  }
  const branch = mod(index - distance, 12);
  return [0, 6, 3, 9].includes(branch) ? 0 : [2, 8, 5, 11].includes(branch) ? 1 : 2;
}
function branchHorse(branch: string): string {
  const groups: Record<string, string> = {
    申子辰: "寅",
    寅午戌: "申",
    亥卯未: "巳",
    巳酉丑: "亥",
  };
  const group = Object.keys(groups).find((key) => key.includes(branch));
  if (!group) throw new Error(`地支 ${branch} 没有驿马组`);
  return groups[group]!;
}

export function qimenAt(timestamp: bigint): QimenResult {
  const almanac = almanacAt(timestamp);
  // 奇门按子时（23:00）换日取日柱与时柱，与 kinqimen 及传统口径一致。
  const [y, mo, d, h, mi, se] = almanac.solar.text
    .split(/[- :]/)
    .map(Number) as [number, number, number, number, number, number];
  const eight = lunarPkg.Solar.fromYmdHms(y, mo, d, h, mi, se).getLunar().getEightChar();
  eight.setSect(1);
  const day = eight.getDay();
  const hour = eight.getTime();
  // 节气交接采用 lunar-javascript 的精确时刻；冬至至芒种为阳遁，其余为阴遁。
  const term = almanac.solarTerms.current;
  const yangTerms = [
    "冬至", "小寒", "大寒", "立春", "雨水", "惊蛰",
    "春分", "清明", "谷雨", "立夏", "小满", "芒种",
  ];
  const dun: Dun = yangTerms.includes(term) ? "阳" : "阴";
  const yuan = yuanFor(day);
  const ju = TERM_JU[term]?.[yuan];
  if (!ju) throw new Error(`节气 ${term} 没有拆补局表`);
  // 阳遁从局数宫起顺排六仪三奇，阴遁逆排。
  const earth = {} as Record<Palace, string>;
  STEMS.forEach((stem, index) => {
    const number = mod(ju - 1 + (dun === "阳" ? index : -index), 9) + 1;
    earth[palaceByNumber(number)] = stem;
  });
  const hourXun = xunFor(hour);
  const chiefBase = Object.entries(earth).find(([, stem]) => stem === hourXun.stem)?.[0] as Palace;
  const hostedChiefBase: RingPalace = chiefBase === "中五" ? "坤二" : chiefBase;
  const chiefStar = chiefBase === "中五" ? "天禽" : ORIGINAL_STAR[hostedChiefBase];
  const chiefDoor = ORIGINAL_DOOR[hostedChiefBase];
  if (!chiefStar || !chiefDoor) throw new Error("值符值使起宫失败");
  // 值符星随时干落宫；时干为甲时随旬首六仪，中五寄坤二。
  const hourStem = hour[0] === "甲" ? hourXun.stem : hour[0]!;
  const rawStarTarget = Object.entries(earth).find(([, stem]) => stem === hourStem)?.[0] as Palace;
  const starTarget: RingPalace = rawStarTarget === "中五" ? "坤二" : rawStarTarget;
  const hourOffset = cycleIndex(hour) - cycleIndex(hourXun.head);
  // 值使门按九宫数字阳顺阴逆移动并经过中五，落中五时寄坤二。
  const baseNumber = PALACES.indexOf(chiefBase) + 1;
  const doorNumber = mod(baseNumber - 1 + (dun === "阳" ? hourOffset : -hourOffset), 9) + 1;
  const doorTarget: RingPalace = doorNumber === 5 ? "坤二" : palaceByNumber(doorNumber) as RingPalace;
  const reportedDoorTarget: Palace = palaceByNumber(doorNumber);
  const cells = {} as Record<Palace, Cell>;
  PALACES.forEach((palace) => {
    cells[palace] = { earthStem: earth[palace] };
  });
  // 天盘九星与所带地盘干按八宫环同步旋转；天禽随天芮寄坤。
  const starShift = ringIndex(starTarget) - ringIndex(hostedChiefBase);
  RING.forEach((source, index) => {
    const target = RING[mod(index + starShift, 8)]!;
    cells[target].star = ORIGINAL_STAR[source];
    cells[target].heavenStem = earth[source];
  });
  // 值符为天禽或值符落中五时，中五不留天盘干；否则中五天盘干等于地盘干。
  if (chiefBase !== "中五" && rawStarTarget !== "中五") {
    cells["中五"].heavenStem = earth["中五"];
  }
  const doorShift = ringIndex(doorTarget) - ringIndex(hostedChiefBase);
  RING.forEach((source, index) => {
    cells[RING[mod(index + doorShift, 8)]!].door = ORIGINAL_DOOR[source];
  });
  // 八神从值符落宫起，阳遁顺时针、阴遁逆时针排列。
  GODS[dun].forEach((god, index) => {
    cells[RING[mod(ringIndex(starTarget) + (dun === "阳" ? index : -index), 8)]!].god = god;
  });
  const [date, time] = almanac.solar.text.split(" ") as [string, string];
  const dayXun = xunFor(day);
  return {
    localTime: `${date} ${time}`,
    method: "时家转盘拆补法",
    dayPillar: day,
    hourPillar: hour,
    solarTerm: term,
    layout: `${dun}遁${"一二三四五六七八九"[ju - 1]}局${["上元", "中元", "下元"][yuan]}`,
    xunHead: hourXun.head,
    chiefStem: hourXun.stem,
    chiefStar,
    // 值符和值使报告原始落宫，排盘时中五寄坤二；
    // 界面显示「中五（寄坤二）」。
    chiefStarPalace: rawStarTarget,
    chiefDoor,
    chiefDoorPalace: reportedDoorTarget,
    dayVoid: dayXun.void,
    hourVoid: hourXun.void,
    horse: branchHorse(hour[1]!),
    palaces: cells,
  };
}
