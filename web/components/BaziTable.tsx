// web/components/BaziTable.tsx
import type { BaziChart } from "../../src/calendar/bazi.js";
import type { BaziAnalysis } from "../../src/calendar/bazi-relations.js";
export function BaziTable({ chart, analysis }: {
    chart: BaziChart;
    analysis: BaziAnalysis;
}) {
    const keys = ["year", "month", "day", "time"] as const;
    const rows = ["十神", "天干", "地支", "藏干", "长生", "纳音", "神煞"];
    return <div className="pillars-scroll" tabIndex={0} aria-label="四柱表，可横向滚动"><table className="pillars"><thead><tr><th></th>{["年柱", "月柱", "日柱 · 日主", "时柱"].map((label, i) => <th className={i === 2 ? "day" : ""} key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((label, i) => <tr key={label}><td className="rowlabel">{label}</td>{keys.map(key => {
                const pillar = chart.pillars[key];
                if (!pillar)
                    return <td key={key}>缺</td>;
                const names = new Map<string, string[]>();
                for (const item of analysis.shensha.filter(item => item.nodeId.startsWith(`natal.${key}.`)))
                    names.set(item.name, [...new Set([...(names.get(item.name) ?? []), item.basis])]);
                const values = [pillar.stemGod, pillar.stem, pillar.branch, pillar.hidden.map(item => <span className="hide" key={item.stem}>{item.stem}<small>{item.god}</small></span>), pillar.diShi, pillar.naYin, <div className="shensha">{names.size ? [...names].map(([name, basis]) => <span className="tag" title={basis.join("；")} key={name}>{name}</span>) : "—"}</div>];
                return <td className={`${i === 1 || i === 2 ? "gz " : ""}${key === "day" ? "day" : ""}`.trim()} key={key}>{values[i]}</td>;
            })}</tr>)}</tbody></table></div>;
}
