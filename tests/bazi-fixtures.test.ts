// tests/bazi-fixtures.test.ts
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { buildBaziChart } from "../src/calendar/bazi.js";
import { correctBirthTime, type CivilTime } from "../src/calendar/solar-time.js";
import { normalizeBirthProfile } from "../src/sanyi/birth-profile.js";

interface Fixture {
  id: string;
  tag: string;
  clock: CivilTime;
  effective: CivilTime;
  dstMinutes: number;
  lunar: { year: number; month: number; day: number; leap: boolean } | null;
  source: {
    package: string;
    yearMonthRule: string;
    dayRule: string;
    timeRule: string;
  };
  native: Record<"year" | "month" | "day" | "time", string>;
  compareFields: string[];
  expected: Record<"1" | "2", Record<"year" | "month" | "day" | "time", string>>;
}

test("sxtwl 双源 ≥40 时刻，逐字段比较两种 sect", async () => {
  const root = new URL("./fixtures/bazi/", import.meta.url);
  const names = (await readdir(root)).filter((name) => name.endsWith(".json")).sort();
  assert.ok(names.length >= 40);
  const fixtures: Fixture[] = [];
  for (const name of names) {
    fixtures.push(JSON.parse(await readFile(new URL(name, root), "utf8")) as Fixture);
  }
  assert.equal(new Set(fixtures.map((item) => item.id)).size, fixtures.length);
  const tags = new Set(fixtures.map((item) => item.tag));
  for (let index = 1; index < 24; index += 2) {
    assert.ok(tags.has(`term:${index}:before`));
    assert.ok(tags.has(`term:${index}:after`));
  }
  for (let year = 1986; year <= 1991; year += 1) {
    for (const suffix of ["before", "start", "repeat", "after"]) {
      assert.ok(tags.has(`dst:${year}:${suffix}`));
    }
  }
  for (const tag of ["child:23:30", "child:00:30", "leap", "edge:1900", "edge:2099"]) {
    assert.ok(tags.has(tag));
  }
  for (const fixture of fixtures) {
    assert.equal(fixture.source.package, "sxtwl==2.0.6");
    assert.ok(fixture.source.yearMonthRule.includes("交节时刻"));
    assert.deepEqual(fixture.compareFields, ["year", "month", "day", "time"]);
    const corrected = correctBirthTime(fixture.clock, true, null);
    assert.deepEqual(corrected.effective, fixture.effective, fixture.id);
    assert.equal(corrected.steps[0]?.deltaMinutes, fixture.dstMinutes, fixture.id);
    if (fixture.lunar) {
      const converted = normalizeBirthProfile({
        calendar: "lunar", year: fixture.lunar.year, month: fixture.lunar.month,
        day: fixture.lunar.day, isLeapMonth: fixture.lunar.leap,
        time: { hour: fixture.clock.hour, minute: fixture.clock.minute }, gender: "male",
      });
      assert.deepEqual(converted.civil, fixture.clock);
    }
    for (const sect of [1, 2] as const) {
      const chart = buildBaziChart({
        corrected: fixture.effective, gender: "male", sect, timeKnown: true, targetYear: 2026,
      });
      for (const key of ["year", "month", "day", "time"] as const) {
        assert.equal(chart.pillars[key]?.ganZhi, fixture.expected[String(sect) as "1" | "2"][key],
          `${fixture.id} sect=${sect} ${key}`);
      }
    }
  }
});
