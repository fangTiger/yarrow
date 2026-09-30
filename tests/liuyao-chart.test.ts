import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface LiuyaoChartModule {
  FIVE_ELEMENT_GENERATES: Record<string, string>;
  FIVE_ELEMENT_OVERCOMES: Record<string, string>;
  describeElementRelation(palaceElement: string, lineElement: string): {
    interaction: string;
    relation: string;
    explanation: string;
  };
  deriveSolarMonth(timestamp: bigint): {
    timezone: "UTC+8";
    basis: "节气月";
    branch: string;
    element: string;
    range: string;
    boundaryUncertain: boolean;
  };
  deriveFiveHexagrams(lines: readonly number[]): {
    primary: { kingWenNumber: number; name: string; yangLines: readonly boolean[] };
    mutual: { kingWenNumber: number; name: string; yangLines: readonly boolean[] };
    derived: { kingWenNumber: number; name: string; yangLines: readonly boolean[] };
    opposite: { kingWenNumber: number; name: string; yangLines: readonly boolean[] };
    reversed: { kingWenNumber: number; name: string; yangLines: readonly boolean[] };
  };
  deriveSexagenaryDay(timestamp: bigint): {
    timezone: "UTC+8";
    dayBoundary: "00:00";
    localDate: string;
    ganzhi: string;
    stem: string;
    branch: string;
    cycleIndex: number;
    voidBranches: readonly string[];
  };
  buildLiuyaoChart(input: {
    lines: readonly number[];
    timestamp: bigint;
    focus?: { subjectKey: string; subjectLabel: string; useGod: string; overridden: boolean };
  }): {
    school: string;
    day: { ganzhi: string; voidBranches: readonly string[] };
    month: { branch: string; element: string; range: string };
    palace: { name: string; element: string; sequence: string };
    trigrams: {
      upper: { name: string; element: string };
      lower: { name: string; element: string };
    };
    shiPosition: number;
    yingPosition: number;
    nature: { primary: string | null; derived: string | null };
    focus: null | {
      subjectLabel: string;
      useGod: string;
      useGodPositions: readonly number[];
      hiddenUseGodPositions: readonly number[];
      originalGod: string;
      tabooGod: string;
      enemyGod: string;
    };
    rows: ReadonlyArray<{
      position: number;
      positionSymbol: string;
      sixSpirit: string;
      marker: "世" | "应" | null;
      primary: {
        stemBranch: string;
        branch: string;
        element: string;
        relation: string;
        isVoid: boolean;
        strength: string;
        isMonthBroken: boolean;
      };
      changed: { stemBranch: string; element: string; relation: string; isVoid: boolean; strength: string; isMonthBroken: boolean };
      isDayBroken: boolean;
      isHiddenMoving: boolean;
      advanceRetreat: "进神" | "退神" | null;
      returnEffect: "回头生" | "回头克" | null;
      hidden: null | { stemBranch: string; element: string; relation: string };
    }>;
  };
}

async function loadChartModule(): Promise<LiuyaoChartModule> {
  try {
    return await import("../src/oracle/liuyao-chart.js") as LiuyaoChartModule;
  } catch {
    assert.fail("六爻装卦规则模块尚未实现");
  }
}

test("五卦全部从同一组六爻按指定爻位确定性推算", async () => {
  const { deriveFiveHexagrams } = await loadChartModule();
  const five = deriveFiveHexagrams([7, 8, 8, 8, 7, 8]); // 水雷屯，无动爻

  assert.deepEqual(
    Object.fromEntries(Object.entries(five).map(([key, value]) => [key, [value.kingWenNumber, value.name]])),
    {
      primary: [3, "水雷屯"],
      mutual: [23, "山地剥"],
      derived: [3, "水雷屯"],
      opposite: [50, "火风鼎"],
      reversed: [4, "山水蒙"],
    },
  );
  assert.deepEqual(five.mutual.yangLines, [false, false, false, false, false, true]);
});

test("五行相生与相克全表固定且闭合", async () => {
  const { FIVE_ELEMENT_GENERATES, FIVE_ELEMENT_OVERCOMES } = await loadChartModule();
  assert.deepEqual(FIVE_ELEMENT_GENERATES, { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" });
  assert.deepEqual(FIVE_ELEMENT_OVERCOMES, { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" });
  assert.deepEqual(Object.keys(FIVE_ELEMENT_GENERATES).sort(), ["木", "水", "火", "土", "金"].sort());
  assert.deepEqual(Object.keys(FIVE_ELEMENT_OVERCOMES).sort(), ["木", "水", "火", "土", "金"].sort());
});

test("排盘模块可直接进入浏览器包，不依赖 Node Buffer", async () => {
  const source = await readFile("src/oracle/liuyao-chart.ts", "utf8");
  assert.doesNotMatch(source, /\bBuffer\b/);
});

test("卦宫五行为我时五种关系准确推出六亲", async () => {
  const { describeElementRelation } = await loadChartModule();
  assert.deepEqual(describeElementRelation("土", "土"), {
    interaction: "同我",
    relation: "兄弟",
    explanation: "土与土同气——同我者为兄弟",
  });
  assert.equal(describeElementRelation("土", "火").relation, "父母", "火生土，生我者为父母");
  assert.equal(describeElementRelation("土", "金").relation, "子孙", "土生金，我生者为子孙");
  assert.deepEqual(describeElementRelation("土", "木"), {
    interaction: "克我",
    relation: "官鬼",
    explanation: "木克土——克我者为官鬼",
  });
  assert.equal(describeElementRelation("土", "水").relation, "妻财", "土克水，我克者为妻财");
});

test("本卦上下经卦五行随排盘一并返回", async () => {
  const { buildLiuyaoChart } = await loadChartModule();
  const chart = buildLiuyaoChart({ lines: [7, 8, 8, 8, 7, 8], timestamp: 1_725_520_000n });
  assert.deepEqual(chart.trigrams, {
    upper: { name: "坎", element: "水" },
    lower: { name: "震", element: "木" },
  });
});

test("变卦只翻转老阴六与老阳九，错卦全反，综卦反转爻序", async () => {
  const { deriveFiveHexagrams } = await loadChartModule();
  const five = deriveFiveHexagrams([9, 8, 7, 6, 7, 8]);

  assert.deepEqual(five.primary.yangLines, [true, false, true, false, true, false]);
  assert.deepEqual(five.derived.yangLines, [false, false, true, true, true, false]);
  assert.deepEqual(five.opposite.yangLines, [false, true, false, true, false, true]);
  assert.deepEqual(five.reversed.yangLines, [false, true, false, true, false, true]);
});

test("区块时间戳按 UTC+8 民用零点换日并可复算日干支与旬空", async () => {
  const { deriveSexagenaryDay } = await loadChartModule();
  const jiazi = deriveSexagenaryDay(BigInt(Date.parse("2000-01-07T04:00:00Z") / 1_000));
  const renshen = deriveSexagenaryDay(1_725_520_000n);

  assert.deepEqual(jiazi, {
    timezone: "UTC+8",
    dayBoundary: "00:00",
    localDate: "2000-01-07",
    ganzhi: "甲子",
    stem: "甲",
    branch: "子",
    cycleIndex: 0,
    voidBranches: ["戌", "亥"],
  });
  assert.deepEqual(renshen, {
    timezone: "UTC+8",
    dayBoundary: "00:00",
    localDate: "2024-09-05",
    ganzhi: "壬申",
    stem: "壬",
    branch: "申",
    cycleIndex: 8,
    voidBranches: ["戌", "亥"],
  });
});

const KNOWN_CASES = [
  {
    name: "乾为天",
    lines: [7, 7, 7, 7, 7, 7],
    palace: ["乾", "金", "本宫"],
    shiYing: [6, 3],
    najia: ["甲子", "甲寅", "甲辰", "壬午", "壬申", "壬戌"],
    relations: ["子孙", "妻财", "父母", "官鬼", "兄弟", "父母"],
  },
  {
    name: "坤为地",
    lines: [8, 8, 8, 8, 8, 8],
    palace: ["坤", "土", "本宫"],
    shiYing: [6, 3],
    najia: ["乙未", "乙巳", "乙卯", "癸丑", "癸亥", "癸酉"],
    relations: ["兄弟", "父母", "官鬼", "兄弟", "妻财", "子孙"],
  },
  {
    name: "水雷屯",
    lines: [7, 8, 8, 8, 7, 8],
    palace: ["坎", "水", "二世"],
    shiYing: [2, 5],
    najia: ["庚子", "庚寅", "庚辰", "戊申", "戊戌", "戊子"],
    relations: ["兄弟", "子孙", "官鬼", "父母", "官鬼", "兄弟"],
  },
  {
    name: "火天大有",
    lines: [7, 7, 7, 7, 8, 7],
    palace: ["乾", "金", "归魂"],
    shiYing: [3, 6],
    najia: ["甲子", "甲寅", "甲辰", "己酉", "己未", "己巳"],
    relations: ["子孙", "妻财", "父母", "兄弟", "父母", "官鬼"],
  },
] as const;

for (const known of KNOWN_CASES) {
  test(`${known.name} 的卦宫、世应、纳甲与六亲符合已知卦例`, async () => {
    const { buildLiuyaoChart } = await loadChartModule();
    const chart = buildLiuyaoChart({ lines: known.lines, timestamp: 1_725_520_000n });

    assert.deepEqual([chart.palace.name, chart.palace.element, chart.palace.sequence], known.palace);
    assert.deepEqual([chart.shiPosition, chart.yingPosition], known.shiYing);
    assert.deepEqual(chart.rows.map((row) => row.primary.stemBranch), known.najia);
    assert.deepEqual(chart.rows.map((row) => row.primary.relation), known.relations);
    assert.equal(chart.rows[chart.shiPosition - 1]?.marker, "世");
    assert.equal(chart.rows[chart.yingPosition - 1]?.marker, "应");
  });
}

test("伏神只为本卦缺失六亲从本宫首卦同爻位补出", async () => {
  const { buildLiuyaoChart } = await loadChartModule();
  const gou = buildLiuyaoChart({ lines: [8, 7, 7, 7, 7, 7], timestamp: 1_725_520_000n });
  const dun = buildLiuyaoChart({ lines: [8, 8, 7, 7, 7, 7], timestamp: 1_725_520_000n });

  assert.deepEqual(gou.rows.map((row) => row.hidden), [
    null,
    { stemBranch: "甲寅", element: "木", relation: "妻财", isVoid: false },
    null,
    null,
    null,
    null,
  ]);
  assert.deepEqual(dun.rows.map((row) => row.hidden), [
    { stemBranch: "甲子", element: "水", relation: "子孙", isVoid: false },
    { stemBranch: "甲寅", element: "木", relation: "妻财", isVoid: false },
    null,
    null,
    null,
    null,
  ]);
});

test("六神按日干从初爻顺排，旬空同时标记本卦与变卦地支", async () => {
  const { buildLiuyaoChart } = await loadChartModule();
  const chart = buildLiuyaoChart({ lines: [7, 7, 7, 7, 7, 7], timestamp: 1_725_520_000n }); // 壬申日

  assert.match(chart.school, /京房纳甲.*八宫世应.*六甲旬空/);
  assert.equal(chart.day.ganzhi, "壬申");
  assert.deepEqual(chart.day.voidBranches, ["戌", "亥"]);
  assert.deepEqual(chart.rows.map((row) => row.sixSpirit), ["玄武", "青龙", "朱雀", "勾陈", "螣蛇", "白虎"]);
  assert.equal(chart.rows[5]?.primary.isVoid, true, "乾卦上爻壬戌在壬申日应标旬空");
  assert.equal(chart.rows[0]?.primary.isVoid, false);
});

test("区块时间按节气月换算月建，并依《三命通会》五级表逐爻标旺衰", async () => {
  const { buildLiuyaoChart, deriveSolarMonth } = await loadChartModule();
  const timestamp = 1_725_520_000n; // 2024-09-05，白露之前
  const month = deriveSolarMonth(timestamp);
  assert.deepEqual(
    [month.timezone, month.basis, month.branch, month.element, month.range, month.boundaryUncertain],
    ["UTC+8", "节气月", "申", "金", "立秋—白露", false],
  );

  const qian = buildLiuyaoChart({ lines: [7, 7, 7, 7, 7, 7], timestamp });
  assert.deepEqual(qian.rows.map((row) => row.primary.strength), ["相", "死", "休", "囚", "旺", "休"]);
  assert.equal(qian.rows[1]?.primary.isMonthBroken, true, "申月冲寅，二爻甲寅应为月破");
  assert.equal(qian.rows[1]?.isDayBroken, true, "壬申日冲休囚静爻寅木，应为日破");
  assert.equal(qian.rows[1]?.isHiddenMoving, false);
});

test("日辰冲旺相静爻为暗动，不与休囚日破混写", async () => {
  const { buildLiuyaoChart } = await loadChartModule();
  const jimao = BigInt(Date.parse("2024-09-12T04:00:00Z") / 1_000);
  const dui = buildLiuyaoChart({ lines: [7, 7, 8, 7, 7, 8], timestamp: jimao });
  assert.equal(dui.day.ganzhi, "己卯");
  assert.equal(dui.month.branch, "酉");
  assert.equal(dui.rows[4]?.primary.branch, "酉");
  assert.equal(dui.rows[4]?.primary.strength, "旺");
  assert.equal(dui.rows[4]?.isHiddenMoving, true);
  assert.equal(dui.rows[4]?.isDayBroken, false);
});

test("动爻按《增删卜易》固定表标进退神，并比较同位变爻回头生克", async () => {
  const { buildLiuyaoChart } = await loadChartModule();
  const timestamp = 1_725_520_000n;
  const tunToJie = buildLiuyaoChart({ lines: [7, 6, 8, 8, 7, 8], timestamp });
  assert.deepEqual(
    [tunToJie.rows[1]?.primary.branch, tunToJie.rows[1]?.changed.stemBranch, tunToJie.rows[1]?.advanceRetreat],
    ["寅", "丁卯", "进神"],
  );

  const duiToFeng = buildLiuyaoChart({ lines: [7, 7, 8, 7, 9, 8], timestamp });
  assert.deepEqual(
    [duiToFeng.rows[4]?.primary.branch, duiToFeng.rows[4]?.changed.stemBranch, duiToFeng.rows[4]?.advanceRetreat],
    ["酉", "庚申", "退神"],
  );

  const huanToKan = buildLiuyaoChart({ lines: [8, 7, 8, 8, 7, 9], timestamp });
  assert.equal(huanToKan.rows[5]?.returnEffect, "回头生");
  const kunToJin = buildLiuyaoChart({ lines: [8, 8, 8, 6, 8, 6], timestamp });
  assert.equal(kunToJin.rows[5]?.returnEffect, "回头克");
});

test("六冲六合、用神四神与爻位象征都返回本卦实际位置", async () => {
  const { buildLiuyaoChart } = await loadChartModule();
  const timestamp = 1_725_520_000n;
  const qian = buildLiuyaoChart({ lines: [7, 7, 7, 7, 7, 7], timestamp });
  const pi = buildLiuyaoChart({ lines: [8, 8, 8, 7, 7, 7], timestamp });
  assert.equal(qian.nature.primary, "六冲");
  assert.equal(pi.nature.primary, "六合");

  const zhongfu = buildLiuyaoChart({
    lines: [7, 7, 8, 8, 7, 7],
    timestamp,
    focus: { subjectKey: "career", subjectLabel: "工作／官职", useGod: "官鬼", overridden: false },
  });
  assert.deepEqual(
    [zhongfu.palace.name, zhongfu.palace.sequence, zhongfu.shiPosition, zhongfu.yingPosition],
    ["艮", "游魂", 4, 1],
  );
  assert.deepEqual(zhongfu.rows.map((row) => row.positionSymbol), [
    "足／基层", "腹／家宅", "股／门户", "胸／门外", "君位", "首／宗庙",
  ]);
  assert.equal(zhongfu.focus?.subjectLabel, "工作／官职");
  assert.equal(zhongfu.focus?.useGod, "官鬼");
  assert.ok((zhongfu.focus?.useGodPositions.length ?? 0) + (zhongfu.focus?.hiddenUseGodPositions.length ?? 0) > 0);
  assert.deepEqual(
    [zhongfu.focus?.originalGod, zhongfu.focus?.tabooGod, zhongfu.focus?.enemyGod],
    ["妻财", "子孙", "兄弟"],
  );
});
