// web/components/HorizonChips.tsx
import { HORIZON_OPTIONS, horizonLabel } from "../lib/home-entry.js";
import { useT } from "../lib/i18n.js";

/** 运势的时间范围：今天、本月、今年、明年；识别到指定年份时另列一项。 */
export function HorizonChips(props: { value: string; onChange(horizon: string): void }) {
  const t = useT();
  const options: (readonly [string, string])[] = HORIZON_OPTIONS
    .map(([value]) => [value, horizonLabel(value, t)]);
  if (props.value.startsWith("year:")) {
    options.push([props.value, horizonLabel(props.value, t)]);
  }
  return (
    <div aria-label={t("horizon.group")} className="detail-row" role="group">
      <span className="detail-label">{t("horizon.field")}</span>
      <div className="chips">
        {options.map(([value, label]) => (
          <button
            aria-pressed={props.value === value}
            className="chip"
            key={value}
            onClick={() => props.onChange(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
