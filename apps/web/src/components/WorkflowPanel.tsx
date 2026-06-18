export function WorkflowPanel({ steps }: { steps: { id: string; name: string }[] }) {
  return (
    <section className="panel p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="eyebrow text-body">Generated Workflow</h2>
        <span className="data text-[10px] text-dim">WorkflowSpec</span>
      </div>
      <p className="mb-4 text-[11px] text-dim">Qwen-generated · deterministically assembled &amp; governed</p>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const isGate = s.name === "commit_gate";
          return (
            <li key={s.id} className="flex items-center gap-3">
              <span className={`data grid h-6 w-6 place-items-center rounded-[3px] border text-[11px] ${isGate ? "border-amber/50 bg-amber-soft text-amber" : "border-line text-dim"}`}>
                {i + 1}
              </span>
              <span className={`font-mono text-[13px] ${isGate ? "text-amber" : "text-hi"}`}>{s.name}</span>
              {isGate && <span className="data ml-auto text-[9.5px] tracking-[0.16em] text-amber/70">DECIDE</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
