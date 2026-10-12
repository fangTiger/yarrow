// web/components/ThrowRecord.tsx
import type { ThrowResult } from "../lib/api.js";
import { useT } from "../lib/i18n.js";

function lineName(index: number, t: ReturnType<typeof useT>): string {
  if (index === 1) return t("throw.firstLine");
  if (index === 6) return t("throw.topLine");
  return t("throw.numberedLine", { number: index });
}

function castName(value: number, t: ReturnType<typeof useT>): string {
  const key = value === 6 ? "throw.oldYin" : value === 7 ? "throw.youngYang"
    : value === 8 ? "throw.youngYin" : "throw.oldYang";
  return t(key);
}

export function ThrowRecord({ throws }: { throws: readonly ThrowResult[] }) {
  const t = useT();
  return (
    <div aria-label={t("throw.recordLabel")} className="throw-record">
      <span className="label">{t("throw.title")}</span>
      {[...throws].reverse().map((item) => (
        <div className={item.moving ? "throw moving" : "throw"} key={item.index}>
          <span>{lineName(item.index, t)}</span>
          <span aria-label={t("throw.backs", { count: item.backs })} className="coins">
            {item.coins.map((coin, index) => (
              <i className={coin === 1 ? "coin back" : "coin face"} key={index} />
            ))}
          </span>
          <span>
            {t("throw.backs", { count: item.backs })} · {castName(item.value, t)}
            {item.moving ? ` · ${t("throw.moving")}` : ""}
          </span>
        </div>
      ))}
      <p className="legend">{t("throw.legend")}</p>
    </div>
  );
}
