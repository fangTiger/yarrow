import { useEffect, useRef, useState } from "react";
import {
  BAZI_KEYS, BAZI_NAMES, CHART, LABEL_BAND, chartGeometry, consensusText, tenthsText,
  yearGapLabel,
} from "../lib/liunian-chart.js";
import {
  currentCycleIndex, cycleFortuneHref, cycleGroups, nextPeriodVote, periodLabels, schoolPeriod,
  type DestinyReading, type PeriodVote,
} from "../lib/life-luck.js";
import { useLang, useT } from "../lib/i18n.js";
import { schoolEn, stemBranchEn, tenGodEn, verdictEn } from "../lib/result-format.js";
import { readingIsWriting, writtenSchoolCount } from "../lib/reading-progress.js";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { api, apiErrorMessage } from "../lib/api.js";

const LABEL_KEYS = {
  当前: "chart.life.labelNow",
  一生最顺: "chart.life.labelBest",
  回看中最低: "chart.life.labelLowestPast",
} as const;
const GROUP_KEYS = {
  回看: "chart.life.groupPast", 当前: "chart.life.groupNow", 往后: "chart.life.groupAhead",
} as const;

/** 一生运势：逐运合议走势图、三家表格与所选大运短评，中英共用。 */
export function LifeLuckPanel(props: {
  reading: DestinyReading;
  currentDate: string;
  onReading?: ((reading: PublicBaziReading) => void) | undefined;
  readonly?: boolean | undefined;
}) {
  const luck = props.reading.chart.luck;
  return luck?.cycles.length ? <LifeLuckContent {...props} luck={luck} /> : null;
}

function LifeLuckContent({ reading, currentDate, luck, onReading, readonly }: {
  reading: DestinyReading;
  currentDate: string;
  luck: NonNullable<DestinyReading["chart"]["luck"]>;
  onReading?: ((reading: PublicBaziReading) => void) | undefined;
  readonly?: boolean | undefined;
}) {
  const { lang } = useLang();
  const t = useT();
  const en = lang === "en";
  const cycles = luck.cycles;
  const writing = readingIsWriting(reading);
  const written = writtenSchoolCount(reading);
  const currentIndex = currentCycleIndex(reading.chart, currentDate);
  const initial = currentIndex ?? cycles[0]!.index;
  const [selected, setSelected] = useState(initial);
  const [hover, setHover] = useState<number | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<number, HTMLTableCellElement>());
  const geometry = chartGeometry(reading.periods, cycles.map(() => null));
  const labels = writing ? cycles.map(() => []) : periodLabels(reading.periods, currentIndex);
  const active = cycles.find((cycle) => cycle.index === selected) ?? cycles[0]!;
  const currentYear = Number(currentDate.slice(0, 4));
  const feedback = reading.feedback?.periods ?? {};
  const selectedVote = feedback[String(selected)] as PeriodVote | undefined;
  const votes = Object.values(feedback);
  const accurate = votes.filter((vote) => vote === "accurate").length;
  const inaccurate = votes.filter((vote) => vote === "inaccurate").length;
  const feedbackTotal = accurate + inaccurate;
  const fortuneHref = cycleFortuneHref(active, currentIndex, t, currentYear);
  const selectedConsensus = reading.periods.find((item) => item?.index === selected);
  const hovered = hover === null ? undefined : cycles[hover];
  const hoverConsensus = hover === null ? undefined : reading.periods[hover];
  const gz = (value: string) => en ? stemBranchEn(value) : value;
  const god = (value: string) => en ? tenGodEn(value) : value;
  const schoolName = (key: typeof BAZI_KEYS[number]) => (
    en ? schoolEn(key).name : BAZI_NAMES[key]
  );
  const verdictText = (entry: { verdict: string; confidenceTenths: number }) => (
    `${en ? verdictEn(entry.verdict) : entry.verdict} ${tenthsText(entry.confidenceTenths, lang)}`
  );
  const noteText = (note: string) => en && /\p{Script=Han}/u.test(note)
    ? t("chart.noteTranslationPending") : note;
  const plotTop = (value: number) => LABEL_BAND + value / 100 * (194 - LABEL_BAND);
  const yp = (y: number) => (y - CHART.top) / (CHART.bottom - CHART.top) * 100;
  const position = (index: number) => `${(index + 0.5) / cycles.length * 100}%`;
  useEffect(() => {
    if (window.matchMedia("(min-width: 1061px)").matches) return;
    const cell = cells.current.get(selected);
    const container = scroll.current;
    if (cell && container) {
      container.scrollLeft = Math.max(0, cell.offsetLeft - 76 - (container.clientWidth - 166) / 2);
    }
  }, [selected]);
  useEffect(() => {
    setFeedbackSaved(false);
    setFeedbackError("");
  }, [selected]);
  const setFeedback = async (vote: PeriodVote) => {
    setFeedbackBusy(true);
    setFeedbackSaved(false);
    setFeedbackError("");
    try {
      const updated = await api.setPeriodFeedback(
        reading.id, selected, nextPeriodVote(selectedVote, vote),
      );
      if (updated.kind === "destiny") onReading?.(updated);
      setFeedbackSaved(true);
    } catch (caught) {
      setFeedbackError(apiErrorMessage(caught, t));
    } finally {
      setFeedbackBusy(false);
    }
  };
  const rows: Array<{
    id: string;
    label: string;
    school?: typeof BAZI_KEYS[number];
    className?: string;
    render(index: number): React.ReactNode;
  }> = [
    { id: "cycle", label: t("chart.life.rowCycle"), className: "gz",
      render: (index) => gz(cycles[index]!.ganZhi) },
    { id: "years", label: t("chart.life.rowYears"),
      render: (index) => `${cycles[index]!.startYear}–${cycles[index]!.endYear}` },
    { id: "god", label: t("bazi.stemGod"), render: (index) => god(cycles[index]!.stemGod) },
    ...BAZI_KEYS.map((key) => ({
      id: key, label: schoolName(key), school: key, className: "v",
      render: (index: number) => {
        const entry = schoolPeriod(reading, key, cycles[index]!.index);
        return entry ? verdictText(entry) : yearGapLabel(reading.schools[key].status, lang);
      },
    })),
    { id: "avg", label: t("chart.life.rowConsensus"),
      render: (index) => reading.periods[index]
        ? consensusText(reading.periods[index]!.average, lang) : "—" },
  ];
  return <section aria-label={t("chart.life.title")} className="panel liunian-panel life-luck-panel">
    <header className="panel-head"><h2>{t("chart.life.title")}</h2>
      {!readonly && feedbackTotal > 0 ? <span className="life-feedback-summary">{t(
        "chart.life.feedbackSummary", { count: feedbackTotal, accurate, inaccurate },
      )}</span> : null}
      {writing ? <span className="chart-writing">{t("chart.writing", { count: written })}</span> : null}<p>
      {luck.direction === "forward" ? t("bazi.forward") : t("bazi.backward")}{" · "}
      {t("chart.luck.start", {
        years: luck.start.years, months: luck.start.months, days: luck.start.days,
        date: luck.start.solarDate,
      })}{luck.approximate ? t("chart.luck.approximate") : ""}
    </p></header>
    <div className="ln-grid">
      <div className="ln-chart"><div className="ln-y">
        {[1, 3, 5, 7, 9].map((value) => <span
          style={{ top: `${plotTop((9 - value) / 8 * 100)}px` }} key={value}>
          {tenthsText(value, lang)}</span>)}
      </div><div className="ln-plot" role="img" aria-label={t("chart.life.plotAria")}>
        {[3, 5, 7].map((value) => <i className={value === 5 ? "ln-ref" : "ln-grid-y"}
          style={{ top: `${plotTop((9 - value) / 8 * 100)}px` }} key={value} />)}
        {cycles.map((cycle, index) => <div key={cycle.index}>
          {cycle.index === currentIndex ? <i className="ln-now luck-current"
            style={{ left: `${index / cycles.length * 100}%`, width: `${100 / cycles.length}%` }} /> : null}
          {geometry.points[index] ? <><i className="ln-range" style={{
            left: position(index), top: `${plotTop(yp(geometry.points[index]!.high))}px`,
            height: `${(yp(geometry.points[index]!.low) - yp(geometry.points[index]!.high))
              / 100 * (194 - LABEL_BAND)}px`,
          }} /><i className={`ln-dot ${cycle.index === currentIndex ? "now" : ""}`} style={{
            left: position(index), top: `${plotTop(yp(geometry.points[index]!.y))}px`,
          }} />
            {labels[index]?.length ? <span className="ln-lab" style={{
              left: position(index),
              top: `${Math.max(LABEL_BAND, plotTop(yp(geometry.points[index]!.y)) - 27)}px`,
            }}>{labels[index]!.map((label) => <span
              // 窄屏八列太挤：只留「当前」，最顺、最低见下方逐运表。
              className={label === "当前" ? undefined : "wide-only"} key={label}>{t(LABEL_KEYS[label])} {reading.periods[index]
              ? consensusText(reading.periods[index]!.average, lang) : "—"}<br /></span>)}</span> : null}
          </> : null}
          <div className={`ln-hit ${selected === cycle.index ? "sel" : ""}`}
            style={{ left: `${index / cycles.length * 100}%`, width: `${100 / cycles.length}%` }}
            onClick={() => setSelected(cycle.index)} onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)} />
        </div>)}
        <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">
          {geometry.paths.map((path, index) => <path className="ln-line" d={path}
            transform={`translate(${-CHART.left * CHART.width / (CHART.width - CHART.left)},${
              -CHART.top * CHART.height / (CHART.bottom - CHART.top)}) scale(${
              CHART.width / (CHART.width - CHART.left)},${
              CHART.height / (CHART.bottom - CHART.top)})`}
            vectorEffect="non-scaling-stroke" key={index} />)}
        </svg>
        {hovered ? <div className="ln-tip" style={{
          left: `${Math.max(26, Math.min(74, (hover! + 0.5) / cycles.length * 100))}%`, top: "50%",
        }}><b>{gz(hovered.ganZhi)} · {t("chart.life.ages", {
            from: hovered.startAge, to: hovered.endAge,
          })}</b><br />{hoverConsensus
            ? `${consensusText(hoverConsensus.average, lang)} · ${tenthsText(hoverConsensus.min, lang)}–${
              tenthsText(hoverConsensus.max, lang)}` : t("chart.life.notShown")}</div> : null}
      </div><div className="ln-x" style={{ gridTemplateColumns: `repeat(${cycles.length},minmax(0,1fr))` }}>
        {cycles.map((cycle) => <span className={cycle.index === currentIndex ? "now" : ""}
          key={cycle.index}>{gz(cycle.ganZhi)}
          {/* 窄屏每列只有约 40px：只留起始年龄，年龄段与年份见下方逐运表。 */}
          <small className="wide-only">{t("chart.life.ages", { from: cycle.startAge, to: cycle.endAge })}</small>
          <small className="wide-only">{cycle.startYear}–{cycle.endYear}</small>
          <small className="narrow-only">{t("chart.life.fromAge", { age: cycle.startAge })}</small></span>)}
      </div></div>
      <div className="ln-key"><span><i className="k-line" />{t(writing
        ? "chart.keyWrittenAverage" : "chart.life.keyLine")}</span>
        <span><i className="k-range" />{t("chart.life.keyRange")}</span>
        <span><i className="k-ref" />{t("chart.life.keyRef")}</span></div>
      <div className="ln-scroll" ref={scroll} tabIndex={0} aria-label={t("chart.life.tableAria")}>
        <table className="ln-table"><colgroup><col className="ln-axis" />
          {cycles.map((cycle) => <col key={cycle.index} />)}</colgroup><thead>
          <tr className="ln-span"><th></th>{cycleGroups(cycles, currentIndex).map((group) => (
            <th scope="colgroup" colSpan={group.count} key={group.label}>{t(GROUP_KEYS[group.label])}</th>
          ))}</tr><tr><th>{t("chart.life.rowAges")}</th>{cycles.map((cycle) => <th
            className={cycle.index === currentIndex ? "now" : ""} key={cycle.index}
            ref={(cell) => { if (cell) cells.current.set(cycle.index, cell); }}>
            <button aria-pressed={selected === cycle.index}
              className={`ln-year ${selected === cycle.index ? "sel" : ""}`}
              onClick={() => setSelected(cycle.index)} type="button">
              {t("chart.life.ages", { from: cycle.startAge, to: cycle.endAge })}</button>
          </th>)}</tr></thead><tbody>{rows.map((row) => <tr
            className={row.id === "avg" ? "avg" : ""} key={row.id}><th scope="row">{row.label}</th>
            {cycles.map((cycle, index) => {
              const entry = row.school ? schoolPeriod(reading, row.school, cycle.index) : undefined;
              return <td className={[
                cycle.index === currentIndex ? "now" : "", row.className ?? "",
                entry?.verdict.includes("吉") ? "ji" : entry?.verdict.includes("凶") ? "xiong" : "",
              ].join(" ")} key={cycle.index}>{row.render(index)}</td>;
            })}</tr>)}</tbody></table>
      </div>
      <div className="ln-detail"><div className="ln-detail-head">
        <span>{t("bazi.consensus", {
          value: selectedConsensus ? consensusText(selectedConsensus.average, lang) : "—",
        })}</span><b>{gz(active.ganZhi)}</b><span>{t("chart.life.ages", {
          from: active.startAge, to: active.endAge,
        })} · {active.startYear}–{active.endYear} · {god(active.stemGod)}</span>
      </div><div className="ln-detail-rows">{BAZI_KEYS.map((key) => {
        const entry = schoolPeriod(reading, key, selected);
        const gap = yearGapLabel(reading.schools[key].status, lang);
        return <div key={key}><span className="seal">{schoolName(key).slice(0, 1)}</span>
          <strong className={entry?.verdict.includes("吉") ? "ji"
            : entry?.verdict.includes("凶") ? "xiong" : ""}>
            {entry ? verdictText(entry) : gap}<small>{schoolName(key)}</small></strong>
          <p>{entry ? (entry.note ? noteText(entry.note) : t("chart.life.noteRemoved")) : gap}</p></div>;
      })}</div>{!readonly ? <div className="life-period-actions">
        {active.startYear <= currentYear ? <div className="period-feedback">
          <span>{t("chart.life.feedbackPrompt")}</span>
          <button aria-pressed={selectedVote === "accurate"} disabled={feedbackBusy}
            onClick={() => void setFeedback("accurate")} type="button">{t("chart.life.accurate")}</button>
          <button aria-pressed={selectedVote === "inaccurate"} disabled={feedbackBusy}
            onClick={() => void setFeedback("inaccurate")} type="button">{t("chart.life.inaccurate")}</button>
          {feedbackSaved ? <small>{t("chart.life.feedbackSaved")}</small> : null}
          {feedbackError ? <small className="error">{feedbackError}</small> : null}
        </div> : null}
        {fortuneHref ? <a className="period-fortune-link" href={fortuneHref}>
          {t("chart.life.fortuneLink")}</a> : null}
      </div> : null}</div>
    </div>
  </section>;
}
