import { useEffect, useState, type ReactElement } from "react";
import type { AnyPublicReading } from "../lib/api.js";
import { applyReadingTranslation } from "../lib/reading-translation.js";
import { useLang, useT, type Lang } from "../lib/i18n.js";
import { LangToggle } from "../components/LangToggle.js";
import { QuestionResult } from "./Reading.js";
import { BaziReading } from "./BaziReading.js";
import { NamingReading } from "./NamingReading.js";
import { DisclaimerFooter } from "../components/DisclaimerFooter.js";

export type SampleKind = "question" | "fortune" | "naming";

/** 先按语言加载 `<kind>.<lang>.json`（中英各用一卦更贴切的示例），缺失时退回 `<kind>.json`。 */
export async function loadSampleReading(
  kind: SampleKind,
  fetcher: typeof fetch = fetch,
  lang?: Lang,
): Promise<AnyPublicReading | null> {
  const paths = [...(lang ? [`/samples/${kind}.${lang}.json`] : []), `/samples/${kind}.json`];
  for (const path of paths) {
    try {
      const response = await fetcher(path);
      if (!response.ok) continue;
      const value = await response.json() as AnyPublicReading;
      if (value && typeof value === "object") return value;
    } catch {
      // 网络或解析失败时试下一个路径。
    }
  }
  return null;
}

export function localizedSampleReading<T extends AnyPublicReading>(reading: T, lang: Lang): T {
  return lang === "en" ? applyReadingTranslation(reading) : reading;
}

/** 示例统一走现有结果组件，但关闭一切会改动或重试存档的入口。 */
export function sampleResult(reading: AnyPublicReading): ReactElement {
  const noop = () => {};
  if (reading.kind === "question") {
    return <QuestionResult onReading={noop} readonly reading={reading} />;
  }
  if (reading.kind === "naming") {
    return <NamingReading onReading={noop} readonly reading={reading} />;
  }
  return <BaziReading birth={null} onReading={noop} readonly reading={reading} />;
}

export function SampleContent(props: {
  reading: AnyPublicReading | null | undefined;
  lang: Lang;
}) {
  const t = useT();
  return props.reading === undefined
    ? <section aria-live="polite" className="panel">{t("result.opening")}</section>
    : props.reading === null
      ? <section className="panel sample-pending"><h1>{t("sample.pending")}</h1></section>
      : sampleResult(localizedSampleReading(props.reading, props.lang));
}

export function SampleReading({ kind }: { kind: SampleKind }) {
  const { lang } = useLang();
  const t = useT();
  const [reading, setReading] = useState<AnyPublicReading | null>();
  useEffect(() => {
    let active = true;
    setReading(undefined);
    void loadSampleReading(kind, fetch, lang).then((value) => {
      if (active) setReading(value);
    });
    return () => { active = false; };
  }, [kind, lang]);
  return <main className="page sample-page">
    <header className="topbar"><span className="seal">{t("brand.seal")}</span>
      <span className="brand">{t("brand.name")}</span><div className="topbar-actions">
        <LangToggle /><a href="#/">{t("result.backHome")}</a></div></header>
    <div className="sample-banner">{t("sample.banner")}</div>
    <SampleContent lang={lang} reading={reading} />
    <DisclaimerFooter />
  </main>;
}
