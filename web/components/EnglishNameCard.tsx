import type { CharAnalysisData, NameHint } from "../../src/sanyi/naming/card.js";
import { ELEMENTS_EN, VIRTUES_EN } from "../../src/sanyi/i18n/glossary.js";
import type { PublicNamingName } from "./NameCard.js";
import { elementEn } from "../lib/result-format.js";
import { useT } from "../lib/i18n.js";
import type { TFunction } from "../lib/i18n.js";

type FamilyKey = "wuxing" | "shiwen" | "yinyi";

const SCORE_KEYS = [
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

const BOOKS_EN: Readonly<Record<string, string>> = {
  诗经: "Book of Songs", 楚辞: "Songs of Chu", 唐诗三百首: "Three Hundred Tang Poems",
  宋词三百首: "Three Hundred Song Lyrics", 周易: "Zhouyi", 论语: "Analects",
};

function analysisText(item: CharAnalysisData, t: TFunction): string {
  if (!item.wuxing) return t("naming.analysis.noElement", { char: item.char });
  const element = elementEn(item.wuxing);
  const basisKey = BASIS_KEYS[item.basisCode as keyof typeof BASIS_KEYS]
    ?? "naming.basis.modernMeaning";
  const relation = t(`naming.analysis.${item.relationCode}` as Parameters<TFunction>[0], { element });
  return t("naming.analysis.element", {
    char: item.char, element, basis: t(basisKey), relation, virtue: VIRTUES_EN[item.wuxing],
  });
}

function hintText(hint: NameHint, t: ReturnType<typeof useT>): string {
  if (hint.code === "same-tone") return t("hint.sameTone");
  if (hint.code === "same-initial") return t("hint.sameInitial", hint.params);
  if (hint.code === "same-final") return t("hint.sameFinal", hint.params);
  if (hint.code === "rare-char") return t("hint.rare", hint.params);
  return t("hint.polyphonic", hint.params);
}

export function EnglishNameCard(props: { name: PublicNamingName; familyKey: FamilyKey }) {
  const t = useT();
  const { name } = props;
  const analysis = (name.analysis ?? []).filter((item): item is CharAnalysisData => (
    typeof item === "object" && item !== null && "basisCode" in item
  ));
  const hints = (name.hints ?? []).filter((item): item is NameHint => (
    typeof item === "object" && item !== null && "code" in item
  ));
  const surnameChars = "surnameChars" in name ? name.surnameChars : undefined;
  const blocks = [...(surnameChars ?? []).map((char) => ({ ...char, surname: true })),
    ...name.chars.map((char) => ({ ...char, surname: false }))];
  return <article className="name-card"><header className="name-card-head">
    <div><h3>{name.full}</h3><p>{name.pinyin}</p></div>
    {name.scores ? <span className="name-score-badge"><strong>{name.scores.overall}</strong>
      <small>{t("naming.overall")}</small></span> : null}
  </header><div className="name-card-layout">
    <section className="name-card-metrics" aria-label={t("naming.charactersAndScores")}>
      <div className="name-char-blocks">{blocks.map((char, index) => <div
        className={`name-char-block${char.surname ? " surname" : ""}`} key={`${char.char}-${index}`}>
        {char.surname ? <small>{t("naming.surnameMark")}</small> : null}<strong>{char.char}</strong>
        <span>{char.pinyin}</span><span>{elementEn(char.wuxing)} · {t("naming.kangxi", {
          count: char.kangxi,
        })}</span>{!char.surname && "level" in char && char.level === 3
          ? <em>{t("naming.rare")}</em> : null}</div>)}</div>
      {name.supplements?.length ? <div className="name-supplements">{name.supplements.map(({ element, chars }) => (
        <span key={element}>{t("naming.supplement", { element: elementEn(element), chars: chars.join(", ") })}</span>
      ))}</div> : null}
      {name.scores ? <div className="name-score-list">{SCORE_KEYS.map(([key, label]) => <div
        className="name-score-row" key={key}><span>{t(label)}</span><span className="score-track">
        <i className="score-fill" style={{ width: `${name.scores![key]}%` }} /></span>
        <strong>{name.scores![key]}</strong></div>)}</div> : null}
    </section>
    <section className="name-card-copy" aria-label={t("naming.analysisAria")}>
      {analysis.length ? <div className="name-analysis"><h4>{t("naming.characterAnalysis")}</h4>
        {analysis.map((item) => <p key={item.char}>{analysisText(item, t)}</p>)}</div> : null}
      {name.chars.some((char) => Boolean(char.sense)) ? <div className="name-analysis">
        <h4>{t("naming.meaningAnalysis")}</h4>{name.chars.map((char) => char.sense
          ? <p key={char.char}><b>{char.char}</b> — {char.sense}</p> : null)}</div> : null}
      {name.echoes?.length ? <div className="name-echoes"><h4>{t("naming.echoes")}</h4>
        {name.echoes.map((line) => <blockquote key={line.id}><p>{line.text}</p>
          <cite>{BOOKS_EN[line.book] ?? line.book} · {/\p{Script=Han}/u.test(line.title)
            ? t("naming.classicalPassage") : line.title}</cite></blockquote>)}</div> : null}
      {name.tags?.length ? <div className="name-tags"><h4>{t("naming.tags")}</h4>
        <p>{name.tags.map((tag) => <span key={tag}>{tag}</span>)}</p></div> : null}
      <dl className="name-copy"><div><dt>{t("naming.meaning")}</dt><dd>{name.meaning}</dd></div>
        <div><dt>{t("naming.reason")}</dt><dd>{name.why}</dd></div></dl>
      {props.familyKey === "shiwen" && name.source ? <blockquote className="name-source">
        <cite>{BOOKS_EN[name.source.book] ?? name.source.book} · {t("naming.classicalPassage")}</cite>
        <p>{name.source.text}</p></blockquote> : null}
      {hints.length ? <ul className="name-hints">{hints.map((hint, index) => (
        <li key={`${hint.code}-${index}`}>{hintText(hint, t)}</li>
      ))}</ul> : null}
    </section>
  </div></article>;
}
