// web/components/SubjectSelect.tsx
import { QUESTION_SUBJECTS } from "../../src/oracle/question-classifier.js";

/** 问事的事项下拉：默认自动识别，也可手选；事项决定六爻用神。 */
export function SubjectSelect(props: { value: string; detected: string; onChange(key: string, label: string): void }) {
  const auto = props.detected ? `自动识别（${props.detected}）` : "自动识别";
  return (
    <label className="detail-row">
      <span className="detail-label">事项</span>
      <select
        aria-label="事项"
        className="detail-select"
        onChange={(event) => {
          const item = QUESTION_SUBJECTS.find(({ key }) => key === event.target.value);
          props.onChange(item?.key ?? "", item?.label ?? "");
        }}
        value={props.value}
      >
        <option value="">{auto}</option>
        {QUESTION_SUBJECTS.map(({ key, label }) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </label>
  );
}
