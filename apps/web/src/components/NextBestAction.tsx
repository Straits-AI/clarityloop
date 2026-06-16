export function NextBestAction({ action, note }: { action: string | null; note: string | null }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Next Best Action</h2>
      <p className="text-lg font-semibold text-slate-900">{action ?? "— (loop idle)"}</p>
      {note ? <p className="mt-1 text-sm text-slate-500">{note}</p> : null}
      <p className="mt-2 text-xs text-slate-400">Scored selection arrives in Plan 4 (selectNextBestAction).</p>
    </section>
  );
}
