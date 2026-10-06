export function walletErrorMessage(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  let rejected = false;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "string") {
      messages.push(current);
      break;
    }
    if (typeof current !== "object") {
      break;
    }
    const value = current as { name?: string; code?: number; message?: string; cause?: unknown };
    rejected ||= value.name === "UserRejectedRequestError" || value.code === 4001;
    if (value.message) {
      messages.push(value.message);
    }
    current = value.cause;
  }
  const reason = messages.join(" · ").replace(/\s+/gu, " ");
  if (rejected || /rejected|denied/iu.test(reason)) {
    return "你已取消付款，资金没有变动";
  }
  if (/insufficient|余额不足/iu.test(reason)) {
    return "余额不足，请先领取 Arc Testnet 测试币";
  }
  if (/chain|network mismatch|wrong network|网络不符|切换.*网络|切换.*Arc/iu.test(reason)) {
    return "请把钱包切换到 Arc Testnet 后重试";
  }
  const detail = reason.length > 100 ? `${reason.slice(0, 100)}…` : reason;
  return `付款没有完成，请稍后重试${detail ? `（原因：${detail}）` : ""}`;
}
