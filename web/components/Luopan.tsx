// web/components/Luopan.tsx
import { createElement } from "react";

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

const CENTER = 160;

function Trigram({ bits, index }: { bits: string; index: number }) {
  return (
    <g transform={`rotate(${index * 45} ${CENTER} ${CENTER})`}>
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

export function Luopan() {
  return (
    <svg aria-hidden="true" className="luopan" viewBox="0 0 320 320">
      <g className="luopan-rotor">
        {[150, 126, 100].map((radius) => (
          <circle className="luopan-ring" cx={CENTER} cy={CENTER} key={radius} r={radius} />
        ))}
        {MOUNTAINS.map((mountain, index) => {
          const rotation = index * 15;
          return createElement(
            "g",
            { key: `${mountain}-${index}` },
            <text
              className={"子午卯酉".includes(mountain) ? "luopan-cardinal" : ""}
              dominantBaseline="central"
              textAnchor="middle"
              transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
              x={CENTER}
              y="22"
            >
              {mountain}
            </text>,
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
        {BAGUA.map(([name, bits], index) => (
          <Trigram bits={bits} index={index} key={name} />
        ))}
      </g>
    </svg>
  );
}
