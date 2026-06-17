import type { EntropyScore } from "@clarityloop/core";
import { entropyColor } from "../lib/entropyColor";

const COMPONENTS: { key: keyof EntropyScore; label: string }[] = [
  { key: "taskEntropy", label: "Task" },
  { key: "evidenceEntropy", label: "Evidence" },
  { key: "actionEntropy", label: "Action" },
  { key: "policyEntropy", label: "Policy" },
  { key: "memoryEntropy", label: "Memory" },
  { key: "commitEntropy", label: "Commit" },
];

export function EntropyHeatmap({ entropy, history }: { entropy: EntropyScore; history: number[] }) {
  return (
    <section className="rounded-xl bg-slate-900 p-5 text-slate-100" data-testid="entropy-heatmap">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Commit Entropy</h2>
        <span data-testid="heatmap-commit" className="text-4xl font-bold tabular-nums">
          {entropy.commitEntropy.toFixed(2)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {COMPONENTS.map(({ key, label }) => (
          <div
            key={key}
            data-testid={`cell-${key}`}
            className="rounded-lg p-3"
            style={{ backgroundColor: entropyColor(entropy[key]) }}
          >
            <div className="text-xs font-medium text-slate-900/80">{label}</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">{entropy[key].toFixed(2)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-16 items-end gap-1" data-testid="heatmap-history">
        {history.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.round(v * 100)}%`, backgroundColor: entropyColor(v) }}
          />
        ))}
      </div>
    </section>
  );
}
