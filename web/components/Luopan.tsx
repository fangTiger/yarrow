// web/components/Luopan.tsx
import { createElement } from "react";
import { TRIGRAMS_EN } from "../../src/sanyi/i18n/glossary.js";
import { useLang } from "../lib/i18n.js";

export const MOUNTAINS = [..."午丁未坤申庚酉辛戌乾亥壬子癸丑艮寅甲卯乙辰巽巳丙"] as const;
export const BAGUA = [
  ["离", "101"],
  ["坤", "000"],
  ["兑", "110"],
  ["乾", "111"],
  ["坎", "010"],
  ["艮", "001"],
  ["震", "100"],
  ["巽", "011"],
] as const;

export const BAGUA_POSITIONS = {
  离: "top", 坤: "top-right", 兑: "right", 乾: "bottom-right",
  坎: "bottom", 艮: "bottom-left", 震: "left", 巽: "top-left",
} as const;

const TRIGRAM_IMAGES_ZH = {
  离: "火", 坤: "地", 兑: "泽", 乾: "天", 坎: "水", 艮: "山", 震: "雷", 巽: "风",
} as const;

const CENTER = 160;

function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10;
}

function Trigram({ bits, index, name }: { bits: string; index: number; name: keyof typeof BAGUA_POSITIONS }) {
  return (
    <g data-position={BAGUA_POSITIONS[name]} data-trigram={name}
      transform={`rotate(${index * 45} ${CENTER} ${CENTER})`}>
      {[...bits].map((bit, line) => {
        const y = CENTER - 108 - line * 6;
        return bit === "1" ? (
          <rect className="luopan-stroke" height="3" key={y} width="22" x="149" y={y} />
        ) : (
          <g key={y}>
            <rect className="luopan-stroke" height="3" width="9" x="149" y={y} />
            <rect className="luopan-stroke" height="3" width="9" x="162" y={y} />
          </g>
        );
      })}
    </g>
  );
}

export function Luopan({ home = false }: { home?: boolean }) {
  const { lang } = useLang();
  return (
    <svg aria-hidden="true" className={`luopan${home ? " luopan-home" : ""}`} viewBox="0 0 320 320">
      <g className="luopan-outer-ring">
        {[150, 126, 100].map((radius) => (
          <circle className="luopan-ring" cx={CENTER} cy={CENTER} key={radius} r={radius} />
        ))}
        {MOUNTAINS.map((mountain, index) => {
          const rotation = index * 15;
          return createElement(
            "g",
            { key: `${mountain}-${index}` },
            lang === "zh" ? <text
              className={"子午卯酉".includes(mountain) ? "luopan-cardinal" : ""}
              dominantBaseline="central"
              textAnchor="middle"
              transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
              x={CENTER}
              y="22"
            >
              {mountain}
            </text> : null,
            <line
              className="luopan-tick"
              transform={`rotate(${rotation + 7.5} ${CENTER} ${CENTER})`}
              x1={CENTER}
              x2={CENTER}
              y1="10"
              y2="34"
            />,
          );
        })}
      </g>
      <g className="luopan-fixed">
        {BAGUA.map(([name, bits], index) => (
          <Trigram bits={bits} index={index} key={name} name={name} />
        ))}
        {home ? BAGUA.map(([name], index) => {
          const angle = (-90 + index * 45) * Math.PI / 180;
          const x = roundCoordinate(CENTER + 62 * Math.cos(angle));
          const y = roundCoordinate(CENTER + 62 * Math.sin(angle));
          const english = TRIGRAMS_EN[name];
          const label = lang === "en"
            ? `${english.pinyin} · ${english.image}`
            : `${name} · ${TRIGRAM_IMAGES_ZH[name]}`;
          return <text className="luopan-trigram-label" dominantBaseline="central" key={name}
            textAnchor="middle" x={x} y={y}>{label}</text>;
        }) : null}
        {home ? <g className="luopan-center"><circle cx={CENTER} cy={CENTER} r="27" />
          <text className="luopan-center-seal" dominantBaseline="central" textAnchor="middle"
            x={CENTER} y={CENTER}>问</text></g> : null}
      </g>
    </svg>
  );
}
