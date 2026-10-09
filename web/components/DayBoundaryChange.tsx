// web/components/DayBoundaryChange.tsx
import { useState } from "react";
import type { PublicBaziReading } from "../../src/sanyi/bazi-public.js";
import { matchesReading } from "./BirthCorrection.js";
import { api } from "../lib/api.js";
import { loadBirthProfile, type BirthProfileInput } from "../lib/birth-profile.js";
export function DayBoundaryChange({ reading, birth, onReading }: {
    reading: PublicBaziReading;
    birth: BirthProfileInput | null;
    onReading(value: PublicBaziReading): void;
}) {
    const available = birth !== null && matchesReading(birth, reading);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const change = async () => {
        const local = loadBirthProfile();
        if (!local) {
            setError("需在填写生辰的设备上切换");
            return;
        }
        setBusy(true);
        try {
            const value = await api.changeDayBoundary(reading.id, local, reading.chart.sect === 1 ? 2 : 1);
            if (value.kind === "destiny" || value.kind === "fortune") {
                onReading(value);
            }
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "切换暂不可用");
        }
        finally {
            setBusy(false);
        }
    };
    return <div className="day-boundary"><span>当前 {reading.chart.dayBoundary} 换日 · 剩余 {Math.max(0, 2 - reading.changes)} 次 · 免费</span><button type="button" disabled={!available || busy || reading.changes >= 2 || reading.status !== "done"} onClick={() => void change()}>切换换日口径</button>{!available ? <small>需在填写生辰的设备上切换</small> : null}{error ? <p className="error" role="alert">{error}</p> : null}</div>;
}
