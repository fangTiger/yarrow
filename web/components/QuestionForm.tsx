// web/components/QuestionForm.tsx
import { useEffect, useState } from "react";
import { api, type Classification } from "../lib/api.js";
import {
  ClassificationTags,
  type ClassificationView,
} from "./ClassificationTags.js";
import { entryHorizon } from "../lib/birth-entry.js";
import { BirthEntry } from "./BirthEntry.js";
import { birthSummary, loadBirthProfile, type BirthProfileInput } from "../lib/birth-profile.js";
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
  const [birth, setBirth] = useState<BirthProfileInput | null>(loadBirthProfile);
  const [birthOpen, setBirthOpen] = useState(false);
  const [temporary, setTemporary] = useState(false);
  const [horizon, setHorizon] = useState("year");
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
        if (active) {
          const nextView = fromClassification(value);
          setView(nextView);
          setHorizon(entryHorizon(nextView.horizon));
          setError("");
        }
      }).catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "分类暂不可用");
      }).finally(() => { if (active) setClassifying(false); });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [question, valid]);
  const changeToQuestion = () => {
    setBirthOpen(false);
    setView({
    question, kind: "question", supported: true, subjectKey: "peers", subject: "人际／同辈",
    });
  };
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
  const available = valid && view && ["question", "destiny", "fortune"].includes(view.kind) && view.supported;
  let payment = <button className="button button-primary" disabled type="button">问卦 · 0.05 USDC</button>;
  if (available && view) {
    payment = <BirthEntry kind={view.kind} birth={birth} open={birthOpen} temporary={temporary} onOpen={() => {
          setTemporary(false);
          setBirthOpen(true);
        }} onBirth={(input) => {
          setBirth(input);
          setBirthOpen(false);
        }} onFallback={changeToQuestion} onCancel={() => setBirthOpen(false)} payment={() => <PaymentButton question={question} classification={{ ...view, horizon: horizon === "custom" ? (view.horizon ?? "year:2026") : horizon }} birth={birth} onMissingBirth={() => setBirthOpen(true)} />} />;
    if (view.kind === "question") {
      payment = <PaymentButton question={question} classification={view} />;
    }
  }
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
      {view?.kind === "fortune" ? <label>时间范围<select aria-label="时间范围" value={horizon} onChange={(event) => setHorizon(event.target.value)}>
        <option value="today">今天</option><option value="month">本月</option><option value="year">今年</option><option value="next-year">明年</option><option value="custom">指定年份</option>
      </select></label> : null}
      {horizon === "custom" ? <label>指定年份<input type="number" min="1900" max="2099" value={view?.horizon?.replace("year:", "") ?? "2026"} onChange={(event) => setView((previous) => previous ? { ...previous, horizon: `year:${event.target.value}` } : previous)} /></label> : null}
      {view && ["destiny", "fortune"].includes(view.kind) && birth ? <p>{birthSummary(birth)} · <button type="button" onClick={() => {
          setTemporary(false);
          setBirthOpen(true);
        }}>修改</button><button type="button" onClick={() => {
          setTemporary(true);
          setBirthOpen(true);
        }}>本次临时换一个生辰</button></p> : null}
      {error ? <p className="error">{error}</p> : null}
      {payment}
    </form>
  );
}
