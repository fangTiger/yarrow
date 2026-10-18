import type { SanyiLogger } from "./log.js";
import type { DocumentBackend } from "./storage.js";

export const READING_KINDS = ["question", "destiny", "fortune", "naming"] as const;
export const PAYMENT_FAILURE_KINDS = ["rejected", "insufficient", "wrong-chain", "claim", "other"] as const;
export type PaymentFailureKind = typeof PAYMENT_FAILURE_KINDS[number];
export type ReadingKind = typeof READING_KINDS[number];
export type FrontendMetricEvent = "home_view" | "wallet_connect_click" | "pay_click"
  | `sample_view:${ReadingKind}` | `pay_failed:${PaymentFailureKind}`;
export type MetricEvent = FrontendMetricEvent
  | `reading_created:${ReadingKind}`
  | `reading_done:${ReadingKind}`
  | `reading_failed:${ReadingKind}`;

export interface MetricsDay {
  date: string;
  counts: Record<string, number>;
}

export interface MetricsRecorder {
  increment(event: MetricEvent): Promise<void>;
}

export interface UsageMetrics extends MetricsRecorder {
  recentDays(days: number): Promise<MetricsDay[]>;
}

const FRONTEND_EVENTS = new Set<string>([
  "home_view",
  "wallet_connect_click",
  "pay_click",
  ...READING_KINDS.map((kind) => `sample_view:${kind}`),
  ...PAYMENT_FAILURE_KINDS.map((kind) => `pay_failed:${kind}`),
]);

const ALL_EVENTS = new Set<string>([
  ...FRONTEND_EVENTS,
  ...READING_KINDS.flatMap((kind) => [
    `reading_created:${kind}`,
    `reading_done:${kind}`,
    `reading_failed:${kind}`,
  ]),
]);

export function isFrontendMetricEvent(value: unknown): value is FrontendMetricEvent {
  return typeof value === "string" && FRONTEND_EVENTS.has(value);
}

export function isMetricEvent(value: unknown): value is MetricEvent {
  return typeof value === "string" && ALL_EVENTS.has(value);
}

export const NOOP_METRICS: UsageMetrics = {
  async increment() {},
  async recentDays(days) {
    const now = new Date();
    return dateWindow(now, days).map((date) => ({ date, counts: {} }));
  },
};

/** 注入实现即使意外抛错，也只能留下日志，不能改变结果服务的成败。 */
export async function incrementMetricSafely(
  metrics: MetricsRecorder,
  logger: SanyiLogger,
  event: MetricEvent,
): Promise<void> {
  try {
    await metrics.increment(event);
  } catch {
    try {
      await logger.write("使用计数失败", { event });
    } catch {
      // 计数与日志都不能影响用户主流程。
    }
  }
}

interface MetricsDocument {
  counts: Record<string, number>;
}

export interface DocumentUsageMetricsOptions {
  backend: DocumentBackend;
  logger: SanyiLogger;
  clock?: () => Date;
}

function beijingDate(now: Date): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

function dateWindow(now: Date, days: number): string[] {
  const end = new Date(`${beijingDate(now)}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function parseDocument(raw: string): MetricsDocument {
  const parsed = JSON.parse(raw) as { counts?: unknown };
  const counts: Record<string, number> = {};
  if (parsed.counts && typeof parsed.counts === "object" && !Array.isArray(parsed.counts)) {
    for (const [event, count] of Object.entries(parsed.counts)) {
      if (isMetricEvent(event) && typeof count === "number" && Number.isSafeInteger(count) && count >= 0) {
        counts[event] = count;
      }
    }
  }
  return { counts };
}

export class DocumentUsageMetrics implements UsageMetrics {
  private readonly clock: () => Date;

  constructor(private readonly options: DocumentUsageMetricsOptions) {
    this.clock = options.clock ?? (() => new Date());
  }

  async increment(event: MetricEvent): Promise<void> {
    if (!isMetricEvent(event)) return;
    const date = beijingDate(this.clock());
    const key = `metrics/${date}`;
    try {
      await this.options.backend.incrementCounter(key, event);
    } catch {
      try {
        await this.options.logger.write("使用计数失败", { event });
      } catch {
        // 计数与日志都不能影响用户主流程。
      }
    }
  }

  async recentDays(days: number): Promise<MetricsDay[]> {
    return Promise.all(dateWindow(this.clock(), days).map(async (date) => {
      try {
        const raw = await this.options.backend.get(`metrics/${date}`);
        return { date, counts: parseDocument(raw).counts };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return { date, counts: {} };
        throw error;
      }
    }));
  }
}
