// web/components/ThrowRecord.tsx
import type { ThrowResult } from "../lib/api.js";

function lineName(index: number): string {
  return index === 1 ? "初爻" : index === 6 ? "上爻" : `${"一二三四五六"[index - 1]}爻`;
}

export function ThrowRecord({ throws }: { throws: readonly ThrowResult[] }) {
  return (
    <div aria-label="铜钱六掷记录" className="throw-record">
      <span className="label">铜钱六掷 · 火珠林法</span>
      {[...throws].reverse().map((item) => (
        <div className={item.moving ? "throw moving" : "throw"} key={item.index}>
          <span>{lineName(item.index)}</span>
          <span aria-label={`${item.backs}背`} className="coins">
            {item.coins.map((coin, index) => (
              <i className={coin === 1 ? "coin back" : "coin face"} key={index} />
            ))}
          </span>
          <span>
            {item.backs}背 · {item.name} · {item.value % 2 ? "阳" : "阴"}
            {item.moving ? " · 动" : ""}
          </span>
        </div>
      ))}
      <p className="legend">
        实心为背，空心为字。一背为单（少阳），二背为拆（少阴），
        三背为重（老阳，动），三字为交（老阴，动）。
      </p>
    </div>
  );
}
