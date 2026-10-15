import { useEffect, useState } from "react";
import type { AnyPublicReading } from "./api.js";
import { type TFunction, useT } from "./i18n.js";

type SchoolState = { status: string };

/** 结果页三家状态；起名不使用本模块的等待面板，但标题仍复用家数。 */
export function readingSchools(reading: AnyPublicReading): Array<[string, SchoolState]> {
  const states = reading.kind === "naming" ? reading.families : reading.schools;
  return Object.entries(states) as Array<[string, SchoolState]>;
}

export function writtenSchoolCount(reading: AnyPublicReading): number {
  return readingSchools(reading).filter(([, state]) => state.status === "done").length;
}

export function readingIsWriting(reading: AnyPublicReading): boolean {
  if (["awaiting-throws", "charting", "writing"].includes(reading.status)) return true;
  if (reading.summary?.status === "writing") return true;
  return readingSchools(reading).some(([, state]) => (
    state.status === "pending" || state.status === "writing"
  ));
}

function elapsedSeconds(createdAt: string): number {
  const startedAt = Date.parse(createdAt);
  return Number.isFinite(startedAt) ? Math.max(0, Math.floor((Date.now() - startedAt) / 1_000)) : 0;
}

/** 等待区每秒更新已用时间，卸载时清理计时器。 */
export function useElapsedSeconds(createdAt: string): number {
  const [seconds, setSeconds] = useState(() => elapsedSeconds(createdAt));
  useEffect(() => {
    const update = () => setSeconds(elapsedSeconds(createdAt));
    update();
    const timer = globalThis.setInterval(update, 1_000);
    return () => globalThis.clearInterval(timer);
  }, [createdAt]);
  return seconds;
}

/** 写作中显示进度；完成后提示一次，回到标签页或卸载时恢复原标题。 */
export function readingTitle(reading: AnyPublicReading, t: TFunction): string {
  const title = t("meta.title");
  return readingIsWriting(reading)
    ? t("wait.titleProgress", { count: writtenSchoolCount(reading), title })
    : t("wait.titleDone", { title });
}

export function useReadingTitle(reading: AnyPublicReading | undefined): void {
  const t = useT();
  useEffect(() => {
    if (typeof document === "undefined" || !reading) return undefined;
    const base = t("meta.title");
    const writing = readingIsWriting(reading);
    document.title = readingTitle(reading, t);
    const restoreWhenVisible = () => {
      if (!writing && document.visibilityState === "visible") document.title = base;
    };
    document.addEventListener("visibilitychange", restoreWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", restoreWhenVisible);
      document.title = base;
    };
  }, [reading, t]);
}
