import type { PublicNamingReading } from "../../src/sanyi/naming/public.js";
import { VIRTUES_ZH } from "../../src/sanyi/i18n/glossary.js";
import { useT, type TFunction } from "../lib/i18n.js";
import { WuxingDiagram, wuxingRelations } from "./WuxingDiagram.js";

const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
const STEM_ELEMENTS: Readonly<Record<string, (typeof ELEMENTS)[number]>> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

function fallbackNote(basis: PublicNamingReading["basis"], t: TFunction): string {
  if (basis.favorableSource === "missing") return t("wuxing.source.missing");
  if (basis.favorableSource === "tiaohou") return t("wuxing.source.tiaohou");
  if (basis.favorableSource === "industry") return t("wuxing.source.industry");
  return t("wuxing.source.default");
}

export function WuxingPanel({ reading }: { reading: PublicNamingReading }) {
  const t = useT();
  const { basis } = reading;
  const note = basis.favorableNote ?? fallbackNote(basis, t);
  const counts = basis.counts as Partial<Record<(typeof ELEMENTS)[number], number>> | undefined;
  const favorable = basis.favorable ?? [];
  const noBirthBusiness = reading.target === "business" && !basis.pillars;
  if (noBirthBusiness) {
    return (
      <section aria-label={t("wuxing.title")} className="panel wuxing-panel">
        <header className="panel-head"><h2>{t("wuxing.title")}</h2>
          <p>{t("wuxing.businessIntro")}</p></header>
        <div className="wuxing-body">
          <WuxingDiagram counts={undefined} favorable={favorable} missing={[]} />
          <div className="wuxing-side">
            <p className="wuxing-conclusion">{note}</p>
            <div className="wuxing-virtues">
              {favorable.map((element) => <p key={element}>{VIRTUES_ZH[element]}</p>)}
            </div>
          </div>
        </div>
      </section>
    );
  }
  const hasCounts = counts !== undefined;
  const max = hasCounts ? Math.max(1, ...ELEMENTS.map((element) => counts[element] ?? 0)) : 1;
  const dayStem = (basis.tiaohou as { dayStem?: string } | null | undefined)?.dayStem;
  const dayMaster = dayStem ? STEM_ELEMENTS[dayStem] : undefined;
  const hidden = basis.hiddenCounts as Partial<Record<(typeof ELEMENTS)[number], number>> | undefined;
  return (
    <section aria-label={t("wuxing.title")} className="panel wuxing-panel">
      <header className="panel-head"><h2>{t("wuxing.title")}</h2><p>{t("wuxing.birthIntro")}</p></header>
      <div className="wuxing-body">
        {hasCounts ? (
          <WuxingDiagram
            counts={counts}
            favorable={favorable}
            missing={basis.missing ?? []}
            {...(dayMaster ? { dayMaster } : {})}
          />
        ) : null}
        <div className="wuxing-side">
          {hasCounts ? (
            <div className="wuxing-bars">
              {ELEMENTS.map((element) => {
                const count = counts[element] ?? 0;
                const missing = basis.missing?.includes(element) || count === 0;
                const supplement = favorable.includes(element);
                return (
                  <div className="wuxing-row" data-element={element} key={element}>
                    <span className="wuxing-name">{element}</span>
                    <span className="wuxing-track" aria-hidden="true">
                      <span className="wuxing-fill" style={{ width: `${count / max * 100}%` }} />
                    </span>
                    <strong>{count}</strong>
                    <span className="wuxing-marks">
                      {missing ? <em>{t("wuxing.missing")}</em> : null}
                      {supplement ? <b>{t("wuxing.supplement")}</b> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <p className="wuxing-conclusion">{note}</p>
          {hasCounts ? (
            <div className="wuxing-virtues">
              {favorable.map((element) => <p key={element}>{VIRTUES_ZH[element]}</p>)}
            </div>
          ) : null}
          {hasCounts && favorable.length ? (
            <div className="wuxing-relations">
              {wuxingRelations(favorable).map((line) => <p key={line}>{line}</p>)}
            </div>
          ) : null}
        </div>
      </div>
      <div className="wuxing-fineprint">
        {hidden ? (
          <p>{t("wuxing.hidden", { counts: ELEMENTS.map((element) => (
            `${element} ${hidden[element] ?? 0}`
          )).join(" · ") })}</p>
        ) : null}
        {reading.unborn ? <p>{t("wuxing.unborn")}</p> : null}
        {hasCounts ? <p>{t("wuxing.note")}</p> : null}
      </div>
    </section>
  );
}
