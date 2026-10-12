// web/components/KindOptions.tsx
import { KIND_OPTIONS, type EntryKind } from "../lib/home-entry.js";
import { useT } from "../lib/i18n.js";

/** 问事 / 运势 / 命理 / 起名四个类型选项（单选组）。 */
export function KindOptions(props: {
  value: EntryKind;
  onChange(kind: EntryKind): void;
  onExample?(kind: EntryKind, question: string): void;
}) {
  const t = useT();
  const examples = (kind: EntryKind) => (
    <div className="kind-examples">
      {([1, 2] as const).map((index) => {
        const question = t(`kind.${kind}.example${index}`);
        return <button data-example-kind={kind} key={index}
          onClick={() => props.onExample?.(kind, question)} type="button">{question}</button>;
      })}
    </div>
  );
  return (
    <div className="kind-picker">
      <div aria-label={t("kind.label")} className="kind-options" role="radiogroup">
        {KIND_OPTIONS.map(([kind]) => <article className="kind-card" data-kind-card={kind} key={kind}>
          <button aria-checked={props.value === kind} className="kind-option"
            onClick={() => props.onChange(kind)} role="radio" type="button">{t(`kind.${kind}`)}</button>
          <p>{t(`kind.${kind}.description`)}</p>
          {examples(kind)}
        </article>)}
      </div>
      <article className="kind-selected-detail" data-selected-kind={props.value}>
        <p>{t(`kind.${props.value}.description`)}</p>
        {examples(props.value)}
      </article>
    </div>
  );
}
