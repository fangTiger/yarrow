// web/components/BirthCorrection.tsx
import { buildBirthChart } from "../../src/sanyi/birth-chart.js";
import { normalizeBirthProfile } from "../../src/sanyi/birth-profile.js";
import { birthTimeBasis } from "../../src/calendar/birth-instant.js";
import { correctBirthTime, type CivilTime } from "../../src/calendar/solar-time.js";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import type { ReactNode } from "react";
import { birthSummary, type BirthProfileInput } from "../lib/birth-profile.js";
export function matchesReading(birth: BirthProfileInput, reading: PublicBaziReading): boolean {
  try {
    const chart = buildBirthChart(birth, reading.chart.sect, reading.context.anchorYear).chart;
    const signature = (value: typeof chart) => ({ pillars: value.pillars, luck: value.luck });
    return JSON.stringify(signature(chart)) === JSON.stringify(signature(reading.chart));
  } catch {
    return false;
  }
}
function civilText(value: CivilTime | null): string {
  if (!value) return "未知";
  const time = `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`;
  return `${value.year}-${value.month}-${value.day} ${time}`;
}
const DST_LABELS = {
  applied: "已减一小时",
  "not-applied": "未校正",
  "skipped-region": "当地历史夏令时未自动校正",
};
function disambiguationText(value: "exact" | "ambiguous" | "skipped" | undefined): string {
  if (value === "ambiguous") return " · 重复时段，取较早时刻";
  if (value === "skipped") return " · 跳跃时段，取较早时刻";
  return "";
}
export function BirthCorrection({ reading, birth, boundary }: {
  reading: PublicBaziReading;
  birth: BirthProfileInput | null;
  boundary?: ReactNode;
}) {
  let local = null;
  let overseas = null;
  if (birth && matchesReading(birth, reading)) {
    const profile = normalizeBirthProfile(birth);
    if (profile.timeZone === "Asia/Shanghai") {
      local = correctBirthTime(profile.civil, profile.timeKnown, profile.longitude, profile);
    } else {
      overseas = birthTimeBasis(profile.civil, profile.timeZone);
    }
  }
  const sharedSummary = reading.correction.timeZone
    ? `按出生地时区 ${reading.correction.timeZone}，换算为当地标准时 ${reading.correction.localStandard}`
      + disambiguationText(reading.correction.disambiguation)
    : `夏令时 ${DST_LABELS[reading.correction.dst]} · 真太阳时 ${
      reading.correction.solar === "applied" ? "已校正" : "未校正"
    }`;
  return <div className="birth">
    {birth && overseas ? <>
      <div className="birth-main"><b>{birthSummary(birth)}</b><span>本机档案</span></div>
      <ul className="fixes" aria-label="出生时刻校正">
        <li><b>出生地时区</b><span>{birth.timeZone}</span></li>
        <li><b>当地标准时</b><span>
          {civilText(overseas.localStandard)}{disambiguationText(overseas.disambiguation)}
        </span></li>
        <li><b>换日口径</b><span>{boundary}</span></li>
      </ul>
    </> : birth && local ? <>
      <div className="birth-main"><b>{birthSummary(birth)}</b><span>本机档案</span></div>
      <ul className="fixes" aria-label="出生时刻校正">
        {["夏令时", "真太阳时"].map((label, index) => <li key={label}>
          <b>{label}</b><span>{local.steps[index]
            ? `${civilText(local.steps[index]!.before)} → ${civilText(local.steps[index]!.after)} · ${
              local.steps[index]!.description
            }`
            : "未校正"}</span>
        </li>)}
        <li><b>换日口径</b><span>{boundary}</span></li>
      </ul>
    </> : <>
      <p>校正摘要：{sharedSummary} · {reading.correction.timeKnown ? "已知时辰" : "时辰未知"}</p>
      <ul className="fixes"><li><b>换日口径</b><span>{boundary}</span></li></ul>
    </>}
    {reading.chart.warnings.map((warning) => <p className="hint" key={warning}>{warning}</p>)}
  </div>;
}
