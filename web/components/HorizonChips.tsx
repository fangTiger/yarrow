// web/components/HorizonChips.tsx
import { HORIZON_OPTIONS, horizonLabel } from "../lib/home-entry.js";

/** 运势的时间范围：今天、本月、今年、明年；识别到指定年份时另列一项。 */
export function HorizonChips(props: { value: string; onChange(horizon: string): void }) {
  const options: (readonly [string, string])[] = [...HORIZON_OPTIONS];
  if (props.value.startsWith("year:")) {
    options.push([props.value, horizonLabel(props.value)]);
  }
  return (
    <div aria-label="时间范围" className="detail-row" role="group">
      <span className="detail-label">时间</span>
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
