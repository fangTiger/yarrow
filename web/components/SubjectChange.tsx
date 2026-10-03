// web/components/SubjectChange.tsx
import { useState } from "react";
import { QUESTION_SUBJECTS } from "../../src/oracle/question-classifier.js";
import { api, type PublicReading } from "../lib/api.js";

export function SubjectChange(props: {
  reading: PublicReading;
  onReading: (reading: PublicReading) => void;
}) {
  const [selected, setSelected] = useState(props.reading.subject.finalKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remaining = Math.max(0, 3 - props.reading.subject.changes);
  const jingfangBusy = ["pending", "writing"].includes(props.reading.schools.jingfang.status);
  const disabled = busy || remaining === 0 || jingfangBusy || selected === props.reading.subject.finalKey;
  const changeSelected = (value: string) => {
    const subject = QUESTION_SUBJECTS.find((item) => item.key === value);
    if (subject) {
      setSelected(subject.key);
    }
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      props.onReading(await api.changeSubject(props.reading.id, selected));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "事项未能修改");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="subject-change">
      <label htmlFor="subject-change">事项修改（还可 {remaining} 次）</label>
      <select
        id="subject-change"
        onChange={(event) => changeSelected(event.target.value)}
        value={selected}
      >
        {QUESTION_SUBJECTS.map((item) => (
          <option key={item.key} value={item.key}>{item.label}</option>
        ))}
      </select>
      <button
        className="button"
        disabled={disabled}
        onClick={() => void submit()}
        type="button"
      >
        确认修改
      </button>
      {jingfangBusy ? <p className="hint">京房正在落笔，完成后才可改事项。</p> : null}
      {remaining === 0 ? <p className="hint">本卦三次事项修改已用尽。</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
