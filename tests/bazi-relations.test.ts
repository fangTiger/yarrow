// tests/bazi-relations.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { analyzeBazi, findRelations, findShensha,
  type RelationNode } from "../src/calendar/bazi-relations.js";
const input = { corrected: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0 },
  gender: "male" as const, sect: 1 as const, timeKnown: true, targetYear: 2026 };
const chart = buildBaziChart(input);
function node(id: string, value: string, scope: RelationNode["scope"] = "natal"): RelationNode {
  return { id, label: id, value, type: "branch", scope };
}
const sorted = (values: string[]) => values.sort();
const key = (r: {
  label: string;
  nodeIds: string[];
}) => `${r.label}:${r.nodeIds.join(",")}`;
test("锚年原局与运年关系逐项锁定，原局三会不重复", () => {
  const r = analyzeBazi(chart).relations;
  assert.deepEqual(sorted(r.filter((v) => v.scope === "natal").map(key)), sorted([
    "午未合:natal.year.branch,natal.time.branch",
    "巳午未三会火:natal.month.branch,natal.year.branch,natal.time.branch",
  ]));
  assert.deepEqual(sorted(r.filter((v) => v.scope === "luck").map(key)), sorted([
    "甲庚冲:natal.year.stem,luck.stem", "甲庚冲:natal.day.stem,luck.stem",
    "巳申合:natal.month.branch,luck.branch", "巳申刑:natal.month.branch,luck.branch",
    "巳申破:natal.month.branch,luck.branch", "申辰拱水:natal.day.branch,luck.branch",
  ]));
});
const expected = [
  ["午卯破:year", "卯辰害:day", "卯未半合木:time"],
  ["甲庚冲:year", "甲庚冲:day", "辰辰自刑:day", "申辰拱水:luck"],
  ["乙庚合:year", "乙辛冲:month", "乙庚合:day", "巳申合:luck", "巳申刑:luck", "巳申破:luck"],
  ["丙辛合:month", "午午自刑:year", "午未合:time"],
  ["丁癸冲:time", "午未合:year"],
  ["戊癸合:time", "巳申合:month", "巳申刑:month", "巳申破:month", "申辰拱水:day"],
  ["巳酉半合金:month", "辰酉合:day", "酉酉自刑:luck"],
  ["乙庚合:luck", "午戌半合火:year", "辰戌冲:day", "戌未刑:time", "戌未破:time", "酉戌害:luck"],
  ["乙辛冲:luck", "巳亥冲:month", "亥未拱木:time"],
  ["子午冲:year", "子辰半合水:day", "子未害:time", "子酉破:luck"],
];
test("十年每年与原局及当年大运的关系使用集合比较", () => {
  analyzeBazi(chart).years.forEach((y, i) => {
    const actual = y.relations.filter((r) => r.scope === "year").map((r) => {
      const other = r.nodeIds[0]?.split(".");
      return `${r.label}:${other?.[0] === "luck" ? "luck" : other?.[1]}`;
    });
    assert.deepEqual(sorted(actual), sorted([...(expected[i] ?? [])]), String(y.year));
  });
});
test("半合、拱、三合、三会、自刑与缺时柱", () => {
  assert.equal(findRelations([node("a", "申"), node("b", "子")])[0]?.kind, "半合");
  assert.equal(findRelations([node("a", "申"), node("b", "辰")])[0]?.kind, "拱");
  const three = findRelations([node("a", "申"), node("b", "子"), node("c", "辰")]);
  assert.ok(three.some((r) => r.kind === "三合"));
  assert.ok(!three.some((r) => ["半合", "拱"].includes(r.kind)));
  assert.ok(findRelations([node("a", "寅"), node("b", "卯"), node("c", "辰")])
    .some((r) => r.kind === "三会"));
  assert.equal(findRelations([node("a", "辰")]).length, 0);
  assert.equal(findRelations([node("a", "辰"), node("b", "辰")])[0]?.kind, "自刑");
  const absent = analyzeBazi(buildBaziChart({ ...input, timeKnown: false }));
  assert.ok(absent.nodes.every((n) => !n.id.includes("natal.time")));
  assert.ok(absent.relations.every((r) => r.nodeIds.every((id) => !id.includes("natal.time"))));
});
test("独立两两表，固定种子抽样 200 组", () => {
  const tables = {
    stem: { 合: "甲己 乙庚 丙辛 丁壬 戊癸", 冲: "甲庚 乙辛 丙壬 丁癸" },
    branch: { 合: "子丑 寅亥 卯戌 辰酉 巳申 午未", 冲: "子午 丑未 寅申 卯酉 辰戌 巳亥",
      害: "子未 丑午 寅巳 卯辰 申亥 酉戌", 破: "子酉 午卯 巳申 寅亥 辰丑 戌未",
      刑: "寅巳 巳申 申寅 丑戌 戌未 未丑 子卯", 自刑: "辰辰 午午 酉酉 亥亥" },
  };
  let seed = 20261006;
  const rand = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let i = 0; i < 200; i++) {
    const type: RelationNode["type"] = i % 2 ? "stem" : "branch";
    const chars = type === "stem" ? "甲乙丙丁戊己庚辛壬癸" : "子丑寅卯辰巳午未申酉戌亥";
    const a = chars.charAt(rand(chars.length));
    const b = chars.charAt(rand(chars.length));
    const kinds = Object.entries(tables[type]).filter(([, pairs]) => pairs.split(" ")
      .some((p) => p === a + b || p === b + a)).map(([kind]) => kind);
    if (type === "branch" && a !== b) {
      for (const [group, center] of [["申子辰", "子"], ["亥卯未", "卯"],
        ["寅午戌", "午"], ["巳酉丑", "酉"]]) {
        if (group?.includes(a) && group.includes(b)) {
          kinds.push(a === center || b === center ? "半合" : "拱");
        }
      }
    }
    const nodes = [node("a", a), node("b", b)].map((n) => ({ ...n, type }));
    assert.deepEqual(sorted(findRelations(nodes).map((r) => r.kind)), sorted(kinds));
  }
});
test("七种神煞用独立表现场计算并锁定命例", () => {
  const out = analyzeBazi(chart);
  const byStem = {
    天乙贵人: ["丑未", "子申", "亥酉", "亥酉", "丑未", "子申", "丑未", "寅午", "巳卯", "巳卯"],
    文昌: ["巳", "午", "申", "酉", "申", "酉", "亥", "子", "寅", "卯"],
    禄神: ["寅", "卯", "巳", "午", "巳", "午", "申", "酉", "亥", "子"],
    羊刃: ["卯", "", "午", "", "午", "", "酉", "", "子", ""],
  };
  const groups = ["申子辰", "寅午戌", "巳酉丑", "亥卯未"];
  const byBranch = { 桃花: "酉卯午子", 驿马: "寅申亥巳", 华盖: "辰戌丑未" };
  for (const nodes of [out.nodes, ...out.years.map((y) => y.nodes)]) {
    const oracle: string[] = [];
    for (const [name, values] of Object.entries(byStem)) {
      for (const key of name === "天乙贵人" || name === "文昌" ? ["day", "year"] : ["day"]) {
        const stem = chart.pillars[key as "day" | "year"].stem;
        for (const n of nodes.filter((n) => n.type === "branch")) {
          if (values["甲乙丙丁戊己庚辛壬癸".indexOf(stem)]?.includes(n.value)) {
            oracle.push(`${name}:${n.id}:${key === "day" ? "日" : "年"}干${stem}`);
          }
        }
      }
    }
    for (const [name, values] of Object.entries(byBranch)) {
      for (const key of ["day", "year"] as const) {
        const branch = chart.pillars[key].branch;
        const target = values[groups.findIndex((g) => g.includes(branch))];
        for (const n of nodes.filter((n) => n.type === "branch" && n.value === target)) {
          oracle.push(`${name}:${n.id}:${key === "day" ? "日" : "年"}支${branch}`);
        }
      }
    }
    assert.deepEqual(sorted(findShensha(chart,
      nodes).map((v) => `${v.name}:${v.nodeId}:${v.basis}`)), sorted(oracle));
  }
  const has = (name: string, nodeId: string, basis: string) => out.shensha
    .some((v) => v.name === name && v.nodeId === nodeId && v.basis === basis);
  assert.ok(has("天乙贵人", "natal.time.branch", "日干庚"));
  assert.ok(has("华盖", "natal.day.branch", "日支辰"));
  assert.ok(has("禄神", "luck.branch", "日干庚"));
  assert.ok(has("驿马", "luck.branch", "年支午"));
  assert.ok(!out.shensha.some((v) => v.name === "羊刃" && v.nodeId.startsWith("natal")));
  assert.ok(out.years.find((v) => v.year === 2029)?.shensha.some((v) => v.name === "羊刃"));
  assert.ok(out.years.find((v) => v.year === 2027)?.shensha
    .some((v) => v.name === "羊刃" && v.nodeId === "luck.branch" && v.basis === "日干庚"));
  // 覆盖所有干支基准，包括阴干不标羊刃；期望由上述独立表计算。
  for (const stem of "甲乙丙丁戊己庚辛壬癸") {
    const changed = { ...chart, pillars: { ...chart.pillars,
        day: { ...chart.pillars.day, stem }, year: { ...chart.pillars.year, stem } } };
    const nodes = [..."子丑寅卯辰巳午未申酉戌亥"].map((b, i) => node(String(i), b));
    const actual = findShensha(changed, nodes);
    for (const [name, values] of Object.entries(byStem)) {
      const wanted = values["甲乙丙丁戊己庚辛壬癸".indexOf(stem)] ?? "";
      assert.deepEqual(sorted(actual.filter((v) => v.name === name && v.basis === `日干${stem}`)
        .map((v) => nodes.find((n) => n.id === v.nodeId)?.value ?? "")), sorted([...wanted]));
    }
  }
});
test("五行仅数原局，天干与三气从藏干现场重算", () => {
  for (const timeKnown of [true, false]) {
    const c = buildBaziChart({ ...input, timeKnown });
    const pillars = Object.values(c.pillars).filter((p) => p !== null);
    const elements = analyzeBazi(c).elements;
    const mapping = { 木: "甲乙", 火: "丙丁", 土: "戊己", 金: "庚辛", 水: "壬癸" };
    for (const e of elements) {
      const stems = mapping[e.element];
      assert.equal(e.stem, pillars.filter((p) => stems.includes(p.stem)).length);
      for (const qi of ["main", "middle", "residual"] as const) {
        assert.equal(e[qi], pillars.flatMap((p) => p.hidden)
          .filter((h) => h.qi === qi && stems.includes(h.stem)).length);
      }
      assert.equal(e.total, e.stem + e.main + e.middle + e.residual);
    }
    assert.equal(elements.reduce((n, e) => n + e.stem, 0), timeKnown ? 4 : 3);
    assert.equal(elements.reduce((n, e) => n + e.total, 0), pillars.length + pillars.reduce((n,
      p) => n + p.hidden.length, 0));
    if (timeKnown) {
      assert.equal(elements.reduce((n, e) => n + e.total, 0), 15);
    }
  }
});
test("原局半合不被跨范围三合吞掉，字序取表和局序", () => {
  const relations = findRelations([
    node("natal.month.branch", "子"), node("natal.day.branch", "辰"),
    node("year.branch", "申", "year"),
  ]);
  assert.ok(relations.some((r) => r.label === "申子辰三合水" && r.scope === "year"));
  assert.ok(relations.some((r) => r.label === "子辰半合水" && r.scope === "natal"));
  assert.equal(findRelations([node("a", "未"), node("b", "卯")])[0]?.label, "卯未半合木");
  assert.equal(findRelations([node("a", "午"), node("b", "午")])[0]?.label, "午午自刑");
});
