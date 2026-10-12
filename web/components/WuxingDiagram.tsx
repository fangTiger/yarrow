// web/components/WuxingDiagram.tsx
import { ELEMENTS_EN } from "../../src/sanyi/i18n/glossary.js";
import { enT, useLang, useT, zhT, type TFunction } from "../lib/i18n.js";
type Element = "木" | "火" | "土" | "金" | "水";

/** 相生顺序；图上按此顺序顺时针成圈，火居上。 */
const RING: readonly Element[] = ["火", "土", "金", "水", "木"];
const SHENG: Readonly<Record<Element, Element>> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const KE: Readonly<Record<Element, Element>> = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };
const ORDER: readonly Element[] = ["木", "火", "土", "金", "水"];

const SIZE = 360;
const CENTER = SIZE / 2;
const RADIUS = 118;
const NODE = 30;

function position(element: Element, distance = RADIUS): { x: number; y: number } {
  const angle = (-90 + 72 * RING.indexOf(element)) * Math.PI / 180;
  return { x: CENTER + distance * Math.cos(angle), y: CENTER + distance * Math.sin(angle) };
}

/** 两节点间的连线，两端各让出节点半径与箭头的空隙。 */
function edge(from: Element, to: Element) {
  const a = position(from);
  const b = position(to);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const gap = NODE + 6;
  return {
    x1: round(a.x + ux * gap), y1: round(a.y + uy * gap),
    x2: round(b.x - ux * gap), y2: round(b.y - uy * gap),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function motherOf(element: Element): Element {
  return ORDER.find((item) => SHENG[item] === element)!;
}

function conquerorOf(element: Element): Element {
  return ORDER.find((item) => KE[item] === element)!;
}

/** 所补五行的生克说明，由固定的相生相克表生成。 */
export function wuxingRelations(
  favorable: readonly Element[],
  lang: "zh" | "en" = "zh",
  translate: TFunction = lang === "en" ? enT : zhT,
): string[] {
  const name = (element: Element) => lang === "en" ? ELEMENTS_EN[element] : element;
  return favorable.map((element) => translate("wuxing.relation", {
    element: name(element), mother: name(motherOf(element)), child: name(SHENG[element]),
    controlled: name(KE[element]), controller: name(conquerorOf(element)),
  }));
}

/** 五行生克图：外圈实线为相生（顺时针），内部星形虚线为相克；缺的虚线描边，补的金色。 */
export function WuxingDiagram(props: {
  counts: Partial<Record<Element, number>> | undefined;
  missing: readonly Element[];
  favorable: readonly Element[];
  dayMaster?: Element;
}) {
  const { lang } = useLang();
  const t = useT();
  const { counts, missing, favorable, dayMaster } = props;
  const name = (element: Element) => lang === "en" ? ELEMENTS_EN[element] : element;
  const join = (items: readonly string[]) => items.join(lang === "en" ? ", " : "、");
  const label = counts
    ? t("wuxing.diagramCounts", {
      counts: join(ORDER.map((element) => `${name(element)} ${counts[element] ?? 0}`)),
      missing: missing.length ? t("wuxing.diagramMissing", { elements: join(missing.map(name)) }) : "",
      favored: favorable.length
        ? t("wuxing.diagramFavored", { elements: join(favorable.map(name)) }) : "",
    })
    : t("wuxing.diagramUse", { elements: join(favorable.map(name)) });
  return (
    <figure className="wx-figure">
      <svg aria-label={label} role="img" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <marker id="wx-arrow-sheng" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
            <path className="wx-head-sheng" d="M0,0 L7,3.5 L0,7 z" />
          </marker>
          <marker id="wx-arrow-ke" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
            <path className="wx-head-ke" d="M0,0 L6,3 L0,6 z" />
          </marker>
        </defs>
        {ORDER.map((from) => (
          <line
            data-relation={lang === "en" ? "controls" : "克"} data-from={name(from)}
            data-to={name(KE[from])} key={`ke-${from}`}
            className="wx-ke" markerEnd="url(#wx-arrow-ke)" {...edge(from, KE[from])}
          />
        ))}
        {ORDER.map((from) => (
          <line
            data-relation={lang === "en" ? "generates" : "生"} data-from={name(from)}
            data-to={name(SHENG[from])} key={`sheng-${from}`}
            className="wx-sheng" markerEnd="url(#wx-arrow-sheng)" {...edge(from, SHENG[from])}
          />
        ))}
        {RING.map((element) => {
          const { x, y } = position(element);
          const tag = position(element, RADIUS + NODE + 16);
          const isMissing = missing.includes(element);
          const isSupplement = favorable.includes(element);
          const isDayMaster = dayMaster === element;
          const count = counts?.[element];
          const classes = ["wx-node", isMissing ? "missing" : "", isSupplement ? "supplement" : ""]
            .filter(Boolean).join(" ");
          const title = counts
            ? t("wuxing.nodeCount", {
              element: name(element), count: count ?? 0,
              missing: isMissing ? `${lang === "en" ? ", " : "，"}${t("wuxing.missing")}` : "",
              favored: isSupplement
                ? `${lang === "en" ? ", " : "，宜"}${t("wuxing.supplement")}` : "",
              dayMaster: isDayMaster
                ? `${lang === "en" ? "; " : "；"}${t("wuxing.dayMaster")}` : "",
            })
            : t("wuxing.nodeUse", {
              element: name(element), use: isSupplement ? t("wuxing.usefulElement") : "",
            });
          return (
            <g data-node={name(element)} className={classes} key={element}>
              <title>{title}</title>
              <circle cx={round(x)} cy={round(y)} r={NODE} />
              <text className="wx-char" x={round(x)} y={round(counts ? y - 5 : y)}>{name(element)}</text>
              {counts ? (
                <text className="wx-count" x={round(x)} y={round(y + 15)}>{lang === "en"
                  ? `${count ?? 0}` : `${count ?? 0} 个`}</text>
              ) : null}
              {isMissing || isSupplement || isDayMaster ? (
                <text className="wx-tags" x={round(tag.x)} y={round(tag.y)}>
                  {isMissing ? <tspan className="que">{t("wuxing.missing")}</tspan> : null}
                  {isSupplement ? (
                    <tspan className="bu" dx={isMissing ? 4 : 0}>{counts
                      ? t("wuxing.supplement") : t("wuxing.use")}</tspan>
                  ) : null}
                  {isDayMaster ? (
                    <tspan className="dm" dx={isMissing || isSupplement ? 4 : 0}>
                      {t("wuxing.dayMaster")}</tspan>
                  ) : null}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="wx-legend">
        <span className="sheng">{t("wuxing.generatingCycle")}</span>
        <span className="ke">{t("wuxing.controllingCycle")}</span>
      </figcaption>
    </figure>
  );
}
