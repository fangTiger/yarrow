import type { ReactNode } from "react";
import type { NamingFormValues, NamingTarget } from "../lib/home-entry.js";
import { BirthFields } from "./BirthFields.js";
import { type TFunction, useT } from "../lib/i18n.js";

function targetLabel(target: NamingTarget, t: TFunction): string {
  return t(target === "person" ? "naming.person" : "naming.business");
}

/** 起名专用细项；生辰完全由父组件独立持有，不读写本人档案。 */
export function NamingFields(props: {
  value: NamingFormValues;
  birthProblem: string | null;
  questionField?: ReactNode;
  onChange(value: NamingFormValues): void;
}) {
  const t = useT();
  const { value } = props;
  const update = (patch: Partial<NamingFormValues>) => props.onChange({ ...value, ...patch });
  const targetOptions = (["person", "business"] as const);
  const targetRow = (
    <div aria-label={t("naming.targetGroup")} className="detail-row" role="group">
      <span className="detail-label">{t("naming.target")}</span>
      <div className="chips">
        {targetOptions.map((target) => (
          <button
            aria-pressed={value.target === target}
            className="chip"
            key={target}
            onClick={() => update({
              target,
              length: target === "person" ? 2 : 2,
              unborn: target === "person" ? value.unborn : false,
              birth: target === "business" && value.birth.gender === "any"
                ? { ...value.birth, gender: "" }
                : value.birth,
            })}
            type="button"
          >
            {targetLabel(target, t)}
          </button>
        ))}
      </div>
    </div>
  );
  if (value.target === "business") {
    return (
      <div className="naming-fields">
        {targetRow}
        {props.questionField}
        <div aria-label={t("naming.businessLengthGroup")} className="detail-row" role="group">
          <span className="detail-label">{t("naming.length")}</span>
          <div className="chips">
            {([2, 3, 4] as const).map((length) => (
              <button
                aria-pressed={value.length === length}
                className="chip"
                key={length}
                onClick={() => update({ length })}
                type="button"
              >
                {t("naming.characters", { count: length })}
              </button>
            ))}
          </div>
        </div>
        <details
          className="owner-birth"
          onToggle={(event) => update({ ownerBirthEnabled: event.currentTarget.open })}
          open={value.ownerBirthEnabled}
        >
          <summary>{t("naming.ownerBirth")}</summary>
          <BirthFields
            onChange={(birth) => update({ birth })}
            problem={props.birthProblem}
            values={value.birth}
          />
        </details>
        <p className="hint business-note">{t("naming.businessNote")}</p>
      </div>
    );
  }
  return (
    <div className="naming-fields">
      {targetRow}
      <label className="naming-surname">
        <span>{t("naming.surname")}</span>
        <input
          aria-label={t("naming.surname")}
          maxLength={2}
          onChange={(event) => update({ surname: event.target.value })}
          placeholder={t("naming.surnamePlaceholder")}
          value={value.surname}
        />
      </label>
      <div aria-label={t("naming.nameLengthGroup")} className="detail-row" role="group">
        <span className="detail-label">{t("naming.length")}</span>
        <div className="chips">
          {([[1, "naming.singleName"], [2, "naming.doubleName"]] as const).map(([length, key]) => (
            <button aria-pressed={value.length === length} className="chip" key={length}
              onClick={() => update({ length })} type="button">{t(key)}</button>
          ))}
        </div>
      </div>
      <BirthFields
        mode="naming"
        onChange={(birth) => update({ birth })}
        onUnbornChange={(unborn) => update({
          unborn,
          birth: unborn ? { ...value.birth, time: "" } : {
            ...value.birth, gender: value.birth.gender === "any" ? "" : value.birth.gender,
          },
        })}
        problem={props.birthProblem}
        unborn={value.unborn}
        values={value.birth}
      />
      {props.questionField}
    </div>
  );
}
