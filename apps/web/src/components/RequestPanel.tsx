import type { StreamStatus } from "../hooks/useEntropyStream";

const SAMPLE = "Same as last time, need 120 cartons urgently next week. Supplier quote attached.";

export function RequestPanel({ onRun, status }: { onRun: () => void; status: StreamStatus }) {
  const streaming = status === "streaming";
  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="eyebrow text-body">Input Request</h2>
        <span className="data text-[10px] text-dim">ambiguous · stale-mem · attachment</span>
      </div>
      <p className="rounded-[3px] border border-line bg-ink-900/60 p-3.5 font-mono text-[13px] leading-relaxed text-hi">
        <span className="mr-2 text-amber">›</span>
        {SAMPLE}
      </p>
      <button onClick={onRun} disabled={streaming} className="btn-console mt-4 w-full">
        {streaming ? "▶ Running…" : "▶ Run ClarityLoop"}
      </button>
    </section>
  );
}
