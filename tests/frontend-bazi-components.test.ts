// tests/frontend-bazi-components.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sampleBazi } from "./helpers/sample-bazi.js";
import { baziFixture, birth as rawBirth, proof } from "./helpers/bazi-service.js";
import { publicBaziReading } from "../src/sanyi/bazi-public.js";
import { BaziLuck } from "../web/components/BaziLuck.js";
import { BaziTable } from "../web/components/BaziTable.js";
import { BaziReading } from "../web/pages/BaziReading.js";
import { LiuNianPanel } from "../web/components/LiuNianPanel.js";
import { DayBoundaryChange } from "../web/components/DayBoundaryChange.js";
import { BAZI_KEYS } from "../web/lib/liunian-chart.js";
const birth = { ...rawBirth, calendar: "solar" as const, gender: "male" as const };
const noop = () => { };
test("缺时柱四柱表显示缺", () => {
    const input = sampleBazi("fortune", false);
    const table = renderToStaticMarkup(createElement(BaziTable, { chart: input.chart, analysis: requireAnalysis(input.chart) }));
    assert.match(table, /时柱/);
    assert.match(table, /<td>缺<\/td>/);
});
import { analyzeBazi as requireAnalysis } from "../src/calendar/bazi-relations.js";
test("命理无流年合议，分享不显示原始时刻，无档案切换禁用", async () => {
    const f = await baziFixture();
    try {
        const value = await f.bazi.create({ kind: "destiny", question: "我适合做什么", birth, sect: 1, horizon: "year", feeProof: proof() });
        await f.bazi.whenSettled(value.id);
        const reading = publicBaziReading(await f.bazi.getReading(value.id));
        const html = renderToStaticMarkup(createElement(BaziReading, { reading, birth: null, onReading: noop }));
        assert.doesNotMatch(html, /流年运势|合议：|15:30|14:30/);
        assert.match(html, /校正摘要/);
        const local = renderToStaticMarkup(createElement(BaziReading, { reading, birth, onReading: noop }));
        assert.match(local, /15:30/);
        assert.match(local, /14:30/);
        const change = renderToStaticMarkup(createElement(DayBoundaryChange, { reading, birth: null, onReading: noop }));
        assert.match(change, /disabled=""/);
        assert.match(change, /需在填写生辰的设备上切换/);
    }
    finally {
        await f.close();
    }
});
test("流年一家失败不展示，全失败合议破折号且无折线", async () => {
    const f = await baziFixture();
    try {
        const value = await f.bazi.create({ kind: "fortune", question: "今年运势如何", birth, sect: 1, horizon: "year", feeProof: proof() });
        await f.bazi.whenSettled(value.id);
        const stored = await f.bazi.getReading(value.id);
        stored.schools.yuchuntai.status = "failed";
        let reading = publicBaziReading(stored);
        assert.equal(reading.kind, "fortune");
        if (reading.kind !== "fortune") {
            throw new Error("类型错误");
        }
        let html = renderToStaticMarkup(createElement(LiuNianPanel, { reading, currentYear: 2026 }));
        // 模型调用失败的一家显示「未落笔」；落了笔但删错留对后缺某年的显示「未给出」。
        assert.match(html, /未落笔/);
        assert.doesNotMatch(html, /未展示/);
        const gap = await f.bazi.getReading(value.id);
        const shen = gap.schools.shenxiaozhan.output;
        if (shen && "years" in shen) {
            gap.schools.shenxiaozhan.output = { ...shen, years: shen.years.filter((item) => item.year !== 2029) };
        }
        const gapReading = publicBaziReading(gap);
        if (gapReading.kind === "fortune") {
            assert.match(renderToStaticMarkup(createElement(LiuNianPanel, { reading: gapReading, currentYear: 2026 })),
                /未给出/);
        }
        assert.match(html, /虚岁/);
        assert.match(html, /回看/);
        assert.match(html, /甲申→乙酉/);
        assert.ok(!html.includes("[object Object]"));
        for (const key of BAZI_KEYS) {
            stored.schools[key].status = "failed";
        }
        reading = publicBaziReading(stored);
        if (reading.kind !== "fortune") {
            throw new Error("类型错误");
        }
        html = renderToStaticMarkup(createElement(LiuNianPanel, { reading, currentYear: 2026 }));
        assert.match(html, /<td[^>]*>—<\/td>/);
        assert.doesNotMatch(html, /class="ln-line"/);
    }
    finally {
        await f.close();
    }
});
test("起运前不高亮第一步，交运当天切换当前大运", () => {
    const chart = sampleBazi().chart;
    const before = renderToStaticMarkup(createElement(BaziLuck, { chart, currentYear: 1997, currentDate: "1997-08-03" }));
    assert.doesNotMatch(before, /class="now luck-current"/);
    assert.match(before, /当前起运前/);
    const after = renderToStaticMarkup(createElement(BaziLuck, { chart, currentYear: 1997, currentDate: "1997-08-04" }));
    assert.match(after, /class="now luck-current"/);
});
