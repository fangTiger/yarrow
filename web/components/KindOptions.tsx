// web/components/KindOptions.tsx
import { KIND_OPTIONS, type EntryKind } from "../lib/home-entry.js";

/** 问事 / 运势 / 命理 / 起名四个类型选项（单选组）。 */
export function KindOptions(props: { value: EntryKind; onChange(kind: EntryKind): void }) {
  return (
    <div aria-label="问题类型" className="kind-options" role="radiogroup">
      {KIND_OPTIONS.map(([kind, label]) => (
        <button
          aria-checked={props.value === kind}
          className="kind-option"
          key={kind}
          onClick={() => props.onChange(kind)}
          role="radio"
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
