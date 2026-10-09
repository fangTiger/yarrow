import type { PublicNamingReading } from "../../src/sanyi/naming/public.js";

type FamilyKey = keyof PublicNamingReading["families"];
type FamilyOutput = NonNullable<PublicNamingReading["families"][FamilyKey]["output"]>;
export type PublicNamingName = FamilyOutput["names"][number];

function sourceText(text: string, given: string) {
  const used = new Set([...given]);
  return [...text].map((char, index) => used.has(char)
    ? <b key={`${char}-${index}`}>{char}</b>
    : <span key={`${char}-${index}`}>{char}</span>);
}

/** 单个名字的完整公开卡片；所有逐字资料均由接口公开视图提供。 */
export function NameCard(props: { name: PublicNamingName; familyKey: FamilyKey }) {
  const { name } = props;
  return (
    <article className="name-card">
      <header className="name-card-head">
        <h3>{name.full}</h3>
        <p>{name.pinyin}</p>
      </header>
      <div className="name-char-scroll">
        <table className="name-char-table">
          <thead><tr><th>字</th><th>拼音</th><th>五行</th><th>康熙</th><th>释义</th></tr></thead>
          <tbody>
            {name.chars.map((char, index) => (
              <tr key={`${char.char}-${index}`}>
                <td className="name-char">{char.char}{char.level === 3 ? <small>较生僻</small> : null}</td>
                <td>{char.pinyin}</td>
                <td>{char.wuxing}<small>{char.wuxingBasis}</small></td>
                <td>{char.kangxi} 画</td>
                <td className="name-char-meaning">{char.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    </article>
  );
}
