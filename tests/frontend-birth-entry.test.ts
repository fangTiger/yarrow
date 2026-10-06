// tests/frontend-birth-entry.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BirthEntry } from "../web/components/BirthEntry.js";
import { isMissingBirth } from "../web/lib/birth-entry.js";
import { ApiError } from "../web/lib/api.js";
const noop = () => { };
test("命理运势缺档案入口展示表单且不挂载付款；400 同样补问", () => {
    let payments = 0;
    for (const kind of ["destiny", "fortune"]) {
        const html = renderToStaticMarkup(createElement(BirthEntry, { kind, birth: null, open: true, temporary: false, onOpen: noop, onBirth: noop, onFallback: noop, onCancel: noop, payment: () => { payments += 1; return "付款"; } }));
        assert.match(html, /填写生辰/);
        assert.match(html, /改为起一卦问事/);
    }
    assert.equal(payments, 0);
    const open = isMissingBirth(new ApiError("请先填写生辰", 400));
    const html = renderToStaticMarkup(createElement(BirthEntry, { kind: "fortune", birth: null, open, temporary: false, onOpen: noop, onBirth: noop, onFallback: noop, onCancel: noop, payment: () => "付款" }));
    assert.match(html, /role="dialog"/);
});
