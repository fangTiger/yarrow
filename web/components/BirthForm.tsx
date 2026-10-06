// web/components/BirthForm.tsx
import { useState } from "react";
import { readCities } from "../../src/calendar/cities.js";
import { EMPTY_BIRTH, fromBirthInput, toBirthInput, useBirthProfile, type BirthProfileInput, type BirthFormValues } from "../lib/birth-profile.js";
export function BirthForm(props: {
    initial?: BirthProfileInput | null;
    temporary?: boolean;
    onBirth(input: BirthProfileInput): void;
    onFallback(): void;
    onCancel(): void;
}) {
    const [values, setValues] = useState(() => props.initial ? fromBirthInput(props.initial) : EMPTY_BIRTH);
    const [remember, setRemember] = useState(!props.temporary);
    const [error, setError] = useState("");
    function update<K extends keyof BirthFormValues>(key: K, value: BirthFormValues[K]): void {
        setValues((previous) => ({ ...previous, [key]: value }));
    }
    const submit = () => {
        try {
            const input = toBirthInput(values);
            props.onBirth(useBirthProfile(input, remember && !props.temporary));
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "请核对生辰");
        }
    };
    return <section className="panel birth-form" role="dialog" aria-label="填写生辰" aria-modal="false">
    <h2>{props.temporary ? "本次临时换一个生辰" : "本人生辰"}</h2>
    <label>历法<select value={values.calendar} onChange={(event) => update("calendar", event.target.value as BirthFormValues["calendar"])}>
      <option value="solar">公历</option><option value="lunar">农历</option>
    </select></label>
    {values.calendar === "lunar" ? <label><input type="checkbox" checked={values.isLeapMonth} onChange={(event) => update("isLeapMonth", event.target.checked)}/>闰月</label> : null}
    <div className="birth-date">{(["year", "month", "day"] as const).map((key, index) => <label key={key}>{["年", "月", "日"][index]}<input type="number" value={values[key]} onChange={(event) => update(key, event.target.value)}/></label>)}</div>
    <label>时间<input type="time" disabled={values.unknownTime} value={values.time} onChange={(event) => update("time", event.target.value)}/></label>
    <label><input type="checkbox" checked={values.unknownTime} onChange={(event) => update("unknownTime", event.target.checked)}/>不知道时辰</label>
    <label>性别<select value={values.gender} onChange={(event) => update("gender", event.target.value as BirthFormValues["gender"])}><option value="male">男</option><option value="female">女</option></select></label>
    <label>出生地方式<select value={values.placeMode} onChange={(event) => update("placeMode", event.target.value as BirthFormValues["placeMode"])}><option value="city">城市</option><option value="longitude">手填经度</option></select></label>
    {values.placeMode === "city" ? <label>出生城市<select value={values.city} onChange={(event) => update("city", event.target.value)}><option value="">未填出生地</option>{readCities().map((city) => <option key={city.name} value={city.name}>{city.name}</option>)}</select></label> : <label>经度<input type="number" step="0.01" value={values.longitude} onChange={(event) => update("longitude", event.target.value)}/></label>}
    {["香港", "澳门", "台北"].includes(values.city) && values.placeMode === "city" ? <p className="hint">当地历史夏令时不自动校正，请核对出生记录。</p> : null}
    {!props.temporary ? <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}/>记住本人档案（仅本机）</label> : <p>临时生辰不写入本机档案。</p>}
    <p>生辰会发送给解读模型提供方。</p>
    <p>分享结果链接会公开显示命盘（命盘可反推出生日期）。</p>
    <p className="hint">此处校验只为提示，以服务端为准。</p>
    {error ? <p role="alert" className="error">{error}</p> : null}
    <button type="button" onClick={submit}>使用本次生辰</button>
    <button type="button" onClick={props.onFallback}>改为起一卦问事</button>
    <button type="button" onClick={props.onCancel}>取消</button>
  </section>;
}
