import type { PublicNamingReading } from "../../src/sanyi/naming/public.js";
import type { CharAnalysisData, NameHint } from "../../src/sanyi/naming/card.js";
import { VIRTUES_ZH } from "../../src/sanyi/i18n/glossary.js";
import { useT, type TFunction } from "../lib/i18n.js";

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
  ["sound", "naming.sound"], ["form", "naming.form"],
  ["wuxing", "naming.wuxingScore"], ["poetry", "naming.poetry"],
] as const;

const BASIS_KEYS = {
  "radical-wood": "naming.basis.radicalWood", "radical-fire": "naming.basis.radicalFire",
  "radical-earth": "naming.basis.radicalEarth", "radical-metal": "naming.basis.radicalMetal",
  "radical-water": "naming.basis.radicalWater", "radical-jade": "naming.basis.radicalJade",
  "radical-grass": "naming.basis.radicalGrass", "radical-bamboo": "naming.basis.radicalBamboo",
  "radical-sun": "naming.basis.radicalSun", "radical-mountain": "naming.basis.radicalMountain",
  "radical-stone": "naming.basis.radicalStone", "radical-other": "naming.basis.radicalOther",
  "sound-labial": "naming.basis.soundLabial", "sound-lingual": "naming.basis.soundLingual",
  "sound-dental": "naming.basis.soundDental", "sound-molar": "naming.basis.soundMolar",
  "sound-guttural": "naming.basis.soundGuttural", "sound-other": "naming.basis.soundOther",
  "modern-meaning": "naming.basis.modernMeaning",
} as const;

function chineseAnalysis(value: string | CharAnalysisData, t: TFunction): string {
  if (typeof value === "string") return value;
  if (!value.wuxing) return t("naming.analysis.noElement", { char: value.char });
  const relation = t(`naming.analysis.${value.relationCode}` as Parameters<TFunction>[0], {
    element: value.wuxing,
  });
  const virtue = VIRTUES_ZH[value.wuxing].replace("：", "，寓意");
  const basis = t(BASIS_KEYS[value.basisCode as keyof typeof BASIS_KEYS]
    ?? "naming.basis.modernMeaning");
  return t("naming.analysis.element", {
    char: value.char, element: value.wuxing, basis, relation, virtue,
  });
}

function chineseHint(value: string | NameHint, t: TFunction): string {
  if (typeof value === "string") return value;
  if (value.code === "same-tone") return t("hint.sameTone");
  if (value.code === "same-initial") return t("hint.sameInitial", value.params);
  if (value.code === "same-final") return t("hint.sameFinal", value.params);
  if (value.code === "rare-char") return t("hint.rare", value.params);
  if (value.code === "polyphonic") {
    return t("hint.polyphonic", {
      ...value.params, readings: value.params.readings.replaceAll(", ", "、"),
    });
  }
  return "";
}

/** 单个名字的完整公开卡片；所有逐字资料均由接口公开视图提供。 */
export function NameCard(props: { name: PublicNamingName; familyKey: FamilyKey }) {
  const t = useT();
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
        {scores ? <span className="name-score-badge"><strong>{scores.overall}</strong>
          <small>{t("naming.overall")}</small></span> : null}
      </header>
      <div className="name-card-layout">
        <section className="name-card-metrics" aria-label={t("naming.charactersAndScores")}>
          <div className="name-char-blocks">
            {blocks.map((char, index) => (
              <div className={`name-char-block${char.surname ? " surname" : ""}`} key={`${char.char}-${index}`}>
                {char.surname ? <small>{t("naming.surnameMark")}</small> : null}<strong>{char.char}</strong>
                <span>{char.pinyin}</span><span>{char.wuxing} · {t("naming.kangxi", { count: char.kangxi })}</span>
                {!char.surname && "wuxingBasis" in char ? <span>{char.wuxingBasis}</span> : null}
                {!char.surname && "meaning" in char ? <span className="name-char-gloss">{char.meaning}</span> : null}
                {!char.surname && "level" in char && char.level === 3 ? <em>{t("naming.rare")}</em> : null}
              </div>
            ))}
          </div>
          {supplements && supplements.length > 0 ? (
            <div className="name-supplements">
              {supplements.map(({ element, chars }) => (
                <span key={element}>{t("naming.supplement", { element, chars: chars.join("、") })}</span>
              ))}
            </div>
          ) : null}
          {scores ? (
            <div className="name-score-list">
              {SCORE_LABELS.map(([key, label]) => (
                <div className="name-score-row" key={key}>
                  <span>{t(label)}</span>
                  <span className="score-track"><i className="score-fill" style={{ width: `${scores[key]}%` }} /></span>
                  <strong>{scores[key]}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </section>
        <section className="name-card-copy" aria-label={t("naming.analysisAria")}>
          {analysis && analysis.length > 0 ? (
            <div className="name-analysis"><h4>{t("naming.characterAnalysis")}</h4>{analysis.map((line, index) => (
              <p key={typeof line === "string" ? line : `${line.char}-${index}`}>{chineseAnalysis(line, t)}</p>
            ))}</div>
          ) : null}
          {name.chars.some((char) => Boolean(char.sense)) ? (
            <div className="name-analysis"><h4>{t("naming.meaningAnalysis")}</h4>
              {name.chars.map((char) => char.sense
                ? <p key={char.char}><b>「{char.char}」</b>{char.sense}</p> : null)}
            </div>
          ) : null}
          {echoes && echoes.length > 0 ? (
            <div className="name-echoes"><h4>{t("naming.echoes")}</h4>
              {echoes.map((line) => (
                <blockquote key={line.id}><p>{emphasizedText(line.text, name.given)}</p>
                  <cite>{line.book} · {line.title}</cite></blockquote>
              ))}
            </div>
          ) : null}
          {tags && tags.length > 0 ? (
            <div className="name-tags"><h4>{t("naming.tags")}</h4><p>{tags.map((tag) => <span key={tag}>{tag}</span>)}</p></div>
          ) : null}
          <dl className="name-copy">
            <div><dt>{t("naming.meaning")}</dt><dd>{name.meaning}</dd></div>
            <div><dt>{t("naming.reason")}</dt><dd>{name.why}</dd></div>
          </dl>
          {props.familyKey === "shiwen" && name.source ? (
            <blockquote className="name-source">
              <cite>{name.source.book} · {name.source.title}</cite>
              <p>{sourceText(name.source.text, name.given)}</p>
            </blockquote>
          ) : null}
          {name.hints.length > 0 ? (
            <ul className="name-hints">{name.hints.map((hint, index) => <li
              key={typeof hint === "string" ? hint : `${hint.code}-${index}`}>{chineseHint(hint, t)}</li>)}</ul>
          ) : null}
        </section>
      </div>
    </article>
  );
}
