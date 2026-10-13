// web/components/BaziLuck.tsx
import type { BaziChart } from "../../src/calendar/bazi.js";
import { useLang, useT } from "../lib/i18n.js";
import { stemBranchEn, tenGodEn } from "../lib/result-format.js";
import { currentCycleIndex } from "../lib/life-luck.js";
/** 大运：中英共用，标出今年所在之运；英文干支写拼音、十神写英文。 */
export function BaziLuck({ chart, currentYear, currentDate }: {
    chart: BaziChart;
    currentYear: number;
    currentDate: string;
}) {
    const { lang } = useLang();
    const t = useT();
    const en = lang === "en";
    const gz = (value: string) => en ? stemBranchEn(value) : value;
    const god = (value: string) => en ? tenGodEn(value) : value;
    const luck = chart.luck;
    if (!luck) {
        return <section className="panel"><header className="panel-head"><h2>{t("bazi.luck")}</h2></header><p>{t("chart.luck.missing")}</p></section>;
    }
    const currentGanZhi = "甲乙丙丁戊己庚辛壬癸".charAt((currentYear - 4) % 10) + "子丑寅卯辰巳午未申酉戌亥".charAt((currentYear - 4) % 12);
    const currentIndex = currentCycleIndex(chart, currentDate);
    return <section className="panel"><header className="panel-head"><h2>{t("bazi.luck")}</h2></header><p>{luck.direction === "forward" ? t("bazi.forward") : t("bazi.backward")} · {t("chart.luck.start", { years: luck.start.years, months: luck.start.months, days: luck.start.days, date: luck.start.solarDate })}{luck.approximate ? t("chart.luck.approximate") : ""}</p><div className="luck">{luck.cycles.map((cycle) => <div data-cycle={cycle.index} className={currentIndex === cycle.index ? "now luck-current" : ""} key={cycle.index}><b>{gz(cycle.ganZhi)}</b><small>{god(cycle.stemGod)}<br />{t("chart.luck.ages", { from: cycle.startAge, to: cycle.endAge })}<br />{cycle.startYear}–{cycle.endYear}</small>{currentIndex === cycle.index ? <span className="flag">{t("chart.luck.now", { ganZhi: gz(currentGanZhi) })}{currentYear === cycle.endYear ? t("chart.luck.lastYear") : t("chart.luck.thisPeriod")}</span> : null}{chart.liunian.anchorYear !== currentYear && chart.liunian.anchorYear >= cycle.startYear && chart.liunian.anchorYear <= cycle.endYear ? <span>{t("chart.luck.askedYear", { year: chart.liunian.anchorYear })}</span> : null}</div>)}</div>{currentDate < luck.start.solarDate ? <p>{t("chart.luck.beforeStart")}</p> : null}</section>;
}
