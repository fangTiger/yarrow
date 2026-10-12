import { useEffect, useState, type ReactElement } from "react";
import type { AnyPublicReading } from "../lib/api.js";
import { applyReadingTranslation } from "../lib/reading-translation.js";
import { useLang, useT, type Lang } from "../lib/i18n.js";
import { LangToggle } from "../components/LangToggle.js";
import { QuestionResult } from "./Reading.js";
import { BaziReading } from "./BaziReading.js";
import { NamingReading } from "./NamingReading.js";

export type SampleKind = "question" | "fortune" | "naming";

export async function loadSampleReading(
  kind: SampleKind,
  fetcher: typeof fetch = fetch,
): Promise<AnyPublicReading | null> {
  try {
    const response = await fetcher(`/samples/${kind}.json`);
    if (!response.ok) return null;
    const value = await response.json() as AnyPublicReading;
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
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
    void loadSampleReading(kind).then((value) => {
      if (active) setReading(value);
    });
    return () => { active = false; };
  }, [kind]);
  return <main className="page sample-page">
    <header className="topbar"><span className="seal">{t("brand.seal")}</span>
      <span className="brand">{t("brand.name")}</span><div className="topbar-actions">
        <LangToggle /><a href="#/">{t("result.backHome")}</a></div></header>
    <div className="sample-banner">{t("sample.banner")}</div>
    <SampleContent lang={lang} reading={reading} />
  </main>;
}
