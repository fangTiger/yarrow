// web/components/SchoolCard.tsx
import type { PublicReading } from "../lib/api.js";
import { repairNote } from "../lib/reading-state.js";
import { useT } from "../lib/i18n.js";

type School = PublicReading["schools"][keyof PublicReading["schools"]];
const META = {
  chengyi: { seal: "程", name: "程颐", school: "义理派" },
  jingfang: { seal: "京", name: "京房", school: "纳甲六爻" },
  shaoyong: { seal: "邵", name: "邵雍", school: "梅花易数" },
} as const;

export function SchoolCard(props: {
  schoolKey: keyof typeof META;
  school: School;
  onRetry: () => void;
}) {
  const t = useT();
  const meta = META[props.schoolKey];
  const remaining = Math.max(0, 2 - props.school.retries);
  if (props.school.status === "pending" || props.school.status === "writing") {
    return (
      <article className="school-card pending">
        <span className="seal">{meta.seal}</span>
        <p>{t("schools.pending")}</p>
      </article>
    );
  }
  if (props.school.status === "failed" || props.school.status === "rejected") {
    const message = props.school.status === "failed"
      ? t("schools.failed")
      : t("schools.rejected");
    return (
      <article className="school-card failed">
        <span className="seal">{meta.seal}</span>
        <div>
          <h3>{meta.name}<small>{meta.school}</small></h3>
          <p>{message}</p>
          <button className="button" disabled={remaining === 0} onClick={props.onRetry} type="button">
            {remaining ? t("schools.retry", { count: remaining }) : t("schools.retryExhausted")}
          </button>
        </div>
      </article>
    );
  }
  const output = props.school.output;
  if (!output) {
    return null;
  }
  const tone = ["大吉", "吉"].includes(output.verdict)
    ? "good"
    : ["凶", "大凶"].includes(output.verdict) ? "bad" : "plain";
  return (
    <article className="school-card">
      <span className="seal">{meta.seal}</span>
      <div className="school-copy">
        <h3>{meta.name}<small>{meta.school}</small></h3>
        <p className={`school-verdict ${tone}`}>
          {output.verdict} · {output.headline}
          <small>{output.confidenceTenths}成</small>
        </p>
        <p className="school-reason">{output.reason}</p>
        {repairNote(props.school) ? <p className="hint repair-note">{repairNote(props.school)}</p> : null}
        <details>
          <summary>{t("schools.detail")}</summary>
          {output.sections.map((section) => (
            <section key={section.title}>
              <h4>{section.title}</h4>
              <p>{section.text}</p>
            </section>
          ))}
          {output.timing ? (
            <p><b>{t("schools.timing")}</b>{output.timing.window}；{t("schools.condition")}
              {output.timing.condition}</p>
          ) : null}
          <div><b>{t("schools.advice")}</b><ul>{output.advice.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </details>
      </div>
    </article>
  );
}
