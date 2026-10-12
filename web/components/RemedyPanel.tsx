// web/components/RemedyPanel.tsx
import type { AnyPublicReading } from "../lib/api.js";
import { useT } from "../lib/i18n.js";

/** 白话总述之后的解法：心法（原文或三家取用）、怎么做、别做什么；旧存档与生成中不显示。 */
export function RemedyPanel(props: { reading: AnyPublicReading }) {
  const t = useT();
  if (props.reading.kind === "naming") {
    return null;
  }
  const summary = props.reading.summary;
  const remedy = summary?.status === "done" ? summary.output?.remedy : undefined;
  if (!summary || !remedy) {
    return null;
  }
  return (
    <section aria-label={t("remedy.title")} className="panel remedy">
      <header className="panel-head">
        <h2>{t("remedy.title")}</h2>
      </header>
      <div className="remedy-part">
        <h3>{t("remedy.principle")}</h3>
        {summary.anchor ? (
          <blockquote className="remedy-anchor">
            <cite>{summary.anchor.title}</cite>
            {summary.anchor.lines.map((line) => <p key={line}>{line}</p>)}
          </blockquote>
        ) : null}
        <p className="remedy-principle">{remedy.principle}</p>
      </div>
      <div className="remedy-part">
        <h3>{t("remedy.actions")}</h3>
        <ol className="remedy-plan">
          {remedy.plan.map((step) => (
            <li key={step.action}>
              <b>{step.action}</b>
              <span>{t("remedy.basis", { basis: step.basis })}</span>
              {step.timing ? <span>{t("remedy.timing", { timing: step.timing })}</span> : null}
            </li>
          ))}
        </ol>
      </div>
      <div className="remedy-part">
        <h3>{t("remedy.avoid")}</h3>
        <ul className="remedy-avoid">{remedy.avoid.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </section>
  );
}
