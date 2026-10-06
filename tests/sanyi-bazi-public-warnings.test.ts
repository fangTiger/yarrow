// tests/sanyi-bazi-public-warnings.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { derivedChart } from "../src/sanyi/bazi-public.js";
test("公开警示区分近似大运与出生当日交节，不泄露节气时刻", () => {
    const input = { corrected: { year: 1990, month: 5, day: 15, hour: 12, minute: 0, second: 0 }, gender: "male" as const, sect: 1 as const, timeKnown: false, targetYear: 2026 };
    const ordinary = derivedChart(buildBaziChart(input));
    assert.notEqual(ordinary.luck, null);
    assert.deepEqual(ordinary.warnings, ["时辰未知，缺时柱，起运按正午估算仅供参考"]);
    const jie = derivedChart(buildBaziChart({ ...input, corrected: { ...input.corrected, day: 6 } }));
    assert.equal(jie.luck, null);
    assert.deepEqual(jie.warnings, ["时辰未知且出生当日交节，年/月柱与大运需补时辰确认"]);
    assert.doesNotMatch([...ordinary.warnings, ...jie.warnings].join(""), /\d{1,2}:\d{2}|立夏/);
});
