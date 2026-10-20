import { useEffect, useId, useState } from "react";
import {
  ALMANAC_ACTIVITY_EN,
  DAY_DEITY_EN,
  DIRECTION_EN,
  OFFICER_EN,
  PATH_EN,
  SOLAR_TERM_EN,
  formatEnglishSolarDate,
  translateClash,
  translateGanzhi,
  translateLunarDate,
} from "../lib/almanac-en.js";
import { api, type NowResponse } from "../lib/api.js";
import { useLang, type Lang } from "../lib/i18n.js";
import type { DailyHexagram } from "../../src/sanyi/daily-hexagram.js";
import { buildAlmanacShareCard, drawAlmanacShareCard } from "../lib/share-card.js";
import { ShareImageButton } from "./ShareImageButton.js";

export interface DailyAlmanacView {
  solarDate: string;
  dateLine: readonly string[];
  officer?: string;
  suitable: readonly string[];
  avoid: readonly string[];
  clash?: string;
  directions?: string;
  summary: string;
  href: string;
}

function chineseSolarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value);
  if (!match) return value.slice(0, 10);
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function translatedActivities(values: readonly string[]): string[] {
  return values.flatMap((value) => {
    const translated = ALMANAC_ACTIVITY_EN[value];
    return translated ? [translated] : [];
  }).slice(0, 8);
}

function englishOfficer(value: NowResponse): string | undefined {
  const officer = OFFICER_EN[value.dayOfficers.officer];
  const deity = DAY_DEITY_EN[value.dayOfficers.deity];
  const path = PATH_EN[value.dayOfficers.path];
  return officer && deity && path ? `${officer} · ${deity} (${path})` : undefined;
}

function englishDirections(value: NowResponse): string | undefined {
  const joy = DIRECTION_EN[value.almanac.joy];
  const wealth = DIRECTION_EN[value.almanac.wealth];
  const fortune = DIRECTION_EN[value.almanac.fortune];
  return joy && wealth && fortune
    ? `Joy: ${joy} · Wealth: ${wealth} · Fortune: ${fortune}`
    : undefined;
}

export function buildDailyAlmanacView(value: NowResponse, lang: Lang): DailyAlmanacView {
  const question = lang === "en" ? "How will today go for me?" : "我今天的运势如何？";
  const href = `#/?kind=fortune&horizon=today&q=${encodeURIComponent(question)}`;
  if (lang === "zh") {
    const solarDate = chineseSolarDate(value.solar.text);
    const suitable = value.almanac.suitable.slice(0, 8);
    return {
      solarDate,
      dateLine: [
        solarDate,
        `农历${value.lunar.date}`,
        `${value.cycle.day}日`,
        value.solarTerms.current,
      ],
      officer: `${value.dayOfficers.officer}日 · ${value.dayOfficers.deity}`
        + `（${value.dayOfficers.path}）`,
      suitable,
      avoid: value.almanac.avoid.slice(0, 8),
      clash: `冲${value.clash.description.replace("(", "（").replace(")", "）")}`
        + ` · 煞${value.clash.direction}`,
      directions: `喜神${value.almanac.joy} · 财神${value.almanac.wealth}`
        + ` · 福神${value.almanac.fortune}`,
      summary: `${solarDate} · 宜 ${suitable.slice(0, 3).join("、")}`,
      href,
    };
  }

  const solarDate = formatEnglishSolarDate(value.solar.text) ?? "";
  const lunarDate = translateLunarDate(value.lunar.date);
  const day = translateGanzhi(value.cycle.day);
  const solarTerm = SOLAR_TERM_EN[value.solarTerms.current];
  const suitable = translatedActivities(value.almanac.suitable);
  const officer = englishOfficer(value);
  const clash = translateClash(value.clash.description, value.clash.direction);
  const directions = englishDirections(value);
  return {
    solarDate,
    dateLine: [solarDate, lunarDate, day ? `${day} day` : undefined, solarTerm]
      .filter((item): item is string => Boolean(item)),
    ...(officer ? { officer } : {}),
    suitable,
    avoid: translatedActivities(value.almanac.avoid),
    ...(clash ? { clash } : {}),
    ...(directions ? { directions } : {}),
    summary: `${solarDate} · Good for ${suitable.slice(0, 3).join(", ")}`,
    href,
  };
}

function ActivityRow(props: {
  label: string;
  kind: "good" | "bad";
  values: readonly string[];
}) {
  if (!props.values.length) return null;
  return (
    <div className="daily-almanac-activities">
      <span className={`daily-almanac-badge ${props.kind}`}>{props.label}</span>
      <ul>
        {props.values.map((value) => (
          <li className={`daily-almanac-chip ${props.kind}`} key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}

export async function loadDailyAlmanac(
  loader: () => Promise<NowResponse> = () => api.getNow(),
): Promise<NowResponse | null> {
  try {
    return await loader();
  } catch {
    return null;
  }
}

export function DailyAlmanac(props: {
  data?: NowResponse | null;
  hexagram?: DailyHexagram | null;
  defaultExpanded?: boolean;
}) {
  const { lang, t } = useLang();
  const [value, setValue] = useState<NowResponse | null | undefined>(props.data);
  const [expanded, setExpanded] = useState(props.defaultExpanded ?? false);
  const [hexagram, setHexagram] = useState<DailyHexagram | null | undefined>(props.hexagram);
  const bodyId = useId();
  const titleId = useId();

  useEffect(() => {
    if (props.data !== undefined) {
      setValue(props.data);
      return undefined;
    }
    let active = true;
    void loadDailyAlmanac().then((result) => {
      if (active) setValue(result);
    });
    return () => { active = false; };
  }, [props.data]);

  useEffect(() => {
    if (props.hexagram !== undefined) {
      setHexagram(props.hexagram);
      return undefined;
    }
    let active = true;
    void api.getDailyHexagram().then((result) => { if (active) setHexagram(result); }).catch(() => {
      if (active) setHexagram(null);
    });
    return () => { active = false; };
  }, [props.hexagram]);

  if (!value) return null;
  const view = buildDailyAlmanacView(value, lang);
  const shareModel = buildAlmanacShareCard(view, lang, hexagram ?? undefined);
  const facts = [
    [t("daily.officer"), view.officer],
    [t("daily.clash"), view.clash],
    [t("daily.directions"), view.directions],
  ] as const;
  return (
    <section aria-labelledby={titleId} className={`daily-almanac${expanded ? " is-expanded" : ""}`}>
      <button
        aria-controls={bodyId}
        aria-expanded={expanded}
        aria-label={t(expanded ? "daily.collapse" : "daily.expand")}
        className="daily-almanac-summary"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>{view.summary}</span><span aria-hidden="true">⌄</span>
      </button>
      <div className="daily-almanac-body" id={bodyId}>
        <header>
          <h2 className="daily-almanac-kicker" id={titleId}>{t("daily.title")}</h2>
          <p className="daily-almanac-date">{view.dateLine.join(" · ")}</p>
        </header>
        <div className="daily-almanac-facts">
          {facts.flatMap(([label, text]) => text ? [
            <div key={label}><span>{label}</span><b>{text}</b></div>,
          ] : [])}
        </div>
        <div className="daily-almanac-yi-ji">
          <ActivityRow kind="good" label={t("daily.goodFor")} values={view.suitable} />
          <ActivityRow kind="bad" label={t("daily.avoid")} values={view.avoid} />
        </div>
        <div className="daily-almanac-actions">
          <a className="daily-almanac-cta" href={view.href}>{t("daily.cta")}</a>
          <ShareImageButton key={`${lang}-${value.solar.text}-${hexagram?.block.hash ?? "pending"}`}
            busyLabel={t("share.generating")} closeLabel={t("share.close")}
            dialogTitle={t("daily.shareDialog")} downloadLabel={t("share.download")}
            fileName={`yarrow-almanac-${value.solar.text.slice(0, 10)}.png`}
            metricEvent="share_image:almanac"
            generateFailed={t("share.generateFailed")} previewAlt={t("daily.sharePreview")}
            shareFailed={t("share.shareFailed")} shareLabel={t("share.share")}
            triggerLabel={t("daily.share")}
            draw={(context, assets) => drawAlmanacShareCard(context, shareModel, {
              brush: '"Ma Shan Zheng Subset", "Kaiti SC", "STKaiti", "KaiTi", serif',
              body: '"Songti SC", "STSong", Georgia, serif', latin: "Georgia, serif",
            }, assets)} />
        </div>
      </div>
    </section>
  );
}
