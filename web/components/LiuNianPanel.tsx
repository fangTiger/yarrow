// web/components/LiuNianPanel.tsx
import { useEffect, useRef, useState } from "react";
import { BAZI_KEYS, BAZI_NAMES, CHART, LABEL_BAND, consensusText, labelLayout, yunLabel, chartGeometry, relationClass, schoolYear, yearGapLabel, yearGroups, type FortuneReading } from "../lib/liunian-chart.js";
export function LiuNianPanel({ reading, currentYear }: {
    reading: FortuneReading;
    currentYear: number;
}) {
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
        label: string;
        className?: string;
        render(i: number): React.ReactNode;
    }[] = [
        { label: '流年', className: 'gz', render: i => <>{years[i]?.ganZhi}<small>虚岁 {years[i]?.age}</small></> },
        { label: '十神', render: i => <>{years[i]?.stemGod}<br />{years[i]?.hidden[0]?.god ?? '—'}</> },
        { label: '大运', render: i => { const year = years[i]!; return year.luckChange ? <>{year.luckChange.from ?? '起运前'}→{year.luckChange.to}<small>{year.luckChange.date}</small></> : year.luck?.ganZhi ?? year.luckLabel ?? '—'; } },
        { label: '合冲刑害', className: 'rels', render: i => {
                const relations = reading.analysis.years.find(item => item.year === years[i]?.year)?.relations.filter(item => item.scope === 'year') ?? [];
                return [...new Map(relations.map(item => [item.label, item])).values()].map(item => <span className={relationClass(item.kind)} key={item.label}>{item.label}</span>);
            } },
        ...BAZI_KEYS.map(key => ({ label: BAZI_NAMES[key], className: 'v', render: (i: number) => { const entry = schoolYear(reading, key, years[i]!.year); if (entry) { return <>{entry.verdict} {entry.confidenceTenths}成</>; } return yearGapLabel(reading.schools[key].status); } })),
        { label: '合议', render: i => reading.years[i] ? consensusText(reading.years[i]!.average) : '—' }
    ];
    const active = years.find(year => year.year === selected)!;
    const hovered = hover === null ? undefined : years[hover];
    const consensus = hover === null ? undefined : reading.years[hover];
    return <section className="panel liunian-panel" aria-label="流年运势"><header className="panel-head"><h2>流年运势</h2><p>以所问之年为锚，流年以立春为界；回看可与亲历对照。缺少断语的年份不连线。</p></header><div className="ln-grid">
 <div className="ln-chart"><div className="ln-y">{[1, 3, 5, 7, 9].map(value => <span style={{ top: `${plotTop((9 - value) / 8 * 100)}px` }} key={value}>{value}成</span>)}</div>
 <div className="ln-plot" ref={plot} role="img" aria-label={`流年合议走势图，${years[0]?.year}至${years.at(-1)?.year}，纵轴一至九成；完整数值见下表。`}>
 {[3, 5, 7].map(value => <i className={value === 5 ? 'ln-ref' : 'ln-grid-y'} style={{ top: `${plotTop((9 - value) / 8 * 100)}px` }} key={value}/>)}
 {years.map((year, i) => <div key={year.year}>
 {year.year === currentYear ? <i className="ln-now" style={{ left: `${i / years.length * 100}%`, width: `${100 / years.length}%` }}/> : null}
 {geometry.points[i] ? <><i className="ln-range" style={{ left: position(i), top: `${plotTop(yp(geometry.points[i]!.high))}px`, height: `${(yp(geometry.points[i]!.low) - yp(geometry.points[i]!.high)) / 100 * (194 - LABEL_BAND)}px` }}/><i className={`ln-dot ${year.year === currentYear ? 'now' : ''}`} style={{ left: position(i), top: `${plotTop(yp(geometry.points[i]!.y))}px` }}/>
 {labels.filter(label => label.index === i).map(label => <span className="ln-lab" style={{ left: position(i), top: `${label.top}px` }} key={i}>{label.labels.map(text => <span className={text === '回看中最低' ? 'wide-only' : ''} key={text}>{text} {consensusText(reading.years[i]!.average)}<br /></span>)}</span>)}</> : null}
 <div className={`ln-hit ${selected === year.year ? 'sel' : ''}`} style={{ left: `${i / years.length * 100}%`, width: `${100 / years.length}%` }} onClick={() => setSelected(year.year)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}/>
 </div>)}
 <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">{geometry.paths.map((path, i) => <path className="ln-line" d={path} transform={`translate(${-CHART.left * CHART.width / (CHART.width - CHART.left)},${-CHART.top * CHART.height / (CHART.bottom - CHART.top)}) scale(${CHART.width / (CHART.width - CHART.left)},${CHART.height / (CHART.bottom - CHART.top)})`} vectorEffect="non-scaling-stroke" key={i}/>)}</svg>
 <i className="ln-yun first" style={{ left: 0 }}><span>{yunLabel(years[0]?.luck?.ganZhi ?? years[0]?.luckLabel ?? '起运前', null, false)}</span></i>
 {geometry.changes.map(change => <i className="ln-yun" style={{ left: `${xp(change.x)}%` }} key={change.date}><span>{yunLabel(years.find(year => year.luckChange?.date === change.date)?.luckChange?.to ?? '—', change.date, narrow)}</span></i>)}
 {hovered ? <div className="ln-tip" style={{ left: `${Math.max(26, Math.min(74, (hover! + .5) / years.length * 100))}%`, top: '50%' }}><b>{hovered.year} {hovered.ganZhi}</b><br />{consensus ? `${consensusText(consensus.average)} · ${consensus.min}–${consensus.max}成` : '未展示'}</div> : null}
 </div><div className="ln-x" style={{ gridTemplateColumns: `repeat(${years.length},minmax(0,1fr))` }}>{years.map(year => <span className={year.year === currentYear ? 'now' : ''} key={year.year}>{year.ganZhi}<small>{year.year}</small></span>)}</div></div>
 <div className="ln-key"><span><i className="k-line"/>三家合议（平均）</span><span><i className="k-range"/>三家最低至最高</span><span><i className="k-ref"/>五五之数</span></div>
 <div className="ln-scroll" ref={scroll} tabIndex={0} aria-label="流年逐年表，可横向滚动"><table className="ln-table"><colgroup><col className="ln-axis"/>{years.map(year => <col key={year.year}/>)}</colgroup><thead><tr className="ln-span"><th></th>{yearGroups(years.map(year => year.year), currentYear).map(group => <th scope="colgroup" colSpan={group.count} key={group.label}>{group.label === '回看' ? '回看 · 可对照亲历' : group.label}</th>)}</tr><tr><th>年份</th>{years.map((year, i) => <th className={year.year === currentYear ? 'now' : ''} key={year.year} ref={cell => {
                if (cell)
                    cells.current.set(year.year, cell);
            }}><button className={`ln-year ${selected === year.year ? 'sel' : ''}`} aria-pressed={selected === year.year} onClick={() => setSelected(year.year)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>{year.year}</button></th>)}</tr></thead><tbody>{rows.map(row => <tr className={row.label === '合议' ? 'avg' : ''} key={row.label}><th scope="row">{row.label}</th>{years.map((year, i) => {
                const key = BAZI_KEYS.find(key => BAZI_NAMES[key] === row.label);
                const entry = key ? schoolYear(reading, key, year.year) : undefined;
                return <td className={[year.year === currentYear ? 'now' : '', row.className ?? '', entry?.verdict.includes('吉') ? 'ji' : entry?.verdict.includes('凶') ? 'xiong' : ''].join(' ')} key={year.year}>{row.render(i)}</td>;
            })}</tr>)}</tbody></table></div>
 <div className="ln-detail"><div className="ln-detail-head"><span>合议 {reading.years.find(item => item?.year === selected) ? consensusText(reading.years.find(item => item?.year === selected)!.average) : '—'}</span><b>{selected} {active.ganZhi}</b><span>虚岁 {active.age} · {active.luck?.ganZhi ?? active.luckLabel} · {active.stemGod}</span></div><div className="ln-detail-rows">{BAZI_KEYS.map(key => { const entry = schoolYear(reading, key, selected); return <div key={key}><span className="seal">{BAZI_NAMES[key].slice(0, 1)}</span><strong className={entry?.verdict.includes('吉') ? 'ji' : entry?.verdict.includes('凶') ? 'xiong' : ''}>{entry ? `${entry.verdict} ${entry.confidenceTenths}成` : yearGapLabel(reading.schools[key].status)}<small>{BAZI_NAMES[key]}</small></strong><p>{entry ? (entry.note || '短评与盘面不符，已删去') : yearGapLabel(reading.schools[key].status)}</p></div>; })}</div></div>
 </div></section>;
}
