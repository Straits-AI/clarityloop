export function WorkflowPanel({ steps }: { steps: { id: string; name: string }[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Generated Workflow</h2>
      <p className="mb-3 text-xs text-slate-400">Qwen-generated WorkflowSpec (wired in Plan 2)</p>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-2 text-slate-800">
            <span className="font-mono text-slate-400">{i + 1}.</span>
            {s.name}
          </li>
        ))}
      </ol>
    </section>
  );
}
