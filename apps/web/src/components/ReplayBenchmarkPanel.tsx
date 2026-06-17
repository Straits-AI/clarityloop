import type { PromotionDecision, PromotionReport } from "@clarityloop/core";
import { toReplayRows } from "../lib/promotion-view";

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const tone = (d: "better" | "worse" | "same"): string =>
  d === "better" ? "text-emerald-600" : d === "worse" ? "text-rose-600" : "text-slate-500";

export function ReplayBenchmarkPanel(props: { report: PromotionReport; decision: PromotionDecision }) {
  const rows = toReplayRows(props.report);
  const { report, decision } = props;
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Replay benchmark</h2>
        <span className="text-sm text-slate-500">
          {report.fromVersion} → {report.toVersion} · {report.caseCount} cases
        </span>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1">Metric</th>
            <th className="py-1 text-right">Baseline</th>
            <th className="py-1 text-right">Candidate</th>
            <th className="py-1 text-right">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric} className="border-t border-slate-100">
              <td className="py-1">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{fmt(r.baseline)}</td>
              <td className="py-1 text-right tabular-nums">{fmt(r.candidate)}</td>
              <td className={`py-1 text-right tabular-nums ${tone(r.direction)}`}>
                {r.delta >= 0 ? "+" : ""}
                {fmt(r.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-3 text-sm">
        <span className="font-medium">Decision: </span>
        <span
          className={
            decision.type === "promote"
              ? "text-emerald-600"
              : decision.type === "reject"
                ? "text-rose-600"
                : "text-amber-600"
          }
        >
          {decision.type}
        </span>
      </footer>
    </section>
  );
}
