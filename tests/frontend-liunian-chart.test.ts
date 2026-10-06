// tests/frontend-liunian-chart.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { CHART, chartGeometry, directLabels, tooltipLeft, xFor, yFor, yearGroups } from "../web/lib/liunian-chart.js";
const value = (year: number, average: number) => ({ year, average, min: average - 1, max: average + 1, count: 3 });
test("一至九成全域、范围线与年内交运位置", () => {
    assert.equal(yFor(1), CHART.bottom);
    assert.equal(yFor(9), CHART.top);
    assert.equal(yFor(5), (CHART.top + CHART.bottom) / 2);
    const geometry = chartGeometry([value(2024, 5)], ["2024-07-02"]);
    assert.equal(geometry.points[0]?.low, yFor(4));
    assert.equal(geometry.points[0]?.high, yFor(6));
    assert.equal(geometry.changes[0]?.x, xFor(0, 1));
    assert.equal(tooltipLeft(-100), CHART.left);
    assert.equal(tooltipLeft(2000), CHART.width - CHART.right - 180);
});
test("空合议断线，无人完成不画零点", () => {
    const geometry = chartGeometry([value(2023, 5), null, value(2025, 6)], [null, null, null]);
    assert.equal(geometry.points[1], null);
    assert.equal(geometry.paths.length, 2);
    assert.ok(geometry.paths.every((path) => !path.includes(" L")));
    assert.deepEqual(chartGeometry([null, null], [null, null]).paths, []);
});
test("少数标注与窄屏规则、回看今年展望分组", () => {
    const years = [value(2023, 4), value(2024, 6), value(2025, 5)];
    assert.deepEqual(directLabels(years, 2024, false), [["回看中最低"], ["今年", "十年最顺"], []]);
    assert.deepEqual(directLabels(years, 2024, true), [[], ["今年", "十年最顺"], []]);
    assert.deepEqual(yearGroups([2023, 2024, 2025, 2026], 2025), [{ label: "回看", count: 2 }, { label: "今年", count: 1 }, { label: "展望", count: 1 }]);
});
