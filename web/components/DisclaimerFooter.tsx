import { useT } from "../lib/i18n.js";

/** 结果页免责声明；首页由付款区就近显示同一句。 */
export function DisclaimerFooter() {
  const t = useT();
  return <footer className="result-footer">{t("home.disclaimer")}</footer>;
}
