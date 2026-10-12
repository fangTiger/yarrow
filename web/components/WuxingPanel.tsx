import type { PublicNamingReading } from "../../src/sanyi/naming/public.js";
import { WuxingDiagram, wuxingRelations } from "./WuxingDiagram.js";

const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
const VIRTUES = {
  木: "木主仁：仁爱上进、生机勃勃",
  火: "火主礼：热情有礼、开朗明快",
  土: "土主信：诚信稳重、宽厚包容",
  金: "金主义：果断重义、坚毅有守",
  水: "水主智：聪慧灵动、善思通达",
} as const;

const STEM_ELEMENTS: Readonly<Record<string, (typeof ELEMENTS)[number]>> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

function fallbackNote(basis: PublicNamingReading["basis"]): string {
  if (basis.favorableSource === "missing") return "按八字所缺五行补益";
  if (basis.favorableSource === "tiaohou") return "按调候取用";
  if (basis.favorableSource === "industry") return "按行业确定五行";
  return "行业未匹配，由五行补益家自选";
}

export function WuxingPanel({ reading }: { reading: PublicNamingReading }) {
  const { basis } = reading;
  const note = basis.favorableNote ?? fallbackNote(basis);
  const counts = basis.counts as Partial<Record<(typeof ELEMENTS)[number], number>> | undefined;
  const favorable = basis.favorable ?? [];
  const noBirthBusiness = reading.target === "business" && !basis.pillars;
  if (noBirthBusiness) {
    return (
      <section aria-label="五行分析" className="panel wuxing-panel">
        <header className="panel-head"><h2>五行分析</h2><p>以行业气质定所用五行</p></header>
        <div className="wuxing-body">
          <WuxingDiagram counts={undefined} favorable={favorable} missing={[]} />
          <div className="wuxing-side">
            <p className="wuxing-conclusion">{note}</p>
            <div className="wuxing-virtues">
              {favorable.map((element) => <p key={element}>{VIRTUES[element]}</p>)}
            </div>
          </div>
        </div>
      </section>
    );
  }
  const hasCounts = counts !== undefined;
  const max = hasCounts ? Math.max(1, ...ELEMENTS.map((element) => counts[element] ?? 0)) : 1;
  const dayStem = (basis.tiaohou as { dayStem?: string } | null | undefined)?.dayStem;
  const dayMaster = dayStem ? STEM_ELEMENTS[dayStem] : undefined;
  const hidden = basis.hiddenCounts as Partial<Record<(typeof ELEMENTS)[number], number>> | undefined;
  return (
    <section aria-label="五行分析" className="panel wuxing-panel">
      <header className="panel-head"><h2>五行分析</h2><p>先看所缺，再参考调候</p></header>
      <div className="wuxing-body">
        {hasCounts ? (
          <WuxingDiagram
            counts={counts}
            favorable={favorable}
            missing={basis.missing ?? []}
            {...(dayMaster ? { dayMaster } : {})}
          />
        ) : null}
        <div className="wuxing-side">
          {hasCounts ? (
            <div className="wuxing-bars">
              {ELEMENTS.map((element) => {
                const count = counts[element] ?? 0;
                const missing = basis.missing?.includes(element) || count === 0;
                const supplement = favorable.includes(element);
                return (
                  <div className="wuxing-row" data-element={element} key={element}>
                    <span className="wuxing-name">{element}</span>
                    <span className="wuxing-track" aria-hidden="true">
                      <span className="wuxing-fill" style={{ width: `${count / max * 100}%` }} />
                    </span>
                    <strong>{count}</strong>
                    <span className="wuxing-marks">
                      {missing ? <em>缺</em> : null}{supplement ? <b>补</b> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <p className="wuxing-conclusion">{note}</p>
          {hasCounts ? (
            <div className="wuxing-virtues">
              {favorable.map((element) => <p key={element}>{VIRTUES[element]}</p>)}
            </div>
          ) : null}
          {hasCounts && favorable.length ? (
            <div className="wuxing-relations">
              {wuxingRelations(favorable).map((line) => <p key={line}>{line}</p>)}
            </div>
          ) : null}
        </div>
      </div>
      <div className="wuxing-fineprint">
        {hidden ? (
          <p>含藏干：{ELEMENTS.map((element) => `${element} ${hidden[element] ?? 0}`).join(" · ")}</p>
        ) : null}
        {reading.unborn ? <p>按预产期，时辰不详，以年月日六字计</p> : null}
        {hasCounts ? (
          <p>缺什么补什么是民间通行的起名思路；本站在缺的五行之外，再参考《穷通宝鉴》调候喜用。</p>
        ) : null}
      </div>
    </section>
  );
}
