// web/providers/Providers.tsx
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { createWagmiConfig } from "../lib/wagmi.js";
import { useLang } from "../lib/i18n.js";

export function Providers({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const wagmiConfig = useMemo(() => createWagmiConfig(lang), [lang]);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale={lang === "zh" ? "zh-CN" : "en-US"}
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#C9A866",
            accentColorForeground: "#17130B",
            borderRadius: "small",
            overlayBlur: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
