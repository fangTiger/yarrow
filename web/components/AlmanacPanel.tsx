// web/components/AlmanacPanel.tsx
import type { AlmanacResult } from "../../src/calendar/almanac.js";
export function AlmanacPanel({ value }: { value: AlmanacResult }) {
  const rows = [
    ["建除 · 值神", `${value.dayOfficers.officer}日 · ${value.dayOfficers.deity}（${value.dayOfficers.path}）`],
    ["二十八宿", `${value.mansion.name} · ${value.mansion.palace}${value.mansion.guardian}`],
    ["冲煞", `${value.clash.description} · 煞${value.clash.direction}`],
    ["日家九星", value.almanac.nineStar],
    ["吉神方位", `喜神${value.almanac.joy} · 财神${value.almanac.wealth} · 福神${value.almanac.fortune}`],
    ["宜", value.almanac.suitable.join(" ")],
    ["忌", value.almanac.avoid.join(" ")],
    ["彭祖百忌", value.almanac.pengZu.join("；")],
  ] as const;
  return (
    <section aria-labelledby="almanac-title" className="panel">
      <header className="panel-head">
        <h2 id="almanac-title">当日黄历</h2>
        <p>{value.lunar.date} · {value.cycle.day}日</p>
      </header>
      <div className="almanac-grid">
        {rows.map(([label, text]) => (
          <div key={label}>
            <span className="label">{label}</span>
            <b className={label === "宜" ? "good" : label === "忌" ? "bad" : ""}>{text}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
