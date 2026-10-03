// web/components/TermDisclosure.tsx
export function TermDisclosure(props: {
  term: string;
  value?: string;
  definition: string;
  actual: string;
}) {
  return (
    <details className="term-disclosure">
      <summary>
        <span>{props.term}</span>
        {props.value ? <strong>{props.value}</strong> : null}
      </summary>
      <div>
        <p><b>是什么：</b>{props.definition}</p>
        <p><b>这一卦里：</b>{props.actual}</p>
      </div>
    </details>
  );
}
