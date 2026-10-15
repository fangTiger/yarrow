import type { FrontendMetricEvent } from "../../src/sanyi/metrics.js";

const viewed = new Set<FrontendMetricEvent>();

/** 匿名上报单个事件；导航离开时仍尽量发送，失败不打扰用户。 */
export function track(event: FrontendMetricEvent, fetcher: typeof fetch = fetch): void {
  const deduplicated = event === "home_view" || event.startsWith("sample_view:");
  if (deduplicated && viewed.has(event)) return;
  if (deduplicated) viewed.add(event);
  void fetcher("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {
    // 埋点失败静默，不影响页面操作。
  });
}
