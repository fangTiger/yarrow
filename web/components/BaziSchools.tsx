// web/components/BaziSchools.tsx
import type { FortuneSchoolOutput } from "../../src/sanyi/bazi-schema.js";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { BAZI_KEYS, BAZI_NAMES } from "../lib/liunian-chart.js";
import { repairNote } from "../lib/reading-state.js";
const META = { shenxiaozhan: "格局派 · 子平真诠", yuchuntai: "调候派 · 穷通宝鉴", rentieqiao: "扶抑派 · 滴天髓阐微" };
export function BaziSchools({ reading, onRetry }: {
    reading: PublicBaziReading;
    onRetry(key: typeof BAZI_KEYS[number]): void;
}) {
    const scores = BAZI_KEYS.flatMap(key => {
        const state = reading.schools[key];
        return state.status === "done" && state.output && "confidenceTenths" in state.output ? [state.output.confidenceTenths] : [];
    });
    const maxOverlap = Math.max(1, ...scores.map(score => scores.filter(value => value === score).length));
    return <section className="panel"><header className="panel-head"><h2>三家断语</h2><p>三派各自取用神，各自下断。</p></header><div className="usegod">{BAZI_KEYS.map(key => <div key={key}><small>{BAZI_NAMES[key]} · {META[key]}</small><b>{reading.schools[key].status === "done" ? reading.schools[key].output?.useGod : "暂未落笔"}</b><span>{reading.schools[key].status === "done" ? reading.schools[key].output?.reason : "暂未落笔"}</span></div>)}</div>
    {reading.kind === "fortune" ? <div className="consensus" aria-label="三家合议"><p>合议：{reading.consensusTenths === null ? "—" : `${reading.consensusTenths.toFixed(1)}成`}</p><div className="track" style={{ height: `${44 + (maxOverlap - 1) * 22}px` }}>
      {reading.consensusTenths !== null ? <span className="mean" style={{ left: `${reading.consensusTenths * 10}%` }}><span>合议 {reading.consensusTenths?.toFixed(1)}成</span></span> : null}
      {BAZI_KEYS.map((key) => {
                const state = reading.schools[key];
                const output = state.status === "done" ? state.output as FortuneSchoolOutput | undefined : undefined;
                return output ? <span className="pin" key={key} style={{ left: `${output.confidenceTenths * 10}%`, top: `${12 + BAZI_KEYS.slice(0, BAZI_KEYS.indexOf(key)).filter(previous => { const value = reading.schools[previous]; return value.status === "done" && value.output && "confidenceTenths" in value.output && value.output.confidenceTenths === output.confidenceTenths; }).length * 22}px` }}>{BAZI_NAMES[key].slice(0, 1)}</span> : null;
            })}
    </div><div className="scale"><span>断不成</span><span>断必成</span></div></div> : null}
    {BAZI_KEYS.map((key) => {
            const state = reading.schools[key];
            const output = state.status === "done" ? state.output : undefined;
            const fortune = output && "years" in output ? output as FortuneSchoolOutput : undefined;
            return <article className="diviner" key={key}><span className="seal">{BAZI_NAMES[key].slice(0, 1)}</span><div className="who"><b>{BAZI_NAMES[key]}</b><span>{META[key]}</span></div>{output ? <>
        {reading.kind === "fortune" && fortune ? <p className={`verdict dyn ${fortune.verdict.includes("吉") ? "good" : fortune.verdict.includes("凶") ? "bad" : ""}`}>{fortune.verdict} · {output.headline}<small>{fortune.confidenceTenths}成</small></p> : null}
        {reading.kind === "destiny" ? <p className="verdict dyn">{output.headline}</p> : null}<p className="why">{output.reason}</p>
        {repairNote(state) ? <p className="hint repair-note">{repairNote(state)}</p> : null}
        {fortune?.timing ? <div className="watch"><span className="tag" title={fortune.timing.condition}>{fortune.timing.window}</span></div> : null}
        <details><summary>展开详断</summary>{output.sections.map((section) => <p key={section.title}><b>{section.title}：</b>{section.text}</p>)}<ul>{output.advice.map((advice) => <li key={advice}>{advice}</li>)}</ul><p>{output.evidence.map((item) => `${item.ref}：${item.claim}`).join("；")}</p></details>
      </> : <p>{state.status === "failed" ? "此家暂未落笔" : "正在落笔"}</p>}
        {state.status === "failed" ? <button type="button" disabled={state.retries >= 2 || reading.status !== "done"} onClick={() => onRetry(key)}>免费重试 · 剩余 {Math.max(0, 2 - state.retries)} 次</button> : null}
      </article>;
        })}
  </section>;
}
