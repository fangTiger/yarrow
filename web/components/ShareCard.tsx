import { useMemo } from "react";
import type { AnyPublicReading } from "../lib/api.js";
import { useLang, useT } from "../lib/i18n.js";
import { buildShareCard, drawShareCard, ShareCardUnavailableError } from "../lib/share-card.js";
import { ShareImageButton } from "./ShareImageButton.js";

type ShareReading = Exclude<AnyPublicReading, { kind: "naming" }>;

export function ShareCard(props: { reading: ShareReading; sample?: boolean | undefined }) {
  const { lang } = useLang();
  const t = useT();
  const summary = props.reading.summary;
  const model = useMemo(() => {
    if (summary?.status !== "done" || !summary.output) return null;
    try {
      return buildShareCard(props.reading, lang, t, { sample: props.sample });
    } catch (caught) {
      if (caught instanceof ShareCardUnavailableError) return null;
      throw caught;
    }
  }, [lang, props.reading, props.sample, summary, t]);
  if (!model) return null;
  return <ShareImageButton key={`${lang}-${props.reading.id}`} busyLabel={t("share.generating")} closeLabel={t("share.close")}
    dataSample={props.sample} dialogTitle={t("share.dialogTitle")} downloadLabel={t("share.download")}
    fileName={`yarrow-${props.reading.kind}.png`} generateFailed={t("share.generateFailed")}
    metricEvent="share_image:reading"
    previewAlt={t("share.previewAlt")} shareFailed={t("share.shareFailed")}
    shareLabel={t("share.share")} triggerLabel={t("share.generate")}
    draw={(context, assets) => drawShareCard(context, model, {
      brush: '"Ma Shan Zheng Subset", "Kaiti SC", "STKaiti", "KaiTi", serif',
      body: '"Songti SC", "STSong", Georgia, serif',
      latin: "Georgia, serif",
    }, assets)} />;
}
