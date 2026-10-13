import type { Portrait } from "../../src/sanyi/summary.js";
import { useT } from "../lib/i18n.js";

/** 性格画像：中英共用同一结构，正文由总述翻译回填，固定标签走字典。 */
export function DestinyPortrait({ portrait }: { portrait: Portrait }) {
  const t = useT();
  return <section aria-label={t("chart.portrait.title")} className="panel destiny-portrait">
    <header className="panel-head"><h2>{t("chart.portrait.title")}</h2></header>
    <div className="portrait-traits">
      {portrait.traits.map((trait) => <span className="tag" key={trait}>{trait}</span>)}
    </div>
    <div className="portrait-columns">
      <section><h3>{t("chart.portrait.strengths")}</h3>
        <ul>{portrait.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section><h3>{t("chart.portrait.blindSpots")}</h3>
        <ul>{portrait.blindSpots.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </div>
    <p className="portrait-summary">{portrait.summary}</p>
  </section>;
}
