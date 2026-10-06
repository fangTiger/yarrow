// web/components/QuestionForm.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import {
  EMPTY_BIRTH, birthProblem, fromBirthInput, loadBirthProfile, toBirthInput, useBirthProfile,
  type BirthFormValues,
} from "../lib/birth-profile.js";
import {
  PLACEHOLDERS, autoHint, deriveEntry, entryGate, fromClassification, paymentClassification,
  type ClassificationView, type EntryChoice,
} from "../lib/home-entry.js";
import { BirthFields } from "./BirthFields.js";
import { HorizonChips } from "./HorizonChips.js";
import { KindOptions } from "./KindOptions.js";
import { PaymentButton } from "./PaymentButton.js";
import { SubjectSelect } from "./SubjectSelect.js";

function initialBirthValues(): BirthFormValues {
  const stored = loadBirthProfile();
  return stored ? fromBirthInput(stored) : EMPTY_BIRTH;
}

/** 首页中间的问卦表单：类型选项、细项、问题框、命理运势的生辰行与问卦按钮。 */
export function QuestionForm() {
  const [question, setQuestion] = useState("");
  const [view, setView] = useState<ClassificationView>();
  const [choice, setChoice] = useState<EntryChoice>({});
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState("");
  const [birthValues, setBirthValues] = useState<BirthFormValues>(initialBirthValues());
  const [remember, setRemember] = useState(true);
  const length = [...question.trim()].length;
  const valid = length >= 4 && length <= 280;
  useEffect(() => {
    if (!valid) {
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      setClassifying(true);
      void api.classify(question).then((value) => {
        if (active) {
          setView(fromClassification(value));
          setError("");
        }
      }).catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "识别暂不可用，可直接点选类型");
        }
      }).finally(() => {
        if (active) {
          setClassifying(false);
        }
      });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [question, valid]);
  const entry = deriveEntry(view, choice);
  const problem = birthProblem(birthValues);
  const gate = entryGate({
    questionLength: length, classified: view !== undefined, entry, birthProblem: problem,
  });
  // 分类结果一到就显示结果，不再停留在「识别中」。
  let status = "";
  if (entry.unsupported) {
    status = entry.unsupported;
  } else if (view) {
    status = autoHint(entry) ?? "";
  } else if (classifying) {
    status = "识别中";
  }
  const saveBirth = (values: BirthFormValues, keep: boolean) => {
    if (keep && birthProblem(values) === null) {
      useBirthProfile(toBirthInput(values), true);
    }
  };
  const needsBirth = entry.kind !== "question";
  return (
    <form className="home-form" onSubmit={(event) => event.preventDefault()}>
      <h1 className="ask-title">想问什么？</h1>
      <KindOptions onChange={(kind) => setChoice({ ...choice, kind })} value={entry.kind} />
      {entry.kind === "question" ? (
        <SubjectSelect
          detected={view?.subject ?? ""}
          onChange={(subjectKey, subject) => setChoice({ ...choice, subjectKey, subject })}
          value={choice.subjectKey ?? ""}
        />
      ) : null}
      {entry.kind === "fortune" ? (
        <HorizonChips onChange={(horizon) => setChoice({ ...choice, horizon })} value={entry.horizon} />
      ) : null}
      <textarea
        aria-label="所问之事"
        className="question-input"
        maxLength={280}
        minLength={4}
        onChange={(event) => {
          setQuestion(event.target.value);
          setView(undefined);
          setClassifying(false);
          setError("");
        }}
        placeholder={PLACEHOLDERS[entry.kind]}
        value={question}
      />
      {status ? <p className="hint status" role="status">{status}</p> : null}
      {needsBirth ? (
        <BirthFields
          onChange={(values) => {
            setBirthValues(values);
            saveBirth(values, remember);
          }}
          onRememberChange={(keep) => {
            setRemember(keep);
            saveBirth(birthValues, keep);
          }}
          problem={problem}
          remember={remember}
          values={birthValues}
        />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {gate.ready ? (
        <PaymentButton
          birth={needsBirth ? toBirthInput(birthValues) : null}
          classification={paymentClassification(entry, question)}
          onMissingBirth={() => setError("请先填好生辰")}
          question={question}
        />
      ) : (
        <button className="button button-primary" disabled type="button">问卦 · 0.05 USDC</button>
      )}
      {!gate.ready && gate.reason && gate.reason !== status ? (
        <p className="hint gate">{gate.reason}</p>
      ) : null}
    </form>
  );
}
