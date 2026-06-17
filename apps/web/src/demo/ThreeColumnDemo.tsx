import type { DemoColumn, DemoViewModel } from "./demoViewModel";

function Column({ column }: { column: DemoColumn }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-lg font-semibold">{column.title}</h3>
      <p className="text-sm text-slate-500">{column.subtitle}</p>
      <dl className="mt-3 space-y-1">
        {column.rows.map((row) => (
          <div key={row.label} className="flex justify-between text-sm">
            <dt className="text-slate-600">{row.label}</dt>
            <dd className="font-mono">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Three-column demo layout: Baseline | ClarityLoop | Promotion benchmark (design spec §10). */
export function ThreeColumnDemo({ viewModel }: { viewModel: DemoViewModel }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Column column={viewModel.baseline} />
      <Column column={viewModel.clarityloop} />
      <Column column={viewModel.promotion} />
    </div>
  );
}
