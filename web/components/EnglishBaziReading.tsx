import { useState } from "react";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { BAZI_KEYS, readingNow } from "../lib/liunian-chart.js";
import { api } from "../lib/api.js";
import { confidenceEn, stemBranchEn, tenGodEn } from "../lib/result-format.js";
import { useT } from "../lib/i18n.js";
import type { TFunction } from "../lib/i18n.js";
import { AlmanacPanel } from "./AlmanacPanel.js";
import { BaziElements } from "./BaziElements.js";
import { BaziLuck } from "./BaziLuck.js";
import { BaziRelations } from "./BaziRelations.js";
import { BaziTable } from "./BaziTable.js";
import { LiuNianPanel } from "./LiuNianPanel.js";
import { EnglishRemedy, EnglishSchoolArticle, EnglishSummary } from "./EnglishReadingSections.js";
import { DestinyPortrait, DestinyPortraitPending } from "./DestinyPortrait.js";
import { LifeLuckPanel } from "./LifeLuckPanel.js";
import { shouldShowLifeLuck } from "../lib/life-luck.js";

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
  readonly?: boolean | undefined;
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
    readonly={props.readonly} state={visibleState}>
    {output ? <p className="use-god"><b>{t("bazi.yongShen", { value: output.useGod })}</b></p> : null}
  </EnglishSchoolArticle>;
}

export function EnglishBaziReading(props: {
  reading: PublicBaziReading;
  onReading(value: PublicBaziReading): void;
  readonly?: boolean | undefined;
}) {
  const t = useT();
  const [error, setError] = useState("");
  const { reading } = props;
  const { currentYear, currentDate } = readingNow(reading);
  const destiny = reading.kind === "destiny" ? reading : null;
  const portrait = destiny?.summary?.status === "done" ? destiny.summary.output?.portrait : undefined;
  const showLifeLuck = Boolean(destiny && shouldShowLifeLuck(destiny));
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
    {/* 命理：性格画像与一生运势置顶；旧存档缺哪块就跳过哪块。 */}
    {portrait ? <DestinyPortrait portrait={portrait} />
      : showLifeLuck ? <DestinyPortraitPending /> : null}
    {showLifeLuck && destiny ? <LifeLuckPanel currentDate={currentDate} onReading={props.onReading}
      reading={destiny} readonly={props.readonly} /> : null}
    <EnglishSummary reading={reading} />
    <EnglishRemedy reading={reading} />
    <details className="panel schools-fold"><summary>{t("schools.title")}
      <span>{t("schools.baziIntro")}</span></summary>
      {reading.kind === "fortune" && reading.consensusTenths !== null
        ? <p>{t("bazi.consensus", { value: confidenceEn(reading.consensusTenths) })}</p> : null}
      {BAZI_KEYS.map((key) => <EnglishBaziSchool key={key} reading={reading} schoolKey={key}
        onRetry={() => void retry(key)} readonly={props.readonly} />)}
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
    {/* 图表与中文页共用同一套组件，英文只换文字。 */}
    {/* 一生运势已含大运；没有一生运势时（运势页、旧命理存档）大运时间轴留在原位。 */}
    {showLifeLuck ? null : <BaziLuck chart={reading.chart} currentYear={currentYear} currentDate={currentDate} />}
    {reading.kind === "fortune" ? <LiuNianPanel reading={reading} currentYear={currentYear} /> : null}
    <div className="row2"><BaziRelations analysis={reading.analysis} />
      <BaziElements elements={reading.analysis.elements} /></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <details className="panel traditional-chart"><summary>{t("traditional.title")}</summary>
      <BaziTable chart={reading.chart} analysis={reading.analysis} />
      {reading.almanac ? <AlmanacPanel value={reading.almanac} /> : null}
    </details>
    <p className="provenance">{t("bazi.provenance")}</p>
  </div>;
}
