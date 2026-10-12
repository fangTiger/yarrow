// web/components/BirthFields.tsx
import {
  COMMON_TIME_ZONES,
  LUNAR_DAYS,
  LUNAR_MONTHS,
  type BirthFormValues,
} from "../lib/birth-profile.js";

type BirthFieldValues = Omit<BirthFormValues, "gender"> & {
  gender: BirthFormValues["gender"] | "any";
};

interface BirthFieldsProps<T extends BirthFieldValues> {
  values: T;
  problem: string | null;
  onChange(values: T): void;
  mode?: "default" | "naming";
  unborn?: boolean;
  onUnbornChange?(value: boolean): void;
}

/** 首页内嵌的生辰行：只收出生日期、时间（选填，空着按三柱）与性别。 */
export function BirthFields<T extends BirthFieldValues>(props: BirthFieldsProps<T>) {
  const { values } = props;
  const solar = values.calendar === "solar";
  const naming = props.mode === "naming";
  const unborn = naming && props.unborn === true;
  const started = [values.year, values.month, values.day, values.time].some((value) => value !== "");
  const dated = [values.year, values.month, values.day].every((value) => value !== "");
  const commonTimeZone = (COMMON_TIME_ZONES as readonly string[]).includes(values.timeZone);
  function update(patch: Partial<BirthFieldValues>): void {
    props.onChange({ ...values, ...patch } as T);
  }
  function switchCalendar(calendar: BirthFormValues["calendar"]): void {
    if (calendar === values.calendar) {
      return;
    }
    // 公历与农历的月日含义不同，切换时只保留年份。
    update({ calendar, month: "", day: "", isLeapMonth: false });
  }
  function solarValue(): string {
    if (!values.year || !values.month || !values.day) return "";
    return `${values.year.padStart(4, "0")}-${values.month.padStart(2, "0")}-${values.day.padStart(2, "0")}`;
  }
  function setSolarDate(value: string): void {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
    update(match
      ? { year: match[1]!, month: String(Number(match[2])), day: String(Number(match[3])) }
      : { year: "", month: "", day: "" });
  }
  return (
    <fieldset className="birth-row">
      <legend>{unborn ? "预产期" : "生辰"}</legend>
      {naming ? (
        <label className="check unborn-check">
          <input
            checked={unborn}
            onChange={(event) => props.onUnbornChange?.(event.target.checked)}
            type="checkbox"
          />
          还没出生（按预产期）
        </label>
      ) : null}
      <div className="birth-line">
        <div aria-label="历法" className="seg" role="group">
          <button aria-pressed={solar} onClick={() => switchCalendar("solar")} type="button">公历</button>
          <button aria-pressed={!solar} onClick={() => switchCalendar("lunar")} type="button">农历</button>
        </div>
        {solar ? (
          <input
            aria-label={unborn ? "预产期" : "出生日期"}
            className="birth-input"
            max="2099-12-31"
            min="1900-01-01"
            onChange={(event) => setSolarDate(event.target.value)}
            type="date"
            value={solarValue()}
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
        {!unborn ? (
          <label className="birth-time">
            <span>时间（选填）</span>
            <input
              aria-label="出生时间（选填）"
              className="birth-input"
              onChange={(event) => update({ time: event.target.value })}
              type="time"
              value={values.time}
            />
          </label>
        ) : null}
        <label className="birth-time birth-zone">
          <span>出生地时区</span>
          <select
            aria-label="出生地时区"
            className="birth-input"
            onChange={(event) => update({
              timeZone: event.target.value === "__other__" ? "" : event.target.value,
            })}
            value={commonTimeZone ? values.timeZone : "__other__"}
          >
            {COMMON_TIME_ZONES.map((timeZone) => (
              <option key={timeZone} value={timeZone}>{timeZone}</option>
            ))}
            <option value="__other__">其他</option>
          </select>
          {!commonTimeZone ? (
            <input
              aria-label="其他 IANA 出生地时区"
              className="birth-input"
              onChange={(event) => update({ timeZone: event.target.value })}
              placeholder="如 Europe/London"
              type="text"
              value={values.timeZone}
            />
          ) : null}
        </label>
        <div aria-label="性别" className="seg" role="group">
          {(["male", "female", ...(unborn ? ["any" as const] : [])] as const).map((gender) => (
            <button
              aria-pressed={values.gender === gender}
              key={gender}
              onClick={() => update({ gender })}
              type="button"
            >
              {gender === "male" ? "男" : gender === "female" ? "女" : "不限"}
            </button>
          ))}
        </div>
      </div>
      {dated && (unborn || values.time === "") ? (
        <p className="hint">
          {unborn ? "按预产期三柱推算，时辰不详" : "未填时间，按年月日三柱推算"}
        </p>
      ) : null}
      {started && props.problem ? <p className="error" role="alert">{props.problem}</p> : null}
    </fieldset>
  );
}
