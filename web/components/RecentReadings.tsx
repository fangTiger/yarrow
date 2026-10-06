// web/components/RecentReadings.tsx
import type { RecentReading } from "../lib/recent-readings.js";
export function RecentReadings({ readings }: { readings: readonly RecentReading[] }) {
  return (
    <section className="panel">
      <h2>最近所问</h2>
      {readings.length ? (
        <ul className="recent">
          {readings.map((item) => (
            <li key={item.id}>
              <a href={`#/r/${item.id}`}>
                <span>{item.kind === "destiny" ? "命理" : null}{item.kind === "fortune" ? "运势" : null} · {item.question}</span>
                <time>{item.createdAt}</time>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">本机还没有留下卦历。</p>
      )}
    </section>
  );
}
