import type { ReactNode } from "react";
import type { NamingFormValues, NamingTarget } from "../lib/home-entry.js";
import { BirthFields } from "./BirthFields.js";

function targetLabel(target: NamingTarget): string {
  return target === "person" ? "人名" : "商号";
}

/** 起名专用细项；生辰完全由父组件独立持有，不读写本人档案。 */
export function NamingFields(props: {
  value: NamingFormValues;
  birthProblem: string | null;
  questionField?: ReactNode;
  onChange(value: NamingFormValues): void;
}) {
  const { value } = props;
  const update = (patch: Partial<NamingFormValues>) => props.onChange({ ...value, ...patch });
  const targetOptions = (["person", "business"] as const);
  const targetRow = (
    <div aria-label="起名对象" className="detail-row" role="group">
      <span className="detail-label">对象</span>
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
            {targetLabel(target)}
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
        <div aria-label="字号字数" className="detail-row" role="group">
          <span className="detail-label">字数</span>
          <div className="chips">
            {([2, 3, 4] as const).map((length) => (
              <button aria-pressed={value.length === length} className="chip" key={length}
                onClick={() => update({ length })} type="button">{length} 字</button>
            ))}
          </div>
        </div>
        <details
          className="owner-birth"
          onToggle={(event) => update({ ownerBirthEnabled: event.currentTarget.open })}
          open={value.ownerBirthEnabled}
        >
          <summary>加上店主生辰（选填，用于五行补益）</summary>
          <BirthFields
            onChange={(birth) => update({ birth })}
            problem={props.birthProblem}
            values={value.birth}
          />
        </details>
        <p className="hint business-note">字号请自行查询商标与工商登记是否可用。</p>
      </div>
    );
  }
  return (
    <div className="naming-fields">
      {targetRow}
      <label className="naming-surname">
        <span>姓氏</span>
        <input
          aria-label="姓氏"
          maxLength={2}
          onChange={(event) => update({ surname: event.target.value })}
          placeholder="支持复姓"
          value={value.surname}
        />
      </label>
      <div aria-label="名字字数" className="detail-row" role="group">
        <span className="detail-label">字数</span>
        <div className="chips">
          {([[1, "单名"], [2, "双名"]] as const).map(([length, label]) => (
            <button aria-pressed={value.length === length} className="chip" key={length}
              onClick={() => update({ length })} type="button">{label}</button>
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
