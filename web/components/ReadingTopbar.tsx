import { HomeButton } from "./HomeButton.js";
import { LangToggle } from "./LangToggle.js";
import { TopbarBrand } from "./TopbarBrand.js";
import { WalletBar } from "./WalletBar.js";

/** 结果页顶栏：各类解读及加载、出错状态共用，保证随时可切换中英文。 */
export function ReadingTopbar() {
  return (
    <header className="topbar">
      <TopbarBrand />
      <div className="topbar-actions">
        <HomeButton />
        <LangToggle />
        <WalletBar />
      </div>
    </header>
  );
}
