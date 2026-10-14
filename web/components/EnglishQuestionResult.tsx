import { ArcVerify } from "./ArcVerify.js";
import { useState } from "react";
import { getZhouyiEnglish, getZhouyiLineEnglish } from "../../src/agent/zhouyi-en.js";
import { getHexagramText } from "../../src/agent/zhouyi-corpus.js";
import { DAXIANG } from "../../src/agent/daxiang-corpus.js";
import { deriveFiveHexagrams } from "../../src/oracle/liuyao-chart.js";
import type { PublicReading } from "../lib/api.js";
import { api } from "../lib/api.js";
import {
  elementEn, hexagramEn, relativeEn, spiritEn, stemBranchEn, strengthEn, subjectEn,
} from "../lib/result-format.js";
import { useT } from "../lib/i18n.js";
import { AlmanacPanel } from "./AlmanacPanel.js";
import { EnglishRemedy, EnglishSchoolArticle, EnglishSummary } from "./EnglishReadingSections.js";
import { HexagramFigure } from "./HexagramFigure.js";
import { QimenBoard } from "./QimenBoard.js";

const SCHOOL_KEYS = ["chengyi", "jingfang", "shaoyong"] as const;

export function EnglishQuestionResult(props: {
  reading: PublicReading;
  onReading(reading: PublicReading): void;
  readonly?: boolean | undefined;
}) {
  const t = useT();
  const [retryError, setRetryError] = useState("");
  const { reading } = props;
  if (!reading.chart || !reading.lines) {
    return <section className="panel"><h1>{t("result.charting")}</h1>
      <p className="hint">{t("result.chartingHint")}</p></section>;
  }
  const figures = deriveFiveHexagrams(reading.lines);
  const primary = figures.primary;
  const classic = getZhouyiEnglish(primary.kingWenNumber);
  const chineseClassic = getHexagramText(primary.kingWenNumber);
  const moving = reading.lines.flatMap((value, index) => [6, 9].includes(value) ? [index + 1] : []);
  const retry = async (key: typeof SCHOOL_KEYS[number]) => {
    try {
      const value = await api.retrySchool(reading.id, key);
      if (value.kind === "question") props.onReading(value);
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : t("result.tryLater"));
    }
  };
  return <>
    <EnglishSummary reading={reading} />
    <EnglishRemedy reading={reading} />
    <details className="panel schools-fold"><summary>{t("schools.title")}
      <span>{t("schools.questionIntro")}</span></summary>
      {retryError ? <p className="error" role="alert">{retryError}</p> : null}
      {SCHOOL_KEYS.map((key) => <EnglishSchoolArticle key={key} onRetry={() => void retry(key)}
        readonly={props.readonly} schoolKey={key} state={reading.schools[key] as never} />)}
    </details>
    <section aria-labelledby="hexagram-title" className="panel hexagram-panel">
      <div className="ask"><span className="label">{t("question.subject", {
        subject: subjectEn(reading.subject.finalKey),
      })}</span><p>{reading.question}</p></div>
      <div className="hexagram-stage"><HexagramFigure
        label={`${hexagramEn(primary.kingWenNumber)}; ${moving.join(", ")}`}
        lines={primary.yangLines} moving={moving} />
        <div className="hexagram-title"><span className="label">{t("question.primary")}</span>
          <h1 id="hexagram-title">{hexagramEn(primary.kingWenNumber)}</h1>
          <p>{t("question.moving", {
            lines: moving.length ? moving.join(", ") : t("question.none"),
            derived: hexagramEn(figures.derived.kingWenNumber),
          })}</p></div></div>
      <div className="classic-pair"><p><b>{t("question.judgement")}:</b> 
        <span className="classic-original">{primary.judgement}</span></p>
        <p>{classic.judgement}</p><small>{t("question.translationCredit")}</small></div>
      <div className="classic-pair"><p><b>{t("question.image")}:</b> 
        <span className="classic-original">{DAXIANG[primary.kingWenNumber - 1]}</span></p>
        <p>{classic.image}</p><small>{t("question.translationCredit")}</small></div>
      {moving.map((line) => <div className="classic-pair" key={line}>
        <h3>{t(reading.lines![line - 1]! % 2 === 1 ? "question.lineYang" : "question.lineYin", { line })}</h3>
        <p className="classic-original">{chineseClassic.lines[line - 1]?.text}</p>
        <p>{getZhouyiLineEnglish(primary.kingWenNumber, line)}</p>
        <small>{t("question.translationCredit")}</small></div>)}
      {reading.lines.every((line) => line === 9) && chineseClassic.extras[0] ? <div className="classic-pair">
        <h3>{t("question.allYang")}</h3><p className="classic-original">{chineseClassic.extras[0].text}</p>
        <p>{classic.extras[0]}</p><small>{t("question.translationCredit")}</small></div> : null}
      {reading.lines.every((line) => line === 6) && chineseClassic.extras[0] ? <div className="classic-pair">
        <h3>{t("question.allYin")}</h3><p className="classic-original">{chineseClassic.extras[0].text}</p>
        <p>{classic.extras[0]}</p><small>{t("question.translationCredit")}</small></div> : null}
    </section>
    <section className="panel"><header className="panel-head"><h2>{t("question.chart")}</h2></header>
      <div className="chart-scroll"><table><thead><tr>
        {["question.line", "question.spirit", "question.relative", "question.stemBranch",
          "question.element", "question.strength", "question.changing"].map((key) => (
          <th key={key}>{t(key as Parameters<typeof t>[0])}</th>
        ))}
      </tr></thead><tbody>{[...reading.chart.rows].reverse().map((row) => <tr key={row.position}>
        <td>{row.position}</td><td>{spiritEn(row.sixSpirit)}</td><td>{relativeEn(row.primary.relation)}</td>
        <td>{stemBranchEn(row.primary.stemBranch)}</td><td>{elementEn(row.primary.element)}</td>
        <td>{strengthEn(row.primary.strength)}</td><td>{row.changing
          ? `${relativeEn(row.changed.relation)} · ${stemBranchEn(row.changed.stemBranch)}` : t("question.still")}</td>
      </tr>)}</tbody></table></div>
    </section>
    {reading.qimen || reading.almanac ? <details className="panel traditional-chart">
      <summary>{t("traditional.title")}</summary>
      {reading.qimen ? <QimenBoard value={reading.qimen} /> : null}
      {reading.almanac ? <AlmanacPanel value={reading.almanac} /> : null}
    </details> : null}
    <section className="panel verify-panel"><header className="panel-head"><h2>{t("verify.title")}</h2></header>
      <ArcVerify paymentHash={reading.payment.firstHash} question={reading.question} throws={reading.throws} />
      <details className="arc-verify-raw"><summary>{t("question.proof")}</summary>
      <dl><div><dt>{t("question.paymentTx")}</dt><dd>{reading.payment.firstHash}</dd></div>
        {reading.throws.map((item) => <div key={item.index}><dt>{t("question.castBlock", {
          index: item.index, block: item.blockNumber,
        })}</dt><dd>{item.blockHash}</dd></div>)}</dl></details></section>
  </>;
}
