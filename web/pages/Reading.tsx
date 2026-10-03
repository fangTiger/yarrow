// web/pages/Reading.tsx
export function Reading({ id }: { id: string }) {
  return (
    <main className="page">
      <section className="panel" aria-live="polite">
        <h1>正在打开这一卦</h1>
        <p className="hint">卦历编号：{id}</p>
      </section>
    </main>
  );
}
