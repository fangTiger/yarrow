import { useT } from "../lib/i18n.js";

export function FundingGuide(props: { mainnet: boolean; open?: boolean }) {
  const t = useT();
  if (!props.mainnet) return null;
  return <details className="funding-guide" open={props.open || undefined}>
    <summary>{t("funding.title")}</summary>
    <ol>
      <li>{t("funding.step1")}</li>
      <li>
        <span>{t("funding.step2Intro")}</span>
        <div className="funding-bridges">
          <span><a href="https://bridge.usdc.com" rel="noreferrer" target="_blank">
            {t("funding.circle")}
          </a>{t("funding.circleNote")}</span>
          <span><a href="https://across.to/arc-bridge" rel="noreferrer" target="_blank">
            {t("funding.across")}
          </a>{t("funding.acrossNote")}</span>
        </div>
        <span>{t("funding.step2Note")}</span>
      </li>
      <li>{t("funding.step3")}</li>
    </ol>
  </details>;
}
