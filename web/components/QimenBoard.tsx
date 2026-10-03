// web/components/QimenBoard.tsx
import type { QimenResult } from "../../src/calendar/qimen.js";
const GRID = [
  "巽四", "离九", "坤二", "震三", "中五", "兑七", "艮八", "坎一", "乾六",
] as const;
const GOOD = new Set(["开门", "休门", "生门"]);
const BAD = new Set(["伤门", "死门", "惊门"]);
const HORSE_PALACE: Record<string, string> = { 寅: "艮八", 申: "坤二", 巳: "巽四", 亥: "乾六" };
const BRANCH_PALACE: Record<string, string> = {
  子: "坎一", 丑: "艮八", 寅: "艮八", 卯: "震三", 辰: "巽四", 巳: "巽四",
  午: "离九", 未: "坤二", 申: "坤二", 酉: "兑七", 戌: "乾六", 亥: "乾六",
};
function palaceLabel(value: string): string {
  return value === "中五" ? "中五（寄坤二）" : value;
}
function doorTone(door?: string): string {
  return door && GOOD.has(door) ? "good" : door && BAD.has(door) ? "bad" : "plain";
}
export function QimenBoard({ value }: { value: QimenResult }) {
  return (
    <section aria-labelledby="qimen-title" className="panel">
      <header className="panel-head">
        <h2 id="qimen-title">奇门时盘</h2>
        <p>
          {value.layout} · {value.method} · 值符{value.chiefStar}落{palaceLabel(value.chiefStarPalace)}
          · 值使{value.chiefDoor}落{palaceLabel(value.chiefDoorPalace)}
        </p>
      </header>
      <p>
        {value.dayPillar}日 · {value.hourPillar}时 · {value.solarTerm}
        · 旬首{value.xunHead}遁{value.chiefStem}
        · 日空{value.dayVoid} · 时空{value.hourVoid} · 驿马{value.horse}
      </p>
      <p className="hint">奇门按子时换日；仅作显示，不输入三家断语。</p>
      <div aria-label="奇门九宫，南上北下" className="qimen-board">
        {GRID.map((palace) => {
          const cell = value.palaces[palace];
          const voids = `${value.dayVoid}${value.hourVoid}`;
          const branches = Object.entries(BRANCH_PALACE)
            .filter(([, target]) => target === palace)
            .map(([branch]) => branch);
          const isVoid = branches.some((branch) => voids.includes(branch));
          const flags = [
            value.chiefStarPalace === palace || (value.chiefStarPalace === "中五" && palace === "坤二")
              ? "值符" : "",
            value.chiefDoorPalace === palace || (value.chiefDoorPalace === "中五" && palace === "坤二")
              ? "值使" : "",
            HORSE_PALACE[value.horse] === palace ? "驿马" : "",
            isVoid ? "空亡" : "",
          ].filter(Boolean);
          if (palace === "中五") {
            return (
              <div className="qimen-cell center" data-gua="中" key={palace}>
                <b>中五（寄坤二）</b>
                <small>天盘{cell.heavenStem ?? "—"} · 地盘{cell.earthStem}</small>
              </div>
            );
          }
          return (
            <div className="qimen-cell" data-gua={palace[0]} key={palace}>
              <span className={cell.god === "值符" ? "god chief" : "god"}>{cell.god}</span>
              <span className="heaven">{cell.heavenStem ?? "—"}</span>
              <span className="star">{cell.star}<small>{palace}宫</small></span>
              <span className="qimen-flags">{flags.map((flag) => <i key={flag}>{flag}</i>)}</span>
              <span className={`door ${doorTone(cell.door)}`}>{cell.door}</span>
              <span className="earth">{cell.earthStem}</span>
            </div>
          );
        })}
      </div>
      <p className="qimen-legend">
        吉门：开、休、生 · 凶门：伤、死、惊 · 平门：杜、景
        · 右上天盘干 · 右下地盘干
      </p>
    </section>
  );
}
