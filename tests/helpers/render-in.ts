import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider, type Lang } from "../../web/lib/i18n.js";

/** 用指定语言渲染前端组件，避免每个测试重复搭建语言 Context。 */
export function renderIn(lang: Lang, element: ReactElement): string {
  return renderToStaticMarkup(createElement(LangProvider, { initialLang: lang, children: element }));
}
