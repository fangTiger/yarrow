// web/pages/BaziReading.tsx
import { useState } from "react";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { api } from "../lib/api.js";
import { loadBirthProfile, type BirthProfileInput } from "../lib/birth-profile.js";
import { BAZI_KEYS, readingNow } from "../lib/liunian-chart.js";
import { BirthCorrection } from "../components/BirthCorrection.js";
import { PlainSummaryPanel } from "../components/PlainSummaryPanel.js";
import { RemedyPanel } from "../components/RemedyPanel.js";
import { BaziTable } from "../components/BaziTable.js";
import { BaziLuck } from "../components/BaziLuck.js";
import { BaziSchools } from "../components/BaziSchools.js";
import { BaziRelations } from "../components/BaziRelations.js";
import { BaziElements } from "../components/BaziElements.js";
import { DayBoundaryChange } from "../components/DayBoundaryChange.js";
import { LiuNianPanel } from "../components/LiuNianPanel.js";
import { EnglishBaziReading } from "../components/EnglishBaziReading.js";
import { useLang } from "../lib/i18n.js";

type BaziReadingProps = {
    reading: PublicBaziReading;
    onReading(value: PublicBaziReading): void;
    birth?: BirthProfileInput | null;
    readonly?: boolean | undefined;
};

/** 显式传 null 的示例页不得回退读取本机生辰；只有未传参数时才读取档案。 */
export function resolveBaziBirth(
    supplied: BirthProfileInput | null | undefined,
    loader: () => BirthProfileInput | null = loadBirthProfile,
): BirthProfileInput | null {
    return supplied === undefined ? loader() : supplied;
}

function ChineseBaziReading({ reading, onReading, birth: supplied, readonly: readOnly }: BaziReadingProps) {
    const [birth] = useState(() => resolveBaziBirth(supplied));
    const [error, setError] = useState("");
    const { currentYear, currentDate } = readingNow(reading);
    const retry = async (key: typeof BAZI_KEYS[number]) => {
        try {
            const value = await api.retrySchool(reading.id, key);
            if (value.kind === "destiny" || value.kind === "fortune") {
                onReading(value);
            }
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "重试暂不可用");
        }
    };
    return <div className="bazi" data-reading={reading.id}>
    <PlainSummaryPanel readonly={readOnly} reading={reading} onReading={(value) => {
            if (value.kind === "destiny" || value.kind === "fortune") {
                onReading(value);
            }
        }}/>
    <RemedyPanel reading={reading}/>
    <details className="panel schools-fold">
      <summary>看三家依据<span>沈孝瞻 · 余春台 · 任铁樵，三派各自取用神、各自下断</span></summary>
      <BaziSchools reading={reading} readonly={readOnly} onRetry={(key) => void retry(key)}/>
    </details>
    <div className="hero bazi-main"><section className="panel"><div className="ask"><span className="label">所问之事 · {reading.kind === "fortune" ? "运势" : "命理"}</span><p>{reading.question}</p></div><BirthCorrection reading={reading} birth={birth} boundary={readOnly ? null : <DayBoundaryChange reading={reading} birth={birth} onReading={onReading}/>}/><BaziTable chart={reading.chart} analysis={reading.analysis}/><div className="minor">{([["胎元", reading.chart.taiYuan], ["命宫", reading.chart.mingGong], ["身宫", reading.chart.shenGong]] as const).map(([label, value]) => <span key={label}><b>{label}</b> {value ?? "缺"}</span>)}<span><b>起运</b> {reading.chart.luck ? `${reading.chart.luck.start.years} 年 ${reading.chart.luck.start.months} 月 ${reading.chart.luck.start.days} 天（${reading.chart.luck.start.solarDate} 交运）${reading.chart.luck.approximate ? " · 正午估算" : ""}` : "需补时辰确认"}</span></div></section></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <BaziLuck chart={reading.chart} currentYear={currentYear} currentDate={currentDate}/>
    {reading.kind === "fortune" ? <LiuNianPanel reading={reading} currentYear={currentYear}/> : null}
    <div className="row2"><BaziRelations analysis={reading.analysis}/><BaziElements elements={reading.analysis.elements}/></div>
    <p className="provenance">数据来源：四柱、十神、藏干、长生、纳音与大运由 lunar-javascript 推算；合冲刑害与神煞按传统查表；调候据《穷通宝鉴》{reading.tiaohou.section}。原始生辰与逐步校正只在本机展示；流年以立春为界，三家各自独立落笔。</p>
  </div>;
}

export function BaziReading(props: BaziReadingProps) {
    const { lang } = useLang();
    return lang === "en"
        ? <EnglishBaziReading reading={props.reading} onReading={props.onReading}
            readonly={props.readonly} />
        : <ChineseBaziReading {...props} />;
}
