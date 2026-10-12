import type { ReactNode } from "react";
import type { AnyPublicReading } from "../lib/api.js";
import { confidenceEn, schoolEn, verdictEn } from "../lib/result-format.js";
import { useT } from "../lib/i18n.js";
import { summaryStatus } from "../lib/reading-state.js";

type InterpretedReading = Exclude<AnyPublicReading, { kind: "naming" }>;

export function EnglishSummary({ reading }: { reading: InterpretedReading }) {
  const t = useT();
  const summary = reading.summary;
  const status = summaryStatus(reading, t);
  if (status.kind === "progress") {
    return <section aria-live="polite" className="panel plain-summary pending">
      <h2>{t("summary.title")}</h2><p>{status.text}</p>
    </section>;
  }
  if (!summary || summary.status !== "done" || !summary.output) return null;
  const output = summary.output;
  return (
    <section aria-label={t("summary.title")} className="panel plain-summary">
      <header className="panel-head"><h2>{t("summary.title")}</h2>
        <p>{t("summary.question", { question: reading.question })}</p></header>
      <div className="summary-conclusion"><p>{output.conclusion}</p></div>
      <dl className="summary-points">
        <div><dt>{t("summary.agreement")}</dt><dd>{output.agreement}</dd></div>
        {output.difference ? <div><dt>{t("summary.difference")}</dt>
          <dd>{output.difference}</dd></div> : null}
      </dl>
      <div className="summary-explain">
        {output.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      {output.advice?.length ? <div className="summary-advice"><h3>{t("summary.advice")}</h3>
        <ol>{output.advice.map((item) => <li key={item}>{item}</li>)}</ol></div> : null}
      {output.watch ? <p className="summary-watch"><b>{t("summary.watch")}</b>
        {output.watch.window} ({output.watch.condition})</p> : null}
      {output.outlook ? <p className="summary-outlook"><b>{t("summary.outlook")}</b>
        {output.outlook}</p> : null}
      <p className="hint">{t("summary.basis", { count: summary.basis })}</p>
    </section>
  );
}

export function EnglishRemedy({ reading }: { reading: InterpretedReading }) {
  const t = useT();
  const summary = reading.summary;
  const remedy = summary?.status === "done" ? summary.output?.remedy : undefined;
  if (!remedy) return null;
  return (
    <section aria-label={t("remedy.title")} className="panel remedy">
      <header className="panel-head"><h2>{t("remedy.title")}</h2></header>
      <div className="remedy-part"><h3>{t("remedy.principle")}</h3>
        <p className="remedy-principle">{remedy.principle}</p></div>
      {remedy.plan.length ? <div className="remedy-part"><h3>{t("remedy.actions")}</h3>
        <ol className="remedy-plan">{remedy.plan.map((step) => <li key={step.action}>
          <b>{step.action}</b><span>{t("remedy.basis", { basis: step.basis })}</span>
          {step.timing ? <span>{t("remedy.timing", { timing: step.timing })}</span> : null}
        </li>)}</ol></div> : null}
      {remedy.avoid.length ? <div className="remedy-part"><h3>{t("remedy.avoid")}</h3>
        <ul className="remedy-avoid">{remedy.avoid.map((item) => <li key={item}>{item}</li>)}</ul>
      </div> : null}
    </section>
  );
}

export function EnglishSchoolArticle(props: {
  schoolKey: string;
  state: { status: string; retries: number; output?: Record<string, unknown> };
  onRetry(): void;
  readonly?: boolean | undefined;
  children?: ReactNode;
}) {
  const t = useT();
  const meta = schoolEn(props.schoolKey);
  const remaining = Math.max(0, 2 - props.state.retries);
  if (props.state.status !== "done" || !props.state.output) {
    const pending = props.state.status === "pending" || props.state.status === "writing";
    return <article className={`school-card ${pending ? "pending" : "failed"}`}>
      <div><h3>{meta.name}<small>{meta.school}</small></h3>
        <p>{pending ? t("schools.pending") : props.state.status === "rejected"
          ? t("schools.rejected") : t("schools.failed")}</p>
        {!pending && !props.readonly ? <button className="button" disabled={remaining === 0}
          onClick={props.onRetry} type="button">{remaining
            ? t("schools.retry", { count: remaining }) : t("schools.retryExhausted")}</button> : null}
      </div>
    </article>;
  }
  const output = props.state.output as {
    verdict?: string; confidenceTenths?: number; headline: string; reason: string;
    sections: Array<{ title: string; text: string }>;
    timing?: { window: string; condition: string }; advice: string[];
  };
  return <article className="school-card"><div className="school-copy">
    <h3>{meta.name}<small>{meta.school}</small></h3>
    <p className="school-verdict">{output.verdict ? `${verdictEn(output.verdict)} · ` : ""}
      {output.headline}{output.confidenceTenths !== undefined
        ? <small>{confidenceEn(output.confidenceTenths)}</small> : null}</p>
    <p className="school-reason">{output.reason}</p>
    {props.children}
    <details><summary>{t("schools.detail")}</summary>
      {output.sections.map((section) => <section key={section.title}>
        <h4>{section.title}</h4><p>{section.text}</p></section>)}
      {output.timing ? <p><b>{t("schools.timing")}</b>{output.timing.window}; {t("schools.condition")}
        {output.timing.condition}</p> : null}
      {output.advice.length ? <div><b>{t("schools.advice")}</b>
        <ul>{output.advice.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
    </details>
  </div></article>;
}
