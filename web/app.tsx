// web/app.tsx
import { useEffect, useState } from "react";
import { Home } from "./pages/Home.js";
import { Reading } from "./pages/Reading.js";
function route(hash: string): { page: "home" } | { page: "reading"; id: string } {
  const match = hash.match(/^#\/r\/([a-z2-7]{26})$/u);
  return match?.[1] ? { page: "reading", id: match[1] } : { page: "home" };
}
export function App() {
  const [current, setCurrent] = useState(() => route(location.hash));
  useEffect(() => {
    const update = () => setCurrent(route(location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return current.page === "reading" ? <Reading id={current.id} /> : <Home />;
}
