// web/components/PlainSummaryPanel.tsx
import { useState } from "react";
import { api, type AnyPublicReading } from "../lib/api.js";
import { repairNote, summaryStatus } from "../lib/reading-state.js";
import { useT } from "../lib/i18n.js";
import { readingSchools, useElapsedSeconds } from "../lib/reading-progress.js";
import { ShareCard } from "./ShareCard.js";

const SCHOOL_NAME_KEYS = {
  chengyi: "wait.school.chengyi",
  jingfang: "wait.school.jingfang",
  shaoyong: "wait.school.shaoyong",
  shenxiaozhan: "wait.school.shenxiaozhan",
  yuchuntai: "wait.school.yuchuntai",
  rentieqiao: "wait.school.rentieqiao",
} as const;

/** 三类结果共用的等待信息；起名保留自己的现状。 */
export function ReadingProgress(props: {
  reading: Exclude<AnyPublicReading, { kind: "naming" }>;
  status: string;
  showHead?: boolean | undefined;
}) {
  const t = useT();
  const seconds = useElapsedSeconds(props.reading.createdAt);
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return <section aria-live="polite" className="panel plain-summary pending">
    {props.showHead === false ? <h2>{t("summary.title")}</h2> : <header className="panel-head">
      <h2>{t("summary.title")}</h2>
      <p>{t("summary.question", { question: props.reading.question })}</p>
    </header>}
    <p className="summary-progress">{props.status}</p>
    <ul className="reading-school-progress">{readingSchools(props.reading).map(([key, state]) => {
      const status = state.status === "done" ? t("wait.status.done")
        : state.status === "writing" ? t("wait.status.writing") : t("wait.status.notWritten");
      return <li key={key}><span>{t(SCHOOL_NAME_KEYS[key as keyof typeof SCHOOL_NAME_KEYS])}</span>
        <b>{status}</b></li>;
    })}</ul>
    <p className="reading-elapsed">{t("wait.elapsed", { minutes, seconds: remainder })}
      <span>{t("wait.usual")}</span></p>
    {seconds > 180 ? <p className="reading-overdue">{t("wait.overdue")}</p> : null}
  </section>;
}

/** 结果页最上方的白话总述：用大白话把三家合起来讲清楚；生成中显示进度，未生成可免费重试。 */
export function PlainSummaryPanel(props: {
  reading: AnyPublicReading;
  onReading: (reading: AnyPublicReading) => void;
  readonly?: boolean | undefined;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { reading } = props;
  if (reading.kind === "naming") {
    return null;
  }
  const status = summaryStatus(reading, t);
  if (status.kind === "none") {
    return null;
  }
  const head = (
    <header className="panel-head">
      <h2>{t("summary.title")}</h2>
      <p>{t("summary.question", { question: reading.question })}</p>
    </header>
  );
  if (status.kind === "progress") {
    return <ReadingProgress reading={reading} status={status.text} />;
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
        setError(caught instanceof Error ? caught.message : t("result.tryLater"));
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="panel plain-summary failed">
        {head}
        <p>{status.kind === "failed" ? status.text : t("summary.notReady")}</p>
        {status.kind === "failed" && status.canRetry && !props.readonly ? (
          <button className="button" disabled={busy} onClick={() => void retry()} type="button">
            {t("result.retryFree", { count: remaining })}
          </button>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    );
  }
  const output = summary.output;
  const note = repairNote(summary);
  return (
    <section aria-label={t("summary.title")} className="panel plain-summary">
      {head}
      <div className="summary-conclusion">
        {output.tone
          ? <span className={`tag summary-tone tone-${output.tone}`}>{t(output.tone === "顺"
            ? "summary.tone.positive" : output.tone === "中"
              ? "summary.tone.mixed" : "summary.tone.negative")}</span>
          : null}
        <p>{output.conclusion}</p>
      </div>
      <dl className="summary-points">
        <div>
          <dt>{t("summary.agreement")}</dt>
          <dd>{output.agreement}</dd>
        </div>
        {output.difference ? (
          <div>
            <dt>{t("summary.difference")}</dt>
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
          <h3>{t("summary.advice")}</h3>
          <ol>{output.advice.map((item) => <li key={item}>{item}</li>)}</ol>
        </div>
      ) : null}
      {output.watch ? (
        <p className="summary-watch"><b>{t("summary.watch")}</b>{output.watch.window}（{output.watch.condition}）</p>
      ) : null}
      {output.outlook ? <p className="summary-outlook"><b>{t(reading.kind === "destiny"
        ? "summary.lifeOutlook" : "summary.outlook")}</b>{output.outlook}</p> : null}
      <p className="hint">{note ? t("summary.basisNote", { count: summary.basis, note })
        : t("summary.basis", { count: summary.basis })}</p>
      <ShareCard reading={reading} sample={props.readonly} />
    </section>
  );
}
