import type { StreamStatus } from "../hooks/useEntropyStream";

export function RequestPanel({
  value, onChange, onRun, status,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  status: StreamStatus;
}) {
  const streaming = status === "streaming";
  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="eyebrow text-body">Input Request</h2>
        <span className="data text-[10px] text-dim">type any customer request</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={streaming}
        rows={4}
        spellCheck={false}
        placeholder="Type a customer request… e.g. 'we need a quote for 120 cartons of the 1L olive oil, same address as last order, before month end.'"
        className="w-full resize-none rounded-[3px] border border-line bg-ink-900/60 p-3.5 font-mono text-[13px] leading-relaxed text-hi outline-none focus:border-amber/50 disabled:opacity-70"
      />
      <button onClick={onRun} disabled={streaming || !value.trim()} className="btn-console mt-3 w-full">
        {streaming ? "▶ Running…" : "▶ Run ClarityLoop"}
      </button>
    </section>
  );
}
