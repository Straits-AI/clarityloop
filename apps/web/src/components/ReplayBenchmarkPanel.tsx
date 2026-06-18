import type { PromotionDecision, PromotionReport } from "@clarityloop/core";
import { toReplayRows } from "../lib/promotion-view";

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const tone = (d: "better" | "worse" | "same"): string =>
  d === "better" ? "text-go" : d === "worse" ? "text-stop" : "text-dim";

export function ReplayBenchmarkPanel(props: { report: PromotionReport; decision: PromotionDecision }) {
  const rows = toReplayRows(props.report);
  const { report, decision } = props;
  const vcls = decision.type === "promote" ? "v-go" : decision.type === "reject" ? "v-stop" : "v-hold";
  return (
    <section className="panel p-5">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="eyebrow text-body">Replay benchmark</h2>
        <span className="data text-[11px] text-dim">
          {report.fromVersion} → {report.toVersion} · {report.caseCount} cases
        </span>
      </header>
      <table className="w-full">
        <thead>
          <tr className="eyebrow !text-[9.5px] text-left">
            <th className="pb-2 font-medium">Metric</th>
            <th className="pb-2 text-right font-medium">Baseline</th>
            <th className="pb-2 text-right font-medium">Candidate</th>
            <th className="pb-2 text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric} className="border-t border-line">
              <td className="py-2 text-[13px] text-body">{r.label}</td>
              <td className="data py-2 text-right text-[13px] text-dim">{fmt(r.baseline)}</td>
              <td className="data py-2 text-right text-[13px] text-hi">{fmt(r.candidate)}</td>
              <td className={`data py-2 text-right text-[13px] ${tone(r.direction)}`}>
                {r.delta >= 0 ? "+" : ""}
                {fmt(r.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-4 flex items-center gap-3 border-t border-line pt-4">
        <span className="eyebrow">Decision</span>
        <span className={`verdict ${vcls}`}>{decision.type}</span>
      </footer>
    </section>
  );
}
