// web/components/HistoryMenu.tsx
import { useEffect, useState } from "react";
import type { RecentReading } from "../lib/recent-readings.js";
import { useT } from "../lib/i18n.js";

function shortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 右上角「卦历」小图标：点开以浮层列出本机最近记录。 */
export function HistoryMenu(props: { readings: readonly RecentReading[]; defaultOpen?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    // 点浮层以外或按 Esc 关闭。
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") {
        return;
      }
      const inside = event.target instanceof Element && event.target.closest(".history-menu") !== null;
      if (event.type === "click" && inside) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const count = props.readings.length;
  return (
    <div className="history-menu">
      <button
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("history.label", { count })}
        className="history-button"
        onClick={() => setOpen(!open)}
        title={t("history.title")}
        type="button"
      >
        <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
          <circle cx="12" cy="12" fill="none" r="8.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 7.5V12l3 2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        </svg>
        {count > 0 ? <span className="history-count">{count}</span> : null}
      </button>
      {open ? (
        <div aria-label={t("history.title")} className="history-pop">
          <p className="history-title">{t("history.title")}</p>
          {count > 0 ? (
            <ul className="history-list">
              {props.readings.map((item) => (
                <li key={item.id}>
                  <a href={`#/r/${item.id}`}>
                    <span className="history-kind">{
                      t(`kind.${["question", "fortune", "destiny", "naming"].includes(item.kind)
                        ? item.kind as "question" | "fortune" | "destiny" | "naming"
                        : "question"}`)
                    }</span>
                    <span className="history-question">{item.question}</span>
                    <time>{shortTime(item.createdAt)}</time>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">{t("history.empty")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
