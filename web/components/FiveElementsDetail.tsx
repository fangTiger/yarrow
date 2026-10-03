// web/components/FiveElementsDetail.tsx
import type { FiveElement, LiuyaoChart } from "../../src/oracle/liuyao-chart.js";
import { lineName } from "../lib/term-definitions.js";
import { TermDisclosure } from "./TermDisclosure.js";

// 原文与结构移植自基线 310afdc:web/app.tsx 第 552–646 行。
const POINTS: Record<FiveElement, { x: number; y: number }> = {
  木: { x: 140, y: 24 },
  火: { x: 238, y: 95 },
  土: { x: 201, y: 210 },
  金: { x: 79, y: 210 },
  水: { x: 42, y: 95 },
};
const GENERATES = [
  ["木", "火", "木生火"], ["火", "土", "火生土"], ["土", "金", "土生金"],
  ["金", "水", "金生水"], ["水", "木", "水生木"],
] as const;
const OVERCOMES = [
  ["木", "土", "木克土"], ["土", "水", "土克水"], ["水", "火", "水克火"],
  ["火", "金", "火克金"], ["金", "木", "金克木"],
] as const;

function relation(self: FiveElement, other: FiveElement): { name: string; explanation: string } {
  const generates = Object.fromEntries(GENERATES.map(([from, to]) => [from, to]));
  const overcomes = Object.fromEntries(OVERCOMES.map(([from, to]) => [from, to]));
  if (self === other) return { name: "兄弟", explanation: "与我同五行" };
  if (generates[other] === self) return { name: "父母", explanation: `${other}生${self}，是“生我”` };
  if (generates[self] === other) return { name: "子孙", explanation: `${self}生${other}，是“我生”` };
  if (overcomes[other] === self) return { name: "官鬼", explanation: `${other}克${self}，是“克我”` };
  return { name: "妻财", explanation: `${self}克${other}，是“我克”` };
}

export function FiveElementsDetail({ chart }: { chart: LiuyaoChart }) {
  return (
    <details className="panel five-elements-detail">
      <summary>五行生克与逐爻六亲来源</summary>
      <p>卦宫五行为{chart.palace.element}，在六亲比较里称“我”。</p>
      <svg aria-label="五行相生环与相克星" role="img" viewBox="0 0 280 238">
        <defs>
          <marker id="generate-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path d="M0,0 L7,3.5 L0,7 Z" />
          </marker>
          <marker id="overcome-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path d="M0,0 L7,3.5 L0,7 Z" />
          </marker>
        </defs>
        {GENERATES.map(([from, to, label]) => (
          <line
            className="generate-edge"
            key={label}
            markerEnd="url(#generate-arrow)"
            x1={POINTS[from].x}
            x2={POINTS[to].x}
            y1={POINTS[from].y}
            y2={POINTS[to].y}
          />
        ))}
        {OVERCOMES.map(([from, to, label]) => (
          <line
            className="overcome-edge"
            key={label}
            markerEnd="url(#overcome-arrow)"
            x1={POINTS[from].x}
            x2={POINTS[to].x}
            y1={POINTS[from].y}
            y2={POINTS[to].y}
          />
        ))}
        {(Object.keys(POINTS) as FiveElement[]).map((element) => (
          <g key={element} transform={`translate(${POINTS[element].x} ${POINTS[element].y})`}>
            <circle className={element === chart.palace.element ? "active" : ""} r="20" />
            <text dy="5" textAnchor="middle">{element}</text>
          </g>
        ))}
      </svg>
      <div className="term-grid">
        {[...chart.rows].reverse().map((row) => {
          const item = relation(chart.palace.element, row.primary.element);
          const focus = chart.focus;
          const role = row.primary.relation === focus?.useGod
            ? "用神自身"
            : row.primary.relation === focus?.originalGod ? "原神"
              : row.primary.relation === focus?.tabooGod ? "忌神"
                : row.primary.relation === focus?.enemyGod ? "仇神" : "一般爻";
          return (
            <TermDisclosure
              actual={`${lineName(row.position)}纳${row.primary.stemBranch}${row.primary.element}；${item.explanation}，`
                + `故为${item.name}。月令为${row.primary.strength}，本题作${role}观察；强弱不单独等于吉凶。`}
              definition="先以纳甲地支取得五行，再与卦宫之“我”比较，并接到节气月旺衰。"
              key={row.position}
              term={`${lineName(row.position)} · ${row.primary.element}`}
              value={`${row.primary.relation} · ${row.primary.strength}`}
            />
          );
        })}
      </div>
    </details>
  );
}
