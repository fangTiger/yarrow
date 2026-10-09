import { useState } from "react";
import type { PublicNamingReading } from "../../src/sanyi/naming/public.js";
import { NameCard } from "../components/NameCard.js";
import { api } from "../lib/api.js";

const FAMILY_META = {
  wuxing: { name: "五行补益", seal: "五" },
  shiwen: { name: "诗文出处", seal: "诗" },
  yinyi: { name: "音形字义", seal: "音" },
} as const;
type FamilyKey = keyof typeof FAMILY_META;

function genderLabel(value: PublicNamingReading["gender"]): string {
  return value === "male" ? "男" : value === "female" ? "女" : "不限";
}

function subjectLine(reading: PublicNamingReading): string {
  if (reading.target === "business") return `起名 · 商号（${reading.length} 字）`;
  const length = reading.length === 1 ? "单名" : "双名";
  const unborn = reading.unborn ? " · 按预产期" : "";
  return `起名 · 人名（${reading.surname ?? ""}姓 · ${length} · ${genderLabel(reading.gender)}${unborn}）`;
}

function NamingSummary(props: {
  reading: PublicNamingReading;
  onReading(value: PublicNamingReading): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { reading } = props;
  const states = Object.values(reading.families).map((family) => family.status);
  const finished = states.filter((status) => status === "done" || status === "failed").length;
  if (reading.summary?.status === "writing"
    || (reading.status === "writing" && finished === 3 && !reading.summary)) {
    return (
      <section aria-live="polite" className="panel naming-summary pending">
        <h2>三家合参</h2><p>正在写三家合参</p>
      </section>
    );
  }
  if (finished < 3) {
    return (
      <section aria-live="polite" className="panel naming-summary pending">
        <h2>三家合参</h2><p>三家起名中（{finished}/3）</p>
      </section>
    );
  }
  const summary = reading.summary;
  if (!summary || summary.status === "failed" || !summary.output) {
    const remaining = Math.max(0, 2 - (summary?.retries ?? 0));
    const canRetry = Boolean(summary && summary.basis > 0 && remaining > 0);
    const retry = async () => {
      setBusy(true);
      setError("");
      try {
        const value = await api.retrySummary(reading.id);
        if (value.kind === "naming") props.onReading(value);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "暂未能重试，请稍后再试");
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="panel naming-summary failed">
        <h2>三家合参</h2>
        <p>{summary?.error ?? "三家合参暂未生成，九个名字仍可查看。"}</p>
        {canRetry ? (
          <button className="button" disabled={busy} onClick={() => void retry()} type="button">
            免费重试（还可 {remaining} 次）
          </button>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    );
  }
  return (
    <section aria-label="三家合参" className="panel naming-summary">
      <header className="panel-head">
        <h2>三家合参</h2><p>从三家合格名字中择其相合者</p>
      </header>
      <div className="summary-names">
        {summary.output.picks.map((pick) => (
          <article className="summary-name" key={pick.given}>
            <h3>{pick.full}</h3><p className="name-pinyin">{pick.pinyin}</p>
            <span className="tag">{pick.family}</span><p>{pick.reason}</p>
          </article>
        ))}
      </div>
      <p className="naming-overview">{summary.output.overview}</p>
      <div className="naming-tips">
        <h3>怎么挑</h3>
        <ul>{summary.output.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </div>
    </section>
  );
}

function NamingBasis({ reading }: { reading: PublicNamingReading }) {
  const { basis } = reading;
  const pillars = basis.pillars;
  const fallbackNote = basis.favorableSource === "tiaohou"
    ? "按调候取用"
    : basis.favorableSource === "industry"
      ? "按行业确定五行"
      : "行业未匹配，由五行补益家自选";
  const favorableNote = basis.favorableNote ?? fallbackNote;
  return (
    <details className="panel naming-basis">
      <summary>起名依据</summary>
      {reading.unborn ? <p className="hint">按预产期，时辰不详</p> : null}
      {pillars ? (
        <dl className="basis-grid">
          <div>
            <dt>四柱</dt>
            <dd>{[
              pillars.year, pillars.month, pillars.day, pillars.time ?? "时辰不详",
            ].join(" · ")}</dd>
          </div>
          <div>
            <dt>五行分布</dt>
            <dd>{basis.elements.map((item) => `${item.element} ${item.total}`).join(" · ")}</dd>
          </div>
          {basis.tiaohou ? (
            <div>
              <dt>调候取用</dt>
              <dd>{favorableNote} → 喜用 {basis.favorable?.join("、") ?? "待定"}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p>{favorableNote}</p>
      )}
    </details>
  );
}

/** 起名结果页：合参、三家名字卡、依据与边界说明。 */
export function NamingReading(props: {
  reading: PublicNamingReading;
  onReading(value: PublicNamingReading): void;
}) {
  const [retrying, setRetrying] = useState<FamilyKey>();
  const [error, setError] = useState("");
  const retry = async (key: FamilyKey) => {
    setRetrying(key);
    setError("");
    try {
      const value = await api.retrySchool(props.reading.id, key);
      if (value.kind === "naming") props.onReading(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "此家暂未能重试，请稍后再试");
    } finally {
      setRetrying(undefined);
    }
  };
  return (
    <div className="naming-reading" data-reading={props.reading.id}>
      <section className="panel naming-question">
        <span className="label">所问</span><h1>{subjectLine(props.reading)}</h1>
        {props.reading.question ? <p>{props.reading.question}</p> : null}
      </section>
      <NamingSummary reading={props.reading} onReading={props.onReading} />
      <section aria-label="三家名字" className="naming-families">
        {(Object.keys(FAMILY_META) as FamilyKey[]).map((key) => {
          const meta = FAMILY_META[key];
          const family = props.reading.families[key];
          const remaining = Math.max(0, 2 - family.retries);
          return (
            <section className="panel naming-family" key={key}>
              <header className="family-head">
                <span className="seal">{meta.seal}</span>
                <div><h2>{meta.name}</h2>{family.output ? <p>{family.output.note}</p> : null}</div>
              </header>
              {family.output ? (
                <div className="name-grid">
                  {family.output.names.map((name) => (
                    <NameCard familyKey={key} key={name.given} name={name} />
                  ))}
                </div>
              ) : null}
              {family.status === "pending" || family.status === "writing"
                ? <p className="hint">本家正在起名</p>
                : null}
              {family.status === "failed" ? (
                <div className="family-failed">
                  <p>{family.error ?? "本家暂未落笔"}</p>
                  {remaining > 0 ? (
                    <button className="button" disabled={retrying === key}
                      onClick={() => void retry(key)} type="button">
                      免费重试（还可 {remaining} 次）
                    </button>
                  ) : null}
                </div>
              ) : null}
              {family.removed
                ? <p className="hint">已删去 {family.removed} 个不合规的名字</p>
                : null}
            </section>
          );
        })}
      </section>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <NamingBasis reading={props.reading} />
      <footer className="panel naming-notes">
        <p>字的五行各家说法不一，本站按字形部首优先、读音五音其次判定。</p>
        <p>本站不采用姓名笔画吉凶之说，也不承诺名字改变运势。</p>
        <p>{props.reading.target === "person"
          ? "人名请在上户口前查重名。"
          : "商号请在注册前查询商标与工商登记。"}</p>
      </footer>
    </div>
  );
}
