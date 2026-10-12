import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { en } from "../i18n/en.js";
import { zh, type TranslationKey } from "../i18n/zh.js";

export type Lang = "zh" | "en";
export type TranslationParams = Readonly<Record<string, string | number>>;
export type TFunction = (key: TranslationKey, params?: TranslationParams) => string;
type Dictionary = Record<TranslationKey, string>;

export function createT(dictionary: Dictionary): TFunction {
  return (key, params = {}) => Object.entries(params).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    dictionary[key],
  );
}

export const zhT = createT(zh);
const enT = createT(en);

export class I18nError extends Error {
  constructor(readonly key: TranslationKey, readonly params: TranslationParams = {}) {
    super(zhT(key, params));
    this.name = "I18nError";
  }
}

export function detectLang(options: {
  storage?: Pick<Storage, "getItem">;
  navigatorLanguage?: string;
} = {}): Lang {
  let saved: string | null = null;
  try {
    const storage = options.storage ?? globalThis.localStorage;
    saved = storage.getItem("sanyi.lang");
  } catch {
    // 隐私模式或禁用存储时按浏览器语言继续。
  }
  if (saved === "zh" || saved === "en") return saved;
  const language = options.navigatorLanguage ?? globalThis.navigator?.language ?? "zh";
  return language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

interface LangContextValue {
  lang: Lang;
  setLang(lang: Lang): void;
  t: TFunction;
}

const LangContext = createContext<LangContextValue>({ lang: "zh", setLang: () => {}, t: zhT });

export function LangProvider(props: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(props.initialLang ?? "zh");
  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t: lang === "en" ? enT : zhT }),
    [lang],
  );
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = value.t("meta.title");
    document.querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", value.t("meta.description"));
    try {
      globalThis.localStorage.setItem("sanyi.lang", lang);
    } catch {
      // 写入失败不影响当前会话切换。
    }
  }, [lang, value]);
  return <LangContext.Provider value={value}>{props.children}</LangContext.Provider>;
}

export function useT(): TFunction {
  return useContext(LangContext).t;
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

export function localizedError(error: unknown, t: TFunction): string {
  if (error instanceof I18nError) return t(error.key, error.params);
  return error instanceof Error ? error.message : t("errors.generic");
}
