import { useState } from "react";
import type { FortuneSchoolOutput } from "../../src/sanyi/bazi-schema.js";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { BAZI_KEYS } from "../lib/liunian-chart.js";
import { api } from "../lib/api.js";
import {
  confidenceEn, elementEn, schoolEn, stemBranchEn, tenGodEn, verdictEn,
} from "../lib/result-format.js";
import { useT } from "../lib/i18n.js";
import type { TFunction } from "../lib/i18n.js";
import { AlmanacPanel } from "./AlmanacPanel.js";
import { BaziTable } from "./BaziTable.js";
import { EnglishRemedy, EnglishSchoolArticle, EnglishSummary } from "./EnglishReadingSections.js";

const PILLARS = ["year", "month", "day", "time"] as const;
const SECTION_TITLE_KEYS = {
  性格: "bazi.section.character", 事业: "bazi.section.career", 财运: "bazi.section.wealth",
  感情: "bazi.section.relationships", 健康: "bazi.section.wellbeing",
  用神: "bazi.section.keyFactor", 世应: "bazi.section.selfOther", 动变: "bazi.section.change",
  时势: "bazi.section.timing", 建议: "bazi.section.advice",
} as const;

function safeSectionTitle(value: string, index: number, t: TFunction): string {
  const key = SECTION_TITLE_KEYS[value as keyof typeof SECTION_TITLE_KEYS];
  return key ? t(key) : (/\p{Script=Han}/u.test(value)
    ? t("bazi.section.detail", { index: index + 1 }) : value);
}

function EnglishBaziSchool(props: {
  reading: PublicBaziReading;
  schoolKey: typeof BAZI_KEYS[number];
  onRetry(): void;
}) {
  const t = useT();
  const state = props.reading.schools[props.schoolKey];
  const output = state.status === "done" ? state.output : undefined;
  const sanitized = output ? {
    ...output,
    sections: output.sections.map((section, index) => ({
      ...section, title: safeSectionTitle(section.title, index, t),
    })),
  } : undefined;
  const visibleState = sanitized
    ? { status: state.status, retries: state.retries,
      output: sanitized as unknown as Record<string, unknown> }
    : { status: state.status, retries: state.retries };
  return <EnglishSchoolArticle schoolKey={props.schoolKey} onRetry={props.onRetry}
    state={visibleState}>
    {output ? <p className="use-god"><b>{t("bazi.yongShen", { value: output.useGod })}</b></p> : null}
  </EnglishSchoolArticle>;
}

export function EnglishBaziReading(props: {
  reading: PublicBaziReading;
  onReading(value: PublicBaziReading): void;
}) {
  const t = useT();
  const [error, setError] = useState("");
  const { reading } = props;
  const retry = async (key: typeof BAZI_KEYS[number]) => {
    try {
      const value = await api.retrySchool(reading.id, key);
      if (value.kind === "destiny" || value.kind === "fortune") props.onReading(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("result.tryLater"));
    }
  };
  const labels = {
    year: t("bazi.year"), month: t("bazi.month"), day: t("bazi.day"), time: t("bazi.time"),
  };
  return <div className="bazi" data-reading={reading.id}>
    <EnglishSummary reading={reading} />
    <EnglishRemedy reading={reading} />
    <details className="panel schools-fold"><summary>{t("schools.title")}
      <span>{t("schools.baziIntro")}</span></summary>
      {reading.kind === "fortune" && reading.consensusTenths !== null
        ? <p>{t("bazi.consensus", { value: confidenceEn(reading.consensusTenths) })}</p> : null}
      {BAZI_KEYS.map((key) => <EnglishBaziSchool key={key} reading={reading} schoolKey={key}
        onRetry={() => void retry(key)} />)}
    </details>
    <section className="panel"><div className="ask"><span className="label">
      {reading.kind === "fortune" ? t("bazi.kindFortune") : t("bazi.kindDestiny")} · {t("bazi.title")}
    </span><p>{reading.question}</p></div>
      <div className="pillars-scroll"><table className="pillars"><thead><tr><th></th>
        {PILLARS.map((key) => <th key={key}>{labels[key]}</th>)}</tr></thead><tbody>
        <tr><td className="rowlabel">{t("question.stemBranch")}</td>{PILLARS.map((key) => {
          const pillar = reading.chart.pillars[key];
          return <td key={key}>{pillar ? stemBranchEn(pillar.ganZhi) : t("bazi.missing")}</td>;
        })}</tr>
        <tr><td className="rowlabel">{t("bazi.stemGod")}</td>{PILLARS.map((key) => {
          const pillar = reading.chart.pillars[key];
          return <td key={key}>{pillar ? tenGodEn(pillar.stemGod) : t("bazi.missing")}</td>;
        })}</tr>
        <tr><td className="rowlabel">{t("bazi.hidden")}</td>{PILLARS.map((key) => {
          const pillar = reading.chart.pillars[key];
          return <td key={key}>{pillar ? pillar.hidden.map((item) => (
            `${stemBranchEn(item.stem)} ${tenGodEn(item.god)}`
          )).join("; ") : t("bazi.missing")}</td>;
        })}</tr>
      </tbody></table></div>
    </section>
    <section className="panel"><header className="panel-head"><h2>{t("bazi.elements")}</h2></header>
      <div className="elements">{reading.analysis.elements.map((item) => <div className="el-row" key={item.element}>
        <b>{elementEn(item.element)}</b><span>{t("bazi.count", { count: item.total })}</span>
      </div>)}</div>
    </section>
    <section className="panel"><header className="panel-head"><h2>{t("bazi.luck")}</h2></header>
      {reading.chart.luck ? <><p>{reading.chart.luck.direction === "forward"
        ? t("bazi.forward") : t("bazi.backward")} · {t("bazi.luckStart", {
        years: reading.chart.luck.start.years, months: reading.chart.luck.start.months,
        days: reading.chart.luck.start.days, date: reading.chart.luck.start.solarDate,
      })}{reading.chart.luck.approximate ? ` · ${t("bazi.approximate")}` : ""}</p>
        <div className="luck">{reading.chart.luck.cycles.map((cycle) => <div key={cycle.index}>
          <b>{stemBranchEn(cycle.ganZhi)}</b><small>{tenGodEn(cycle.stemGod)}<br />
            {cycle.startAge}–{cycle.endAge}<br />{cycle.startYear}–{cycle.endYear}</small>
        </div>)}</div></> : <p>{t("bazi.missing")}</p>}
    </section>
    {reading.kind === "fortune" ? <section className="panel liunian-panel">
      <header className="panel-head"><h2>{t("bazi.annual")}</h2></header>
      <div className="ln-scroll"><table className="ln-table"><thead><tr><th>{t("bazi.tableYear")}</th>
        <th>{t("bazi.tablePillar")}</th>
        {BAZI_KEYS.map((key) => <th key={key}>{schoolEn(key).name}</th>)}</tr></thead><tbody>
        {reading.chart.liunian.years.map((year) => <tr key={year.year}><th>{year.year}<small>
          {t("bazi.age", { age: year.age })}</small></th><td>{stemBranchEn(year.ganZhi)}<br />
          {tenGodEn(year.stemGod)}</td>{BAZI_KEYS.map((key) => {
          const output = reading.schools[key].output;
          const entry = output && "years" in output
            ? (output as FortuneSchoolOutput).years.find((item) => item.year === year.year) : undefined;
          return <td key={key}>{entry ? <>{verdictEn(entry.verdict)} · {confidenceEn(entry.confidenceTenths)}
            <br />{entry.note}</> : "—"}</td>;
        })}</tr>)}</tbody></table></div>
    </section> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
    <details className="panel traditional-chart"><summary>{t("traditional.title")}</summary>
      <BaziTable chart={reading.chart} analysis={reading.analysis} />
      {reading.almanac ? <AlmanacPanel value={reading.almanac} /> : null}
    </details>
    <p className="provenance">{t("bazi.provenance")}</p>
  </div>;
}
