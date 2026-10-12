// web/main.tsx
import "@rainbow-me/rainbowkit/styles.css";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/bazi.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import { Providers } from "./providers/Providers.js";
import { detectLang, LangProvider } from "./lib/i18n.js";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) {
  throw new Error("页面缺少 React 根节点");
}
createRoot(root).render(
  <StrictMode>
    <LangProvider initialLang={detectLang()}>
      <Providers>
        <App />
      </Providers>
    </LangProvider>
  </StrictMode>,
);
