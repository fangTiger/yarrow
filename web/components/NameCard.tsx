import type { PublicNamingReading } from "../../src/sanyi/naming/public.js";

type FamilyKey = keyof PublicNamingReading["families"];
type FamilyOutput = NonNullable<PublicNamingReading["families"][FamilyKey]["output"]>;
export type PublicNamingName = FamilyOutput["names"][number];

function emphasizedText(text: string, given: string) {
  const wanted = new Set([...given]);
  return [...text].map((char, index) => (
    wanted.has(char)
      ? <b key={`${char}-${index}`}>{char}</b>
      : <span key={`${char}-${index}`}>{char}</span>
  ));
}

function sourceText(text: string, given: string) {
  const remaining = new Map<string, number>();
  for (const char of [...given]) remaining.set(char, (remaining.get(char) ?? 0) + 1);
  return [...text].map((char, index) => {
    const count = remaining.get(char) ?? 0;
    if (count > 0) {
      remaining.set(char, count - 1);
      return <b key={`${char}-${index}`}>{char}</b>;
    }
    return <span key={`${char}-${index}`}>{char}</span>;
  });
}

const SCORE_LABELS = [
  ["sound", "好听"], ["form", "字形"], ["wuxing", "八字五行"], ["poetry", "诗文意蕴"],
] as const;

/** 单个名字的完整公开卡片；所有逐字资料均由接口公开视图提供。 */
export function NameCard(props: { name: PublicNamingName; familyKey: FamilyKey }) {
  const { name } = props;
  const scores = name.scores as typeof name.scores | undefined;
  const supplements = name.supplements as typeof name.supplements | undefined;
  const analysis = name.analysis as typeof name.analysis | undefined;
  const echoes = name.echoes as typeof name.echoes | undefined;
  const tags = name.tags as typeof name.tags | undefined;
  const surnameChars = "surnameChars" in name
    ? name.surnameChars as typeof name.chars | undefined
    : undefined;
  const blocks = [
    ...(surnameChars ?? []).map((char) => ({ ...char, surname: true })),
    ...name.chars.map((char) => ({ ...char, surname: false })),
  ];
  return (
    <article className="name-card">
      <header className="name-card-head">
        <div><h3>{name.full}</h3><p>{name.pinyin}</p></div>
        {scores ? <span className="name-score-badge"><strong>{scores.overall}</strong><small>综合</small></span> : null}
      </header>
      <div className="name-card-layout">
        <section className="name-card-metrics" aria-label="逐字与评分">
          <div className="name-char-blocks">
            {blocks.map((char, index) => (
              <div className={`name-char-block${char.surname ? " surname" : ""}`} key={`${char.char}-${index}`}>
                {char.surname ? <small>姓</small> : null}<strong>{char.char}</strong>
                <span>{char.pinyin}</span><span>{char.wuxing} · 康熙 {char.kangxi} 画</span>
                <span>{char.wuxingBasis}</span>
                <span className="name-char-gloss">{char.meaning}</span>
                {char.level === 3 ? <em>较生僻</em> : null}
              </div>
            ))}
          </div>
          {supplements && supplements.length > 0 ? (
            <div className="name-supplements">
              {supplements.map(({ element, chars }) => (
                <span key={element}>补{element}：{chars.join("、")}</span>
              ))}
            </div>
          ) : null}
          {scores ? (
            <div className="name-score-list">
              {SCORE_LABELS.map(([key, label]) => (
                <div className="name-score-row" key={key}>
                  <span>{label}</span>
                  <span className="score-track"><i className="score-fill" style={{ width: `${scores[key]}%` }} /></span>
                  <strong>{scores[key]}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </section>
        <section className="name-card-copy" aria-label="名字分析">
          {analysis && analysis.length > 0 ? (
            <div className="name-analysis"><h4>用字分析</h4>{analysis.map((line) => <p key={line}>{line}</p>)}</div>
          ) : null}
          {name.chars.some((char) => Boolean(char.sense)) ? (
            <div className="name-analysis"><h4>字义分析</h4>
              {name.chars.map((char) => char.sense
                ? <p key={char.char}><b>「{char.char}」</b>{char.sense}</p> : null)}
            </div>
          ) : null}
          {echoes && echoes.length > 0 ? (
            <div className="name-echoes"><h4>意蕴内涵</h4>
              {echoes.map((line) => (
                <blockquote key={line.id}><p>{emphasizedText(line.text, name.given)}</p>
                  <cite>{line.book} · {line.title}</cite></blockquote>
              ))}
            </div>
          ) : null}
          {tags && tags.length > 0 ? (
            <div className="name-tags"><h4>性格标签</h4><p>{tags.map((tag) => <span key={tag}>{tag}</span>)}</p></div>
          ) : null}
          <dl className="name-copy">
            <div><dt>寓意</dt><dd>{name.meaning}</dd></div>
            <div><dt>理由</dt><dd>{name.why}</dd></div>
          </dl>
          {props.familyKey === "shiwen" && name.source ? (
            <blockquote className="name-source">
              <cite>{name.source.book} · {name.source.title}</cite>
              <p>{sourceText(name.source.text, name.given)}</p>
            </blockquote>
          ) : null}
          {name.hints.length > 0 ? (
            <ul className="name-hints">{name.hints.map((hint) => <li key={hint}>{hint}</li>)}</ul>
          ) : null}
        </section>
      </div>
    </article>
  );
}
