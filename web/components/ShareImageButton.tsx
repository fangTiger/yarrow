import { useCallback, useEffect, useRef, useState } from "react";

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("canvas-to-blob")), "image/png");
  });
}

/** 结果卡与黄历卡共用的浏览器生成、预览、系统分享和下载交互。 */
export function ShareImageButton(props: {
  triggerLabel: string; busyLabel: string; dialogTitle: string; previewAlt: string;
  shareLabel: string; downloadLabel: string; closeLabel: string;
  generateFailed: string; shareFailed: string; fileName: string;
  draw(context: CanvasRenderingContext2D, assets: { mark?: CanvasImageSource }): void;
  dataSample?: boolean | undefined;
}) {
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
  const releaseObjectUrl = useCallback(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = "";
  }, []);
  const closePreview = useCallback(() => {
    generation.current += 1;
    releaseObjectUrl();
    setUrl(""); setFile(null); setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }, [releaseObjectUrl]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; releaseObjectUrl(); };
  }, [releaseObjectUrl]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => closeButton.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return closePreview();
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
      if (!focusable?.length) return;
      const first = focusable[0]!; const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown); };
  }, [closePreview, open]);
  const generate = async () => {
    const active = generation.current + 1;
    generation.current = active; setBusy(true); setError("");
    try {
      await document.fonts.ready;
      const mark = new Image(); mark.src = "/brand/yarrow-mark.svg";
      const markReady = await mark.decode().then(() => true, () => false);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas-context");
      props.draw(context, markReady ? { mark } : {});
      const blob = await canvasBlob(canvas);
      if (!mounted.current || generation.current !== active) return;
      const nextFile = new File([blob], props.fileName, { type: "image/png" });
      const nextUrl = URL.createObjectURL(blob);
      if (!mounted.current || generation.current !== active) return URL.revokeObjectURL(nextUrl);
      releaseObjectUrl(); objectUrl.current = nextUrl;
      setFile(nextFile); setUrl(nextUrl); setOpen(true);
    } catch {
      if (mounted.current && generation.current === active) setError(props.generateFailed);
    } finally {
      if (mounted.current && generation.current === active) setBusy(false);
    }
  };
  const canShare = Boolean(file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }));
  const share = async () => {
    if (!file || !canShare) return;
    try { await navigator.share({ files: [file], title: props.dialogTitle }); }
    catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(props.shareFailed);
    }
  };
  return <div className="share-card-entry" data-sample={props.dataSample ? "true" : undefined}>
    <button className="button share-card-trigger" disabled={busy} onClick={() => void generate()}
      ref={trigger} type="button">{busy ? props.busyLabel : props.triggerLabel}</button>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {open && url ? <div aria-label={props.dialogTitle} aria-modal="true" className="share-card-backdrop"
      role="dialog"><div className="share-card-dialog" ref={dialog}>
        <header><h2>{props.dialogTitle}</h2><button aria-label={props.closeLabel}
          className="share-card-close" onClick={closePreview} ref={closeButton} type="button">×</button></header>
        <img alt={props.previewAlt} src={url} /><div className="share-card-actions">
          {canShare ? <button className="button button-primary" onClick={() => void share()}
            type="button">{props.shareLabel}</button> : null}
          <a className="button" download={props.fileName} href={url}>{props.downloadLabel}</a>
          <button className="button" onClick={closePreview} type="button">{props.closeLabel}</button>
        </div>
      </div></div> : null}
  </div>;
}
