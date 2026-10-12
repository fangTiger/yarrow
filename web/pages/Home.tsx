// web/pages/Home.tsx
import { useState } from "react";
import { HistoryMenu } from "../components/HistoryMenu.js";
import { QuestionForm } from "../components/QuestionForm.js";
import { WalletBar } from "../components/WalletBar.js";
import { loadRecentReadings } from "../lib/recent-readings.js";
import { LangToggle } from "../components/LangToggle.js";
import { useT } from "../lib/i18n.js";

/** 首页：顶栏右上角放卦历与钱包，中间只留问卦表单。 */
export function Home() {
  const t = useT();
  const [recent] = useState(loadRecentReadings);
  return (
    <main className="page">
      <header className="topbar">
        <span className="seal">{t("brand.seal")}</span>
        <span className="brand">{t("brand.name")}</span>
        <div className="topbar-actions">
          <LangToggle />
          <HistoryMenu readings={recent} />
          <WalletBar />
        </div>
      </header>
      <section aria-label={t("home.sectionLabel")} className="home-main">
        <QuestionForm />
      </section>
    </main>
  );
}
