// web/components/CoinThrow.tsx
import { useEffect, useReducer, useRef, type KeyboardEvent } from "react";
import { ApiError, api, type PublicReading } from "../lib/api.js";
import {
  initialThrowState,
  reduceThrow,
} from "../lib/throw-machine.js";
import { HexagramFigure } from "./HexagramFigure.js";
import { ThrowRecord } from "./ThrowRecord.js";

const ARC_MESSAGE = "未能取得天时（Arc 网络无响应），稍后可继续";

export function CoinThrow(props: {
  reading: PublicReading;
  onReading: (reading: PublicReading) => void;
}) {
  const [state, dispatch] = useReducer(
    reduceThrow,
    props.reading.throws,
    initialThrowState,
  );
  const held = useRef(false);
  const release = async () => {
    if (!held.current || state.phase !== "shaking") {
      return;
    }
    held.current = false;
    dispatch({ type: "release" });
    try {
      const result = await api.throwCoin(props.reading.id, state.nextIndex);
      dispatch({ type: "resolved", result });
      const reading = await api.getReading(props.reading.id);
      props.onReading(reading);
    } catch (caught) {
      const message = caught instanceof ApiError && [409, 503].includes(caught.status)
        ? caught.message || ARC_MESSAGE
        : ARC_MESSAGE;
      dispatch({ type: "pause", message });
    }
  };
  const press = () => {
    if (state.phase !== "idle") {
      return;
    }
    held.current = true;
    dispatch({ type: "press" });
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      press();
    }
  };
  const keyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      void release();
    }
  };
  useEffect(() => {
    if (state.phase !== "recorded") {
      return undefined;
    }
    const timer = window.setTimeout(() => dispatch({ type: "ready" }), 500);
    return () => window.clearTimeout(timer);
  }, [state.phase]);
  const lines = state.throws.map((item) => item.value % 2 === 1);
  const moving = state.throws.filter((item) => item.moving).map((item) => item.index);
  return (
    <section aria-live="polite" className="panel coin-throw">
      <h1>亲手六掷</h1>
      <p className="hint">卦从初爻向上长出；按住摇，松开落钱。</p>
      <HexagramFigure label={`已成${lines.length}爻`} lines={lines} moving={moving} />
      <button
        className={`throw-button ${state.phase === "shaking" ? "shaking" : ""}`}
        disabled={state.phase === "landing" || state.phase === "complete"}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onPointerCancel={() => void release()}
        onPointerDown={press}
        onPointerUp={() => void release()}
        type="button"
      >
        {state.phase === "shaking" ? "松手落钱" : `摇 · 第${state.nextIndex}掷`}
      </button>
      {state.phase === "paused" ? (
        <div className="throw-pause">
          <p className="error">{state.message}</p>
          <button
            className="button"
            onClick={() => dispatch({ type: "resume" })}
            type="button"
          >
            继续摇
          </button>
        </div>
      ) : null}
      {state.phase === "complete" ? <p className="good-text">六爻已成，正在排盘。</p> : null}
      <ThrowRecord throws={state.throws} />
    </section>
  );
}
