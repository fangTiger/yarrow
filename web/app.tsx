// web/app.tsx
import { useEffect, useState } from "react";
import { Home } from "./pages/Home.js";
import { Reading } from "./pages/Reading.js";
import { SampleReading, type SampleKind } from "./pages/SampleReading.js";
export function route(hash: string): { page: "home" } | { page: "reading"; id: string }
  | { page: "sample"; kind: SampleKind } {
  const match = hash.match(/^#\/r\/([a-z2-7]{26})$/u);
  if (match?.[1]) return { page: "reading", id: match[1] };
  const sample = hash.match(/^#\/sample\/(destiny|question|fortune|naming)$/u)?.[1] as
    SampleKind | undefined;
  return sample ? { page: "sample", kind: sample } : { page: "home" };
}
export function App() {
  const [current, setCurrent] = useState(() => route(location.hash));
  useEffect(() => {
    const update = () => setCurrent(route(location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  if (current.page === "reading") return <Reading id={current.id} />;
  if (current.page === "sample") return <SampleReading kind={current.kind} />;
  return <Home />;
}
