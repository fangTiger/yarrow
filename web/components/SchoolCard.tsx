// web/components/SchoolCard.tsx
import type { PublicReading } from "../lib/api.js";

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
  const meta = META[props.schoolKey];
  const remaining = Math.max(0, 2 - props.school.retries);
  if (props.school.status === "pending" || props.school.status === "writing") {
    return (
      <article className="school-card pending">
        <span className="seal">{meta.seal}</span>
        <p>落笔中</p>
      </article>
    );
  }
  if (props.school.status === "failed" || props.school.status === "rejected") {
    const message = props.school.status === "failed"
      ? "此家暂未落笔"
      : "此家断语未通过盘面核对，暂不展示";
    return (
      <article className="school-card failed">
        <span className="seal">{meta.seal}</span>
        <div>
          <h3>{meta.name}<small>{meta.school}</small></h3>
          <p>{message}</p>
          <button className="button" disabled={remaining === 0} onClick={props.onRetry} type="button">
            {remaining ? `重试（还可 ${remaining} 次）` : "重试次数已用尽"}
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
        <details>
          <summary>展开详断</summary>
          {output.sections.map((section) => (
            <section key={section.title}>
              <h4>{section.title}</h4>
              <p>{section.text}</p>
            </section>
          ))}
          {output.timing ? (
            <p><b>应期：</b>{output.timing.window}；条件：{output.timing.condition}</p>
          ) : null}
          <div><b>建议：</b><ul>{output.advice.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </details>
      </div>
    </article>
  );
}
