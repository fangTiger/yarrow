import type { PublicNamingReading } from "../../src/sanyi/naming/public.js";
import { VIRTUES_EN } from "../../src/sanyi/i18n/glossary.js";
import { elementEn, stemBranchEn } from "../lib/result-format.js";
import { useT } from "../lib/i18n.js";
import { WuxingDiagram, wuxingRelations } from "./WuxingDiagram.js";

const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
const STEM_ELEMENTS: Readonly<Record<string, (typeof ELEMENTS)[number]>> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

function fallbackNote(reading: PublicNamingReading, t: ReturnType<typeof useT>): string {
  const favorable = (reading.basis.favorable ?? []).map(elementEn).join(" and ");
  if (reading.basis.favorableSource === "industry") {
    return t("wuxing.fallback.industry", { elements: favorable });
  }
  if (reading.basis.favorableSource === "tiaohou") {
    return t("wuxing.fallback.tiaohou", { elements: favorable });
  }
  if (reading.basis.favorableSource === "missing") {
    return t("wuxing.fallback.missing", { elements: favorable });
  }
  return t("wuxing.fallback.default", { elements: favorable });
}

export function EnglishWuxingPanel({ reading }: { reading: PublicNamingReading }) {
  const t = useT();
  const { basis } = reading;
  const counts = basis.counts as Partial<Record<(typeof ELEMENTS)[number], number>> | undefined;
  const max = counts ? Math.max(1, ...ELEMENTS.map((element) => counts[element] ?? 0)) : 1;
  const favorable = basis.favorable ?? [];
  const missing = basis.missing ?? [];
  const note = basis.favorableNote && !/\p{Script=Han}/u.test(basis.favorableNote)
    ? basis.favorableNote : fallbackNote(reading, t);
  const dayStem = (basis.tiaohou as { dayStem?: string } | null | undefined)?.dayStem;
  const dayMaster = dayStem ? STEM_ELEMENTS[dayStem] : undefined;
  const hidden = basis.hiddenCounts as Partial<Record<(typeof ELEMENTS)[number], number>> | undefined;
  return <section aria-label={t("wuxing.title")} className="panel wuxing-panel">
    <header className="panel-head"><h2>{t("wuxing.title")}</h2><p>{reading.target === "business" && !basis.pillars
      ? t("wuxing.businessIntro") : t("wuxing.birthIntro")}</p></header>
    <div className="wuxing-body"><WuxingDiagram counts={counts} favorable={favorable}
      missing={missing} {...(dayMaster ? { dayMaster } : {})} />
      <div className="wuxing-side">{counts ? <div className="wuxing-bars">{ELEMENTS.map((element) => <div
        className="wuxing-row" data-element={elementEn(element)} key={element}>
        <span className="wuxing-name">{elementEn(element)}</span>
        <span aria-hidden="true" className="wuxing-track"><span className="wuxing-fill"
          style={{ width: `${(counts[element] ?? 0) / max * 100}%` }} /></span>
        <strong>{counts[element] ?? 0}</strong>
        <span className="wuxing-marks">{missing.includes(element) ? <em>{t("wuxing.missing")}</em> : null}
          {favorable.includes(element) ? <b>{t("wuxing.supplement")}</b> : null}</span></div>)}</div> : null}
        <p className="wuxing-conclusion">{note}</p><div className="wuxing-virtues">
          {favorable.map((element) => <p key={element}>{VIRTUES_EN[element]}</p>)}</div>
        {favorable.length ? <div className="wuxing-relations">{wuxingRelations(favorable, "en", t)
          .map((line) => <p key={line}>{line}</p>)}</div> : null}
      </div></div>
    <div className="wuxing-fineprint">{hidden ? <p>{t("wuxing.hidden", { counts: ELEMENTS.map((element) => (
      `${elementEn(element)} ${hidden[element] ?? 0}`
    )).join(" · ") })}</p> : null}{reading.unborn ? <p>{t("wuxing.unborn")}</p> : null}
      {counts ? <p>{t("wuxing.note")}</p> : null}</div>
  </section>;
}
