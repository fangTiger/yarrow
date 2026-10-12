import { useState } from "react";
import type { PublicNamingReading } from "../../src/sanyi/naming/public.js";
import { schoolEn } from "../lib/result-format.js";
import { api } from "../lib/api.js";
import { useT } from "../lib/i18n.js";
import { EnglishNameCard } from "./EnglishNameCard.js";
import { EnglishWuxingPanel } from "./EnglishWuxingPanel.js";

const FAMILY_KEYS = ["wuxing", "shiwen", "yinyi"] as const;

export function EnglishNamingReading(props: {
  reading: PublicNamingReading;
  onReading(value: PublicNamingReading): void;
}) {
  const t = useT();
  const [error, setError] = useState("");
  const reading = props.reading;
  const length = reading.length === 1 ? t("naming.single") : t("naming.double");
  const gender = t(`naming.gender.${reading.gender}` as Parameters<typeof t>[0]);
  const subject = reading.target === "business"
    ? t("naming.subjectBusiness", { length: reading.length })
    : t("naming.subjectPerson", { surname: reading.surname ?? "", length, gender,
      unborn: reading.unborn ? t("naming.unbornSuffix") : "" });
  const retry = async (key: typeof FAMILY_KEYS[number]) => {
    try {
      const value = await api.retrySchool(reading.id, key);
      if (value.kind === "naming") props.onReading(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("result.tryLater"));
    }
  };
  return <div className="naming-reading" data-reading={reading.id}>
    <section className="panel naming-hero"><span className="label">{subject}</span>
      <h1>{t("naming.request")}</h1><p>{reading.question}</p></section>
    <EnglishWuxingPanel reading={reading} />
    {reading.summary?.status === "done" && reading.summary.output ? <section
      aria-label={t("naming.summary")} className="panel naming-summary">
      <header className="panel-head"><h2>{t("naming.summary")}</h2><p>{t("naming.summaryIntro")}</p></header>
      <div className="summary-names">{reading.summary.output.picks.map((pick) => <article
        className="summary-name" key={pick.given}><h3>{pick.full}</h3><p className="name-pinyin">{pick.pinyin}</p>
        <p>{pick.reason}</p></article>)}</div><p>{reading.summary.output.overview}</p>
      <ul>{reading.summary.output.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
    </section> : null}
    {error ? <p className="error" role="alert">{error}</p> : null}
    {FAMILY_KEYS.map((key) => {
      const family = reading.families[key];
      const meta = schoolEn(key);
      return <section className="panel naming-family" key={key}><header className="panel-head">
        <h2>{meta.name}</h2><p>{family.output?.note ?? (family.status === "writing"
          ? t("schools.pending") : t("schools.failed"))}</p></header>
        {family.output?.names.map((name) => <EnglishNameCard familyKey={key} key={name.given} name={name} />)}
        {family.status === "failed" ? <button className="button" type="button" onClick={() => void retry(key)}>
          {t("schools.retry", { count: Math.max(0, 2 - family.retries) })}</button> : null}
      </section>;
    })}
    <section className="panel naming-basis"><header className="panel-head"><h2>{t("naming.basis")}</h2></header>
      <p>{t("naming.disclaimer")}</p></section>
  </div>;
}
