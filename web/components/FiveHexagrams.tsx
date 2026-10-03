// web/components/FiveHexagrams.tsx
import type { FiveHexagrams as Figures } from "../../src/oracle/liuyao-chart.js";
import { FIGURE_DEFINITIONS } from "../lib/term-definitions.js";
import { HexagramFigure } from "./HexagramFigure.js";
import { TermDisclosure } from "./TermDisclosure.js";

const ORDER = ["primary", "mutual", "derived", "opposite", "reversed"] as const;
const MOTTO = {
  primary: "为体",
  mutual: "探隐",
  derived: "测果",
  opposite: "警变",
  reversed: "观反",
} as const;

export function FiveHexagrams(props: {
  figures: Figures;
  moving: readonly number[];
}) {
  return (
    <div aria-label="本互变错综五卦" className="five-hexagrams">
      {ORDER.map((kind) => {
        const figure = props.figures[kind];
        return (
          <figure className={kind === "primary" ? "active" : ""} key={kind}>
            <HexagramFigure
              compact
              label={`${figure.label}${figure.name}`}
              lines={figure.yangLines}
              moving={kind === "primary" ? props.moving : []}
            />
            <figcaption>
              {figure.name}
              <small>{figure.label} · {MOTTO[kind]}</small>
            </figcaption>
            <TermDisclosure
              actual={`${figure.derivation}；这一卦为${figure.name}。`}
              definition={FIGURE_DEFINITIONS[kind]}
              term={figure.label}
            />
          </figure>
        );
      })}
    </div>
  );
}
