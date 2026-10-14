// web/components/ArcVerify.tsx
import { useState } from "react";
import { createPublicClient, http, type Hex } from "viem";
import { api } from "../lib/api.js";
import {
  isVerifiablePayment, verifyOnArc, type ArcReader, type ThrowCheck, type ThrowEvidence, type VerifyResult,
} from "../lib/arc-verify.js";
import { useLang, useT } from "../lib/i18n.js";
import { ARC_EXPLORER, arcChain } from "../lib/wagmi.js";

/** 付费结果出问题时的求助入口：公开仓库的 Issues，用户附上付款哈希即可定位。 */
const SUPPORT_URL = "https://github.com/fangTiger/yarrow/issues";

function explorer(path: string): string {
  return `${ARC_EXPLORER.replace(/\/$/u, "")}/${path}`;
}

function shortAddress(value: string | undefined): string {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";
}

/** 浏览器直接连 Arc RPC，不经过三易服务端。 */
function browserReader(): ArcReader {
  const client = createPublicClient({ chain: arcChain, transport: http() });
  return {
    getTransactionReceipt: (hash) => client.getTransactionReceipt({ hash }),
    getBlock: (blockNumber) => client.getBlock({ blockNumber }),
  };
}

function throwIssue(item: ThrowCheck): "verify.throwHash" | "verify.throwOrder" | "verify.throwCoins" | null {
  if (!item.hashOk) return "verify.throwHash";
  if (!item.afterPayment) return "verify.throwOrder";
  if (!item.coinsOk) return "verify.throwCoins";
  return null;
}

/**
 * 「在 Arc 上验证」：核对付款（收款方、0.05 USDC、区块），问事另按公式复算六掷。
 * 示例的付款哈希已抹零，只给出说明，不显示按钮。
 */
export function ArcVerify(props: {
  paymentHash: string | undefined;
  question?: string;
  throws?: readonly ThrowEvidence[];
  /** 测试注入；缺省时在浏览器里直连 Arc RPC。 */
  reader?: ArcReader;
}) {
  const t = useT();
  const { lang } = useLang();
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const cast = Boolean(props.throws?.length);
  if (!isVerifiablePayment(props.paymentHash)) {
    return <p className="arc-verify-note">{t("verify.sample")}</p>;
  }
  const paymentHash: Hex = props.paymentHash;
  const run = async () => {
    setState("running");
    try {
      const recipient = await api.getPayment().then((value) => value.recipient).catch(() => undefined);
      const value = await verifyOnArc(props.reader ?? browserReader(), {
        paymentTxHash: paymentHash,
        ...(recipient ? { recipient } : {}),
        ...(cast && props.question !== undefined ? { question: props.question, throws: props.throws } : {}),
      });
      setResult(value);
      setState("idle");
    } catch {
      setState("error");
    }
  };
  const time = (seconds: bigint | undefined) => seconds === undefined ? "—"
    : new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "zh-CN", {
      dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
    }).format(new Date(Number(seconds) * 1000)) + " UTC";
  return <div className="arc-verify">
    <p className="arc-verify-intro">{t(cast ? "verify.introCast" : "verify.intro")}</p>
    <button className="button" disabled={state === "running"} onClick={() => void run()} type="button">
      {state === "running" ? t("verify.running") : t("verify.button")}</button>
    {state === "error" ? <p className="error" role="alert">{t("verify.error")}</p> : null}
    <p className="arc-verify-help">{t("verify.help")}{" "}
      <a href={SUPPORT_URL} rel="noreferrer" target="_blank">GitHub Issues</a></p>
    {result ? <div aria-live="polite" className={`arc-verify-result ${result.ok ? "ok" : "bad"}`}>
      <p className="arc-verify-verdict"><b>{result.ok ? "✓" : "✗"}</b>
        {t(result.ok ? "verify.passed" : "verify.failed")}</p>
      <ul>
        <li className={result.payment.ok ? "ok" : "bad"}>
          <b>{result.payment.ok ? "✓" : "✗"}</b>
          <span>{result.payment.ok || result.payment.amountUsdc6 !== undefined
            ? t("verify.payment", {
              amount: (Number(result.payment.amountUsdc6 ?? 0n) / 1e6).toFixed(2),
              to: shortAddress(result.payment.to),
              block: result.payment.blockNumber?.toString() ?? "—",
              time: time(result.payment.timestamp),
            })
            : t(`verify.paymentFail.${result.payment.reason ?? "not-found"}`)}
          {result.payment.ok ? null : result.payment.amountUsdc6 !== undefined
            ? <em> · {t(`verify.paymentFail.${result.payment.reason ?? "not-found"}`)}</em> : null}
          {" "}<a href={explorer(`tx/${paymentHash}`)} rel="noreferrer" target="_blank">{t("verify.explorer")}</a>
          </span>
        </li>
        {result.throws.map((item) => {
          const issue = throwIssue(item);
          return <li className={item.ok ? "ok" : "bad"} key={item.index}>
            <b>{item.ok ? "✓" : "✗"}</b>
            <span>{t("verify.throw", { index: item.index, block: item.blockNumber })} · {issue
              ? t(issue) : t("verify.throwOk")}{" "}
              <a href={explorer(`block/${item.blockNumber}`)} rel="noreferrer" target="_blank">
                {t("verify.explorer")}</a></span>
          </li>;
        })}
      </ul>
    </div> : null}
  </div>;
}

/** 八字与起名结果页底部：只核对付款的独立面板。 */
export function ArcVerifyPanel(props: { paymentHash: string | undefined }) {
  const t = useT();
  return <section className="panel verify-panel arc-verify-panel">
    <header className="panel-head"><h2>{t("verify.title")}</h2></header>
    <ArcVerify paymentHash={props.paymentHash} />
  </section>;
}
