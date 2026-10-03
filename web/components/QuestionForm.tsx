// web/components/QuestionForm.tsx
import { useEffect, useState } from "react";
import { api, type Classification } from "../lib/api.js";
import {
  ClassificationTags,
  type ClassificationView,
} from "./ClassificationTags.js";
import { PaymentButton } from "./PaymentButton.js";
function fromClassification(value: Classification): ClassificationView {
  const item = value as Classification & { subject?: { label?: string }; horizon?: string };
  return {
    question: item.question,
    kind: item.kind,
    supported: item.supported,
    ...(item.subject?.key ? { subjectKey: item.subject.key } : {}),
    ...(item.subject?.label ? { subject: item.subject.label } : {}),
    ...(item.horizon ? { horizon: item.horizon } : {}),
    ...(item.suggestion ? { suggestion: item.suggestion } : {}),
  };
}
export function QuestionForm() {
  const [question, setQuestion] = useState("");
  const [view, setView] = useState<ClassificationView>();
  const [error, setError] = useState("");
  const [classifying, setClassifying] = useState(false);
  const length = [...question.trim()].length;
  const valid = length >= 4 && length <= 280;
  useEffect(() => {
    if (!valid) return;
    let active = true;
    const timer = setTimeout(() => {
      setClassifying(true);
      void api.classify(question).then((value) => {
        if (active) { setView(fromClassification(value)); setError(""); }
      }).catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "分类暂不可用");
      }).finally(() => { if (active) setClassifying(false); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [question, valid]);
  const changeToQuestion = () => setView({
    question, kind: "question", supported: true, subjectKey: "peers", subject: "人际／同辈",
  });
  const changeSubject = (subjectKey: string, subject: string) => setView({
    question,
    kind: "question",
    supported: true,
    subjectKey,
    subject,
  });
  const changeKind = (kind: "question" | "destiny" | "fortune") => {
    if (kind === "question") {
      changeToQuestion();
      return;
    }
    setView({
      question,
      kind,
      supported: true,
      ...(kind === "fortune" ? { horizon: "year" } : {}),
    });
  };
  return (
    <form className="panel" onSubmit={(event) => event.preventDefault()}>
      <h1>所问之事</h1>
      <textarea
        aria-label="所问之事"
        className="question-input"
        maxLength={280}
        minLength={4}
        placeholder="例如：这次面试能过吗？"
        onChange={(event) => {
          setQuestion(event.target.value);
          setView(undefined);
          setClassifying(false);
          setError("");
        }}
        value={question}
      />
      {classifying ? <p className="hint" role="status">识别中</p> : null}
      {view ? (
        <ClassificationTags
          onKindChange={changeKind}
          onQuestionFallback={changeToQuestion}
          onSubjectChange={changeSubject}
          view={view}
        />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {valid && view?.kind === "question" && view.supported ? (
        <PaymentButton question={question} classification={view} />
      ) : (
        <button className="button button-primary" disabled type="button">问卦 · 0.05 USDC</button>
      )}
    </form>
  );
}
