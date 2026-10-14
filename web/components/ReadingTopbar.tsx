import { useT } from "../lib/i18n.js";
import { LangToggle } from "./LangToggle.js";
import { TopbarBrand } from "./TopbarBrand.js";
import { WalletBar } from "./WalletBar.js";

/** 结果页顶栏：各类解读及加载、出错状态共用，保证随时可切换中英文。 */
export function ReadingTopbar() {
  const t = useT();
  return (
    <header className="topbar">
      <TopbarBrand />
      <div className="topbar-actions">
        <LangToggle />
        <a href="#/">{t("result.backHome")}</a>
        <WalletBar />
      </div>
    </header>
  );
}
