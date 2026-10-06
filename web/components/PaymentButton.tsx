// web/components/PaymentButton.tsx
import { truncateAddress } from "../lib/wallet-summary.js";
import type { BirthProfileInput } from "../lib/birth-profile.js";
import { isMissingBirth } from "../lib/birth-entry.js";
import type { SanyiFeeProof } from "../../src/sanyi/fee.js";
import { useState } from "react";
import { formatUnits } from "viem";
import { api, ApiError } from "../lib/api.js";
import { saveRecentReading } from "../lib/recent-readings.js";
import { useFeePayment } from "../lib/use-fee-payment.js";
import type { ClassificationView } from "./ClassificationTags.js";
export function PaymentButton(props: { question: string; classification: ClassificationView; birth?: BirthProfileInput | null; onMissingBirth?(): void }) {
  const { pay, payment, estimatedGasWei18, connectionMessage } = useFeePayment();
  const [paidProof, setPaidProof] = useState<SanyiFeeProof>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const feeProof = paidProof ?? await pay();
      setPaidProof(feeProof);
      const reading = await api.createReading({
        question: props.question,
        kind: props.classification.kind as "question" | "destiny" | "fortune",
        ...(props.birth ? { birth: props.birth, sect: 1 as const } : {}),
        ...(props.classification.horizon ? { horizon: props.classification.horizon } : {}),
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
      if (isMissingBirth(caught)) {
        props.onMissingBirth?.();
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
