// web/lib/recent-readings.ts
export interface RecentReading {
  id: string;
  kind: string;
  question: string;
  createdAt: string;
}
const KEY = "sanyi.recent-readings.v1";
function isRecent(value: unknown): value is RecentReading {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return [item.id, item.kind, item.question, item.createdAt].every((field) => typeof field === "string");
}
export function loadRecentReadings(storage: Storage = localStorage): RecentReading[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isRecent).slice(0, 20) : [];
  } catch { return []; }
}
export function saveRecentReading(item: RecentReading, storage: Storage = localStorage): void {
  try {
    const previous = loadRecentReadings(storage).filter((value) => value.id !== item.id);
    const values = [item, ...previous].slice(0, 20);
    storage.setItem(KEY, JSON.stringify(values));
  } catch {}
}
