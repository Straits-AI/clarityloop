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
    <section className="panel panel-glow p-5" data-testid="entropy-heatmap">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="eyebrow text-body">Operational Entropy</h2>
          <p className="mt-1 text-[10.5px] text-dim">deterministic · computed from structured state</p>
        </div>
        <div className="text-right">
          <span data-testid="heatmap-commit" className="data block text-5xl font-bold leading-none text-hi">
            {entropy.commitEntropy.toFixed(2)}
          </span>
          <span className="eyebrow mt-1.5 block !tracking-[0.2em] text-amber">commit residual</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-1.5">
        {COMPONENTS.map(({ key, label }) => (
          <div
            key={key}
            data-testid={`cell-${key}`}
            className="relative overflow-hidden rounded-[3px] p-2.5"
            style={{ backgroundColor: entropyColor(entropy[key]) }}
          >
            {/* depth overlay so the lit segment reads as an instrument cell */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 to-black/45" />
            <div className="relative">
              <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-black/70">{label}</div>
              <div className="data mt-1.5 text-xl font-bold leading-none text-black/85">{entropy[key].toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="eyebrow !text-[9.5px]">commit-entropy history</span>
          <span className="data text-[9.5px] text-dim">↓ resolving</span>
        </div>
        <div className="flex h-16 items-end gap-1 rounded-[3px] border border-line bg-ink-900/50 p-1.5" data-testid="heatmap-history">
          {history.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-[2px] transition-all"
              style={{ height: `${Math.max(4, Math.round(v * 100))}%`, backgroundColor: entropyColor(v) }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
