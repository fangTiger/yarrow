import { useState } from "react";
import { dayMasterBySlug, type DayMasterProfile } from "../../src/content/day-masters.js";
import { api, apiErrorMessage } from "../lib/api.js";
import {
  EMPTY_BIRTH,
  birthProblem,
  fromBirthInput,
  loadBirthProfile,
  saveBirthProfile,
  toBirthInput,
  type BirthFormValues,
  type BirthProfileInput,
} from "../lib/birth-profile.js";
import { useLang, useT } from "../lib/i18n.js";
import { track } from "../lib/metrics.js";
import { buildDayMasterShareCard, drawShareCard } from "../lib/share-card.js";
import { BirthFields } from "./BirthFields.js";
import { ShareImageButton } from "./ShareImageButton.js";

function initialBirthValues(): BirthFormValues {
  const stored = loadBirthProfile();
  return stored ? fromBirthInput(stored) : EMPTY_BIRTH;
}

export async function lookupDayMaster(
  birth: BirthProfileInput,
  lookup: typeof api.getDayMaster = api.getDayMaster,
  report: typeof track = track,
): Promise<DayMasterProfile> {
  const response = await lookup(birth);
  const profile = dayMasterBySlug(response.slug);
  if (profile.stem !== response.stem || profile.element !== response.element
    || profile.yinYang !== response.yinYang) throw new Error("day-master-mismatch");
  report("day_master_lookup");
  return profile;
}

export function DayMasterResultCard(props: {
  profile: DayMasterProfile;
  onPaidEntry(): void;
}) {
  const { lang, t } = useLang();
  const copy = props.profile[lang];
  const shareModel = buildDayMasterShareCard(props.profile, lang);
  return <div className="day-master-result" aria-live="polite">
    <div className="day-master-identity">
      <p>{t("dayMaster.title")}</p>
      <strong>{copy.name}</strong>
      <span>{copy.yinYang} · {copy.image}</span>
    </div>
    <div className="day-master-copy">
      <p className="day-master-summary">{copy.summary}</p>
      <div className="day-master-keywords" aria-label={t("dayMaster.keywords")}>
        {copy.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
      </div>
      <div className="day-master-lists">
        <div><h3>{t("dayMaster.strengths")}</h3><ul>
          {copy.strengths.map((value) => <li key={value}>{value}</li>)}
        </ul></div>
        <div><h3>{t("dayMaster.watch")}</h3><ul>
          {copy.watch.map((value) => <li key={value}>{value}</li>)}
        </ul></div>
      </div>
      <div className="day-master-actions">
        {lang === "en" ? <a className="button" href={`/bazi/day-master/${props.profile.slug}/`}>
          {t("dayMaster.guide")}</a> : null}
        <a className="button button-primary" href="#/?kind=destiny" onClick={props.onPaidEntry}>
          {t("dayMaster.paid")}</a>
        <ShareImageButton
          busyLabel={t("share.generating")}
          closeLabel={t("share.close")}
          dialogTitle={t("dayMaster.shareDialog")}
          downloadLabel={t("share.download")}
          fileName={`yarrow-day-master-${props.profile.slug}.png`}
          generateFailed={t("share.generateFailed")}
          metricEvent="share_image:day-master"
          previewAlt={t("dayMaster.sharePreview")}
          shareFailed={t("share.shareFailed")}
          shareLabel={t("share.share")}
          triggerLabel={t("dayMaster.share")}
          draw={(context, assets) => drawShareCard(context, shareModel, {
            brush: '"Ma Shan Zheng Subset", "Kaiti SC", "STKaiti", "KaiTi", serif',
            body: '"Songti SC", "STSong", Georgia, serif',
            latin: "Georgia, serif",
          }, assets)}
        />
      </div>
    </div>
  </div>;
}

export function DayMasterFinderView(props: {
  values: BirthFormValues;
  problem: string | null;
  result: DayMasterProfile | null;
  busy: boolean;
  error: string;
  onChange(values: BirthFormValues): void;
  onSubmit(): void;
  onPaidEntry?(): void;
}) {
  const t = useT();
  return <section className="day-master-finder" aria-labelledby="day-master-title">
    <header className="day-master-head">
      <div><p>{t("dayMaster.free")}</p><h2 id="day-master-title">{t("dayMaster.title")}</h2></div>
      <p>{t("dayMaster.description")}</p>
    </header>
    <form onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }}>
      <BirthFields values={props.values} problem={props.problem} onChange={props.onChange} />
      <button className="button button-primary" disabled={props.busy || props.problem !== null} type="submit">
        {t(props.busy ? "dayMaster.calculating" : "dayMaster.submit")}
      </button>
    </form>
    {props.error ? <p className="error" role="alert">{props.error}</p> : null}
    {props.result ? <DayMasterResultCard profile={props.result}
      onPaidEntry={props.onPaidEntry ?? (() => {})} /> : null}
  </section>;
}

export function DayMasterFinder() {
  const t = useT();
  const [values, setValues] = useState<BirthFormValues>(initialBirthValues);
  const [result, setResult] = useState<DayMasterProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const problem = birthProblem(values, t);
  const saveCurrentBirth = () => {
    if (birthProblem(values, t) === null) saveBirthProfile(toBirthInput(values, t));
  };
  const submit = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const birth = saveBirthProfile(toBirthInput(values, t));
      setResult(await lookupDayMaster(birth));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error && caught.message === "day-master-mismatch"
        ? t("errors.generic") : apiErrorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };
  return <DayMasterFinderView
    busy={busy}
    error={error}
    onChange={(next) => { setValues(next); setResult(null); setError(""); }}
    onPaidEntry={saveCurrentBirth}
    onSubmit={() => void submit()}
    problem={problem}
    result={result}
    values={values}
  />;
}
