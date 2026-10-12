import { WalletBar } from "../components/WalletBar.js";
// web/pages/Reading.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { QUESTION_SUBJECTS } from "../../src/oracle/question-classifier.js";
import { deriveFiveHexagrams } from "../../src/oracle/liuyao-chart.js";
import { AutoCast } from "../components/AutoCast.js";
import { FiveHexagrams } from "../components/FiveHexagrams.js";
import { HexagramFigure } from "../components/HexagramFigure.js";
import { Luopan } from "../components/Luopan.js";
import { ShikongBar, toView } from "../components/ShikongBar.js";
import { ThrowRecord } from "../components/ThrowRecord.js";
import { BaziReading } from "./BaziReading.js";
import { NamingReading } from "./NamingReading.js";
import { api, type AnyPublicReading, type PublicReading } from "../lib/api.js";
import { saveRecentReading } from "../lib/recent-readings.js";
import { readingStage, shouldPollReading, shouldPollTranslation } from "../lib/reading-state.js";
import { AlmanacPanel } from "../components/AlmanacPanel.js";
import { ConsensusTrack } from "../components/ConsensusTrack.js";
import { PlainSummaryPanel } from "../components/PlainSummaryPanel.js";
import { RemedyPanel } from "../components/RemedyPanel.js";
import { FiveElementsDetail } from "../components/FiveElementsDetail.js";
import { LiuyaoTable } from "../components/LiuyaoTable.js";
import { QimenBoard } from "../components/QimenBoard.js";
import { SchoolCard } from "../components/SchoolCard.js";
import { SubjectChange } from "../components/SubjectChange.js";
import { VerifyPanel } from "../components/VerifyPanel.js";
import { EnglishQuestionResult } from "../components/EnglishQuestionResult.js";
import { DisclaimerFooter } from "../components/DisclaimerFooter.js";
import { useLang, useT } from "../lib/i18n.js";
import { applyReadingTranslation, translationViewState } from "../lib/reading-translation.js";
import type { StoredTranslation } from "../../src/sanyi/translation/store.js";
const SCHOOL_KEYS = ["chengyi", "jingfang", "shaoyong"] as const;
const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_SUBJECTS.map(({ key, label }) => [key, label]),
);
function ChineseQuestionResult(props: {
  reading: PublicReading;
  onReading: (reading: PublicReading) => void;
  readonly?: boolean | undefined;
}) {
  const { reading } = props;
  const [retryError, setRetryError] = useState("");
  const chart = reading.chart;
  if (!chart || !reading.lines) {
    return (
      <section className="panel">
        <h1>正在排盘</h1>
        <p className="hint">六爻已成，三家稍候。</p>
      </section>
    );
  }
  const figures = deriveFiveHexagrams(reading.lines);
  const moving = reading.lines.flatMap((value, index) => [6, 9].includes(value) ? [index + 1] : []);
  const primary = figures.primary;
  const retry = async (key: typeof SCHOOL_KEYS[number]) => {
    setRetryError("");
    try {
      const value = await api.retrySchool(reading.id, key);
      if (value.kind === "question") {
        props.onReading(value);
      }
    } catch (caught) {
      setRetryError(caught instanceof Error ? caught.message : "此家暂未能重试，请稍后再试");
    }
  };
  return (
    <>
      <PlainSummaryPanel
        onReading={(value) => {
          if (value.kind === "question") {
            props.onReading(value);
          }
        }}
        reading={reading}
        readonly={props.readonly}
      />
      <RemedyPanel reading={reading} />
      <details className="panel schools-fold">
        <summary>
          看三家依据
          <span>程颐 · 京房 · 邵雍，同一卦三派独立落笔</span>
        </summary>
        <ConsensusTrack schools={reading.schools} />
        {retryError ? <p className="error" role="alert">{retryError}</p> : null}
        {SCHOOL_KEYS.map((key) => (
          <SchoolCard
            key={key}
            onRetry={() => void retry(key)}
            school={reading.schools[key]}
            schoolKey={key}
            readonly={props.readonly}
          />
        ))}
      </details>
      <section aria-labelledby="hexagram-title" className="panel hexagram-panel">
          <div className="ask">
            <span className="label">
              所问之事 · {SUBJECT_LABELS[reading.subject.finalKey] ?? "其他"}
            </span>
            <p>{reading.question}</p>
          </div>
          {!props.readonly ? <SubjectChange onReading={props.onReading} reading={reading} /> : null}
          <div className="hexagram-stage">
            <div className="luopan-wrap">
              <Luopan />
              <HexagramFigure
                label={`${primary.name}，${moving.map((value) => `第${value}爻动`).join("，")}`}
                lines={primary.yangLines}
                moving={moving}
              />
            </div>
            <div className="hexagram-title">
              <span className="label">本卦</span>
              <h1 id="hexagram-title">{primary.name}</h1>
              <p>
                动爻 {moving.length ? moving.join("、") : "无"} · 之卦
                <b>{figures.derived.name}</b>
              </p>
              <span className="tag">{chart.palace.name}宫 · {chart.palace.sequence}</span>
            </div>
          </div>
          <p className="judgement"><b>卦辞：</b>{primary.judgement}</p>
          <ThrowRecord throws={reading.throws} />
          <FiveHexagrams figures={figures} moving={moving} />
      </section>
      <div className="reading-secondary">
        <div className="reading-column">
          <LiuyaoTable chart={chart} />
          <FiveElementsDetail chart={chart} />
        </div>
        {reading.qimen ? <QimenBoard value={reading.qimen} /> : null}
      </div>
      {reading.almanac ? <AlmanacPanel value={reading.almanac} /> : null}
      <VerifyPanel reading={reading} />
    </>
  );
}
export function QuestionResult(props: {
  reading: PublicReading;
  onReading: (reading: PublicReading) => void;
  readonly?: boolean | undefined;
}) {
  const { lang } = useLang();
  return lang === "en" ? <EnglishQuestionResult {...props} /> : <ChineseQuestionResult {...props} />;
}

export function TranslationStatusPanel(props: {
  translation: StoredTranslation | undefined;
  requestFailed?: boolean;
  busy: boolean;
  onRetry(): void;
}) {
  const t = useT();
  const state = translationViewState(props.translation);
  if (state.kind === "done" && !props.requestFailed) return null;
  if (state.kind === "failed" || props.requestFailed) {
    return <section aria-live="polite" className="panel translation-status failed">
      <p>{t("translation.failed")}</p>
      <button className="button" disabled={props.busy} onClick={props.onRetry} type="button">
        {props.busy ? t("translation.retrying") : t("translation.retry")}
      </button>
    </section>;
  }
  return <section aria-live="polite" className="panel translation-status pending">
    <p><strong>{t("translation.pending")}</strong> {t("translation.fallback")}</p>
  </section>;
}

function translationReady(reading: AnyPublicReading): boolean {
  const states = reading.kind === "naming"
    ? Object.values(reading.families) : Object.values(reading.schools);
  return states.every(({ status }) => status === "done" || status === "failed" || status === "rejected")
    && reading.summary !== undefined && reading.summary.status !== "writing";
}
export function Reading({ id }: { id: string }) {
  const { lang } = useLang();
  const t = useT();
  const [reading, setReading] = useState<AnyPublicReading>();
  const [error, setError] = useState("");
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationRequestFailed, setTranslationRequestFailed] = useState(false);
  const translationTrigger = useRef("");
  const refresh = useCallback(async () => {
    try {
      const value = await api.getReading(id, lang);
      setReading(value);
      setError("");
      saveRecentReading({
        id: value.id,
        kind: value.kind,
        question: value.question,
        createdAt: value.createdAt,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("result.openError"));
    }
  }, [id, lang, t]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!reading || !(shouldPollReading(reading)
      || (lang === "en" && shouldPollTranslation(reading.translation)))) {
      return undefined;
    }
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => window.clearInterval(timer);
  }, [lang, reading, refresh]);
  const requestTranslation = useCallback(async () => {
    setTranslationBusy(true);
    setTranslationRequestFailed(false);
    try {
      await api.translateReading(id);
      await refresh();
    } catch {
      setTranslationRequestFailed(true);
    } finally {
      setTranslationBusy(false);
    }
  }, [id, refresh]);
  useEffect(() => {
    if (lang !== "en" || !reading || !translationReady(reading)) return;
    const state = translationViewState(reading.translation);
    if (state.kind !== "pending") return;
    const key = `${reading.id}:${Object.values(reading.translation?.units ?? {})
      .map((unit) => `${unit.sourceHash}:${unit.status}`).join("|") || "new"}`;
    if (translationTrigger.current === key) return;
    translationTrigger.current = key;
    void requestTranslation();
  }, [lang, reading, requestTranslation]);
  if (error) {
    return (
      <main className="page">
        <section className="panel error-panel">
          <h1>{t("result.openError")}</h1>
          <p className="error">{error}</p>
          <a className="button" href="#/">{t("result.backHome")}</a>
        </section>
        <DisclaimerFooter />
      </main>
    );
  }
  if (!reading) {
    return (
      <main className="page">
        <section aria-live="polite" className="panel">{t("result.opening")}</section>
        <DisclaimerFooter />
      </main>
    );
  }
  const visibleReading = lang === "en" ? applyReadingTranslation(reading) : reading;
  const translationPanel = lang === "en" ? <TranslationStatusPanel busy={translationBusy}
    onRetry={() => void requestTranslation()} requestFailed={translationRequestFailed}
    translation={reading.translation} /> : null;
  if (visibleReading.kind === "naming") {
    return (
      <main className="page">
        <header className="topbar">
          <span className="seal">{lang === "en" ? "Y" : "名"}</span>
          <span className="brand">{t("brand.name")}</span>
          <nav className="nav"><a href="#/">{t("result.backHome")}</a></nav><WalletBar />
        </header>
        {translationPanel}
        <NamingReading reading={visibleReading} onReading={setReading} />
        <DisclaimerFooter />
      </main>
    );
  }
  if (visibleReading.kind !== "question") {
    return (
      <main className="page">
        <header className="topbar">
          <span className="seal">{lang === "en" ? "Y" : "问"}</span>
          <span className="brand">{t("brand.name")}</span>
          <nav className="nav"><a href="#/">{t("result.backHome")}</a></nav>
          <WalletBar />
        </header>
        {lang === "zh" ? <ShikongBar data={toView(visibleReading.almanac)} /> : null}
        {translationPanel}
        <BaziReading reading={visibleReading} onReading={setReading} />
        <DisclaimerFooter />
      </main>
    );
  }
  const stage = readingStage(visibleReading);
  const view = visibleReading.almanac ? toView(visibleReading.almanac) : undefined;
  return (
    <main className="page">
      <header className="topbar">
        <span className="seal">{lang === "en" ? "Y" : "问"}</span>
        <span className="brand">{t("brand.name")}</span>
        <a href="#/">{t("result.backHome")}</a>
        <WalletBar />
      </header>
      {lang === "zh" && view ? <ShikongBar data={view} /> : null}
      {translationPanel}
      {lang === "zh" && visibleReading.chart?.month.boundaryUncertain ? <p className="boundary-tag">月建 · 近交节</p> : null}
      {stage === "awaiting-throws" ? (
        <AutoCast onReading={setReading} reading={visibleReading} />
      ) : stage === "failed" && !visibleReading.chart ? (
        <section className="panel">
          <h1>{t("result.chartFailed")}</h1>
          <p className="error">{visibleReading.error ?? t("result.tryLater")}</p>
          <a className="button" href="#/">{t("result.backHome")}</a>
        </section>
      ) : (
        <QuestionResult onReading={setReading} reading={visibleReading} />
      )}
      <DisclaimerFooter />
    </main>
  );
}
