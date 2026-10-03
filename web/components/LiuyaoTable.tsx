// web/components/LiuyaoTable.tsx
import type { LiuyaoChart, LiuyaoChartRow } from "../../src/oracle/liuyao-chart.js";
import {
  lineName,
  readingGuide,
  TERM_DEFINITIONS,
} from "../lib/term-definitions.js";
import { HexagramFigure } from "./HexagramFigure.js";
import { TermDisclosure } from "./TermDisclosure.js";

function tags(row: LiuyaoChartRow, chart: LiuyaoChart): readonly string[] {
  const focus = chart.focus;
  return [
    row.primary.strength,
    row.primary.relation === focus?.useGod ? "用神" : "",
    row.primary.relation === focus?.originalGod ? "原神" : "",
    row.primary.relation === focus?.tabooGod ? "忌神" : "",
    row.primary.relation === focus?.enemyGod ? "仇神" : "",
    row.primary.isVoid ? "旬空" : "",
    row.primary.isMonthBroken ? "月破" : "",
    row.isDayBroken ? "日破" : "",
    row.isHiddenMoving ? "暗动" : "",
  ].filter(Boolean);
}

export function LiuyaoTable({ chart }: { chart: LiuyaoChart }) {
  const moving = chart.rows.filter((row) => row.changing).map((row) => row.position);
  const termItems = [
    [
      "卦宫",
      `${chart.palace.name}宫`,
      `本卦归${chart.palace.name}宫，宫五行为${chart.palace.element}。`,
    ],
    ["宫序", chart.palace.sequence, `本卦宫序为${chart.palace.sequence}。`],
    [
      "世应",
      `${lineName(chart.shiPosition)}、${lineName(chart.yingPosition)}`,
      "世应位置由宫序确定。",
    ],
    ["六神", chart.rows.map((row) => row.sixSpirit).join("、"), `${chart.day.stem}日起六神。`],
    ["六亲", "逐爻纳甲", `以${chart.palace.element}为我比较逐爻五行。`],
    ["伏神", chart.rows.some((row) => row.hidden) ? "有" : "无", "按本宫首卦同位补取。"],
    ["旬空", chart.day.voidBranches.join("、"), `${chart.day.ganzhi}日旬空如此。`],
    ["月建", `${chart.month.branch}月`, `${chart.month.range}，属${chart.month.element}。`],
    ["旺衰", "旺相休囚死", "逐爻标签来自当前节气月。"],
    ["冲破", "月破、日破、暗动", "三类标记分别计算，不互相替代。"],
    [
      "动变",
      moving.length ? moving.map(lineName).join("、") : "无动爻",
      "化出、回头生克与进退神见表。",
    ],
  ] as const;
  return (
    <section aria-labelledby="liuyao-title" className="panel liuyao-panel">
      <header className="panel-head">
        <h2 id="liuyao-title">六爻排盘</h2>
        <p>京房纳甲 · 八宫世应 · {chart.day.stem}日起六神</p>
      </header>
      <ol className="reading-guide">
        {readingGuide(chart).map((item) => (
          <li key={item.title}><strong>{item.title}</strong><p>{item.text}</p></li>
        ))}
      </ol>
      <div className="term-grid">
        {termItems.map(([term, value, actual]) => (
          <TermDisclosure
            actual={actual}
            definition={TERM_DEFINITIONS[term]}
            key={term}
            term={term}
            value={value}
          />
        ))}
      </div>
      <div aria-label="六爻排盘表，可横向滚动" className="chart-scroll" tabIndex={0}>
        <table className="chart">
          <thead>
            <tr>
              <th>六神</th><th>伏神</th><th>六亲纳甲</th><th>卦画</th>
              <th>世应</th><th>旺衰与角色</th><th>动变</th>
            </tr>
          </thead>
          <tbody>
            {[...chart.rows].reverse().map((row) => (
              <tr className={row.primary.relation === chart.focus?.useGod ? "use" : ""} key={row.position}>
                <td>{row.sixSpirit}</td>
                <td>
                  {row.hidden
                    ? `${row.hidden.relation}${row.hidden.stemBranch}${row.hidden.element}`
                    : "—"}
                </td>
                <td><b>{row.primary.relation}</b> {row.primary.stemBranch}{row.primary.element}</td>
                <td>
                  <HexagramFigure
                    compact
                    label={`${lineName(row.position)}${row.primaryYang ? "阳" : "阴"}`}
                    lines={[row.primaryYang]}
                    moving={row.changing ? [1] : []}
                  />
                </td>
                <td className="mark">{row.marker ?? "·"}</td>
                <td>
                  <span className="state">
                    {tags(row, chart).map((tag) => <i key={tag}>{tag}</i>)}
                  </span>
                </td>
                <td className="change">
                  {row.changing
                    ? `化出${row.changed.relation}${row.changed.stemBranch}${row.changed.element}`
                    : "—"}
                  {row.returnEffect ? ` · ${row.returnEffect}` : ""}
                  {row.advanceRetreat ? ` · ${row.advanceRetreat}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="provenance">
        京房纳甲 · 八宫世应 · 六甲旬空；UTC+8 零点换日；月建按节气月；
        旺相休囚死依《三命通会》。排盘只陈列事实，不以单一标签直接判断吉凶。
      </footer>
    </section>
  );
}
