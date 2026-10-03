// web/components/ShikongBar.tsx
import { useEffect, useState } from "react";
import { api, type NowResponse } from "../lib/api.js";
import { formatClash } from "../lib/almanac-format.js";
export interface ShikongCell { label: string; main: string; sub: string }
export interface ShikongView {
  solar: ShikongCell;
  lunar: ShikongCell;
  pillars: ShikongCell;
  solarTerm: ShikongCell;
  monthDay: ShikongCell;
  duty: ShikongCell;
}
export function toView(value: NowResponse): ShikongView {
  const nextDate = value.solarTerms.nextAt.split(" ")[0]!.split("-");
  return {
    solar: { label: "公历", main: value.solar.text.slice(0, 16), sub: "北京时间" },
    lunar: { label: "农历", main: value.lunar.date.replace(/^.*年/u, ""), sub: `${value.pillars[0]}年 · ${value.lunar.timeBranch}时 · ${value.lunar.moonPhase}` },
    pillars: { label: "四柱", main: value.pillars.join(" "), sub: value.naYin.join(" ") },
    solarTerm: { label: "节气", main: `${value.solarTerms.current} · ${value.solarTerms.hou.split(/\s+/u).at(-1)}`, sub: `${value.solarTerms.wuHou} · ${Number(nextDate[1])}月${Number(nextDate[2])}日交${value.solarTerms.next}` },
    monthDay: { label: "月建日辰", main: `${value.cycle.monthBranch}月 · ${value.cycle.day}日`, sub: `旬首${value.cycle.xun} · 旬空${value.cycle.voidBranches.join("")}` },
    duty: { label: "值日", main: `${value.dayOfficers.officer}日 · ${value.dayOfficers.deity}${value.dayOfficers.path}`, sub: `${value.mansion.name} · ${formatClash(value.clash)}` },
  };
}
export function ShikongBar({ data }: { data?: ShikongView }) {
  const [view, setView] = useState<ShikongView | undefined>(data);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (data) return undefined;
    let active = true;
    const refresh = () => api.getNow().then((value) => {
      if (active) { setView(toView(value)); setFailed(false); }
    }).catch(() => { if (active) setFailed(true); });
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [data]);
  if (!view) {
    return (
      <section className="shikong" aria-label="此刻">
        {failed ? "天时暂不可得" : "正在推算天时"}
      </section>
    );
  }
  const cells = Object.values(view);
  return (
    <section className="shikong" aria-label="此刻">
      {cells.map(({ label, main, sub }) => (
        <div className="shikong-item" key={label}>
          <span>{label}</span>
          <b>{main}</b>
          <small className="shikong-sub">{sub}</small>
        </div>
      ))}
    </section>
  );
}
