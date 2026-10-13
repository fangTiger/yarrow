import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BirthFields } from "../web/components/BirthFields.js";
import { NamingFields } from "../web/components/NamingFields.js";
import { EMPTY_BIRTH, type BirthFormValues } from "../web/lib/birth-profile.js";
import {
  DEFAULT_NAMING_FORM, KIND_OPTIONS, applyClassification, autoHint, namingGate, namingRequest,
  type ClassificationView,
} from "../web/lib/home-entry.js";

const noop = () => {};
const filled: BirthFormValues = {
  ...EMPTY_BIRTH, year: "1990", month: "5", day: "15", time: "15:30", gender: "female",
};

test("首页开放第四个类型起名，并显示人名或商号的自动识别", () => {
  assert.deepEqual(KIND_OPTIONS.map(([, label]) => label), ["命理", "问事", "运势", "起名"]);
  const person: ClassificationView = {
    question: "给孩子起个名字", kind: "naming", supported: true, target: "person",
  };
  const business: ClassificationView = {
    question: "给咖啡馆起名", kind: "naming", supported: true, target: "business",
  };
  assert.equal(autoHint(applyClassification(DEFAULT_NAMING_FORM.entry, person)), "已自动识别为起名 · 人名");
  assert.equal(autoHint(applyClassification(DEFAULT_NAMING_FORM.entry, business)), "已自动识别为起名 · 商号");
});

test("人名表单含姓氏、名单长度、起名生辰", () => {
  const html = renderToStaticMarkup(createElement(NamingFields, {
    value: { ...DEFAULT_NAMING_FORM, birth: filled }, onChange: noop, birthProblem: null,
  }));
  assert.match(html, /aria-label="姓氏"/u);
  assert.match(html, />单名</u);
  assert.match(html, />双名</u);
  assert.match(html, /生辰/u);
  assert.match(html, /还没出生（按预产期）/u);
  assert.doesNotMatch(html, /五格|[぀-ヿ]|・/u);
});

test("商号表单含字号字数、店主生辰折叠与登记提示", () => {
  const html = renderToStaticMarkup(createElement(NamingFields, {
    value: { ...DEFAULT_NAMING_FORM, target: "business", length: 2 },
    onChange: noop, birthProblem: null,
  }));
  for (const length of [2, 3, 4]) assert.match(html, new RegExp(`>${length} 字<`, "u"));
  assert.match(html, /加上店主生辰（选填，用于五行补益）/u);
  assert.match(html, /字号请自行查询商标与工商登记是否可用/u);
  assert.doesNotMatch(html, /五格|[぀-ヿ]|・/u);
});

test("起名生辰支持预产期、不限性别，并保持默认生辰行不变", () => {
  const naming = renderToStaticMarkup(createElement(BirthFields, {
    mode: "naming", unborn: true, onUnbornChange: noop,
    values: { ...filled, time: "", gender: "any" }, problem: null, onChange: noop,
  }));
  assert.match(naming, /还没出生（按预产期）/u);
  assert.match(naming, /aria-label="预产期"/u);
  assert.match(naming, />不限</u);
  assert.doesNotMatch(naming, /type="time"/u);

  const regular = renderToStaticMarkup(createElement(BirthFields, {
    values: filled, problem: null, onChange: noop,
  }));
  assert.doesNotMatch(regular, /还没出生|>不限</u);
  assert.match(regular, /type="time"/u);
});

test("起名可用条件分别校验人名与商号", () => {
  const person = { ...DEFAULT_NAMING_FORM, surname: "张", birth: filled };
  assert.equal(namingGate({ questionLength: 0, value: person, birthProblem: null }).ready, true);
  assert.match(namingGate({ questionLength: 0, value: { ...person, surname: "A" }, birthProblem: null }).reason,
    /姓氏/u);
  assert.match(namingGate({ questionLength: 0, value: person, birthProblem: "请填写出生日期" }).reason,
    /生辰/u);
  const unborn = {
    ...person, unborn: true, birth: { ...filled, time: "", gender: "any" as const },
  };
  assert.equal(namingGate({ questionLength: 0, value: unborn, birthProblem: null }).ready, true);

  const business = { ...DEFAULT_NAMING_FORM, target: "business" as const, length: 2 as const };
  assert.match(namingGate({ questionLength: 1, value: business, birthProblem: null }).reason, /至少 2/u);
  assert.equal(namingGate({ questionLength: 2, value: business, birthProblem: null }).ready, true);
  assert.equal(namingGate({
    questionLength: 2,
    value: { ...business, ownerBirthEnabled: true, birth: filled },
    birthProblem: null,
  }).ready, true);
  assert.match(namingGate({
    questionLength: 2,
    value: { ...business, ownerBirthEnabled: true },
    birthProblem: "请填写出生日期",
  }).reason, /店主生辰/u);
});

test("起名付款请求体完整，且不限性别只在排盘生辰中映射为男", () => {
  const request = namingRequest("温和有书卷气", {
    ...DEFAULT_NAMING_FORM,
    surname: "欧阳",
    length: 2,
    unborn: true,
    birth: { ...filled, time: "", gender: "any" },
  });
  assert.equal(request.kind, "naming");
  assert.equal(request.target, "person");
  assert.equal(request.surname, "欧阳");
  assert.equal(request.gender, "any");
  assert.equal(request.length, 2);
  assert.equal(request.unborn, true);
  assert.equal(request.birth?.gender, "male");
  assert.equal(request.birth?.time, null);
});

test("起名使用独立生辰状态，不保存或带出本人生辰", () => {
  const source = readFileSync(new URL("../web/components/QuestionForm.tsx", import.meta.url), "utf8");
  assert.match(source, /namingValues/u);
  assert.match(source, /entry\.kind !== "naming"[\s\S]*saveBirthProfile/u);
  assert.equal((source.match(/saveBirthProfile\(/gu) ?? []).length, 1);
});
