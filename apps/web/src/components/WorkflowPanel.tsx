import type { StreamStatus } from "../hooks/useEntropyStream";

export function WorkflowPanel({ steps, status }: { steps: { id: string; name: string }[]; status: StreamStatus }) {
  return (
    <section className="panel p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="eyebrow text-body">Generated Workflow</h2>
        <span className="data text-[10px] text-dim">{steps.length ? "WorkflowSpec" : "—"}</span>
      </div>
      <p className="mb-4 text-[11px] text-dim">Qwen-generated · deterministically assembled &amp; governed</p>
      {steps.length === 0 ? (
        <div className="flex items-center justify-center rounded-[3px] border border-dashed border-line py-8">
          <p className="data text-center text-[12px] text-dim">
            {status === "streaming" ? "Qwen is generating the workflow…" : "run to generate the governed workflow"}
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3">
              <span className="data grid h-6 w-6 place-items-center rounded-[3px] border border-line text-[11px] text-dim">{i + 1}</span>
              <span className="font-mono text-[13px] text-hi">{s.name}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
