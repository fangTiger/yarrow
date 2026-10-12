// web/components/AutoCast.tsx
import { useState } from "react";
import { api, type PublicReading } from "../lib/api.js";
import { HexagramFigure } from "./HexagramFigure.js";
import { ThrowRecord } from "./ThrowRecord.js";
import { useLang, useT } from "../lib/i18n.js";

/** 付款后服务端自动连掷六次；页面只负责逐爻展示，Arc 长时间无响应时提供「继续起卦」。 */
export function AutoCast(props: {
  reading: PublicReading;
  onReading: (reading: PublicReading) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = useT();
  const { lang } = useLang();
  const throws = [...props.reading.throws].sort((left, right) => left.index - right.index);
  const count = throws.length;
  const lines = throws.map((item) => item.value % 2 === 1);
  const moving = throws.filter((item) => item.moving).map((item) => item.index);
  const paused = props.reading.castPaused === true;
  const resume = async () => {
    setBusy(true);
    setError("");
    try {
      const value = await api.continueCasting(props.reading.id);
      if (value.kind === "question") {
        props.onReading(value);
      }
    } catch (caught) {
      setError(lang === "en" ? t("result.tryLater")
        : caught instanceof Error ? caught.message : "暂未能继续，请稍后再试");
    } finally {
      setBusy(false);
    }
  };
  let status = <p className="hint">{t("wait.castProgress", { count: count + 1 })}</p>;
  if (paused) {
    status = (
      <div className="throw-pause">
        <p className="error">{t("wait.castPaused")}</p>
        <button className="button" disabled={busy} onClick={() => void resume()}
          type="button">{t("wait.castResume")}</button>
        {error ? <p className="error">{error}</p> : null}
      </div>
    );
  } else if (count >= 6) {
    status = <p className="good-text">{t("wait.castComplete")}</p>;
  }
  return (
    <section aria-live="polite" className="panel coin-throw">
      <h1>{t("wait.castTitle")}</h1>
      <p className="hint">{t("wait.castProof")}</p>
      {count < 6 && !paused ? (
        <div aria-hidden="true" className="cast-coins" key={count}>
          <i className="cast-coin" />
          <i className="cast-coin" />
          <i className="cast-coin" />
        </div>
      ) : null}
      <HexagramFigure label={t("wait.castFigure", { count })} lines={lines} moving={moving} />
      {status}
      <ThrowRecord throws={throws} />
    </section>
  );
}
