// web/components/BaziElements.tsx
import type { ElementCount } from "../../src/calendar/bazi-relations.js";
const parts = [["stem", "天干"], ["main", "本气"], ["middle", "中气"], ["residual", "余气"]] as const;
export function BaziElements({ elements }: {
    elements: readonly ElementCount[];
}) {
    const maximum = Math.max(1, ...elements.map(item => item.total));
    return <section className="panel"><header className="panel-head"><h2>五行分布</h2><p>天干与藏干按个数计，不据此下身强身弱结论。</p></header><div className="elements">{elements.map(item => <div className="el-row" key={item.element}><b>{item.element}</b><div className="el-bar" style={{ "--el-unit": `${100 / maximum}%` } as import("react").CSSProperties} aria-label={`${item.element}共${item.total}个`}>{parts.map(([key, label]) => <i data-qi={key} className={`el-${key}`} style={{ width: `${item[key] / maximum * 100}%` }} title={`${label} ${item[key]}`} key={key}/>)}</div><span>{item.total}</span></div>)}</div><div className="el-legend">{parts.map(([key, label]) => <span key={key}><i className={`el-${key}`}/>{label}</span>)}<span>每格 = 1 个单位</span></div></section>;
}
