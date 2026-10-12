// web/components/BirthFields.tsx
import {
  COMMON_TIME_ZONES,
  LUNAR_DAYS,
  LUNAR_MONTHS,
  type BirthFormValues,
} from "../lib/birth-profile.js";
import { useLang, useT } from "../lib/i18n.js";

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
  const t = useT();
  const { lang } = useLang();
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
      <legend>{t(unborn ? "birth.dueDate" : "birth.legend")}</legend>
      {naming ? (
        <label className="check unborn-check">
          <input
            checked={unborn}
            onChange={(event) => props.onUnbornChange?.(event.target.checked)}
            type="checkbox"
          />
          {t("birth.unborn")}
        </label>
      ) : null}
      <div className="birth-line">
        <div aria-label={t("birth.calendar")} className="seg" role="group">
          <button aria-pressed={solar} onClick={() => switchCalendar("solar")} type="button">
            {t("birth.solar")}
          </button>
          <button aria-pressed={!solar} onClick={() => switchCalendar("lunar")} type="button">
            {t("birth.lunar")}
          </button>
        </div>
        {solar ? (
          <input
            aria-label={t(unborn ? "birth.dueDate" : "birth.date")}
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
              aria-label={t("birth.lunarYear")}
              className="birth-input year"
              max="2099"
              min="1900"
              onChange={(event) => update({ year: event.target.value })}
              placeholder={t("birth.yearPlaceholder")}
              type="number"
              value={values.year}
            />
            <select
              aria-label={t("birth.lunarMonth")}
              className="birth-input"
              onChange={(event) => update({ month: event.target.value })}
              value={values.month}
            >
              <option value="">{t("birth.monthPlaceholder")}</option>
              {LUNAR_MONTHS.map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {lang === "zh" ? label : `Month ${index + 1}`}
                </option>
              ))}
            </select>
            <select
              aria-label={t("birth.lunarDay")}
              className="birth-input"
              onChange={(event) => update({ day: event.target.value })}
              value={values.day}
            >
              <option value="">{t("birth.dayPlaceholder")}</option>
              {LUNAR_DAYS.map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {lang === "zh" ? label : `Day ${index + 1}`}
                </option>
              ))}
            </select>
            <label className="check">
              <input
                checked={values.isLeapMonth}
                onChange={(event) => update({ isLeapMonth: event.target.checked })}
                type="checkbox"
              />
              {t("birth.leapMonth")}
            </label>
          </span>
        )}
        {!unborn ? (
          <label className="birth-time">
            <span>{t("birth.timeOptional")}</span>
            <input
              aria-label={t("birth.timeLabel")}
              className="birth-input"
              onChange={(event) => update({ time: event.target.value })}
              type="time"
              value={values.time}
            />
          </label>
        ) : null}
        <label className="birth-time birth-zone">
          <span>{t("birth.timeZone")}</span>
          <select
            aria-label={t("birth.timeZone")}
            className="birth-input"
            onChange={(event) => update({
              timeZone: event.target.value === "__other__" ? "" : event.target.value,
            })}
            value={commonTimeZone ? values.timeZone : "__other__"}
          >
            {COMMON_TIME_ZONES.map((timeZone) => (
              <option key={timeZone} value={timeZone}>{timeZone}</option>
            ))}
            <option value="__other__">{t("birth.otherTimeZone")}</option>
          </select>
          {!commonTimeZone ? (
            <input
              aria-label={t("birth.otherTimeZoneLabel")}
              className="birth-input"
              onChange={(event) => update({ timeZone: event.target.value })}
              placeholder={t("birth.timeZoneExample")}
              type="text"
              value={values.timeZone}
            />
          ) : null}
        </label>
        <div aria-label={t("birth.gender")} className="seg" role="group">
          {(["male", "female", ...(unborn ? ["any" as const] : [])] as const).map((gender) => (
            <button
              aria-pressed={values.gender === gender}
              key={gender}
              onClick={() => update({ gender })}
              type="button"
            >
              {t(gender === "male" ? "birth.male" : gender === "female" ? "birth.female" : "birth.any")}
            </button>
          ))}
        </div>
      </div>
      {dated && (unborn || values.time === "") ? (
        <p className="hint">
          {t(unborn ? "birth.dueThreePillars" : "birth.threePillars")}
        </p>
      ) : null}
      {started && props.problem ? <p className="error" role="alert">{props.problem}</p> : null}
    </fieldset>
  );
}
