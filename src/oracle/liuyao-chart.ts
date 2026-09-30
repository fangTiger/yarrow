import { getHexagramText } from "../agent/zhouyi-corpus.js";

export type FiveElement = "木" | "火" | "土" | "金" | "水";
export type SixRelation = "父母" | "子孙" | "官鬼" | "妻财" | "兄弟";
export type PalaceName = "乾" | "坎" | "艮" | "震" | "巽" | "离" | "坤" | "兑";
export type HexagramKind = "primary" | "mutual" | "derived" | "opposite" | "reversed";
export type StrengthState = "旺" | "相" | "休" | "囚" | "死";
export type HexagramNature = "六冲" | "六合" | null;

export interface HexagramFigure {
  kind: HexagramKind;
  label: "本卦" | "互卦" | "变卦" | "错卦" | "综卦";
  meaning: string;
  kingWenNumber: number;
  name: string;
  derivation: string;
  judgement: string;
  /** 自初爻至上爻，true 为阳。 */
  yangLines: readonly boolean[];
}

export interface FiveHexagrams {
  primary: HexagramFigure;
  mutual: HexagramFigure;
  derived: HexagramFigure;
  opposite: HexagramFigure;
  reversed: HexagramFigure;
}

export interface SexagenaryDay {
  timezone: "UTC+8";
  dayBoundary: "00:00";
  localDate: string;
  ganzhi: string;
  stem: string;
  branch: string;
  cycleIndex: number;
  voidBranches: readonly string[];
}

export interface SolarMonth {
  timezone: "UTC+8";
  basis: "节气月";
  branch: string;
  element: FiveElement;
  range: string;
  /** 节气交界附近不强行给出确定断语，交由界面提示用户。 */
  boundaryUncertain: boolean;
}

export interface NajiaValue {
  stemBranch: string;
  branch: string;
  element: FiveElement;
  relation: SixRelation;
  isVoid: boolean;
  strength: StrengthState;
  isMonthBroken: boolean;
}

export interface HiddenSpirit {
  stemBranch: string;
  element: FiveElement;
  relation: SixRelation;
  isVoid: boolean;
}

export interface LiuyaoChartRow {
  position: number;
  positionSymbol: string;
  value: number;
  primaryYang: boolean;
  changedYang: boolean;
  changing: boolean;
  sixSpirit: string;
  marker: "世" | "应" | null;
  primary: NajiaValue;
  changed: NajiaValue;
  hidden: HiddenSpirit | null;
  isDayBroken: boolean;
  isHiddenMoving: boolean;
  advanceRetreat: "进神" | "退神" | null;
  returnEffect: "回头生" | "回头克" | null;
}

export interface LiuyaoFocus {
  subjectKey: string;
  subjectLabel: string;
  useGod: SixRelation;
  overridden: boolean;
  useGodPositions: readonly number[];
  hiddenUseGodPositions: readonly number[];
  originalGod: SixRelation;
  tabooGod: SixRelation;
  enemyGod: SixRelation;
}

export interface LiuyaoChart {
  school: string;
  dateRule: string;
  day: SexagenaryDay;
  month: SolarMonth;
  palace: { name: PalaceName; element: FiveElement; sequence: string };
  trigrams: {
    upper: { name: PalaceName; element: FiveElement };
    lower: { name: PalaceName; element: FiveElement };
  };
  shiPosition: number;
  yingPosition: number;
  nature: { primary: HexagramNature; derived: HexagramNature };
  focus: LiuyaoFocus | null;
  rows: readonly LiuyaoChartRow[];
}

/**
 * 对照出处：
 * 1. 《周易集解纂疏·诸家说易凡例》“纳十二支”“六亲”：
 *    https://ancient-china-books.github.io/zhouyijijiezhuanshu/OEBPS/Text/4157.html
 * 2. 《增删卜易》八宫、六神、飞伏神、旬空诸章（公共领域古籍整理本）：
 *    https://data.guoxueruanjian.com/books/增删卜易（校对：中国男儿）.pdf
 * 3. 周易文库《京房纳甲全文研读》八宫纳甲全表，用于逐项机器校对：
 *    https://fatetree.cn/yijing-jingfang-najia.html
 * 4. Y. T. Liu《Sexagenary Cycle》式 (1)–(3)，日干支与儒略日的模运算：
 *    https://ytliu0.github.io/ChineseCalendar/sexagenary.html
 * 5. 《三命通会·卷二》“论五行旺相休囚死”的逐季五级表：
 *    https://zh.wikisource.org/wiki/三命通會/卷二
 * 6. NOAA Solar Calculator（依据 Meeus）太阳视黄经算法；节气月边界据黄经分段：
 *    https://gml.noaa.gov/grad/solcalc/calcdetails.html
 * 7. Y. T. Liu《Sexagenary Cycle》System 2 的十二个节气月边界：
 *    https://ytliu0.github.io/ChineseCalendar/sexagenary.html#jian
 *
 * 口径说明：《增删卜易》“四时旺相章”明列旺、相、余气，其余合称休囚；
 * 本模块需要五级显示，故不冒充该书原表，明确采用《三命通会》的旺相休囚死表。
 */
export const LIUYAO_CHART_SOURCES = {
  najia: "https://ancient-china-books.github.io/zhouyijijiezhuanshu/OEBPS/Text/4157.html",
  zengshan: "https://data.guoxueruanjian.com/books/增删卜易（校对：中国男儿）.pdf",
  table: "https://fatetree.cn/yijing-jingfang-najia.html",
  sexagenaryDay: "https://ytliu0.github.io/ChineseCalendar/sexagenary.html",
  solarMonth: "https://ytliu0.github.io/ChineseCalendar/sexagenary.html#jian",
  solarLongitude: "https://gml.noaa.gov/grad/solcalc/calcdetails.html",
  strength: "https://zh.wikisource.org/wiki/三命通會/卷二",
} as const;

// 索引位从初爻至上爻，1 为阳、0 为阴；值为文王卦序。
const KING_WEN_HEX = "021807130f242e0b103328363e37202208031d3c273f30052d112f3a1f311c2b171b04293416121a23154026381e320e142a3b3d352539090c19060a210d2c01";
const KING_WEN = Uint8Array.from(
  { length: KING_WEN_HEX.length / 2 },
  (_, index) => Number.parseInt(KING_WEN_HEX.slice(index * 2, index * 2 + 2), 16),
);

const PALACES: ReadonlyArray<{
  name: PalaceName;
  element: FiveElement;
  kingWenNumbers: readonly number[];
}> = [
  { name: "乾", element: "金", kingWenNumbers: [1, 44, 33, 12, 20, 23, 35, 14] },
  { name: "坎", element: "水", kingWenNumbers: [29, 60, 3, 63, 49, 55, 36, 7] },
  { name: "艮", element: "土", kingWenNumbers: [52, 22, 26, 41, 38, 10, 61, 53] },
  { name: "震", element: "木", kingWenNumbers: [51, 16, 40, 32, 46, 48, 28, 17] },
  { name: "巽", element: "木", kingWenNumbers: [57, 9, 37, 42, 25, 21, 27, 18] },
  { name: "离", element: "火", kingWenNumbers: [30, 56, 50, 64, 4, 59, 6, 13] },
  { name: "坤", element: "土", kingWenNumbers: [2, 24, 19, 11, 34, 43, 5, 8] },
  { name: "兑", element: "金", kingWenNumbers: [58, 47, 45, 31, 39, 15, 62, 54] },
] as const;

const PALACE_SEQUENCES = ["本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂"] as const;
const SHI_POSITIONS = [6, 1, 2, 3, 4, 5, 4, 3] as const;
const YING_POSITIONS = [3, 4, 5, 6, 1, 2, 1, 6] as const;

const TRIGRAM_BY_INDEX: readonly PalaceName[] = ["坤", "震", "坎", "兑", "艮", "离", "巽", "乾"];

// 京房纳甲：每个数组均按该经卦在内/外卦时，自下而上列三爻。
const NAJIA: Record<PalaceName, { inner: readonly string[]; outer: readonly string[] }> = {
  乾: { inner: ["甲子", "甲寅", "甲辰"], outer: ["壬午", "壬申", "壬戌"] },
  坤: { inner: ["乙未", "乙巳", "乙卯"], outer: ["癸丑", "癸亥", "癸酉"] },
  震: { inner: ["庚子", "庚寅", "庚辰"], outer: ["庚午", "庚申", "庚戌"] },
  巽: { inner: ["辛丑", "辛亥", "辛酉"], outer: ["辛未", "辛巳", "辛卯"] },
  坎: { inner: ["戊寅", "戊辰", "戊午"], outer: ["戊申", "戊戌", "戊子"] },
  离: { inner: ["己卯", "己丑", "己亥"], outer: ["己酉", "己未", "己巳"] },
  艮: { inner: ["丙辰", "丙午", "丙申"], outer: ["丙戌", "丙子", "丙寅"] },
  兑: { inner: ["丁巳", "丁卯", "丁丑"], outer: ["丁亥", "丁酉", "丁未"] },
};

const BRANCH_ELEMENTS: Record<string, FiveElement> = {
  子: "水", 亥: "水",
  寅: "木", 卯: "木",
  巳: "火", 午: "火",
  申: "金", 酉: "金",
  辰: "土", 戌: "土", 丑: "土", 未: "土",
};

export const FIVE_ELEMENT_GENERATES: Record<FiveElement, FiveElement> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
export const FIVE_ELEMENT_OVERCOMES: Record<FiveElement, FiveElement> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
const SIX_SPIRITS = ["青龙", "朱雀", "勾陈", "螣蛇", "白虎", "玄武"] as const;
const SPIRIT_START_BY_STEM: Record<string, number> = {
  甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5,
};

const POSITION_SYMBOLS = ["足／基层", "腹／家宅", "股／门户", "胸／门外", "君位", "首／宗庙"] as const;
const BRANCH_OPPOSITES: Record<string, string> = {
  子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅",
  卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳",
};
const ADVANCE_PAIRS = new Set(["亥子", "寅卯", "巳午", "申酉", "丑辰", "辰未", "未戌", "戌丑"]);
const RETREAT_PAIRS = new Set(["子亥", "卯寅", "午巳", "酉申", "辰丑", "未辰", "戌未", "丑戌"]);
const SIX_CLASH_HEXAGRAMS = new Set([1, 2, 29, 30, 51, 52, 57, 58, 25, 34]);
const SIX_HARMONY_HEXAGRAMS = new Set([12, 11, 16, 24, 60, 47, 22, 56]);

const SOLAR_MONTHS: ReadonlyArray<{ branch: string; element: FiveElement; range: string }> = [
  { branch: "寅", element: "木", range: "立春—惊蛰" },
  { branch: "卯", element: "木", range: "惊蛰—清明" },
  { branch: "辰", element: "土", range: "清明—立夏" },
  { branch: "巳", element: "火", range: "立夏—芒种" },
  { branch: "午", element: "火", range: "芒种—小暑" },
  { branch: "未", element: "土", range: "小暑—立秋" },
  { branch: "申", element: "金", range: "立秋—白露" },
  { branch: "酉", element: "金", range: "白露—寒露" },
  { branch: "戌", element: "土", range: "寒露—立冬" },
  { branch: "亥", element: "水", range: "立冬—大雪" },
  { branch: "子", element: "水", range: "大雪—小寒" },
  { branch: "丑", element: "土", range: "小寒—立春" },
] as const;

function modulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function validateLines(lines: readonly number[]): void {
  if (lines.length !== 6 || lines.some((line) => ![6, 7, 8, 9].includes(line))) {
    throw new Error("六爻必须恰为六个 6/7/8/9 数值");
  }
}

function kingWenNumber(yangLines: readonly boolean[]): number {
  const index = yangLines.reduce((value, yang, position) => value | (yang ? 1 << position : 0), 0);
  const number = KING_WEN[index];
  if (!number) throw new Error(`卦象位索引 ${index} 没有文王卦序`);
  return number;
}

function yangLinesFromKingWen(number: number): readonly boolean[] {
  const index = KING_WEN.indexOf(number);
  if (index < 0) throw new Error(`文王卦序 ${number} 没有阴阳位映射`);
  return Array.from({ length: 6 }, (_, position) => (index & (1 << position)) !== 0);
}

function figure(
  kind: HexagramKind,
  label: HexagramFigure["label"],
  meaning: string,
  derivation: string,
  yangLines: readonly boolean[],
): HexagramFigure {
  const number = kingWenNumber(yangLines);
  const text = getHexagramText(number);
  return { kind, label, meaning, kingWenNumber: number, name: text.name, derivation, judgement: text.judgement, yangLines };
}

export function deriveFiveHexagrams(lines: readonly number[]): FiveHexagrams {
  validateLines(lines);
  const primary = lines.map((line) => line === 7 || line === 9);
  const derived = lines.map((line, position) => line === 6 || line === 9 ? !primary[position] : primary[position]) as boolean[];
  const mutual = [primary[1], primary[2], primary[3], primary[2], primary[3], primary[4]] as boolean[];
  const opposite = primary.map((yang) => !yang);
  const reversed = [...primary].reverse();
  return {
    primary: figure("primary", "本卦", "现状・初始", "原始六爻直接成卦。", primary),
    mutual: figure("mutual", "互卦", "症结所在", "上卦取本卦五、四、三爻；下卦取四、三、二爻。", mutual),
    derived: figure("derived", "变卦", "最终结果", "仅将老阴六、老阳九的阴阳反转。", derived),
    opposite: figure("opposite", "错卦", "反面的可能", "本卦六爻的阴阳全部反转。", opposite),
    reversed: figure("reversed", "综卦", "对方立场", "整卦上下颠倒，即六爻次序反转。", reversed),
  };
}

/**
 * UTC+8 民用日界实现。以 2000-01-07 甲子日作等价锚点；这与来源所列
 * S = 1 + mod(JD_noon - 11, 60) 相同，但避免浮点儒略日参与运行时计算。
 */
export function deriveSexagenaryDay(timestamp: bigint): SexagenaryDay {
  if (timestamp < 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("区块时间戳必须是可安全换算的非负整数秒");
  const localDayIndex = Math.floor((Number(timestamp) + 8 * 3_600) / 86_400);
  const referenceDayIndex = Math.floor(Date.UTC(2000, 0, 7) / 86_400_000);
  const cycleIndex = modulo(localDayIndex - referenceDayIndex, 60);
  const stem = STEMS[cycleIndex % 10]!;
  const branch = BRANCHES[cycleIndex % 12]!;
  const decadeStart = Math.floor(cycleIndex / 10) * 10;
  const decadeBranch = decadeStart % 12;
  const voidBranches = [BRANCHES[(decadeBranch + 10) % 12]!, BRANCHES[(decadeBranch + 11) % 12]!];
  const localDate = new Date(localDayIndex * 86_400_000).toISOString().slice(0, 10);
  return {
    timezone: "UTC+8",
    dayBoundary: "00:00",
    localDate,
    ganzhi: `${stem}${branch}`,
    stem,
    branch,
    cycleIndex,
    voidBranches,
  };
}

/**
 * 用 NOAA/Meeus 的太阳视黄经近似式划分十二个节气月。算法适用范围按
 * NOAA 说明收窄至 1901—2099；距离交界黄经小于 0.02° 时标记不确定。
 */
export function deriveSolarMonth(timestamp: bigint): SolarMonth {
  if (timestamp < 0n || timestamp > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("区块时间戳必须是可安全换算的非负整数秒");
  const seconds = Number(timestamp);
  const localYear = new Date((seconds + 8 * 3_600) * 1_000).getUTCFullYear();
  if (localYear < 1901 || localYear > 2099) throw new Error("节气月换算仅支持 1901—2099 年");

  const julianDay = seconds / 86_400 + 2_440_587.5;
  const centuries = (julianDay - 2_451_545) / 36_525;
  const meanLongitude = modulo(280.46646 + centuries * (36_000.76983 + centuries * 0.0003032), 360);
  const meanAnomaly = 357.52911 + centuries * (35_999.05029 - 0.0001537 * centuries);
  const radians = Math.PI / 180;
  const equationOfCenter = Math.sin(meanAnomaly * radians) * (1.914602 - centuries * (0.004817 + 0.000014 * centuries))
    + Math.sin(2 * meanAnomaly * radians) * (0.019993 - 0.000101 * centuries)
    + Math.sin(3 * meanAnomaly * radians) * 0.000289;
  const apparentLongitude = modulo(
    meanLongitude + equationOfCenter - 0.00569
      - 0.00478 * Math.sin((125.04 - 1934.136 * centuries) * radians),
    360,
  );
  const shifted = modulo(apparentLongitude - 315, 360);
  const index = Math.floor(shifted / 30);
  const remainder = shifted % 30;
  const month = SOLAR_MONTHS[index]!;
  return {
    timezone: "UTC+8",
    basis: "节气月",
    branch: month.branch,
    element: month.element,
    range: month.range,
    boundaryUncertain: Math.min(remainder, 30 - remainder) < 0.02,
  };
}

function trigramName(lines: readonly boolean[]): PalaceName {
  const index = lines.reduce((value, yang, position) => value | (yang ? 1 << position : 0), 0);
  return TRIGRAM_BY_INDEX[index]!;
}

export type ElementInteraction = "同我" | "生我" | "我生" | "克我" | "我克";

export function describeElementRelation(
  palaceElement: FiveElement,
  lineElement: FiveElement,
): { interaction: ElementInteraction; relation: SixRelation; explanation: string } {
  if (palaceElement === lineElement) return {
    interaction: "同我",
    relation: "兄弟",
    explanation: `${lineElement}与${palaceElement}同气——同我者为兄弟`,
  };
  if (FIVE_ELEMENT_GENERATES[lineElement] === palaceElement) return {
    interaction: "生我",
    relation: "父母",
    explanation: `${lineElement}生${palaceElement}——生我者为父母`,
  };
  if (FIVE_ELEMENT_GENERATES[palaceElement] === lineElement) return {
    interaction: "我生",
    relation: "子孙",
    explanation: `${palaceElement}生${lineElement}——我生者为子孙`,
  };
  if (FIVE_ELEMENT_OVERCOMES[lineElement] === palaceElement) return {
    interaction: "克我",
    relation: "官鬼",
    explanation: `${lineElement}克${palaceElement}——克我者为官鬼`,
  };
  if (FIVE_ELEMENT_OVERCOMES[palaceElement] === lineElement) return {
    interaction: "我克",
    relation: "妻财",
    explanation: `${palaceElement}克${lineElement}——我克者为妻财`,
  };
  throw new Error(`无法判断 ${palaceElement} 与 ${lineElement} 的六亲关系`);
}

function relationFor(palaceElement: FiveElement, lineElement: FiveElement): SixRelation {
  return describeElementRelation(palaceElement, lineElement).relation;
}

function rawNajia(yangLines: readonly boolean[]): readonly string[] {
  const lower = trigramName(yangLines.slice(0, 3));
  const upper = trigramName(yangLines.slice(3, 6));
  return [...NAJIA[lower].inner, ...NAJIA[upper].outer];
}

function palaceFor(number: number): { name: PalaceName; element: FiveElement; sequence: string; index: number } {
  for (const palace of PALACES) {
    const index = palace.kingWenNumbers.indexOf(number);
    if (index >= 0) return { name: palace.name, element: palace.element, sequence: PALACE_SEQUENCES[index]!, index };
  }
  throw new Error(`文王第 ${number} 卦不在八宫表中`);
}

function strengthFor(monthElement: FiveElement, lineElement: FiveElement): StrengthState {
  if (monthElement === lineElement) return "旺";
  if (FIVE_ELEMENT_GENERATES[monthElement] === lineElement) return "相";
  if (FIVE_ELEMENT_GENERATES[lineElement] === monthElement) return "休";
  if (FIVE_ELEMENT_OVERCOMES[lineElement] === monthElement) return "囚";
  return "死";
}

function decorateNajia(
  stemBranch: string,
  palaceElement: FiveElement,
  voidBranches: readonly string[],
  month: SolarMonth,
): NajiaValue {
  const branch = stemBranch.slice(1);
  const element = BRANCH_ELEMENTS[branch];
  if (!element) throw new Error(`纳甲地支 ${branch} 没有五行映射`);
  return {
    stemBranch,
    branch,
    element,
    relation: relationFor(palaceElement, element),
    isVoid: voidBranches.includes(branch),
    strength: strengthFor(month.element, element),
    isMonthBroken: BRANCH_OPPOSITES[month.branch] === branch,
  };
}

function natureFor(number: number): HexagramNature {
  if (SIX_CLASH_HEXAGRAMS.has(number)) return "六冲";
  if (SIX_HARMONY_HEXAGRAMS.has(number)) return "六合";
  return null;
}

function focusFor(
  input: { subjectKey: string; subjectLabel: string; useGod: string; overridden: boolean } | undefined,
  palaceElement: FiveElement,
  rows: readonly LiuyaoChartRow[],
): LiuyaoFocus | null {
  if (!input) return null;
  const relations: readonly SixRelation[] = ["父母", "子孙", "官鬼", "妻财", "兄弟"];
  if (!relations.includes(input.useGod as SixRelation)) throw new Error(`用神 ${input.useGod} 不在五类六亲中`);
  const useGod = input.useGod as SixRelation;
  const elements: readonly FiveElement[] = ["木", "火", "土", "金", "水"];
  const useElement = elements.find((element) => relationFor(palaceElement, element) === useGod)!;
  const originalElement = elements.find((element) => FIVE_ELEMENT_GENERATES[element] === useElement)!;
  const tabooElement = elements.find((element) => FIVE_ELEMENT_OVERCOMES[element] === useElement)!;
  const enemyElement = elements.find((element) => FIVE_ELEMENT_GENERATES[element] === tabooElement)!;
  return {
    ...input,
    useGod,
    useGodPositions: rows.filter((row) => row.primary.relation === useGod).map((row) => row.position),
    hiddenUseGodPositions: rows.filter((row) => row.hidden?.relation === useGod).map((row) => row.position),
    originalGod: relationFor(palaceElement, originalElement),
    tabooGod: relationFor(palaceElement, tabooElement),
    enemyGod: relationFor(palaceElement, enemyElement),
  };
}

export function buildLiuyaoChart(input: {
  lines: readonly number[];
  timestamp: bigint;
  focus?: { subjectKey: string; subjectLabel: string; useGod: string; overridden: boolean };
}): LiuyaoChart {
  validateLines(input.lines);
  const five = deriveFiveHexagrams(input.lines);
  const palace = palaceFor(five.primary.kingWenNumber);
  const lowerTrigram = trigramName(five.primary.yangLines.slice(0, 3));
  const upperTrigram = trigramName(five.primary.yangLines.slice(3, 6));
  const day = deriveSexagenaryDay(input.timestamp);
  const month = deriveSolarMonth(input.timestamp);
  const primaryNajia = rawNajia(five.primary.yangLines).map((item) => decorateNajia(item, palace.element, day.voidBranches, month));
  const changedNajia = rawNajia(five.derived.yangLines).map((item) => decorateNajia(item, palace.element, day.voidBranches, month));
  const visibleRelations = new Set(primaryNajia.map((item) => item.relation));
  const palaceRootNumber = PALACES.find((item) => item.name === palace.name)!.kingWenNumbers[0]!;
  const palaceRootNajia = rawNajia(yangLinesFromKingWen(palaceRootNumber)).map((item) => decorateNajia(item, palace.element, [], month));
  const spiritStart = SPIRIT_START_BY_STEM[day.stem];
  if (spiritStart === undefined) throw new Error(`日干 ${day.stem} 没有六神起法`);
  const shiPosition = SHI_POSITIONS[palace.index]!;
  const yingPosition = YING_POSITIONS[palace.index]!;

  const rows = input.lines.map((value, index): LiuyaoChartRow => {
    const position = index + 1;
    const primaryYang = five.primary.yangLines[index]!;
    const changing = value === 6 || value === 9;
    const hiddenSource = palaceRootNajia[index]!;
    const primary = primaryNajia[index]!;
    const changed = changedNajia[index]!;
    const dayClash = BRANCH_OPPOSITES[day.branch] === primary.branch;
    const strong = primary.strength === "旺" || primary.strength === "相";
    const branchChange = `${primary.branch}${changed.branch}`;
    return {
      position,
      positionSymbol: POSITION_SYMBOLS[index]!,
      value,
      primaryYang,
      changedYang: five.derived.yangLines[index]!,
      changing,
      sixSpirit: SIX_SPIRITS[(spiritStart + index) % SIX_SPIRITS.length]!,
      marker: position === shiPosition ? "世" : position === yingPosition ? "应" : null,
      primary,
      changed,
      hidden: visibleRelations.has(hiddenSource.relation) ? null : {
        stemBranch: hiddenSource.stemBranch,
        element: hiddenSource.element,
        relation: hiddenSource.relation,
        isVoid: day.voidBranches.includes(hiddenSource.branch),
      },
      isDayBroken: !changing && dayClash && !strong,
      isHiddenMoving: !changing && dayClash && strong,
      advanceRetreat: !changing ? null : ADVANCE_PAIRS.has(branchChange) ? "进神" : RETREAT_PAIRS.has(branchChange) ? "退神" : null,
      returnEffect: !changing ? null : FIVE_ELEMENT_GENERATES[changed.element] === primary.element
        ? "回头生"
        : FIVE_ELEMENT_OVERCOMES[changed.element] === primary.element ? "回头克" : null,
    };
  });

  return {
    school: "京房纳甲・八宫世应・六甲旬空・节气月；旺相休囚死依《三命通会》五级表",
    dateRule: "区块时间戳按 UTC+8 民用日期、00:00 换日；月建按太阳视黄经节气月（不采用子初换日）",
    day,
    month,
    palace: { name: palace.name, element: palace.element, sequence: palace.sequence },
    trigrams: {
      upper: { name: upperTrigram, element: PALACES.find((item) => item.name === upperTrigram)!.element },
      lower: { name: lowerTrigram, element: PALACES.find((item) => item.name === lowerTrigram)!.element },
    },
    shiPosition,
    yingPosition,
    nature: { primary: natureFor(five.primary.kingWenNumber), derived: natureFor(five.derived.kingWenNumber) },
    focus: focusFor(input.focus, palace.element, rows),
    rows,
  };
}
