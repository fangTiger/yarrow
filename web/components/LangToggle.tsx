import { useLang } from "../lib/i18n.js";

export function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <button
      aria-label={t("lang.toggleLabel")}
      className="lang-toggle"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      type="button"
    >
      {t("lang.toggle")}
    </button>
  );
}
