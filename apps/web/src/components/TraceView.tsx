import type { EntropyUpdate } from "@clarityloop/core";

export function TraceView({ updates }: { updates: EntropyUpdate[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Trace</h2>
      {updates.length === 0 ? (
        <p className="text-slate-400">No steps yet. Run ClarityLoop to stream the loop.</p>
      ) : (
        <ol className="space-y-1 font-mono text-sm">
          {updates.map((u) => (
            <li key={u.step} className="flex justify-between text-slate-700">
              <span>
                #{u.step} {u.phase}
              </span>
              <span className="tabular-nums">commit {u.entropy.commitEntropy.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
