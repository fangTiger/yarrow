// web/components/KindOptions.tsx
import { KIND_OPTIONS, type EntryKind } from "../lib/home-entry.js";
import { useT } from "../lib/i18n.js";

/** 问事 / 运势 / 命理 / 起名四个类型选项（单选组）。 */
export function KindOptions(props: { value: EntryKind; onChange(kind: EntryKind): void }) {
  const t = useT();
  return (
    <div aria-label={t("kind.label")} className="kind-options" role="radiogroup">
      {KIND_OPTIONS.map(([kind]) => (
        <button
          aria-checked={props.value === kind}
          className="kind-option"
          key={kind}
          onClick={() => props.onChange(kind)}
          role="radio"
          type="button"
        >
          {t(`kind.${kind}`)}
        </button>
      ))}
    </div>
  );
}
