// web/components/LiuNianPanel.tsx
import { useEffect, useRef, useState } from "react";
import { BAZI_KEYS, BAZI_NAMES, CHART, LABEL_BAND, consensusText, labelLayout, tenthsText, yunLabel, chartGeometry, relationClass, schoolYear, yearGapLabel, yearGroups, type FortuneReading } from "../lib/liunian-chart.js";
import { useLang, useT } from "../lib/i18n.js";
import { relationEn, schoolEn, stemBranchEn, tenGodEn, verdictEn } from "../lib/result-format.js";
/** 走势图直标、年份分组与「起运前」等状态：数据里是中文标识，显示时按语言取词条。 */
const LABEL_KEYS = { 今年: "chart.liunian.labelNow", 十年最顺: "chart.liunian.labelBest", 回看中最低: "chart.liunian.labelLowestPast" } as const;
const GROUP_KEYS = { 回看: "chart.liunian.groupPast", 今年: "chart.liunian.groupNow", 展望: "chart.liunian.groupAhead" } as const;
const LUCK_LABEL_KEYS = { 起运前: "chart.luck.notStarted", 时辰未知: "chart.luck.timeUnknown" } as const;
/** 流年运势：合议走势图、逐年表与选中年份详情；中英共用，英文干支写拼音、吉凶与关系名走英译。 */
export function LiuNianPanel({ reading, currentYear }: {
    reading: FortuneReading;
    currentYear: number;
}) {
    const { lang } = useLang();
    const t = useT();
    const en = lang === "en";
    const gz = (value: string) => en ? stemBranchEn(value) : value;
    const god = (value: string) => en ? tenGodEn(value) : value;
    const schoolName = (key: typeof BAZI_KEYS[number]) => en ? schoolEn(key).name : BAZI_NAMES[key];
    const verdictText = (entry: { verdict: string; confidenceTenths: number }) => `${en ? verdictEn(entry.verdict) : entry.verdict} ${tenthsText(entry.confidenceTenths, lang)}`;
    const luckLabelText = (value: string) => en ? t(LUCK_LABEL_KEYS[value as keyof typeof LUCK_LABEL_KEYS] ?? "chart.luck.notStarted") : value;
    const years = reading.chart.liunian.years;
    const [selected, setSelected] = useState(reading.chart.liunian.anchorYear);
    const [hover, setHover] = useState<number | null>(null);
    const scroll = useRef<HTMLDivElement>(null);
    const cells = useRef(new Map<number, HTMLTableCellElement>());
    const geometry = chartGeometry(reading.years, years.map(year => year.luckChange?.date ?? null));
    const plot = useRef<HTMLDivElement>(null);
    const [plotWidth, setPlotWidth] = useState(910);
    const [narrow, setNarrow] = useState(false);
    useEffect(() => {
        if (!plot.current) return;
        const update = () => setNarrow(window.matchMedia('(max-width: 620px)').matches);
        update();
        window.addEventListener('resize', update);
        const observer = new ResizeObserver(entries => setPlotWidth(entries[0]!.contentRect.width));
        observer.observe(plot.current);
        return () => { observer.disconnect(); window.removeEventListener('resize', update); };
    }, []);
    const labels = labelLayout(reading.years, currentYear, plotWidth);
    const plotTop = (value: number) => LABEL_BAND + value / 100 * (194 - LABEL_BAND);
    const xp = (x: number) => (x - CHART.left) / (CHART.width - CHART.left) * 100;
    const yp = (y: number) => (y - CHART.top) / (CHART.bottom - CHART.top) * 100;
    const position = (i: number) => `${(i + .5) / years.length * 100}%`;
    useEffect(() => {
        if (window.matchMedia('(min-width: 1061px)').matches)
            return;
        const cell = cells.current.get(selected);
        const container = scroll.current;
        if (cell && container)
            container.scrollLeft = Math.max(0, cell.offsetLeft - 76 - (container.clientWidth - 166) / 2);
    }, [selected]);
    const rows: {
        id: string;
        label: string;
        school?: typeof BAZI_KEYS[number];
        className?: string;
        render(i: number): React.ReactNode;
    }[] = [
        { id: 'year', label: t("chart.liunian.rowYear"), className: 'gz', render: i => <>{gz(years[i]!.ganZhi)}<small>{t("bazi.age", { age: years[i]!.age })}</small></> },
        { id: 'gods', label: t("bazi.stemGod"), render: i => <>{god(years[i]!.stemGod)}<br />{years[i]?.hidden[0]?.god ? god(years[i]!.hidden[0]!.god) : '—'}</> },
        { id: 'luck', label: t("chart.liunian.rowLuck"), render: i => { const year = years[i]!; return year.luckChange ? <>{year.luckChange.from ? gz(year.luckChange.from) : t("chart.luck.notStarted")}→{gz(year.luckChange.to)}<small>{year.luckChange.date}</small></> : year.luck?.ganZhi ? gz(year.luck.ganZhi) : year.luckLabel ? luckLabelText(year.luckLabel) : '—'; } },
        { id: 'rels', label: t("chart.liunian.rowRelations"), className: 'rels', render: i => {
                const relations = reading.analysis.years.find(item => item.year === years[i]?.year)?.relations.filter(item => item.scope === 'year') ?? [];
                return [...new Map(relations.map(item => [item.label, item])).values()].map(item => <span className={relationClass(item.kind)} key={item.label}>{en ? relationEn(item) : item.label}</span>);
            } },
        ...BAZI_KEYS.map(key => ({ id: key, label: schoolName(key), school: key, className: 'v', render: (i: number) => { const entry = schoolYear(reading, key, years[i]!.year); if (entry) { return verdictText(entry); } return yearGapLabel(reading.schools[key].status, lang); } })),
        { id: 'avg', label: t("chart.liunian.rowConsensus"), render: i => reading.years[i] ? consensusText(reading.years[i]!.average, lang) : '—' }
    ];
    const active = years.find(year => year.year === selected)!;
    const activeLuck = active.luck?.ganZhi ? gz(active.luck.ganZhi) : active.luckLabel ? luckLabelText(active.luckLabel) : '';
    const selectedConsensus = reading.years.find(item => item?.year === selected);
    const hovered = hover === null ? undefined : years[hover];
    const consensus = hover === null ? undefined : reading.years[hover];
    return <section className="panel liunian-panel" aria-label={t("bazi.annual")}><header className="panel-head"><h2>{t("bazi.annual")}</h2><p>{t("chart.liunian.note")}</p></header><div className="ln-grid">
 <div className="ln-chart"><div className="ln-y">{[1, 3, 5, 7, 9].map(value => <span style={{ top: `${plotTop((9 - value) / 8 * 100)}px` }} key={value}>{tenthsText(value, lang)}</span>)}</div>
 <div className="ln-plot" ref={plot} role="img" aria-label={t("chart.liunian.plotAria", { from: years[0]?.year ?? '', to: years.at(-1)?.year ?? '' })}>
 {[3, 5, 7].map(value => <i className={value === 5 ? 'ln-ref' : 'ln-grid-y'} style={{ top: `${plotTop((9 - value) / 8 * 100)}px` }} key={value}/>)}
 {years.map((year, i) => <div key={year.year}>
 {year.year === currentYear ? <i className="ln-now" style={{ left: `${i / years.length * 100}%`, width: `${100 / years.length}%` }}/> : null}
 {geometry.points[i] ? <><i className="ln-range" style={{ left: position(i), top: `${plotTop(yp(geometry.points[i]!.high))}px`, height: `${(yp(geometry.points[i]!.low) - yp(geometry.points[i]!.high)) / 100 * (194 - LABEL_BAND)}px` }}/><i className={`ln-dot ${year.year === currentYear ? 'now' : ''}`} style={{ left: position(i), top: `${plotTop(yp(geometry.points[i]!.y))}px` }}/>
 {labels.filter(label => label.index === i).map(label => <span className="ln-lab" style={{ left: position(i), top: `${label.top}px` }} key={i}>{label.labels.map(text => <span className={text === '回看中最低' ? 'wide-only' : ''} key={text}>{t(LABEL_KEYS[text as keyof typeof LABEL_KEYS])} {consensusText(reading.years[i]!.average, lang)}<br /></span>)}</span>)}</> : null}
 <div className={`ln-hit ${selected === year.year ? 'sel' : ''}`} style={{ left: `${i / years.length * 100}%`, width: `${100 / years.length}%` }} onClick={() => setSelected(year.year)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}/>
 </div>)}
 <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">{geometry.paths.map((path, i) => <path className="ln-line" d={path} transform={`translate(${-CHART.left * CHART.width / (CHART.width - CHART.left)},${-CHART.top * CHART.height / (CHART.bottom - CHART.top)}) scale(${CHART.width / (CHART.width - CHART.left)},${CHART.height / (CHART.bottom - CHART.top)})`} vectorEffect="non-scaling-stroke" key={i}/>)}</svg>
 <i className="ln-yun first" style={{ left: 0 }}><span>{yunLabel(years[0]?.luck?.ganZhi ? gz(years[0].luck.ganZhi) : luckLabelText(years[0]?.luckLabel ?? '起运前'), null, false, lang)}</span></i>
 {geometry.changes.map(change => <i className="ln-yun" style={{ left: `${xp(change.x)}%` }} key={change.date}><span>{yunLabel((to => to ? gz(to) : '—')(years.find(year => year.luckChange?.date === change.date)?.luckChange?.to), change.date, narrow, lang)}</span></i>)}
 {hovered ? <div className="ln-tip" style={{ left: `${Math.max(26, Math.min(74, (hover! + .5) / years.length * 100))}%`, top: '50%' }}><b>{hovered.year} {gz(hovered.ganZhi)}</b><br />{consensus ? `${consensusText(consensus.average, lang)} · ${consensus.min}–${tenthsText(consensus.max, lang)}` : t("chart.liunian.notShown")}</div> : null}
 </div><div className="ln-x" style={{ gridTemplateColumns: `repeat(${years.length},minmax(0,1fr))` }}>{years.map(year => <span className={year.year === currentYear ? 'now' : ''} key={year.year}>{gz(year.ganZhi)}<small>{year.year}</small></span>)}</div></div>
 <div className="ln-key"><span><i className="k-line"/>{t("chart.liunian.keyLine")}</span><span><i className="k-range"/>{t("chart.liunian.keyRange")}</span><span><i className="k-ref"/>{t("chart.liunian.keyRef")}</span></div>
 <div className="ln-scroll" ref={scroll} tabIndex={0} aria-label={t("chart.liunian.tableAria")}><table className="ln-table"><colgroup><col className="ln-axis"/>{years.map(year => <col key={year.year}/>)}</colgroup><thead><tr className="ln-span"><th></th>{yearGroups(years.map(year => year.year), currentYear).map(group => <th scope="colgroup" colSpan={group.count} key={group.label}>{t(GROUP_KEYS[group.label as keyof typeof GROUP_KEYS])}</th>)}</tr><tr><th>{t("bazi.tableYear")}</th>{years.map((year, i) => <th className={year.year === currentYear ? 'now' : ''} key={year.year} ref={cell => {
                if (cell)
                    cells.current.set(year.year, cell);
            }}><button className={`ln-year ${selected === year.year ? 'sel' : ''}`} aria-pressed={selected === year.year} onClick={() => setSelected(year.year)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>{year.year}</button></th>)}</tr></thead><tbody>{rows.map(row => <tr className={row.id === 'avg' ? 'avg' : ''} key={row.id}><th scope="row">{row.label}</th>{years.map((year, i) => {
                const entry = row.school ? schoolYear(reading, row.school, year.year) : undefined;
                return <td className={[year.year === currentYear ? 'now' : '', row.className ?? '', entry?.verdict.includes('吉') ? 'ji' : entry?.verdict.includes('凶') ? 'xiong' : ''].join(' ')} key={year.year}>{row.render(i)}</td>;
            })}</tr>)}</tbody></table></div>
 <div className="ln-detail"><div className="ln-detail-head"><span>{t("bazi.consensus", { value: selectedConsensus ? consensusText(selectedConsensus.average, lang) : '—' })}</span><b>{selected} {gz(active.ganZhi)}</b><span>{t("bazi.age", { age: active.age })} · {activeLuck} · {god(active.stemGod)}</span></div><div className="ln-detail-rows">{BAZI_KEYS.map(key => { const entry = schoolYear(reading, key, selected); return <div key={key}><span className="seal">{schoolName(key).slice(0, 1)}</span><strong className={entry?.verdict.includes('吉') ? 'ji' : entry?.verdict.includes('凶') ? 'xiong' : ''}>{entry ? verdictText(entry) : yearGapLabel(reading.schools[key].status, lang)}<small>{schoolName(key)}</small></strong><p>{entry ? (entry.note || t("chart.liunian.noteRemoved")) : yearGapLabel(reading.schools[key].status, lang)}</p></div>; })}</div></div>
 </div></section>;
}
