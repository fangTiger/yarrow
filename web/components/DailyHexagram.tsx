import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { getHexagramText } from "../../src/agent/zhouyi-corpus.js";
import { getZhouyiEnglish } from "../../src/agent/zhouyi-en.js";
import { deriveFiveHexagrams } from "../../src/oracle/liuyao-chart.js";
import type { DailyHexagram as DailyHexagramData } from "../../src/sanyi/daily-hexagram.js";
import { api } from "../lib/api.js";
import { verifyDailyHexagram, type DailyBlockReader } from "../lib/arc-verify.js";
import { hexagramPath } from "../lib/hexagram-path.js";
import { useLang, type Lang } from "../lib/i18n.js";
import { hexagramEn } from "../lib/result-format.js";
import { ARC_NETWORK, arcChain } from "../lib/wagmi.js";
import { HexagramFigure } from "./HexagramFigure.js";

export interface DailyHexagramView {
  primaryName: string;
  derivedName: string;
  judgement: string;
  moving: ReadonlyArray<{ position: number; label: string; text: string }>;
  primaryNumber: number;
  primaryLines: readonly boolean[];
}

const CHINESE_NUMERALS = ["初", "二", "三", "四", "五", "上"] as const;

export function buildDailyHexagramView(value: DailyHexagramData, lang: Lang): DailyHexagramView {
  const figures = deriveFiveHexagrams(value.lines);
  const moving = value.lines.flatMap((line, index) => line === 6 || line === 9 ? [index] : []);
  const chinese = getHexagramText(figures.primary.kingWenNumber);
  const english = getZhouyiEnglish(figures.primary.kingWenNumber);
  return {
    primaryName: lang === "zh" ? figures.primary.name : hexagramEn(figures.primary.kingWenNumber),
    derivedName: lang === "zh" ? figures.derived.name : hexagramEn(figures.derived.kingWenNumber),
    judgement: lang === "zh" ? chinese.judgement : english.judgement,
    moving: moving.map((index) => ({
      position: index + 1,
      label: lang === "zh" ? `${CHINESE_NUMERALS[index]}爻` : `Line ${index + 1}`,
      text: lang === "zh" ? chinese.lines[index]!.text : english.lines[index]!,
    })),
    primaryNumber: figures.primary.kingWenNumber,
    primaryLines: figures.primary.yangLines,
  };
}

export async function loadDailyHexagram(
  loader: () => Promise<DailyHexagramData> = () => api.getDailyHexagram(),
): Promise<DailyHexagramData | null> {
  try {
    return await loader();
  } catch {
    return null;
  }
}

function browserReader(): DailyBlockReader {
  const client = createPublicClient({ chain: arcChain, transport: http() });
  return { getBlock: (blockNumber) => client.getBlock({ blockNumber }) };
}

function blockUrl(number: string): string {
  return `${ARC_NETWORK.explorerUrl.replace(/\/$/u, "")}/block/${number}`;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function DailyHexagram(props: {
  data?: DailyHexagramData | null;
  reader?: DailyBlockReader;
}) {
  const { lang, t } = useLang();
  const [value, setValue] = useState<DailyHexagramData | null | undefined>(props.data);
  const [verification, setVerification] = useState<"idle" | "running" | "ok" | "bad" | "error">("idle");

  useEffect(() => {
    if (props.data !== undefined) {
      setValue(props.data);
      return undefined;
    }
    let active = true;
    void loadDailyHexagram().then((result) => { if (active) setValue(result); });
    return () => { active = false; };
  }, [props.data]);

  if (!value) return null;
  const view = buildDailyHexagramView(value, lang);
  const moving = view.moving.map((item) => item.position);
  const verify = async () => {
    setVerification("running");
    try {
      const result = await verifyDailyHexagram(props.reader ?? browserReader(), value);
      setVerification(result.ok ? "ok" : "bad");
    } catch {
      setVerification("error");
    }
  };
  return <section className="daily-hexagram" aria-labelledby="daily-hexagram-title">
    <header className="daily-hexagram-head">
      <div><p>{value.date} · {t("dailyHex.free")}</p>
        <h2 id="daily-hexagram-title">{t("dailyHex.title")}</h2></div>
      <a href={blockUrl(value.block.number)} rel="noreferrer" target="_blank">
        {t("dailyHex.block", { number: value.block.number })} · {shortHash(value.block.hash)}
      </a>
    </header>
    <div className="daily-hexagram-main">
      <div className="daily-hexagram-symbol">
        <HexagramFigure label={t("dailyHex.figure", { name: view.primaryName })}
          lines={view.primaryLines} moving={moving} />
      </div>
      <div className="daily-hexagram-reading">
        <dl className="daily-hexagram-names">
          <div><dt>{t("dailyHex.primary")}</dt><dd>{view.primaryName}</dd></div>
          <div><dt>{t("dailyHex.derived")}</dt><dd>{view.derivedName}</dd></div>
          <div><dt>{t("dailyHex.moving")}</dt><dd>{view.moving.length
            ? view.moving.map((item) => item.label).join(lang === "zh" ? "、" : ", ")
            : t("dailyHex.none")}</dd></div>
        </dl>
        <div className="daily-hexagram-classic"><h3>{t("dailyHex.judgement")}</h3><p>{view.judgement}</p></div>
        {view.moving.map((item) => <div className="daily-hexagram-classic" key={item.position}>
          <h3>{item.label}</h3><p>{item.text}</p>
        </div>)}
      </div>
    </div>
    <div className="daily-hexagram-actions">
      <a className="button button-primary" href="#/?kind=question">{t("dailyHex.cta")}</a>
      {lang === "en" ? <a className="button" href={hexagramPath(view.primaryNumber)}>
        {t("dailyHex.staticPage")}</a> : null}
      <button className="button" disabled={verification === "running"}
        onClick={() => void verify()} type="button">
        {t(verification === "running" ? "dailyHex.verifying" : "dailyHex.verify")}
      </button>
      {verification !== "idle" && verification !== "running" ? <span aria-live="polite"
        className={`daily-hexagram-check ${verification}`}>
        {verification === "ok" ? `✓ ${t("dailyHex.verified")}`
          : verification === "bad" ? `✗ ${t("dailyHex.mismatch")}` : t("dailyHex.verifyError")}
      </span> : null}
    </div>
    <details className="daily-hexagram-how"><summary>{t("dailyHex.how")}</summary>
      <p>{t("dailyHex.howIntro")}</p>
      <code>keccak256(encodePacked([&quot;string&quot;,&quot;bytes32&quot;,&quot;string&quot;,&quot;uint8&quot;],
        [&quot;sanyi-daily-v1&quot;, blockHash, date, i]))</code>
      <p>{t("dailyHex.howCoins")}</p>
    </details>
  </section>;
}
