// web/components/BirthEntry.tsx
import type { ReactNode } from "react";
import { BirthForm } from "./BirthForm.js";
import { needsBirth } from "../lib/birth-entry.js";
import type { BirthProfileInput } from "../lib/birth-profile.js";
export function BirthEntry(props: {
    kind: string;
    birth: BirthProfileInput | null;
    open: boolean;
    temporary: boolean;
    onOpen(): void;
    onBirth(input: BirthProfileInput): void;
    onFallback(): void;
    onCancel(): void;
    payment(): ReactNode;
}) {
    const missing = needsBirth(props.kind, props.birth);
    return <>
    {props.open ? <BirthForm initial={props.birth} temporary={props.temporary} onBirth={props.onBirth} onFallback={props.onFallback} onCancel={props.onCancel}/> : null}
    {missing ? <button type="button" className="button button-primary" onClick={props.onOpen}>填写生辰后问卦</button> : <div hidden={props.open}>{props.payment()}</div>}
  </>;
}
