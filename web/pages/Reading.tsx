// web/pages/Reading.tsx
import { useCallback, useEffect, useState } from "react";
import { QUESTION_SUBJECTS } from "../../src/oracle/question-classifier.js";
import { deriveFiveHexagrams } from "../../src/oracle/liuyao-chart.js";
import { CoinThrow } from "../components/CoinThrow.js";
import { FiveHexagrams } from "../components/FiveHexagrams.js";
import { HexagramFigure } from "../components/HexagramFigure.js";
import { Luopan } from "../components/Luopan.js";
import { ShikongBar, toView } from "../components/ShikongBar.js";
import { ThrowRecord } from "../components/ThrowRecord.js";
import { api, type PublicReading } from "../lib/api.js";
import { saveRecentReading } from "../lib/recent-readings.js";
import { readingStage, shouldPollReading } from "../lib/reading-state.js";
const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_SUBJECTS.map(({ key, label }) => [key, label]),
);
function Result(props: {
  reading: PublicReading;
}) {
  const { reading } = props;
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
  return (
    <>
      <div className="reading-hero">
        <section aria-labelledby="hexagram-title" className="panel hexagram-panel">
          <div className="ask">
            <span className="label">
              所问之事 · {SUBJECT_LABELS[reading.subject.finalKey] ?? "其他"}
            </span>
            <p>{reading.question}</p>
          </div>
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
      </div>
    </>
  );
}
export function Reading({ id }: { id: string }) {
  const [reading, setReading] = useState<PublicReading>();
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const value = await api.getReading(id);
      setReading(value);
      setError("");
      saveRecentReading({
        id: value.id,
        kind: value.kind,
        question: value.question,
        createdAt: value.createdAt,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "未能打开这一卦");
    }
  }, [id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!reading || !shouldPollReading(reading)) {
      return undefined;
    }
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => window.clearInterval(timer);
  }, [reading, refresh]);
  if (error) {
    return (
      <main className="page">
        <section className="panel error-panel">
          <h1>这一卦暂时打不开</h1>
          <p className="error">{error}</p>
          <a className="button" href="#/">返回首页</a>
        </section>
      </main>
    );
  }
  if (!reading) {
    return (
      <main className="page">
        <section aria-live="polite" className="panel">正在打开这一卦</section>
      </main>
    );
  }
  const stage = readingStage(reading);
  const view = reading.almanac ? toView(reading.almanac) : undefined;
  return (
    <main className="page">
      <header className="topbar">
        <span className="seal">问</span>
        <span className="brand">三易</span>
        <a href="#/">返回首页</a>
      </header>
      {view ? <ShikongBar data={view} /> : null}
      {reading.chart?.month.boundaryUncertain ? <p className="boundary-tag">月建 · 近交节</p> : null}
      {stage === "awaiting-throws" ? (
        <CoinThrow onReading={setReading} reading={reading} />
      ) : stage === "failed" && !reading.chart ? (
        <section className="panel">
          <h1>排盘未能完成</h1>
          <p className="error">{reading.error ?? "请稍后再试"}</p>
          <a className="button" href="#/">返回首页</a>
        </section>
      ) : (
        <Result reading={reading} />
      )}
    </main>
  );
}
