// web/components/BirthFields.tsx
import {
  LUNAR_DAYS, LUNAR_MONTHS, solarDateValue, withSolarDate, type BirthFormValues,
} from "../lib/birth-profile.js";

interface BirthFieldsProps {
  values: BirthFormValues;
  remember: boolean;
  problem: string | null;
  onChange(values: BirthFormValues): void;
  onRememberChange(remember: boolean): void;
}

/** 首页内嵌的生辰行：只收出生日期、时辰（或不知道）与性别。 */
export function BirthFields(props: BirthFieldsProps) {
  const { values } = props;
  const solar = values.calendar === "solar";
  const started = [values.year, values.month, values.day, values.time].some((value) => value !== "");
  function update(patch: Partial<BirthFormValues>): void {
    props.onChange({ ...values, ...patch });
  }
  function switchCalendar(calendar: BirthFormValues["calendar"]): void {
    if (calendar === values.calendar) {
      return;
    }
    // 公历与农历的月日含义不同，切换时只保留年份。
    update({ calendar, month: "", day: "", isLeapMonth: false });
  }
  return (
    <fieldset className="birth-row">
      <legend>生辰</legend>
      <div className="birth-line">
        <div aria-label="历法" className="seg" role="group">
          <button aria-pressed={solar} onClick={() => switchCalendar("solar")} type="button">公历</button>
          <button aria-pressed={!solar} onClick={() => switchCalendar("lunar")} type="button">农历</button>
        </div>
        {solar ? (
          <input
            aria-label="出生日期"
            className="birth-input"
            max="2099-12-31"
            min="1900-01-01"
            onChange={(event) => props.onChange(withSolarDate(values, event.target.value))}
            type="date"
            value={solarDateValue(values)}
          />
        ) : (
          <span className="lunar-date">
            <input
              aria-label="农历年"
              className="birth-input year"
              max="2099"
              min="1900"
              onChange={(event) => update({ year: event.target.value })}
              placeholder="年"
              type="number"
              value={values.year}
            />
            <select
              aria-label="农历月"
              className="birth-input"
              onChange={(event) => update({ month: event.target.value })}
              value={values.month}
            >
              <option value="">月</option>
              {LUNAR_MONTHS.map((label, index) => (
                <option key={label} value={String(index + 1)}>{label}</option>
              ))}
            </select>
            <select
              aria-label="农历日"
              className="birth-input"
              onChange={(event) => update({ day: event.target.value })}
              value={values.day}
            >
              <option value="">日</option>
              {LUNAR_DAYS.map((label, index) => (
                <option key={label} value={String(index + 1)}>{label}</option>
              ))}
            </select>
            <label className="check">
              <input
                checked={values.isLeapMonth}
                onChange={(event) => update({ isLeapMonth: event.target.checked })}
                type="checkbox"
              />
              闰月
            </label>
          </span>
        )}
        <input
          aria-label="出生时间"
          className="birth-input"
          disabled={values.unknownTime}
          onChange={(event) => update({ time: event.target.value })}
          type="time"
          value={values.time}
        />
        <label className="check">
          <input
            checked={values.unknownTime}
            onChange={(event) => update({ unknownTime: event.target.checked })}
            type="checkbox"
          />
          不知道时辰
        </label>
        <div aria-label="性别" className="seg" role="group">
          {(["male", "female"] as const).map((gender) => (
            <button
              aria-pressed={values.gender === gender}
              key={gender}
              onClick={() => update({ gender })}
              type="button"
            >
              {gender === "male" ? "男" : "女"}
            </button>
          ))}
        </div>
      </div>
      <label className="check">
        <input
          checked={props.remember}
          onChange={(event) => props.onRememberChange(event.target.checked)}
          type="checkbox"
        />
        记住为本人生辰（仅存本机）
      </label>
      <p className="hint">生辰只存本机；解读时会发送给模型，分享链接会显示命盘（可反推出生日期）。</p>
      {started && props.problem ? <p className="error" role="alert">{props.problem}</p> : null}
    </fieldset>
  );
}
