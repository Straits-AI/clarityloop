import type { StreamStatus } from "../hooks/useEntropyStream";

const SAMPLE = "Same as last time, need 120 cartons urgently next week. Supplier quote attached.";

export function RequestPanel({ onRun, status }: { onRun: () => void; status: StreamStatus }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Input Request</h2>
      <p className="rounded-lg bg-slate-50 p-3 text-slate-800">{SAMPLE}</p>
      <button
        onClick={onRun}
        disabled={status === "streaming"}
        className="mt-3 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {status === "streaming" ? "Running..." : "Run ClarityLoop"}
      </button>
    </section>
  );
}
