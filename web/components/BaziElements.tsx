// web/components/BaziElements.tsx
import type { CSSProperties } from "react";
import type { ElementCount } from "../../src/calendar/bazi-relations.js";
import { useLang, useT } from "../lib/i18n.js";
import { elementEn } from "../lib/result-format.js";
const parts = [["stem", "chart.qi.stem"], ["main", "chart.qi.main"], ["middle", "chart.qi.middle"],
    ["residual", "chart.qi.residual"]] as const;
/** 五行分布条：中英共用，英文只换文字，图形不变。 */
export function BaziElements({ elements }: {
    elements: readonly ElementCount[];
}) {
    const { lang } = useLang();
    const t = useT();
    const name = (element: string) => lang === "en" ? elementEn(element) : element;
    const maximum = Math.max(1, ...elements.map(item => item.total));
    return <section className="panel"><header className="panel-head"><h2>{t("bazi.elements")}</h2><p>{t("chart.elements.note")}</p></header><div className="elements">{elements.map(item => <div className="el-row" key={item.element}><b>{name(item.element)}</b><div className="el-bar" style={{ "--el-unit": `${100 / maximum}%` } as CSSProperties} aria-label={t("chart.elements.total", { element: name(item.element), count: item.total })}>{parts.map(([key, label]) => <i data-qi={key} className={`el-${key}`} style={{ width: `${item[key] / maximum * 100}%` }} title={`${t(label)} ${item[key]}`} key={key}/>)}</div><span>{item.total}</span></div>)}</div><div className="el-legend">{parts.map(([key, label]) => <span key={key}><i className={`el-${key}`}/>{t(label)}</span>)}<span>{t("chart.elements.unit")}</span></div></section>;
}
