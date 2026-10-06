// web/pages/Home.tsx
import { useState } from "react";
import { HistoryMenu } from "../components/HistoryMenu.js";
import { QuestionForm } from "../components/QuestionForm.js";
import { WalletBar } from "../components/WalletBar.js";
import { loadRecentReadings } from "../lib/recent-readings.js";

/** 首页：顶栏右上角放卦历与钱包，中间只留问卦表单。 */
export function Home() {
  const [recent] = useState(loadRecentReadings);
  return (
    <main className="page">
      <header className="topbar">
        <span className="seal">问</span>
        <span className="brand">三易</span>
        <div className="topbar-actions">
          <HistoryMenu readings={recent} />
          <WalletBar />
        </div>
      </header>
      <section aria-label="问卦" className="home-main">
        <QuestionForm />
      </section>
    </main>
  );
}
