// web/components/ConsensusTrack.tsx
import type { PublicReading } from "../lib/api.js";
import { consensusTenths } from "../lib/reading-state.js";

const META = { chengyi: "程", jingfang: "京", shaoyong: "邵" } as const;

export function ConsensusTrack({ schools }: { schools: PublicReading["schools"] }) {
  const values = Object.entries(schools).flatMap(([key, school]) => {
    return school.status === "done" && school.output
      ? [{ key: key as keyof typeof META, value: school.output.confidenceTenths }]
      : [];
  });
  const average = consensusTenths(schools);
  return (
    <div aria-label="三家合议" className="consensus">
      <div className="consensus-track">
        {average === undefined ? null : (
          <span className="mean" style={{ left: `${average * 10}%` }}>
            <span>合议 约{average.toFixed(1)}成</span>
          </span>
        )}
        {values.map((item) => (
          <span className="pin" key={item.key} style={{ left: `${item.value * 10}%` }}>
            {META[item.key]}
          </span>
        ))}
      </div>
      <div className="consensus-scale"><span>断不成</span><span>断必成</span></div>
    </div>
  );
}
