// web/components/QuestionForm.tsx
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import {
  EMPTY_BIRTH, birthProblem, fromBirthInput, loadBirthProfile, saveBirthProfile, toBirthInput,
  type BirthFormValues,
} from "../lib/birth-profile.js";
import {
  DEFAULT_NAMING_FORM, NAMING_PLACEHOLDERS, PLACEHOLDERS, autoHint,
  deriveEntry, entryGate, fromClassification, namingBirthProblem, namingGate, namingRequest,
  paymentClassification, prefillFromHash, submissionQuestion,
  type ClassificationView, type EntryChoice, type HashPrefill, type NamingFormValues,
} from "../lib/home-entry.js";
import { BirthFields } from "./BirthFields.js";
import { HorizonChips } from "./HorizonChips.js";
import { KindOptions } from "./KindOptions.js";
import { NamingFields } from "./NamingFields.js";
import { PaymentButton } from "./PaymentButton.js";
import { SubjectSelect } from "./SubjectSelect.js";
import { useT } from "../lib/i18n.js";
import { FundingGuide } from "./FundingGuide.js";
import { QUESTION_SUBJECTS } from "../../src/oracle/question-classifier.js";
import { ARC_NETWORK } from "../lib/wagmi.js";

function initialBirthValues(): BirthFormValues {
  const stored = loadBirthProfile();
  return stored ? fromBirthInput(stored) : EMPTY_BIRTH;
}

interface HashPrefillNavigation {
  window: {
    addEventListener(type: "hashchange", listener: () => void): void;
    removeEventListener(type: "hashchange", listener: () => void): void;
  };
  location: { hash: string; pathname: string; search: string };
  history: { state: unknown; replaceState(state: unknown, unused: string, url: string): void };
}

/** 首页已挂载时继续响应带参数的 hash 链接，并在读取后清掉一次性参数。 */
export function observeHashPrefill(
  apply: (value: HashPrefill) => void,
  navigation: HashPrefillNavigation = { window, location, history },
): () => void {
  const update = () => {
    const hash = navigation.location.hash;
    if (!hash.startsWith("#/?")) return;
    const value = prefillFromHash(hash);
    if (!value) return;
    apply(value);
    navigation.history.replaceState(
      navigation.history.state,
      "",
      `${navigation.location.pathname}${navigation.location.search}#/`,
    );
  };
  navigation.window.addEventListener("hashchange", update);
  return () => navigation.window.removeEventListener("hashchange", update);
}

/** 首页中间的问卦表单：类型选项、细项、问题框、生辰行与问卦按钮。 */
export function QuestionForm() {
  const t = useT();
  const initialHash = typeof location === "undefined" ? "" : location.hash;
  const [hashPrefill] = useState({
    clear: initialHash.startsWith("#/?"), value: prefillFromHash(initialHash),
  });
  const [question, setQuestion] = useState(hashPrefill.value?.question ?? "");
  const [view, setView] = useState<ClassificationView>();
  const [choice, setChoice] = useState<EntryChoice>(hashPrefill.value?.choice ?? {});
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState("");
  const [birthValues, setBirthValues] = useState<BirthFormValues>(initialBirthValues());
  const [namingValues, setNamingValues] = useState<NamingFormValues>({
    ...DEFAULT_NAMING_FORM, birth: { ...DEFAULT_NAMING_FORM.birth },
  });
  const length = [...question.trim()].length;
  const valid = length >= 4 && length <= 280;
  const formRef = useRef<HTMLFormElement>(null);
  // 预填次数：黄历「看看你今天的运势」、大运「细看这十年」等入口每触发一次加一，用来滚到表单并闪一下。
  const [prefillTick, setPrefillTick] = useState(hashPrefill.value ? 1 : 0);
  useEffect(() => {
    if (!hashPrefill.clear || typeof history === "undefined" || typeof location === "undefined") return;
    history.replaceState(history.state, "", `${location.pathname}${location.search}#/`);
  }, [hashPrefill.clear]);
  useEffect(() => {
    const form = formRef.current;
    if (prefillTick === 0 || !form || typeof window === "undefined") return undefined;
    // 表单常在首屏之下：预填后滚过去，否则用户看不到任何变化。
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    form.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    form.classList.remove("prefilled");
    void form.offsetWidth;
    form.classList.add("prefilled");
    const timer = window.setTimeout(() => form.classList.remove("prefilled"), 1_600);
    return () => window.clearTimeout(timer);
  }, [prefillTick]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof location === "undefined"
      || typeof history === "undefined") return undefined;
    return observeHashPrefill((value) => {
      setQuestion(value.question ?? "");
      setChoice(value.choice);
      // 日主卡等首页内入口会先把刚填的生辰存到本机；响应 hash 时同步带入当前表单。
      const storedBirth = loadBirthProfile();
      if (storedBirth) setBirthValues(fromBirthInput(storedBirth));
      setView(undefined);
      setClassifying(false);
      setError("");
      setPrefillTick((tick) => tick + 1);
    });
  }, []);
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
          setError(t("errors.classifyUnavailable"));
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
  }, [question, t, valid]);
  const entry = deriveEntry(view, choice, t);
  const naming = { ...namingValues, target: entry.target };
  const problem = birthProblem(birthValues, t);
  const namingProblem = namingBirthProblem(naming.birth, naming.unborn, t);
  // 生辰行开始填后会就地报错，按钮下不再重复。
  const birthShown = [birthValues.year, birthValues.month, birthValues.day, birthValues.time]
    .some((value) => value !== "");
  const gate = entry.kind === "naming"
    ? namingGate({ questionLength: length, value: naming, birthProblem: namingProblem }, t)
    : entryGate({
        questionLength: length, classified: view !== undefined, entry, birthProblem: problem, birthShown,
      }, t);
  // 分类结果一到就显示结果，不再停留在「识别中」。
  let status = "";
  if (entry.unsupported) {
    status = entry.unsupported;
  } else if (view) {
    status = autoHint(entry, t) ?? "";
  } else if (classifying) {
    status = t("status.classifying");
  }
  const needsBirth = entry.kind === "fortune" || entry.kind === "destiny";
  const submittedQuestion = submissionQuestion(entry, question, t);
  const questionField = (
    <textarea
      aria-label={t("question.label")}
      className="question-input"
      maxLength={280}
      {...(entry.kind === "naming" ? {} : { minLength: 4 })}
      onChange={(event) => {
        setQuestion(event.target.value);
        setView(undefined);
        setClassifying(false);
        setError("");
      }}
      placeholder={entry.kind === "naming"
        ? t(naming.target === "business" ? "question.placeholder.business" : "question.placeholder.naming")
        : t(`question.placeholder.${entry.kind}`)}
      value={question}
    />
  );
  return (
    <form className="home-form" onSubmit={(event) => event.preventDefault()} ref={formRef}>
      <h1 className="ask-title">{t("home.title")}</h1>
      <KindOptions onChange={(kind) => setChoice((current) => ({ ...current, kind }))}
        onExample={(kind, example, subjectKey) => {
          setQuestion(example);
          const subject = QUESTION_SUBJECTS.find(({ key }) => key === subjectKey);
          setChoice((current) => ({
            ...current, kind, ...(subject ? { subjectKey: subject.key, subject: subject.label } : {}),
          }));
          setView(undefined);
          setClassifying(false);
          setError("");
        }} value={entry.kind} />
      {entry.kind === "question" ? (
        <SubjectSelect
          detected={view?.subjectKey ?? ""}
          fallback={view?.subjectFallback === true}
          onChange={(subjectKey, subject) => setChoice((current) => ({
            ...current, subjectKey, subject,
          }))}
          value={choice.subjectKey ?? ""}
        />
      ) : null}
      {entry.kind === "fortune" ? (
        <HorizonChips onChange={(horizon) => setChoice((current) => ({ ...current, horizon }))}
          value={entry.horizon} />
      ) : null}
      {entry.kind === "naming" ? (
        <NamingFields
          birthProblem={namingProblem}
          onChange={(value) => {
            setNamingValues(value);
            if (value.target !== entry.target) {
              setChoice((current) => ({ ...current, target: value.target }));
            }
          }}
          questionField={questionField}
          value={naming}
        />
      ) : questionField}
      {status ? <p className="hint status" role="status">{status}</p> : null}
      {needsBirth ? (
        <BirthFields
          onChange={(values) => {
            setBirthValues(values);
            // 生辰填完整即存入本机，下次自动带出。
            if (entry.kind !== "naming" && birthProblem(values, t) === null) {
              saveBirthProfile(toBirthInput(values, t));
            }
          }}
          problem={problem}
          values={birthValues}
        />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <aside className="sample-entry">
        <strong>{t("sample.entry")}</strong>
        <div><a href="#/sample/destiny">{t("sample.destiny")}</a>
          <a href="#/sample/question">{t("sample.question")}</a>
          <a href="#/sample/fortune">{t("sample.fortune")}</a>
          <a href="#/sample/naming">{t("sample.naming")}</a></div>
      </aside>
      {gate.ready ? (
        <PaymentButton
          birth={needsBirth ? toBirthInput(birthValues, t) : null}
          classification={paymentClassification(entry, submittedQuestion)}
          {...(entry.kind === "naming" ? { naming: namingRequest(question, naming) } : {})}
          onMissingBirth={() => setError(t("errors.birthRequired"))}
          question={submittedQuestion}
        />
      ) : (
        <button className="button button-primary" disabled type="button">{t("payment.button")}</button>
      )}
      <FundingGuide mainnet={ARC_NETWORK.mainnet} />
      {!gate.ready && gate.reason && gate.reason !== status ? (
        <p className="hint gate">{gate.reason}</p>
      ) : null}
      <p className="payment-disclaimer">{t("home.disclaimer")}</p>
    </form>
  );
}
