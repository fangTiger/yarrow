import { WalletBar } from "../components/WalletBar.js";
// web/pages/Home.tsx
import { useState } from "react";
import { QuestionForm } from "../components/QuestionForm.js";
import { RecentReadings } from "../components/RecentReadings.js";
import { ShikongBar } from "../components/ShikongBar.js";
import { loadRecentReadings } from "../lib/recent-readings.js";
export function Home() {
  const [recent] = useState(loadRecentReadings);
  return (
    <main className="page">
      <header className="topbar">
        <span className="seal">问</span>
        <span className="brand">三易</span>
        <WalletBar />
      </header>
      <ShikongBar />
      <div className="home-grid">
        <QuestionForm />
        <RecentReadings readings={recent} />
      </div>
    </main>
  );
}
