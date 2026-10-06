// web/components/PaymentButton.tsx
import { truncateAddress } from "../lib/wallet-summary.js";
import { useState } from "react";
import { formatUnits } from "viem";
import { api, ApiError } from "../lib/api.js";
import { saveRecentReading } from "../lib/recent-readings.js";
import { useFeePayment } from "../lib/use-fee-payment.js";
import type { ClassificationView } from "./ClassificationTags.js";
export function PaymentButton(props: { question: string; classification: ClassificationView }) {
  const { pay, payment, estimatedGasWei18, connectionMessage } = useFeePayment();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const feeProof = await pay();
      const reading = await api.createReading({
        question: props.question,
        kind: "question",
        ...(props.classification.subjectKey
          ? { subjectKey: props.classification.subjectKey }
          : {}),
        feeProof,
      });
      saveRecentReading({
        id: reading.id,
        kind: reading.kind,
        question: reading.question,
        createdAt: reading.createdAt,
      });
      location.hash = `/r/${reading.id}`;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.readingId) {
        location.hash = `/r/${caught.readingId}`;
        return;
      }
      setError(caught instanceof Error ? caught.message : "付款未完成，本次没有扣款");
    } finally { setBusy(false); }
  };
  const gas = estimatedGasWei18 === undefined
    ? "连接钱包后计算"
    : `${formatUnits(estimatedGasWei18, 18)} USDC`;
  return (
    <div>
      <p className="hint">
        0.05 USDC → 三易收款地址 {payment ? truncateAddress(payment.recipient) : "正在读取"} · 预估 gas {gas}
      </p>
      <button
        className="button button-primary"
        disabled={busy}
        onClick={submit}
        type="button"
      >
        {busy ? "正在确认" : "问卦 · 0.05 USDC"}
      </button>
      {connectionMessage ? <p aria-live="polite" className="hint">{connectionMessage}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
