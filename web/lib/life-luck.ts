import type { BaziChart, LuckCycle } from "../../src/calendar/bazi.js";
import type { PeriodConsensus, PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { BAZI_KEYS } from "./liunian-chart.js";

export type DestinyReading = Extract<PublicBaziReading, { kind: "destiny" }>;
export type CycleGroup = { label: "回看" | "当前" | "往后"; count: number };
export type PeriodLabel = "当前" | "一生最顺" | "回看中最低";

/** 按实际交运日判断当前大运；起运前与全部大运结束后返回 null。 */
export function currentCycleIndex(chart: BaziChart, currentDate: string): number | null {
  const luck = chart.luck;
  if (!luck) return null;
  const monthDay = luck.start.solarDate.slice(4);
  return luck.cycles.find((cycle, index) => {
    const start = `${cycle.startYear}${monthDay}`;
    const next = luck.cycles[index + 1];
    const end = `${next?.startYear ?? cycle.endYear + 1}${monthDay}`;
    return currentDate >= start && currentDate < end;
  })?.index ?? null;
}

/** 把大运按当前之运分成回看、当前与往后三段，供跨列表头使用。 */
export function cycleGroups(cycles: readonly LuckCycle[], currentIndex: number | null): CycleGroup[] {
  const groups: CycleGroup[] = [];
  for (const cycle of cycles) {
    const label: CycleGroup["label"] = currentIndex === null || cycle.index > currentIndex
      ? "往后" : cycle.index === currentIndex ? "当前" : "回看";
    const last = groups.at(-1);
    if (last?.label === label) last.count += 1;
    else groups.push({ label, count: 1 });
  }
  return groups;
}

/** 读取某家指定大运的断语；失败、未完成或旧存档均按缺项处理。 */
export function schoolPeriod(
  reading: DestinyReading,
  key: typeof BAZI_KEYS[number],
  index: number,
) {
  const state = reading.schools[key];
  if (state.status !== "done" || !state.output || "years" in state.output) return undefined;
  return state.output.periods?.find((item) => item.index === index);
}

/** 是否至少一家给出逐运断语；旧存档据此降级到原大运时间轴。 */
export function hasPeriodData(reading: DestinyReading): boolean {
  return BAZI_KEYS.some((key) => {
    const state = reading.schools[key];
    return state.status === "done" && state.output && !("years" in state.output)
      && Boolean(state.output.periods?.length);
  });
}

/** 每步大运的直标：当前、一生最顺，以及当前之前最低的一步。 */
export function periodLabels(
  periods: readonly (PeriodConsensus | null)[],
  currentIndex: number | null,
): PeriodLabel[][] {
  const done = periods.filter((item): item is PeriodConsensus => item !== null);
  const best = [...done].sort((a, b) => b.average - a.average || a.index - b.index)[0];
  const past = currentIndex === null ? undefined : done
    .filter((item) => item.index < currentIndex)
    .sort((a, b) => a.average - b.average || a.index - b.index)[0];
  return periods.map((item) => {
    const labels: PeriodLabel[] = [];
    if (item?.index === currentIndex) labels.push("当前");
    if (item && item.index === best?.index) labels.push("一生最顺");
    if (item && item.index === past?.index && past.index !== best?.index) labels.push("回看中最低");
    return labels;
  });
}
