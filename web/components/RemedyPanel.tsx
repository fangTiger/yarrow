// web/components/RemedyPanel.tsx
import type { AnyPublicReading } from "../lib/api.js";

/** 白话总述之后的解法：心法（原文或三家取用）、怎么做、别做什么；旧存档与生成中不显示。 */
export function RemedyPanel(props: { reading: AnyPublicReading }) {
  if (props.reading.kind === "naming") {
    return null;
  }
  const summary = props.reading.summary;
  const remedy = summary?.status === "done" ? summary.output?.remedy : undefined;
  if (!summary || !remedy) {
    return null;
  }
  return (
    <section aria-label="解法" className="panel remedy">
      <header className="panel-head">
        <h2>解法</h2>
      </header>
      <div className="remedy-part">
        <h3>心法</h3>
        {summary.anchor ? (
          <blockquote className="remedy-anchor">
            <cite>{summary.anchor.title}</cite>
            {summary.anchor.lines.map((line) => <p key={line}>{line}</p>)}
          </blockquote>
        ) : null}
        <p className="remedy-principle">{remedy.principle}</p>
      </div>
      <div className="remedy-part">
        <h3>怎么做</h3>
        <ol className="remedy-plan">
          {remedy.plan.map((step) => (
            <li key={step.action}>
              <b>{step.action}</b>
              <span>依据：{step.basis}</span>
              {step.timing ? <span>时机：{step.timing}</span> : null}
            </li>
          ))}
        </ol>
      </div>
      <div className="remedy-part">
        <h3>别做什么</h3>
        <ul className="remedy-avoid">{remedy.avoid.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </section>
  );
}
