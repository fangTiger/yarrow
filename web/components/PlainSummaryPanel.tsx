// web/components/PlainSummaryPanel.tsx
import { useState } from "react";
import { api, type AnyPublicReading } from "../lib/api.js";
import { repairNote, summaryStatus } from "../lib/reading-state.js";

const TONE_LABELS: Record<string, string> = { 顺: "偏顺", 中: "成败参半", 不顺: "偏不顺" };

/** 结果页最上方的白话总述：用大白话把三家合起来讲清楚；生成中显示进度，未生成可免费重试。 */
export function PlainSummaryPanel(props: {
  reading: AnyPublicReading;
  onReading: (reading: AnyPublicReading) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { reading } = props;
  const status = summaryStatus(reading);
  if (status.kind === "none") {
    return null;
  }
  const head = (
    <header className="panel-head">
      <h2>白话总述</h2>
      <p>所问：{reading.question}</p>
    </header>
  );
  if (status.kind === "progress") {
    return (
      <section aria-live="polite" className="panel plain-summary pending">
        {head}
        <p className="summary-progress">{status.text}</p>
      </section>
    );
  }
  const summary = reading.summary;
  if (status.kind === "failed" || !summary?.output) {
    const remaining = Math.max(0, 2 - (summary?.retries ?? 0));
    const retry = async () => {
      setBusy(true);
      setError("");
      try {
        props.onReading(await api.retrySummary(reading.id));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "暂未能重试，请稍后再试");
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="panel plain-summary failed">
        {head}
        <p>{status.kind === "failed" ? status.text : "白话总述暂未生成"}</p>
        {status.kind === "failed" && status.canRetry ? (
          <button className="button" disabled={busy} onClick={() => void retry()} type="button">
            免费重试（还可 {remaining} 次）
          </button>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    );
  }
  const output = summary.output;
  const note = repairNote(summary);
  return (
    <section aria-label="白话总述" className="panel plain-summary">
      {head}
      <div className="summary-conclusion">
        {output.tone
          ? <span className={`tag summary-tone tone-${output.tone}`}>{TONE_LABELS[output.tone]}</span>
          : null}
        <p>{output.conclusion}</p>
      </div>
      <dl className="summary-points">
        <div>
          <dt>三家一致</dt>
          <dd>{output.agreement}</dd>
        </div>
        {output.difference ? (
          <div>
            <dt>三家分歧</dt>
            <dd>{output.difference}</dd>
          </div>
        ) : null}
      </dl>
      <div className="summary-explain">
        {output.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      {output.advice ? (
        // 只有改版前的旧存档才有建议；新总述的建议并入下方解法。
        <div className="summary-advice">
          <h3>建议</h3>
          <ol>{output.advice.map((item) => <li key={item}>{item}</li>)}</ol>
        </div>
      ) : null}
      {output.watch ? (
        <p className="summary-watch"><b>留意</b>{output.watch.window}（{output.watch.condition}）</p>
      ) : null}
      {output.outlook ? <p className="summary-outlook"><b>十年走势</b>{output.outlook}</p> : null}
      <p className="hint">依据 {summary.basis} 家断语{note ? `；${note}` : ""}。三家原话见下方「看三家依据」。</p>
    </section>
  );
}
