import { useT } from "../lib/i18n.js";

/** 顶栏返回首页按钮：与语言切换、钱包同款描边样式，放在顶栏操作区最前。 */
export function HomeButton() {
  const t = useT();
  return (
    <a aria-label={t("result.backHome")} className="home-button" href="#/">
      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
      <span>{t("nav.home")}</span>
    </a>
  );
}
