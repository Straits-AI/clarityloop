import type { BusinessProcedureVersion } from "@clarityloop/core";
import { toLineageRows } from "../lib/promotion-view";

export function VersionLineagePanel(props: { versions: BusinessProcedureVersion[] }) {
  const rows = toLineageRows(props.versions);
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="eyebrow text-body">Procedure version history</h2>
        <span className="data text-[10px] text-dim">lineage</span>
      </div>
      <ol className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} style={{ marginLeft: `${r.depth * 18}px` }} className="flex items-center gap-2.5">
            <span className={`h-1.5 w-1.5 rounded-full ${r.promoted ? "bg-go" : "bg-dim"}`} style={r.promoted ? { boxShadow: "0 0 7px var(--go)" } : {}} />
            {r.depth > 0 && <span className="data text-dim">↳</span>}
            <span className="data text-[13px] text-hi">{r.version}</span>
            {r.promoted && (
              <span className="verdict v-go !border-go/40 !px-1.5 !py-0.5 !text-[9px] !tracking-[0.1em]">promoted</span>
            )}
            <span className="data ml-auto text-[11px] text-dim">{new Date(r.createdAt).toLocaleDateString()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
