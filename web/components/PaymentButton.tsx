// web/components/PaymentButton.tsx
import { truncateAddress } from "../lib/wallet-summary.js";
import type { BirthProfileInput } from "../lib/birth-profile.js";
import type { SanyiFeeProof } from "../../src/sanyi/fee.js";
import { useState } from "react";
import { formatUnits } from "viem";
import { api } from "../lib/api.js";
import { saveRecentReading } from "../lib/recent-readings.js";
import { useFeePayment } from "../lib/use-fee-payment.js";
import type { ClassificationView } from "../lib/home-entry.js";
import type { NamingRequest } from "../lib/home-entry.js";
import { useLang, useT } from "../lib/i18n.js";
import { isFormValidationFailure, paymentFailure, paymentFailureKind } from "../lib/payment-error.js";
import { WalletPaymentGuide } from "./WalletPaymentGuide.js";
import { track } from "../lib/metrics.js";
export function PaymentButton(props: {
  question: string;
  classification: ClassificationView;
  birth?: BirthProfileInput | null;
  naming?: NamingRequest;
  onMissingBirth?(): void;
}) {
  const t = useT();
  const { lang } = useLang();
  const { pay, payment, estimatedGasWei18, connectionMessage } = useFeePayment();
  const [paidProof, setPaidProof] = useState<SanyiFeeProof>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existingReadingId, setExistingReadingId] = useState<string>();
  const submit = async () => {
    track("pay_click");
    setBusy(true);
    setError("");
    setExistingReadingId(undefined);
    let hasPaymentProof = Boolean(paidProof);
    try {
      const feeProof = paidProof ?? await pay();
      hasPaymentProof = true;
      setPaidProof(feeProof);
      const reading = await api.createReading(props.naming
        ? { ...props.naming, feeProof, lang }
        : {
            question: props.question,
            kind: props.classification.kind as "question" | "destiny" | "fortune",
            ...(props.birth ? { birth: props.birth, sect: 1 as const } : {}),
            ...(props.classification.horizon ? { horizon: props.classification.horizon } : {}),
            ...(props.classification.subjectKey ? { subjectKey: props.classification.subjectKey } : {}),
            feeProof,
            lang,
          });
      saveRecentReading({
        id: reading.id,
        kind: reading.kind,
        question: reading.question,
        createdAt: reading.createdAt,
      });
      location.hash = `/r/${reading.id}`;
    } catch (caught) {
      const failure = paymentFailure(caught, t);
      if (failure.missingBirth) {
        props.onMissingBirth?.();
      }
      if (!failure.missingBirth) {
        if (!isFormValidationFailure(caught)) {
          const kind = paymentFailureKind(caught, { hasPaymentProof });
          track(`pay_failed:${kind}`);
        }
      }
      setError(failure.message);
      setExistingReadingId(failure.readingId);
    } finally { setBusy(false); }
  };
  const gas = estimatedGasWei18 === undefined
    ? t("payment.gasAfterConnect")
    : `${formatUnits(estimatedGasWei18, 18)} USDC`;
  return (
    <div className="payment-area">
      <WalletPaymentGuide />
      <details className="payment-details">
        <summary>{t("payment.details")}</summary>
        <p className="hint">
          {t("payment.recipient", {
            recipient: payment ? truncateAddress(payment.recipient) : t("payment.recipientLoading"),
          })} · {t("payment.gas", { gas })}
        </p>
      </details>
      <button
        className="button button-primary"
        disabled={busy}
        onClick={submit}
        type="button"
      >
        {busy ? t("payment.busy") : t("payment.button")}
      </button>
      {connectionMessage ? <p aria-live="polite" className="hint">{connectionMessage}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {existingReadingId ? (
        <a className="hint" href={`#/r/${existingReadingId}`}>{t("payment.openExisting")}</a>
      ) : null}
    </div>
  );
}
