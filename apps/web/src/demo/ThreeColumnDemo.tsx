import type { DemoColumn, DemoViewModel } from "./demoViewModel";

function Column({ column, accent, index }: { column: DemoColumn; accent?: boolean; index: number }) {
  return (
    <section
      className={`panel reveal p-5 ${accent ? "panel-glow" : ""}`}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className={`display text-base ${accent ? "text-amber" : ""}`}>{column.title}</h3>
        {accent && <span className="verdict v-go !px-2 !py-0.5 !text-[9px]">winner</span>}
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-dim">{column.subtitle}</p>
      <dl className="space-y-px overflow-hidden rounded-[3px] border border-line">
        {column.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 bg-ink-850 px-3 py-2">
            <dt className="text-[12.5px] text-body">{row.label}</dt>
            <dd className="data text-[13px] text-hi">{row.value}</dd>
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
      <Column column={viewModel.baseline} index={0} />
      <Column column={viewModel.clarityloop} accent index={1} />
      <Column column={viewModel.promotion} index={2} />
    </div>
  );
}
