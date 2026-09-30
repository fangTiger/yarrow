import "@rainbow-me/rainbowkit/styles.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.js";
import { Providers } from "./providers/Providers.js";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("页面缺少 React 根节点");

createRoot(root).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
