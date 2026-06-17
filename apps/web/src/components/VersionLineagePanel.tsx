import type { BusinessProcedureVersion } from "@clarityloop/core";
import { toLineageRows } from "../lib/promotion-view";

export function VersionLineagePanel(props: { versions: BusinessProcedureVersion[] }) {
  const rows = toLineageRows(props.versions);
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-base font-semibold">Procedure version history</h2>
      <ol className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} style={{ paddingLeft: `${r.depth * 16}px` }} className="flex items-center gap-2">
            <span className="font-mono">{r.version}</span>
            {r.promoted && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">promoted</span>
            )}
            <span className="text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
