import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnyPublicReading } from "../lib/api.js";
import { useLang, useT } from "../lib/i18n.js";
import {
  buildShareCard, drawShareCard, ShareCardUnavailableError,
} from "../lib/share-card.js";

type ShareReading = Exclude<AnyPublicReading, { kind: "naming" }>;

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas-to-blob"));
    }, "image/png");
  });
}

export function ShareCard(props: {
  reading: ShareReading;
  sample?: boolean | undefined;
}) {
  const { lang } = useLang();
  const t = useT();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const objectUrl = useRef("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
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

  const releaseObjectUrl = useCallback(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = "";
  }, []);

  const closePreview = useCallback(() => {
    generation.current += 1;
    releaseObjectUrl();
    setUrl("");
    setFile(null);
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }, [releaseObjectUrl]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      releaseObjectUrl();
    };
  }, [releaseObjectUrl]);

  const previousModel = useRef(model);
  useEffect(() => {
    if (previousModel.current === model) return;
    previousModel.current = model;
    generation.current += 1;
    releaseObjectUrl();
    setUrl("");
    setFile(null);
    setOpen(false);
    setBusy(false);
  }, [model, releaseObjectUrl]);

  useEffect(() => {
    if (!open) return;
    const focusFrame = requestAnimationFrame(() => closeButton.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href]",
      );
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePreview, open]);

  if (!model) return null;

  const generate = async () => {
    const activeGeneration = generation.current + 1;
    generation.current = activeGeneration;
    setBusy(true);
    setError("");
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas-context");
      drawShareCard(context, model, {
        brush: '"Ma Shan Zheng Subset", "Kaiti SC", "STKaiti", "KaiTi", serif',
        body: '"Songti SC", "STSong", Georgia, serif',
        latin: "Georgia, serif",
      });
      const blob = await canvasBlob(canvas);
      if (!mounted.current || generation.current !== activeGeneration) return;
      const image = new File([blob], `yarrow-${props.reading.kind}.png`, { type: "image/png" });
      const nextUrl = URL.createObjectURL(blob);
      if (!mounted.current || generation.current !== activeGeneration) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      releaseObjectUrl();
      objectUrl.current = nextUrl;
      setFile(image);
      setUrl(nextUrl);
      setOpen(true);
    } catch {
      if (mounted.current && generation.current === activeGeneration) {
        setError(t("share.generateFailed"));
      }
    } finally {
      if (mounted.current && generation.current === activeGeneration) setBusy(false);
    }
  };
  const canShare = Boolean(file && typeof navigator !== "undefined"
    && navigator.canShare?.({ files: [file] }));
  const share = async () => {
    if (!file || !canShare) return;
    try {
      await navigator.share({ files: [file], title: t("share.dialogTitle") });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(t("share.shareFailed"));
    }
  };

  return <div className="share-card-entry" data-sample={props.sample ? "true" : undefined}>
    <button className="button share-card-trigger" disabled={busy} onClick={() => void generate()}
      ref={trigger} type="button">{busy ? t("share.generating") : t("share.generate")}</button>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {open && url ? <div aria-label={t("share.dialogTitle")} aria-modal="true"
      className="share-card-backdrop" role="dialog">
      <div className="share-card-dialog" ref={dialog}>
        <header><h2>{t("share.dialogTitle")}</h2>
          <button aria-label={t("share.close")} className="share-card-close"
            onClick={closePreview} ref={closeButton} type="button">×</button></header>
        <img alt={t("share.previewAlt")} src={url} />
        <div className="share-card-actions">
          {canShare ? <button className="button button-primary" onClick={() => void share()}
            type="button">{t("share.share")}</button> : null}
          <a className="button" download={`yarrow-${props.reading.kind}.png`} href={url}>
            {t("share.download")}
          </a>
          <button className="button" onClick={closePreview} type="button">{t("share.close")}</button>
        </div>
      </div>
    </div> : null}
  </div>;
}
