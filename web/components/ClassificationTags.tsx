import { QUESTION_SUBJECTS } from "../../src/oracle/question-classifier.js";
// web/components/ClassificationTags.tsx
export interface ClassificationView {
  question: string;
  kind: string;
  supported: boolean;
  subjectKey?: string;
  subject?: string;
  horizon?: string;
  suggestion?: string;
}
interface ClassificationTagsProps {
  view: ClassificationView;
  onKindChange(kind: "question" | "destiny" | "fortune"): void;
  onQuestionFallback(): void;
  onSubjectChange(subjectKey: string, label: string): void;
}
const KINDS = [
  ["question", "问事"],
  ["destiny", "命理"],
  ["fortune", "运势"],
] as const;
const SUBJECTS = QUESTION_SUBJECTS.map(({ key, label }) => [key, label] as const);
export function ClassificationTags(props: ClassificationTagsProps) {
  const { view } = props;
  return (
    <section aria-label="分类结果">
      <div className="tags">
        {KINDS.map(([kind, label]) => (
          <button
            className="tag"
            key={kind}
            onClick={() => props.onKindChange(kind)}
            type="button"
          >
            {label}
          </button>
        ))}
        {view.subject ? <span className="tag">{view.subject}</span> : null}
        {view.horizon ? <span className="tag">{view.horizon}</span> : null}
      </div>
      {view.kind === "question" ? (
        <div className="tags" aria-label="改事项">
          {SUBJECTS.map(([key, label]) => (
            <button
              className="tag"
              key={key}
              onClick={() => props.onSubjectChange(key, label)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {!view.supported && view.suggestion ? <p>{view.suggestion}</p> : null}
      {view.kind !== "question" ? (
        <button onClick={props.onQuestionFallback} type="button">
          改为问事
        </button>
      ) : null}
    </section>
  );
}
