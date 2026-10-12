// web/components/SubjectSelect.tsx
import { QUESTION_SUBJECTS } from "../../src/oracle/question-classifier.js";
import { subjectLabel } from "../lib/home-entry.js";
import { useT } from "../lib/i18n.js";

/** 问事的事项下拉：默认自动识别，也可手选；事项决定六爻用神。 */
export function SubjectSelect(props: {
  value: string;
  detected: string;
  onChange(key: string, label: string): void;
}) {
  const t = useT();
  const detected = props.detected ? subjectLabel(props.detected, t, props.detected) : "";
  const auto = detected ? t("subject.autoDetected", { subject: detected }) : t("subject.auto");
  return (
    <label className="detail-row">
      <span className="detail-label">{t("subject.field")}</span>
      <select
        aria-label={t("subject.field")}
        className="detail-select"
        onChange={(event) => {
          const item = QUESTION_SUBJECTS.find(({ key }) => key === event.target.value);
          props.onChange(item?.key ?? "", item?.label ?? "");
        }}
        value={props.value}
      >
        <option value="">{auto}</option>
        {QUESTION_SUBJECTS.map(({ key, label }) => (
          <option key={key} value={key}>{subjectLabel(key, t, label)}</option>
        ))}
      </select>
    </label>
  );
}
