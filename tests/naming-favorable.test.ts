import assert from "node:assert/strict";
import test from "node:test";
import {
  ELEMENT_VIRTUES,
  eightCharCounts,
  favorableFromTiaohou,
  industryElement,
  supplementElements,
  stemElement,
} from "../src/sanyi/naming/favorable.js";

test("八字五行按天干与地支本气计数，缺时柱则按六字计", () => {
  assert.deepEqual(eightCharCounts({
    year: "甲子", month: "丙午", day: "戊申", time: "辛酉",
  }), { 木: 1, 火: 2, 土: 1, 金: 3, 水: 1 });
  assert.deepEqual(eightCharCounts({
    year: "甲子", month: "丙午", day: "戊申", time: null,
  }), { 木: 1, 火: 2, 土: 1, 金: 1, 水: 1 });
});

test("补益五行有缺时缺的优先，调候补位并记录来源", () => {
  assert.deepEqual(supplementElements({
    counts: { 木: 2, 火: 2, 土: 1, 金: 0, 水: 1 }, tiaohou: ["甲", "丙"],
  }), {
    favorable: ["金", "木"], favorableSource: "missing", missing: ["金"],
    favorableNote: "八字缺金，宜补金；调候喜木，兼补木",
  });
  assert.deepEqual(supplementElements({
    counts: { 木: 0, 火: 2, 土: 2, 金: 0, 水: 2 }, tiaohou: ["庚"],
  }), {
    favorable: ["金", "木"], favorableSource: "missing", missing: ["木", "金"],
    favorableNote: "八字缺木、金，宜补木、金",
  });
  assert.deepEqual(supplementElements({
    counts: { 木: 0, 火: 2, 土: 0, 金: 0, 水: 2 }, tiaohou: ["辛", "甲"],
  }).favorable, ["木", "金"]);
});

test("五行俱全时按调候取前两个并生成说明", () => {
  assert.deepEqual(supplementElements({
    counts: { 木: 1, 火: 2, 土: 1, 金: 2, 水: 2 }, tiaohou: ["丙", "癸", "甲"],
  }), {
    favorable: ["火", "水"], favorableSource: "tiaohou", missing: [],
    favorableNote: "八字五行俱全，按调候取丙、癸，宜补火、水",
  });
});

test("五行寓意采用固定五常表", () => {
  assert.deepEqual(ELEMENT_VIRTUES, {
    木: "木主仁：仁爱上进、生机勃勃",
    火: "火主礼：热情有礼、开朗明快",
    土: "土主信：诚信稳重、宽厚包容",
    金: "金主义：果断重义、坚毅有守",
    水: "水主智：聪慧灵动、善思通达",
  });
});

test("天干换算五行，调候喜用去重保序且最多取两个", () => {
  assert.equal(stemElement("丙"), "火");
  assert.deepEqual(favorableFromTiaohou(["丙", "癸", "丙"]), ["火", "水"]);
  assert.deepEqual(favorableFromTiaohou(["甲", "乙", "丙", "庚"]), ["木", "火"]);
});

test("行业关键词按设计映射五行，查不到返回 null", () => {
  assert.deepEqual(industryElement("社区咖啡馆，想要温暖安静"), {
    element: "火",
    keyword: "咖啡",
  });
  assert.deepEqual(industryElement("做个软件工作室"), {
    element: "金",
    keyword: "软件",
  });
  assert.equal(industryElement("卖手工皂"), null);
});

test("行业关键词完整覆盖设计表，并优先匹配长词", () => {
  const cases = [
    ["餐饮", "火"], ["火锅", "火"], ["烧烤", "火"], ["咖啡", "火"],
    ["烘焙", "火"], ["灯具", "火"], ["能源", "火"], ["传媒", "火"],
    ["茶", "水"], ["饮品", "水"], ["酒", "水"], ["水产", "水"],
    ["物流", "水"], ["旅游", "水"], ["清洁", "水"],
    ["教育", "木"], ["书店", "木"], ["出版", "木"], ["文化", "木"],
    ["花艺", "木"], ["园林", "木"], ["家具", "木"], ["服装", "木"],
    ["中医药", "木"],
    ["金融", "金"], ["科技", "金"], ["软件", "金"], ["汽车", "金"],
    ["五金", "金"], ["珠宝", "金"], ["机械", "金"],
    ["地产", "土"], ["建筑", "土"], ["农业", "土"], ["陶瓷", "土"],
    ["仓储", "土"], ["家政", "土"], ["物业", "土"],
  ] as const;
  for (const [keyword, element] of cases) {
    assert.deepEqual(industryElement(`经营${keyword}相关业务`), { element, keyword }, keyword);
  }
  assert.deepEqual(industryElement("中医药文化馆"), { element: "木", keyword: "中医药" });
});

test("未知天干会明确报错", () => {
  assert.throws(() => stemElement("A"), /未知天干/);
});
