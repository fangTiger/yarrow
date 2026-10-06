// web/components/BaziLuck.tsx
import type { BaziChart } from "../../src/calendar/bazi.js";
export function BaziLuck({ chart, currentYear, currentDate }: {
    chart: BaziChart;
    currentYear: number;
    currentDate: string;
}) {
    const luck = chart.luck;
    if (!luck) {
        return <section className="panel"><header className="panel-head"><h2>大运</h2></header><p>需补时辰确认起运与大运。</p></section>;
    }
    const currentGanZhi = "甲乙丙丁戊己庚辛壬癸".charAt((currentYear - 4) % 10) + "子丑寅卯辰巳午未申酉戌亥".charAt((currentYear - 4) % 12);
    const monthDay = luck.start.solarDate.slice(4);
    const current = luck.cycles.find((cycle, index) => {
        const start = `${cycle.startYear}${monthDay}`;
        const next = luck.cycles[index + 1];
        const end = `${next?.startYear ?? cycle.endYear + 1}${monthDay}`;
        return currentDate >= start && currentDate < end;
    });
    return <section className="panel"><header className="panel-head"><h2>大运</h2></header><p>{luck.direction === "forward" ? "顺行" : "逆行"} · {luck.start.years}年{luck.start.months}个月{luck.start.days}天起运 · {luck.start.solarDate}{luck.approximate ? "（正午估算）" : ""}</p><div className="luck">{luck.cycles.map((cycle) => <div data-cycle={cycle.index} className={current?.index === cycle.index ? "now luck-current" : ""} key={cycle.index}><b>{cycle.ganZhi}</b><small>{cycle.stemGod}<br />{cycle.startAge}–{cycle.endAge}岁<br />{cycle.startYear}–{cycle.endYear}</small>{current?.index === cycle.index ? <span className="flag">今年 {currentGanZhi} · {currentYear === cycle.endYear ? "本运末年" : "本运"}</span> : null}{chart.liunian.anchorYear !== currentYear && chart.liunian.anchorYear >= cycle.startYear && chart.liunian.anchorYear <= cycle.endYear ? <span>所问之年 {chart.liunian.anchorYear}</span> : null}</div>)}</div>{currentDate < luck.start.solarDate ? <p>当前起运前</p> : null}</section>;
}
