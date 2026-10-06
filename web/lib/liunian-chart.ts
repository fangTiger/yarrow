// web/lib/liunian-chart.ts
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import type { YearConsensus } from "../../src/sanyi/bazi-public.js";
export const BAZI_NAMES = { shenxiaozhan: "沈孝瞻", yuchuntai: "余春台", rentieqiao: "任铁樵" } as const;
export const BAZI_KEYS = ["shenxiaozhan", "yuchuntai", "rentieqiao"] as const;
export type FortuneReading = Extract<PublicBaziReading, {
    kind: "fortune";
}>;
export const CHART = { width: 1000, height: 260, left: 90, right: 0, top: 25, bottom: 215 };
export function yFor(value: number): number {
    return CHART.bottom - (value - 1) / 8 * (CHART.bottom - CHART.top);
}
export function xFor(index: number, count: number): number {
    return CHART.left + (index + 0.5) * (CHART.width - CHART.left - CHART.right) / Math.max(1, count);
}
export function yearGroups(years: readonly number[], currentYear: number) {
    const groups: {
        label: string;
        count: number;
    }[] = [];
    for (const year of years) {
        let label = "展望";
        if (year < currentYear) {
            label = "回看";
        }
        if (year === currentYear) {
            label = "今年";
        }
        const last = groups.at(-1);
        if (last?.label === label) {
            last.count += 1;
        }
        else {
            groups.push({ label, count: 1 });
        }
    }
    return groups;
}
export function chartGeometry(years: readonly (YearConsensus | null)[], dates: readonly (string | null)[]) {
    const points = years.map((item, index) => {
        if (item === null) {
            return null;
        }
        return { x: xFor(index, years.length), y: yFor(item.average), low: yFor(item.min), high: yFor(item.max) };
    });
    const paths: string[] = [];
    let path = "";
    for (const point of points) {
        if (point === null) {
            if (path) {
                paths.push(path);
            }
            path = "";
        }
        else {
            path += `${path ? " L" : "M"}${point.x},${point.y}`;
        }
    }
    if (path) {
        paths.push(path);
    }
    const changes = dates.flatMap((date, index) => {
        if (!date) {
            return [];
        }
        const year = Number(date.slice(0, 4));
        const start = Date.UTC(year, 0, 1);
        const end = Date.UTC(year + 1, 0, 1);
        const fraction = (Date.parse(`${date}T00:00:00Z`) - start) / (end - start);
        const cell = (CHART.width - CHART.left - CHART.right) / Math.max(1, years.length);
        return [{ date, x: CHART.left + (index + fraction) * cell }];
    });
    return { points, paths, changes };
}
export function directLabels(years: readonly (YearConsensus | null)[], currentYear: number, narrow: boolean) {
    const done = years.filter((year): year is YearConsensus => year !== null);
    const best = [...done].sort((a, b) => b.average - a.average || a.year - b.year)[0];
    const past = done.filter((year) => year.year < currentYear).sort((a, b) => a.average - b.average || a.year - b.year)[0];
    return years.map((year) => {
        const labels: string[] = [];
        if (year?.year === currentYear) {
            labels.push("今年");
        }
        if (year && year.year === best?.year) {
            labels.push("十年最顺");
        }
        if (!narrow && year && year.year === past?.year && past?.year !== best?.year) {
            labels.push("回看中最低");
        }
        return labels;
    });
}
export function tooltipLeft(x: number, width = 180): number {
    return Math.max(CHART.left, Math.min(x - width / 2, CHART.width - CHART.right - width));
}
export function relationClass(kind: string): string {
    if (["三合", "半合", "拱", "三会"].includes(kind)) {
        return "tag group relation-group";
    }
    if (kind === "合") {
        return "tag join relation-join";
    }
    return "tag clash relation-clash";
}
export function schoolYear(reading: FortuneReading, key: typeof BAZI_KEYS[number], year: number) {
    const state = reading.schools[key];
    if (state.status !== "done" || !state.output || !("years" in state.output)) {
        return undefined;
    }
    return state.output.years.find((item) => item.year === year);
}
export const LABEL_BAND = 20;
export function consensusText(value: number): string { return `${value.toFixed(1)}成`; }
export function yunLabel(name: string, date: string | null, narrow: boolean): string {
    return `${name}运${date && !narrow ? ` · ${date} 交运` : ''}`;
}
export function labelLayout(years: readonly (YearConsensus | null)[], currentYear: number, width: number, height = 194) {
    const labels = directLabels(years, currentYear, width <= 620);
    const placed: { index: number; labels: string[]; x: number; top: number }[] = [];
    const order = years.map((_, i) => i).sort((a, b) => Number(years[b]?.year === currentYear) - Number(years[a]?.year === currentYear));
    for (const index of order) {
        const year = years[index];
        if (!year || !labels[index]?.length) continue;
        const x = (index + .5) / years.length * width;
        let top = Math.max(LABEL_BAND, LABEL_BAND + (9 - year.average) / 8 * (height - LABEL_BAND) - 24);
        while (placed.some(item => Math.abs(item.x - x) < 72 && Math.abs(item.top - top) < 24)) top += 24;
        placed.push({ index, labels: labels[index]!, x, top });
    }
    return placed;
}


/** 某家某年没有断语时的说明：调用失败为「未落笔」，落笔但缺该年为「未给出」，仍在落笔为「落笔中」。 */
export function yearGapLabel(status: string): string {
  if (status === "failed") {
    return "未落笔";
  }
  if (status === "done") {
    return "未给出";
  }
  return "落笔中";
}
