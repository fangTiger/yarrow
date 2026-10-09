import assert from "node:assert/strict";
import test from "node:test";
import {
  favorableFromTiaohou,
  industryElement,
  stemElement,
} from "../src/sanyi/naming/favorable.js";

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
