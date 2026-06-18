import type { EntropyUpdate } from "@clarityloop/core";

export function TraceView({ updates }: { updates: EntropyUpdate[] }) {
  return (
    <section className="panel flex h-full flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="eyebrow text-body">Trace</h2>
        <span className="data text-[10px] text-dim">{updates.length} frames</span>
      </div>
      {updates.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-[3px] border border-dashed border-line py-10">
          <p className="data text-center text-[12px] leading-relaxed text-dim">
            awaiting stream…
            <br />
            <span className="text-[10px]">run the loop to watch entropy resolve</span>
          </p>
        </div>
      ) : (
        <ol className="space-y-px overflow-hidden rounded-[3px] border border-line">
          {updates.map((u, i) => {
            const e = u.entropy.commitEntropy;
            const tone = e < 0.3 ? "text-go" : e < 0.6 ? "text-hold" : "text-stop";
            return (
              <li
                key={u.step}
                className="reveal flex items-center justify-between gap-3 bg-ink-850 px-3 py-2 font-mono text-[12px]"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="text-dim">
                  <span className="text-amber">#{u.step}</span> {u.phase}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`tabular-nums ${tone}`}>{e.toFixed(2)}</span>
                  <span className="h-1 w-12 overflow-hidden rounded-full bg-ink-700">
                    <span className={`block h-full ${e < 0.3 ? "bg-go" : e < 0.6 ? "bg-hold" : "bg-stop"}`} style={{ width: `${Math.round(e * 100)}%` }} />
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
